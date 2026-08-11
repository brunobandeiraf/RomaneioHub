import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import * as fc from 'fast-check';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';

/**
 * Property 1: Order Total Calculation Integrity
 *
 * For all valid orders, the order total equals the sum of (quantidade × precoUnit)
 * for each item, where each subtotal is rounded to 2 decimal places.
 *
 * **Validates: Requirements 6.2**
 */
describe('Property 1: Order Total Calculation Integrity', () => {
  let service: OrdersService;

  const mockTenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-1'),
  };

  const mockPrismaService = {
    extended: {
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
      const mockTx = {
        order: {
          create: jest.fn().mockImplementation(async (args: any) => ({
            id: 'order-1',
            tenantId: 'tenant-1',
            supplierId: args.data.supplierId,
            date: args.data.date,
            total: args.data.total,
            status: 'DRAFT',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: args.data.createdById,
            updatedById: args.data.updatedById,
            items: (args.data.items?.create || []).map(
              (item: any, idx: number) => ({
                id: `item-${idx}`,
                orderId: 'order-1',
                ...item,
              }),
            ),
            supplier: { id: args.data.supplierId, razaoSocial: 'Test Supplier' },
          })),
        },
      };
      return fn(mockTx);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContext,
          useValue: mockTenantContext,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  // Arbitrary for a valid item with quantidade (0.001-9999.999) and precoUnit (0.01-9999999.99)
  const itemArbitrary = fc.record({
    productId: fc.uuid(),
    quantidade: fc.double({ min: 0.001, max: 9999.999, noNaN: true }).map(
      (v) => Number(v.toFixed(3)),
    ),
    precoUnit: fc.double({ min: 0.01, max: 9999999.99, noNaN: true }).map(
      (v) => Number(v.toFixed(2)),
    ),
  });

  // Generate arrays of 1-50 items
  const itemsArbitrary = fc.array(itemArbitrary, { minLength: 1, maxLength: 50 });

  it('order total should equal sum of (quantidade × precoUnit) rounded to 2 decimal places for each item', async () => {
    await fc.assert(
      fc.asyncProperty(itemsArbitrary, async (items) => {
        // Calculate expected total using the same Decimal logic as the service
        const expectedTotal = items.reduce((sum, item) => {
          const quantidade = new Decimal(item.quantidade);
          const precoUnit = new Decimal(item.precoUnit);
          const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);
          return sum.add(subtotal);
        }, new Decimal(0));

        // Call the service create method
        const result = await service.create(
          {
            supplierId: 'supplier-1',
            date: '2024-01-15',
            items: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
            })),
          },
          'user-1',
        );

        // Verify total matches expected
        const actualTotal = new Decimal(result.total.toString());
        expect(actualTotal.equals(expectedTotal)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('single item order: total equals quantidade × precoUnit rounded to 2 dp', async () => {
    await fc.assert(
      fc.asyncProperty(itemArbitrary, async (item) => {
        const expectedTotal = new Decimal(item.quantidade)
          .mul(new Decimal(item.precoUnit))
          .toDecimalPlaces(2);

        const result = await service.create(
          {
            supplierId: 'supplier-1',
            date: '2024-01-15',
            items: [
              {
                productId: item.productId,
                quantidade: item.quantidade,
                precoUnit: item.precoUnit,
              },
            ],
          },
          'user-1',
        );

        const actualTotal = new Decimal(result.total.toString());
        expect(actualTotal.equals(expectedTotal)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('max items (50): total is consistent with sum of subtotals', async () => {
    const maxItemsArbitrary = fc.array(itemArbitrary, {
      minLength: 50,
      maxLength: 50,
    });

    await fc.assert(
      fc.asyncProperty(maxItemsArbitrary, async (items) => {
        const expectedTotal = items.reduce((sum, item) => {
          const quantidade = new Decimal(item.quantidade);
          const precoUnit = new Decimal(item.precoUnit);
          const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);
          return sum.add(subtotal);
        }, new Decimal(0));

        const result = await service.create(
          {
            supplierId: 'supplier-1',
            date: '2024-01-15',
            items: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
            })),
          },
          'user-1',
        );

        const actualTotal = new Decimal(result.total.toString());
        expect(actualTotal.equals(expectedTotal)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('very small quantities: total is still correctly calculated', async () => {
    const smallQuantityItem = fc.record({
      productId: fc.uuid(),
      quantidade: fc.double({ min: 0.001, max: 0.01, noNaN: true }).map(
        (v) => Number(v.toFixed(3)),
      ),
      precoUnit: fc.double({ min: 0.01, max: 9999999.99, noNaN: true }).map(
        (v) => Number(v.toFixed(2)),
      ),
    });

    const smallQuantityItems = fc.array(smallQuantityItem, {
      minLength: 1,
      maxLength: 20,
    });

    await fc.assert(
      fc.asyncProperty(smallQuantityItems, async (items) => {
        const expectedTotal = items.reduce((sum, item) => {
          const quantidade = new Decimal(item.quantidade);
          const precoUnit = new Decimal(item.precoUnit);
          const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);
          return sum.add(subtotal);
        }, new Decimal(0));

        const result = await service.create(
          {
            supplierId: 'supplier-1',
            date: '2024-01-15',
            items: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
            })),
          },
          'user-1',
        );

        const actualTotal = new Decimal(result.total.toString());
        expect(actualTotal.equals(expectedTotal)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('very large prices: total is still correctly calculated', async () => {
    const largePriceItem = fc.record({
      productId: fc.uuid(),
      quantidade: fc.double({ min: 0.001, max: 9999.999, noNaN: true }).map(
        (v) => Number(v.toFixed(3)),
      ),
      precoUnit: fc.double({ min: 1000000, max: 9999999.99, noNaN: true }).map(
        (v) => Number(v.toFixed(2)),
      ),
    });

    const largePriceItems = fc.array(largePriceItem, {
      minLength: 1,
      maxLength: 10,
    });

    await fc.assert(
      fc.asyncProperty(largePriceItems, async (items) => {
        const expectedTotal = items.reduce((sum, item) => {
          const quantidade = new Decimal(item.quantidade);
          const precoUnit = new Decimal(item.precoUnit);
          const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);
          return sum.add(subtotal);
        }, new Decimal(0));

        const result = await service.create(
          {
            supplierId: 'supplier-1',
            date: '2024-01-15',
            items: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
            })),
          },
          'user-1',
        );

        const actualTotal = new Decimal(result.total.toString());
        expect(actualTotal.equals(expectedTotal)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});
