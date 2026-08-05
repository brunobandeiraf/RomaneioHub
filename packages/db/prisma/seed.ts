import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Admin user (MFA enabled)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@comprashub.com' },
    update: {},
    create: {
      email: 'admin@comprashub.com',
      name: 'Admin ComprasHub',
      cognitoSub: 'admin-cognito-sub-placeholder',
      globalRole: 'ADMIN',
      mfaEnabled: true,
    },
  });
  console.log(`  ✓ Admin user: ${adminUser.email}`);

  // 2. Create sample Tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-id' },
    update: {},
    create: {
      id: 'demo-tenant-id',
      name: 'Empresa Demo',
      subscriptionStatus: 'ACTIVE',
    },
  });
  console.log(`  ✓ Tenant: ${demoTenant.name}`);

  // 3. Link Admin to Demo Tenant
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: demoTenant.id,
      role: 'SELLER',
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });
  console.log(`  ✓ Admin linked to ${demoTenant.name}`);

  // 4. Create sample Seller user
  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@demo.com' },
    update: {},
    create: {
      email: 'seller@demo.com',
      name: 'Vendedor Demo',
      cognitoSub: 'seller-cognito-sub-placeholder',
      globalRole: 'SELLER',
      mfaEnabled: false,
    },
  });
  console.log(`  ✓ Seller user: ${sellerUser.email}`);

  // 5. Link Seller to Demo Tenant
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: sellerUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: sellerUser.id,
      tenantId: demoTenant.id,
      role: 'SELLER',
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });
  console.log(`  ✓ Seller linked to ${demoTenant.name}`);

  // 6. Create sample Suppliers with valid CNPJs
  const supplier1 = await prisma.supplier.upsert({
    where: {
      tenantId_cnpj: {
        tenantId: demoTenant.id,
        cnpj: '11222333000181',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      razaoSocial: 'Distribuidora ABC Ltda',
      nomeFantasia: 'ABC Distribuidora',
      cnpj: '11222333000181',
      contato: '(11) 99999-1234',
      endereco: {
        logradouro: 'Rua das Flores',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01001-000',
      },
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Supplier: ${supplier1.razaoSocial}`);

  const supplier2 = await prisma.supplier.upsert({
    where: {
      tenantId_cnpj: {
        tenantId: demoTenant.id,
        cnpj: '44555666000199',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      razaoSocial: 'Fornecedora XYZ S.A.',
      nomeFantasia: 'XYZ Materiais',
      cnpj: '44555666000199',
      contato: '(21) 98888-5678',
      endereco: {
        logradouro: 'Av. Brasil',
        numero: '456',
        bairro: 'Industrial',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
        cep: '20040-020',
      },
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Supplier: ${supplier2.razaoSocial}`);

  const supplier3 = await prisma.supplier.upsert({
    where: {
      tenantId_cnpj: {
        tenantId: demoTenant.id,
        cnpj: '77888999000155',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      razaoSocial: 'Tech Parts Importação Ltda',
      nomeFantasia: 'Tech Parts',
      cnpj: '77888999000155',
      contato: '(31) 97777-9012',
      endereco: {
        logradouro: 'Rua da Tecnologia',
        numero: '789',
        bairro: 'Savassi',
        cidade: 'Belo Horizonte',
        uf: 'MG',
        cep: '30130-000',
      },
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Supplier: ${supplier3.razaoSocial}`);

  // 7. Create sample Products with categories
  const product1 = await prisma.product.upsert({
    where: { id: 'product-papel-a4' },
    update: {},
    create: {
      id: 'product-papel-a4',
      tenantId: demoTenant.id,
      nome: 'Papel A4 500 folhas',
      categoria: 'Material de Escritório',
      unidade: 'resma',
      precoReferencia: 28.9,
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Product: ${product1.nome}`);

  const product2 = await prisma.product.upsert({
    where: { id: 'product-toner-hp' },
    update: {},
    create: {
      id: 'product-toner-hp',
      tenantId: demoTenant.id,
      nome: 'Toner HP 85A Compatível',
      categoria: 'Informática',
      unidade: 'unidade',
      precoReferencia: 89.9,
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Product: ${product2.nome}`);

  const product3 = await prisma.product.upsert({
    where: { id: 'product-cafe-500g' },
    update: {},
    create: {
      id: 'product-cafe-500g',
      tenantId: demoTenant.id,
      nome: 'Café Torrado e Moído 500g',
      categoria: 'Copa e Cozinha',
      unidade: 'pacote',
      precoReferencia: 18.5,
      active: true,
      createdById: sellerUser.id,
      updatedById: sellerUser.id,
    },
  });
  console.log(`  ✓ Product: ${product3.nome}`);

  console.log('✅ Seed completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
