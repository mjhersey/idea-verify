/**
 * Authentication routes for user registration, login, and profile management
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/authService.js';
import { UserRepository } from '../repositories/user-repository.js';
import { authenticateToken, logout } from '../middleware/authMiddleware.js';

const router = Router();
const userRepository = new UserRepository();

// Rate limiting configurations
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per IP per window
  message: {
    error: 'Too many registration attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 5, // 5 login attempts per IP per window
  message: {
    error: 'Too many login attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per IP per minute for other auth endpoints
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const registrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((password: string) => {
      const validation = authService.validatePasswordStrength(password);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
  body('name')
    .isLength({ min: 2, max: 50 })
    .trim()
    .withMessage('Name must be between 2 and 50 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', registrationLimiter, registrationValidation, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password, name } = req.body;

    // Check if email is already taken
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email address is already registered',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const user = await userRepository.create({
      email,
      password_hash: passwordHash,
      name
    });

    // Generate tokens
    const tokens = authService.generateTokenPair({
      userId: user.id,
      email: user.email
    });

    // Log registration attempt for security monitoring
    console.log(`User registration successful: ${user.email} (ID: ${user.id})`);

    // Return success response with user info (no sensitive data)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      },
      tokens
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Don't expose internal errors
    res.status(500).json({
      error: 'Registration failed due to server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', loginLimiter, loginValidation, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Log failed login attempt
      console.log(`Failed login attempt - user not found: ${email} from IP: ${req.ip}`);
      
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isPasswordValid = await authService.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed login attempt
      console.log(`Failed login attempt - invalid password: ${email} from IP: ${req.ip}`);
      
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
    const tokens = authService.generateTokenPair({
      userId: user.id,
      email: user.email
    });

    // Log successful login for security monitoring
    console.log(`User login successful: ${user.email} (ID: ${user.id}) from IP: ${req.ip}`);

    // Return success response with user profile and tokens
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      tokens
    });

  } catch (error) {
    console.error('Login error:', error);
    
    res.status(500).json({
      error: 'Login failed due to server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', generalLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Refresh tokens
    const newTokens = authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Tokens refreshed successfully',
      tokens: newTokens
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error instanceof Error && error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    if (error instanceof Error && error.message.includes('blacklisted')) {
      return res.status(401).json({
        error: 'Refresh token is no longer valid',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    res.status(401).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (protected route)
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'User context not found',
        code: 'USER_CONTEXT_MISSING'
      });
    }

    // Fetch full user data from database
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Return user profile (excluding sensitive information)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      code: 'PROFILE_FETCH_FAILED'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user profile (protected route)
 */
router.put('/profile', authenticateToken, [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .trim()
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'User context not found',
        code: 'USER_CONTEXT_MISSING'
      });
    }

    const { name, email } = req.body;
    const updateData: Record<string, string> = {};

    // Only update provided fields
    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      // Check if new email is already taken by another user
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({
          error: 'Email address is already taken',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
      updateData.email = email;
    }

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided for update',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    // Update user
    const updatedUser = await userRepository.update(req.user.id, updateData);

    // Log profile update
    console.log(`User profile updated: ${updatedUser.email} (ID: ${updatedUser.id})`);

    // Return updated profile
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and blacklist tokens
 */
router.post('/logout', generalLimiter, logout);

export default router;