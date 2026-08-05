import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@compras-hub/db';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DEFAULT_PAGE_SIZE,
  MAX_ORDER_ITEMS,
  MIN_ORDER_ITEMS,
  OrderStatus,
  VALID_ORDER_TRANSITIONS,
} from '@compras-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async list(params: ListOrdersParams) {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      status,
      supplierId,
      dateFrom,
      dateTo,
    } = params;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.extended.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          _count: { select: { items: true, invoices: true } },
        },
      }),
      this.prisma.extended.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const order = await this.prisma.extended.order.findFirst({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, nome: true, unidade: true, categoria: true } },
          },
        },
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async create(dto: CreateOrderDto, userId: string) {
    if (dto.items.length < 1 || dto.items.length > 50) {
      throw new BadRequestException(
        'Order must have between 1 and 50 line items',
      );
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // Calculate subtotals and total using Decimal
    const itemsWithSubtotal = dto.items.map((item) => {
      const quantidade = new Decimal(item.quantidade);
      const precoUnit = new Decimal(item.precoUnit);
      const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);

      return {
        productId: item.productId,
        quantidade,
        precoUnit,
        subtotal,
      };
    });

    const total = itemsWithSubtotal.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Decimal(0),
    );

    // Create order + items atomically in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          date: new Date(dto.date),
          total,
          createdById: userId,
          updatedById: userId,
          items: {
            create: itemsWithSubtotal.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: true,
          supplier: { select: { id: true, razaoSocial: true } },
        },
      });

      return created;
    });

    return order;
  }

  async update(id: string, dto: UpdateOrderDto, userId: string) {
    // Verify order exists within tenant scope
    const existing = await this.prisma.extended.order.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    // Build update data
    const data: Prisma.OrderUpdateInput = {
      updatedById: userId,
    };

    if (dto.date !== undefined) {
      data.date = new Date(dto.date);
    }

    if (dto.supplierId !== undefined) {
      data.supplier = { connect: { id: dto.supplierId } };
    }

    // If items are provided, recalculate totals
    if (dto.items && dto.items.length > 0) {
      if (dto.items.length > 50) {
        throw new BadRequestException(
          'Order must have between 1 and 50 line items',
        );
      }

      const itemsWithSubtotal = dto.items.map((item) => {
        const quantidade = new Decimal(item.quantidade);
        const precoUnit = new Decimal(item.precoUnit);
        const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);

        return {
          productId: item.productId,
          quantidade,
          precoUnit,
          subtotal,
        };
      });

      const total = itemsWithSubtotal.reduce(
        (sum, item) => sum.add(item.subtotal),
        new Decimal(0),
      );

      // Use transaction to update order + replace items atomically
      const order = await this.prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.orderItem.deleteMany({ where: { orderId: id } });

        // Update order with new total and recreate items
        const updated = await tx.order.update({
          where: { id },
          data: {
            ...data,
            total,
            items: {
              create: itemsWithSubtotal.map((item) => ({
                productId: item.productId,
                quantidade: item.quantidade,
                precoUnit: item.precoUnit,
                subtotal: item.subtotal,
              })),
            },
          },
          include: {
            items: true,
            supplier: { select: { id: true, razaoSocial: true } },
          },
        });

        return updated;
      });

      return order;
    }

    // Update only header fields (no item changes)
    return this.prisma.extended.order.update({
      where: { id },
      data,
      include: {
        items: true,
        supplier: { select: { id: true, razaoSocial: true } },
      },
    });
  }

  /**
   * Update the status of an order, enforcing valid state transitions.
   * Valid transitions:
   * - DRAFT → CONFIRMED
   * - DRAFT → CANCELLED
   * - CONFIRMED → DELIVERED
   * - CONFIRMED → CANCELLED
   *
   * Invalid transitions throw BadRequestException with current and attempted status.
   */
  async updateStatus(orderId: string, newStatus: OrderStatus, userId: string) {
    // Fetch the current order within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status as OrderStatus;

    // Check if the transition is valid
    const allowedTransitions = VALID_ORDER_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Update the order status
    return this.prisma.extended.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        updatedById: userId,
      },
    });
  }

  /**
   * Add a new item to an order.
   * Validates: order exists, max 50 items constraint, product exists.
   * Recalculates order total after adding.
   */
  async addItem(orderId: string, dto: AddOrderItemDto) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Enforce maximum items constraint
    if (order.items.length >= MAX_ORDER_ITEMS) {
      throw new BadRequestException(
        `Cannot add more items. Maximum of ${MAX_ORDER_ITEMS} items per order reached.`,
      );
    }

    // Verify product exists within tenant scope
    const product = await this.prisma.extended.product.findFirst({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Calculate subtotal using Decimal arithmetic
    const quantidade = new Decimal(dto.quantidade);
    const precoUnit = new Decimal(dto.precoUnit);
    const subtotal = quantidade.mul(precoUnit).toDecimalPlaces(2);

    // Create the order item and recalculate total atomically
    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderItem.create({
        data: {
          orderId,
          productId: dto.productId,
          quantidade,
          precoUnit,
          subtotal,
        },
      });

      // Recalculate order total
      const allItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      const total = allItems.reduce(
        (sum, i) => sum.add(i.subtotal),
        new Decimal(0),
      );

      await tx.order.update({
        where: { id: orderId },
        data: { total },
      });

      return created;
    });

    return item;
  }

  /**
   * Update an existing order item (quantidade and/or precoUnit).
   * Recalculates subtotal and order total after update.
   */
  async updateItem(orderId: string, itemId: string, dto: UpdateOrderItemDto) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify item belongs to this order
    const existingItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });

    if (!existingItem) {
      throw new NotFoundException('Order item not found');
    }

    // Build update data
    const quantidade = dto.quantidade !== undefined
      ? new Decimal(dto.quantidade)
      : existingItem.quantidade;
    const precoUnit = dto.precoUnit !== undefined
      ? new Decimal(dto.precoUnit)
      : existingItem.precoUnit;

    const subtotal = new Decimal(quantidade.toString())
      .mul(new Decimal(precoUnit.toString()))
      .toDecimalPlaces(2);

    // Update item and recalculate total atomically
    const updatedItem = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantidade,
          precoUnit,
          subtotal,
        },
      });

      // Recalculate order total
      const allItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      const total = allItems.reduce(
        (sum, i) => sum.add(i.subtotal),
        new Decimal(0),
      );

      await tx.order.update({
        where: { id: orderId },
        data: { total },
      });

      return updated;
    });

    return updatedItem;
  }

  /**
   * Remove an item from an order.
   * Enforces minimum 1 item constraint.
   * Recalculates order total after removal.
   */
  async removeItem(orderId: string, itemId: string) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify item belongs to this order
    const existingItem = order.items.find((item) => item.id === itemId);

    if (!existingItem) {
      throw new NotFoundException('Order item not found');
    }

    // Enforce minimum items constraint
    if (order.items.length <= MIN_ORDER_ITEMS) {
      throw new BadRequestException(
        `Cannot remove item. An order must have at least ${MIN_ORDER_ITEMS} item(s).`,
      );
    }

    // Delete the item and recalculate total atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({
        where: { id: itemId },
      });

      // Recalculate order total
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      const total = remainingItems.reduce(
        (sum, i) => sum.add(i.subtotal),
        new Decimal(0),
      );

      await tx.order.update({
        where: { id: orderId },
        data: { total },
      });
    });

    return { deleted: true };
  }
}
