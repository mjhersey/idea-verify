/**
 * Pinia store for authentication state management
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService, type User, type RegistrationData, type LoginData, type ProfileUpdateData } from '../services/auth.js';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const hasTokens = ref(false);

  // Actions
  const register = async (data: RegistrationData): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.register(data);
      
      // Store tokens
      await authService.storeTokens(response.tokens);
      
      // Set auth header
      authService.setAuthHeader(response.tokens.accessToken);
      
      // Set user
      user.value = response.user;
      hasTokens.value = true;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const login = async (data: LoginData): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.login(data);
      
      // Store tokens
      await authService.storeTokens(response.tokens);
      
      // Set auth header
      authService.setAuthHeader(response.tokens.accessToken);
      
      // Set user
      user.value = response.user;
      hasTokens.value = true;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const logout = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const refreshToken = await authService.getRefreshToken();
      
      // Call logout endpoint
      await authService.logout(refreshToken || undefined);
      
    } catch (err: unknown) {
      // Don't throw logout errors, just log them
      const errorMessage = err instanceof Error ? err.message : 'Logout error';
      // eslint-disable-next-line no-console
      console.warn('Logout error:', errorMessage);
    } finally {
      // Clear local state regardless of server response
      await authService.clearTokens();
      authService.clearAuthHeader();
      user.value = null;
      error.value = null;
      isLoading.value = false;
      hasTokens.value = false;
    }
  };

  const refreshTokens = async (): Promise<boolean> => {
    const refreshToken = await authService.getRefreshToken();
    
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await authService.refreshToken(refreshToken);
      
      // Store new tokens
      await authService.storeTokens(response.tokens);
      
      // Set new auth header
      authService.setAuthHeader(response.tokens.accessToken);
      
      return true;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Token refresh failed';
      // eslint-disable-next-line no-console
      console.error('Token refresh failed:', errorMessage);
      
      // If refresh fails, logout user
      await logout();
      
      return false;
    }
  };

  const fetchProfile = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.getProfile();
      user.value = response.user;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Profile fetch failed';
      error.value = errorMessage;
      
      // If profile fetch fails due to auth, try refreshing token
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        const refreshSuccess = await refreshTokens();
        
        if (refreshSuccess) {
          // Retry profile fetch
          try {
            const retryResponse = await authService.getProfile();
            user.value = retryResponse.user;
            error.value = null;
          } catch (retryErr: unknown) {
            const retryErrorMessage = retryErr instanceof Error ? retryErr.message : 'Profile retry failed';
            error.value = retryErrorMessage;
            throw retryErr;
          }
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    } finally {
      isLoading.value = false;
    }
  };

  const updateProfile = async (data: ProfileUpdateData): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.updateProfile(data);
      user.value = response.user;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Profile update failed';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const initializeAuth = async (): Promise<void> => {
    const hasValidTokens = await authService.hasTokens();
    if (!hasValidTokens) {
      hasTokens.value = false;
      return;
    }

    hasTokens.value = true;
    const accessToken = await authService.getAccessToken();
    if (accessToken) {
      authService.setAuthHeader(accessToken);
      
      try {
        await fetchProfile();
      } catch (err) {
        // If profile fetch fails, try refreshing token
        const refreshSuccess = await refreshTokens();
        
        if (refreshSuccess) {
          try {
            await fetchProfile();
          } catch (retryErr) {
            // If still fails after refresh, logout
            await logout();
          }
        } else {
          await logout();
        }
      }
    }
  };

  const clearError = (): void => {
    error.value = null;
  };

  return {
    // State
    user,
    isLoading,
    error,
    
    // Getters
    isAuthenticated,
    hasTokens,
    
    // Actions
    register,
    login,
    logout,
    refreshTokens,
    fetchProfile,
    updateProfile,
    initializeAuth,
    clearError
  };
});