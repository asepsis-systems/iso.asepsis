const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const nodes = await prisma.node.findMany({
    where: { parentId: null, isTrashed: false }
  });
  console.log("=== ROOT NODES ===");
  console.log(JSON.stringify(nodes, null, 2));

  const areas = await prisma.area.findMany();
  console.log("=== AREAS ===");
  console.log(JSON.stringify(areas, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
