/**
 * Authentication middleware for protecting routes with JWT token validation
 */

import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/authService.js'
import { UserRepository } from '../repositories/user-repository.js'

// Extend Express Request type to include user data
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
      email: string
      name: string
    }
  }
}

const userRepository = new UserRepository()

/**
 * Middleware to authenticate JWT tokens and inject user context
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization
    const token = authService.extractTokenFromHeader(authHeader)

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      })
      return
    }

    // Verify token
    const tokenPayload = authService.verifyAccessToken(token)

    // Fetch user from database to ensure they still exist
    const user = await userRepository.findById(tokenPayload.userId)
    if (!user) {
      res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      })
      return
    }

    // Inject user context into request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    }

    next()
  } catch (error) {
    console.error('Authentication error:', error)

    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(401).json({
          error: 'Access token expired',
          code: 'TOKEN_EXPIRED',
        })
        return
      }

      if (error.message.includes('blacklisted')) {
        res.status(401).json({
          error: 'Token is no longer valid',
          code: 'TOKEN_BLACKLISTED',
        })
        return
      }

      if (error.message.includes('Invalid token')) {
        res.status(401).json({
          error: 'Invalid access token',
          code: 'INVALID_TOKEN',
        })
        return
      }
    }

    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
    })
  }
}

/**
 * Optional authentication middleware - sets user context if token is valid,
 * but doesn't block request if token is missing or invalid
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authService.extractTokenFromHeader(authHeader)

    if (token) {
      try {
        const tokenPayload = authService.verifyAccessToken(token)
        const user = await userRepository.findById(tokenPayload.userId)

        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        }
      } catch (error) {
        // Ignore authentication errors in optional auth
        console.log(
          'Optional auth failed (ignoring):',
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    next()
  } catch (error) {
    // Continue without authentication in case of any errors
    console.error('Optional auth error (continuing):', error)
    next()
  }
}

/**
 * Role-based access control middleware (framework for future use)
 */
export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        })
        return
      }

      // For now, all authenticated users have basic role
      // In the future, this could check user roles from database
      const userRole = 'user' // Default role for all users

      if (!roles.includes(userRole)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        })
        return
      }

      next()
    } catch (error) {
      console.error('Role check error:', error)
      res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
      })
    }
  }
}

/**
 * Middleware to logout user by blacklisting their current token
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authService.extractTokenFromHeader(authHeader)

    if (token) {
      // Blacklist the current access token
      authService.blacklistToken(token)
    }

    // Also blacklist refresh token if provided
    const { refreshToken } = req.body
    if (refreshToken) {
      authService.blacklistToken(refreshToken)
    }

    res.json({
      message: 'Logout successful',
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_FAILED',
    })
  }
}
