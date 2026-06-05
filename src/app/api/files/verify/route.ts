import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'ID del archivo es obligatorio' }, { status: 400 });
    }

    // Retrieve active user from cookies
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // Get user from DB
    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Find the file node
    const node = await db.node.findUnique({
      where: { id: fileId }
    });

    if (!node) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    if (node.type !== 'FILE') {
      return NextResponse.json({ error: 'Solo se pueden verificar archivos, no carpetas.' }, { status: 400 });
    }

    if (node.isTrashed) {
      return NextResponse.json({ error: 'No se puede verificar un archivo que está en la papelera.' }, { status: 400 });
    }

    const normalizedCreator = node.creator?.trim().toLowerCase() || '';
    const normalizedUser = user.name?.trim().toLowerCase() || '';

    // Rule 1: The creator cannot verify their own file
    if (normalizedCreator === normalizedUser) {
      return NextResponse.json({ 
        error: 'Restricción de control: El creador del archivo no puede firmar como verificador.' 
      }, { status: 403 });
    }

    // Rule 2: The user cannot sign twice
    const alreadySigned = 
      node.verifier1?.trim().toLowerCase() === normalizedUser || 
      node.verifier2?.trim().toLowerCase() === normalizedUser || 
      node.verifier3?.trim().toLowerCase() === normalizedUser;

    if (alreadySigned) {
      return NextResponse.json({ 
        error: 'Ya has firmado/verificado este documento.' 
      }, { status: 400 });
    }

    // Rule 3: Find the next empty verifier slot in order (1 -> 2 -> 3)
    let updateData: any = {};
    if (!node.verifier1) {
      updateData.verifier1 = user.name;
    } else if (!node.verifier2) {
      updateData.verifier2 = user.name;
    } else if (!node.verifier3) {
      updateData.verifier3 = user.name;
    } else {
      return NextResponse.json({ error: 'Este documento ya está completamente verificado (3/3 firmas).' }, { status: 400 });
    }

    // Save update
    const updatedNode = await db.node.update({
      where: { id: fileId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Firma registrada con éxito.',
      node: updatedNode
    });

  } catch (error: any) {
    console.error('Error during file verification:', error);
    return NextResponse.json({ error: 'Error interno en el servidor: ' + error.message }, { status: 500 });
  }
}
