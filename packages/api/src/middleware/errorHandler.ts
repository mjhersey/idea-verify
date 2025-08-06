import { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  status?: string
}

export const errorHandler = (err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  const error = { ...err }
  error.message = err.message

  // Log error
  console.error(err)

  // Default error
  if (!error.statusCode) {
    error.statusCode = 500
    error.message = 'Internal Server Error'
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal Server Error',
  })
}
