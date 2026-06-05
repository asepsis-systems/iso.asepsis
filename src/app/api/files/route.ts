import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const search = searchParams.get('search');
    const filter = searchParams.get('filter'); // "recent" | "starred" | "trash" | "all"

    // Retrieve active user from session token
    const token = request.cookies.get('session_token')?.value;
    let user: any = null;
    if (token) {
      const decoded = await verifyToken(token);
      if (decoded) {
        user = await db.user.findUnique({
          where: { id: decoded.userId }
        });
      }
    }

    // Construct query parameters
    let whereClause: any = {};

    // Handles Soft Trashed status
    if (filter === 'trash') {
      whereClause.isTrashed = true;
    } else {
      whereClause.isTrashed = false;
      
      // Handles filtering by stars
      if (filter === 'starred') {
        whereClause.isStarred = true;
      } 
      else if (filter === 'pending-my-signature' && user) {
        whereClause.type = 'FILE';
        whereClause.NOT = [
          { creator: user.name }
        ];
        whereClause.AND = [
          // User has not signed verifier 1
          {
            OR: [
              { verifier1: null },
              { NOT: { verifier1: user.name } }
            ]
          },
          // User has not signed verifier 2
          {
            OR: [
              { verifier2: null },
              { NOT: { verifier2: user.name } }
            ]
          },
          // User has not signed verifier 3
          {
            OR: [
              { verifier3: null },
              { NOT: { verifier3: user.name } }
            ]
          },
          // At least one slot is empty
          {
            OR: [
              { verifier1: null },
              { verifier2: null },
              { verifier3: null }
            ]
          }
        ];
      }
      else if (filter === 'signed-by-me' && user) {
        whereClause.type = 'FILE';
        whereClause.OR = [
          { verifier1: user.name },
          { verifier2: user.name },
          { verifier3: user.name }
        ];
      }
      else if (filter === 'my-elaborated' && user) {
        whereClause.type = 'FILE';
        whereClause.creator = user.name;
      }
      else if (filter === 'my-elaborated-pending' && user) {
        whereClause.type = 'FILE';
        whereClause.creator = user.name;
        whereClause.OR = [
          { verifier1: null },
          { verifier2: null },
          { verifier3: null }
        ];
      }
      else if (filter === 'my-elaborated-approved' && user) {
        whereClause.type = 'FILE';
        whereClause.creator = user.name;
        whereClause.verifier1 = { not: null };
        whereClause.verifier2 = { not: null };
        whereClause.verifier3 = { not: null };
      }
      // Handles navigation inside folders
      else if (!search && filter !== 'recent') {
        if (parentId === 'root' || !parentId) {
          whereClause.parentId = null;
        } else {
          whereClause.parentId = parentId;
        }
      }
    }

    // Handles Search query
    if (search) {
      whereClause.name = {
        contains: search,
      };
    }

    // Determine sorting
    let orderBy: any = { type: 'asc' }; // Folders first, then files
    if (filter === 'recent') {
      orderBy = { updatedAt: 'desc' };
    } else {
      orderBy = [
        { type: 'asc' }, // FOLDER first, then FILE
        { name: 'asc' }
      ];
    }

    const items = await db.node.findMany({
      where: whereClause,
      orderBy: orderBy,
    });

    // Also return current folder breadcrumbs if parentId is active
    let breadcrumbs: any[] = [];
    if (parentId && parentId !== 'root' && filter !== 'trash' && filter !== 'starred' && filter !== 'recent') {
      let currentId: string | null = parentId;
      while (currentId) {
        const folder: any = await db.node.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, parentId: true },
        });
        if (folder) {
          breadcrumbs.unshift({ id: folder.id, name: folder.name });
          currentId = folder.parentId;
        } else {
          currentId = null;
        }
      }
    }

    return NextResponse.json({ items, breadcrumbs });
  } catch (error: any) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json({ error: 'Error al listar archivos: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const cleanParentId = (parentId === 'root' || parentId === '') ? null : parentId;

    const folder = await db.node.create({
      data: {
        name,
        type: 'FOLDER',
        parentId: cleanParentId,
      },
    });

    return NextResponse.json(folder);
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Error al crear carpeta: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, isStarred, isTrashed, parentId, creator, verifier1, verifier2, verifier3 } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (isStarred !== undefined) updateData.isStarred = isStarred;
    if (isTrashed !== undefined) updateData.isTrashed = isTrashed;
    if (creator !== undefined) updateData.creator = creator;
    if (verifier1 !== undefined) updateData.verifier1 = verifier1;
    if (verifier2 !== undefined) updateData.verifier2 = verifier2;
    if (verifier3 !== undefined) updateData.verifier3 = verifier3;
    if (parentId !== undefined) {
      updateData.parentId = (parentId === 'root' || parentId === '') ? null : parentId;
    }

    const updatedNode = await db.node.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedNode);
  } catch (error: any) {
    console.error('Error updating node:', error);
    return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
    }

    // Retrieve file to delete on disk if necessary
    const node = await db.node.findUnique({
      where: { id },
    });

    if (!node) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Recursive helper to delete children folders/files recursively
    if (node.type === 'FOLDER') {
      await deleteFolderRecursively(node.id);
    } else {
      await deleteFileFromDisk(node);
    }

    await db.node.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Eliminado permanentemente' });
  } catch (error: any) {
    console.error('Error deleting node:', error);
    return NextResponse.json({ error: 'Error al eliminar permanentemente: ' + error.message }, { status: 500 });
  }
}

async function deleteFileFromDisk(node: any) {
  if (node.type === 'FILE') {
    const diskFileName = `${node.id}-${node.name}`;
    try {
      const { error } = await supabase.storage.from('files').remove([diskFileName]);
      if (error) {
        console.error(`Error al eliminar archivo de Supabase Storage: ${diskFileName}`, error.message);
      }
    } catch (err) {
      console.error(`Error en la llamada a Supabase al eliminar: ${diskFileName}`, err);
    }
  }
}

async function deleteFolderRecursively(folderId: string) {
  const children = await db.node.findMany({
    where: { parentId: folderId },
  });

  for (const child of children) {
    if (child.type === 'FOLDER') {
      await deleteFolderRecursively(child.id);
    } else {
      await deleteFileFromDisk(child);
    }
    await db.node.delete({
      where: { id: child.id },
    });
  }
}
