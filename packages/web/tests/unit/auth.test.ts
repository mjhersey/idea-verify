/**
 * Frontend authentication tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../src/stores/auth.js';
import { authService } from '../../src/services/auth.js';

// Mock axios
vi.mock('../../src/services/api.js', () => ({
  axiosInstance: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    query: {},
    fullPath: '/test'
  })
}));

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(authStore.user).toBeNull();
      expect(authStore.isLoading).toBe(false);
      expect(authStore.error).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });
  });

  describe('Registration', () => {
    it('should handle successful registration', async () => {
      const mockResponse = {
        data: {
          message: 'User registered successfully',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z'
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse);

      await authStore.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123!'
      });

      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.error).toBeNull();
      expect(localStorage.getItem('accessToken')).toBe('access-token');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    });

    it('should handle registration failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Email already exists'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(mockError);

      await expect(authStore.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123!'
      })).rejects.toThrow('Email already exists');

      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBe('Email already exists');
    });
  });

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z'
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse);

      await authStore.login({
        email: 'test@example.com',
        password: 'TestPass123!'
      });

      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.error).toBeNull();
      expect(localStorage.getItem('accessToken')).toBe('access-token');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    });

    it('should handle login failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid credentials'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(mockError);

      await expect(authStore.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials');

      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBe('Invalid credentials');
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Set up authenticated state
      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');
      authStore.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
    });

    it('should handle successful logout', async () => {
      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: {} });

      await authStore.logout();

      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should handle logout even if server call fails', async () => {
      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(new Error('Server error'));

      await authStore.logout();

      // Should still clear local state
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('Token refresh', () => {
    beforeEach(() => {
      localStorage.setItem('refreshToken', 'refresh-token');
    });

    it('should handle successful token refresh', async () => {
      const mockResponse = {
        data: {
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse);

      const result = await authStore.refreshTokens();

      expect(result).toBe(true);
      expect(localStorage.getItem('accessToken')).toBe('new-access-token');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
    });

    it('should handle token refresh failure', async () => {
      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(new Error('Refresh failed'));

      const result = await authStore.refreshTokens();

      expect(result).toBe(false);
      expect(authStore.user).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should return false if no refresh token', async () => {
      localStorage.removeItem('refreshToken');

      const result = await authStore.refreshTokens();

      expect(result).toBe(false);
    });
  });

  describe('Profile operations', () => {
    beforeEach(() => {
      localStorage.setItem('accessToken', 'access-token');
    });

    it('should fetch user profile', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce(mockResponse);

      await authStore.fetchProfile();

      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authStore.error).toBeNull();
    });

    it('should update user profile', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'updated@example.com',
            name: 'Updated Name',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T01:00:00Z'
          }
        }
      };

      const mockAxios = await import('../../src/services/api.js');
      vi.mocked(mockAxios.axiosInstance.put).mockResolvedValueOnce(mockResponse);

      await authStore.updateProfile({
        name: 'Updated Name',
        email: 'updated@example.com'
      });

      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authStore.error).toBeNull();
    });
  });
});

describe('Auth Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Token management', () => {
    it('should store tokens', () => {
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      authService.storeTokens(tokens);

      expect(localStorage.getItem('accessToken')).toBe('access-token');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    });

    it('should get stored tokens', () => {
      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      expect(authService.getAccessToken()).toBe('access-token');
      expect(authService.getRefreshToken()).toBe('refresh-token');
    });

    it('should clear tokens', () => {
      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      authService.clearTokens();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should check if tokens exist', () => {
      expect(authService.hasTokens()).toBe(false);

      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      expect(authService.hasTokens()).toBe(true);
    });
  });
});