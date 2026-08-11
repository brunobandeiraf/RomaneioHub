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
import { SuppliersService, ListSuppliersParams } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Auditable('Supplier')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * List suppliers with pagination, optional search by razaoSocial/cnpj and active filter.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const params: ListSuppliersParams = {};

    if (page) params.page = parseInt(page, 10);
    if (limit) params.limit = parseInt(limit, 10);
    if (search) params.search = search;
    if (active !== undefined && active !== '') {
      params.active = active === 'true';
    }

    return this.suppliersService.list(params);
  }

  /**
   * Get a single supplier by ID.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  /**
   * Create a new supplier.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.create(dto, user.userId);
  }

  /**
   * Update an existing supplier.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Patch(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.update(id, dto, user.userId);
  }

  /**
   * Delete or inactivate a supplier.
   * Soft-delete if orders exist, hard-delete otherwise.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Delete(':id')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
