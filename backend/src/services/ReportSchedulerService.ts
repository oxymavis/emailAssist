/**
 * 报告调度服务
 * 负责定时任务管理、报告自动生成和通知发送
 */

import * as cron from 'node-cron';
import { Pool } from 'pg';
import RedisManager from '@/config/redis';
import { 
  ReportSchedule, 
  CreateReportScheduleData,
  UpdateReportScheduleData,
  ReportScheduleQuery,
  NotificationSettings,
  Report,
  ReportStatus,
  ReportType,
  ReportFormat,
  CreateReportData
} from '../models/Report';
import { ReportGenerationService } from './ReportGenerationService';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ScheduledTask {
  id: string;
  schedule: ReportSchedule;
  task: cron.ScheduledTask;
}

export class ReportSchedulerService {
  private db: Pool;
  private redis: typeof RedisManager;
  private reportService: ReportGenerationService;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private isInitialized = false;

  constructor(db: Pool, redis: typeof RedisManager, reportService: ReportGenerationService) {
    this.db = db;
    this.redis = redis;
    this.reportService = reportService;
  }

  /**
   * 初始化调度服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('初始化报告调度服务...');

      // 加载现有的调度任务
      await this.loadExistingSchedules();

      // 启动清理任务（每小时运行一次）
      this.startCleanupTask();

      // 启动健康检查任务（每30分钟运行一次）
      this.startHealthCheckTask();

      this.isInitialized = true;
      logger.info(`报告调度服务初始化完成，加载了 ${this.scheduledTasks.size} 个任务`);

    } catch (error) {
      logger.error('报告调度服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载现有调度任务
   */
  private async loadExistingSchedules(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT * FROM report_schedules 
        WHERE is_active = true AND deleted_at IS NULL
        ORDER BY created_at
      `);

      for (const row of result.rows) {
        const schedule = this.mapRowToSchedule(row);
        await this.createCronTask(schedule);
      }

    } catch (error) {
      logger.error('加载现有调度任务失败:', error);
      throw error;
    }
  }

  /**
   * 创建新的调度任务
   */
  async createSchedule(data: CreateReportScheduleData, userId: string): Promise<ReportSchedule> {
    try {
      // 验证cron表达式
      if (!cron.validate(data.cron_expression)) {
        throw new Error('无效的cron表达式');
      }

      const scheduleId = uuidv4();
      const now = new Date();
      const nextRun = this.getNextRunTime(data.cron_expression, data.timezone);

      const schedule: ReportSchedule = {
        id: scheduleId,
        user_id: userId,
        report_id: data.report_id,
        template_id: data.template_id,
        name: data.name,
        cron_expression: data.cron_expression,
        timezone: data.timezone,
        is_active: true,
        next_run: nextRun,
        success_count: 0,
        failure_count: 0,
        notification_settings: data.notification_settings,
        retention_days: data.retention_days,
        created_at: now,
        updated_at: now
      };

      // 保存到数据库
      await this.db.query(`
        INSERT INTO report_schedules (
          id, user_id, report_id, template_id, name, cron_expression,
          timezone, is_active, next_run, success_count, failure_count,
          notification_settings, retention_days, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        scheduleId, userId, data.report_id, data.template_id, data.name,
        data.cron_expression, data.timezone, true, nextRun, 0, 0,
        JSON.stringify(data.notification_settings), data.retention_days, now, now
      ]);

      // 创建cron任务
      await this.createCronTask(schedule);

      logger.info(`创建报告调度: ${scheduleId}, 下次执行: ${nextRun}`);
      return schedule;

    } catch (error) {
      logger.error('创建调度任务失败:', error);
      throw error;
    }
  }

  /**
   * 更新调度任务
   */
  async updateSchedule(scheduleId: string, data: UpdateReportScheduleData, userId: string): Promise<ReportSchedule> {
    try {
      const existing = await this.getScheduleById(scheduleId);
      if (!existing) {
        throw new Error('调度任务不存在');
      }

      if (existing.user_id !== userId) {
        throw new Error('只能修改自己的调度任务');
      }

      // 构建更新语句
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(data.name);
      }

      if (data.cron_expression !== undefined) {
        if (!cron.validate(data.cron_expression)) {
          throw new Error('无效的cron表达式');
        }
        updateFields.push(`cron_expression = $${paramIndex++}`);
        updateValues.push(data.cron_expression);
      }

      if (data.timezone !== undefined) {
        updateFields.push(`timezone = $${paramIndex++}`);
        updateValues.push(data.timezone);
      }

      if (data.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(data.is_active);
      }

      if (data.notification_settings !== undefined) {
        updateFields.push(`notification_settings = $${paramIndex++}`);
        updateValues.push(JSON.stringify(data.notification_settings));
      }

      if (data.retention_days !== undefined) {
        updateFields.push(`retention_days = $${paramIndex++}`);
        updateValues.push(data.retention_days);
      }

      // 计算下次运行时间
      let nextRun = existing.next_run;
      if (data.cron_expression !== undefined || data.timezone !== undefined) {
        const cronExpr = data.cron_expression || existing.cron_expression;
        const timezone = data.timezone || existing.timezone;
        nextRun = this.getNextRunTime(cronExpr, timezone);
        updateFields.push(`next_run = $${paramIndex++}`);
        updateValues.push(nextRun);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      updateValues.push(scheduleId);

      // 执行更新
      await this.db.query(`
        UPDATE report_schedules 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateValues);

      // 重新创建cron任务
      this.destroyCronTask(scheduleId);
      const updatedSchedule = await this.getScheduleById(scheduleId);
      if (updatedSchedule && updatedSchedule.is_active) {
        await this.createCronTask(updatedSchedule);
      }

      logger.info(`更新报告调度: ${scheduleId}`);
      return updatedSchedule!;

    } catch (error) {
      logger.error(`更新调度任务失败: ${scheduleId}`, error);
      throw error;
    }
  }

  /**
   * 删除调度任务
   */
  async deleteSchedule(scheduleId: string, userId: string): Promise<void> {
    try {
      const existing = await this.getScheduleById(scheduleId);
      if (!existing) {
        throw new Error('调度任务不存在');
      }

      if (existing.user_id !== userId) {
        throw new Error('只能删除自己的调度任务');
      }

      // 软删除
      await this.db.query(
        'UPDATE report_schedules SET deleted_at = $1, updated_at = $1 WHERE id = $2',
        [new Date(), scheduleId]
      );

      // 销毁cron任务
      this.destroyCronTask(scheduleId);

      logger.info(`删除报告调度: ${scheduleId}`);

    } catch (error) {
      logger.error(`删除调度任务失败: ${scheduleId}`, error);
      throw error;
    }
  }

  /**
   * 获取调度任务列表
   */
  async getSchedules(query: ReportScheduleQuery = {}): Promise<{ schedules: ReportSchedule[]; total: number }> {
    try {
      let whereConditions = ['deleted_at IS NULL'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (query.user_id) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        queryParams.push(query.user_id);
      }

      if (query.is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        queryParams.push(query.is_active);
      }

      if (query.next_run_before) {
        whereConditions.push(`next_run <= $${paramIndex++}`);
        queryParams.push(query.next_run_before);
      }

      if (query.next_run_after) {
        whereConditions.push(`next_run >= $${paramIndex++}`);
        queryParams.push(query.next_run_after);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取总数
      const countQuery = `SELECT COUNT(*) as count FROM report_schedules ${whereClause}`;
      const countResult = await this.db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 获取数据
      const dataQuery = `
        SELECT * FROM report_schedules 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(query.limit || 20);
      queryParams.push(query.offset || 0);

      const dataResult = await this.db.query(dataQuery, queryParams);
      const schedules = dataResult.rows.map(row => this.mapRowToSchedule(row));

      return { schedules, total };

    } catch (error) {
      logger.error('获取调度任务列表失败:', error);
      throw new Error('获取调度任务列表失败');
    }
  }

  /**
   * 根据ID获取调度任务
   */
  async getScheduleById(scheduleId: string): Promise<ReportSchedule | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM report_schedules WHERE id = $1 AND deleted_at IS NULL',
        [scheduleId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSchedule(result.rows[0]);

    } catch (error) {
      logger.error(`获取调度任务失败: ${scheduleId}`, error);
      throw new Error('获取调度任务失败');
    }
  }

  /**
   * 启用/禁用调度任务
   */
  async toggleSchedule(scheduleId: string, userId: string): Promise<ReportSchedule> {
    try {
      const existing = await this.getScheduleById(scheduleId);
      if (!existing) {
        throw new Error('调度任务不存在');
      }

      if (existing.user_id !== userId) {
        throw new Error('只能操作自己的调度任务');
      }

      const newStatus = !existing.is_active;
      const nextRun = newStatus ? this.getNextRunTime(existing.cron_expression, existing.timezone) : null;

      await this.db.query(`
        UPDATE report_schedules 
        SET is_active = $1, next_run = $2, updated_at = $3 
        WHERE id = $4
      `, [newStatus, nextRun, new Date(), scheduleId]);

      // 重新创建或销毁cron任务
      this.destroyCronTask(scheduleId);
      if (newStatus) {
        const updatedSchedule = await this.getScheduleById(scheduleId);
        if (updatedSchedule) {
          await this.createCronTask(updatedSchedule);
        }
      }

      const result = await this.getScheduleById(scheduleId);
      logger.info(`切换调度任务状态: ${scheduleId} -> ${newStatus ? '启用' : '禁用'}`);
      
      return result!;

    } catch (error) {
      logger.error(`切换调度任务状态失败: ${scheduleId}`, error);
      throw error;
    }
  }

  /**
   * 立即执行调度任务
   */
  async executeNow(scheduleId: string, userId: string): Promise<string> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule) {
        throw new Error('调度任务不存在');
      }

      if (schedule.user_id !== userId) {
        throw new Error('只能执行自己的调度任务');
      }

      const reportId = await this.executeScheduledReport(schedule);
      logger.info(`手动执行调度任务: ${scheduleId} -> 报告: ${reportId}`);
      
      return reportId;

    } catch (error) {
      logger.error(`立即执行调度任务失败: ${scheduleId}`, error);
      throw error;
    }
  }

  /**
   * 创建cron任务
   */
  private async createCronTask(schedule: ReportSchedule): Promise<void> {
    try {
      if (this.scheduledTasks.has(schedule.id)) {
        this.destroyCronTask(schedule.id);
      }

      const task = cron.schedule(
        schedule.cron_expression,
        async () => {
          await this.handleScheduledExecution(schedule.id);
        },
        {
          timezone: schedule.timezone || 'Asia/Shanghai'
        }
      );

      this.scheduledTasks.set(schedule.id, {
        id: schedule.id,
        schedule,
        task
      });

      logger.debug(`创建cron任务: ${schedule.id} (${schedule.cron_expression})`);

    } catch (error) {
      logger.error(`创建cron任务失败: ${schedule.id}`, error);
      throw error;
    }
  }

  /**
   * 销毁cron任务
   */
  private destroyCronTask(scheduleId: string): void {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (scheduledTask) {
      scheduledTask.task.destroy();
      this.scheduledTasks.delete(scheduleId);
      logger.debug(`销毁cron任务: ${scheduleId}`);
    }
  }

  /**
   * 处理计划执行
   */
  private async handleScheduledExecution(scheduleId: string): Promise<void> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule || !schedule.is_active) {
        logger.warn(`调度任务已禁用或不存在: ${scheduleId}`);
        return;
      }

      logger.info(`开始执行计划任务: ${scheduleId}`);

      const reportId = await this.executeScheduledReport(schedule);
      
      // 更新成功统计
      await this.updateExecutionStats(scheduleId, true);
      
      // 发送成功通知
      if (schedule.notification_settings.success_notification) {
        await this.sendNotification(schedule, 'success', { reportId });
      }

      logger.info(`计划任务执行成功: ${scheduleId} -> 报告: ${reportId}`);

    } catch (error) {
      logger.error(`计划任务执行失败: ${scheduleId}`, error);

      try {
        // 更新失败统计
        await this.updateExecutionStats(scheduleId, false);
        
        // 获取更新后的调度信息
        const schedule = await this.getScheduleById(scheduleId);
        
        // 发送失败通知
        if (schedule && schedule.notification_settings.failure_notification) {
          await this.sendNotification(schedule, 'failure', { error: error.message });
        }
      } catch (notificationError) {
        logger.error(`发送失败通知失败: ${scheduleId}`, notificationError);
      }
    }
  }

  /**
   * 执行调度报告
   */
  private async executeScheduledReport(schedule: ReportSchedule): Promise<string> {
    // 创建报告配置
    const reportData: CreateReportData = {
      title: `${schedule.name} - ${new Date().toLocaleDateString()}`,
      description: `自动生成的计划报告`,
      report_type: this.getReportTypeFromSchedule(schedule),
      date_range: this.getDateRangeFromSchedule(schedule),
      format: ['pdf', 'excel'],
      parameters: {
        include_charts: true,
        include_attachments: true,
        metrics: ['total_emails', 'response_time', 'ai_analysis'],
        group_by: ['priority', 'sender', 'category']
      },
      template_id: schedule.template_id
    };

    // 创建报告记录
    const reportId = uuidv4();
    const now = new Date();

    await this.db.query(`
      INSERT INTO reports (
        id, user_id, title, description, report_type, date_range,
        status, format, parameters, template_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      reportId, schedule.user_id, reportData.title, reportData.description,
      reportData.report_type, JSON.stringify(reportData.date_range),
      ReportStatus.PENDING, JSON.stringify(reportData.format),
      JSON.stringify(reportData.parameters), reportData.template_id, now, now
    ]);

    // 异步生成报告
    setImmediate(async () => {
      try {
        await this.reportService.generateReport(reportId);
      } catch (error) {
        logger.error(`异步生成报告失败: ${reportId}`, error);
      }
    });

    return reportId;
  }

  /**
   * 更新执行统计
   */
  private async updateExecutionStats(scheduleId: string, success: boolean): Promise<void> {
    const nextRun = await this.calculateNextRun(scheduleId);
    
    const updateField = success ? 'success_count' : 'failure_count';
    await this.db.query(`
      UPDATE report_schedules 
      SET ${updateField} = ${updateField} + 1, last_run = $1, next_run = $2, updated_at = $1
      WHERE id = $3
    `, [new Date(), nextRun, scheduleId]);
  }

  /**
   * 计算下次运行时间
   */
  private async calculateNextRun(scheduleId: string): Promise<Date> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('调度任务不存在');
    }

    return this.getNextRunTime(schedule.cron_expression, schedule.timezone);
  }

  /**
   * 获取下次运行时间
   */
  private getNextRunTime(cronExpression: string, timezone: string = 'Asia/Shanghai'): Date {
    // 使用cron库计算下次执行时间
    const task = cron.schedule(cronExpression, () => {}, {
      timezone
    });
    
    // 由于cron库的限制，我们需要手动计算下次执行时间
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60 * 1000); // 简化实现，实际应该使用cron解析库
    
    return nextRun;
  }

  /**
   * 发送通知
   */
  private async sendNotification(
    schedule: ReportSchedule, 
    type: 'success' | 'failure', 
    context: any
  ): Promise<void> {
    try {
      if (!schedule.notification_settings.email_enabled) {
        return;
      }

      const recipients = schedule.notification_settings.email_recipients;
      if (!recipients || recipients.length === 0) {
        return;
      }

      let subject: string;
      let body: string;

      if (type === 'success') {
        subject = `报告生成成功 - ${schedule.name}`;
        body = `您的定时报告 "${schedule.name}" 已成功生成。\n\n报告ID: ${context.reportId}\n生成时间: ${new Date().toLocaleString()}`;
      } else {
        subject = `报告生成失败 - ${schedule.name}`;
        body = `您的定时报告 "${schedule.name}" 生成失败。\n\n错误信息: ${context.error}\n失败时间: ${new Date().toLocaleString()}`;
      }

      // 这里应该调用邮件发送服务
      // await this.emailService.sendNotification(recipients, subject, body);
      
      logger.info(`发送${type === 'success' ? '成功' : '失败'}通知: ${schedule.id} -> ${recipients.join(', ')}`);

    } catch (error) {
      logger.error(`发送通知失败: ${schedule.id}`, error);
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每小时清理一次过期报告
    cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredReports();
    });
  }

  /**
   * 启动健康检查任务
   */
  private startHealthCheckTask(): void {
    // 每30分钟检查一次任务健康状态
    cron.schedule('*/30 * * * *', async () => {
      await this.performHealthCheck();
    });
  }

  /**
   * 清理过期报告
   */
  private async cleanupExpiredReports(): Promise<void> {
    try {
      logger.debug('开始清理过期报告...');

      const result = await this.db.query(`
        DELETE FROM reports 
        WHERE created_at < NOW() - INTERVAL '30 days'
        AND status = 'completed'
      `);

      if (result.rowCount > 0) {
        logger.info(`清理了 ${result.rowCount} 个过期报告`);
      }

    } catch (error) {
      logger.error('清理过期报告失败:', error);
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      logger.debug('执行调度服务健康检查...');

      // 检查是否有失败次数过多的调度任务
      const result = await this.db.query(`
        SELECT id, name, failure_count 
        FROM report_schedules 
        WHERE is_active = true AND failure_count > 5 AND deleted_at IS NULL
      `);

      for (const row of result.rows) {
        logger.warn(`调度任务失败次数过多: ${row.name} (${row.id}) - 失败 ${row.failure_count} 次`);
        
        // 可以选择自动禁用失败次数过多的任务
        if (row.failure_count > 10) {
          await this.db.query(
            'UPDATE report_schedules SET is_active = false WHERE id = $1',
            [row.id]
          );
          this.destroyCronTask(row.id);
          logger.warn(`自动禁用失败任务: ${row.id}`);
        }
      }

      // 检查cron任务状态
      const activeSchedulesResult = await this.db.query(
        'SELECT COUNT(*) as count FROM report_schedules WHERE is_active = true AND deleted_at IS NULL'
      );
      const activeSchedulesCount = parseInt(activeSchedulesResult.rows[0].count);
      const runningTasksCount = this.scheduledTasks.size;

      if (activeSchedulesCount !== runningTasksCount) {
        logger.warn(`调度任务数量不匹配: 数据库中有 ${activeSchedulesCount} 个活跃任务, 内存中有 ${runningTasksCount} 个运行中任务`);
      }

    } catch (error) {
      logger.error('健康检查失败:', error);
    }
  }

  // 辅助方法
  private mapRowToSchedule(row: any): ReportSchedule {
    return {
      ...row,
      notification_settings: JSON.parse(row.notification_settings)
    };
  }

  private getReportTypeFromSchedule(schedule: ReportSchedule): ReportType {
    // 根据cron表达式推断报告类型
    const parts = schedule.cron_expression.split(' ');
    if (parts.length >= 5) {
      // 如果每天执行，返回日报
      if (parts[3] === '*' && parts[4] === '*') {
        return ReportType.DAILY;
      }
      // 如果每周执行，返回周报
      if (parts[4] !== '*' && parts[3] === '*') {
        return ReportType.WEEKLY;
      }
      // 如果每月执行，返回月报
      if (parts[2] !== '*') {
        return ReportType.MONTHLY;
      }
    }
    
    return ReportType.CUSTOM;
  }

  private getDateRangeFromSchedule(schedule: ReportSchedule): { start_date: Date; end_date: Date; timezone: string } {
    const now = new Date();
    const reportType = this.getReportTypeFromSchedule(schedule);
    
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (reportType) {
      case ReportType.DAILY:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case ReportType.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      
      case ReportType.MONTHLY:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
    }

    return {
      start_date: startDate,
      end_date: endDate,
      timezone: schedule.timezone || 'Asia/Shanghai'
    };
  }

  /**
   * 获取调度统计信息
   */
  async getStatistics(): Promise<{
    total_schedules: number;
    active_schedules: number;
    total_executions: number;
    success_rate: number;
    upcoming_executions: Array<{
      id: string;
      name: string;
      next_run: Date;
    }>;
  }> {
    try {
      // 总调度任务数
      const totalResult = await this.db.query(
        'SELECT COUNT(*) as count FROM report_schedules WHERE deleted_at IS NULL'
      );
      const total = parseInt(totalResult.rows[0].count);

      // 活跃调度任务数
      const activeResult = await this.db.query(
        'SELECT COUNT(*) as count FROM report_schedules WHERE is_active = true AND deleted_at IS NULL'
      );
      const active = parseInt(activeResult.rows[0].count);

      // 执行统计
      const statsResult = await this.db.query(`
        SELECT 
          SUM(success_count + failure_count) as total_executions,
          SUM(success_count) as total_success
        FROM report_schedules WHERE deleted_at IS NULL
      `);
      
      const totalExecutions = parseInt(statsResult.rows[0].total_executions) || 0;
      const totalSuccess = parseInt(statsResult.rows[0].total_success) || 0;
      const successRate = totalExecutions > 0 ? (totalSuccess / totalExecutions) * 100 : 0;

      // 即将执行的任务
      const upcomingResult = await this.db.query(`
        SELECT id, name, next_run 
        FROM report_schedules 
        WHERE is_active = true AND next_run > NOW() AND deleted_at IS NULL
        ORDER BY next_run ASC 
        LIMIT 10
      `);

      return {
        total_schedules: total,
        active_schedules: active,
        total_executions: totalExecutions,
        success_rate: successRate,
        upcoming_executions: upcomingResult.rows
      };

    } catch (error) {
      logger.error('获取调度统计失败:', error);
      throw new Error('获取调度统计失败');
    }
  }

  /**
   * 关闭调度服务
   */
  async shutdown(): Promise<void> {
    logger.info('正在关闭报告调度服务...');
    
    // 销毁所有cron任务
    for (const [scheduleId, scheduledTask] of this.scheduledTasks) {
      scheduledTask.task.destroy();
    }
    
    this.scheduledTasks.clear();
    this.isInitialized = false;
    
    logger.info('报告调度服务已关闭');
  }
}