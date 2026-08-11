const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DB SUMMARY ---');
  const nodeCount = await prisma.node.count();
  const docCount = await prisma.document.count();
  const sigCount = await prisma.signature.count();
  console.log(`Nodes: ${nodeCount}, Documents: ${docCount}, Signatures: ${sigCount}`);

  console.log('\n--- FIRST 5 DOCUMENTS ---');
  const docs = await prisma.document.findMany({
    take: 5,
    include: {
      signatures: true
    }
  });
  console.log(JSON.stringify(docs, null, 2));

  console.log('\n--- FIRST 5 SIGNATURES ---');
  const sigs = await prisma.signature.findMany({
    take: 5
  });
  console.log(JSON.stringify(sigs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
