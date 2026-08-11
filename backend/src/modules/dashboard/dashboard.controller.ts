import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantRole } from '../../shared/index';
import { CurrentUser, Roles, SkipSubscriptionCheck } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/summary
   * Returns aggregated metrics: total spent, order count, distinct suppliers,
   * monthly evolution, top 5 suppliers, and top 5 products for the selected period.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get('summary')
  @Roles(
    TenantRole.SELLER,
    TenantRole.ACCOUNTING_MANAGER,
    TenantRole.ACCOUNTING_VIEWER,
  )
  async getSummary(@Query() query: QueryDashboardDto) {
    const { startDate, endDate } = query.validateDateRange();
    return this.dashboardService.getSummary(startDate, endDate);
  }

  /**
   * GET /dashboard/purchases
   * Returns a paginated list (20/page default) with: date, supplier, products,
   * quantity, amount, status, and invoice links.
   * Supports filtering by supplier, product, and status (combinatorial).
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get('purchases')
  @Roles(
    TenantRole.SELLER,
    TenantRole.ACCOUNTING_MANAGER,
    TenantRole.ACCOUNTING_VIEWER,
  )
  async getPurchases(@Query() query: QueryDashboardDto) {
    const { startDate, endDate } = query.validateDateRange();

    return this.dashboardService.getPurchases({
      startDate,
      endDate,
      supplierId: query.supplierId,
      productId: query.productId,
      status: query.status,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  /**
   * GET /dashboard/export
   * Export all orders matching filters as a CSV download.
   * Accessible by all roles. Works even when subscription is BLOCKED
   * (requirement 14.2 — data export during grace period and blocked state).
   */
  @Get('export')
  @Roles(
    TenantRole.SELLER,
    TenantRole.ACCOUNTING_MANAGER,
    TenantRole.ACCOUNTING_VIEWER,
  )
  @SkipSubscriptionCheck()
  async exportCsv(
    @Query() query: QueryDashboardDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const { startDate, endDate } = query.validateDateRange();

    const csv = await this.dashboardService.exportCsv({
      startDate,
      endDate,
      supplierId: query.supplierId,
      productId: query.productId,
      status: query.status,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="compras-export.csv"',
    );
    res.send(csv);
  }
}
