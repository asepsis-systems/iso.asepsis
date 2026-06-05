import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
    }

    const node = await db.node.findUnique({
      where: { id },
    });

    if (!node || node.type !== 'FILE') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const diskFileName = `${node.id}-${node.name}`;
    
    if (supabase) {
      const { data } = supabase.storage.from('files').getPublicUrl(diskFileName);

      if (!data || !data.publicUrl) {
        return NextResponse.json({ error: 'No se pudo obtener la URL de descarga' }, { status: 500 });
      }

      return NextResponse.redirect(data.publicUrl);
    } else {
      // Local storage fallback: serve the file directly
      const uploadDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadDir, diskFileName);
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Archivo físico no encontrado en el servidor local' }, { status: 404 });
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': node.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(node.name)}"`,
        },
      });
    }
  } catch (error: any) {
    console.error('Error fetching file link:', error);
    return NextResponse.json({ error: 'Error al obtener el archivo: ' + error.message }, { status: 500 });
  }
}
