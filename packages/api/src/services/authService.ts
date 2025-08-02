/**
 * Authentication service for JWT token generation and validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getEnvironmentConfig } from '@ai-validation/shared';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenData extends TokenPayload {
  tokenId: string;
}

export class AuthService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string = '15m';
  private refreshTokenExpiry: string = '7d';
  private saltRounds: number = 12;
  
  // In-memory blacklist for demo - in production use Redis or database
  private tokenBlacklist: Set<string> = new Set();

  constructor() {
    getEnvironmentConfig(); // Initialize environment config
    // In production, these should come from environment/secrets manager
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Failed to verify password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: TokenPayload): string {
    try {
      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'ai-validation-platform',
        audience: 'ai-validation-users'
      });
    } catch (error) {
      throw new Error(`Failed to generate access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate refresh token with unique token ID
   */
  generateRefreshToken(payload: TokenPayload): string {
    try {
      const refreshPayload: RefreshTokenData = {
        ...payload,
        tokenId: this.generateTokenId()
      };
      
      return jwt.sign(refreshPayload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'ai-validation-platform',
        audience: 'ai-validation-users'
      });
    } catch (error) {
      throw new Error(`Failed to generate refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      if (this.tokenBlacklist.has(token)) {
        throw new Error('Token has been blacklisted');
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'ai-validation-platform',
        audience: 'ai-validation-users'
      }) as TokenPayload;

      return {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.NotBeforeError) {
        throw new Error('Token not active');
      }
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenData {
    try {
      if (this.tokenBlacklist.has(token)) {
        throw new Error('Refresh token has been blacklisted');
      }

      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'ai-validation-platform',
        audience: 'ai-validation-users'
      }) as RefreshTokenData;

      return {
        userId: decoded.userId,
        email: decoded.email,
        tokenId: decoded.tokenId
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.NotBeforeError) {
        throw new Error('Refresh token not active');
      }
      throw new Error(`Refresh token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): TokenPair {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Blacklist the old refresh token for security
      this.blacklistToken(refreshToken);
      
      // Generate new token pair
      const payload: TokenPayload = {
        userId: decoded.userId,
        email: decoded.email
      };
      
      return this.generateTokenPair(payload);
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Blacklist a token (for logout)
   */
  blacklistToken(token: string): void {
    this.tokenBlacklist.add(token);
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const parts = authorizationHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique token ID for refresh tokens
   */
  private generateTokenId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  }
}

// Export singleton instance
export const authService = new AuthService();