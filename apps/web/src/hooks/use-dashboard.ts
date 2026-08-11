'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Types
export type PeriodFilter = 'current_month' | 'previous_month' | 'last_3_months' | 'custom';

export interface DashboardSummary {
  totalSpent: number;
  orderCount: number;
  supplierCount: number;
  monthlyEvolution: MonthlyData[];
  topSuppliers: RankedItem[];
  topProducts: RankedItem[];
}

export interface MonthlyData {
  month: string;
  total: number;
}

export interface RankedItem {
  id: string;
  name: string;
  total: number;
}

export interface DashboardPurchase {
  id: string;
  date: string;
  supplier: string;
  products: string;
  quantity: number;
  amount: number;
  status: string;
  invoiceId?: string;
  invoices: { id: string; filename: string }[];
}

export interface PurchasesResponse {
  data: DashboardPurchase[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PurchasesParams {
  period: PeriodFilter;
  startDate?: string;
  endDate?: string;
  supplier?: string;
  product?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

// Hooks
export function useDashboardSummary(
  period: PeriodFilter,
  startDate?: string,
  endDate?: string
) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary', period, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = { period };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await apiClient.get('/dashboard/summary', { params });
      return response.data;
    },
    enabled: period !== 'custom' || (!!startDate && !!endDate),
  });
}

export function useDashboardPurchases(params: PurchasesParams) {
  return useQuery<PurchasesResponse>({
    queryKey: ['dashboard', 'purchases', params],
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {
        period: params.period,
        page: params.page || 1,
        limit: params.pageSize || 20,
      };
      if (params.startDate) queryParams.startDate = params.startDate;
      if (params.endDate) queryParams.endDate = params.endDate;
      if (params.supplier) queryParams.supplierId = params.supplier;
      if (params.product) queryParams.productId = params.product;
      if (params.status) queryParams.status = params.status;

      const response = await apiClient.get('/dashboard/purchases', {
        params: queryParams,
      });
      return response.data;
    },
    enabled: params.period !== 'custom' || (!!params.startDate && !!params.endDate),
  });
}

export function useExportCsv() {
  return useMutation<Blob, Error, PurchasesParams>({
    mutationFn: async (params) => {
      const queryParams: Record<string, string | number> = {
        period: params.period,
      };
      if (params.startDate) queryParams.startDate = params.startDate;
      if (params.endDate) queryParams.endDate = params.endDate;
      if (params.supplier) queryParams.supplierId = params.supplier;
      if (params.product) queryParams.productId = params.product;
      if (params.status) queryParams.status = params.status;

      const response = await apiClient.get('/dashboard/export', {
        params: queryParams,
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compras_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}
