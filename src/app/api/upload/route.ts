import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth-helpers';
import fs from 'fs';
import path from 'path';
import { canUserAccessNode, getNodeName, logAuthorization, findAreaForNode } from '@/lib/permission';

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

    // Auth check
    const token = request.cookies.get('session_token')?.value;
    let currentUser: any = null;
    if (token) {
      const decoded = await verifyToken(token);
      if (decoded) {
        currentUser = await db.user.findUnique({
          where: { id: decoded.userId }
        });
      }
    }

    // Get file info and arraybuffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Clean parentId (empty string or "root" goes to null parent)
    const cleanParentId = (parentId === 'root' || parentId === '') ? null : parentId;

    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check permission to upload to parent directory
    const allowed = await canUserAccessNode(currentUser, cleanParentId, true);
    const parentName = await getNodeName(cleanParentId);
    const userAreaName = currentUser.areaId 
      ? (await db.area.findUnique({ where: { id: currentUser.areaId } }))?.name || 'Área'
      : 'General';

    if (!allowed) {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Subir archivo "${file.name}" en "${parentName}"`,
        parentName,
        'Denegado'
      );
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para subir archivos en esta carpeta' },
        { status: 403 }
      );
    } else {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Subir archivo "${file.name}" en "${parentName}"`,
        parentName,
        'Permitido'
      );
    }

    // Detect if this folder belongs to an Area
    const area = await findAreaForNode(cleanParentId);

    // Save in DB first to get a unique ID to prevent conflicts in storage
    const node = await db.node.create({
      data: {
        name: file.name,
        type: 'FILE',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        parentId: cleanParentId,
        creator: creator || (currentUser ? currentUser.name : null),
        verifier1: verifier1 || null,
        verifier2: verifier2 || null,
        verifier3: verifier3 || null,
      },
    });

    // If it belongs to an area, create Document and Signatures
    if (area && currentUser) {
      // Create Document
      const document = await db.document.create({
        data: {
          areaId: area.id,
          nodeId: node.id,
          status: 'PENDIENTE',
          creatorId: currentUser.id
        }
      });

      // Get area verifiers
      const areaVerifiers = await db.verifier.findMany({
        where: { areaId: area.id },
        orderBy: { signOrder: 'asc' }
      });

      // Create Signature slots for each verifier
      if (areaVerifiers.length > 0) {
        await db.signature.createMany({
          data: areaVerifiers.map((v) => ({
            documentId: document.id,
            userId: v.userId,
            status: 'PENDIENTE'
          }))
        });
      }

      // Log Audit
      await db.audit.create({
        data: {
          username: currentUser.username,
          action: 'SUBIR_DOCUMENTO',
          detail: `Subió el documento "${file.name}" en el área "${area.name}"`
        }
      });
    }

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
