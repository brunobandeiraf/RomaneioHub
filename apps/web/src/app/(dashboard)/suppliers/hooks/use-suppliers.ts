'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AxiosError } from 'axios';

// Types
export interface Supplier {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  contato?: string | null;
  endereco?: Record<string, string> | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
}

export interface SuppliersListResponse {
  data: Supplier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SuppliersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}

export interface CreateSupplierRequest {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  contato?: string;
  endereco?: Record<string, string>;
}

export interface UpdateSupplierRequest {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  contato?: string;
  endereco?: Record<string, string>;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Hooks
export function useSuppliers(params: SuppliersParams = {}) {
  const { page = 1, pageSize = 20, search, active } = params;

  return useQuery<SuppliersListResponse, AxiosError<ApiError>>({
    queryKey: ['suppliers', { page, pageSize, search, active }],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('pageSize', String(pageSize));
      if (search) queryParams.set('search', search);
      if (active !== undefined) queryParams.set('active', String(active));

      const response = await apiClient.get<SuppliersListResponse>(
        `/suppliers?${queryParams.toString()}`
      );
      return response.data;
    },
  });
}

export function useSupplier(id: string) {
  return useQuery<Supplier, AxiosError<ApiError>>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const response = await apiClient.get<Supplier>(`/suppliers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation<Supplier, AxiosError<ApiError>, CreateSupplierRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<Supplier>('/suppliers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Supplier, AxiosError<ApiError>, UpdateSupplierRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.patch<Supplier>(`/suppliers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiError>, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
