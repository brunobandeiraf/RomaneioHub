import { Injectable } from '@nestjs/common';
import { Prisma } from '@compras-hub/db';
import { DEFAULT_PAGE_SIZE } from '@compras-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';

export interface DashboardSummary {
  totalSpent: number;
  orderCount: number;
  supplierCount: number;
  monthlyEvolution: { month: string; total: number }[];
  topSuppliers: { name: string; total: number }[];
  topProducts: { name: string; total: number }[];
}

export interface DashboardPurchasesParams {
  startDate: Date;
  endDate: Date;
  supplierId?: string;
  productId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ExportFilters {
  startDate: Date;
  endDate: Date;
  supplierId?: string;
  productId?: string;
  status?: string;
}

export interface DashboardPurchaseItem {
  id: string;
  date: Date;
  supplier: string;
  products: string[];
  quantity: number;
  amount: number;
  status: string;
  invoices: { id: string; filename: string }[];
}

export interface PaginatedPurchases {
  data: DashboardPurchaseItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSummary(startDate: Date, endDate: Date): Promise<DashboardSummary> {
    const tenantId = this.tenantContext.getTenantId();

    const baseWhere: Prisma.OrderWhereInput = {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Total spent and order count
    const aggregate = await this.prisma.order.aggregate({
      where: baseWhere,
      _sum: { total: true },
      _count: { id: true },
    });

    const totalSpent = aggregate._sum.total
      ? Number(aggregate._sum.total)
      : 0;
    const orderCount = aggregate._count.id;

    // Distinct suppliers count
    const supplierCountResult = await this.prisma.order.findMany({
      where: baseWhere,
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const supplierCount = supplierCountResult.length;

    // Monthly evolution
    const monthlyEvolution = await this.getMonthlyEvolution(
      tenantId!,
      startDate,
      endDate,
    );

    // Top 5 suppliers
    const topSuppliers = await this.getTopSuppliers(
      tenantId!,
      startDate,
      endDate,
    );

    // Top 5 products
    const topProducts = await this.getTopProducts(
      tenantId!,
      startDate,
      endDate,
    );

    return {
      totalSpent,
      orderCount,
      supplierCount,
      monthlyEvolution,
      topSuppliers,
      topProducts,
    };
  }

  async getPurchases(
    params: DashboardPurchasesParams,
  ): Promise<PaginatedPurchases> {
    const tenantId = this.tenantContext.getTenantId();
    const {
      startDate,
      endDate,
      supplierId,
      productId,
      status,
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
    } = params;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (productId) {
      where.items = {
        some: {
          productId,
        },
      };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          supplier: { select: { razaoSocial: true } },
          items: {
            include: {
              product: { select: { nome: true } },
            },
          },
          invoices: { select: { id: true, filename: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const data: DashboardPurchaseItem[] = orders.map((order) => ({
      id: order.id,
      date: order.date,
      supplier: order.supplier.razaoSocial,
      products: order.items.map((item) => item.product.nome),
      quantity: order.items.length,
      amount: Number(order.total),
      status: order.status,
      invoices: order.invoices.map((inv) => ({
        id: inv.id,
        filename: inv.filename,
      })),
    }));

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

  /**
   * Export all orders matching the given filters as a CSV string.
   * Uses the same filtering logic as getPurchases but without pagination.
   * CSV columns: Data, Fornecedor, Produtos, Quantidade, Valor, Status, Nota Fiscal
   */
  async exportCsv(filters: ExportFilters): Promise<string> {
    const tenantId = this.tenantContext.getTenantId();
    const { startDate, endDate, supplierId, productId, status } = filters;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (productId) {
      where.items = {
        some: {
          productId,
        },
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        supplier: { select: { razaoSocial: true } },
        items: {
          include: {
            product: { select: { nome: true } },
          },
        },
        invoices: { select: { filename: true } },
      },
    });

    // Build CSV
    const header = 'Data,Fornecedor,Produtos,Quantidade,Valor,Status,Nota Fiscal';
    const rows = orders.map((order) => {
      const data = order.date.toISOString().split('T')[0];
      const fornecedor = this.escapeCsvField(order.supplier.razaoSocial);
      const produtos = this.escapeCsvField(
        order.items.map((item) => item.product.nome).join('; '),
      );
      const quantidade = order.items
        .reduce((sum, item) => sum + Number(item.quantidade), 0)
        .toString();
      const valor = Number(order.total).toFixed(2);
      const orderStatus = order.status;
      const notaFiscal = this.escapeCsvField(
        order.invoices.map((inv) => inv.filename).join('; '),
      );

      return `${data},${fornecedor},${produtos},${quantidade},${valor},${orderStatus},${notaFiscal}`;
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Escape a CSV field value:
   * - Wrap in quotes if it contains commas, quotes, or newlines
   * - Double any existing quotes
   */
  private escapeCsvField(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async getMonthlyEvolution(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ month: string; total: number }[]> {
    // Use groupBy with date truncation via raw query for monthly aggregation
    const results = await this.prisma.$queryRaw<
      { month: string; total: number }[]
    >`
      SELECT 
        TO_CHAR(date_trunc('month', date), 'YYYY-MM') as month,
        COALESCE(SUM(total), 0)::float as total
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      GROUP BY date_trunc('month', date)
      ORDER BY date_trunc('month', date) ASC
    `;

    return results.map((r) => ({
      month: r.month,
      total: Number(r.total),
    }));
  }

  private async getTopSuppliers(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ name: string; total: number }[]> {
    const results = await this.prisma.$queryRaw<
      { name: string; total: number }[]
    >`
      SELECT 
        s."razaoSocial" as name,
        COALESCE(SUM(o.total), 0)::float as total
      FROM "Order" o
      INNER JOIN "Supplier" s ON o."supplierId" = s.id
      WHERE o."tenantId" = ${tenantId}
        AND o.date >= ${startDate}
        AND o.date <= ${endDate}
      GROUP BY s.id, s."razaoSocial"
      ORDER BY total DESC
      LIMIT 5
    `;

    return results.map((r) => ({
      name: r.name,
      total: Number(r.total),
    }));
  }

  private async getTopProducts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ name: string; total: number }[]> {
    const results = await this.prisma.$queryRaw<
      { name: string; total: number }[]
    >`
      SELECT 
        p.nome as name,
        COALESCE(SUM(oi.subtotal), 0)::float as total
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON oi."orderId" = o.id
      INNER JOIN "Product" p ON oi."productId" = p.id
      WHERE o."tenantId" = ${tenantId}
        AND o.date >= ${startDate}
        AND o.date <= ${endDate}
      GROUP BY p.id, p.nome
      ORDER BY total DESC
      LIMIT 5
    `;

    return results.map((r) => ({
      name: r.name,
      total: Number(r.total),
    }));
  }
}
