import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Configuración inicial White-Label
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: 'Comercializadora Demo',
      currencySymbol: '$',
      taxRate: 0.16,
      primaryColor: '#2563EB',
    },
  });

  // Usuario Administrador por defecto
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Administrador General',
      passwordHash: '123456', // En producción usar bcrypt/argon2
      role: 'ADMIN',
    },
  });

  // Almacén Principal
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { name: 'Almacén Central' },
    update: {},
    create: {
      name: 'Almacén Central',
      location: 'Planta Baja - Zona A',
      isDefault: true,
    },
  });

  // Categoría y Producto de ejemplo
  const cat = await prisma.category.upsert({
    where: { name: 'General' },
    update: {},
    create: { name: 'General', description: 'Artículos estándar de catálogo' },
  });

  const product = await prisma.product.create({
    data: {
      name: 'Artículo Estándar de Muestra',
      unit: 'PZA',
      categoryId: cat.id,
      variants: {
        create: {
          sku: 'SKU-0001',
          barcode: '750100000001',
          costPrice: 100,
          salePrice: 150,
          minStock: 10,
        },
      },
    },
    include: { variants: true },
  });

  console.log('Base de datos SQLite inicializada:', { admin, mainWarehouse, product });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
