'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient, setTokens } from '@/lib/api-client';
import { AxiosError } from 'axios';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  // Present in dev mode (DevAuthService), absent in production (Supabase Auth)
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface RegisterRequest {
  name: string;
  email: string;
  companyName: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  accessToken: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Hooks
export function useLogin() {
  return useMutation<LoginResponse, AxiosError<ApiError>, LoginRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<LoginResponse>('/auth/login', data);
      return response.data;
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
    },
  });
}

export function useRegister() {
  return useMutation<RegisterResponse, AxiosError<ApiError>, RegisterRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<RegisterResponse>(
        '/auth/register',
        data
      );
      return response.data;
    },
  });
}

export function useForgotPassword() {
  return useMutation<
    ForgotPasswordResponse,
    AxiosError<ApiError>,
    ForgotPasswordRequest
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<ForgotPasswordResponse>(
        '/auth/forgot-password',
        data
      );
      return response.data;
    },
  });
}

export function useResetPassword() {
  return useMutation<
    ResetPasswordResponse,
    AxiosError<ApiError>,
    ResetPasswordRequest
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<ResetPasswordResponse>(
        '/auth/reset-password',
        data
      );
      return response.data;
    },
  });
}
