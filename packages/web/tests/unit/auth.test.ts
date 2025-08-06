/**
 * Frontend authentication tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/auth.js'
import { authService } from '../../src/services/auth.js'

// Mock axios
vi.mock('../../src/services/api.js', () => ({
  axiosInstance: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}))

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useRoute: () => ({
    query: {},
    fullPath: '/test',
  }),
}))

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(authStore.user).toBeNull()
      expect(authStore.isLoading).toBe(false)
      expect(authStore.error).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
    })
  })

  describe('Registration', () => {
    it('should handle successful registration', async () => {
      const mockResponse = {
        data: {
          message: 'User registered successfully',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse)
      // Mock the storeTokens API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authStore.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(authStore.user).toEqual(mockResponse.data.user)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.error).toBeNull()
      // Tokens are stored server-side, not in localStorage
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/store-tokens', {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })
    })

    it('should handle registration failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Email already exists',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(mockError)

      await expect(
        authStore.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'TestPass123!',
        })
      ).rejects.toThrow('Email already exists')

      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.error).toBe('Email already exists')
    })
  })

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse)
      // Mock the storeTokens API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authStore.login({
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(authStore.user).toEqual(mockResponse.data.user)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.error).toBeNull()
      // Tokens are stored server-side, not in localStorage
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/store-tokens', {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })
    })

    it('should handle login failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid credentials',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(mockError)

      await expect(
        authStore.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials')

      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.error).toBe('Invalid credentials')
    })
  })

  describe('Logout', () => {
    beforeEach(async () => {
      // Set up authenticated state
      authStore.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }
    })

    it('should handle successful logout', async () => {
      const mockAxios = await import('../../src/services/api.js')
      // Mock getRefreshToken API call
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })
      // Mock logout API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: {} })
      // Mock clearTokens API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authStore.logout()

      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.error).toBeNull()
      // Verify clearTokens API was called
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/clear-tokens')
    })

    it('should handle logout even if server call fails', async () => {
      const mockAxios = await import('../../src/services/api.js')
      // Mock getRefreshToken API call
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })
      // Mock logout API call to fail
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(new Error('Server error'))
      // Mock clearTokens API call (should still be called)
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authStore.logout()

      // Should still clear local state
      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      // Verify clearTokens API was still called
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/clear-tokens')
    })
  })

  describe('Token refresh', () => {
    beforeEach(() => {
      // Setup will be done in individual tests with proper API mocking
    })

    it('should handle successful token refresh', async () => {
      const mockResponse = {
        data: {
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      // Mock getRefreshToken API call
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })
      // Mock refresh token API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce(mockResponse)
      // Mock storeTokens API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      const result = await authStore.refreshTokens()

      expect(result).toBe(true)
      // Verify storeTokens API was called with new tokens
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/store-tokens', {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
    })

    it('should handle token refresh failure', async () => {
      const mockAxios = await import('../../src/services/api.js')
      // Mock getRefreshToken API call
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })
      // Mock refresh token API call to fail
      vi.mocked(mockAxios.axiosInstance.post).mockRejectedValueOnce(new Error('Refresh failed'))
      // Mock getRefreshToken call in logout
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })
      // Mock logout API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: {} })
      // Mock clearTokens API call
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      const result = await authStore.refreshTokens()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      // Verify clearTokens API was called during logout
      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/clear-tokens')
    })

    it('should return false if no refresh token', async () => {
      const mockAxios = await import('../../src/services/api.js')
      // Mock getRefreshToken API call to return null
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: null },
      })

      const result = await authStore.refreshTokens()

      expect(result).toBe(false)
    })
  })

  describe('Profile operations', () => {
    beforeEach(() => {
      localStorage.setItem('accessToken', 'access-token')
    })

    it('should fetch user profile', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce(mockResponse)

      await authStore.fetchProfile()

      expect(authStore.user).toEqual(mockResponse.data.user)
      expect(authStore.error).toBeNull()
    })

    it('should update user profile', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'updated@example.com',
            name: 'Updated Name',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T01:00:00Z',
          },
        },
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.put).mockResolvedValueOnce(mockResponse)

      await authStore.updateProfile({
        name: 'Updated Name',
        email: 'updated@example.com',
      })

      expect(authStore.user).toEqual(mockResponse.data.user)
      expect(authStore.error).toBeNull()
    })
  })
})

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Token management', () => {
    it('should store tokens via API', async () => {
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }

      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authService.storeTokens(tokens)

      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/store-tokens', {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })
    })

    it('should get stored access token via API', async () => {
      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { accessToken: 'access-token' },
      })

      const token = await authService.getAccessToken()

      expect(token).toBe('access-token')
      expect(mockAxios.axiosInstance.get).toHaveBeenCalledWith('/api/auth/access-token')
    })

    it('should get stored refresh token via API', async () => {
      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })

      const token = await authService.getRefreshToken()

      expect(token).toBe('refresh-token')
      expect(mockAxios.axiosInstance.get).toHaveBeenCalledWith('/api/auth/refresh-token')
    })

    it('should clear tokens via API', async () => {
      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.post).mockResolvedValueOnce({ data: { success: true } })

      await authService.clearTokens()

      expect(mockAxios.axiosInstance.post).toHaveBeenCalledWith('/api/auth/clear-tokens')
    })

    it('should check if tokens exist via API', async () => {
      const mockAxios = await import('../../src/services/api.js')

      // First call returns no tokens
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { accessToken: null },
      })
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: null },
      })

      let hasTokens = await authService.hasTokens()
      expect(hasTokens).toBe(false)

      // Second call returns tokens
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { accessToken: 'access-token' },
      })
      vi.mocked(mockAxios.axiosInstance.get).mockResolvedValueOnce({
        data: { refreshToken: 'refresh-token' },
      })

      hasTokens = await authService.hasTokens()
      expect(hasTokens).toBe(true)
    })

    it('should return null when API calls fail', async () => {
      const mockAxios = await import('../../src/services/api.js')
      vi.mocked(mockAxios.axiosInstance.get).mockRejectedValueOnce(new Error('API Error'))

      const token = await authService.getAccessToken()
      expect(token).toBeNull()
    })
  })
})
