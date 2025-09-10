import type { AppError as IAppError } from '@/types';

/**
 * Custom error classes for different types of application errors
 */
export class BaseError extends Error implements IAppError {
  public readonly statusCode: number;
  public code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly to maintain instanceof checks
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends BaseError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends BaseError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends BaseError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends BaseError {
  constructor(message = 'Database operation failed', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message = 'External service error', statusCode = 503) {
    super(`${service}: ${message}`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

export class MicrosoftAuthError extends ExternalServiceError {
  constructor(message = 'Microsoft authentication failed') {
    super('Microsoft Auth', message, 401);
    this.name = 'MicrosoftAuthError';
  }
}

export class MicrosoftGraphError extends ExternalServiceError {
  constructor(message = 'Microsoft Graph API error') {
    super('Microsoft Graph', message, 503);
    this.name = 'MicrosoftGraphError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message = 'Token has expired') {
    super(message);
    this.code = 'TOKEN_EXPIRED';
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message = 'Invalid token') {
    super(message);
    this.code = 'INVALID_TOKEN';
    this.name = 'InvalidTokenError';
  }
}

/**
 * Error utility functions
 */
export class ErrorUtils {
  /**
   * Check if error is operational (expected) or programming error
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Create error response object
   */
  static createErrorResponse(error: IAppError | Error, requestId?: string) {
    const isAppError = error instanceof BaseError;
    
    return {
      success: false,
      error: {
        code: isAppError ? error.code : 'INTERNAL_ERROR',
        message: error.message,
        details: isAppError ? undefined : (process.env.NODE_ENV === 'development' ? error.stack : undefined)
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: requestId ?? 'unknown'
      }
    };
  }

  /**
   * Handle database errors and convert to appropriate app errors
   */
  static handleDatabaseError(error: any): DatabaseError {
    // PostgreSQL error codes
    if (error.code === '23505') { // Unique violation
      return new ConflictError('Resource already exists');
    }
    
    if (error.code === '23503') { // Foreign key violation
      return new ValidationError('Referenced resource does not exist');
    }
    
    if (error.code === '23502') { // Not null violation
      return new ValidationError('Required field is missing');
    }
    
    if (error.code === '42P01') { // Undefined table
      return new DatabaseError('Database schema error');
    }
    
    return new DatabaseError(error.message || 'Database operation failed', error);
  }

  /**
   * Handle Microsoft Graph API errors
   */
  static handleMicrosoftGraphError(error: any): MicrosoftGraphError {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;
      
      if (status === 401) {
        return new MicrosoftAuthError('Microsoft authentication failed');
      }
      
      if (status === 403) {
        return new AuthorizationError('Insufficient permissions for Microsoft Graph');
      }
      
      if (status === 404) {
        return new NotFoundError('Microsoft Graph resource');
      }
      
      if (status === 429) {
        return new RateLimitError('Microsoft Graph rate limit exceeded');
      }
      
      return new MicrosoftGraphError(message);
    }
    
    return new MicrosoftGraphError(error.message || 'Microsoft Graph API error');
  }

  /**
   * Parse and normalize validation errors
   */
  static handleValidationErrors(errors: any[]): ValidationError {
    const messages = errors.map(error => {
      if (error.msg) return error.msg;
      if (error.message) return error.message;
      return 'Validation error';
    });
    
    return new ValidationError(messages.join(', '));
  }
}

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_REQUIRED: 'Authentication token is required',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_EXPIRED: 'Authentication token has expired',
  
  // Authorization
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
  
  // Validation
  INVALID_EMAIL: 'Please provide a valid email address',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters long',
  REQUIRED_FIELD: 'This field is required',
  
  // Microsoft
  MICROSOFT_AUTH_FAILED: 'Microsoft authentication failed',
  MICROSOFT_TOKEN_INVALID: 'Microsoft token is invalid or expired',
  EMAIL_ACCOUNT_NOT_CONNECTED: 'Email account is not connected',
  
  // General
  INTERNAL_ERROR: 'An internal server error occurred',
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later'
};

// Export aliases for compatibility
export { BaseError as AppError };
export { BaseError as ApiError };