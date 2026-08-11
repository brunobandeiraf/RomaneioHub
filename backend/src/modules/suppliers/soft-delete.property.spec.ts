import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { SuppliersService } from './suppliers.service';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Property 4: Soft Delete Integrity
 *
 * For any supplier or product with at least one linked order, a delete operation
 * results in inactivation (active=false) and never physical removal from the database.
 *
 * **Validates: Requirements 4.3, 5.3**
 */
describe('Property 4: Soft Delete Integrity', () => {
  let suppliersService: SuppliersService;
  let productsService: ProductsService;

  // Mock prisma objects
  const mockPrismaExtended = {
    supplier: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockPrismaService = {
    extended: mockPrismaExtended,
    order: {
      count: jest.fn(),
    },
    orderItem: {
      count: jest.fn(),
    },
    productSupplier: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    suppliersService = module.get<SuppliersService>(SuppliersService);
    productsService = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  // Arbitrary for generating supplier data
  const supplierArb = fc.record({
    id: fc.uuid(),
    tenantId: fc.uuid(),
    razaoSocial: fc.string({ minLength: 1, maxLength: 255 }),
    nomeFantasia: fc.option(fc.string({ maxLength: 255 })),
    cnpj: fc.string({ minLength: 14, maxLength: 14 }),
    contato: fc.option(fc.string({ maxLength: 255 })),
    endereco: fc.constant(null),
    active: fc.constant(true),
    createdAt: fc.constant(new Date()),
    updatedAt: fc.constant(new Date()),
    createdById: fc.uuid(),
    updatedById: fc.uuid(),
  });

  // Arbitrary for generating product data
  const productArb = fc.record({
    id: fc.uuid(),
    tenantId: fc.uuid(),
    nome: fc.string({ minLength: 1, maxLength: 200 }),
    categoria: fc.string({ minLength: 1, maxLength: 100 }),
    unidade: fc.string({ minLength: 1, maxLength: 50 }),
    precoReferencia: fc.constant({ toNumber: () => 10.0 }),
    active: fc.constant(true),
    createdAt: fc.constant(new Date()),
    updatedAt: fc.constant(new Date()),
    createdById: fc.uuid(),
    updatedById: fc.uuid(),
  });

  // Arbitrary for linked order count (at least 1 order)
  const linkedOrderCountArb = fc.integer({ min: 1, max: 1000 });

  // Arbitrary for no linked orders
  const noLinkedOrderCountArb = fc.constant(0);

  it('supplier with linked orders: delete results in soft-delete (active=false), record still exists', async () => {
    await fc.assert(
      fc.asyncProperty(supplierArb, linkedOrderCountArb, async (supplier, orderCount) => {
        jest.clearAllMocks();

        // Setup: supplier exists and has linked orders
        mockPrismaExtended.supplier.findFirst.mockResolvedValue(supplier);
        mockPrismaService.order.count.mockResolvedValue(orderCount);
        mockPrismaExtended.supplier.update.mockResolvedValue({
          ...supplier,
          active: false,
        });

        const result = await suppliersService.remove(supplier.id);

        // Property: record still exists (update was called, not delete)
        expect(mockPrismaExtended.supplier.update).toHaveBeenCalledWith({
          where: { id: supplier.id },
          data: { active: false },
        });

        // Property: physical delete was never called
        expect(mockPrismaExtended.supplier.delete).not.toHaveBeenCalled();

        // Property: result has active=false
        expect(result.active).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('supplier with no linked orders: delete physically removes the record', async () => {
    await fc.assert(
      fc.asyncProperty(supplierArb, noLinkedOrderCountArb, async (supplier, orderCount) => {
        jest.clearAllMocks();

        // Setup: supplier exists and has no linked orders
        mockPrismaExtended.supplier.findFirst.mockResolvedValue(supplier);
        mockPrismaService.order.count.mockResolvedValue(orderCount);
        mockPrismaService.productSupplier.deleteMany.mockResolvedValue({ count: 0 });
        mockPrismaExtended.supplier.delete.mockResolvedValue(supplier);

        await suppliersService.remove(supplier.id);

        // Property: physical delete was called (hard-delete)
        expect(mockPrismaExtended.supplier.delete).toHaveBeenCalledWith({
          where: { id: supplier.id },
        });

        // Property: soft-delete (update active=false) was NOT called
        expect(mockPrismaExtended.supplier.update).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it('product with linked orders: delete results in soft-delete (active=false), record still exists', async () => {
    await fc.assert(
      fc.asyncProperty(productArb, linkedOrderCountArb, async (product, orderItemCount) => {
        jest.clearAllMocks();

        // Setup: product exists and has linked order items
        mockPrismaExtended.product.findFirst.mockResolvedValue(product);
        mockPrismaService.orderItem.count.mockResolvedValue(orderItemCount);
        mockPrismaExtended.product.update.mockResolvedValue({
          ...product,
          active: false,
        });

        const result = await productsService.remove(product.id);

        // Property: record still exists (update was called, not delete)
        expect(mockPrismaExtended.product.update).toHaveBeenCalledWith({
          where: { id: product.id },
          data: { active: false },
        });

        // Property: physical delete was never called
        expect(mockPrismaExtended.product.delete).not.toHaveBeenCalled();

        // Property: result has active=false
        expect(result.active).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('product with no linked orders: delete physically removes the record', async () => {
    await fc.assert(
      fc.asyncProperty(productArb, noLinkedOrderCountArb, async (product, orderItemCount) => {
        jest.clearAllMocks();

        // Setup: product exists and has no linked order items
        mockPrismaExtended.product.findFirst.mockResolvedValue(product);
        mockPrismaService.orderItem.count.mockResolvedValue(orderItemCount);
        mockPrismaService.productSupplier.deleteMany.mockResolvedValue({ count: 0 });
        mockPrismaExtended.product.delete.mockResolvedValue(product);

        await productsService.remove(product.id);

        // Property: physical delete was called (hard-delete)
        expect(mockPrismaExtended.product.delete).toHaveBeenCalledWith({
          where: { id: product.id },
        });

        // Property: soft-delete (update active=false) was NOT called
        expect(mockPrismaExtended.product.update).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});
