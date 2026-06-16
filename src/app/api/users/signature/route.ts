import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // 2. Get User ID (either target user for admin, or self)
    const formData = await request.formData();
    const targetUserId = formData.get('userId') as string | null;
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    // Admins can upload signatures for any user, other roles only for themselves
    const finalUserId = (decoded.role === 'ADMIN' && targetUserId) ? targetUserId : decoded.userId;

    const user = await db.user.findUnique({
      where: { id: finalUserId }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // 3. Process File Upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Clean and generate filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const diskFileName = `sig-${finalUserId}-${Date.now()}.${fileExtension}`;
    let signaturePath = '';

    if (supabase) {
      // Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('files')
        .upload(`signatures/${diskFileName}`, buffer, {
          contentType: file.type || 'image/png',
          upsert: true
        });

      if (uploadError) {
        throw new Error('Supabase Storage Error: ' + uploadError.message);
      }
      
      // Get public URL
      const { data } = supabase.storage.from('files').getPublicUrl(`signatures/${diskFileName}`);
      signaturePath = data.publicUrl;
    } else {
      // Local Storage fallback: Save in the public folder so Next.js serves it statically
      const uploadDir = path.join(process.cwd(), 'public', 'signatures');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, diskFileName);
      fs.writeFileSync(filePath, buffer);
      
      signaturePath = `/signatures/${diskFileName}`;
    }

    // 4. Update User in DB
    const updatedUser = await db.user.update({
      where: { id: finalUserId },
      data: { signature: signaturePath },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        signature: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Firma digital actualizada con éxito.',
      user: updatedUser
    });

  } catch (error: any) {
    console.error('Error uploading signature:', error);
    return NextResponse.json({ error: 'Error al subir firma: ' + error.message }, { status: 500 });
  }
}
