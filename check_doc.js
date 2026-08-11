const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL DOCUMENTS WITH NODES ---');
  const docs = await prisma.document.findMany({
    include: {
      node: true
    }
  });

  docs.forEach((d, idx) => {
    console.log(`${idx + 1}: DocID: ${d.id}, NodeID: ${d.nodeId}, Status: ${d.status}, NodeName: ${d.node ? d.node.name : 'NULL'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
