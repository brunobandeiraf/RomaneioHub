'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AxiosError } from 'axios';

// Types
export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'BLOCKED'
  | 'CANCELLED';

export interface SubscriptionStatusResponse {
  status: SubscriptionStatus;
  gracePeriodEnd?: string;
  stripeCustomerId?: string;
}

export interface CheckoutRequest {
  planType: 'monthly' | 'annual';
}

export interface CheckoutResponse {
  checkoutUrl: string;
}

export interface PortalResponse {
  portalUrl: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Hooks
export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatusResponse, AxiosError<ApiError>>({
    queryKey: ['subscription', 'status'],
    queryFn: async () => {
      const response = await apiClient.get<SubscriptionStatusResponse>(
        '/subscriptions/status'
      );
      return response.data;
    },
  });
}

export function useCreateCheckout() {
  return useMutation<CheckoutResponse, AxiosError<ApiError>, CheckoutRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<CheckoutResponse>(
        '/subscriptions/checkout',
        data
      );
      return response.data;
    },
  });
}

export function usePortalUrl() {
  return useMutation<PortalResponse, AxiosError<ApiError>, void>({
    mutationFn: async () => {
      const response = await apiClient.get<PortalResponse>(
        '/subscriptions/portal'
      );
      return response.data;
    },
  });
}
