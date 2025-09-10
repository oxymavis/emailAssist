/**
 * 报告生成控制器
 * 处理报告生成、管理、下载等API请求
 */

import { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { Pool } from 'pg';
import RedisManager from '@/config/redis';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { 
  Report, 
  CreateReportData, 
  UpdateReportData,
  ReportQuery,
  ReportType,
  ReportFormat,
  ReportStatus
} from '../models/Report';
import { ReportGenerationService } from '../services/ReportGenerationService';
import { ReportTemplateService } from '../services/ReportTemplateService';
import { ReportSchedulerService } from '../services/ReportSchedulerService';
import { AuthRequest } from '../types';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';
import { formatResponse } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';

export class ReportsController {
  private db: Pool;
  private redis: typeof RedisManager;
  private reportService: ReportGenerationService;
  private templateService: ReportTemplateService;
  private schedulerService: ReportSchedulerService;

  constructor(
    db: Pool, 
    redis: typeof RedisManager, 
    reportService: ReportGenerationService,
    templateService: ReportTemplateService,
    schedulerService: ReportSchedulerService
  ) {
    this.db = db;
    this.redis = redis;
    this.reportService = reportService;
    this.templateService = templateService;
    this.schedulerService = schedulerService;
  }

  /**
   * 获取报告列表
   */
  async getReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const query: ReportQuery = {
        user_id: req.user!.id,
        report_type: req.query.report_type as ReportType,
        status: req.query.status as ReportStatus,
        date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
        date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
        template_id: req.query.template_id as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        sort_by: req.query.sort_by as string || 'created_at',
        sort_order: (req.query.sort_order as 'ASC' | 'DESC') || 'DESC'
      };

      const result = await this.getReportsList(query);

      res.json(formatResponse(result.reports, '获取报告列表成功', 200, {
        page: Math.floor(query.offset / query.limit) + 1,
        limit: query.limit,
        total: result.total,
        hasNext: result.total > (query.offset + query.limit)
      }));

    } catch (error) {
      logger.error('获取报告列表失败:', error);
      res.status(500).json(formatResponse(null, '获取报告列表失败'));
    }
  }

  /**
   * 生成报告
   */
  async generateReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const data: CreateReportData = {
        title: req.body.title,
        description: req.body.description,
        report_type: req.body.report_type,
        date_range: {
          start_date: new Date(req.body.date_range.start_date),
          end_date: new Date(req.body.date_range.end_date),
          timezone: req.body.date_range.timezone || 'Asia/Shanghai'
        },
        format: req.body.format || [ReportFormat.PDF],
        parameters: req.body.parameters || {},
        template_id: req.body.template_id,
        scheduled_at: req.body.scheduled_at ? new Date(req.body.scheduled_at) : undefined
      };

      // 验证模板存在
      if (data.template_id) {
        const template = await this.templateService.getTemplateById(data.template_id);
        if (!template) {
          res.status(400).json(formatResponse(null, '指定的模板不存在'));
          return;
        }
        // 增加模板使用计数
        await this.templateService.incrementUsageCount(data.template_id);
      }

      // 创建报告记录
      const reportId = uuidv4();
      const now = new Date();

      const report: Report = {
        id: reportId,
        user_id: req.user!.id,
        title: data.title,
        description: data.description,
        report_type: data.report_type,
        date_range: data.date_range,
        status: ReportStatus.PENDING,
        format: data.format,
        parameters: data.parameters,
        template_id: data.template_id,
        scheduled_at: data.scheduled_at,
        created_at: now,
        updated_at: now
      };

      await this.createReportRecord(report);

      // 如果是立即生成，启动生成过程
      if (!data.scheduled_at) {
        // 异步生成报告
        setImmediate(async () => {
          try {
            await this.reportService.generateReport(reportId);
          } catch (error) {
            logger.error(`异步生成报告失败: ${reportId}`, error);
          }
        });
      }

      res.json(formatResponse({ report_id: reportId }, '报告生成任务已创建', 200));

    } catch (error) {
      logger.error('创建报告失败:', error);
      res.status(500).json(formatResponse(null, '创建报告失败'));
    }
  }

  /**
   * 获取报告详情
   */
  async getReportById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = req.params.id;
      const report = await this.getReportDetails(reportId, req.user!.id);

      if (!report) {
        res.status(404).json(formatResponse(null, '报告不存在'));
        return;
      }

      res.json(formatResponse(report, '获取报告详情成功', 200));

    } catch (error) {
      logger.error(`获取报告详情失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '获取报告详情失败'));
    }
  }

  /**
   * 删除报告
   */
  async deleteReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = req.params.id;
      const userId = req.user!.id;

      const report = await this.getReportDetails(reportId, userId);
      if (!report) {
        res.status(404).json(formatResponse(null, '报告不存在'));
        return;
      }

      // 软删除报告
      await this.db.query(
        'UPDATE reports SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND user_id = $3',
        [new Date(), reportId, userId]
      );

      // 删除文件
      if (report.file_paths && report.file_paths.length > 0) {
        for (const filePath of report.file_paths) {
          try {
            if (fs.existsSync(filePath)) {
              await promisify(fs.unlink)(filePath);
            }
          } catch (fileError) {
            logger.warn(`删除报告文件失败: ${filePath}`, fileError);
          }
        }
      }

      res.json(formatResponse(true, '报告删除成功'));

    } catch (error) {
      logger.error(`删除报告失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '删除报告失败'));
    }
  }

  /**
   * 下载报告
   */
  async downloadReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = req.params.id;
      const format = req.query.format as string || 'pdf';

      const report = await this.getReportDetails(reportId, req.user!.id);
      if (!report) {
        res.status(404).json(formatResponse(null, '报告不存在'));
        return;
      }

      if (report.status !== ReportStatus.COMPLETED) {
        res.status(400).json(formatResponse(null, '报告尚未生成完成'));
        return;
      }

      if (!report.file_paths || report.file_paths.length === 0) {
        res.status(404).json(formatResponse(null, '报告文件不存在'));
        return;
      }

      // 查找指定格式的文件
      const targetFile = report.file_paths.find(filePath => 
        filePath.toLowerCase().endsWith(`.${format.toLowerCase()}`)
      );

      if (!targetFile || !fs.existsSync(targetFile)) {
        res.status(404).json(formatResponse(null, '指定格式的报告文件不存在'));
        return;
      }

      // 设置下载响应头
      const fileName = `${report.title}_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      
      // 设置正确的MIME类型
      const mimeTypes = {
        'pdf': 'application/pdf',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'json': 'application/json',
        'csv': 'text/csv'
      };
      res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');

      // 流式传输文件
      const fileStream = fs.createReadStream(targetFile);
      fileStream.pipe(res);

    } catch (error) {
      logger.error(`下载报告失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '下载报告失败'));
    }
  }

  /**
   * 预览报告数据
   */
  async previewReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const {
        report_type,
        date_range,
        parameters,
        template_id
      } = req.body;

      // 收集预览数据
      const previewData = await this.generatePreviewData({
        user_id: req.user!.id,
        report_type,
        date_range: {
          start_date: new Date(date_range.start_date),
          end_date: new Date(date_range.end_date),
          timezone: date_range.timezone || 'Asia/Shanghai'
        },
        parameters: parameters || {}
      });

      res.json(formatResponse(true, '预览数据生成成功', previewData));

    } catch (error) {
      logger.error('生成预览数据失败:', error);
      res.status(500).json(formatResponse(null, '生成预览数据失败'));
    }
  }

  /**
   * 获取报告统计
   */
  async getReportStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const dateRange = req.query.date_range ? parseInt(req.query.date_range as string) : 30; // 默认30天

      const stats = await this.calculateReportStatistics(userId, dateRange);

      res.json(formatResponse(true, '获取报告统计成功', stats));

    } catch (error) {
      logger.error('获取报告统计失败:', error);
      res.status(500).json(formatResponse(null, '获取报告统计失败'));
    }
  }

  // 私有辅助方法

  /**
   * 获取报告列表
   */
  private async getReportsList(query: ReportQuery): Promise<{ reports: Report[]; total: number }> {
    let whereConditions = ['deleted_at IS NULL'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // 构建WHERE子句
    if (query.user_id) {
      whereConditions.push(`user_id = $${paramIndex++}`);
      queryParams.push(query.user_id);
    }

    if (query.report_type) {
      whereConditions.push(`report_type = $${paramIndex++}`);
      queryParams.push(query.report_type);
    }

    if (query.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(query.status);
    }

    if (query.date_from) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      queryParams.push(query.date_from);
    }

    if (query.date_to) {
      whereConditions.push(`created_at <= $${paramIndex++}`);
      queryParams.push(query.date_to);
    }

    if (query.template_id) {
      whereConditions.push(`template_id = $${paramIndex++}`);
      queryParams.push(query.template_id);
    }

    if (query.search) {
      whereConditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParams.push(`%${query.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as count FROM reports ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // 获取数据
    const sortBy = this.getSafeColumnName(query.sort_by || 'created_at');
    const sortOrder = query.sort_order === 'ASC' ? 'ASC' : 'DESC';
    
    const dataQuery = `
      SELECT * FROM reports 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    queryParams.push(query.limit || 20);
    queryParams.push(query.offset || 0);

    const dataResult = await this.db.query(dataQuery, queryParams);
    
    const reports = dataResult.rows.map(row => this.mapRowToReport(row));

    return { reports, total };
  }

  /**
   * 创建报告记录
   */
  private async createReportRecord(report: Report): Promise<void> {
    await this.db.query(`
      INSERT INTO reports (
        id, user_id, title, description, report_type, date_range,
        status, format, parameters, template_id, scheduled_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      report.id, report.user_id, report.title, report.description,
      report.report_type, JSON.stringify(report.date_range),
      report.status, JSON.stringify(report.format),
      JSON.stringify(report.parameters), report.template_id,
      report.scheduled_at, report.created_at, report.updated_at
    ]);
  }

  /**
   * 获取报告详情
   */
  private async getReportDetails(reportId: string, userId: string): Promise<Report | null> {
    const result = await this.db.query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [reportId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToReport(result.rows[0]);
  }

  /**
   * 生成预览数据
   */
  private async generatePreviewData(params: {
    user_id: string;
    report_type: ReportType;
    date_range: { start_date: Date; end_date: Date; timezone: string };
    parameters: any;
  }): Promise<any> {
    // 生成简化的预览数据（不包含完整的报告内容）
    const { start_date, end_date } = params.date_range;

    // 获取邮件数量
    const emailCountResult = await this.db.query(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE user_id = $1 AND received_date >= $2 AND received_date <= $3
    `, [params.user_id, start_date, end_date]);

    const emailCount = parseInt(emailCountResult.rows[0].count);

    // 获取基本统计
    const statsResult = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
        AVG(EXTRACT(EPOCH FROM (response_date - received_date))/3600) as avg_response_hours
      FROM messages 
      WHERE user_id = $1 AND received_date >= $2 AND received_date <= $3
    `, [params.user_id, start_date, end_date]);

    const stats = statsResult.rows[0];

    // 获取发件人分布
    const senderResult = await this.db.query(`
      SELECT sender_email, COUNT(*) as count
      FROM messages 
      WHERE user_id = $1 AND received_date >= $2 AND received_date <= $3
      GROUP BY sender_email
      ORDER BY count DESC
      LIMIT 10
    `, [params.user_id, start_date, end_date]);

    return {
      summary: {
        total_emails: emailCount,
        unread_emails: parseInt(stats.unread_count) || 0,
        high_priority_emails: parseInt(stats.high_priority_count) || 0,
        avg_response_time: parseFloat(stats.avg_response_hours) || 0
      },
      top_senders: senderResult.rows,
      date_range: {
        start: start_date.toISOString(),
        end: end_date.toISOString()
      },
      estimated_generation_time: Math.ceil(emailCount / 100) * 5 // 估算生成时间（秒）
    };
  }

  /**
   * 计算报告统计
   */
  private async calculateReportStatistics(userId: string, days: number): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 报告总数统计
    const totalResult = await this.db.query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_reports,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_reports,
        COUNT(CASE WHEN status = 'generating' THEN 1 END) as generating_reports
      FROM reports 
      WHERE user_id = $1 AND created_at >= $2 AND deleted_at IS NULL
    `, [userId, startDate]);

    const totals = totalResult.rows[0];

    // 按类型统计
    const typeResult = await this.db.query(`
      SELECT report_type, COUNT(*) as count
      FROM reports 
      WHERE user_id = $1 AND created_at >= $2 AND deleted_at IS NULL
      GROUP BY report_type
      ORDER BY count DESC
    `, [userId, startDate]);

    // 按日期统计
    const dailyResult = await this.db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM reports 
      WHERE user_id = $1 AND created_at >= $2 AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId, startDate]);

    // 文件大小统计
    const sizeResult = await this.db.query(`
      SELECT 
        AVG(file_size) as avg_size,
        SUM(file_size) as total_size,
        MAX(file_size) as max_size
      FROM reports 
      WHERE user_id = $1 AND created_at >= $2 AND file_size IS NOT NULL AND deleted_at IS NULL
    `, [userId, startDate]);

    const sizeStats = sizeResult.rows[0];

    return {
      overview: {
        total_reports: parseInt(totals.total_reports),
        completed_reports: parseInt(totals.completed_reports),
        failed_reports: parseInt(totals.failed_reports),
        generating_reports: parseInt(totals.generating_reports),
        success_rate: totals.total_reports > 0 ? 
          (parseInt(totals.completed_reports) / parseInt(totals.total_reports)) * 100 : 0
      },
      by_type: typeResult.rows,
      by_date: dailyResult.rows,
      file_statistics: {
        average_size_mb: sizeStats.avg_size ? (parseFloat(sizeStats.avg_size) / 1024 / 1024).toFixed(2) : 0,
        total_size_mb: sizeStats.total_size ? (parseFloat(sizeStats.total_size) / 1024 / 1024).toFixed(2) : 0,
        max_size_mb: sizeStats.max_size ? (parseFloat(sizeStats.max_size) / 1024 / 1024).toFixed(2) : 0
      },
      date_range: {
        start: startDate.toISOString(),
        end: new Date().toISOString()
      }
    };
  }

  /**
   * 安全的列名检查
   */
  private getSafeColumnName(columnName: string): string {
    const allowedColumns = [
      'id', 'title', 'report_type', 'status', 'created_at', 'updated_at', 'generated_at'
    ];
    
    return allowedColumns.includes(columnName) ? columnName : 'created_at';
  }

  /**
   * 映射数据库行到Report对象
   */
  private mapRowToReport(row: any): Report {
    return {
      ...row,
      date_range: JSON.parse(row.date_range),
      format: JSON.parse(row.format),
      parameters: JSON.parse(row.parameters),
      file_paths: row.file_paths ? JSON.parse(row.file_paths) : undefined,
      statistics: row.statistics ? JSON.parse(row.statistics) : undefined
    };
  }
}

// 验证中间件
export const validateGetReports = [
  query('report_type').optional().isIn(Object.values(ReportType)),
  query('status').optional().isIn(Object.values(ReportStatus)),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('template_id').optional().isUUID(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('sort_by').optional().isIn(['id', 'title', 'report_type', 'status', 'created_at', 'updated_at']),
  query('sort_order').optional().isIn(['ASC', 'DESC'])
];

export const validateGenerateReport = [
  body('title').isLength({ min: 1, max: 200 }).withMessage('标题长度必须在1-200字符之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符'),
  body('report_type').isIn(Object.values(ReportType)).withMessage('无效的报告类型'),
  body('date_range.start_date').isISO8601().withMessage('开始日期格式无效'),
  body('date_range.end_date').isISO8601().withMessage('结束日期格式无效'),
  body('date_range.timezone').optional().isLength({ min: 1, max: 50 }),
  body('format').isArray({ min: 1 }).withMessage('至少选择一种输出格式'),
  body('format.*').isIn(Object.values(ReportFormat)).withMessage('无效的输出格式'),
  body('template_id').optional().isUUID().withMessage('模板ID格式无效'),
  body('scheduled_at').optional().isISO8601().withMessage('计划时间格式无效'),
  body('parameters').optional().isObject()
];

export const validateReportId = [
  param('id').isUUID().withMessage('报告ID格式无效')
];

export const validatePreviewReport = [
  body('report_type').isIn(Object.values(ReportType)).withMessage('无效的报告类型'),
  body('date_range.start_date').isISO8601().withMessage('开始日期格式无效'),
  body('date_range.end_date').isISO8601().withMessage('结束日期格式无效'),
  body('parameters').optional().isObject()
];