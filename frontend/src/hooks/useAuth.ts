import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  telegramId: string;
  name: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Get tokens from localStorage
  const getTokens = useCallback(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return { accessToken, refreshToken };
  }, []);

  // Set tokens in localStorage
  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }, []);

  // Remove tokens from localStorage
  const removeTokens = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // Login function
  const login = useCallback(
    async (telegramId: string, password: string) => {
      try {
        console.log('🔄 Attempting login for:', telegramId);
        console.log('📡 API URL:', api.defaults.baseURL);

        const response = await api.post('/auth/login', { telegramId, password });
        console.log('✅ Login response:', response.data);

        const { accessToken, refreshToken, user } = response.data;

        setTokens(accessToken, refreshToken);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log('🎉 Login successful, auth state updated:', {
          isAuthenticated: true,
          user: user.name,
        });

        return { success: true };
      } catch (error: any) {
        console.error('❌ Login error:', error);
        console.error('❌ Error response:', error.response?.data);
        console.error('❌ Error status:', error.response?.status);
        console.error('❌ Error message:', error.message);

        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Login failed',
        };
      }
    },
    [setTokens]
  );

  // Logout function
  const logout = useCallback(async () => {
    try {
      const { refreshToken } = getTokens();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      removeTokens();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, [getTokens, removeTokens]);

  // Refresh token function
  const refreshAccessToken = useCallback(async () => {
    try {
      const { refreshToken } = getTokens();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      setTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch (error) {
      removeTokens();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw error;
    }
  }, [getTokens, setTokens, removeTokens]);

  // Verify current user - removed unused function

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          setAuthState({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          // If token is invalid, clear it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    logout,
    refreshAccessToken,
  };
}
