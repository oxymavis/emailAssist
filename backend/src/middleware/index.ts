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
 * Global rate limiting middleware
 * Applies general rate limiting to all API endpoints
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Max 1000 requests per window per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later'
    },
    meta: {
      timestamp: new Date().toISOString(),
      retryAfter: 15 * 60 // seconds
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and internal routes
    return req.path === '/health' || req.path === '/';
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        retryAfter: 15 * 60
      }
    });
  }
});

/**
 * Custom rate limiter factory for specific endpoints
 */
export const rateLimiter = (options: {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.maxRequests,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    keyGenerator: options.keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user?.id || req.ip;
    }),
    message: {
      success: false,
      error: {
        code: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
        message: options.message || `Too many requests to this endpoint. Maximum ${options.maxRequests} requests per ${Math.floor(options.windowMs / 1000)} seconds allowed.`
      },
      meta: {
        timestamp: new Date().toISOString(),
        retryAfter: Math.floor(options.windowMs / 1000)
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Endpoint rate limit exceeded', {
        endpoint: req.path,
        userId: req.user?.id,
        ip: req.ip,
        limit: options.maxRequests,
        windowMs: options.windowMs,
        requestId: req.requestId
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
          message: options.message || `Too many requests to this endpoint. Maximum ${options.maxRequests} requests per ${Math.floor(options.windowMs / 1000)} seconds allowed.`
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          retryAfter: Math.floor(options.windowMs / 1000)
        }
      });
    }
  });
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
 * API performance monitoring middleware
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  // Track response time and memory usage
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const endMemory = process.memoryUsage();
    
    const performanceMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      memoryDelta: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };

    // Log slow requests (> 1000ms)
    if (responseTime > 1000) {
      logger.warn('Slow API response detected', performanceMetrics);
    }

    // Log to performance monitoring (could integrate with monitoring service)
    logger.debug('API performance metrics', performanceMetrics);
    
    // Set performance headers
    res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
  });
  
  next();
};

/**
 * Request size monitoring middleware
 */
export const requestSizeMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.get('Content-Length');
  
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / (1024 * 1024);
    
    // Log large requests (> 10MB)
    if (sizeInMB > 10) {
      logger.warn('Large request detected', {
        path: req.path,
        method: req.method,
        sizeInMB: sizeInMB.toFixed(2),
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });
    }
    
    // Block extremely large requests (> 50MB)
    if (sizeInMB > 50) {
      logger.error('Request too large, blocking', {
        path: req.path,
        method: req.method,
        sizeInMB: sizeInMB.toFixed(2),
        requestId: req.requestId
      });
      
      res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request payload too large'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          maxSizeInMB: 50
        }
      });
      return;
    }
  }
  
  next();
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

    // Get performance metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || 'v1',
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy'
      },
      performance: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
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

// Export auth middleware
export * from './auth';
export * from './microsoftAuth';