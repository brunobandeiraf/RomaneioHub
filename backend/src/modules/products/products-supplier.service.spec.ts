import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProductsService - Supplier Association', () => {
  let service: ProductsService;
  let prisma: any;

  const mockProduct = {
    id: 'product-1',
    tenantId: 'tenant-1',
    nome: 'Product 1',
    categoria: 'Category A',
    unidade: 'kg',
    precoReferencia: new Prisma.Decimal(10.5),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1',
    updatedById: 'user-1',
  };

  const mockSupplier = {
    id: 'supplier-1',
    tenantId: 'tenant-1',
    razaoSocial: 'Supplier Ltda',
    cnpj: '12.345.678/0001-90',
    active: true,
  };

  const mockAssociation = {
    id: 'assoc-1',
    productId: 'product-1',
    supplierId: 'supplier-1',
    price: new Prisma.Decimal(25.5),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      extended: {
        product: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        supplier: {
          findFirst: jest.fn(),
        },
      },
      productSupplier: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      orderItem: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get(PrismaService);
  });

  describe('addSupplier', () => {
    const dto = { supplierId: 'supplier-1', price: 25.5 };

    it('should associate a supplier with a product successfully', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.extended.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.productSupplier.findUnique.mockResolvedValue(null);
      prisma.productSupplier.create.mockResolvedValue(mockAssociation);

      const result = await service.addSupplier('product-1', dto);

      expect(result).toEqual(mockAssociation);
      expect(prisma.productSupplier.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          supplierId: 'supplier-1',
          price: expect.any(Prisma.Decimal),
        },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(null);

      await expect(service.addSupplier('nonexistent', dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.addSupplier('nonexistent', dto)).rejects.toThrow(
        'Product not found',
      );
    });

    it('should throw NotFoundException when supplier does not exist in tenant', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.extended.supplier.findFirst.mockResolvedValue(null);

      await expect(service.addSupplier('product-1', dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.addSupplier('product-1', dto)).rejects.toThrow(
        'Supplier not found',
      );
    });

    it('should throw ConflictException when association already exists', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.extended.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.productSupplier.findUnique.mockResolvedValue(mockAssociation);

      await expect(service.addSupplier('product-1', dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.addSupplier('product-1', dto)).rejects.toThrow(
        'Product-supplier association already exists',
      );
    });

    it('should store price as Decimal(12,2)', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.extended.supplier.findFirst.mockResolvedValue(mockSupplier);
      prisma.productSupplier.findUnique.mockResolvedValue(null);
      prisma.productSupplier.create.mockResolvedValue(mockAssociation);

      await service.addSupplier('product-1', { supplierId: 'supplier-1', price: 9999999999.99 });

      expect(prisma.productSupplier.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          supplierId: 'supplier-1',
          price: new Prisma.Decimal(9999999999.99),
        },
      });
    });
  });

  describe('updateSupplierPrice', () => {
    const dto = { price: 30.0 };

    it('should update the supplier price successfully', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.productSupplier.findUnique.mockResolvedValue(mockAssociation);
      const updatedAssociation = { ...mockAssociation, price: new Prisma.Decimal(30.0) };
      prisma.productSupplier.update.mockResolvedValue(updatedAssociation);

      const result = await service.updateSupplierPrice('product-1', 'supplier-1', dto);

      expect(result).toEqual(updatedAssociation);
      expect(prisma.productSupplier.update).toHaveBeenCalledWith({
        where: {
          productId_supplierId: {
            productId: 'product-1',
            supplierId: 'supplier-1',
          },
        },
        data: {
          price: new Prisma.Decimal(30.0),
        },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSupplierPrice('nonexistent', 'supplier-1', dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateSupplierPrice('nonexistent', 'supplier-1', dto),
      ).rejects.toThrow('Product not found');
    });

    it('should throw NotFoundException when association does not exist', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.productSupplier.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSupplierPrice('product-1', 'supplier-1', dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateSupplierPrice('product-1', 'supplier-1', dto),
      ).rejects.toThrow('Product-supplier association not found');
    });
  });

  describe('removeSupplier', () => {
    it('should remove the product-supplier association successfully', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.productSupplier.findUnique.mockResolvedValue(mockAssociation);
      prisma.productSupplier.delete.mockResolvedValue(mockAssociation);

      const result = await service.removeSupplier('product-1', 'supplier-1');

      expect(result).toEqual(mockAssociation);
      expect(prisma.productSupplier.delete).toHaveBeenCalledWith({
        where: {
          productId_supplierId: {
            productId: 'product-1',
            supplierId: 'supplier-1',
          },
        },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.removeSupplier('nonexistent', 'supplier-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeSupplier('nonexistent', 'supplier-1'),
      ).rejects.toThrow('Product not found');
    });

    it('should throw NotFoundException when association does not exist', async () => {
      prisma.extended.product.findFirst.mockResolvedValue(mockProduct);
      prisma.productSupplier.findUnique.mockResolvedValue(null);

      await expect(
        service.removeSupplier('product-1', 'supplier-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeSupplier('product-1', 'supplier-1'),
      ).rejects.toThrow('Product-supplier association not found');
    });
  });
});
