import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantRole } from '@romaneio-hub/shared';
import { Auditable, Roles, CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';
import { ProductsService, ListProductsParams } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { AddProductSupplierDto } from './dto/add-product-supplier.dto';
import { UpdateProductSupplierDto } from './dto/update-product-supplier.dto';

@Auditable('Product')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * List products with pagination, search, category and active filters.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async list(@Query() query: QueryProductDto) {
    const params: ListProductsParams = {
      page: query.page,
      pageSize: query.limit,
      search: query.search,
      categoria: query.categoria,
      active: query.active,
    };

    return this.productsService.list(params);
  }

  /**
   * Get product by ID with supplier associations and prices.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * Create a new product.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.create(dto, user.userId);
  }

  /**
   * Update an existing product.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.update(id, dto, user.userId);
  }

  /**
   * Delete or inactivate a product.
   * Soft-delete if orders exist, hard-delete otherwise.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Delete(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  // ─── Product-Supplier Association Endpoints ────────────────────────────────

  /**
   * Associate a supplier with the product at a given price.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post(':id/suppliers')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async addSupplier(
    @Param('id') id: string,
    @Body() dto: AddProductSupplierDto,
  ) {
    return this.productsService.addSupplier(id, dto);
  }

  /**
   * Update the price for a product-supplier association.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id/suppliers/:supplierId')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async updateSupplierPrice(
    @Param('id') id: string,
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateProductSupplierDto,
  ) {
    return this.productsService.updateSupplierPrice(id, supplierId, dto);
  }

  /**
   * Remove a product-supplier association.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Delete(':id/suppliers/:supplierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async removeSupplier(
    @Param('id') id: string,
    @Param('supplierId') supplierId: string,
  ) {
    await this.productsService.removeSupplier(id, supplierId);
  }
}
