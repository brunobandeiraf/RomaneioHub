import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { RequestUser } from '../../common/interfaces';
import { GlobalRole, TenantRole } from '@romaneio-hub/shared';
import { DashboardPeriod } from './dto/query-dashboard.dto';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockUser: RequestUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    globalRole: GlobalRole.SELLER,
    tenantRole: TenantRole.SELLER,
    email: 'test@test.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getSummary: jest.fn(),
            getPurchases: jest.fn(),
            exportCsv: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  describe('getSummary', () => {
    it('should call service.getSummary with resolved date range', async () => {
      const mockSummary = {
        totalSpent: 1000,
        orderCount: 5,
        supplierCount: 3,
        monthlyEvolution: [],
        topSuppliers: [],
        topProducts: [],
      };
      jest.spyOn(service, 'getSummary').mockResolvedValue(mockSummary);

      const result = await controller.getSummary({
        period: DashboardPeriod.CUSTOM,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        validateDateRange: () => ({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        }),
      } as any);

      expect(service.getSummary).toHaveBeenCalledWith(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getPurchases', () => {
    it('should call service.getPurchases with filters', async () => {
      const mockPurchases = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      jest.spyOn(service, 'getPurchases').mockResolvedValue(mockPurchases);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await controller.getPurchases({
        period: DashboardPeriod.CUSTOM,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: '2',
        limit: '10',
        supplierId: 'sup-1',
        productId: 'prod-1',
        status: 'CONFIRMED' as any,
        validateDateRange: () => ({ startDate, endDate }),
      } as any);

      expect(service.getPurchases).toHaveBeenCalledWith({
        startDate,
        endDate,
        supplierId: 'sup-1',
        productId: 'prod-1',
        status: 'CONFIRMED',
        page: 2,
        limit: 10,
      });
      expect(result).toEqual(mockPurchases);
    });

    it('should default page and limit to undefined when not provided', async () => {
      const mockPurchases = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      jest.spyOn(service, 'getPurchases').mockResolvedValue(mockPurchases);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await controller.getPurchases({
        period: DashboardPeriod.CURRENT_MONTH,
        validateDateRange: () => ({ startDate, endDate }),
      } as any);

      expect(service.getPurchases).toHaveBeenCalledWith({
        startDate,
        endDate,
        supplierId: undefined,
        productId: undefined,
        status: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('exportCsv', () => {
    it('should set CSV headers and return CSV content', async () => {
      const csvContent =
        'Data,Fornecedor,Produtos,Quantidade,Valor,Status,Nota Fiscal\n2024-01-01,Test,Prod,1,100.00,DRAFT,';
      jest.spyOn(service, 'exportCsv').mockResolvedValue(csvContent);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportCsv(
        {
          validateDateRange: () => ({
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
          }),
        } as any,
        mockUser,
        mockRes,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="compras-export.csv"',
      );
      expect(mockRes.send).toHaveBeenCalledWith(csvContent);
    });

    it('should pass filters from query to service', async () => {
      jest.spyOn(service, 'exportCsv').mockResolvedValue('');

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await controller.exportCsv(
        {
          status: 'CONFIRMED' as any,
          supplierId: 'sup-1',
          productId: 'prod-1',
          period: DashboardPeriod.CUSTOM,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          validateDateRange: () => ({ startDate, endDate }),
        } as any,
        mockUser,
        mockRes,
      );

      expect(service.exportCsv).toHaveBeenCalledWith({
        startDate,
        endDate,
        supplierId: 'sup-1',
        productId: 'prod-1',
        status: 'CONFIRMED',
      });
    });
  });
});
