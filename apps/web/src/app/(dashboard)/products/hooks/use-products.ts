'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AxiosError } from 'axios';

// Types
export interface Product {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  precoReferencia: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  suppliers?: ProductSupplier[];
  _count?: {
    suppliers: number;
    orderItems: number;
  };
}

export interface ProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  price: string;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    active: boolean;
  };
}

export interface ProductsListResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoria?: string;
  active?: boolean | string;
}

export interface CreateProductRequest {
  nome: string;
  categoria: string;
  unidade: string;
  precoReferencia: number;
}

export interface UpdateProductRequest {
  nome?: string;
  categoria?: string;
  unidade?: string;
  precoReferencia?: number;
  active?: boolean;
}

export interface AddProductSupplierRequest {
  supplierId: string;
  price: number;
}

export interface UpdateProductSupplierRequest {
  price: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Query keys
const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: ProductsParams) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

// Hooks
export function useProducts(params: ProductsParams = {}) {
  return useQuery<ProductsListResponse, AxiosError<ApiError>>({
    queryKey: productKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params.search) searchParams.set('search', params.search);
      if (params.categoria) searchParams.set('categoria', params.categoria);
      if (params.active !== undefined) searchParams.set('active', String(params.active));

      const response = await apiClient.get<ProductsListResponse>(
        `/products?${searchParams.toString()}`
      );
      return response.data;
    },
  });
}

export function useProduct(id: string) {
  return useQuery<Product, AxiosError<ApiError>>({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation<Product, AxiosError<ApiError>, CreateProductRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<Product>('/products', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Product, AxiosError<ApiError>, UpdateProductRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.patch<Product>(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

export function useDeleteProduct(id: string) {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiError>, void>({
    mutationFn: async () => {
      await apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useAddProductSupplier(productId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProductSupplier, AxiosError<ApiError>, AddProductSupplierRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ProductSupplier>(
        `/products/${productId}/suppliers`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProductSupplier(productId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductSupplier,
    AxiosError<ApiError>,
    { supplierId: string; data: UpdateProductSupplierRequest }
  >({
    mutationFn: async ({ supplierId, data }) => {
      const response = await apiClient.patch<ProductSupplier>(
        `/products/${productId}/suppliers/${supplierId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useRemoveProductSupplier(productId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiError>, string>({
    mutationFn: async (supplierId) => {
      await apiClient.delete(`/products/${productId}/suppliers/${supplierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
