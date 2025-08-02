/**
 * Unit tests for AuthService
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { AuthService } from '../../src/services/authService.js';

// Mock environment variables
vi.mock('@ai-validation/shared', () => ({
  getEnvironmentConfig: vi.fn(() => ({
    nodeEnv: 'test',
    port: 3000,
    aws: {
      region: 'us-east-1'
    }
  }))
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeAll(() => {
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    authService = new AuthService();
  });

  afterAll(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  describe('Password hashing and verification', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]?\$\d+\$/); // bcrypt hash format
    });

    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Token generation', () => {
    const mockPayload = {
      userId: 'user-123',
      email: 'test@example.com'
    };

    it('should generate access token', () => {
      const token = authService.generateAccessToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should generate refresh token', () => {
      const token = authService.generateRefreshToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should generate token pair', () => {
      const tokens = authService.generateTokenPair(mockPayload);
      
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('Token verification', () => {
    const mockPayload = {
      userId: 'user-123',
      email: 'test@example.com'
    };

    it('should verify valid access token', () => {
      const token = authService.generateAccessToken(mockPayload);
      const decoded = authService.verifyAccessToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should verify valid refresh token', () => {
      const token = authService.generateRefreshToken(mockPayload);
      const decoded = authService.verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.tokenId).toBeDefined();
    });

    it('should reject invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid token');
    });

    it('should reject blacklisted token', () => {
      const token = authService.generateAccessToken(mockPayload);
      authService.blacklistToken(token);
      
      expect(() => {
        authService.verifyAccessToken(token);
      }).toThrow('Token has been blacklisted');
    });
  });

  describe('Token refresh', () => {
    const mockPayload = {
      userId: 'user-123',
      email: 'test@example.com'
    };

    it('should refresh access token with valid refresh token', () => {
      const refreshToken = authService.generateRefreshToken(mockPayload);
      const newTokens = authService.refreshAccessToken(refreshToken);
      
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(refreshToken);
      expect(newTokens.refreshToken).not.toBe(refreshToken);
    });

    it('should blacklist old refresh token when refreshing', () => {
      const refreshToken = authService.generateRefreshToken(mockPayload);
      authService.refreshAccessToken(refreshToken);
      
      expect(authService.isTokenBlacklisted(refreshToken)).toBe(true);
    });

    it('should reject blacklisted refresh token', () => {
      const refreshToken = authService.generateRefreshToken(mockPayload);
      authService.blacklistToken(refreshToken);
      
      expect(() => {
        authService.refreshAccessToken(refreshToken);
      }).toThrow('Failed to refresh token');
    });
  });

  describe('Token extraction', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'abc123';
      const header = `Bearer ${token}`;
      const extracted = authService.extractTokenFromHeader(header);
      
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(authService.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(authService.extractTokenFromHeader('Bearer')).toBeNull();
      expect(authService.extractTokenFromHeader('')).toBeNull();
      expect(authService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('Password strength validation', () => {
    it('should validate strong password', () => {
      const result = authService.validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const testCases = [
        { password: 'short', expectedErrors: 4 }, // too short, no uppercase, no number, no special
        { password: 'nouppercase123!', expectedErrors: 1 }, // no uppercase
        { password: 'NOLOWERCASE123!', expectedErrors: 1 }, // no lowercase
        { password: 'NoNumbers!', expectedErrors: 1 }, // no numbers
        { password: 'NoSpecialChars123', expectedErrors: 1 }, // no special chars
      ];

      testCases.forEach(({ password, expectedErrors }) => {
        const result = authService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(expectedErrors);
      });
    });
  });

  describe('Token blacklist management', () => {
    it('should add token to blacklist', () => {
      const token = 'test-token';
      authService.blacklistToken(token);
      
      expect(authService.isTokenBlacklisted(token)).toBe(true);
    });

    it('should check if token is blacklisted', () => {
      const token = 'test-token';
      
      expect(authService.isTokenBlacklisted(token)).toBe(false);
      
      authService.blacklistToken(token);
      expect(authService.isTokenBlacklisted(token)).toBe(true);
    });
  });
});