import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let tenantContext: any;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };
    service = new DashboardService(prisma, tenantContext);
  });

  describe('exportCsv', () => {
    const baseFilters = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    it('should return CSV with header and order rows', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          date: new Date('2024-01-15'),
          supplier: { razaoSocial: 'Fornecedor A' },
          items: [
            { product: { nome: 'Produto 1' }, quantidade: 10 },
            { product: { nome: 'Produto 2' }, quantidade: 5 },
          ],
          total: 150.5,
          status: 'CONFIRMED',
          invoices: [{ filename: 'nf-001.pdf' }],
        },
      ]);

      const csv = await service.exportCsv(baseFilters);

      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Data,Fornecedor,Produtos,Quantidade,Valor,Status,Nota Fiscal',
      );
      expect(lines[1]).toBe(
        '2024-01-15,Fornecedor A,Produto 1; Produto 2,15,150.50,CONFIRMED,nf-001.pdf',
      );
    });

    it('should return only header when no orders match', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv(baseFilters);

      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        'Data,Fornecedor,Produtos,Quantidade,Valor,Status,Nota Fiscal',
      );
    });

    it('should escape CSV fields with commas', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          date: new Date('2024-02-01'),
          supplier: { razaoSocial: 'Empresa A, B & C Ltda' },
          items: [{ product: { nome: 'Produto X' }, quantidade: 1 }],
          total: 99.99,
          status: 'DRAFT',
          invoices: [],
        },
      ]);

      const csv = await service.exportCsv(baseFilters);

      const lines = csv.split('\n');
      expect(lines[1]).toContain('"Empresa A, B & C Ltda"');
    });

    it('should apply status filter', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.exportCsv({ ...baseFilters, status: 'CONFIRMED' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            status: 'CONFIRMED',
          }),
        }),
      );
    });

    it('should apply supplierId filter', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.exportCsv({ ...baseFilters, supplierId: 'supplier-123' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            supplierId: 'supplier-123',
          }),
        }),
      );
    });

    it('should apply productId filter', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.exportCsv({ ...baseFilters, productId: 'product-456' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            items: { some: { productId: 'product-456' } },
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.exportCsv(baseFilters);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            date: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        }),
      );
    });

    it('should not apply pagination (no skip/take)', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.exportCsv(baseFilters);

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.skip).toBeUndefined();
      expect(call.take).toBeUndefined();
    });

    it('should handle multiple invoices per order', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          date: new Date('2024-03-10'),
          supplier: { razaoSocial: 'Fornecedor B' },
          items: [{ product: { nome: 'Item A' }, quantidade: 2 }],
          total: 200,
          status: 'DELIVERED',
          invoices: [
            { filename: 'nf-001.pdf' },
            { filename: 'nf-002.pdf' },
          ],
        },
      ]);

      const csv = await service.exportCsv(baseFilters);

      const lines = csv.split('\n');
      expect(lines[1]).toContain('nf-001.pdf; nf-002.pdf');
    });

    it('should handle orders with no invoices', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          date: new Date('2024-04-01'),
          supplier: { razaoSocial: 'Fornecedor C' },
          items: [{ product: { nome: 'Item B' }, quantidade: 3 }],
          total: 300,
          status: 'DRAFT',
          invoices: [],
        },
      ]);

      const csv = await service.exportCsv(baseFilters);

      const lines = csv.split('\n');
      // Last field should be empty
      expect(lines[1]).toBe('2024-04-01,Fornecedor C,Item B,3,300.00,DRAFT,');
    });
  });
});
