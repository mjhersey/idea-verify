/**
 * Business idea submission routes
 */

import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { authenticateToken } from '../middleware/authMiddleware.js'
import { businessIdeaService } from '../services/businessIdeaService.js'

const router = Router()

// Rate limiting for idea submissions (10 requests/minute per user)
const ideaSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per IP per minute
  message: {
    error: 'Too many idea submissions, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Validation rules for idea submission
const ideaValidation = [
  body('title')
    .optional()
    .isLength({ min: 5, max: 100 })
    .trim()
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .isLength({ min: 50, max: 5000 })
    .trim()
    .withMessage('Description must be between 50 and 5000 characters')
    .custom((description: string) => {
      // Basic content validation
      if (!description || description.trim().length === 0) {
        throw new Error('Description cannot be empty')
      }
      return true
    }),
]

/**
 * POST /api/ideas
 * Submit a new business idea
 */
router.post(
  '/',
  ideaSubmissionLimiter,
  authenticateToken,
  ideaValidation,
  async (req: Request, res: Response) => {
    try {
      // Check validation results
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        })
      }

      if (!req.user) {
        return res.status(401).json({
          error: 'User context not found',
          code: 'USER_CONTEXT_MISSING',
        })
      }

      const { title, description } = req.body

      // Create business idea
      const businessIdea = await businessIdeaService.createIdea({
        userId: req.user.id,
        title,
        description,
      })

      // Log successful submission
      console.log(`Business idea submitted: ID ${businessIdea.id} by user ${req.user.id}`)

      // Return success response
      res.status(201).json({
        message: 'Business idea submitted successfully',
        data: {
          id: businessIdea.id,
          title: businessIdea.title,
          description: businessIdea.description,
          status: businessIdea.status,
          created_at: businessIdea.created_at,
          submission_metadata: {
            user_id: businessIdea.user_id,
            next_steps: 'Your idea will be evaluated by our system',
            estimated_processing_time: '24-48 hours',
          },
        },
      })
    } catch (error) {
      console.error('Idea submission error:', error)

      // Handle specific service errors
      if (error instanceof Error && error.message.includes('sanitization')) {
        return res.status(400).json({
          error: 'Invalid content detected',
          code: 'CONTENT_VALIDATION_FAILED',
        })
      }

      // Don't expose internal errors
      res.status(500).json({
        error: 'Idea submission failed due to server error',
        code: 'INTERNAL_SERVER_ERROR',
      })
    }
  }
)

export default router
