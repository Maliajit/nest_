import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding a real product...');

  // 1. Get existing Category and Brand (or create them)
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

  // 2. Create the Product
  const product = await prisma.product.create({
    data: {
      name: 'Fylex Chrono X1',
      sku: 'FYLEX-CHRONO-X1',
      shortDescription: 'The pinnacle of craftsmanship and design.',
      description: 'A masterpiece of precision engineering, the Fylex Chrono X1 represents the zenith of our watchmaking heritage.',
      sellingPrice: new Prisma.Decimal(125000),
      costPrice: new Prisma.Decimal(85000),
      stockQty: 10,
      alertQty: 2,
      status: 'active',
      isFeatured: 1,
      isBestseller: 1,
      mainCategoryId: category.id,
      brandId: brand.id,
      heroImage: '/assets/fylex-watch-v2/goldwatch.png',
      bgColor: 'champagne',
      accentColor: '#c4a35a',
      variants: {
        create: [
          {
            sku: 'FY-X1-GOLD-DIAMOND',
            price: new Prisma.Decimal(155000),
            stockQty: 5,
          }
        ]
      }
    }
  });

  console.log('✅ Created Product:', product.name);
}

main()
  .catch((e) => {
    console.error('❌ Failed to seed product:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
