import { Response } from 'express';
import { ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standardized API response utility
 * Ensures consistent response format across all endpoints
 */
export class ResponseHandler {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode = 200,
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
    }
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || 'v1',
        requestId: res.locals.requestId || uuidv4()
      }
    };

    if (pagination) {
      response.pagination = pagination;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details: process.env.NODE_ENV === 'development' ? details : undefined
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || 'v1',
        requestId: res.locals.requestId || uuidv4()
      }
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    errors: Array<{ field: string; message: string; value?: any }>
  ): Response {
    return ResponseHandler.error(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors }
    );
  }

  /**
   * Send authentication error response
   */
  static authError(
    res: Response,
    message = 'Authentication required'
  ): Response {
    return ResponseHandler.error(
      res,
      message,
      401,
      'AUTHENTICATION_ERROR'
    );
  }

  /**
   * Send authorization error response
   */
  static authorizationError(
    res: Response,
    message = 'Insufficient permissions'
  ): Response {
    return ResponseHandler.error(
      res,
      message,
      403,
      'AUTHORIZATION_ERROR'
    );
  }

  /**
   * Send not found error response
   */
  static notFound(
    res: Response,
    resource = 'Resource'
  ): Response {
    return ResponseHandler.error(
      res,
      `${resource} not found`,
      404,
      'NOT_FOUND_ERROR'
    );
  }

  /**
   * Send conflict error response
   */
  static conflict(
    res: Response,
    message = 'Resource already exists'
  ): Response {
    return ResponseHandler.error(
      res,
      message,
      409,
      'CONFLICT_ERROR'
    );
  }

  /**
   * Send rate limit error response
   */
  static rateLimitError(
    res: Response,
    message = 'Too many requests'
  ): Response {
    return ResponseHandler.error(
      res,
      message,
      429,
      'RATE_LIMIT_ERROR'
    );
  }

  /**
   * Send created response (for POST requests)
   */
  static created<T>(
    res: Response,
    data: T,
    message = 'Resource created successfully'
  ): Response {
    return ResponseHandler.success(res, data, message, 201);
  }

  /**
   * Send no content response (for DELETE requests)
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Create pagination object
   */
  static createPagination(
    page: number,
    limit: number,
    total: number
  ): {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  } {
    return {
      page,
      limit,
      total,
      hasNext: page * limit < total
    };
  }
}

/**
 * Express middleware to add request ID to response locals
 */
export function addRequestId(req: any, res: Response, next: Function): void {
  res.locals.requestId = req.requestId || uuidv4();
  next();
}

/**
 * Helper function to handle async route errors
 */
export function asyncHandler(fn: any) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Legacy helper functions for backward compatibility
export function formatResponse<T>(
  data?: T,
  message?: string,
  statusCode = 200,
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  }
): any {
  return (res: Response) => ResponseHandler.success(res, data, message, statusCode, pagination);
}

export function formatError(
  message: string,
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  details?: any
): any {
  return (res: Response) => ResponseHandler.error(res, message, statusCode, code, details);
}

export function formatSuccessResponse<T>(data?: T, message?: string): any {
  return (res: Response) => ResponseHandler.success(res, data, message, 200);
}

export function formatErrorResponse(
  message: string,
  statusCode = 500,
  code = 'INTERNAL_ERROR'
): any {
  return (res: Response) => ResponseHandler.error(res, message, statusCode, code);
}

// Simple helper functions for controllers
export function createSuccessResponse<T>(data?: T, meta?: any): any {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(meta || {})
    }
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): any {
  return {
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? details : undefined
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || uuidv4()
    }
  };
}

// Direct response functions for compatibility
export function successResponse<T>(data?: T, message?: string): any {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}

export function errorResponse(
  message: string,
  code = 'INTERNAL_ERROR',
  details?: any
): any {
  return {
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? details : undefined
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}