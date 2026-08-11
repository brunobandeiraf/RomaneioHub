import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Helper: random number between min and max
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: random decimal
function randDecimal(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Helper: random date in last N months
function randomDate(monthsBack: number) {
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const diff = now.getTime() - past.getTime();
  return new Date(past.getTime() + Math.random() * diff);
}

// Helper: pick random from array
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🌱 Starting comprehensive seed...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('Admin@2024!', SALT_ROUNDS);
  const sellerPassword = await bcrypt.hash('Seller@2024!', SALT_ROUNDS);

  // 1. Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@romaneiohub.com' },
    update: { passwordHash: adminPassword },
    create: {
      email: 'admin@romaneiohub.com',
      name: 'Admin RomaneioHub',
      cognitoSub: 'admin-cognito-sub-placeholder',
      globalRole: 'ADMIN',
      mfaEnabled: true,
      passwordHash: adminPassword,
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@demo.com' },
    update: { passwordHash: sellerPassword },
    create: {
      email: 'seller@demo.com',
      name: 'Bruno Bandeira',
      cognitoSub: 'seller-cognito-sub-placeholder',
      globalRole: 'SELLER',
      mfaEnabled: false,
      passwordHash: sellerPassword,
    },
  });

  console.log(`  ✓ Users: admin@romaneiohub.com, seller@demo.com`);

  // 2. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-id' },
    update: {},
    create: {
      id: 'demo-tenant-id',
      name: 'Distribuidora São Paulo LTDA',
      subscriptionStatus: 'ACTIVE',
    },
  });

  // Link users to tenant
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: adminUser.id, tenantId: tenant.id, role: 'SELLER', status: 'ACCEPTED', acceptedAt: new Date() },
  });
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: sellerUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: sellerUser.id, tenantId: tenant.id, role: 'SELLER', status: 'ACCEPTED', acceptedAt: new Date() },
  });

  console.log(`  ✓ Tenant: ${tenant.name}`);

  // 3. Suppliers (15)
  const supplierData = [
    { razaoSocial: 'Distribuidora ABC Ltda', nomeFantasia: 'ABC Distribuidora', cnpj: '11222333000181', contato: '(11) 99999-1234', cidade: 'São Paulo', uf: 'SP' },
    { razaoSocial: 'Fornecedora XYZ S.A.', nomeFantasia: 'XYZ Materiais', cnpj: '44555666000199', contato: '(21) 98888-5678', cidade: 'Rio de Janeiro', uf: 'RJ' },
    { razaoSocial: 'Tech Parts Importação Ltda', nomeFantasia: 'Tech Parts', cnpj: '77888999000155', contato: '(31) 97777-9012', cidade: 'Belo Horizonte', uf: 'MG' },
    { razaoSocial: 'Mega Suprimentos EIRELI', nomeFantasia: 'Mega Sup', cnpj: '12345678000195', contato: '(41) 96666-3456', cidade: 'Curitiba', uf: 'PR' },
    { razaoSocial: 'Norte Embalagens Ltda', nomeFantasia: 'Norte Pack', cnpj: '98765432000187', contato: '(92) 95555-7890', cidade: 'Manaus', uf: 'AM' },
    { razaoSocial: 'Sul Alimentos S.A.', nomeFantasia: 'Sul Foods', cnpj: '11111222000133', contato: '(51) 94444-2345', cidade: 'Porto Alegre', uf: 'RS' },
    { razaoSocial: 'Central Papéis e Plásticos', nomeFantasia: 'Central PP', cnpj: '33344455000166', contato: '(62) 93333-6789', cidade: 'Goiânia', uf: 'GO' },
    { razaoSocial: 'Leste Químicos Industriais', nomeFantasia: 'Leste Quim', cnpj: '55566677000122', contato: '(85) 92222-1234', cidade: 'Fortaleza', uf: 'CE' },
    { razaoSocial: 'Oeste Transportes e Logística', nomeFantasia: 'Oeste Log', cnpj: '99988877000144', contato: '(67) 91111-5678', cidade: 'Campo Grande', uf: 'MS' },
    { razaoSocial: 'Planalto Ferragens Ltda', nomeFantasia: 'Planalto', cnpj: '22233344000177', contato: '(61) 90000-9012', cidade: 'Brasília', uf: 'DF' },
    { razaoSocial: 'Litoral Pescados S.A.', nomeFantasia: 'Litoral Fish', cnpj: '66677788000111', contato: '(71) 98765-4321', cidade: 'Salvador', uf: 'BA' },
    { razaoSocial: 'Cerrado Grãos e Cereais', nomeFantasia: 'Cerrado Grãos', cnpj: '88899900000155', contato: '(64) 97654-3210', cidade: 'Rio Verde', uf: 'GO' },
    { razaoSocial: 'Amazônia Natural Cosméticos', nomeFantasia: 'Amazônia Nat', cnpj: '10203040000199', contato: '(91) 96543-2109', cidade: 'Belém', uf: 'PA' },
    { razaoSocial: 'Pampas Carnes Premium', nomeFantasia: 'Pampas Carnes', cnpj: '50607080000133', contato: '(53) 95432-1098', cidade: 'Pelotas', uf: 'RS' },
    { razaoSocial: 'Sertão Laticínios LTDA', nomeFantasia: 'Sertão Lac', cnpj: '90807060000177', contato: '(87) 94321-0987', cidade: 'Petrolina', uf: 'PE' },
  ];

  const suppliers: { id: string }[] = [];
  for (const s of supplierData) {
    const supplier = await prisma.supplier.upsert({
      where: { tenantId_cnpj: { tenantId: tenant.id, cnpj: s.cnpj } },
      update: {},
      create: {
        tenantId: tenant.id,
        razaoSocial: s.razaoSocial,
        nomeFantasia: s.nomeFantasia,
        cnpj: s.cnpj,
        contato: s.contato,
        endereco: { cidade: s.cidade, uf: s.uf, logradouro: 'Rua Principal', numero: String(rand(1, 999)) },
        active: true,
        createdById: sellerUser.id,
        updatedById: sellerUser.id,
      },
    });
    suppliers.push({ id: supplier.id });
  }
  console.log(`  ✓ ${suppliers.length} fornecedores criados`);

  // 4. Products (20)
  const productData = [
    { nome: 'Papel A4 500 folhas', categoria: 'Escritório', unidade: 'resma', preco: 28.90 },
    { nome: 'Toner HP 85A Compatível', categoria: 'Informática', unidade: 'unidade', preco: 89.90 },
    { nome: 'Café Torrado e Moído 500g', categoria: 'Copa e Cozinha', unidade: 'pacote', preco: 18.50 },
    { nome: 'Caixa Papelão 40x30x20', categoria: 'Embalagens', unidade: 'unidade', preco: 4.50 },
    { nome: 'Fita Adesiva Transparente 45mm', categoria: 'Embalagens', unidade: 'rolo', preco: 6.90 },
    { nome: 'Álcool Gel 70% 500ml', categoria: 'Limpeza', unidade: 'frasco', preco: 12.90 },
    { nome: 'Detergente Neutro 5L', categoria: 'Limpeza', unidade: 'galão', preco: 22.50 },
    { nome: 'Luvas Nitrila M (caixa 100)', categoria: 'EPI', unidade: 'caixa', preco: 45.00 },
    { nome: 'Máscara N95 PFF2', categoria: 'EPI', unidade: 'unidade', preco: 3.80 },
    { nome: 'Etiqueta Adesiva A4 (100fls)', categoria: 'Escritório', unidade: 'pacote', preco: 35.90 },
    { nome: 'Caneta Esferográfica Azul', categoria: 'Escritório', unidade: 'caixa c/50', preco: 42.00 },
    { nome: 'Água Mineral 20L', categoria: 'Copa e Cozinha', unidade: 'galão', preco: 9.50 },
    { nome: 'Açúcar Cristal 5kg', categoria: 'Copa e Cozinha', unidade: 'pacote', preco: 19.90 },
    { nome: 'Palete PBR 1200x1000', categoria: 'Logística', unidade: 'unidade', preco: 85.00 },
    { nome: 'Stretch Film 500mm (bobina)', categoria: 'Embalagens', unidade: 'bobina', preco: 32.00 },
    { nome: 'Sacola Plástica Reforçada 40x50', categoria: 'Embalagens', unidade: 'kg', preco: 18.00 },
    { nome: 'Monitor LED 24" Full HD', categoria: 'Informática', unidade: 'unidade', preco: 890.00 },
    { nome: 'Teclado USB ABNT2', categoria: 'Informática', unidade: 'unidade', preco: 55.00 },
    { nome: 'Mouse Óptico USB', categoria: 'Informática', unidade: 'unidade', preco: 25.00 },
    { nome: 'Cadeira Escritório Ergonômica', categoria: 'Mobiliário', unidade: 'unidade', preco: 650.00 },
  ];

  const products: { id: string }[] = [];
  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        nome: p.nome,
        categoria: p.categoria,
        unidade: p.unidade,
        precoReferencia: p.preco,
        active: true,
        createdById: sellerUser.id,
        updatedById: sellerUser.id,
      },
    });
    products.push({ id: product.id });
  }
  console.log(`  ✓ ${products.length} produtos criados`);

  // 5. Product-Supplier associations (random prices)
  let assocCount = 0;
  for (const product of products) {
    const numSuppliers = rand(1, 4);
    const shuffled = [...suppliers].sort(() => Math.random() - 0.5).slice(0, numSuppliers);
    for (const supplier of shuffled) {
      await prisma.productSupplier.create({
        data: {
          productId: product.id,
          supplierId: supplier.id,
          price: randDecimal(5, 1000),
        },
      });
      assocCount++;
    }
  }
  console.log(`  ✓ ${assocCount} associações produto-fornecedor`);

  // 6. Orders (30 orders distributed over last 6 months)
  const statuses = ['DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'] as const;
  const statusWeights = [0.15, 0.25, 0.5, 0.1]; // mostly delivered

  function weightedStatus() {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < statuses.length; i++) {
      cum += statusWeights[i];
      if (r <= cum) return statuses[i];
    }
    return 'DELIVERED';
  }

  let orderCount = 0;
  let itemCount = 0;

  for (let i = 0; i < 30; i++) {
    const supplier = pick(suppliers);
    const date = randomDate(6);
    const status = weightedStatus();
    const numItems = rand(1, 8);

    // Create items data
    const items = [];
    let total = 0;
    for (let j = 0; j < numItems; j++) {
      const product = pick(products);
      const quantidade = randDecimal(1, 50, 3);
      const precoUnit = randDecimal(5, 500, 2);
      const subtotal = parseFloat((quantidade * precoUnit).toFixed(2));
      total += subtotal;
      items.push({ productId: product.id, quantidade, precoUnit, subtotal });
    }

    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        supplierId: supplier.id,
        date,
        status,
        total,
        createdById: sellerUser.id,
        updatedById: sellerUser.id,
        items: {
          create: items,
        },
      },
    });
    orderCount++;
    itemCount += numItems;
  }
  console.log(`  ✓ ${orderCount} pedidos com ${itemCount} itens`);

  // 7. Some audit log entries
  for (let i = 0; i < 15; i++) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: pick([adminUser.id, sellerUser.id]),
        action: pick(['CREATE', 'UPDATE', 'DELETE']),
        entityType: pick(['Supplier', 'Product', 'Order']),
        entityId: pick([...suppliers, ...products]).id,
        changes: { field: 'example', oldValue: 'old', newValue: 'new' },
      },
    });
  }
  console.log(`  ✓ 15 registros de auditoria`);

  console.log('');
  console.log('✅ Seed completo!');
  console.log('');
  console.log('📋 Credenciais de acesso (desenvolvimento):');
  console.log('   Admin:  admin@romaneiohub.com / Admin@2024!');
  console.log('   Seller: seller@demo.com / Seller@2024!');
  console.log('');
  console.log('📊 Dados inseridos:');
  console.log(`   ${suppliers.length} fornecedores`);
  console.log(`   ${products.length} produtos`);
  console.log(`   ${assocCount} associações produto-fornecedor`);
  console.log(`   ${orderCount} pedidos (${itemCount} itens)`);
  console.log(`   15 registros de auditoria`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
