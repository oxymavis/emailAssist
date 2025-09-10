import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';
import config from '@/config';
import logger from '@/utils/logger';
import { ResponseHandler } from '@/utils/response';
import { ErrorUtils, BaseError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware
 * Adds unique request ID to each request
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();
  res.locals.requestId = req.requestId;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.requestId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    logger.httpRequest(
      req.method,
      req.url,
      res.statusCode,
      duration,
      req.requestId
    );

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove powered by header
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * Global rate limiting middleware (temporarily disabled)
 */
export const globalRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // Temporarily disable rate limiting to focus on core functionality
  next();
};

/**
 * Custom rate limiter factory (temporarily disabled)
 */
export const rateLimiter = (options: {
  maxRequests: number;
  windowMs: number;
  message?: string;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Temporarily disable rate limiting
    next();
  };
};

/**
 * Validation middleware
 * Handles express-validator validation results
 */
export const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }));

    logger.warn('Validation failed', {
      errors: validationErrors,
      requestId: req.requestId
    });

    ResponseHandler.validationError(res, validationErrors);
    return;
  }

  next();
};

/**
 * Not found middleware
 * Handles 404 errors for undefined routes
 */
export const notFound = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    requestId: req.requestId
  });

  ResponseHandler.notFound(res, `Route ${req.method} ${req.url}`);
};

/**
 * Global error handling middleware
 * Catches and handles all application errors
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Don't handle if response was already sent
  if (res.headersSent) {
    return next(error);
  }

  // Log error with context
  logger.errorWithStack('Unhandled error occurred', error, req.requestId);

  // Handle operational errors
  if (ErrorUtils.isOperationalError(error)) {
    const appError = error as BaseError;
    
    const errorResponse = {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        details: config.isDevelopment ? error.stack : undefined
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    res.status(appError.statusCode).json(errorResponse);
    return;
  }

  // Handle programming errors
  const errorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDevelopment ? error.message : 'An internal server error occurred',
      details: config.isDevelopment ? error.stack : undefined
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    }
  };

  res.status(500).json(errorResponse);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * CORS options for development
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes(origin) || config.isDevelopment) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24 hours
};

/**
 * Health check middleware
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check database connectivity
    const database = (await import('@/config/database')).default;
    const dbHealthy = await database.healthCheck();
    
    // Check Redis connectivity
    const redis = (await import('@/config/redis')).default;
    const redisHealthy = await redis.healthCheck();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || 'v1',
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy'
      }
    };

    const overallHealthy = dbHealthy && redisHealthy;
    
    res.status(overallHealthy ? 200 : 503).json({
      success: overallHealthy,
      data: health,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'health-check'
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'health-check'
      }
    });
  }
};