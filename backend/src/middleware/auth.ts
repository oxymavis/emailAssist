import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/AuthService';
import { UserModel } from '@/models/User';
import { ResponseHandler } from '@/utils/response';
import logger from '@/utils/logger';
import { AuthenticationError, AuthorizationError, InvalidTokenError } from '@/utils/errors';

/**
 * Authentication middleware
 * Verifies JWT token and loads user data
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authentication token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AuthenticationError('Authentication token is required');
    }

    // Verify JWT token
    const decoded = await AuthService.verifyToken(token);
    
    // Load user data
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Validate session exists in Redis
    const isValidSession = await AuthService.validateSession(user.id);
    if (!isValidSession) {
      throw new AuthenticationError('Session expired or invalid');
    }

    // Attach user to request object
    req.user = user;
    
    logger.debug('User authenticated successfully', { 
      userId: user.id, 
      email: user.email,
      requestId: req.requestId 
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    });

    if (error instanceof AuthenticationError || error instanceof InvalidTokenError) {
      ResponseHandler.authError(res, error.message);
      return;
    }

    ResponseHandler.authError(res, 'Authentication failed');
  }
};

/**
 * Optional authentication middleware
 * Loads user if token is provided, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        try {
          const decoded = await AuthService.verifyToken(token);
          const user = await UserModel.findById(decoded.userId);
          
          if (user) {
            const isValidSession = await AuthService.validateSession(user.id);
            if (isValidSession) {
              req.user = user;
            }
          }
        } catch (error) {
          // Ignore authentication errors for optional auth
          logger.debug('Optional authentication failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId 
          });
        }
      }
    }

    next();
  } catch (error) {
    // Always continue for optional auth
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!roles.includes(req.user.role)) {
        throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
      }

      logger.debug('User authorized successfully', { 
        userId: req.user.id, 
        role: req.user.role,
        requiredRoles: roles,
        requestId: req.requestId 
      });

      next();
    } catch (error) {
      logger.warn('Authorization failed', { 
        userId: req.user?.id,
        userRole: req.user?.role,
        requiredRoles: roles,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId 
      });

      if (error instanceof AuthenticationError) {
        ResponseHandler.authError(res, error.message);
        return;
      }

      if (error instanceof AuthorizationError) {
        ResponseHandler.authorizationError(res, error.message);
        return;
      }

      ResponseHandler.authorizationError(res, 'Access denied');
    }
  };
};

/**
 * Admin authorization middleware
 */
export const requireAdmin = authorize('admin');

/**
 * User or Admin authorization middleware
 */
export const requireUserOrAdmin = authorize('user', 'admin');

/**
 * Microsoft account connection middleware
 * Ensures user has connected Microsoft account
 */
export const requireMicrosoftConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const tokens = await UserModel.getMicrosoftTokens(req.user.id);
    if (!tokens) {
      ResponseHandler.authorizationError(
        res, 
        'Microsoft account connection required. Please connect your Microsoft account first.'
      );
      return;
    }

    logger.debug('Microsoft connection verified', { 
      userId: req.user.id,
      requestId: req.requestId 
    });

    next();
  } catch (error) {
    logger.error('Microsoft connection check failed', { 
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    });

    ResponseHandler.authorizationError(
      res, 
      'Microsoft account connection verification failed'
    );
  }
};

/**
 * Rate limiting middleware per user
 */
export const rateLimitPerUser = (maxRequests: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        // For unauthenticated requests, use IP-based rate limiting
        next();
        return;
      }

      const key = `rate_limit:user:${req.user.id}`;
      const redis = (await import('@/config/redis')).default;
      
      if (!redis.isRedisConnected()) {
        // If Redis is not available, skip rate limiting
        next();
        return;
      }

      const current = await redis.increment(key);
      
      if (current === 1) {
        // First request in window, set TTL
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      if (current && current > maxRequests) {
        logger.warn('User rate limit exceeded', { 
          userId: req.user.id,
          requests: current,
          limit: maxRequests,
          requestId: req.requestId 
        });

        ResponseHandler.rateLimitError(
          res,
          `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`
        );
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error', { 
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId 
      });

      // Continue on rate limiting errors
      next();
    }
  };
};

/**
 * Request context middleware
 * Adds request ID and user context to all requests
 */
export const addRequestContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Request ID is added by express-request-id middleware
  req.requestId = req.requestId || res.locals.requestId;
  
  logger.debug('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.requestId
  });

  next();
};

// Export aliases for compatibility
export { authenticate as requireAuth };
export { authenticate as authenticateToken };