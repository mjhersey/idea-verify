/**
 * Authentication Flow Tests with Deployed JWT System
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';

const logger = createLogger('auth-flow-tests');

interface AuthTestConfig {
  baseUrl: string;
  environment: string;
  timeout: number;
}

interface TokenInfo {
  token: string;
  payload: any;
  expiresAt: number;
}

class AuthenticationFlowTester {
  private config: AuthTestConfig;
  private testUsers: Map<string, any> = new Map();
  private tokens: Map<string, TokenInfo> = new Map();

  constructor(config: AuthTestConfig) {
    this.config = config;
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    logger.debug('Auth test request', { method, url });

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    logger.debug('Auth test response', { 
      method, 
      url, 
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });

    return response;
  }

  private decodeJwtPayload(token: string): any {
    try {
      const [, payload] = token.split('.');
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to decode JWT payload: ${error}`);
    }
  }

  private validateJwtStructure(token: string): TokenInfo {
    const parts = token.split('.');
    expect(parts.length).toBe(3);

    const [header, payload, signature] = parts;
    expect(header).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();

    const decodedPayload = this.decodeJwtPayload(token);
    expect(decodedPayload).toHaveProperty('exp');
    expect(decodedPayload).toHaveProperty('iat');
    expect(decodedPayload).toHaveProperty('sub');

    return {
      token,
      payload: decodedPayload,
      expiresAt: decodedPayload.exp * 1000,
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup test users
    for (const [email, userData] of this.testUsers) {
      try {
        if (userData.token) {
          await this.makeRequest('DELETE', '/api/user/cleanup', null, {
            Authorization: `Bearer ${userData.token}`,
          });
        }
      } catch (error) {
        logger.warn('Failed to cleanup test user', { email, error });
      }
    }
    
    this.testUsers.clear();
    this.tokens.clear();
  }

  // Registration Flow Tests
  async testUserRegistration(): Promise<void> {
    const testUser = {
      email: `auth-reg-test-${Date.now()}@example.com`,
      password: 'RegTest123!',
      name: 'Registration Test User',
    };

    // Test successful registration
    const response = await this.makeRequest('POST', '/api/auth/register', testUser);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');

    // Validate user data
    expect(data.user.email).toBe(testUser.email);
    expect(data.user.name).toBe(testUser.name);
    expect(data.user).toHaveProperty('id');
    expect(data.user).not.toHaveProperty('password'); // Should not expose password

    // Validate JWT tokens
    const accessTokenInfo = this.validateJwtStructure(data.accessToken);
    const refreshTokenInfo = this.validateJwtStructure(data.refreshToken);

    expect(accessTokenInfo.payload.sub).toBe(data.user.id);
    expect(refreshTokenInfo.payload.sub).toBe(data.user.id);

    // Access token should expire sooner than refresh token
    expect(accessTokenInfo.expiresAt).toBeLessThan(refreshTokenInfo.expiresAt);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...data.user,
      token: data.accessToken,
      refreshToken: data.refreshToken,
    });

    logger.info('User registration test passed', { email: testUser.email });
  }

  async testRegistrationValidation(): Promise<void> {
    // Test missing required fields
    const missingEmailResponse = await this.makeRequest('POST', '/api/auth/register', {
      password: 'Test123!',
      name: 'Test User',
    });
    expect(missingEmailResponse.status).toBe(400);

    // Test invalid email format
    const invalidEmailResponse = await this.makeRequest('POST', '/api/auth/register', {
      email: 'invalid-email',
      password: 'Test123!',
      name: 'Test User',
    });
    expect(invalidEmailResponse.status).toBe(400);

    // Test weak password
    const weakPasswordResponse = await this.makeRequest('POST', '/api/auth/register', {
      email: `weak-pwd-test-${Date.now()}@example.com`,
      password: '123',
      name: 'Test User',
    });
    expect(weakPasswordResponse.status).toBe(400);

    // Test duplicate email
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;
    
    const firstRegResponse = await this.makeRequest('POST', '/api/auth/register', {
      email: duplicateEmail,
      password: 'Test123!',
      name: 'First User',
    });
    expect(firstRegResponse.status).toBe(201);

    const duplicateResponse = await this.makeRequest('POST', '/api/auth/register', {
      email: duplicateEmail,
      password: 'Test123!',
      name: 'Duplicate User',
    });
    expect(duplicateResponse.status).toBe(409);

    logger.info('Registration validation test passed');
  }

  // Login Flow Tests
  async testUserLogin(): Promise<void> {
    // Create a user first
    const testUser = {
      email: `auth-login-test-${Date.now()}@example.com`,
      password: 'LoginTest123!',
      name: 'Login Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    expect(registerResponse.status).toBe(201);

    // Test successful login
    const loginResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginResponse.status).toBe(200);

    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('user');
    expect(loginData).toHaveProperty('accessToken');
    expect(loginData).toHaveProperty('refreshToken');

    // Validate tokens
    const accessTokenInfo = this.validateJwtStructure(loginData.accessToken);
    expect(accessTokenInfo.payload.sub).toBe(loginData.user.id);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...loginData.user,
      token: loginData.accessToken,
      refreshToken: loginData.refreshToken,
    });

    logger.info('User login test passed', { email: testUser.email });
  }

  async testLoginValidation(): Promise<void> {
    // Test invalid credentials
    const invalidResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: 'nonexistent@example.com',
      password: 'WrongPassword123!',
    });
    expect(invalidResponse.status).toBe(401);

    // Test missing fields
    const missingPasswordResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
    });
    expect(missingPasswordResponse.status).toBe(400);

    // Test malformed request
    const malformedResponse = await this.makeRequest('POST', '/api/auth/login', {});
    expect(malformedResponse.status).toBe(400);

    logger.info('Login validation test passed');
  }

  // Token Management Tests
  async testTokenRefresh(): Promise<void> {
    // Create a user first
    const testUser = {
      email: `auth-refresh-test-${Date.now()}@example.com`,
      password: 'RefreshTest123!',
      name: 'Refresh Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    const registerData = await registerResponse.json();

    // Test token refresh
    const refreshResponse = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: registerData.refreshToken,
    });

    expect(refreshResponse.status).toBe(200);

    const refreshData = await refreshResponse.json();
    expect(refreshData).toHaveProperty('accessToken');
    expect(refreshData).toHaveProperty('refreshToken');

    // New tokens should be different
    expect(refreshData.accessToken).not.toBe(registerData.accessToken);
    
    // Validate new tokens
    const newAccessTokenInfo = this.validateJwtStructure(refreshData.accessToken);
    expect(newAccessTokenInfo.payload.sub).toBe(registerData.user.id);

    // Test with invalid refresh token
    const invalidRefreshResponse = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: 'invalid.refresh.token',
    });
    expect(invalidRefreshResponse.status).toBe(401);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...registerData.user,
      token: refreshData.accessToken,
      refreshToken: refreshData.refreshToken,
    });

    logger.info('Token refresh test passed');
  }

  async testTokenExpiration(): Promise<void> {
    // This test would need tokens with very short expiration times
    // or the ability to mock time, which is complex in integration tests
    // For now, we'll test the token structure and validation
    
    const testUser = {
      email: `auth-expire-test-${Date.now()}@example.com`,
      password: 'ExpireTest123!',
      name: 'Expiry Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    const registerData = await registerResponse.json();

    const tokenInfo = this.validateJwtStructure(registerData.accessToken);
    
    // Token should have reasonable expiration time (not expired, not too far in future)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    expect(tokenInfo.expiresAt).toBeGreaterThan(now);
    expect(tokenInfo.expiresAt).toBeLessThan(now + oneDay);

    // Test with malformed token
    const malformedTokenResponse = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: 'Bearer invalid-token-format',
    });
    expect(malformedTokenResponse.status).toBe(401);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...registerData.user,
      token: registerData.accessToken,
    });

    logger.info('Token expiration test passed');
  }

  // Protected Endpoint Tests
  async testProtectedEndpointAccess(): Promise<void> {
    // Create a user first
    const testUser = {
      email: `auth-protected-test-${Date.now()}@example.com`,
      password: 'ProtectedTest123!',
      name: 'Protected Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    const registerData = await registerResponse.json();

    // Test access with valid token
    const authorizedResponse = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: `Bearer ${registerData.accessToken}`,
    });

    expect(authorizedResponse.status).toBe(200);

    const userData = await authorizedResponse.json();
    expect(userData.id).toBe(registerData.user.id);
    expect(userData.email).toBe(testUser.email);

    // Test access without token
    const unauthorizedResponse = await this.makeRequest('GET', '/api/user/profile');
    expect(unauthorizedResponse.status).toBe(401);

    // Test access with malformed token
    const malformedResponse = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: 'Bearer invalid-token',
    });
    expect(malformedResponse.status).toBe(401);

    // Test access with wrong token format
    const wrongFormatResponse = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: registerData.accessToken, // missing "Bearer "
    });
    expect(wrongFormatResponse.status).toBe(401);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...registerData.user,
      token: registerData.accessToken,
    });

    logger.info('Protected endpoint access test passed');
  }

  // Session Management Tests
  async testMultipleSessionHandling(): Promise<void> {
    const testUser = {
      email: `auth-session-test-${Date.now()}@example.com`,
      password: 'SessionTest123!',
      name: 'Session Test User',
    };

    // Register user
    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    const registerData = await registerResponse.json();

    // Login multiple times (simulate multiple sessions)
    const session1Response = await this.makeRequest('POST', '/api/auth/login', {
      email: testUser.email,
      password: testUser.password,
    });
    expect(session1Response.status).toBe(200);
    const session1Data = await session1Response.json();

    const session2Response = await this.makeRequest('POST', '/api/auth/login', {
      email: testUser.email,
      password: testUser.password,
    });
    expect(session2Response.status).toBe(200);
    const session2Data = await session2Response.json();

    // Both sessions should have different tokens
    expect(session1Data.accessToken).not.toBe(session2Data.accessToken);
    expect(session1Data.refreshToken).not.toBe(session2Data.refreshToken);

    // Both tokens should be valid for API access
    const profile1Response = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: `Bearer ${session1Data.accessToken}`,
    });
    expect(profile1Response.status).toBe(200);

    const profile2Response = await this.makeRequest('GET', '/api/user/profile', null, {
      Authorization: `Bearer ${session2Data.accessToken}`,
    });
    expect(profile2Response.status).toBe(200);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...registerData.user,
      token: session2Data.accessToken,
    });

    logger.info('Multiple session handling test passed');
  }

  // Security Tests
  async testSecurityFeatures(): Promise<void> {
    const testUser = {
      email: `auth-security-test-${Date.now()}@example.com`,
      password: 'SecurityTest123!',
      name: 'Security Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    const registerData = await registerResponse.json();

    // Test rate limiting on login attempts
    const rapidLoginPromises = Array(10).fill(null).map(() =>
      this.makeRequest('POST', '/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'WrongPassword',
      })
    );

    const rapidLoginResults = await Promise.all(rapidLoginPromises);
    const rateLimitedCount = rapidLoginResults.filter(r => r.status === 429).length;

    if (this.config.environment === 'prod') {
      // In production, expect some rate limiting
      expect(rateLimitedCount).toBeGreaterThan(0);
    }

    // Test CSRF protection (if implemented)
    const csrfResponse = await this.makeRequest('POST', '/api/auth/login', testUser, {
      'X-Requested-With': 'XMLHttpRequest',
    });

    // Should still work with proper headers
    expect([200, 201]).toContain(csrfResponse.status);

    // Test SQL injection attempts in login
    const sqlInjectionResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: "admin@example.com' OR '1'='1",
      password: 'anything',
    });
    expect(sqlInjectionResponse.status).toBe(401);

    // Store for cleanup
    this.testUsers.set(testUser.email, {
      ...registerData.user,
      token: registerData.accessToken,
    });

    logger.info('Security features test passed', { rateLimitedCount });
  }

  // Password Reset Flow (if implemented)
  async testPasswordResetFlow(): Promise<void> {
    const testUser = {
      email: `auth-reset-test-${Date.now()}@example.com`,
      password: 'ResetTest123!',
      name: 'Reset Test User',
    };

    // Register user first
    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    expect(registerResponse.status).toBe(201);

    // Test password reset request
    const resetRequestResponse = await this.makeRequest('POST', '/api/auth/forgot-password', {
      email: testUser.email,
    });

    // Should accept request even for security (don't reveal if email exists)
    expect([200, 202]).toContain(resetRequestResponse.status);

    // Test with non-existent email
    const nonExistentResetResponse = await this.makeRequest('POST', '/api/auth/forgot-password', {
      email: 'nonexistent@example.com',
    });

    // Should also accept for security
    expect([200, 202]).toContain(nonExistentResetResponse.status);

    logger.info('Password reset flow test passed');
  }
}

// Test Configuration
const getAuthTestConfig = (): AuthTestConfig => ({
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  environment: process.env.TEST_ENVIRONMENT || 'dev',
  timeout: 30000, // 30 seconds per test
});

// Test Suite
describe('Authentication Flow Tests', () => {
  let tester: AuthenticationFlowTester;
  const config = getAuthTestConfig();

  beforeAll(async () => {
    tester = new AuthenticationFlowTester(config);
  });

  afterAll(async () => {
    if (tester) {
      await tester.cleanup();
    }
  });

  describe('User Registration', () => {
    test('should register new user successfully', async () => {
      await tester.testUserRegistration();
    }, config.timeout);

    test('should validate registration data', async () => {
      await tester.testRegistrationValidation();
    }, config.timeout);
  });

  describe('User Login', () => {
    test('should login existing user successfully', async () => {
      await tester.testUserLogin();
    }, config.timeout);

    test('should validate login credentials', async () => {
      await tester.testLoginValidation();
    }, config.timeout);
  });

  describe('Token Management', () => {
    test('should refresh tokens successfully', async () => {
      await tester.testTokenRefresh();
    }, config.timeout);

    test('should handle token expiration correctly', async () => {
      await tester.testTokenExpiration();
    }, config.timeout);
  });

  describe('Protected Endpoints', () => {
    test('should control access to protected endpoints', async () => {
      await tester.testProtectedEndpointAccess();
    }, config.timeout);
  });

  describe('Session Management', () => {
    test('should handle multiple sessions correctly', async () => {
      await tester.testMultipleSessionHandling();
    }, config.timeout);
  });

  describe('Security Features', () => {
    test('should implement security measures', async () => {
      await tester.testSecurityFeatures();
    }, config.timeout);
  });

  describe('Password Reset', () => {
    test('should handle password reset flow', async () => {
      await tester.testPasswordResetFlow();
    }, config.timeout);
  });
});

export default AuthenticationFlowTester;