/**
 * Error Handler Middleware
 * 统一错误处理中间件 - 处理所有类型的错误和异常
 */

import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { DatabaseError, AuthenticationError } from '@/utils/errors';
import { createErrorResponse } from '@/utils/response';

/**
 * 错误类型定义
 */
export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  FOREIGN_KEY_CONSTRAINT = 'FOREIGN_KEY_CONSTRAINT',

  // 认证错误
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // 邮件服务错误
  EMAIL_SYNC_FAILED = 'EMAIL_SYNC_FAILED',
  EMAIL_ANALYSIS_FAILED = 'EMAIL_ANALYSIS_FAILED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND',

  // 批处理错误
  BATCH_PROCESSING_FAILED = 'BATCH_PROCESSING_FAILED',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  JOB_CANCELLED = 'JOB_CANCELLED',

  // 外部服务错误
  MICROSOFT_GRAPH_ERROR = 'MICROSOFT_GRAPH_ERROR',
  DEEPSEEK_API_ERROR = 'DEEPSEEK_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 文件处理错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // 配置错误
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * 标准化错误接口
 */
export interface StandardError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * 错误详情接口
 */
export interface ErrorDetails {
  stack?: string;
  originalError?: any;
  context?: Record<string, any>;
  userId?: string;
  requestPath?: string;
  requestMethod?: string;
}

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 将已知错误类型转换为标准错误
 */
const mapKnownErrorToStandard = (error: Error): StandardError => {
  const timestamp = new Date().toISOString();

  // 数据库错误
  if (error instanceof DatabaseError) {
    return {
      code: ErrorCode.DATABASE_ERROR,
      message: error.message || 'Database operation failed',
      statusCode: 500,
      timestamp
    };
  }

  // 邮件同步错误 - 暂时注释挹0a06
  // if (error instanceof EmailSyncError) {
  //   return {
  //     code: ErrorCode.EMAIL_SYNC_FAILED,
  //     message: error.message || 'Email synchronization failed',
  //     statusCode: 500,
  //     timestamp
  //   };
  // }

  // 认证错误
  if (error instanceof AuthenticationError) {
    return {
      code: ErrorCode.AUTHENTICATION_FAILED,
      message: error.message || 'Authentication failed',
      statusCode: 401,
      timestamp
    };
  }

  // 自定义应用错误
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      timestamp
    };
  }

  // PostgreSQL 错误
  if (error.name === 'PostgresError' || (error as any).code) {
    const pgError = error as any;
    
    switch (pgError.code) {
      case '23505': // Unique constraint violation
        return {
          code: ErrorCode.DUPLICATE_ENTRY,
          message: 'Duplicate entry found',
          statusCode: 409,
          timestamp,
          details: { constraint: pgError.constraint }
        };
        
      case '23503': // Foreign key constraint violation
        return {
          code: ErrorCode.FOREIGN_KEY_CONSTRAINT,
          message: 'Foreign key constraint violation',
          statusCode: 400,
          timestamp,
          details: { constraint: pgError.constraint }
        };
        
      case '08006': // Connection failure
        return {
          code: ErrorCode.DATABASE_CONNECTION_ERROR,
          message: 'Database connection failed',
          statusCode: 503,
          timestamp
        };
        
      default:
        return {
          code: ErrorCode.DATABASE_ERROR,
          message: pgError.message || 'Database error occurred',
          statusCode: 500,
          timestamp
        };
    }
  }

  // JWT 错误
  if (error.name === 'JsonWebTokenError') {
    return {
      code: ErrorCode.TOKEN_INVALID,
      message: 'Invalid token',
      statusCode: 401,
      timestamp
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      code: ErrorCode.TOKEN_EXPIRED,
      message: 'Token expired',
      statusCode: 401,
      timestamp
    };
  }

  // 验证错误
  if (error.name === 'ValidationError') {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: error.message || 'Validation failed',
      statusCode: 400,
      timestamp
    };
  }

  // 网络错误
  if (error.name === 'AxiosError' || (error as any).code === 'ECONNREFUSED' || (error as any).code === 'ENOTFOUND') {
    const networkError = error as any;
    
    if (networkError.response?.status === 429) {
      return {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        statusCode: 429,
        timestamp
      };
    }
    
    return {
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'External service unavailable',
      statusCode: 503,
      timestamp
    };
  }

  // 默认内部服务器错误
  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: error.message || 'Internal server error',
    statusCode: 500,
    timestamp
  };
};

/**
 * 记录错误日志
 */
const logError = (error: Error | StandardError, req: Request, details?: ErrorDetails): void => {
  const errorInfo = {
    message: error.message,
    stack: (error as any).stack,
    code: (error as any).code,
    statusCode: (error as any).statusCode,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: (req as any).user?.id,
    requestId: (req as any).id || (req as any).requestId,
    timestamp: new Date().toISOString(),
    ...details
  };

  const statusCode = (error as any).statusCode || 500;

  if (statusCode >= 500) {
    // 服务器错误 - 记录为错误级别
    logger.error('Server error occurred', errorInfo);
  } else if (statusCode >= 400) {
    // 客户端错误 - 记录为警告级别
    logger.warn('Client error occurred', errorInfo);
  } else {
    // 其他错误 - 记录为信息级别
    logger.info('Error occurred', errorInfo);
  }

  // 如果是操作错误（非程序错误），记录到操作日志
  if ((error as any).isOperational !== false) {
    logger.info('Error handled', {
      errorCode: (error as any).code,
      statusCode,
      userId: (req as any).user?.id,
      requestPath: req.path,
      method: req.method
    });
  }
};

/**
 * 生成请求ID（如果没有的话）
 */
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 主要错误处理中间件
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 确保有请求ID
  if (!(req as any).id) {
    (req as any).id = generateRequestId();
  }

  // 转换为标准错误格式
  const standardError = mapKnownErrorToStandard(error);
  standardError.requestId = (req as any).id;

  // 记录错误
  logError(error, req, {
    originalError: error,
    context: {
      body: req.body,
      params: req.params,
      query: req.query
    }
  });

  // 在生产环境中隐藏敏感信息
  const isProduction = process.env.NODE_ENV === 'production';
  const responseError = {
    ...standardError,
    ...(isProduction && {
      stack: undefined,
      details: standardError.statusCode >= 500 ? undefined : standardError.details
    })
  };

  // 发送错误响应
  res.status(standardError.statusCode).json(
    createErrorResponse(
      standardError.code,
      standardError.message,
      responseError.details,
      responseError.requestId
    )
  );
};

/**
 * 404 错误处理中间件
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    ErrorCode.NOT_FOUND,
    `Resource not found: ${req.method} ${req.path}`,
    404
  );

  next(error);
};

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获Promise rejection
 */
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 未捕获异常处理器
 */
export const setupUncaughtExceptionHandlers = (): void => {
  // 处理未捕获的Promise rejection
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });

    // 优雅关闭应用程序
    process.exit(1);
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });

    // 优雅关闭应用程序
    process.exit(1);
  });

  // 处理SIGTERM信号
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  // 处理SIGINT信号（Ctrl+C）
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};

/**
 * 健康检查错误处理
 */
export const healthCheckErrorHandler = (error: Error, service: string): StandardError => {
  return {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    message: `Health check failed for ${service}: ${error.message}`,
    statusCode: 503,
    timestamp: new Date().toISOString(),
    details: { service, error: error.message }
  };
};

// Export types are already exported at their declaration