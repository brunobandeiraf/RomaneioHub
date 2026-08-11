'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  apiClient,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate auth state from stored tokens on mount
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      // Try to decode user info from JWT payload
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Supabase puts custom claims inside app_metadata
        const meta = payload.app_metadata || {};
        setUser({
          id: payload.sub || '',
          email: payload.email || '',
          name: payload.user_metadata?.name || payload.name || '',
          role: meta.tenantRole || meta.globalRole || payload.globalRole || '',
        });
      } catch {
        // Invalid token — clear and redirect
        clearTokens();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (accessToken: string, refreshToken: string, userData: AuthUser) => {
      setTokens(accessToken, refreshToken);
      setUser(userData);
    },
    []
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  // Set up token refresh interceptor
  useEffect(() => {
    const interceptorId = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          getRefreshToken()
        ) {
          originalRequest._retry = true;

          try {
            const refreshToken = getRefreshToken();
            const response = await apiClient.post('/auth/refresh', {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } =
              response.data;
            setTokens(accessToken, newRefreshToken || refreshToken!);

            // Update the auth header and retry
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          } catch {
            // Refresh failed — force logout
            clearTokens();
            setUser(null);
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }
        }

        // Not a 401 or refresh already tried
        if (error.response?.status === 401) {
          clearTokens();
          setUser(null);
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptorId);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
