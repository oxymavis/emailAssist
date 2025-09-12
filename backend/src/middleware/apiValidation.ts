/**
 * API Validation Middleware
 * 增强的API数据验证和错误处理中间件
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import { ResponseHandler } from '@/utils/response';
import { ValidationError, BaseError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * 通用验证结果处理中间件
 * 统一处理express-validator的验证结果
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => {
      const fieldError = error as any;
      return {
        field: fieldError.path || fieldError.param || 'unknown',
        message: error.msg,
        value: fieldError.value,
        location: fieldError.location || 'body'
      };
    });

    logger.warn('API validation failed', {
      path: req.path,
      method: req.method,
      errors: validationErrors,
      body: req.body,
      query: req.query,
      params: req.params,
      requestId: req.requestId,
      userId: req.user?.id
    });

    throw new ValidationError('Request validation failed', validationErrors);
  }

  next();
};

/**
 * 请求体大小验证中间件
 */
export const validateRequestSize = (maxSizeInMB: number = 10) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      
      if (sizeInMB > maxSizeInMB) {
        logger.warn('Request size limit exceeded', {
          path: req.path,
          method: req.method,
          sizeInMB: sizeInMB.toFixed(2),
          limitInMB: maxSizeInMB,
          requestId: req.requestId,
          userId: req.user?.id
        });
        
        throw new ValidationError(`Request size exceeds limit of ${maxSizeInMB}MB`, [{
          field: 'content-length',
          message: `Request too large. Maximum size is ${maxSizeInMB}MB`,
          value: `${sizeInMB.toFixed(2)}MB`
        }]);
      }
    }
    
    next();
  };
};

/**
 * 内容类型验证中间件
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    // Skip validation for GET requests or requests without body
    if (req.method === 'GET' || !contentType || req.get('Content-Length') === '0') {
      return next();
    }
    
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      logger.warn('Invalid content type', {
        path: req.path,
        method: req.method,
        contentType,
        allowedTypes,
        requestId: req.requestId,
        userId: req.user?.id
      });
      
      throw new ValidationError('Invalid content type', [{
        field: 'content-type',
        message: `Content type must be one of: ${allowedTypes.join(', ')}`,
        value: contentType
      }]);
    }
    
    next();
  };
};

/**
 * 分页参数验证和规范化中间件
 */
export const validatePagination = (defaultLimit: number = 20, maxLimit: number = 100) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 验证和规范化页码
    const page = parseInt(req.query.page as string) || 1;
    if (page < 1) {
      throw new ValidationError('Invalid pagination parameters', [{
        field: 'page',
        message: 'Page must be a positive integer',
        value: req.query.page
      }]);
    }
    
    // 验证和规范化限制
    let limit = parseInt(req.query.limit as string) || defaultLimit;
    if (limit < 1) {
      throw new ValidationError('Invalid pagination parameters', [{
        field: 'limit',
        message: 'Limit must be a positive integer',
        value: req.query.limit
      }]);
    }
    if (limit > maxLimit) {
      limit = maxLimit;
    }
    
    // 添加规范化后的参数到请求对象
    req.pagination = {
      page,
      limit,
      offset: (page - 1) * limit
    };
    
    next();
  };
};

/**
 * 日期范围验证中间件
 */
export const validateDateRange = (maxRangeDays: number = 365) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { dateFrom, dateTo } = req.query;
    
    if (dateFrom || dateTo) {
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      
      // 验证日期格式
      if (dateFrom) {
        fromDate = new Date(dateFrom as string);
        if (isNaN(fromDate.getTime())) {
          throw new ValidationError('Invalid date format', [{
            field: 'dateFrom',
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
            value: dateFrom
          }]);
        }
      }
      
      if (dateTo) {
        toDate = new Date(dateTo as string);
        if (isNaN(toDate.getTime())) {
          throw new ValidationError('Invalid date format', [{
            field: 'dateTo',
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
            value: dateTo
          }]);
        }
      }
      
      // 验证日期范围逻辑
      if (fromDate && toDate && fromDate > toDate) {
        throw new ValidationError('Invalid date range', [{
          field: 'dateRange',
          message: 'dateFrom cannot be later than dateTo',
          value: { dateFrom, dateTo }
        }]);
      }
      
      // 验证日期范围大小
      if (fromDate && toDate) {
        const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        if (rangeDays > maxRangeDays) {
          throw new ValidationError('Date range too large', [{
            field: 'dateRange',
            message: `Date range cannot exceed ${maxRangeDays} days`,
            value: { rangeDays, maxRangeDays }
          }]);
        }
      }
      
      // 添加解析后的日期到请求对象
      req.dateRange = {
        from: fromDate,
        to: toDate
      };
    }
    
    next();
  };
};

/**
 * API版本验证中间件
 */
export const validateApiVersion = (supportedVersions: string[] = ['v1']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionHeader = req.headers['api-version'];
    const version = req.params.version || (Array.isArray(versionHeader) ? versionHeader[0] : versionHeader) || 'v1';
    
    if (!supportedVersions.includes(version)) {
      logger.warn('Unsupported API version requested', {
        requestedVersion: version,
        supportedVersions,
        path: req.path,
        requestId: req.requestId,
        userId: req.user?.id
      });
      
      throw new ValidationError('Unsupported API version', [{
        field: 'version',
        message: `API version must be one of: ${supportedVersions.join(', ')}`,
        value: version
      }]);
    }
    
    req.apiVersion = version;
    next();
  };
};

/**
 * 字符串清理和验证中间件
 */
export const sanitizeStrings = (maxLength: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 递归清理字符串
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        // 移除潜在的恶意字符
        let cleaned = obj.trim();
        
        // 检查长度
        if (cleaned.length > maxLength) {
          throw new ValidationError('String too long', [{
            field: 'string_length',
            message: `String length cannot exceed ${maxLength} characters`,
            value: `${cleaned.length} characters`
          }]);
        }
        
        // 移除HTML标签（基本清理）
        cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        
        return cleaned;
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };
    
    // 清理请求体
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // 清理查询参数
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  };
};

/**
 * 业务逻辑验证中间件工厂
 */
export const validateBusinessLogic = (validationFn: (req: Request) => Promise<void> | void) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await validationFn(req);
      next();
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      } else {
        logger.error('Business logic validation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method,
          requestId: req.requestId,
          userId: req.user?.id
        });
        
        throw new ValidationError('Business logic validation failed', [{
          field: 'business_logic',
          message: error instanceof Error ? error.message : 'Validation failed',
          value: null
        }]);
      }
    }
  };
};

/**
 * 资源存在性验证中间件工厂
 */
export const validateResourceExists = (
  resourceType: string,
  checkFn: (id: string, userId?: string) => Promise<boolean>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const resourceId = req.params.id;
    const userId = req.user?.id;
    
    if (!resourceId) {
      throw new ValidationError(`${resourceType} ID is required`, [{
        field: 'id',
        message: `${resourceType} ID parameter is required`,
        value: resourceId
      }]);
    }
    
    try {
      const exists = await checkFn(resourceId, userId);
      
      if (!exists) {
        logger.warn(`${resourceType} not found`, {
          resourceId,
          userId,
          path: req.path,
          requestId: req.requestId
        });
        
        throw new ValidationError(`${resourceType} not found`, [{
          field: 'id',
          message: `${resourceType} with ID ${resourceId} not found`,
          value: resourceId
        }]);
      }
      
      next();
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      } else {
        logger.error(`Error checking ${resourceType} existence`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceId,
          userId,
          requestId: req.requestId
        });
        
        throw new ValidationError(`Failed to validate ${resourceType}`, [{
          field: 'validation',
          message: `Could not validate ${resourceType} existence`,
          value: resourceId
        }]);
      }
    }
  };
};

/**
 * 用户权限验证中间件工厂
 */
export const validateUserPermissions = (
  requiredPermissions: string[],
  getResourceOwner?: (resourceId: string) => Promise<string>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const resourceId = req.params.id;
    
    if (!user) {
      throw new ValidationError('Authentication required', [{
        field: 'authentication',
        message: 'User must be authenticated',
        value: null
      }]);
    }
    
    // 检查用户权限
    const hasPermissions = requiredPermissions.every(permission => 
      user.permissions?.includes(permission) || user.role === 'admin'
    );
    
    if (!hasPermissions) {
      logger.warn('Insufficient permissions', {
        userId: user.id,
        requiredPermissions,
        userPermissions: user.permissions,
        userRole: user.role,
        path: req.path,
        requestId: req.requestId
      });
      
      throw new ValidationError('Insufficient permissions', [{
        field: 'permissions',
        message: `Required permissions: ${requiredPermissions.join(', ')}`,
        value: user.permissions
      }]);
    }
    
    // 检查资源所有权（如果提供了获取所有者的函数）
    if (getResourceOwner && resourceId) {
      try {
        const resourceOwner = await getResourceOwner(resourceId);
        
        if (resourceOwner !== user.id && user.role !== 'admin') {
          logger.warn('Access denied - not resource owner', {
            userId: user.id,
            resourceId,
            resourceOwner,
            path: req.path,
            requestId: req.requestId
          });
          
          throw new ValidationError('Access denied', [{
            field: 'ownership',
            message: 'You do not have access to this resource',
            value: resourceId
          }]);
        }
      } catch (error) {
        if (error instanceof BaseError) {
          throw error;
        } else {
          logger.error('Error checking resource ownership', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: user.id,
            resourceId,
            requestId: req.requestId
          });
          
          throw new ValidationError('Failed to validate resource access', [{
            field: 'ownership_validation',
            message: 'Could not validate resource access',
            value: resourceId
          }]);
        }
      }
    }
    
    next();
  };
};

// 扩展Request接口以支持新的属性
declare global {
  namespace Express {
    interface Request {
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
      dateRange?: {
        from?: Date;
        to?: Date;
      };
      apiVersion?: string;
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
      requestId?: string;
    }
  }
}