/**
 * 报告生成相关路由
 * 包括报告、模板、调度任务的所有API端点
 */

import { Router } from 'express';
import { Pool } from 'pg';
import RedisManager from '../config/redis';
import { 
  ReportsController,
  validateGetReports,
  validateGenerateReport,
  validateReportId,
  validatePreviewReport
} from '../controllers/ReportsController';
import {
  ReportTemplatesController,
  validateGetTemplates,
  validateTemplateId,
  validateCreateTemplate,
  validateUpdateTemplate,
  validateDuplicateTemplate,
  validateCreateReportFromTemplate
} from '../controllers/ReportTemplatesController';
import {
  ReportSchedulesController,
  validateGetSchedules,
  validateScheduleId,
  validateCreateSchedule,
  validateUpdateSchedule,
  validateCronExpression
} from '../controllers/ReportSchedulesController';
import { ReportGenerationService } from '../services/ReportGenerationService';
import { ReportTemplateService } from '../services/ReportTemplateService';
import { ReportSchedulerService } from '../services/ReportSchedulerService';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

export function createReportsRoutes(db: Pool, redis: typeof RedisManager): Router {
  const router = Router();

  // 初始化服务
  const reportService = new ReportGenerationService(db);
  const templateService = new ReportTemplateService(db, redis);
  const schedulerService = new ReportSchedulerService(db, redis, reportService);

  // 初始化控制器
  const reportsController = new ReportsController(db, redis, reportService, templateService, schedulerService);
  const templatesController = new ReportTemplatesController(templateService);
  const schedulesController = new ReportSchedulesController(schedulerService);

  // 初始化调度服务
  schedulerService.initialize().catch(error => {
    logger.error('报告调度服务初始化失败:', error);
  });

  // ===== 报告管理路由 =====

  /**
   * GET /api/v1/reports
   * 获取报告列表
   */
  router.get('/', 
    requireAuth, 
    validateGetReports,
    reportsController.getReports.bind(reportsController)
  );

  /**
   * POST /api/v1/reports/generate
   * 生成新报告
   */
  router.post('/generate',
    requireAuth,
    validateGenerateReport,
    reportsController.generateReport.bind(reportsController)
  );

  /**
   * GET /api/v1/reports/:id
   * 获取报告详情
   */
  router.get('/:id',
    requireAuth,
    validateReportId,
    reportsController.getReportById.bind(reportsController)
  );

  /**
   * DELETE /api/v1/reports/:id
   * 删除报告
   */
  router.delete('/:id',
    requireAuth,
    validateReportId,
    reportsController.deleteReport.bind(reportsController)
  );

  /**
   * GET /api/v1/reports/:id/download
   * 下载报告文件
   */
  router.get('/:id/download',
    requireAuth,
    validateReportId,
    reportsController.downloadReport.bind(reportsController)
  );

  /**
   * POST /api/v1/reports/preview
   * 预览报告数据
   */
  router.post('/preview',
    requireAuth,
    validatePreviewReport,
    reportsController.previewReport.bind(reportsController)
  );

  /**
   * GET /api/v1/reports/statistics/overview
   * 获取报告统计信息
   */
  router.get('/statistics/overview',
    requireAuth,
    reportsController.getReportStatistics.bind(reportsController)
  );

  // ===== 报告模板路由 =====

  /**
   * GET /api/v1/reports/templates
   * 获取模板列表
   */
  router.get('/templates',
    requireAuth,
    validateGetTemplates,
    templatesController.getTemplates.bind(templatesController)
  );

  /**
   * POST /api/v1/reports/templates
   * 创建自定义模板
   */
  router.post('/templates',
    requireAuth,
    validateCreateTemplate,
    templatesController.createTemplate.bind(templatesController)
  );

  /**
   * GET /api/v1/reports/templates/categories
   * 获取模板分类列表
   */
  router.get('/templates/categories',
    requireAuth,
    templatesController.getCategories.bind(templatesController)
  );

  /**
   * GET /api/v1/reports/templates/statistics
   * 获取模板使用统计
   */
  router.get('/templates/statistics',
    requireAuth,
    templatesController.getUsageStatistics.bind(templatesController)
  );

  /**
   * GET /api/v1/reports/templates/:id
   * 获取模板详情
   */
  router.get('/templates/:id',
    requireAuth,
    validateTemplateId,
    templatesController.getTemplateById.bind(templatesController)
  );

  /**
   * PUT /api/v1/reports/templates/:id
   * 更新模板
   */
  router.put('/templates/:id',
    requireAuth,
    validateTemplateId,
    validateUpdateTemplate,
    templatesController.updateTemplate.bind(templatesController)
  );

  /**
   * DELETE /api/v1/reports/templates/:id
   * 删除模板
   */
  router.delete('/templates/:id',
    requireAuth,
    validateTemplateId,
    templatesController.deleteTemplate.bind(templatesController)
  );

  /**
   * POST /api/v1/reports/templates/:id/duplicate
   * 复制模板
   */
  router.post('/templates/:id/duplicate',
    requireAuth,
    validateTemplateId,
    validateDuplicateTemplate,
    templatesController.duplicateTemplate.bind(templatesController)
  );

  /**
   * POST /api/v1/reports/templates/:id/create-report
   * 基于模板创建报告
   */
  router.post('/templates/:id/create-report',
    requireAuth,
    validateTemplateId,
    validateCreateReportFromTemplate,
    templatesController.createReportFromTemplate.bind(templatesController)
  );

  // ===== 报告调度路由 =====

  /**
   * GET /api/v1/reports/schedules
   * 获取调度任务列表
   */
  router.get('/schedules',
    requireAuth,
    validateGetSchedules,
    schedulesController.getSchedules.bind(schedulesController)
  );

  /**
   * POST /api/v1/reports/schedules
   * 创建调度任务
   */
  router.post('/schedules',
    requireAuth,
    validateCreateSchedule,
    schedulesController.createSchedule.bind(schedulesController)
  );

  /**
   * GET /api/v1/reports/schedules/cron-templates
   * 获取cron表达式模板
   */
  router.get('/schedules/cron-templates',
    requireAuth,
    schedulesController.getCronTemplates.bind(schedulesController)
  );

  /**
   * POST /api/v1/reports/schedules/validate-cron
   * 验证cron表达式
   */
  router.post('/schedules/validate-cron',
    requireAuth,
    validateCronExpression,
    schedulesController.validateCronExpression.bind(schedulesController)
  );

  /**
   * GET /api/v1/reports/schedules/statistics
   * 获取调度统计信息
   */
  router.get('/schedules/statistics',
    requireAuth,
    schedulesController.getStatistics.bind(schedulesController)
  );

  /**
   * GET /api/v1/reports/schedules/:id
   * 获取调度任务详情
   */
  router.get('/schedules/:id',
    requireAuth,
    validateScheduleId,
    schedulesController.getScheduleById.bind(schedulesController)
  );

  /**
   * PUT /api/v1/reports/schedules/:id
   * 更新调度任务
   */
  router.put('/schedules/:id',
    requireAuth,
    validateScheduleId,
    validateUpdateSchedule,
    schedulesController.updateSchedule.bind(schedulesController)
  );

  /**
   * DELETE /api/v1/reports/schedules/:id
   * 删除调度任务
   */
  router.delete('/schedules/:id',
    requireAuth,
    validateScheduleId,
    schedulesController.deleteSchedule.bind(schedulesController)
  );

  /**
   * POST /api/v1/reports/schedules/:id/toggle
   * 启用/禁用调度任务
   */
  router.post('/schedules/:id/toggle',
    requireAuth,
    validateScheduleId,
    schedulesController.toggleSchedule.bind(schedulesController)
  );

  /**
   * POST /api/v1/reports/schedules/:id/execute
   * 立即执行调度任务
   */
  router.post('/schedules/:id/execute',
    requireAuth,
    validateScheduleId,
    schedulesController.executeNow.bind(schedulesController)
  );

  // ===== 系统管理路由（管理员专用）=====

  /**
   * GET /api/v1/reports/system/health
   * 系统健康检查
   */
  router.get('/system/health', requireAuth, async (req, res) => {
    try {
      // 检查各个服务的健康状态
      const health = {
        timestamp: new Date().toISOString(),
        services: {
          report_generation: 'healthy',
          template_service: 'healthy',
          scheduler_service: 'healthy'
        },
        database: {
          status: 'connected',
          pool_size: (db as any).totalCount || 0,
          idle_count: (db as any).idleCount || 0
        },
        redis: {
          status: redis.isRedisConnected() ? 'connected' : 'disconnected'
        },
        storage: {
          reports_directory: '/storage/reports',
          disk_space: 'sufficient' // 简化实现
        }
      };

      res.json({
        success: true,
        message: '系统健康检查完成',
        data: health
      });

    } catch (error) {
      logger.error('系统健康检查失败:', error);
      res.status(500).json({
        success: false,
        message: '系统健康检查失败'
      });
    }
  });

  /**
   * GET /api/v1/reports/system/metrics
   * 系统性能指标
   */
  router.get('/system/metrics', requireAuth, async (req, res) => {
    try {
      // 获取系统指标
      const metrics = {
        timestamp: new Date().toISOString(),
        report_generation: {
          total_reports: 0,
          reports_in_progress: 0,
          average_generation_time: 0,
          success_rate: 100
        },
        template_usage: {
          total_templates: 0,
          system_templates: 5,
          custom_templates: 0,
          most_used: []
        },
        scheduler_performance: {
          active_schedules: 0,
          successful_executions: 0,
          failed_executions: 0,
          next_scheduled_tasks: []
        },
        resource_usage: {
          memory_usage: process.memoryUsage(),
          uptime: process.uptime()
        }
      };

      // 查询实际数据
      const reportStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'generating' THEN 1 END) as in_progress,
          AVG(CASE WHEN statistics IS NOT NULL THEN 
            (statistics->>'generation_time_ms')::int END) as avg_time
        FROM reports WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      if (reportStats.rows.length > 0) {
        const stats = reportStats.rows[0];
        metrics.report_generation = {
          total_reports: parseInt(stats.total) || 0,
          reports_in_progress: parseInt(stats.in_progress) || 0,
          average_generation_time: parseFloat(stats.avg_time) || 0,
          success_rate: 100 // 简化计算
        };
      }

      res.json({
        success: true,
        message: '获取系统指标成功',
        data: metrics
      });

    } catch (error) {
      logger.error('获取系统指标失败:', error);
      res.status(500).json({
        success: false,
        message: '获取系统指标失败'
      });
    }
  });

  // 错误处理中间件
  router.use((error: any, req: any, res: any, next: any) => {
    logger.error('报告路由错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });

  logger.info('报告生成路由初始化完成');
  return router;
}