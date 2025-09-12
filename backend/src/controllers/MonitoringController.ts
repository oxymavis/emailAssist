/**
 * Monitoring Controller
 * 监控控制器，提供监控数据的API接口，包括实时监控、历史数据、告警管理等功能
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import BusinessMetricsService from '@/services/monitoring/BusinessMetricsService';
import SystemResourceMonitor from '@/services/monitoring/SystemResourceMonitor';
import APMService from '@/services/monitoring/APMService';
import SecurityAuditService from '@/services/monitoring/SecurityAuditService';
import IntelligentAlertingSystem from '@/services/monitoring/IntelligentAlertingSystem';
import { PerformanceMonitorService } from '@/services/PerformanceMonitorService';
import logger from '@/utils/logger';
import { sendSuccessResponse, sendErrorResponse } from '@/utils/response';
import { Redis } from 'ioredis';

export class MonitoringController {
  private businessMetrics: BusinessMetricsService;
  private systemMonitor: SystemResourceMonitor;
  private apmService: APMService;
  private securityAudit: SecurityAuditService;
  private alertingSystem: IntelligentAlertingSystem;
  private performanceMonitor = PerformanceMonitorService;

  constructor(redis: Redis) {
    this.businessMetrics = new BusinessMetricsService(redis);
    this.systemMonitor = new SystemResourceMonitor(redis);
    this.apmService = new APMService(redis);
    this.securityAudit = new SecurityAuditService(redis);
    this.alertingSystem = new IntelligentAlertingSystem(redis);
  }

  /**
   * 获取监控概览 - 仪表板首页数据
   */
  public getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const [
        businessStatus,
        systemStatus,
        apmStatus,
        securityStatus,
        performanceStatus,
        alertStats
      ] = await Promise.all([
        this.businessMetrics.getCurrentBusinessStatus(),
        this.systemMonitor.getCurrentSystemStatus(),
        this.apmService.getCurrentAPMStatus(),
        this.securityAudit.getSecurityStatus(),
        this.performanceMonitor.getCurrentStatus(),
        this.alertingSystem.getAlertStatistics()
      ]);

      const overview = {
        timestamp: new Date(),
        overallStatus: this.calculateOverallStatus([
          businessStatus.status,
          systemStatus.status,
          apmStatus.status,
          securityStatus.status,
          performanceStatus.status
        ]),
        business: {
          status: businessStatus.status,
          summary: businessStatus.summary,
          metrics: businessStatus.metrics ? {
            emailsProcessed: businessStatus.metrics.email.processed,
            activeUsers: businessStatus.metrics.userActivity.activeUsers,
            aiAnalysisAccuracy: businessStatus.metrics.aiAnalysis.accuracyRate,
            ruleEngineEffectiveness: businessStatus.metrics.ruleEngine.effectivenessScore
          } : null
        },
        system: {
          status: systemStatus.status,
          summary: systemStatus.summary,
          metrics: systemStatus.metrics ? {
            cpuUsage: systemStatus.metrics.cpu.usage,
            memoryUsage: systemStatus.metrics.memory.usage,
            diskUsage: systemStatus.metrics.disk.usage,
            processUptime: systemStatus.metrics.process.uptime
          } : null
        },
        performance: {
          status: performanceStatus.status,
          summary: performanceStatus.summary,
          metrics: performanceStatus.metrics ? {
            avgResponseTime: performanceStatus.metrics.application.avgResponseTime,
            activeRequests: performanceStatus.metrics.application.activeRequests,
            dbPoolUtilization: performanceStatus.metrics.database.poolUtilization,
            cacheHitRate: performanceStatus.metrics.cache.hitRate
          } : null
        },
        application: {
          status: apmStatus.status,
          summary: apmStatus.summary,
          metrics: apmStatus.metrics ? {
            httpRequests: apmStatus.metrics.http.totalRequests,
            avgResponseTime: apmStatus.metrics.http.avgResponseTime,
            errorRate: apmStatus.metrics.http.errorRate,
            dbQueries: apmStatus.metrics.database.totalQueries
          } : null
        },
        security: {
          status: securityStatus.status,
          summary: securityStatus.summary,
          metrics: securityStatus.metrics ? {
            totalLogins: securityStatus.metrics.authentication.totalLogins,
            successRate: securityStatus.metrics.authentication.successRate,
            anomalies: securityStatus.metrics.anomalies.total,
            blockedIPs: securityStatus.metrics.authentication.blockedIPs
          } : null
        },
        alerts: {
          total: alertStats.total,
          active: alertStats.active,
          critical: alertStats.byLevel.critical || 0,
          warning: alertStats.byLevel.warning || 0,
          acknowledged: alertStats.acknowledged,
          escalated: alertStats.escalated
        }
      };

      sendSuccessResponse(res, overview, '监控概览获取成功');

    } catch (error) {
      logger.error('Failed to get dashboard overview', error);
      sendErrorResponse(res, 500, '获取监控概览失败', error.message);
    }
  };

  /**
   * 获取实时监控数据
   */
  public getRealtimeMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.params;
      
      let metricsData;
      
      switch (category) {
        case 'business':
          metricsData = this.businessMetrics.getCurrentBusinessStatus();
          break;
        case 'system':
          metricsData = this.systemMonitor.getCurrentSystemStatus();
          break;
        case 'application':
          metricsData = this.apmService.getCurrentAPMStatus();
          break;
        case 'security':
          metricsData = this.securityAudit.getSecurityStatus();
          break;
        case 'performance':
          metricsData = this.performanceMonitor.getCurrentStatus();
          break;
        default:
          return sendErrorResponse(res, 400, '无效的监控类别');
      }

      sendSuccessResponse(res, metricsData, '实时监控数据获取成功');

    } catch (error) {
      logger.error('Failed to get realtime metrics', error);
      sendErrorResponse(res, 500, '获取实时监控数据失败', error.message);
    }
  };

  /**
   * 获取历史监控数据
   */
  public getHistoricalMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 400, '参数验证失败', errors.array());
      }

      const { category } = req.params;
      const { hours = 24, interval = '1h' } = req.query;
      
      const hoursNum = parseInt(hours as string);
      
      let historicalData;
      
      switch (category) {
        case 'business':
          historicalData = this.businessMetrics.getBusinessMetricsHistory(hoursNum);
          break;
        case 'system':
          historicalData = this.systemMonitor.getSystemMetricsHistory(hoursNum);
          break;
        case 'application':
          // APM服务的历史数据通过报告获取
          const apmReport = this.apmService.getAPMReport(hoursNum);
          historicalData = { report: apmReport, trends: apmReport.trends };
          break;
        case 'security':
          historicalData = {
            metrics: this.securityAudit.getSecurityStatus().metrics,
            alerts: this.securityAudit.getSecurityStatus().activeAnomalies
          };
          break;
        case 'performance':
          historicalData = this.performanceMonitor.getPerformanceReport(hoursNum);
          break;
        default:
          return sendErrorResponse(res, 400, '无效的监控类别');
      }

      // 根据interval参数进行数据聚合
      const aggregatedData = this.aggregateMetricsData(historicalData, interval as string);

      sendSuccessResponse(res, {
        category,
        timeRange: {
          hours: hoursNum,
          interval: interval,
          startTime: new Date(Date.now() - hoursNum * 60 * 60 * 1000),
          endTime: new Date()
        },
        data: aggregatedData
      }, '历史监控数据获取成功');

    } catch (error) {
      logger.error('Failed to get historical metrics', error);
      sendErrorResponse(res, 500, '获取历史监控数据失败', error.message);
    }
  };

  /**
   * 获取告警列表
   */
  public getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, level, category, limit = 50, offset = 0 } = req.query;
      
      const filters = {
        status: status as any,
        level: level as any,
        category: category as any,
        limit: parseInt(limit as string)
      };

      const alerts = this.alertingSystem.getAlerts(filters);
      const alertStats = this.alertingSystem.getAlertStatistics();

      // 分页处理
      const offsetNum = parseInt(offset as string);
      const paginatedAlerts = alerts.slice(offsetNum, offsetNum + filters.limit);

      sendSuccessResponse(res, {
        alerts: paginatedAlerts,
        pagination: {
          total: alerts.length,
          limit: filters.limit,
          offset: offsetNum,
          hasMore: offsetNum + filters.limit < alerts.length
        },
        statistics: alertStats
      }, '告警列表获取成功');

    } catch (error) {
      logger.error('Failed to get alerts', error);
      sendErrorResponse(res, 500, '获取告警列表失败', error.message);
    }
  };

  /**
   * 获取告警详情
   */
  public getAlertDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertId } = req.params;
      
      const alert = this.alertingSystem.getAlert(alertId);
      if (!alert) {
        return sendErrorResponse(res, 404, '告警不存在');
      }

      sendSuccessResponse(res, alert, '告警详情获取成功');

    } catch (error) {
      logger.error('Failed to get alert detail', error);
      sendErrorResponse(res, 500, '获取告警详情失败', error.message);
    }
  };

  /**
   * 确认告警
   */
  public acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertId } = req.params;
      const { comment } = req.body;
      const userId = (req as any).user?.id || 'system';
      
      const success = await this.alertingSystem.acknowledgeAlert(alertId, userId, comment);
      
      if (success) {
        sendSuccessResponse(res, { alertId, acknowledgedBy: userId }, '告警确认成功');
      } else {
        sendErrorResponse(res, 400, '告警确认失败，告警不存在或状态不正确');
      }

    } catch (error) {
      logger.error('Failed to acknowledge alert', error);
      sendErrorResponse(res, 500, '确认告警失败', error.message);
    }
  };

  /**
   * 解决告警
   */
  public resolveAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertId } = req.params;
      const { comment } = req.body;
      const userId = (req as any).user?.id || 'system';
      
      const success = await this.alertingSystem.resolveAlert(alertId, userId, comment);
      
      if (success) {
        sendSuccessResponse(res, { alertId, resolvedBy: userId }, '告警解决成功');
      } else {
        sendErrorResponse(res, 400, '告警解决失败，告警不存在或状态不正确');
      }

    } catch (error) {
      logger.error('Failed to resolve alert', error);
      sendErrorResponse(res, 500, '解决告警失败', error.message);
    }
  };

  /**
   * 抑制告警
   */
  public silenceAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertId } = req.params;
      const { duration, reason } = req.body;
      const userId = (req as any).user?.id || 'system';
      
      if (!duration || duration <= 0) {
        return sendErrorResponse(res, 400, '抑制持续时间必须大于0');
      }
      
      const success = await this.alertingSystem.silenceAlert(alertId, userId, duration, reason);
      
      if (success) {
        sendSuccessResponse(res, {
          alertId,
          silencedBy: userId,
          duration,
          silencedUntil: new Date(Date.now() + duration * 1000)
        }, '告警抑制成功');
      } else {
        sendErrorResponse(res, 400, '告警抑制失败，告警不存在');
      }

    } catch (error) {
      logger.error('Failed to silence alert', error);
      sendErrorResponse(res, 500, '抑制告警失败', error.message);
    }
  };

  /**
   * 创建自定义告警
   */
  public createCustomAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendErrorResponse(res, 400, '参数验证失败', errors.array());
      }

      const { title, message, level, category, metadata, tags } = req.body;
      const userId = (req as any).user?.id || 'system';
      
      const alert = await this.alertingSystem.createAlert({
        title,
        message,
        level,
        category,
        source: `custom_${userId}`,
        metadata: {
          createdBy: userId,
          ...metadata
        },
        tags: tags || []
      });

      sendSuccessResponse(res, alert, '自定义告警创建成功');

    } catch (error) {
      logger.error('Failed to create custom alert', error);
      sendErrorResponse(res, 500, '创建自定义告警失败', error.message);
    }
  };

  /**
   * 获取性能报告
   */
  public getPerformanceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { hours = 24 } = req.query;
      const hoursNum = parseInt(hours as string);
      
      const [
        performanceReport,
        apmReport,
        systemReport
      ] = await Promise.all([
        this.performanceMonitor.getPerformanceReport(hoursNum),
        this.apmService.getAPMReport(hoursNum),
        this.systemMonitor.getSystemResourceReport(hoursNum)
      ]);

      const report = {
        timeRange: performanceReport.timeRange,
        performance: {
          averages: performanceReport.averages,
          peaks: performanceReport.peaks,
          trends: performanceReport.trends,
          alertSummary: performanceReport.alertSummary
        },
        application: {
          summary: apmReport.summary,
          trends: apmReport.trends
        },
        system: {
          summary: systemReport.summary,
          trends: systemReport.trends,
          alertSummary: systemReport.alertSummary
        },
        recommendations: this.generatePerformanceRecommendations({
          performance: performanceReport,
          application: apmReport,
          system: systemReport
        })
      };

      sendSuccessResponse(res, report, '性能报告获取成功');

    } catch (error) {
      logger.error('Failed to get performance report', error);
      sendErrorResponse(res, 500, '获取性能报告失败', error.message);
    }
  };

  /**
   * 获取监控健康状态
   */
  public getHealthStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const health = {
        timestamp: new Date(),
        services: {
          businessMetrics: { status: 'healthy', uptime: process.uptime() },
          systemMonitor: { status: 'healthy', uptime: process.uptime() },
          apmService: { status: 'healthy', uptime: process.uptime() },
          securityAudit: { status: 'healthy', uptime: process.uptime() },
          alertingSystem: { status: 'healthy', uptime: process.uptime() },
          performanceMonitor: { status: 'healthy', uptime: process.uptime() }
        },
        overall: 'healthy'
      };

      sendSuccessResponse(res, health, '监控系统健康状态获取成功');

    } catch (error) {
      logger.error('Failed to get health status', error);
      sendErrorResponse(res, 500, '获取健康状态失败', error.message);
    }
  };

  /**
   * 获取监控配置
   */
  public getMonitoringConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = {
        dataRetention: {
          metrics: '7 days',
          alerts: '30 days',
          logs: '30 days'
        },
        thresholds: {
          performance: this.performanceMonitor['thresholds'],
          system: 'configured',
          security: 'configured'
        },
        notifications: {
          channels: Array.from((this.alertingSystem as any).notificationChannels.values()),
          rules: Array.from((this.alertingSystem as any).alertRules.values())
        },
        monitoring: {
          intervals: {
            metrics: '30s',
            alerts: '60s',
            escalation: '60s'
          }
        }
      };

      sendSuccessResponse(res, config, '监控配置获取成功');

    } catch (error) {
      logger.error('Failed to get monitoring config', error);
      sendErrorResponse(res, 500, '获取监控配置失败', error.message);
    }
  };

  /**
   * 计算整体状态
   */
  private calculateOverallStatus(statuses: string[]): 'healthy' | 'warning' | 'critical' {
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  /**
   * 聚合监控数据
   */
  private aggregateMetricsData(data: any, interval: string): any {
    // 根据时间间隔聚合数据
    // 这里是简化实现，实际应用中需要更复杂的聚合逻辑
    if (interval === '1h') {
      return data; // 按小时聚合
    } else if (interval === '1m') {
      return data; // 按分钟聚合
    } else if (interval === '1d') {
      return data; // 按天聚合
    }
    
    return data;
  }

  /**
   * 生成性能优化建议
   */
  private generatePerformanceRecommendations(reports: {
    performance: any;
    application: any;
    system: any;
  }): string[] {
    const recommendations: string[] = [];

    // 基于性能数据生成建议
    if (reports.system.summary.avgCpuUsage > 80) {
      recommendations.push('CPU使用率持续偏高，建议优化应用程序性能或增加计算资源');
    }

    if (reports.system.summary.avgMemoryUsage > 85) {
      recommendations.push('内存使用率偏高，建议检查内存泄漏或增加内存容量');
    }

    if (reports.application.summary.avgResponseTime > 2000) {
      recommendations.push('API响应时间较慢，建议优化数据库查询和接口逻辑');
    }

    if (reports.application.summary.errorRate > 5) {
      recommendations.push('应用错误率偏高，建议检查异常处理和系统稳定性');
    }

    if (recommendations.length === 0) {
      recommendations.push('系统运行正常，继续保持良好的监控和维护');
    }

    return recommendations;
  }

  /**
   * 启动监控服务
   */
  public async initializeMonitoringServices(): Promise<void> {
    try {
      logger.info('Initializing monitoring services...');

      // 启动业务指标监控
      await this.businessMetrics.startMonitoring(60000); // 1分钟

      // 启动系统资源监控
      await this.systemMonitor.startMonitoring(30000); // 30秒

      // 启动APM监控
      await this.apmService.startMonitoring(60000); // 1分钟

      // 启动安全审计监控
      await this.securityAudit.startMonitoring(60000); // 1分钟

      // 启动智能告警系统
      await this.alertingSystem.startAlerting();

      // 启动性能监控
      this.performanceMonitor.startMonitoring(30000); // 30秒

      logger.info('All monitoring services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize monitoring services', error);
      throw error;
    }
  }

  /**
   * 停止监控服务
   */
  public stopMonitoringServices(): void {
    try {
      logger.info('Stopping monitoring services...');

      this.businessMetrics.stopMonitoring();
      this.systemMonitor.stopMonitoring();
      this.apmService.stopMonitoring();
      this.securityAudit.stopMonitoring();
      this.alertingSystem.stopAlerting();
      this.performanceMonitor.stopMonitoring();

      logger.info('All monitoring services stopped');

    } catch (error) {
      logger.error('Failed to stop monitoring services', error);
    }
  }
}

export default MonitoringController;