import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TenantRole } from '@romaneio-hub/shared';
import { Auditable, Roles, CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';
import { OrdersService, ListOrdersParams } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { QueryOrderDto } from './dto/query-order.dto';

@Auditable('Order')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * List orders with pagination and filters (supplier, status, date range).
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async list(@Query() query: QueryOrderDto) {
    const params: ListOrdersParams = {};

    if (query.page) params.page = parseInt(query.page, 10);
    if (query.limit) params.limit = parseInt(query.limit, 10);
    if (query.status) params.status = query.status;
    if (query.supplierId) params.supplierId = query.supplierId;
    if (query.dateFrom) params.dateFrom = query.dateFrom;
    if (query.dateTo) params.dateTo = query.dateTo;

    return this.ordersService.list(params);
  }

  /**
   * Get a single order by ID with items (including product) and invoices.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  /**
   * Create a new order with items.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.create(dto, user.authId);
  }

  /**
   * Update an order's header fields and optionally replace items.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.update(id, dto, user.authId);
  }

  /**
   * Update order status with state machine enforcement.
   * Valid transitions: DRAFT→CONFIRMED, CONFIRMED→DELIVERED, DRAFT→CANCELLED, CONFIRMED→CANCELLED
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id/status')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user.authId);
  }

  /**
   * Add a new item to an order.
   * Enforces maximum 50 items constraint.
   * Recalculates order total after adding.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post(':id/items')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async addItem(
    @Param('id') orderId: string,
    @Body() dto: AddOrderItemDto,
  ) {
    return this.ordersService.addItem(orderId, dto);
  }

  /**
   * Update an existing order item (quantidade and/or precoUnit).
   * Recalculates subtotal and order total after update.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id/items/:itemId')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async updateItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateItem(orderId, itemId, dto);
  }

  /**
   * Remove an item from an order.
   * Enforces minimum 1 item constraint.
   * Recalculates order total after removal.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Delete(':id/items/:itemId')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async removeItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(orderId, itemId);
  }
}
