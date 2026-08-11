import { Decimal } from '@prisma/client/runtime/library';
import * as fc from 'fast-check';
import { DashboardService } from './dashboard.service';

/**
 * Property 10: Dashboard Data Consistency
 *
 * The total amount spent reported by the dashboard equals the sum of all order
 * totals within the selected date range for the tenant.
 *
 * **Validates: Requirements 8.4**
 */
describe('Property 10: Dashboard Data Consistency', () => {
  // Arbitrary for a positive Decimal order total (0.01 to 9999999.99)
  const orderTotalArbitrary = fc
    .double({ min: 0.01, max: 9999999.99, noNaN: true })
    .map((v) => Number(v.toFixed(2)));

  // Arbitrary for a date within a reasonable range
  const dateArbitrary = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  });

  // Arbitrary for a date range (startDate <= endDate)
  const dateRangeArbitrary = fc
    .tuple(dateArbitrary, dateArbitrary)
    .map(([a, b]) => (a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a }));

  /**
   * Helper: creates a DashboardService instance with mocked Prisma calls.
   * The aggregate mock returns the provided sum, and the other calls return
   * defaults for supplierCount, monthlyEvolution, topSuppliers, topProducts.
   */
  function createServiceWithMockedAggregate(totalSum: Decimal, orderCount: number) {
    const prisma = {
      order: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { total: totalSum },
          _count: { id: orderCount },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    const service = new DashboardService(prisma as any, tenantContext as any);
    return { service, prisma, tenantContext };
  }

  it('totalSpent should equal the sum of all order totals within the date range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(orderTotalArbitrary, { minLength: 1, maxLength: 50 }),
        dateRangeArbitrary,
        async (orderTotals, dateRange) => {
          // Compute the expected sum of all order totals using Decimal for precision
          const expectedSum = orderTotals.reduce(
            (sum, total) => sum.add(new Decimal(total)),
            new Decimal(0),
          );

          const { service } = createServiceWithMockedAggregate(
            expectedSum,
            orderTotals.length,
          );

          const summary = await service.getSummary(
            dateRange.startDate,
            dateRange.endDate,
          );

          // The service converts _sum.total via Number(), so compare numerically
          expect(summary.totalSpent).toBeCloseTo(expectedSum.toNumber(), 2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('totalSpent should be 0 when no orders exist in the date range', async () => {
    await fc.assert(
      fc.asyncProperty(dateRangeArbitrary, async (dateRange) => {
        // Aggregate returns null sum when no records match
        const prisma = {
          order: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { total: null },
              _count: { id: 0 },
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        };

        const tenantContext = {
          getTenantId: jest.fn().mockReturnValue('tenant-1'),
        };

        const service = new DashboardService(prisma as any, tenantContext as any);

        const summary = await service.getSummary(
          dateRange.startDate,
          dateRange.endDate,
        );

        expect(summary.totalSpent).toBe(0);
        expect(summary.orderCount).toBe(0);
      }),
      { numRuns: 50 },
    );
  });

  it('totalSpent with a single order should equal that order total', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderTotalArbitrary,
        dateRangeArbitrary,
        async (orderTotal, dateRange) => {
          const decimalTotal = new Decimal(orderTotal);

          const { service } = createServiceWithMockedAggregate(decimalTotal, 1);

          const summary = await service.getSummary(
            dateRange.startDate,
            dateRange.endDate,
          );

          expect(summary.totalSpent).toBeCloseTo(orderTotal, 2);
          expect(summary.orderCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('totalSpent with many orders equals the sum of all individual totals', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(orderTotalArbitrary, { minLength: 10, maxLength: 100 }),
        dateRangeArbitrary,
        async (orderTotals, dateRange) => {
          // Compute expected sum
          const expectedSum = orderTotals.reduce(
            (sum, total) => sum.add(new Decimal(total)),
            new Decimal(0),
          );

          const { service } = createServiceWithMockedAggregate(
            expectedSum,
            orderTotals.length,
          );

          const summary = await service.getSummary(
            dateRange.startDate,
            dateRange.endDate,
          );

          expect(summary.totalSpent).toBeCloseTo(expectedSum.toNumber(), 2);
          expect(summary.orderCount).toBe(orderTotals.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('totalSpent calculation is consistent regardless of the date range chosen', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(orderTotalArbitrary, { minLength: 1, maxLength: 30 }),
        dateRangeArbitrary,
        dateRangeArbitrary,
        async (orderTotals, dateRange1, dateRange2) => {
          // Given the same set of orders, both date ranges should produce the
          // same totalSpent when the aggregate returns the same sum
          const expectedSum = orderTotals.reduce(
            (sum, total) => sum.add(new Decimal(total)),
            new Decimal(0),
          );

          const { service: service1 } = createServiceWithMockedAggregate(
            expectedSum,
            orderTotals.length,
          );
          const { service: service2 } = createServiceWithMockedAggregate(
            expectedSum,
            orderTotals.length,
          );

          const summary1 = await service1.getSummary(
            dateRange1.startDate,
            dateRange1.endDate,
          );
          const summary2 = await service2.getSummary(
            dateRange2.startDate,
            dateRange2.endDate,
          );

          // Both should report the same totalSpent
          expect(summary1.totalSpent).toBeCloseTo(summary2.totalSpent, 2);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('totalSpent passes the correct tenant-scoped date filter to aggregate', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderTotalArbitrary,
        dateRangeArbitrary,
        async (orderTotal, dateRange) => {
          const decimalTotal = new Decimal(orderTotal);
          const { service, prisma } = createServiceWithMockedAggregate(
            decimalTotal,
            1,
          );

          await service.getSummary(dateRange.startDate, dateRange.endDate);

          // Verify the aggregate was called with tenant-scoped date range filter
          expect(prisma.order.aggregate).toHaveBeenCalledWith({
            where: {
              tenantId: 'tenant-1',
              date: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            },
            _sum: { total: true },
            _count: { id: true },
          });
        },
      ),
      { numRuns: 50 },
    );
  });
});
