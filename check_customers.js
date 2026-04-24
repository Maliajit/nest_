const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({
    take: 5
  });
  console.log('Customers in database:');
  customers.forEach(c => console.log(`ID: ${c.id}, Name: ${c.name}, Email: ${c.email}`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
