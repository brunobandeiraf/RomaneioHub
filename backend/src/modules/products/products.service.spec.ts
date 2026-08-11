import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: any;

  const mockProduct = {
    id: 'product-1',
    tenantId: 'tenant-1',
    nome: 'Produto Teste',
    categoria: 'Categoria A',
    unidade: 'kg',
    precoReferencia: new Prisma.Decimal(25.5),
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'user-1',
    updatedById: 'user-1',
  };

  beforeEach(async () => {
    const mockExtended = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
    };

    const mockPrismaService = {
      extended: mockExtended,
      orderItem: { count: jest.fn() },
      productSupplier: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get(PrismaService);
  });

  describe('list', () => {
    it('should return paginated products', async () => {
      prismaService.extended.product.findMany.mockResolvedValue([mockProduct]);
      prismaService.extended.product.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply category filter', async () => {
      prismaService.extended.product.findMany.mockResolvedValue([]);
      prismaService.extended.product.count.mockResolvedValue(0);

      await service.list({ categoria: 'Categoria A' });

      expect(prismaService.extended.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoria: 'Categoria A' }),
        }),
      );
    });

    it('should apply active filter', async () => {
      prismaService.extended.product.findMany.mockResolvedValue([]);
      prismaService.extended.product.count.mockResolvedValue(0);

      await service.list({ active: true });

      expect(prismaService.extended.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: true }),
        }),
      );
    });

    it('should apply search filter across nome and categoria', async () => {
      prismaService.extended.product.findMany.mockResolvedValue([]);
      prismaService.extended.product.count.mockResolvedValue(0);

      await service.list({ search: 'teste' });

      expect(prismaService.extended.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nome: { contains: 'teste', mode: 'insensitive' } },
              { categoria: { contains: 'teste', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should use default pagination when no params provided', async () => {
      prismaService.extended.product.findMany.mockResolvedValue([]);
      prismaService.extended.product.count.mockResolvedValue(0);

      const result = await service.list({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(prismaService.extended.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return product with supplier associations', async () => {
      const productWithSuppliers = {
        ...mockProduct,
        suppliers: [
          { id: 'ps-1', supplierId: 'sup-1', price: new Prisma.Decimal(30), supplier: { razaoSocial: 'Fornecedor A' } },
        ],
      };
      prismaService.extended.product.findFirst.mockResolvedValue(productWithSuppliers);

      const result = await service.findOne('product-1');

      expect(result).toEqual(productWithSuppliers);
      expect(prismaService.extended.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        include: { suppliers: { include: { supplier: true } } },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create product with audit fields', async () => {
      const dto = {
        nome: 'Novo Produto',
        categoria: 'Categoria B',
        unidade: 'unidade',
        precoReferencia: 15.99,
      };
      const userId = 'user-1';

      prismaService.extended.product.create.mockResolvedValue({
        ...mockProduct,
        nome: dto.nome,
        categoria: dto.categoria,
        unidade: dto.unidade,
        precoReferencia: new Prisma.Decimal(dto.precoReferencia),
        createdById: userId,
        updatedById: userId,
      });

      const result = await service.create(dto, userId);

      expect(prismaService.extended.product.create).toHaveBeenCalledWith({
        data: {
          nome: dto.nome,
          categoria: dto.categoria,
          unidade: dto.unidade,
          precoReferencia: expect.any(Prisma.Decimal),
          createdById: userId,
          updatedById: userId,
        },
      });
      expect(result.createdById).toBe(userId);
      expect(result.updatedById).toBe(userId);
    });

    it('should set createdById and updatedById to the authenticated user', async () => {
      const dto = {
        nome: 'Produto X',
        categoria: 'Cat',
        unidade: 'un',
        precoReferencia: 100.0,
      };
      const userId = 'specific-user-id';

      prismaService.extended.product.create.mockResolvedValue({
        ...mockProduct,
        createdById: userId,
        updatedById: userId,
      });

      const result = await service.create(dto, userId);

      expect(result.createdById).toBe(userId);
      expect(result.updatedById).toBe(userId);
    });
  });

  describe('update', () => {
    it('should update product and set updatedById', async () => {
      const dto = { nome: 'Produto Atualizado' };
      const userId = 'user-2';

      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.extended.product.update.mockResolvedValue({
        ...mockProduct,
        nome: dto.nome,
        updatedById: userId,
        updatedAt: new Date('2024-02-01'),
      });

      const result = await service.update('product-1', dto, userId);

      expect(prismaService.extended.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: {
          nome: dto.nome,
          updatedById: userId,
        },
      });
      expect(result.updatedById).toBe(userId);
    });

    it('should throw NotFoundException when updating non-existent product', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { nome: 'test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should preserve createdById on update', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.extended.product.update.mockResolvedValue({
        ...mockProduct,
        updatedById: 'user-2',
      });

      const result = await service.update('product-1', { nome: 'Updated' }, 'user-2');

      // createdById should remain unchanged
      expect(result.createdById).toBe('user-1');
    });
  });

  describe('remove', () => {
    it('should soft-delete product when order items exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.orderItem.count.mockResolvedValue(3);
      prismaService.extended.product.update.mockResolvedValue({
        ...mockProduct,
        active: false,
      });

      const result = await service.remove('product-1');

      expect(prismaService.orderItem.count).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
      });
      expect(prismaService.extended.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });

    it('should hard-delete product when no order items exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.orderItem.count.mockResolvedValue(0);
      prismaService.productSupplier.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.extended.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('product-1');

      expect(prismaService.productSupplier.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
      });
      expect(prismaService.extended.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should delete ProductSupplier associations on hard-delete', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.orderItem.count.mockResolvedValue(0);
      prismaService.productSupplier.deleteMany.mockResolvedValue({ count: 2 });
      prismaService.extended.product.delete.mockResolvedValue(mockProduct);

      await service.remove('product-1');

      expect(prismaService.productSupplier.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
      });
    });

    it('should throw NotFoundException when deleting non-existent product', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should preserve supplier associations after soft-delete', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.orderItem.count.mockResolvedValue(2);
      prismaService.extended.product.update.mockResolvedValue({
        ...mockProduct,
        active: false,
      });

      await service.remove('product-1');

      // productSupplier.deleteMany should NOT be called during soft-delete
      expect(prismaService.productSupplier.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('create - field validation boundaries', () => {
    it('should create product with minimum precoReferencia (0.01)', async () => {
      const dto = {
        nome: 'Produto Mínimo',
        categoria: 'Cat',
        unidade: 'un',
        precoReferencia: 0.01,
      };
      const userId = 'user-1';

      prismaService.extended.product.create.mockResolvedValue({
        ...mockProduct,
        precoReferencia: new Prisma.Decimal(0.01),
      });

      const result = await service.create(dto, userId);

      expect(prismaService.extended.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          precoReferencia: new Prisma.Decimal(0.01),
        }),
      });
      expect(result.precoReferencia.toString()).toBe('0.01');
    });

    it('should create product with maximum precoReferencia (9999999999.99)', async () => {
      const dto = {
        nome: 'Produto Máximo',
        categoria: 'Cat',
        unidade: 'un',
        precoReferencia: 9999999999.99,
      };
      const userId = 'user-1';

      prismaService.extended.product.create.mockResolvedValue({
        ...mockProduct,
        precoReferencia: new Prisma.Decimal(9999999999.99),
      });

      const result = await service.create(dto, userId);

      expect(prismaService.extended.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          precoReferencia: new Prisma.Decimal(9999999999.99),
        }),
      });
      expect(result.precoReferencia.toString()).toBe('9999999999.99');
    });

    it('should create product with nome at max 200 chars', async () => {
      const longName = 'A'.repeat(200);
      const dto = {
        nome: longName,
        categoria: 'Cat',
        unidade: 'un',
        precoReferencia: 10.0,
      };
      const userId = 'user-1';

      prismaService.extended.product.create.mockResolvedValue({
        ...mockProduct,
        nome: longName,
      });

      const result = await service.create(dto, userId);

      expect(prismaService.extended.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: longName,
        }),
      });
      expect(result.nome).toBe(longName);
    });
  });

  describe('addSupplier', () => {
    it('should create ProductSupplier with correct price', async () => {
      const dto = { supplierId: 'supplier-1', price: 45.99 };
      const mockAssociation = {
        id: 'ps-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        price: new Prisma.Decimal(45.99),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.extended.supplier.findFirst.mockResolvedValue({
        id: 'supplier-1',
        tenantId: 'tenant-1',
        razaoSocial: 'Fornecedor A',
        active: true,
      });
      prismaService.productSupplier.findUnique.mockResolvedValue(null);
      prismaService.productSupplier.create.mockResolvedValue(mockAssociation);

      const result = await service.addSupplier('product-1', dto);

      expect(prismaService.productSupplier.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          supplierId: 'supplier-1',
          price: new Prisma.Decimal(45.99),
        },
      });
      expect(result).toEqual(mockAssociation);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.addSupplier('non-existent', { supplierId: 'supplier-1', price: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.extended.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.addSupplier('product-1', { supplierId: 'non-existent', price: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when association already exists', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.extended.supplier.findFirst.mockResolvedValue({
        id: 'supplier-1',
        tenantId: 'tenant-1',
        razaoSocial: 'Fornecedor A',
        active: true,
      });
      prismaService.productSupplier.findUnique.mockResolvedValue({
        id: 'ps-existing',
        productId: 'product-1',
        supplierId: 'supplier-1',
        price: new Prisma.Decimal(30),
      });

      await expect(
        service.addSupplier('product-1', { supplierId: 'supplier-1', price: 50 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateSupplierPrice', () => {
    it('should update the price correctly', async () => {
      const updatedAssociation = {
        id: 'ps-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        price: new Prisma.Decimal(99.99),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.productSupplier.findUnique.mockResolvedValue({
        id: 'ps-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        price: new Prisma.Decimal(45.99),
      });
      prismaService.productSupplier.update.mockResolvedValue(updatedAssociation);

      const result = await service.updateSupplierPrice('product-1', 'supplier-1', { price: 99.99 });

      expect(prismaService.productSupplier.update).toHaveBeenCalledWith({
        where: {
          productId_supplierId: {
            productId: 'product-1',
            supplierId: 'supplier-1',
          },
        },
        data: {
          price: new Prisma.Decimal(99.99),
        },
      });
      expect(result.price.toString()).toBe('99.99');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSupplierPrice('non-existent', 'supplier-1', { price: 50 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when association does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.productSupplier.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSupplierPrice('product-1', 'supplier-1', { price: 50 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSupplier', () => {
    it('should delete the ProductSupplier record', async () => {
      const association = {
        id: 'ps-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        price: new Prisma.Decimal(45.99),
      };

      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.productSupplier.findUnique.mockResolvedValue(association);
      prismaService.productSupplier.delete.mockResolvedValue(association);

      const result = await service.removeSupplier('product-1', 'supplier-1');

      expect(prismaService.productSupplier.delete).toHaveBeenCalledWith({
        where: {
          productId_supplierId: {
            productId: 'product-1',
            supplierId: 'supplier-1',
          },
        },
      });
      expect(result).toEqual(association);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.removeSupplier('non-existent', 'supplier-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when association does not exist', async () => {
      prismaService.extended.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.productSupplier.findUnique.mockResolvedValue(null);

      await expect(
        service.removeSupplier('product-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
