const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Hash password helper using PBKDF2 matching the auth-node.ts implementation
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const DEFAULT_PASSWORD = 'Asepsis2026!';

const verifiersData = [
  { username: 'gerente_general', name: 'Gerente General' },
  { username: 'livio_dulanto', name: 'Ing. Livio Dulanto' },
  { username: 'gerente_operaciones', name: 'Gerente de Operaciones' },
  { username: 'sr_bozzo', name: 'Sr. Bozzo' },
  { username: 'eddy_montes', name: 'Eddy Montes' },
  { username: 'edward', name: 'Edward' }
];

const areasData = [
  {
    name: 'Operaciones',
    color: 'blue',
    verifiers: ['gerente_general', 'livio_dulanto', 'gerente_operaciones']
  },
  {
    name: 'Administración',
    color: 'purple',
    verifiers: ['gerente_general', 'livio_dulanto', 'sr_bozzo']
  },
  {
    name: 'Mantenimiento',
    color: 'emerald',
    verifiers: ['gerente_general', 'livio_dulanto', 'eddy_montes']
  },
  {
    name: 'Logística',
    color: 'amber',
    verifiers: ['gerente_general', 'livio_dulanto', 'edward']
  }
];

async function main() {
  console.log('--- Iniciando Semilla de Áreas y Verificadores ---');

  // 1. Crear usuarios verificadores si no existen
  const userMap = new Map(); // username -> ID
  for (const u of verifiersData) {
    let dbUser = await prisma.user.findUnique({
      where: { username: u.username }
    });

    if (!dbUser) {
      console.log(`Creando usuario verificador: ${u.name} (${u.username})`);
      dbUser = await prisma.user.create({
        data: {
          username: u.username,
          password: hashPassword(DEFAULT_PASSWORD),
          name: u.name,
          role: 'VERIFIER'
        }
      });
    } else {
      console.log(`Usuario verificador ya existe: ${u.name} (${u.username})`);
    }
    userMap.set(u.username, dbUser.id);
  }

  // 2. Crear carpetas principales (Node) y Áreas
  for (const a of areasData) {
    // Buscar o crear nodo carpeta en la raíz (parentId = null)
    let folderNode = await prisma.node.findFirst({
      where: {
        name: a.name,
        type: 'FOLDER',
        parentId: null,
        isTrashed: false
      }
    });

    if (!folderNode) {
      console.log(`Creando carpeta raíz (Node) para área: ${a.name}`);
      folderNode = await prisma.node.create({
        data: {
          name: a.name,
          type: 'FOLDER',
          parentId: null,
          creator: 'Sistema'
        }
      });
    } else {
      console.log(`Carpeta raíz (Node) para área ${a.name} ya existe (ID: ${folderNode.id})`);
    }

    // Buscar o crear Área
    let area = await prisma.area.findUnique({
      where: { name: a.name }
    });

    if (!area) {
      console.log(`Creando registro de Área: ${a.name}`);
      area = await prisma.area.create({
        data: {
          name: a.name,
          color: a.color,
          folderNodeId: folderNode.id
        }
      });
    } else {
      console.log(`Registro de Área ${a.name} ya existe (ID: ${area.id}). Actualizando folderNodeId...`);
      area = await prisma.area.update({
        where: { id: area.id },
        data: { folderNodeId: folderNode.id }
      });
    }

    // Configurar verificadores para esta área
    console.log(`Configurando verificadores para el área: ${a.name}`);
    for (let index = 0; index < a.verifiers.length; index++) {
      const username = a.verifiers[index];
      const userId = userMap.get(username);
      const signOrder = index + 1; // 1, 2, 3

      if (!userId) {
        console.error(`Error: No se encontró el ID para el usuario ${username}`);
        continue;
      }

      await prisma.verifier.upsert({
        where: {
          areaId_userId: {
            areaId: area.id,
            userId: userId
          }
        },
        update: {
          signOrder: signOrder
        },
        create: {
          areaId: area.id,
          userId: userId,
          signOrder: signOrder
        }
      });
      console.log(`  - Verificador ${username} asignado en orden ${signOrder}`);
    }
  }

  console.log('--- Semilla completada con éxito ---');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución de la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
