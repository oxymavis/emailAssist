/**
 * Business Metrics Service
 * 业务指标监控服务，提供邮件处理、用户活跃度、AI分析效果等业务层面的监控
 */

import EventEmitter from 'events';
import DatabaseManager from '@/config/database';
import logger from '@/utils/logger';
import { Redis } from 'ioredis';

export interface EmailMetrics {
  timestamp: Date;
  processed: number;        // 已处理邮件数量
  received: number;         // 接收邮件数量
  sent: number;            // 发送邮件数量
  analyzed: number;        // AI分析邮件数量
  filtered: number;        // 过滤邮件数量
  avgProcessingTime: number; // 平均处理时间(ms)
  errorRate: number;       // 错误率(%)
}

export interface UserActivityMetrics {
  timestamp: Date;
  activeUsers: number;      // 活跃用户数
  totalLogins: number;      // 总登录次数
  newUsers: number;         // 新注册用户数
  avgSessionDuration: number; // 平均会话时长(分钟)
  totalOperations: number;  // 总操作次数
  peakConcurrentUsers: number; // 峰值并发用户数
}

export interface AIAnalysisMetrics {
  timestamp: Date;
  totalAnalyses: number;    // 总分析次数
  accuracyRate: number;     // 准确率(%)
  avgAnalysisTime: number;  // 平均分析时间(ms)
  sentimentAccuracy: number; // 情感分析准确率(%)
  urgencyAccuracy: number;  // 紧急性判断准确率(%)
  categoryAccuracy: number; // 分类准确率(%)
  errorRate: number;        // AI分析错误率(%)
}

export interface RuleEngineMetrics {
  timestamp: Date;
  totalExecutions: number;  // 总执行次数
  successfulExecutions: number; // 成功执行次数
  failedExecutions: number; // 失败执行次数
  avgExecutionTime: number; // 平均执行时间(ms)
  rulesTriggered: number;   // 规则触发次数
  emailsProcessed: number;  // 处理的邮件数量
  effectivenessScore: number; // 规则有效性评分(0-100)
}

export interface ReportMetrics {
  timestamp: Date;
  generatedReports: number; // 生成的报告数量
  avgGenerationTime: number; // 平均生成时间(ms)
  successRate: number;      // 成功率(%)
  scheduledReports: number; // 定时报告数量
  onDemandReports: number;  // 按需报告数量
  exportCount: number;      // 导出次数
}

export interface BusinessMetricsSnapshot {
  timestamp: Date;
  email: EmailMetrics;
  userActivity: UserActivityMetrics;
  aiAnalysis: AIAnalysisMetrics;
  ruleEngine: RuleEngineMetrics;
  reports: ReportMetrics;
}

export interface BusinessAlert {
  id: string;
  type: 'email' | 'user_activity' | 'ai_analysis' | 'rule_engine' | 'reports';
  level: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
  context?: Record<string, any>;
}

export class BusinessMetricsService extends EventEmitter {
  private redis: Redis;
  private metrics: BusinessMetricsSnapshot[] = [];
  private alerts: BusinessAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly MAX_METRICS_HISTORY = 4320; // 3天，每分钟一次
  private readonly MAX_ALERTS_HISTORY = 2000;
  
  // 业务阈值配置
  private readonly thresholds = {
    email: {
      errorRate: { warning: 5, critical: 10 }, // 邮件处理错误率
      avgProcessingTime: { warning: 5000, critical: 10000 }, // 平均处理时间
      dailyProcessed: { warning: 1000, critical: 500 } // 每日最少处理量
    },
    userActivity: {
      activeUsers: { warning: 50, critical: 20 }, // 最少活跃用户数
      avgSessionDuration: { warning: 5, critical: 2 }, // 最短平均会话时长
    },
    aiAnalysis: {
      accuracyRate: { warning: 80, critical: 70 }, // 最低准确率
      avgAnalysisTime: { warning: 3000, critical: 5000 }, // 最长分析时间
      errorRate: { warning: 5, critical: 10 } // 最高错误率
    },
    ruleEngine: {
      successRate: { warning: 90, critical: 80 }, // 最低成功率
      avgExecutionTime: { warning: 1000, critical: 2000 }, // 最长执行时间
      effectivenessScore: { warning: 70, critical: 50 } // 最低有效性评分
    },
    reports: {
      successRate: { warning: 95, critical: 90 }, // 最低成功率
      avgGenerationTime: { warning: 30000, critical: 60000 } // 最长生成时间
    }
  };

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * 启动业务指标监控
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting business metrics monitoring', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      await this.collectBusinessMetrics();
    }, intervalMs);

    // 立即收集一次指标
    await this.collectBusinessMetrics();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Business metrics monitoring stopped');
  }

  /**
   * 收集业务指标
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      
      const emailMetrics = await this.collectEmailMetrics(timestamp);
      const userActivityMetrics = await this.collectUserActivityMetrics(timestamp);
      const aiAnalysisMetrics = await this.collectAIAnalysisMetrics(timestamp);
      const ruleEngineMetrics = await this.collectRuleEngineMetrics(timestamp);
      const reportMetrics = await this.collectReportMetrics(timestamp);

      const snapshot: BusinessMetricsSnapshot = {
        timestamp,
        email: emailMetrics,
        userActivity: userActivityMetrics,
        aiAnalysis: aiAnalysisMetrics,
        ruleEngine: ruleEngineMetrics,
        reports: reportMetrics
      };

      // 存储指标
      this.metrics.push(snapshot);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // 检查阈值并生成告警
      await this.checkBusinessThresholds(snapshot);

      // 缓存最新指标
      await this.cacheMetrics(snapshot);

      // 发出事件
      this.emit('businessMetrics', snapshot);

      logger.debug('Business metrics collected successfully', {
        timestamp: timestamp.toISOString(),
        emailProcessed: emailMetrics.processed,
        activeUsers: userActivityMetrics.activeUsers,
        aiAnalyses: aiAnalysisMetrics.totalAnalyses
      });

    } catch (error) {
      logger.error('Failed to collect business metrics', error);
    }
  }

  /**
   * 收集邮件相关指标
   */
  private async collectEmailMetrics(timestamp: Date): Promise<EmailMetrics> {
    const db = DatabaseManager;
    const now = timestamp;
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // 查询最近一小时的邮件处理数据
      const emailStats = await db.query(`
        SELECT 
          COUNT(*) as total_processed,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as recent_received,
          COUNT(CASE WHEN status = 'sent' AND updated_at >= $1 THEN 1 END) as recent_sent,
          COUNT(CASE WHEN analysis_completed_at >= $1 THEN 1 END) as recent_analyzed,
          COUNT(CASE WHEN filter_applied_at >= $1 THEN 1 END) as recent_filtered,
          AVG(CASE WHEN processing_duration IS NOT NULL THEN processing_duration END) as avg_processing_time,
          COUNT(CASE WHEN status = 'error' AND updated_at >= $1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as error_rate
        FROM email_messages 
        WHERE created_at >= $1
      `, [oneHourAgo]);

      const stats = emailStats.rows[0] || {};

      return {
        timestamp,
        processed: parseInt(stats.total_processed) || 0,
        received: parseInt(stats.recent_received) || 0,
        sent: parseInt(stats.recent_sent) || 0,
        analyzed: parseInt(stats.recent_analyzed) || 0,
        filtered: parseInt(stats.recent_filtered) || 0,
        avgProcessingTime: parseFloat(stats.avg_processing_time) || 0,
        errorRate: parseFloat(stats.error_rate) || 0
      };

    } catch (error) {
      logger.error('Failed to collect email metrics', error);
      return {
        timestamp,
        processed: 0,
        received: 0,
        sent: 0,
        analyzed: 0,
        filtered: 0,
        avgProcessingTime: 0,
        errorRate: 0
      };
    }
  }

  /**
   * 收集用户活跃度指标
   */
  private async collectUserActivityMetrics(timestamp: Date): Promise<UserActivityMetrics> {
    const db = DatabaseManager;
    const now = timestamp;
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // 查询用户活跃度数据
      const userStats = await db.query(`
        SELECT 
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as total_logins,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_users,
          AVG(CASE WHEN logout_time IS NOT NULL THEN EXTRACT(EPOCH FROM (logout_time - login_time))/60 END) as avg_session_duration
        FROM user_sessions 
        WHERE login_time >= $2
        UNION ALL
        SELECT 
          COUNT(DISTINCT user_id) as daily_active_users,
          0, 0, 0
        FROM user_activities 
        WHERE created_at >= $1
      `, [oneHourAgo, oneDayAgo]);

      const operationsStats = await db.query(`
        SELECT COUNT(*) as total_operations
        FROM user_activities 
        WHERE created_at >= $1
      `, [oneHourAgo]);

      // 获取峰值并发用户数
      const concurrentUsers = await this.redis.get('peak_concurrent_users') || '0';

      const stats = userStats.rows[0] || {};
      const operations = operationsStats.rows[0] || {};

      return {
        timestamp,
        activeUsers: parseInt(stats.active_users) || 0,
        totalLogins: parseInt(stats.total_logins) || 0,
        newUsers: parseInt(stats.new_users) || 0,
        avgSessionDuration: parseFloat(stats.avg_session_duration) || 0,
        totalOperations: parseInt(operations.total_operations) || 0,
        peakConcurrentUsers: parseInt(concurrentUsers)
      };

    } catch (error) {
      logger.error('Failed to collect user activity metrics', error);
      return {
        timestamp,
        activeUsers: 0,
        totalLogins: 0,
        newUsers: 0,
        avgSessionDuration: 0,
        totalOperations: 0,
        peakConcurrentUsers: 0
      };
    }
  }

  /**
   * 收集AI分析指标
   */
  private async collectAIAnalysisMetrics(timestamp: Date): Promise<AIAnalysisMetrics> {
    const db = DatabaseManager;
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

    try {
      const aiStats = await db.query(`
        SELECT 
          COUNT(*) as total_analyses,
          AVG(processing_duration) as avg_analysis_time,
          AVG(CASE WHEN sentiment_accuracy IS NOT NULL THEN sentiment_accuracy END) as sentiment_accuracy,
          AVG(CASE WHEN urgency_accuracy IS NOT NULL THEN urgency_accuracy END) as urgency_accuracy,
          AVG(CASE WHEN category_accuracy IS NOT NULL THEN category_accuracy END) as category_accuracy,
          COUNT(CASE WHEN status = 'error' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as error_rate
        FROM email_analyses 
        WHERE created_at >= $1
      `, [oneHourAgo]);

      const stats = aiStats.rows[0] || {};
      
      // 计算综合准确率
      const sentimentAcc = parseFloat(stats.sentiment_accuracy) || 0;
      const urgencyAcc = parseFloat(stats.urgency_accuracy) || 0;
      const categoryAcc = parseFloat(stats.category_accuracy) || 0;
      const accuracyRate = (sentimentAcc + urgencyAcc + categoryAcc) / 3;

      return {
        timestamp,
        totalAnalyses: parseInt(stats.total_analyses) || 0,
        accuracyRate: accuracyRate || 0,
        avgAnalysisTime: parseFloat(stats.avg_analysis_time) || 0,
        sentimentAccuracy: sentimentAcc,
        urgencyAccuracy: urgencyAcc,
        categoryAccuracy: categoryAcc,
        errorRate: parseFloat(stats.error_rate) || 0
      };

    } catch (error) {
      logger.error('Failed to collect AI analysis metrics', error);
      return {
        timestamp,
        totalAnalyses: 0,
        accuracyRate: 0,
        avgAnalysisTime: 0,
        sentimentAccuracy: 0,
        urgencyAccuracy: 0,
        categoryAccuracy: 0,
        errorRate: 0
      };
    }
  }

  /**
   * 收集规则引擎指标
   */
  private async collectRuleEngineMetrics(timestamp: Date): Promise<RuleEngineMetrics> {
    const db = DatabaseManager;
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

    try {
      const ruleStats = await db.query(`
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
          AVG(execution_duration) as avg_execution_time,
          COUNT(CASE WHEN rule_triggered = true THEN 1 END) as rules_triggered,
          COUNT(DISTINCT email_id) as emails_processed,
          AVG(effectiveness_score) as effectiveness_score
        FROM rule_execution_logs 
        WHERE created_at >= $1
      `, [oneHourAgo]);

      const stats = ruleStats.rows[0] || {};

      return {
        timestamp,
        totalExecutions: parseInt(stats.total_executions) || 0,
        successfulExecutions: parseInt(stats.successful_executions) || 0,
        failedExecutions: parseInt(stats.failed_executions) || 0,
        avgExecutionTime: parseFloat(stats.avg_execution_time) || 0,
        rulesTriggered: parseInt(stats.rules_triggered) || 0,
        emailsProcessed: parseInt(stats.emails_processed) || 0,
        effectivenessScore: parseFloat(stats.effectiveness_score) || 0
      };

    } catch (error) {
      logger.error('Failed to collect rule engine metrics', error);
      return {
        timestamp,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        rulesTriggered: 0,
        emailsProcessed: 0,
        effectivenessScore: 0
      };
    }
  }

  /**
   * 收集报告指标
   */
  private async collectReportMetrics(timestamp: Date): Promise<ReportMetrics> {
    const db = DatabaseManager;
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

    try {
      const reportStats = await db.query(`
        SELECT 
          COUNT(*) as generated_reports,
          AVG(generation_duration) as avg_generation_time,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as success_rate,
          COUNT(CASE WHEN type = 'scheduled' THEN 1 END) as scheduled_reports,
          COUNT(CASE WHEN type = 'on_demand' THEN 1 END) as on_demand_reports,
          COUNT(CASE WHEN exported_at IS NOT NULL THEN 1 END) as export_count
        FROM reports 
        WHERE created_at >= $1
      `, [oneHourAgo]);

      const stats = reportStats.rows[0] || {};

      return {
        timestamp,
        generatedReports: parseInt(stats.generated_reports) || 0,
        avgGenerationTime: parseFloat(stats.avg_generation_time) || 0,
        successRate: parseFloat(stats.success_rate) || 0,
        scheduledReports: parseInt(stats.scheduled_reports) || 0,
        onDemandReports: parseInt(stats.on_demand_reports) || 0,
        exportCount: parseInt(stats.export_count) || 0
      };

    } catch (error) {
      logger.error('Failed to collect report metrics', error);
      return {
        timestamp,
        generatedReports: 0,
        avgGenerationTime: 0,
        successRate: 100, // 默认成功率
        scheduledReports: 0,
        onDemandReports: 0,
        exportCount: 0
      };
    }
  }

  /**
   * 检查业务阈值并生成告警
   */
  private async checkBusinessThresholds(snapshot: BusinessMetricsSnapshot): Promise<void> {
    const checks = [
      {
        type: 'email' as const,
        checks: [
          {
            metric: 'errorRate',
            value: snapshot.email.errorRate,
            thresholds: this.thresholds.email.errorRate,
            message: `邮件处理错误率: ${snapshot.email.errorRate.toFixed(2)}%`
          },
          {
            metric: 'avgProcessingTime',
            value: snapshot.email.avgProcessingTime,
            thresholds: this.thresholds.email.avgProcessingTime,
            message: `邮件平均处理时间: ${snapshot.email.avgProcessingTime.toFixed(0)}ms`
          }
        ]
      },
      {
        type: 'user_activity' as const,
        checks: [
          {
            metric: 'activeUsers',
            value: snapshot.userActivity.activeUsers,
            thresholds: this.thresholds.userActivity.activeUsers,
            comparison: 'less' as const,
            message: `活跃用户数: ${snapshot.userActivity.activeUsers}`
          }
        ]
      },
      {
        type: 'ai_analysis' as const,
        checks: [
          {
            metric: 'accuracyRate',
            value: snapshot.aiAnalysis.accuracyRate,
            thresholds: this.thresholds.aiAnalysis.accuracyRate,
            comparison: 'less' as const,
            message: `AI分析准确率: ${snapshot.aiAnalysis.accuracyRate.toFixed(2)}%`
          },
          {
            metric: 'errorRate',
            value: snapshot.aiAnalysis.errorRate,
            thresholds: this.thresholds.aiAnalysis.errorRate,
            message: `AI分析错误率: ${snapshot.aiAnalysis.errorRate.toFixed(2)}%`
          }
        ]
      },
      {
        type: 'rule_engine' as const,
        checks: [
          {
            metric: 'effectivenessScore',
            value: snapshot.ruleEngine.effectivenessScore,
            thresholds: this.thresholds.ruleEngine.effectivenessScore,
            comparison: 'less' as const,
            message: `规则引擎有效性评分: ${snapshot.ruleEngine.effectivenessScore.toFixed(2)}`
          }
        ]
      }
    ];

    for (const checkGroup of checks) {
      for (const check of checkGroup.checks) {
        await this.evaluateThreshold(checkGroup.type, check, snapshot);
      }
    }
  }

  /**
   * 评估单个阈值
   */
  private async evaluateThreshold(
    type: BusinessAlert['type'],
    check: {
      metric: string;
      value: number;
      thresholds: { warning: number; critical: number };
      comparison?: 'greater' | 'less';
      message: string;
    },
    snapshot: BusinessMetricsSnapshot
  ): Promise<void> {
    const { metric, value, thresholds, comparison = 'greater', message } = check;
    
    let alertLevel: 'warning' | 'critical' | null = null;
    let threshold: number = 0;

    if (comparison === 'greater') {
      if (value >= thresholds.critical) {
        alertLevel = 'critical';
        threshold = thresholds.critical;
      } else if (value >= thresholds.warning) {
        alertLevel = 'warning';
        threshold = thresholds.warning;
      }
    } else {
      if (value <= thresholds.critical) {
        alertLevel = 'critical';
        threshold = thresholds.critical;
      } else if (value <= thresholds.warning) {
        alertLevel = 'warning';
        threshold = thresholds.warning;
      }
    }

    if (alertLevel) {
      await this.createBusinessAlert(type, alertLevel, metric, message, value, threshold, snapshot);
    }
  }

  /**
   * 创建业务告警
   */
  private async createBusinessAlert(
    type: BusinessAlert['type'],
    level: 'warning' | 'critical',
    metric: string,
    message: string,
    value: number,
    threshold: number,
    snapshot: BusinessMetricsSnapshot
  ): Promise<void> {
    const alertId = `${type}_${metric}_${level}_${Date.now()}`;
    
    // 检查是否存在相同的未解决告警
    const existingAlert = this.alerts.find(alert =>
      alert.type === type &&
      alert.metric === metric &&
      alert.level === level &&
      !alert.resolved
    );

    if (existingAlert) return; // 避免重复告警

    const alert: BusinessAlert = {
      id: alertId,
      type,
      level,
      metric,
      message,
      value,
      threshold,
      timestamp: new Date(),
      context: {
        snapshot: {
          emailProcessed: snapshot.email.processed,
          activeUsers: snapshot.userActivity.activeUsers,
          aiAnalyses: snapshot.aiAnalysis.totalAnalyses,
          ruleExecutions: snapshot.ruleEngine.totalExecutions
        }
      }
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts.shift();
    }

    // 缓存告警信息
    await this.cacheAlert(alert);

    this.emit('businessAlert', alert);
    
    if (level === 'critical') {
      logger.error('Critical business alert', alert);
    } else {
      logger.warn('Business warning', alert);
    }
  }

  /**
   * 缓存指标数据
   */
  private async cacheMetrics(snapshot: BusinessMetricsSnapshot): Promise<void> {
    try {
      const cacheKey = `business_metrics:latest`;
      const metricsData = JSON.stringify(snapshot);
      await this.redis.setex(cacheKey, 3600, metricsData); // 缓存1小时

      // 存储时序数据
      const timeSeriesKey = `business_metrics:${snapshot.timestamp.toISOString().split('T')[0]}`;
      await this.redis.zadd(timeSeriesKey, snapshot.timestamp.getTime(), metricsData);
      await this.redis.expire(timeSeriesKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to cache business metrics', error);
    }
  }

  /**
   * 缓存告警信息
   */
  private async cacheAlert(alert: BusinessAlert): Promise<void> {
    try {
      const alertKey = `business_alerts:${alert.type}`;
      const alertData = JSON.stringify(alert);
      await this.redis.zadd(alertKey, alert.timestamp.getTime(), alertData);
      await this.redis.expire(alertKey, 30 * 24 * 3600); // 保存30天

    } catch (error) {
      logger.error('Failed to cache business alert', error);
    }
  }

  /**
   * 获取当前业务状态
   */
  getCurrentBusinessStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: BusinessMetricsSnapshot | null;
    activeAlerts: BusinessAlert[];
    summary: string;
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1] || null;
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (activeAlerts.some(alert => alert.level === 'critical')) {
      status = 'critical';
    } else if (activeAlerts.some(alert => alert.level === 'warning')) {
      status = 'warning';
    }

    const summary = this.generateBusinessStatusSummary(status, activeAlerts.length, currentMetrics);

    return {
      status,
      metrics: currentMetrics,
      activeAlerts,
      summary
    };
  }

  /**
   * 生成业务状态摘要
   */
  private generateBusinessStatusSummary(
    status: string,
    alertCount: number,
    metrics: BusinessMetricsSnapshot | null
  ): string {
    if (status === 'critical') {
      return `业务状态严重：存在${alertCount}个严重告警，业务功能受到影响`;
    } else if (status === 'warning') {
      return `业务状态警告：存在${alertCount}个告警，建议及时处理`;
    } else {
      if (!metrics) {
        return '业务监控正在初始化中';
      }
      return `业务运行正常：已处理${metrics.email.processed}封邮件，` +
             `${metrics.userActivity.activeUsers}个活跃用户，` +
             `AI分析准确率${metrics.aiAnalysis.accuracyRate.toFixed(1)}%`;
    }
  }

  /**
   * 获取业务指标历史
   */
  getBusinessMetricsHistory(hours: number = 24): BusinessMetricsSnapshot[] {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    return this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * 获取业务告警历史
   */
  getBusinessAlertsHistory(hours: number = 24): BusinessAlert[] {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    return this.alerts.filter(a => 
      a.timestamp >= startTime && a.timestamp <= endTime
    );
  }

  /**
   * 解决业务告警
   */
  resolveBusinessAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
    if (alert) {
      alert.resolved = new Date();
      this.emit('businessAlertResolved', alert);
      logger.info('Business alert resolved', { alertId, type: alert.type, metric: alert.metric });
      return true;
    }
    return false;
  }

  /**
   * 更新用户会话计数
   */
  async updateConcurrentUsers(count: number): Promise<void> {
    try {
      const currentPeak = parseInt(await this.redis.get('peak_concurrent_users') || '0');
      if (count > currentPeak) {
        await this.redis.set('peak_concurrent_users', count.toString());
      }
      await this.redis.setex('current_concurrent_users', 300, count.toString()); // 5分钟过期
    } catch (error) {
      logger.error('Failed to update concurrent users', error);
    }
  }

  /**
   * 记录业务操作
   */
  async recordBusinessOperation(
    userId: string,
    operation: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const operationKey = `business_operations:${new Date().toISOString().split('T')[0]}`;
      const operationData = JSON.stringify({
        userId,
        operation,
        details,
        timestamp: new Date().toISOString()
      });
      
      await this.redis.zadd(operationKey, Date.now(), operationData);
      await this.redis.expire(operationKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to record business operation', error);
    }
  }
}

export default BusinessMetricsService;