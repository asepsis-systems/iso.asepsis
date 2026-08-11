const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDITS FOR POLITICA ---');
  const audits = await prisma.audit.findMany({
    where: {
      OR: [
        { detail: { contains: 'Politica SIG' } },
        { detail: { contains: 'Politica' } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });

  audits.forEach((a, idx) => {
    console.log(`${idx + 1}: Date: ${a.createdAt.toISOString()}, User: ${a.username}, Action: ${a.action}`);
    console.log(`   Detail: ${a.detail}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
