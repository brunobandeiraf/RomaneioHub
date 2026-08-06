'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AxiosError } from 'axios';

// Types
export type TenantRole =
  | 'SELLER'
  | 'ACCOUNTING_MANAGER'
  | 'ACCOUNTING_VIEWER';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  status: InviteStatus;
  invitedAt: string;
  acceptedAt?: string;
}

export interface InviteRequest {
  email: string;
  role: 'ACCOUNTING_MANAGER' | 'ACCOUNTING_VIEWER';
}

export interface InviteResponse {
  message: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Hooks
export function useTeamMembers() {
  return useQuery<TeamMember[], AxiosError<ApiError>>({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const response = await apiClient.get<TeamMember[]>('/auth/team');
      return response.data;
    },
  });
}

export function useInviteAccountant() {
  const queryClient = useQueryClient();

  return useMutation<InviteResponse, AxiosError<ApiError>, InviteRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<InviteResponse>(
        '/auth/invite',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
  });
}

export function useResendInvite() {
  return useMutation<InviteResponse, AxiosError<ApiError>, { memberId: string }>({
    mutationFn: async ({ memberId }) => {
      const response = await apiClient.post<InviteResponse>(
        `/auth/invite/${memberId}/resend`
      );
      return response.data;
    },
  });
}

export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, AxiosError<ApiError>, { memberId: string }>({
    mutationFn: async ({ memberId }) => {
      const response = await apiClient.delete<{ message: string }>(
        `/auth/team/${memberId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
  });
}
