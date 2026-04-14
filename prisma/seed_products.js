const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding multiple luxury products with unique themes...');

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

  const products = [
    {
      name: 'Fylex Chrono X1',
      slug: 'fylex-chrono-x1',
      sku: 'FYLEX-CHRONO-X1',
      shortDescription: 'The pinnacle of craftsmanship and design.',
      description: 'A masterpiece of precision engineering, the Fylex Chrono X1 represents the zenith of our watchmaking heritage.',
      sellingPrice: 125000,
      price: 120000,
      qty: 10,
      status: 'active',
      isFeatured: true,
      isBestseller: true,
      heroImage: '/assets/fylex-watch-v2/goldwatch.png',
      theme: 'champagne',
      bgColor: '#fffaf5',
      accentColor: '#c4a35a',
      textColor: '#1a1a1a',
      heritageText: 'Centuries of tradition meet the cutting edge of modern style.',
      subtitle: 'Legendary Precision',
      tagline: 'Time defined by you.',
    },
    {
      name: 'Fylex Mist Blue',
      slug: 'fylex-mist-blue',
      sku: 'FYLEX-MIST-BLUE',
      shortDescription: 'Serenity and strength in white gold.',
      description: 'Inspired by the early morning fog of the Swiss Alps, the Mist Blue edition offers a calm yet commanding presence.',
      sellingPrice: 135000,
      price: 130000,
      qty: 8,
      status: 'active',
      isFeatured: true,
      isBestseller: false,
      heroImage: '/assets/fylex-watch-v2/white-gold.png',
      theme: 'mist-blue',
      bgColor: '#f0f4f8',
      accentColor: '#3b82f6',
      textColor: '#1e293b',
      heritageText: 'Crafted from the purest alloys for a lifetime of brilliance.',
      subtitle: 'Alpine Elegance',
      tagline: 'Clarity in every second.',
    },
    {
      name: 'Fylex Midnight Rose',
      slug: 'fylex-midnight-rose',
      sku: 'FYLEX-MIDNIGHT-ROSE',
      shortDescription: 'The warmth of Everose gold met by deep shadows.',
      description: 'A striking contrast of 18ct Everose gold and deep burgundy accents, designed for the nocturnal adventurer.',
      sellingPrice: 145000,
      price: 140000,
      qty: 5,
      status: 'active',
      isFeatured: true,
      isBestseller: true,
      heroImage: '/assets/fylex-watch-v2/everose-gold.png',
      theme: 'rose-burgundy',
      bgColor: '#fdf2f2',
      accentColor: '#ef4444',
      textColor: '#450a0a',
      heritageText: 'A proprietary alloy that preserves its pink beauty through the ages.',
      subtitle: 'Nocturnal Radiance',
      tagline: 'Boldness in transition.',
    },
    {
      name: 'Fylex Forest Reserve',
      slug: 'fylex-forest-reserve',
      sku: 'FYLEX-FOREST-RESERVE',
      shortDescription: 'Nature-inspired luxury for the refined explorer.',
      description: 'Featuring a deep olive sunray-finished dial, the Forest Reserve is a tribute to world-renowned landscapes.',
      sellingPrice: 115000,
      price: 110000,
      qty: 12,
      status: 'active',
      isFeatured: false,
      isBestseller: false,
      heroImage: '/assets/fylex-watch-v2/premium.png',
      theme: 'soft-green',
      bgColor: '#f0fdf4',
      accentColor: '#10b981',
      textColor: '#064e3b',
      heritageText: 'A symbol of growth and the eternal spirit of our collection.',
      subtitle: 'Verdant Heritage',
      tagline: 'Naturally exceptional.',
    }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...p,
        mainCategoryId: category.id,
        brandId: brand.id,
      }
    });
  }

  console.log('✅ Created/Ensured 4 Luxury Products.');
}

main()
  .catch((e) => {
    console.error('❌ Failed to seed products:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
