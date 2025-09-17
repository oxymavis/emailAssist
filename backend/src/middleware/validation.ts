/**
 * Data Validation Middleware
 * 数据验证中间件 - 提供统一的请求数据验证
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { createErrorResponse } from '@/utils/response';

/**
 * 处理验证结果的中间件
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    logger.warn('Request validation failed', {
      url: req.url,
      method: req.method,
      errors: formattedErrors,
      body: req.body,
      params: req.params,
      query: req.query
    });

    res.status(400).json(createErrorResponse(
      'VALIDATION_ERROR',
      'Request validation failed',
      formattedErrors
    ));
    return;
  }
  
  next();
};

/**
 * 邮件ID验证规则
 */
export const validateEmailId: ValidationChain[] = [
  param('messageId')
    .isUUID()
    .withMessage('Message ID must be a valid UUID')
    .notEmpty()
    .withMessage('Message ID is required')
];

/**
 * 账户ID验证规则
 */
export const validateAccountId: ValidationChain[] = [
  param('accountId')
    .isUUID()
    .withMessage('Account ID must be a valid UUID')
    .notEmpty()
    .withMessage('Account ID is required')
];

/**
 * 邮件列表查询参数验证
 */
export const validateEmailListQuery: ValidationChain[] = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
    
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
    
  query('order_by')
    .optional()
    .isIn(['received_at', 'sent_at', 'subject'])
    .withMessage('Order by must be one of: received_at, sent_at, subject'),
    
  query('order_direction')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order direction must be ASC or DESC'),
    
  query('is_read')
    .optional()
    .isBoolean()
    .withMessage('is_read must be a boolean'),
    
  query('importance')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('Importance must be one of: low, normal, high'),
    
  query('has_attachments')
    .optional()
    .isBoolean()
    .withMessage('has_attachments must be a boolean'),
    
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO 8601 date'),
    
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO 8601 date'),
    
  query('search_text')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Search text must be between 1 and 500 characters')
];

/**
 * 邮件标记为已读/未读验证
 */
export const validateMarkAsRead: ValidationChain[] = [
  body('is_read')
    .isBoolean()
    .withMessage('is_read must be a boolean')
    .notEmpty()
    .withMessage('is_read is required')
];

/**
 * 邮件同步参数验证
 */
export const validateEmailSync: ValidationChain[] = [
  body('sync_folders')
    .optional()
    .isArray()
    .withMessage('sync_folders must be an array'),
    
  body('sync_folders.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each folder name must be between 1 and 100 characters'),
    
  body('max_emails_per_sync')
    .optional()
    .isInt({ min: 10, max: 1000 })
    .withMessage('max_emails_per_sync must be between 10 and 1000'),
    
  body('sync_attachments')
    .optional()
    .isBoolean()
    .withMessage('sync_attachments must be a boolean'),
    
  body('auto_analysis')
    .optional()
    .isBoolean()
    .withMessage('auto_analysis must be a boolean'),
    
  body('incremental_sync')
    .optional()
    .isBoolean()
    .withMessage('incremental_sync must be a boolean')
];

/**
 * 邮件分析参数验证
 */
export const validateEmailAnalysis: ValidationChain[] = [
  body('enable_ai_analysis')
    .optional()
    .isBoolean()
    .withMessage('enable_ai_analysis must be a boolean'),
    
  body('extract_entities')
    .optional()
    .isBoolean()
    .withMessage('extract_entities must be a boolean'),
    
  body('detect_language')
    .optional()
    .isBoolean()
    .withMessage('detect_language must be a boolean'),
    
  body('generate_summary')
    .optional()
    .isBoolean()
    .withMessage('generate_summary must be a boolean')
];

/**
 * 批量分析参数验证
 */
export const validateBatchAnalysis: ValidationChain[] = [
  body('message_ids')
    .isArray({ min: 1, max: 1000 })
    .withMessage('message_ids must be an array with 1 to 1000 items'),
    
  body('message_ids.*')
    .isUUID()
    .withMessage('Each message ID must be a valid UUID'),
    
  body('batch_size')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('batch_size must be between 1 and 50'),
    
  body('delay_between_batches')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('delay_between_batches must be between 100 and 10000 milliseconds'),
    
  body('skip_existing_analysis')
    .optional()
    .isBoolean()
    .withMessage('skip_existing_analysis must be a boolean'),
    
  body('analysis_types')
    .optional()
    .isArray()
    .withMessage('analysis_types must be an array'),
    
  body('analysis_types.*')
    .optional()
    .isIn(['sentiment', 'priority', 'category', 'entities', 'summary'])
    .withMessage('Each analysis type must be one of: sentiment, priority, category, entities, summary')
];

/**
 * 任务ID验证
 */
export const validateJobId: ValidationChain[] = [
  param('jobId')
    .isUUID()
    .withMessage('Job ID must be a valid UUID')
    .notEmpty()
    .withMessage('Job ID is required')
];

/**
 * 邮件发送验证（如果需要）
 */
export const validateEmailSend: ValidationChain[] = [
  body('to')
    .isArray({ min: 1 })
    .withMessage('Recipients (to) must be a non-empty array'),
    
  body('to.*.email')
    .isEmail()
    .withMessage('Each recipient email must be valid'),
    
  body('to.*.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Recipient name must be between 1 and 100 characters'),
    
  body('subject')
    .isLength({ min: 1, max: 500 })
    .withMessage('Subject must be between 1 and 500 characters'),
    
  body('body.text')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('Text body must be less than 100,000 characters'),
    
  body('body.html')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('HTML body must be less than 100,000 characters'),
    
  body('cc')
    .optional()
    .isArray()
    .withMessage('CC recipients must be an array'),
    
  body('cc.*.email')
    .optional()
    .isEmail()
    .withMessage('Each CC recipient email must be valid'),
    
  body('bcc')
    .optional()
    .isArray()
    .withMessage('BCC recipients must be an array'),
    
  body('bcc.*.email')
    .optional()
    .isEmail()
    .withMessage('Each BCC recipient email must be valid'),
    
  body('importance')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('Importance must be one of: low, normal, high'),
    
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
    
  body('attachments.*.filename')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Attachment filename must be between 1 and 255 characters'),
    
  body('attachments.*.contentType')
    .optional()
    .matches(/^[\w-]+\/[\w-]+$/)
    .withMessage('Attachment content type must be a valid MIME type')
];

/**
 * 批量操作验证
 */
export const validateBatchOperation: ValidationChain[] = [
  body('operation')
    .isIn(['markAsRead', 'delete', 'move', 'flag', 'unflag'])
    .withMessage('Operation must be one of: markAsRead, delete, move, flag, unflag'),
    
  body('message_ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('message_ids must be an array with 1 to 100 items'),
    
  body('message_ids.*')
    .isUUID()
    .withMessage('Each message ID must be a valid UUID'),
    
  // Conditional validation based on operation type
  body('is_read')
    .if(body('operation').equals('markAsRead'))
    .isBoolean()
    .withMessage('is_read must be a boolean when operation is markAsRead'),
    
  body('folder_id')
    .if(body('operation').equals('move'))
    .isUUID()
    .withMessage('folder_id must be a valid UUID when operation is move')
];

/**
 * 通用错误处理函数
 */
export const createValidationMiddleware = (validations: ValidationChain[]) => {
  return [...validations, handleValidationErrors];
};

/**
 * 安全性验证（防止XSS和SQL注入等）
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // 移除潜在的脚本标签
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // 清理请求体、查询参数和参数
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

/**
 * 速率限制验证
 */
export const validateRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // 这里可以添加基于用户的速率限制逻辑
  // 例如：检查用户的API调用频率，防止滥用
  
  const userAgent = req.headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;
  
  // 记录访问日志
  logger.info('API request', {
    method: req.method,
    url: req.url,
    userAgent,
    ip,
    userId: req.user?.id
  });

  next();
};

export default {
  handleValidationErrors,
  validateEmailId,
  validateAccountId,
  validateEmailListQuery,
  validateMarkAsRead,
  validateEmailSync,
  validateEmailAnalysis,
  validateBatchAnalysis,
  validateJobId,
  validateEmailSend,
  validateBatchOperation,
  createValidationMiddleware,
  sanitizeInput,
  validateRateLimit
};