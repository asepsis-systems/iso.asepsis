const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const audits = await db.audit.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' }
  });
  console.log("LATEST AUDITS:");
  console.log(audits.map(a => ({
    id: a.id,
    username: a.username,
    action: a.action,
    detail: a.detail,
    createdAt: a.createdAt
  })));
}

main().catch(console.error).finally(() => db.$disconnect());
