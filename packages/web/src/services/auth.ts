/**
 * Authentication service for frontend API interactions
 */

import { axiosInstance } from './api.js';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  tokens: TokenPair;
}

export interface RegistrationData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ProfileUpdateData {
  name?: string;
  email?: string;
}

export class AuthService {
  private baseUrl = '/api/auth';

  /**
   * Register a new user account
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post(`${this.baseUrl}/register`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Registration failed');
    }
  }

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post(`${this.baseUrl}/login`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ tokens: TokenPair }> {
    try {
      const response = await axiosInstance.post(`${this.baseUrl}/refresh`, {
        refreshToken
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Token refresh failed');
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<{ user: User }> {
    try {
      const response = await axiosInstance.get(`${this.baseUrl}/profile`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Failed to fetch profile');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: ProfileUpdateData): Promise<{ user: User }> {
    try {
      const response = await axiosInstance.put(`${this.baseUrl}/profile`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Failed to update profile');
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken?: string): Promise<void> {
    try {
      await axiosInstance.post(`${this.baseUrl}/logout`, {
        refreshToken
      });
    } catch (error: unknown) {
      // Log error but don't throw - logout should succeed even if server call fails
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      // eslint-disable-next-line no-console
      console.warn('Logout server call failed:', err.response?.data?.error || err.message);
    }
  }

  /**
   * Store tokens in localStorage
   */
  storeTokens(tokens: TokenPair): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * Check if user has valid tokens
   */
  hasTokens(): boolean {
    return !!(this.getAccessToken() && this.getRefreshToken());
  }

  /**
   * Set authorization header for axios requests
   */
  setAuthHeader(token: string): void {
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authorization header
   */
  clearAuthHeader(): void {
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
}

// Export singleton instance
export const authService = new AuthService();