/**
 * CORS Middleware Configuration
 */

import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

interface CorsConfig {
  environment: string;
  domainName?: string;
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(config: CorsConfig): string[] {
  const { environment, domainName } = config;
  
  const origins: string[] = [];

  // Development origins
  if (environment === 'development' || environment === 'dev') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }

  // Production/staging origins
  if (domainName) {
    if (environment === 'production' || environment === 'prod') {
      origins.push(
        `https://${domainName}`,
        `https://www.${domainName}`,
        `https://api.${domainName}`
      );
    } else {
      // Staging or other environments
      origins.push(
        `https://${environment}.${domainName}`,
        `https://www.${environment}.${domainName}`,
        `https://api.${environment}.${domainName}`
      );
    }
  }

  // Allow localhost in non-production for testing
  if (environment !== 'production' && environment !== 'prod') {
    origins.push('http://localhost:8080');
  }

  return origins;
}

/**
 * Create CORS middleware with environment-specific configuration
 */
export function createCorsMiddleware(config?: CorsConfig) {
  const environment = config?.environment || process.env.NODE_ENV || 'development';
  const domainName = config?.domainName || process.env.DOMAIN_NAME;

  const allowedOrigins = getAllowedOrigins({ environment, domainName });

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, log the rejected origin
      if (environment === 'development' || environment === 'dev') {
        console.warn(`CORS: Rejected origin: ${origin}`);
        console.warn('Allowed origins:', allowedOrigins);
      }

      // Reject the origin
      callback(new Error('Not allowed by CORS'));
    },
    
    credentials: true, // Allow cookies to be sent
    
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-Id',
      'X-Session-Id',
      'X-User-Id',
    ],
    
    exposedHeaders: [
      'X-Correlation-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    
    maxAge: 86400, // 24 hours
    
    preflightContinue: false,
    
    optionsSuccessStatus: 204,
  };

  return cors(corsOptions);
}

/**
 * CORS error handler middleware
 */
export function corsErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed',
      origin: req.get('origin'),
    });
  } else {
    next(err);
  }
}

/**
 * Additional security headers middleware
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Strict Transport Security
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Preflight request handler for complex CORS scenarios
 */
export function preflightHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'OPTIONS') {
    // Handle preflight request
    res.status(204).end();
  } else {
    next();
  }
}

export default createCorsMiddleware;