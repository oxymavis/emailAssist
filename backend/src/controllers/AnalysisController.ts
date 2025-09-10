/**
 * Analysis Controller
 * 处理邮件AI分析相关的API请求
 */

import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import EmailMessageModel from '@/models/EmailMessage';
import EmailAnalysisModel from '@/models/EmailAnalysis';
import AIAnalysisService, { EmailContent } from '@/services/AIAnalysisService';
import logger from '@/utils/logger';
import { formatResponse, formatError } from '@/utils/response';
import { AppError } from '@/utils/errors';

export class AnalysisController {
  private emailMessageModel = new EmailMessageModel();
  private emailAnalysisModel = new EmailAnalysisModel();

  /**
   * 分析单个邮件
   * POST /api/v1/emails/:id/analyze
   */
  async analyzeEmail(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatError('Invalid input', 400, 'VALIDATION_ERROR', errors.array()));
        return;
      }

      const { id: emailId } = req.params;
      const userId = req.user!.id;

      // 获取邮件信息
      const email = await this.emailMessageModel.findById(emailId);
      if (!email) {
        res.status(404).json(formatError('Email message not found', 404, 'EMAIL_NOT_FOUND'));
        return;
      }

      // 检查邮件所有权
      if (email.userId !== userId) {
        res.status(403).json(formatError('Access denied', 403, 'FORBIDDEN'));
        return;
      }

      // 检查是否已有分析结果
      const existingAnalysis = await this.emailAnalysisModel.findByEmailId(emailId);
      if (existingAnalysis && !req.body.force) {
        res.json(formatResponse(existingAnalysis, 'Analysis already exists'));
        return;
      }

      // 准备邮件内容进行分析
      const emailContent: EmailContent = {
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        from: email.from,
        to: email.to,
        receivedAt: email.receivedAt
      };

      // 执行AI分析
      const analysisResult = await AIAnalysisService.analyzeEmail(emailContent);

      // 保存分析结果
      const analysis = await this.emailAnalysisModel.create({
        emailId: email.id,
        analysisVersion: '1.0',
        sentiment: analysisResult.sentiment,
        priority: analysisResult.priority,
        category: analysisResult.category,
        keywords: analysisResult.keywords,
        entities: analysisResult.entities,
        summary: analysisResult.summary,
        suggestedActions: analysisResult.suggestedActions,
        processingTime: analysisResult.processingTime
      });

      logger.info('Email analysis completed', {
        emailId,
        userId,
        priority: analysis.priority.level,
        sentiment: analysis.sentiment.label,
        processingTime: analysis.processingTime
      });

      res.json(formatResponse(analysis, 'Email analysis completed'));

    } catch (error) {
      logger.error('Email analysis failed', { error, emailId: req.params.id, userId: req.user?.id });
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json(formatError(error.message, error.statusCode, error.code));
      } else {
        res.status(500).json(formatError('Failed to analyze email', 500, 'ANALYSIS_ERROR'));
      }
    }
  }

  /**
   * 批量分析邮件
   * POST /api/v1/emails/batch-analyze
   */
  async batchAnalyzeEmails(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatError('Invalid input', 400, 'VALIDATION_ERROR', errors.array()));
        return;
      }

      const { emailIds } = req.body;
      const userId = req.user!.id;

      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        res.status(400).json(formatError('Email IDs array is required', 400, 'INVALID_INPUT'));
        return;
      }

      if (emailIds.length > 50) {
        res.status(400).json(formatError('Maximum 50 emails allowed per batch', 400, 'TOO_MANY_EMAILS'));
        return;
      }

      logger.info('Starting batch email analysis', { userId, count: emailIds.length });

      // 获取邮件信息
      const emails = await Promise.all(
        emailIds.map(async (emailId: string) => {
          const email = await this.emailMessageModel.findById(emailId);
          if (!email || email.userId !== userId) {
            return null;
          }
          return email;
        })
      );

      const validEmails = emails.filter(email => email !== null);
      
      if (validEmails.length === 0) {
        res.status(404).json(formatError('No valid emails found', 404, 'NO_VALID_EMAILS'));
        return;
      }

      // 准备邮件内容进行分析
      const emailContents: EmailContent[] = validEmails.map(email => ({
        subject: email!.subject,
        bodyText: email!.bodyText,
        bodyHtml: email!.bodyHtml,
        from: email!.from,
        to: email!.to,
        receivedAt: email!.receivedAt
      }));

      // 执行批量AI分析
      const analysisResults = await AIAnalysisService.analyzeEmailsBatch(emailContents);

      // 保存分析结果
      const analyses = await Promise.all(
        analysisResults.map(async (result, index) => {
          const email = validEmails[index]!;
          
          // 检查是否已有分析结果
          const existing = await this.emailAnalysisModel.findByEmailId(email.id);
          if (existing && !req.body.force) {
            return existing;
          }

          return await this.emailAnalysisModel.create({
            emailId: email.id,
            analysisVersion: '1.0',
            sentiment: result.sentiment,
            priority: result.priority,
            category: result.category,
            keywords: result.keywords,
            entities: result.entities,
            summary: result.summary,
            suggestedActions: result.suggestedActions,
            processingTime: result.processingTime
          });
        })
      );

      logger.info('Batch email analysis completed', {
        userId,
        totalRequested: emailIds.length,
        validEmails: validEmails.length,
        analysisCreated: analyses.length
      });

      res.json(formatResponse({
        analyses,
        stats: {
          requested: emailIds.length,
          processed: validEmails.length,
          analyzed: analyses.length
        }
      }, 'Batch analysis completed'));

    } catch (error) {
      logger.error('Batch email analysis failed', { error, userId: req.user?.id });
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json(formatError(error.message, error.statusCode, error.code));
      } else {
        res.status(500).json(formatError('Failed to analyze emails', 500, 'BATCH_ANALYSIS_ERROR'));
      }
    }
  }

  /**
   * 获取邮件分析结果
   * GET /api/v1/emails/:id/analysis
   */
  async getEmailAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatError('Invalid input', 400, 'VALIDATION_ERROR', errors.array()));
        return;
      }

      const { id: emailId } = req.params;
      const userId = req.user!.id;

      // 验证邮件所有权
      const email = await this.emailMessageModel.findById(emailId);
      if (!email) {
        res.status(404).json(formatError('Email message not found', 404, 'EMAIL_NOT_FOUND'));
        return;
      }

      if (email.userId !== userId) {
        res.status(403).json(formatError('Access denied', 403, 'FORBIDDEN'));
        return;
      }

      // 获取分析结果
      const analysis = await this.emailAnalysisModel.findByEmailId(emailId);
      if (!analysis) {
        res.status(404).json(formatError('Analysis not found for this email', 404, 'ANALYSIS_NOT_FOUND'));
        return;
      }

      res.json(formatResponse(analysis, 'Analysis retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get email analysis', { error, emailId: req.params.id, userId: req.user?.id });
      res.status(500).json(formatError('Failed to retrieve analysis', 500, 'GET_ANALYSIS_ERROR'));
    }
  }

  /**
   * 重新分析邮件
   * POST /api/v1/emails/:id/reanalyze
   */
  async reanalyzeEmail(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatError('Invalid input', 400, 'VALIDATION_ERROR', errors.array()));
        return;
      }

      const { id: emailId } = req.params;
      const userId = req.user!.id;

      // 获取邮件信息
      const email = await this.emailMessageModel.findById(emailId);
      if (!email) {
        res.status(404).json(formatError('Email message not found', 404, 'EMAIL_NOT_FOUND'));
        return;
      }

      // 检查邮件所有权
      if (email.userId !== userId) {
        res.status(403).json(formatError('Access denied', 403, 'FORBIDDEN'));
        return;
      }

      // 删除现有分析结果
      await this.emailAnalysisModel.deleteByEmailId(emailId);

      // 重新分析
      req.body.force = true; // 强制重新分析
      await this.analyzeEmail(req, res);

    } catch (error) {
      logger.error('Email reanalysis failed', { error, emailId: req.params.id, userId: req.user?.id });
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json(formatError(error.message, error.statusCode, error.code));
      } else {
        res.status(500).json(formatError('Failed to reanalyze email', 500, 'REANALYSIS_ERROR'));
      }
    }
  }

  /**
   * 获取分析统计信息
   * GET /api/v1/analysis/stats
   */
  async getAnalysisStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const stats = await this.emailAnalysisModel.getStats(userId);

      res.json(formatResponse(stats, 'Analysis statistics retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get analysis stats', { error, userId: req.user?.id });
      res.status(500).json(formatError('Failed to retrieve statistics', 500, 'GET_STATS_ERROR'));
    }
  }

  /**
   * 获取分析历史
   * GET /api/v1/analysis/history
   */
  async getAnalysisHistory(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatError('Invalid input', 400, 'VALIDATION_ERROR', errors.array()));
        return;
      }

      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      
      const filters: any = {};
      
      // 添加查询过滤器
      if (req.query.priority) {
        filters.priority = req.query.priority;
      }
      
      if (req.query.sentiment) {
        filters.sentiment = req.query.sentiment;
      }
      
      if (req.query.category) {
        filters.category = req.query.category;
      }
      
      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom as string);
      }
      
      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo as string);
      }

      const { analyses, total } = await this.emailAnalysisModel.findMany(filters, page, limit);

      res.json(formatResponse({
        analyses,
        pagination: {
          page,
          limit,
          total,
          hasNext: page * limit < total
        }
      }, 'Analysis history retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get analysis history', { error, userId: req.user?.id });
      res.status(500).json(formatError('Failed to retrieve analysis history', 500, 'GET_HISTORY_ERROR'));
    }
  }
}

// 验证中间件
export const validateAnalyzeEmail = [
  param('id').isUUID().withMessage('Valid email ID is required'),
  body('force').optional().isBoolean().withMessage('Force must be a boolean')
];

export const validateBatchAnalyze = [
  body('emailIds').isArray({ min: 1, max: 50 }).withMessage('Email IDs array is required (1-50 items)'),
  body('emailIds.*').isUUID().withMessage('Each email ID must be a valid UUID'),
  body('force').optional().isBoolean().withMessage('Force must be a boolean')
];

export const validateGetAnalysis = [
  param('id').isUUID().withMessage('Valid email ID is required')
];

export const validateReanalyze = [
  param('id').isUUID().withMessage('Valid email ID is required')
];

export const validateAnalysisHistory = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('priority').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid priority level'),
  query('sentiment').optional().isIn(['positive', 'negative', 'neutral']).withMessage('Invalid sentiment'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date')
];

export default new AnalysisController();