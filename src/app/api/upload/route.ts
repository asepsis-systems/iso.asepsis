import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;
    const creator = formData.get('creator') as string | null;
    const verifier1 = formData.get('verifier1') as string | null;
    const verifier2 = formData.get('verifier2') as string | null;
    const verifier3 = formData.get('verifier3') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    // Get file info and arraybuffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Clean parentId (empty string or "root" goes to null parent)
    const cleanParentId = (parentId === 'root' || parentId === '') ? null : parentId;

    // Save in DB first to get a unique ID to prevent conflicts in storage
    const node = await db.node.create({
      data: {
        name: file.name,
        type: 'FILE',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        parentId: cleanParentId,
        creator: creator || null,
        verifier1: verifier1 || null,
        verifier2: verifier2 || null,
        verifier3: verifier3 || null,
      },
    });

    // Write file to Storage
    const diskFileName = `${node.id}-${file.name}`;
    
    if (supabase) {
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('files')
        .upload(diskFileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) {
        // Clean DB if upload fails
        await db.node.delete({ where: { id: node.id } });
        throw new Error('Supabase Storage Error: ' + uploadError.message);
      }
    } else {
      // Local storage fallback
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      // Ensure local upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, diskFileName);
      fs.writeFileSync(filePath, buffer);
    }

    // Update node with the path
    const updatedNode = await db.node.update({
      where: { id: node.id },
      data: { path: `/api/files/download?id=${node.id}` },
    });

    return NextResponse.json(updatedNode);
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Error interno al subir el archivo: ' + error.message }, { status: 500 });
  }
}
