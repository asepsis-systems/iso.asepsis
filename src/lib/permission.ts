import { db } from './db';

/**
 * Recurse upwards to find if a folder (or file's parent folder) is linked to a specific Area.
 */
export async function findAreaForNode(nodeId: string | null): Promise<any | null> {
  let currentId = nodeId;
  while (currentId) {
    const area = await db.area.findUnique({
      where: { folderNodeId: currentId }
    });
    if (area) return area;

    const node = await db.node.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    currentId = node ? node.parentId : null;
  }
  return null;
}

/**
 * Recurse upwards to check if a folder (or file's parent folder) resides under the "General" root folder.
 */
export async function isNodeUnderGeneral(nodeId: string | null): Promise<boolean> {
  let currentId = nodeId;
  while (currentId) {
    const node = await db.node.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true }
    });
    if (!node) break;
    if (node.parentId === null && node.name === 'General') {
      return true;
    }
    currentId = node.parentId;
  }
  return false;
}

/**
 * Check if the user is authorized to read/write a specific folder or file node.
 */
export async function canUserAccessNode(
  user: any,
  nodeId: string | null,
  isWrite: boolean = false,
  isParentFolder: boolean = false
): Promise<boolean> {
  if (!user) return false;

  // 1. ADMIN and General/Global users have access to everything
  if (user.role === 'ADMIN' || !user.areaId) {
    return true;
  }

  // 2. Root directory (parentId === null)
  if (!nodeId) {
    // Reading/viewing root is allowed so restricted users can see their own area folder.
    // Writing/uploading/creating folders directly at root is prohibited.
    return !isWrite;
  }

  // 3. Check if the node is the "General" root folder itself.
  // Restricted users can read/open it and write inside it (isParentFolder = true),
  // but only ADMIN/Global can rename, move, or delete it directly (isParentFolder = false).
  const isGeneralRootFolder = await db.node.findFirst({
    where: {
      id: nodeId,
      name: 'General',
      parentId: null,
      type: 'FOLDER'
    }
  });
  if (isGeneralRootFolder) {
    if (isWrite && !isParentFolder) {
      return false; // Block renaming, moving, or deleting the General root folder itself
    }
    return true; // Allow reading and writing *inside* the General root folder
  }

  // 4. Check if the node resides under the "General" folder (subfolders/files).
  // Any restricted user is allowed to read and write inside the General folder.
  const isUnderGeneral = await isNodeUnderGeneral(nodeId);
  if (isUnderGeneral) {
    return true;
  }

  // 5. Find if the node is linked to the user's area
  const nodeArea = await findAreaForNode(nodeId);
  if (nodeArea && nodeArea.id === user.areaId) {
    return true;
  }

  return false;
}

/**
 * Fetch a node's name for auditing purposes.
 */
export async function getNodeName(nodeId: string | null): Promise<string> {
  if (!nodeId || nodeId === 'root') return 'Raíz';
  const node = await db.node.findUnique({
    where: { id: nodeId },
    select: { name: true }
  });
  return node ? node.name : 'Desconocido';
}

/**
 * Log structured audit logs to the Audit model.
 * Format: Usuario: <username> | Área: <areaName> | Acción: <action> | Carpeta/Archivo: <nodeName> | Resultado: <result>
 */
export async function logAuthorization(
  username: string,
  userArea: string,
  action: string,
  nodeName: string,
  result: 'Permitido' | 'Denegado'
): Promise<void> {
  try {
    const detail = `Usuario: ${username} | Área: ${userArea} | Acción: ${action} | Carpeta/Archivo: ${nodeName} | Resultado: ${result}`;
    await db.audit.create({
      data: {
        username,
        action: result === 'Permitido' ? 'AUTORIZADO' : 'DENEGADO',
        detail
      }
    });
  } catch (err) {
    console.error('Error logging authorization audit:', err);
  }
}
