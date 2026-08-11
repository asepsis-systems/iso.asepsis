const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FETCHING NODES ---');
  const nodes = await prisma.node.findMany({
    where: { name: { contains: 'Pol' } },
    take: 5
  });
  console.log('Nodes found:', JSON.stringify(nodes, null, 2));

  for (const node of nodes) {
    console.log(`\nChecking Document for node ID: ${node.id}`);
    const doc = await prisma.document.findFirst({
      where: { nodeId: node.id },
      include: {
        signatures: true
      }
    });
    console.log('Document found:', JSON.stringify(doc, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
