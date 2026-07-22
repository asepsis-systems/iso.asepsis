const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.node.findMany({
    where: {
      name: {
        contains: 'Politica'
      }
    },
    include: {
      document: {
        include: {
          area: {
            include: {
              verifiers: {
                include: {
                  user: true
                }
              }
            }
          },
          signatures: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  const users = await prisma.user.findMany({});
  console.log('USERS:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
