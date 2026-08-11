const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FINDING DOCUMENT FOR POLITICA ---');
  // Let's find all Documents in the DB and their associated Node names if available
  const docs = await prisma.document.findMany({
    include: {
      node: true,
      signatures: true
    }
  });

  console.log(`Total documents in system: ${docs.length}`);
  
  const matches = docs.filter(d => d.node && d.node.name.includes('Politica'));
  console.log(`Documents matching 'Politica': ${matches.length}`);
  console.log(JSON.stringify(matches, null, 2));

  // Let's also find all Signatures in the database where userId is not null and documentId exists
  const sigs = await prisma.signature.findMany({
    where: { status: 'APROBADO' },
    include: {
      user: true,
      document: {
        include: {
          node: true
        }
      }
    }
  });
  console.log(`Approved signatures in DB: ${sigs.length}`);
  const matchSigs = sigs.filter(s => s.document && s.document.node && s.document.node.name.includes('Politica'));
  console.log(`Approved signatures matching 'Politica': ${matchSigs.length}`);
  console.log(JSON.stringify(matchSigs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
