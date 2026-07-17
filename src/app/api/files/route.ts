import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth-helpers';
import fs from 'fs';
import path from 'path';
import { canUserAccessNode, getNodeName, logAuthorization, findAreaForNode } from '@/lib/permission';

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
        whereClause.OR = [
          // New system: has document and user has a pending signature
          {
            document: {
              status: { in: ['PENDIENTE', 'EN_PROCESO'] },
              signatures: {
                some: {
                  userId: user.id,
                  status: 'PENDIENTE'
                }
              }
            }
          },
          // Legacy system fallback: no document and fits old criteria
          {
            AND: [
              { document: null },
              {
                OR: [
                  { creator: null },
                  { NOT: { creator: user.name } }
                ]
              },
              {
                OR: [
                  { verifier1: null },
                  { NOT: { verifier1: user.name } }
                ]
              },
              {
                OR: [
                  { verifier2: null },
                  { NOT: { verifier2: user.name } }
                ]
              },
              {
                OR: [
                  { verifier3: null },
                  { NOT: { verifier3: user.name } }
                ]
              },
              {
                OR: [
                  { verifier1: null },
                  { verifier2: null },
                  { verifier3: null }
                ]
              }
            ]
          }
        ];
      }
      else if (filter === 'signed-by-me' && user) {
        whereClause.type = 'FILE';
        whereClause.OR = [
          // New system: has document and user has approved it
          {
            document: {
              signatures: {
                some: {
                  userId: user.id,
                  status: 'APROBADO'
                }
              }
            }
          },
          // Legacy system fallback: no document and user is one of the verifier columns
          {
            AND: [
              { document: null },
              {
                OR: [
                  { verifier1: user.name },
                  { verifier2: user.name },
                  { verifier3: user.name }
                ]
              }
            ]
          }
        ];
      }
      else if (filter === 'my-elaborated' && user) {
        whereClause.type = 'FILE';
        whereClause.OR = [
          // New system: user is document creator
          {
            document: {
              creatorId: user.id
            }
          },
          // Legacy system: creator name matches
          {
            AND: [
              { document: null },
              { creator: user.name }
            ]
          }
        ];
      }
      else if (filter === 'my-elaborated-pending' && user) {
        whereClause.type = 'FILE';
        whereClause.OR = [
          // New system: creator matches and status is pending
          {
            document: {
              creatorId: user.id,
              status: { in: ['PENDIENTE', 'EN_PROCESO'] }
            }
          },
          // Legacy system: creator name matches, no document, and empty verifiers
          {
            AND: [
              { document: null },
              { creator: user.name },
              {
                OR: [
                  { verifier1: null },
                  { verifier2: null },
                  { verifier3: null }
                ]
              }
            ]
          }
        ];
      }
      else if (filter === 'my-elaborated-approved' && user) {
        whereClause.type = 'FILE';
        whereClause.OR = [
          // New system: creator matches and status is approved
          {
            document: {
              creatorId: user.id,
              status: 'APROBADO'
            }
          },
          // Legacy system: creator matches, no document, and all verifiers set
          {
            AND: [
              { document: null },
              { creator: user.name },
              { verifier1: { not: null } },
              { verifier2: { not: null } },
              { verifier3: { not: null } }
            ]
          }
        ];
      }
      // Handles navigation inside folders
      else if (!search && filter !== 'recent') {
        if (parentId === 'root' || !parentId) {
          if (user && user.role !== 'ADMIN' && user.areaId) {
            const userArea = await db.area.findUnique({ where: { id: user.areaId } });
            const generalFolder = await db.node.findFirst({
              where: {
                name: 'General',
                parentId: null,
                type: 'FOLDER',
                isTrashed: false
              }
            });

            const visibleFolderIds: string[] = [];
            if (userArea && userArea.folderNodeId) {
              visibleFolderIds.push(userArea.folderNodeId);
            }
            if (generalFolder) {
              visibleFolderIds.push(generalFolder.id);
            }

            if (visibleFolderIds.length > 0) {
              whereClause.id = { in: visibleFolderIds };
            } else {
              whereClause.id = 'non-existent-id';
            }
          } else {
            whereClause.parentId = null;
          }
        } else {
          // Verify permission first
          const allowed = await canUserAccessNode(user, parentId);
          const parentName = await getNodeName(parentId);
          const userAreaName = user && user.areaId 
            ? (await db.area.findUnique({ where: { id: user.areaId } }))?.name || 'Área'
            : 'General';

          if (!allowed) {
            if (user) {
              await logAuthorization(
                user.username,
                userAreaName,
                `Abrir carpeta "${parentName}"`,
                parentName,
                'Denegado'
              );
            }
            return NextResponse.json(
              { success: false, error: 'No tiene permisos para acceder a esta carpeta' },
              { status: 403 }
            );
          } else {
            if (user) {
              await logAuthorization(
                user.username,
                userAreaName,
                `Abrir carpeta "${parentName}"`,
                parentName,
                'Permitido'
              );
            }
          }
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
      include: {
        areaFolder: true,
        document: {
          include: {
            signatures: {
              include: {
                user: {
                  select: { id: true, name: true, role: true }
                }
              }
            }
          }
        }
      }
    });

    // Fetch all users to map signatures by name
    const users = await db.user.findMany({
      select: { name: true, signature: true }
    });

    const signatureMap = new Map<string, string | null>();
    users.forEach(u => {
      if (u.name) {
        signatureMap.set(u.name.trim().toLowerCase(), u.signature);
      }
    });

    const enrichedItems = items.map((item: any) => {
      if (item.type !== 'FILE') return item;
      return {
        ...item,
        creatorSignature: item.creator ? signatureMap.get(item.creator.trim().toLowerCase()) || null : null,
        verifier1Signature: item.verifier1 ? signatureMap.get(item.verifier1.trim().toLowerCase()) || null : null,
        verifier2Signature: item.verifier2 ? signatureMap.get(item.verifier2.trim().toLowerCase()) || null : null,
        verifier3Signature: item.verifier3 ? signatureMap.get(item.verifier3.trim().toLowerCase()) || null : null,
      };
    });

    // Filter items based on user area permissions (excluding ADMIN or General users)
    const allowedItems: any[] = [];
    for (const item of enrichedItems) {
      if (!user || user.role === 'ADMIN' || !user.areaId) {
        allowedItems.push(item);
      } else {
        const allowed = await canUserAccessNode(user, item.id);
        if (allowed) {
          allowedItems.push(item);
        }
      }
    }

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

    return NextResponse.json({ items: allowedItems, breadcrumbs });
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

    // Retrieve active user from session token
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

    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }



    // Check permission to create folder
    const allowed = await canUserAccessNode(currentUser, cleanParentId, true, true);
    const parentName = await getNodeName(cleanParentId);
    const userAreaName = currentUser.areaId 
      ? (await db.area.findUnique({ where: { id: currentUser.areaId } }))?.name || 'Área'
      : 'General';

    if (!allowed) {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Crear carpeta "${name}" en "${parentName}"`,
        parentName,
        'Denegado'
      );
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para crear carpetas en esta ubicación' },
        { status: 403 }
      );
    } else {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Crear carpeta "${name}" en "${parentName}"`,
        parentName,
        'Permitido'
      );
    }

    const folder = await db.node.create({
      data: {
        name,
        type: 'FOLDER',
        parentId: cleanParentId,
        creator: currentUser.name,
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

    const existingNode = await db.node.findUnique({
      where: { id },
      include: { document: true, areaFolder: true }
    });

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

    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (existingNode?.document?.status === 'APROBADO' && currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No se puede modificar un documento completamente aprobado.' }, { status: 400 });
    }

    // Check permission on the target node being updated
    const nodeAllowed = await canUserAccessNode(currentUser, id, true);
    const nodeName = existingNode ? existingNode.name : 'Desconocido';
    const userAreaName = currentUser.areaId 
      ? (await db.area.findUnique({ where: { id: currentUser.areaId } }))?.name || 'Área'
      : 'General';

    if (!nodeAllowed) {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Modificar/Mover elemento "${nodeName}"`,
        nodeName,
        'Denegado'
      );
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para modificar este elemento.' },
        { status: 403 }
      );
    }

    // If parentId (move destination) is provided, validate destination folder access
    if (parentId !== undefined) {
      const destParentId = (parentId === 'root' || parentId === '') ? null : parentId;
      const destAllowed = await canUserAccessNode(currentUser, destParentId, true, true);
      const destParentName = await getNodeName(destParentId);
      if (!destAllowed) {
        await logAuthorization(
          currentUser.username,
          userAreaName,
          `Mover elemento "${nodeName}" a "${destParentName}"`,
          nodeName,
          'Denegado'
        );
        return NextResponse.json(
          { success: false, error: 'No tiene permisos para mover elementos a esa ubicación.' },
          { status: 403 }
        );
      } else {
        await logAuthorization(
          currentUser.username,
          userAreaName,
          `Mover elemento "${nodeName}" a "${destParentName}"`,
          nodeName,
          'Permitido'
        );
      }
    } else {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Modificar elemento "${nodeName}"`,
        nodeName,
        'Permitido'
      );
    }

    if (isTrashed === true) {
      if (existingNode?.areaFolder) {
        if (currentUser.role !== 'ADMIN') {
          return NextResponse.json({ error: 'Solo los administradores pueden mover carpetas principales de área a la papelera.' }, { status: 403 });
        }
      } else {
        const nodeArea = await findAreaForNode(id);
        const isAreaCreator = nodeArea && currentUser.role === 'CREATOR' && currentUser.areaId === nodeArea.id;

        if (currentUser.role !== 'ADMIN' && existingNode?.creator !== currentUser.name && !isAreaCreator) {
          return NextResponse.json({ error: 'No tienes permisos para mover este elemento a la papelera.' }, { status: 403 });
        }
      }
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
      include: { document: true, areaFolder: true }
    });

    if (!node) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

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

    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (node.document?.status === 'APROBADO' && currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No se puede eliminar un documento completamente aprobado.' }, { status: 400 });
    }

    const nodeAllowed = await canUserAccessNode(currentUser, id, true);
    const nodeName = node.name;
    const userAreaName = currentUser.areaId 
      ? (await db.area.findUnique({ where: { id: currentUser.areaId } }))?.name || 'Área'
      : 'General';

    if (!nodeAllowed) {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Eliminar permanentemente "${nodeName}"`,
        nodeName,
        'Denegado'
      );
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para eliminar este elemento.' },
        { status: 403 }
      );
    } else {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Eliminar permanentemente "${nodeName}"`,
        nodeName,
        'Permitido'
      );
    }

    if (node.areaFolder) {
      if (currentUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo los administradores pueden eliminar carpetas principales de área.' }, { status: 403 });
      }
    } else {
      const nodeArea = await findAreaForNode(id);
      const isAreaCreator = nodeArea && currentUser.role === 'CREATOR' && currentUser.areaId === nodeArea.id;

      if (currentUser.role !== 'ADMIN' && node.creator !== currentUser.name && !isAreaCreator) {
        return NextResponse.json({ error: 'No tienes permisos para eliminar este elemento.' }, { status: 403 });
      }
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
      if (supabase) {
        const { error } = await supabase.storage.from('files').remove([diskFileName]);
        if (error) {
          console.error(`Error al eliminar archivo de Supabase Storage: ${diskFileName}`, error.message);
        }
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDir, diskFileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error(`Error al eliminar archivo físico: ${diskFileName}`, err);
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
