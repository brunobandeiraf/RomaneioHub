import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';
import { OrderStatus } from '../../shared/index';

const mockOrder = (status: OrderStatus) => ({
  id: 'order-1',
  tenantId: 'tenant-1',
  supplierId: 'supplier-1',
  date: new Date(),
  status,
  total: '100.00',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: 'user-1',
  updatedById: 'user-1',
});

describe('OrdersService - updateStatus', () => {
  let service: OrdersService;

  const mockPrismaExtended = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPrismaService = {
    extended: mockPrismaExtended,
  };

  const mockTenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-1'),
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

  describe('valid transitions', () => {
    it('should transition from DRAFT to CONFIRMED', async () => {
      const order = mockOrder(OrderStatus.DRAFT);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);
      mockPrismaExtended.order.update.mockResolvedValue({
        ...order,
        status: OrderStatus.CONFIRMED,
      });

      const result = await service.updateStatus(
        'order-1',
        OrderStatus.CONFIRMED,
        'user-1',
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(mockPrismaExtended.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.CONFIRMED, updatedById: 'user-1' },
      });
    });

    it('should transition from CONFIRMED to DELIVERED', async () => {
      const order = mockOrder(OrderStatus.CONFIRMED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);
      mockPrismaExtended.order.update.mockResolvedValue({
        ...order,
        status: OrderStatus.DELIVERED,
      });

      const result = await service.updateStatus(
        'order-1',
        OrderStatus.DELIVERED,
        'user-1',
      );

      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(mockPrismaExtended.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.DELIVERED, updatedById: 'user-1' },
      });
    });

    it('should transition from DRAFT to CANCELLED', async () => {
      const order = mockOrder(OrderStatus.DRAFT);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);
      mockPrismaExtended.order.update.mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.updateStatus(
        'order-1',
        OrderStatus.CANCELLED,
        'user-1',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockPrismaExtended.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.CANCELLED, updatedById: 'user-1' },
      });
    });

    it('should transition from CONFIRMED to CANCELLED', async () => {
      const order = mockOrder(OrderStatus.CONFIRMED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);
      mockPrismaExtended.order.update.mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.updateStatus(
        'order-1',
        OrderStatus.CANCELLED,
        'user-1',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockPrismaExtended.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.CANCELLED, updatedById: 'user-1' },
      });
    });
  });

  describe('invalid transitions', () => {
    it('should reject DRAFT to DELIVERED', async () => {
      const order = mockOrder(OrderStatus.DRAFT);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', OrderStatus.DELIVERED, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.DELIVERED, 'user-1'),
      ).rejects.toThrow('Invalid status transition from DRAFT to DELIVERED');

      expect(mockPrismaExtended.order.update).not.toHaveBeenCalled();
    });

    it('should reject CONFIRMED to DRAFT', async () => {
      const order = mockOrder(OrderStatus.CONFIRMED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', OrderStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(
        'Invalid status transition from CONFIRMED to DRAFT',
      );
    });

    it('should reject any transition from DELIVERED', async () => {
      const order = mockOrder(OrderStatus.DELIVERED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', OrderStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.CANCELLED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject any transition from CANCELLED', async () => {
      const order = mockOrder(OrderStatus.CANCELLED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', OrderStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus('order-1', OrderStatus.DELIVERED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include current status and attempted transition in error message', async () => {
      const order = mockOrder(OrderStatus.DELIVERED);
      mockPrismaExtended.order.findFirst.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', OrderStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(
        'Invalid status transition from DELIVERED to CONFIRMED',
      );
    });
  });

  describe('order not found', () => {
    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', OrderStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
