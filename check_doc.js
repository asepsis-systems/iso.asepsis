const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDIT ACTIONS IN SYSTEM ---');
  const actions = await prisma.audit.findMany({
    select: {
      action: true
    },
    distinct: ['action']
  });
  console.log(JSON.stringify(actions, null, 2));

  console.log('\n--- FIRST 20 AUDITS ---');
  const audits = await prisma.audit.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  audits.forEach(a => {
    console.log(`User: ${a.username}, Action: ${a.action}, Detail: ${a.detail.substring(0, 100)}...`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
