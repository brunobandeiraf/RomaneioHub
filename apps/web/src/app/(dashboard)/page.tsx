'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  PeriodFilter,
  useDashboardSummary,
  useDashboardPurchases,
} from '@/hooks/use-dashboard';
import { PeriodFilterComponent } from '@/components/dashboard/period-filter';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { MonthlyChart } from '@/components/dashboard/monthly-chart';
import { TopRankings } from '@/components/dashboard/top-rankings';
import { PurchasesList } from '@/components/dashboard/purchases-list';
import { CsvExportButton } from '@/components/dashboard/csv-export-button';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filters from URL search params
  const period = (searchParams.get('period') as PeriodFilter) || 'current_month';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const supplierFilter = searchParams.get('supplier') || '';
  const productFilter = searchParams.get('product') || '';
  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const isViewer = user?.role === 'ACCOUNTING_VIEWER';

  // Update URL params without full page reload
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Handlers
  const handlePeriodChange = useCallback(
    (newPeriod: PeriodFilter) => {
      const updates: Record<string, string> = { period: newPeriod, page: '1' };
      if (newPeriod !== 'custom') {
        updates.startDate = '';
        updates.endDate = '';
      }
      updateParams(updates);
    },
    [updateParams]
  );

  const handleDateRangeChange = useCallback(
    (start: string, end: string) => {
      updateParams({ startDate: start, endDate: end, page: '1' });
    },
    [updateParams]
  );

  const handleSupplierFilterChange = useCallback(
    (value: string) => updateParams({ supplier: value, page: '1' }),
    [updateParams]
  );

  const handleProductFilterChange = useCallback(
    (value: string) => updateParams({ product: value, page: '1' }),
    [updateParams]
  );

  const handleStatusFilterChange = useCallback(
    (value: string) => updateParams({ status: value, page: '1' }),
    [updateParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => updateParams({ page: String(newPage) }),
    [updateParams]
  );

  // Queries
  const summaryQuery = useDashboardSummary(period, startDate, endDate);
  const purchasesQuery = useDashboardPurchases({
    period,
    startDate,
    endDate,
    supplier: supplierFilter,
    product: productFilter,
    status: statusFilter,
    page,
    pageSize: 20,
  });

  // Error state
  const hasError = summaryQuery.isError || purchasesQuery.isError;
  const isLoading = summaryQuery.isLoading || purchasesQuery.isLoading;

  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        </div>

        <PeriodFilterComponent
          period={period}
          startDate={startDate}
          endDate={endDate}
          onPeriodChange={handlePeriodChange}
          onDateRangeChange={handleDateRangeChange}
        />

        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-800 font-medium">
            Ocorreu um erro ao carregar os dados do dashboard.
          </p>
          <p className="mt-1 text-sm text-red-600">
            {(summaryQuery.error as Error)?.message ||
              (purchasesQuery.error as Error)?.message ||
              'Erro de rede ou servidor.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => {
              summaryQuery.refetch();
              purchasesQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex gap-2">
          <CsvExportButton
            params={{
              period,
              startDate,
              endDate,
              supplier: supplierFilter,
              product: productFilter,
              status: statusFilter,
            }}
          />
          {!isViewer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/orders/new')}
            >
              Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Period filter */}
      <PeriodFilterComponent
        period={period}
        startDate={startDate}
        endDate={endDate}
        onPeriodChange={handlePeriodChange}
        onDateRangeChange={handleDateRangeChange}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          Carregando dados...
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards
        totalSpent={summaryQuery.data?.totalSpent ?? 0}
        orderCount={summaryQuery.data?.orderCount ?? 0}
        supplierCount={summaryQuery.data?.supplierCount ?? 0}
        isLoading={summaryQuery.isLoading}
      />

      {/* Monthly evolution chart */}
      <MonthlyChart
        data={summaryQuery.data?.monthlyEvolution ?? []}
        isLoading={summaryQuery.isLoading}
      />

      {/* Top rankings */}
      <TopRankings
        topSuppliers={summaryQuery.data?.topSuppliers ?? []}
        topProducts={summaryQuery.data?.topProducts ?? []}
        isLoading={summaryQuery.isLoading}
      />

      {/* Purchases list with filters */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">
          Lista de Compras
        </h3>
        <PurchasesList
          data={purchasesQuery.data}
          isLoading={purchasesQuery.isLoading}
          page={page}
          onPageChange={handlePageChange}
          supplierFilter={supplierFilter}
          productFilter={productFilter}
          statusFilter={statusFilter}
          onSupplierFilterChange={handleSupplierFilterChange}
          onProductFilterChange={handleProductFilterChange}
          onStatusFilterChange={handleStatusFilterChange}
        />
      </div>
    </div>
  );
}
