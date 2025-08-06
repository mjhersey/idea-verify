/**
 * API Error Handler
 * Centralized error handling for HTTP API endpoints
 */

import { Request, Response, NextFunction } from 'express'
import { ValidationError } from './request-validator.js'
import { HTTP_STATUS, ERROR_CODES, ErrorResponse } from './types.js'

export class APIError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export class ErrorHandler {
  handle(error: Error, req: Request, res: Response, _next: NextFunction): void {
    console.error('[APIError]', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      requestId: res.locals.requestId,
      timestamp: new Date().toISOString(),
    })

    const errorResponse = this.formatErrorResponse(error, res.locals.requestId)

    // Determine status code
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR

    if (error instanceof APIError) {
      statusCode = error.statusCode
    } else if (error instanceof ValidationError) {
      statusCode = HTTP_STATUS.BAD_REQUEST
    }

    res.status(statusCode).json(errorResponse)
  }

  createError(statusCode: number, code: string, message: string, details?: any): APIError {
    return new APIError(statusCode, code, message, details)
  }

  private formatErrorResponse(error: Error, requestId?: string): ErrorResponse {
    let code: string = ERROR_CODES.INTERNAL_ERROR
    let message = 'An internal error occurred'
    let details: any = undefined

    if (error instanceof APIError) {
      code = error.code
      message = error.message
      details = error.details
    } else if (error instanceof ValidationError) {
      code = error.code
      message = error.message
      details = error.field ? { field: error.field } : undefined
    } else if (error.name === 'CastError') {
      // Database casting errors (e.g., invalid ObjectId)
      code = ERROR_CODES.VALIDATION_ERROR
      message = 'Invalid ID format'
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      // Database errors
      code = ERROR_CODES.INTERNAL_ERROR
      message = 'Database operation failed'
    } else if (error.message.includes('timeout')) {
      code = ERROR_CODES.SYSTEM_UNAVAILABLE
      message = 'Request timeout - please try again'
    } else if (error.message.includes('rate limit')) {
      code = ERROR_CODES.RATE_LIMIT_EXCEEDED
      message = 'Rate limit exceeded - please slow down'
    }

    return {
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    }
  }

  // Common error factory methods

  notFound(resource: string, id?: string): APIError {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`

    return this.createError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.EVALUATION_NOT_FOUND, message)
  }

  badRequest(message: string, details?: any): APIError {
    return this.createError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, message, details)
  }

  unauthorized(message: string = 'Authentication required'): APIError {
    return this.createError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INSUFFICIENT_PERMISSIONS, message)
  }

  forbidden(message: string = 'Access denied'): APIError {
    return this.createError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.INSUFFICIENT_PERMISSIONS, message)
  }

  conflict(message: string, details?: any): APIError {
    return this.createError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.EVALUATION_ALREADY_EXISTS,
      message,
      details
    )
  }

  unprocessableEntity(message: string, details?: any): APIError {
    return this.createError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      message,
      details
    )
  }

  internalError(message: string = 'Internal server error', details?: any): APIError {
    return this.createError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      message,
      details
    )
  }

  serviceUnavailable(message: string = 'Service temporarily unavailable'): APIError {
    return this.createError(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.SYSTEM_UNAVAILABLE,
      message
    )
  }

  rateLimitExceeded(message: string = 'Rate limit exceeded'): APIError {
    return this.createError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY, // 429 would be better but not in our constants
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message
    )
  }

  invalidAgentType(agentType: string): APIError {
    return this.createError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.INVALID_AGENT_TYPE,
      `Invalid agent type: ${agentType}`,
      {
        validTypes: [
          'market-research',
          'competitive-analysis',
          'customer-research',
          'technical-feasibility',
          'financial-analysis',
        ],
      }
    )
  }

  evaluationNotFound(id: string): APIError {
    return this.createError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.EVALUATION_NOT_FOUND,
      `Evaluation with ID ${id} not found`
    )
  }

  evaluationAlreadyExists(businessIdeaId: string): APIError {
    return this.createError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.EVALUATION_ALREADY_EXISTS,
      `Evaluation for business idea ${businessIdeaId} already exists`
    )
  }

  // Error handling middleware factory
  static createMiddleware(): (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => void {
    const handler = new ErrorHandler()
    return handler.handle.bind(handler)
  }

  // Async error wrapper for route handlers
  static wrapAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next)
    }
  }

  // Validation error formatter
  static formatValidationErrors(errors: any[]): any {
    const formattedErrors = errors.map(error => ({
      field: error.param || error.path,
      message: error.msg || error.message,
      value: error.value,
    }))

    return {
      type: 'validation',
      errors: formattedErrors,
    }
  }
}
