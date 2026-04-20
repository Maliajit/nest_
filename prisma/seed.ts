import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Default Admin
  const adminPassword = 'password123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin1 = await prisma.admin.upsert({
    where: { email: 'admin@fylex.com' },
    update: {
      password: hashedPassword,
      name: 'Fylex Admin',
      status: 1,
    },
    create: {
      name: 'Fylex Admin',
      email: 'admin@fylex.com',
      password: hashedPassword,
      role: 'admin',
      status: 1,
    },
  });

  // 1.2 Create Secondary Admin
  const admin2Password = 'admin@123';
  const admin2HashedPassword = await bcrypt.hash(admin2Password, 10);
  const admin2 = await prisma.admin.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: admin2HashedPassword,
      name: 'Primary Admin',
      status: 1,
    },
    create: {
      name: 'Primary Admin',
      email: 'admin@gmail.com',
      password: admin2HashedPassword,
      role: 'admin',
      status: 1,
    },
  });

  console.log(`✅ Admin created with email: ${admin1.email} and password: ${adminPassword}`);
  console.log(`✅ Admin created with email: ${admin2.email} and password: ${admin2Password}`);

  // 2. Create sample Category
  const category = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      status: 1,
      featured: 1,
    },
  });

  console.log('✅ Sample Category "Electronics" created.');

  // 3. Create sample Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'fylex-brand' },
    update: {},
    create: {
      name: 'Fylex Official',
      slug: 'fylex-brand',
      isActive: true,
      isFeatured: 1,
    },
  });

  console.log('✅ Sample Brand "Fylex Official" created.');

  console.log('✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
