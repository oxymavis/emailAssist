/**
 * 报告调度控制器
 * 处理定时报告任务的管理和调度
 */

import { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import * as cron from 'node-cron';
import { 
  CreateReportScheduleData,
  UpdateReportScheduleData,
  ReportScheduleQuery
} from '../models/Report';
import { ReportSchedulerService } from '../services/ReportSchedulerService';
import { AuthRequest } from '../types';
import logger from '../utils/logger';
import { formatResponse } from '../utils/response';

export class ReportSchedulesController {
  private schedulerService: ReportSchedulerService;

  constructor(schedulerService: ReportSchedulerService) {
    this.schedulerService = schedulerService;
  }

  /**
   * 获取调度任务列表
   */
  async getSchedules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const query: ReportScheduleQuery = {
        user_id: req.user!.id,
        is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
        next_run_before: req.query.next_run_before ? new Date(req.query.next_run_before as string) : undefined,
        next_run_after: req.query.next_run_after ? new Date(req.query.next_run_after as string) : undefined,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0
      };

      const result = await this.schedulerService.getSchedules(query);

      res.json(formatResponse({
        schedules: result.schedules,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
          hasNext: result.total > (query.offset + query.limit)
        }
      }, '获取调度任务列表成功', 200));

    } catch (error) {
      logger.error('获取调度任务列表失败:', error);
      res.status(500).json(formatResponse(null, '获取调度任务列表失败', 500));
    }
  }

  /**
   * 创建调度任务
   */
  async createSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const data: CreateReportScheduleData = {
        report_id: req.body.report_id,
        template_id: req.body.template_id,
        name: req.body.name,
        cron_expression: req.body.cron_expression,
        timezone: req.body.timezone || 'Asia/Shanghai',
        notification_settings: {
          email_enabled: req.body.notification_settings?.email_enabled || false,
          email_recipients: req.body.notification_settings?.email_recipients || [],
          success_notification: req.body.notification_settings?.success_notification || false,
          failure_notification: req.body.notification_settings?.failure_notification || true,
          summary_notification: req.body.notification_settings?.summary_notification || false
        },
        retention_days: req.body.retention_days || 30
      };

      // 验证必须有report_id或template_id之一
      if (!data.report_id && !data.template_id) {
        res.status(400).json(formatResponse(null, '必须指定报告ID或模板ID', 400));
        return;
      }

      const schedule = await this.schedulerService.createSchedule(data, req.user!.id);

      res.status(201).json(formatResponse(schedule, '创建调度任务成功', 201));

    } catch (error) {
      logger.error('创建调度任务失败:', error);
      if (error.message === '无效的cron表达式') {
        res.status(400).json(formatResponse(null, error.message, 400));
      } else {
        res.status(500).json(formatResponse(null, '创建调度任务失败', 500));
      }
    }
  }

  /**
   * 获取调度任务详情
   */
  async getScheduleById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const scheduleId = req.params.id;
      const schedule = await this.schedulerService.getScheduleById(scheduleId);

      if (!schedule) {
        res.status(404).json(formatResponse(null, '调度任务不存在', 404));
        return;
      }

      if (schedule.user_id !== req.user!.id) {
        res.status(403).json(formatResponse(null, '无权限访问此调度任务', 403));
        return;
      }

      res.json(formatResponse(schedule, '获取调度任务详情成功', 200));

    } catch (error) {
      logger.error(`获取调度任务详情失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '获取调度任务详情失败', 500));
    }
  }

  /**
   * 更新调度任务
   */
  async updateSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const scheduleId = req.params.id;
      const data: UpdateReportScheduleData = {};

      // 只更新提供的字段
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.cron_expression !== undefined) data.cron_expression = req.body.cron_expression;
      if (req.body.timezone !== undefined) data.timezone = req.body.timezone;
      if (req.body.is_active !== undefined) data.is_active = req.body.is_active;
      if (req.body.notification_settings !== undefined) data.notification_settings = req.body.notification_settings;
      if (req.body.retention_days !== undefined) data.retention_days = req.body.retention_days;

      const schedule = await this.schedulerService.updateSchedule(scheduleId, data, req.user!.id);

      res.json(formatResponse(schedule, '更新调度任务成功', 200));

    } catch (error) {
      logger.error(`更新调度任务失败: ${req.params.id}`, error);
      if (error.message === '调度任务不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else if (error.message === '只能修改自己的调度任务' || error.message === '无效的cron表达式') {
        res.status(400).json(formatResponse(null, error.message, 400));
      } else {
        res.status(500).json(formatResponse(null, '更新调度任务失败', 500));
      }
    }
  }

  /**
   * 删除调度任务
   */
  async deleteSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const scheduleId = req.params.id;
      await this.schedulerService.deleteSchedule(scheduleId, req.user!.id);

      res.json(formatResponse(null, '删除调度任务成功', 200));

    } catch (error) {
      logger.error(`删除调度任务失败: ${req.params.id}`, error);
      if (error.message === '调度任务不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else if (error.message === '只能删除自己的调度任务') {
        res.status(403).json(formatResponse(null, error.message, 403));
      } else {
        res.status(500).json(formatResponse(null, '删除调度任务失败', 500));
      }
    }
  }

  /**
   * 启用/禁用调度任务
   */
  async toggleSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const scheduleId = req.params.id;
      const schedule = await this.schedulerService.toggleSchedule(scheduleId, req.user!.id);

      res.json(formatResponse(schedule, `调度任务已${schedule.is_active ? '启用' : '禁用'}`, 200));

    } catch (error) {
      logger.error(`切换调度任务状态失败: ${req.params.id}`, error);
      if (error.message === '调度任务不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else if (error.message === '只能操作自己的调度任务') {
        res.status(403).json(formatResponse(null, error.message, 403));
      } else {
        res.status(500).json(formatResponse(null, '切换调度任务状态失败', 500));
      }
    }
  }

  /**
   * 立即执行调度任务
   */
  async executeNow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const scheduleId = req.params.id;
      const reportId = await this.schedulerService.executeNow(scheduleId, req.user!.id);

      res.json(formatResponse({ 
        report_id: reportId,
        message: '报告正在生成中，请稍后查看结果'
      }, '调度任务执行已启动', 200));

    } catch (error) {
      logger.error(`立即执行调度任务失败: ${req.params.id}`, error);
      if (error.message === '调度任务不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else if (error.message === '只能执行自己的调度任务') {
        res.status(403).json(formatResponse(null, error.message, 403));
      } else {
        res.status(500).json(formatResponse(null, '立即执行调度任务失败', 500));
      }
    }
  }

  /**
   * 验证cron表达式
   */
  async validateCronExpression(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const { cron_expression, timezone = 'Asia/Shanghai' } = req.body;

      // 验证cron表达式格式
      const isValid = cron.validate(cron_expression);
      if (!isValid) {
        res.json(formatResponse({
          is_valid: false,
          error: 'cron表达式格式不正确'
        }, '无效的cron表达式', 400));
        return;
      }

      // 计算下几次执行时间（示例）
      const nextExecutions = [];
      try {
        // 简化实现：返回一些示例时间
        const now = new Date();
        for (let i = 0; i < 5; i++) {
          const nextTime = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000); // 每小时一次示例
          nextExecutions.push(nextTime.toISOString());
        }
      } catch (cronError) {
        logger.warn('计算下次执行时间失败:', cronError);
      }

      res.json(formatResponse({
        is_valid: true,
        cron_expression,
        timezone,
        next_executions: nextExecutions,
        description: this.getCronDescription(cron_expression)
      }, 'cron表达式验证通过', 200));

    } catch (error) {
      logger.error('验证cron表达式失败:', error);
      res.status(500).json(formatResponse(null, '验证cron表达式失败', 500));
    }
  }

  /**
   * 获取调度统计信息
   */
  async getStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const statistics = await this.schedulerService.getStatistics();

      res.json(formatResponse(statistics, '获取调度统计成功', 200));

    } catch (error) {
      logger.error('获取调度统计失败:', error);
      res.status(500).json(formatResponse(null, '获取调度统计失败', 500));
    }
  }

  /**
   * 获取预定义的cron表达式模板
   */
  async getCronTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const templates = [
        {
          name: '每小时',
          description: '每小时的第0分钟执行',
          cron_expression: '0 * * * *',
          category: 'hourly'
        },
        {
          name: '每天上午9点',
          description: '每天上午9点执行',
          cron_expression: '0 9 * * *',
          category: 'daily'
        },
        {
          name: '每天下午6点',
          description: '每天下午6点执行',
          cron_expression: '0 18 * * *',
          category: 'daily'
        },
        {
          name: '每周一上午9点',
          description: '每周一上午9点执行',
          cron_expression: '0 9 * * 1',
          category: 'weekly'
        },
        {
          name: '每周五下午5点',
          description: '每周五下午5点执行',
          cron_expression: '0 17 * * 5',
          category: 'weekly'
        },
        {
          name: '每月1号上午9点',
          description: '每月1号上午9点执行',
          cron_expression: '0 9 1 * *',
          category: 'monthly'
        },
        {
          name: '每月最后一天',
          description: '每月最后一天上午9点执行',
          cron_expression: '0 9 28-31 * *',
          category: 'monthly'
        },
        {
          name: '工作日上午9点',
          description: '周一到周五上午9点执行',
          cron_expression: '0 9 * * 1-5',
          category: 'weekdays'
        },
        {
          name: '周末上午10点',
          description: '周六和周日上午10点执行',
          cron_expression: '0 10 * * 0,6',
          category: 'weekends'
        }
      ];

      res.json(formatResponse({ templates }, '获取cron模板成功', 200));

    } catch (error) {
      logger.error('获取cron模板失败:', error);
      res.status(500).json(formatResponse(null, '获取cron模板失败', 500));
    }
  }

  // 私有辅助方法

  /**
   * 获取cron表达式的人类可读描述
   */
  private getCronDescription(cronExpression: string): string {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      return '无效的cron表达式格式';
    }

    const [minute, hour, day, month, weekday] = parts;

    // 简化的描述生成逻辑
    let description = '';

    if (minute === '0' && hour === '*') {
      description = '每小时执行';
    } else if (day === '*' && month === '*' && weekday === '*') {
      description = `每天 ${hour}:${minute.padStart(2, '0')} 执行`;
    } else if (day === '*' && month === '*' && weekday !== '*') {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      if (weekday.includes('-')) {
        description = `每周 ${hour}:${minute.padStart(2, '0')} 执行`;
      } else if (weekday.includes(',')) {
        description = `指定星期几 ${hour}:${minute.padStart(2, '0')} 执行`;
      } else {
        const dayIndex = parseInt(weekday);
        description = `每${weekdays[dayIndex]} ${hour}:${minute.padStart(2, '0')} 执行`;
      }
    } else if (weekday === '*' && month === '*') {
      description = `每月${day}号 ${hour}:${minute.padStart(2, '0')} 执行`;
    } else {
      description = '自定义时间执行';
    }

    return description;
  }
}

// 验证中间件
export const validateGetSchedules = [
  query('is_active').optional().isBoolean(),
  query('next_run_before').optional().isISO8601(),
  query('next_run_after').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
];

export const validateScheduleId = [
  param('id').isUUID().withMessage('调度任务ID格式无效')
];

export const validateCreateSchedule = [
  body('name').isLength({ min: 1, max: 100 }).withMessage('任务名称长度必须在1-100字符之间'),
  body('cron_expression').isLength({ min: 9, max: 50 }).withMessage('cron表达式格式无效')
    .custom((value) => {
      if (!cron.validate(value)) {
        throw new Error('无效的cron表达式');
      }
      return true;
    }),
  body('timezone').optional().isLength({ min: 1, max: 50 }),
  body('report_id').optional().isUUID().withMessage('报告ID格式无效'),
  body('template_id').optional().isUUID().withMessage('模板ID格式无效'),
  body('notification_settings').optional().isObject(),
  body('notification_settings.email_enabled').optional().isBoolean(),
  body('notification_settings.email_recipients').optional().isArray(),
  body('notification_settings.email_recipients.*').optional().isEmail(),
  body('retention_days').optional().isInt({ min: 1, max: 365 }).withMessage('保留天数必须在1-365之间')
];

export const validateUpdateSchedule = [
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('任务名称长度必须在1-100字符之间'),
  body('cron_expression').optional().isLength({ min: 9, max: 50 })
    .custom((value) => {
      if (value && !cron.validate(value)) {
        throw new Error('无效的cron表达式');
      }
      return true;
    }),
  body('timezone').optional().isLength({ min: 1, max: 50 }),
  body('is_active').optional().isBoolean(),
  body('notification_settings').optional().isObject(),
  body('retention_days').optional().isInt({ min: 1, max: 365 })
];

export const validateCronExpression = [
  body('cron_expression').isLength({ min: 9, max: 50 }).withMessage('cron表达式格式无效'),
  body('timezone').optional().isLength({ min: 1, max: 50 })
];