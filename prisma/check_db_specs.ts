import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const cat = await prisma.category.findUnique({
    where: { slug: 'watches' },
    include: {
      specGroups: {
        include: {
          specGroup: {
            include: {
              specifications: {
                include: {
                  specification: true
                }
              }
            }
          }
        }
      },
      attributes: {
        include: {
          attribute: {
            include: {
              values: true
            }
          }
        }
      }
    }
  });

  console.log('Category Found:', JSON.stringify(cat, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
