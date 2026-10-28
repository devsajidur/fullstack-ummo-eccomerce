import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Ummo-Ecommerce PostgreSQL database from catalog...");

  const response = await fetch("https://dummyjson.com/products?limit=200");
  const { products } = await response.json();

  for (const item of products) {
    const categorySlug = item.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: {
        name: item.category,
        slug: categorySlug,
      },
    });

    const productSlug = `${item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${item.id}`;

    await prisma.product.upsert({
      where: { slug: productSlug },
      update: {
        basePrice: item.price,
        stock: item.stock,
      },
      create: {
        categoryId: category.id,
        title: item.title,
        slug: productSlug,
        sku: item.sku || `UMMO-SKU-${item.id}`,
        description: item.description,
        basePrice: item.price,
        discountPercentage: item.discountPercentage || 0,
        brand: item.brand || "UOMO",
        thumbnail: item.thumbnail,
        images: item.images || [item.thumbnail],
        tags: item.tags || [item.category],
        stock: item.stock || 25,
        weight: item.weight || 1,
        dimensions: item.dimensions || { width: 10, height: 10, depth: 5 },
        warrantyInformation: item.warrantyInformation || "1 Year Official Warranty",
        shippingInformation: item.shippingInformation || "Ships in 1-2 business days",
        returnPolicy: item.returnPolicy || "30 days return policy",
      },
    });
  }

  console.log(`Successfully seeded ${products.length} products into PostgreSQL.`);
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
