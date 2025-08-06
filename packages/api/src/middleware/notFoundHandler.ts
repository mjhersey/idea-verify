import { Request, Response, NextFunction } from 'express'

// eslint-disable-next-line no-unused-vars
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  })
}
