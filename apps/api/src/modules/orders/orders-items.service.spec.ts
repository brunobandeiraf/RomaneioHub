import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';

const makeItem = (id: string, quantidade: number, precoUnit: number) => ({
  id,
  orderId: 'order-1',
  productId: 'product-1',
  quantidade: new Decimal(quantidade),
  precoUnit: new Decimal(precoUnit),
  subtotal: new Decimal(quantidade * precoUnit),
});

describe('OrdersService - Item Management', () => {
  let service: OrdersService;

  const mockOrderItem = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockOrder = {
    update: jest.fn(),
  };

  const mockTx = {
    orderItem: mockOrderItem,
    order: mockOrder,
  };

  const mockPrismaExtended = {
    order: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
  };

  const mockPrismaService = {
    extended: mockPrismaExtended,
    orderItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)),
  };

  const mockTenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-1'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);

    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx),
    );
  });

  describe('addItem', () => {
    it('should add an item to an order and recalculate total', async () => {
      const existingItems = [makeItem('item-1', 2, 10)];
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items: existingItems,
      });
      mockPrismaExtended.product.findFirst.mockResolvedValue({
        id: 'product-2',
        nome: 'Product 2',
      });

      const newItem = makeItem('item-2', 3, 15);
      mockOrderItem.create.mockResolvedValue(newItem);

      const allItems = [...existingItems, newItem];
      mockOrderItem.findMany.mockResolvedValue(allItems);
      mockOrder.update.mockResolvedValue({});

      const result = await service.addItem('order-1', {
        productId: 'product-2',
        quantidade: 3,
        precoUnit: 15,
      });

      expect(result).toEqual(newItem);
      expect(mockOrderItem.create).toHaveBeenCalled();
      expect(mockOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { total: expect.any(Decimal) },
      });
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem('nonexistent', {
          productId: 'product-1',
          quantidade: 1,
          precoUnit: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when max items reached', async () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        makeItem(`item-${i}`, 1, 10),
      );
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items,
      });

      await expect(
        service.addItem('order-1', {
          productId: 'product-1',
          quantidade: 1,
          precoUnit: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items: [makeItem('item-1', 1, 10)],
      });
      mockPrismaExtended.product.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem('order-1', {
          productId: 'nonexistent',
          quantidade: 1,
          precoUnit: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItem', () => {
    it('should update an item and recalculate total', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
      });
      mockPrismaService.orderItem.findFirst.mockResolvedValue(
        makeItem('item-1', 2, 10),
      );

      const updatedItem = makeItem('item-1', 5, 10);
      mockOrderItem.update.mockResolvedValue(updatedItem);
      mockOrderItem.findMany.mockResolvedValue([updatedItem]);
      mockOrder.update.mockResolvedValue({});

      const result = await service.updateItem('order-1', 'item-1', {
        quantidade: 5,
      });

      expect(result).toEqual(updatedItem);
      expect(mockOrderItem.update).toHaveBeenCalled();
      expect(mockOrder.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem('nonexistent', 'item-1', { quantidade: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item does not belong to order', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
      });
      mockPrismaService.orderItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem('order-1', 'nonexistent', { quantidade: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should remove an item and recalculate total', async () => {
      const items = [makeItem('item-1', 2, 10), makeItem('item-2', 3, 15)];
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items,
      });

      mockOrderItem.delete.mockResolvedValue({});
      mockOrderItem.findMany.mockResolvedValue([items[1]]);
      mockOrder.update.mockResolvedValue({});

      const result = await service.removeItem('order-1', 'item-1');

      expect(result).toEqual({ deleted: true });
      expect(mockOrderItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.removeItem('nonexistent', 'item-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item does not belong to order', async () => {
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items: [makeItem('item-1', 2, 10)],
      });

      await expect(
        service.removeItem('order-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when removing last item', async () => {
      const items = [makeItem('item-1', 2, 10)];
      mockPrismaExtended.order.findFirst.mockResolvedValue({
        id: 'order-1',
        items,
      });

      await expect(
        service.removeItem('order-1', 'item-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
