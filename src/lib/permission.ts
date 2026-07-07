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
 * Check if the user is authorized to read/write a specific folder or file node.
 */
export async function canUserAccessNode(
  user: any,
  nodeId: string | null,
  isWrite: boolean = false
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

  // 3. Find if the node is linked to the user's area
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
