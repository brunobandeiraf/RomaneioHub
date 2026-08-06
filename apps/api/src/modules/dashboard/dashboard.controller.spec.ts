import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { RequestUser } from '../../common/interfaces';
import { GlobalRole, TenantRole } from '@compras-hub/shared';

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

  describe('exportCsv', () => {
    it('should set CSV headers and return CSV content', async () => {
      const csvContent =
        'Data,Fornecedor,Produtos,Quantidade,Valor,Status,Nota Fiscal\n2024-01-01,Test,Prod,1,100.00,DRAFT,';
      jest.spyOn(service, 'exportCsv').mockResolvedValue(csvContent);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportCsv({ validateDateRange: () => ({ startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') }) } as any, mockUser, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=compras_export.csv',
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
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
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

    it('should call exportCsv with tenant context from service', async () => {
      jest.spyOn(service, 'exportCsv').mockResolvedValue('');

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await controller.exportCsv(
        { validateDateRange: () => ({ startDate, endDate }) } as any,
        mockUser,
        mockRes,
      );

      expect(service.exportCsv).toHaveBeenCalledWith({
        startDate,
        endDate,
        supplierId: undefined,
        productId: undefined,
        status: undefined,
      });
    });
  });
});
