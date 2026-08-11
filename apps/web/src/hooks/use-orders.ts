'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AxiosError } from 'axios';
import type {
  Order,
  OrdersListResponse,
  CreateOrderInput,
  UpdateOrderStatusInput,
  UploadUrlResponse,
  Supplier,
  Product,
} from '@/types/order';

interface ApiError {
  message: string;
  statusCode: number;
}

// Query keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

export const supplierKeys = {
  all: ['suppliers'] as const,
  list: () => [...supplierKeys.all, 'list'] as const,
};

export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
};

// List orders with filters and pagination
export function useOrders(filters: {
  page?: number;
  pageSize?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.status) params.set('status', filters.status);
  if (filters.supplierId) params.set('supplierId', filters.supplierId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  return useQuery<OrdersListResponse, AxiosError<ApiError>>({
    queryKey: orderKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<OrdersListResponse>(
        `/orders?${params.toString()}`
      );
      return response.data;
    },
  });
}

// Get single order details
export function useOrder(id: string) {
  return useQuery<Order, AxiosError<ApiError>>({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Order>(`/orders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Create order
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<Order, AxiosError<ApiError>, CreateOrderInput>({
    mutationFn: async (data) => {
      const response = await apiClient.post<Order>('/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// Update order status
export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<Order, AxiosError<ApiError>, UpdateOrderStatusInput>({
    mutationFn: async (data) => {
      const response = await apiClient.patch<Order>(
        `/orders/${orderId}/status`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// Get presigned upload URL
export function useGetUploadUrl(orderId: string) {
  return useMutation<
    UploadUrlResponse,
    AxiosError<ApiError>,
    { filename: string; contentType: string; sizeBytes: number }
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<UploadUrlResponse>(
        `/orders/${orderId}/invoices/upload-url`,
        data
      );
      return response.data;
    },
  });
}

// Register uploaded invoice
export function useRegisterInvoice(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    AxiosError<ApiError>,
    { filename: string; s3Key: string; contentType: string; sizeBytes: number }
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post(
        `/orders/${orderId}/invoices`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}

// Get presigned download URL
export function useGetDownloadUrl() {
  return useMutation<
    { downloadUrl: string },
    AxiosError<ApiError>,
    { orderId: string; invoiceId: string }
  >({
    mutationFn: async ({ orderId, invoiceId }) => {
      const response = await apiClient.get<{ downloadUrl: string }>(
        `/orders/${orderId}/invoices/${invoiceId}/download`
      );
      return response.data;
    },
  });
}

// Add order item
export function useAddOrderItem(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    AxiosError<ApiError>,
    { productId: string; quantidade: number; precoUnit: number }
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post(`/orders/${orderId}/items`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// Update order item
export function useUpdateOrderItem(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    AxiosError<ApiError>,
    { itemId: string; quantidade: number; precoUnit: number }
  >({
    mutationFn: async ({ itemId, ...data }) => {
      const response = await apiClient.patch(
        `/orders/${orderId}/items/${itemId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// Remove order item
export function useRemoveOrderItem(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<unknown, AxiosError<ApiError>, string>({
    mutationFn: async (itemId) => {
      const response = await apiClient.delete(
        `/orders/${orderId}/items/${itemId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// List suppliers (for dropdowns)
export function useSuppliers() {
  return useQuery<Supplier[], AxiosError<ApiError>>({
    queryKey: supplierKeys.list(),
    queryFn: async () => {
      const response = await apiClient.get<{ data: Supplier[] }>('/suppliers');
      return response.data.data ?? response.data as unknown as Supplier[];
    },
  });
}

// List products (for dropdowns)
export function useProducts() {
  return useQuery<Product[], AxiosError<ApiError>>({
    queryKey: productKeys.list(),
    queryFn: async () => {
      const response = await apiClient.get<{ data: Product[] }>('/products');
      return response.data.data ?? response.data as unknown as Product[];
    },
  });
}
