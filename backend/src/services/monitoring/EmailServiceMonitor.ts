import { EventEmitter } from 'events';
import { 
  EmailProvider, 
  EmailAccount, 
  RateLimitStatus,
  ApiResponse
} from '../../types';
import { EmailServiceFactory } from '../email/EmailServiceFactory';
import { EmailSyncService } from '../email/EmailSyncService';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../database/DatabaseService';

/**
 * 邮件服务监控类
 * 监控邮件服务的健康状态、性能指标和错误情况
 */
export class EmailServiceMonitor extends EventEmitter {
  private static instance: EmailServiceMonitor;
  private emailServiceFactory: EmailServiceFactory;
  private syncService: EmailSyncService;
  private databaseService: DatabaseService;
  
  private healthChecks: Map<string, {
    lastCheck: Date;
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    error?: string;
  }> = new Map();

  private performanceMetrics: Map<string, {
    requestCount: number;
    avgResponseTime: number;
    errorRate: number;
    lastReset: Date;
  }> = new Map();

  private alertThresholds = {
    responseTime: 5000, // 5秒
    errorRate: 0.1, // 10%
    downtime: 30000, // 30秒
  };

  private constructor() {
    super();
    this.emailServiceFactory = EmailServiceFactory.getInstance();
    this.syncService = EmailSyncService.getInstance();
    this.databaseService = DatabaseService.getInstance();
    
    this.initializeMonitoring();
  }

  public static getInstance(): EmailServiceMonitor {
    if (!EmailServiceMonitor.instance) {
      EmailServiceMonitor.instance = new EmailServiceMonitor();
    }
    return EmailServiceMonitor.instance;
  }

  /**
   * 初始化监控
   */
  private initializeMonitoring(): void {
    // 监听邮件服务事件
    this.setupServiceEventListeners();
    
    // 启动定期健康检查
    setInterval(() => {
      this.performHealthChecks();
    }, 60000); // 每分钟检查一次

    // 启动性能指标重置
    setInterval(() => {
      this.resetPerformanceMetrics();
    }, 3600000); // 每小时重置一次
    
    logger.info('Email service monitoring initialized');
  }

  /**
   * 设置服务事件监听器
   */
  private setupServiceEventListeners(): void {
    // 监听API调用事件
    this.on('apiCall', (event) => {
      this.recordApiCall(event);
    });

    // 监听连接变化事件
    this.on('connectionChange', (event) => {
      this.handleConnectionChange(event);
    });

    // 监听同步事件
    this.syncService.on('syncCompleted', (event) => {
      this.recordSyncMetrics(event);
    });

    this.syncService.on('syncFailed', (event) => {
      this.handleSyncFailure(event);
    });
  }

  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const accounts = await this.databaseService.getActiveEmailAccounts();
      
      for (const account of accounts) {
        await this.checkAccountHealth(account);
      }
      
      // 检查整体服务状态
      await this.checkOverallHealth();
      
    } catch (error) {
      logger.error('Failed to perform health checks:', error);
    }
  }

  /**
   * 检查单个账户健康状态
   */
  private async checkAccountHealth(account: EmailAccount): Promise<void> {
    const accountKey = `${account.provider}:${account.id}`;
    const startTime = Date.now();
    
    try {
      const emailService = this.emailServiceFactory.getEmailService(
        account.provider,
        account.id
      );
      
      if (!emailService) {
        this.recordHealthCheck(accountKey, {
          status: 'down',
          responseTime: 0,
          error: 'Service not found'
        });
        return;
      }

      // 检查连接状态
      const isConnected = await emailService.isConnected();
      
      if (!isConnected) {
        this.recordHealthCheck(accountKey, {
          status: 'down',
          responseTime: Date.now() - startTime,
          error: 'Connection lost'
        });
        return;
      }

      // 尝试获取用户信息（轻量级操作）
      await emailService.getUserInfo();
      
      const responseTime = Date.now() - startTime;
      const status = responseTime > this.alertThresholds.responseTime ? 'degraded' : 'healthy';
      
      this.recordHealthCheck(accountKey, {
        status,
        responseTime
      });

    } catch (error) {
      this.recordHealthCheck(accountKey, {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error.message
      });
      
      this.handleServiceError(account, error as Error);
    }
  }

  /**
   * 检查整体服务健康状态
   */
  private async checkOverallHealth(): Promise<void> {
    const serviceStats = this.emailServiceFactory.getServiceStats();
    const syncStats = this.syncService.getSyncStats();
    
    // 计算健康分数
    const totalServices = serviceStats.totalServices;
    const connectedServices = serviceStats.connectedServices;
    const healthyServices = Array.from(this.healthChecks.values())
      .filter(check => check.status === 'healthy').length;
    
    const healthScore = totalServices > 0 
      ? (healthyServices / totalServices) * 100 
      : 100;

    const overallHealth = {
      score: healthScore,
      status: healthScore >= 90 ? 'healthy' : 
              healthScore >= 70 ? 'degraded' : 'critical',
      services: {
        total: totalServices,
        connected: connectedServices,
        healthy: healthyServices
      },
      sync: syncStats,
      timestamp: new Date()
    };

    this.emit('healthUpdate', overallHealth);
    
    // 记录到数据库
    await this.databaseService.recordHealthMetrics(overallHealth);
    
    logger.info('Overall health check completed', {
      score: healthScore,
      status: overallHealth.status
    });
  }

  /**
   * 记录健康检查结果
   */
  private recordHealthCheck(accountKey: string, result: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    error?: string;
  }): void {
    const previousCheck = this.healthChecks.get(accountKey);
    
    this.healthChecks.set(accountKey, {
      lastCheck: new Date(),
      ...result
    });

    // 如果状态发生变化，发送警报
    if (previousCheck && previousCheck.status !== result.status) {
      this.sendAlert({
        type: 'health_status_change',
        accountKey,
        previousStatus: previousCheck.status,
        currentStatus: result.status,
        error: result.error
      });
    }

    // 检查响应时间警报
    if (result.responseTime > this.alertThresholds.responseTime) {
      this.sendAlert({
        type: 'slow_response',
        accountKey,
        responseTime: result.responseTime,
        threshold: this.alertThresholds.responseTime
      });
    }
  }

  /**
   * 记录API调用
   */
  private recordApiCall(event: {
    provider: EmailProvider;
    operation: string;
    duration: number;
    success: boolean;
    error?: Error;
  }): void {
    const key = `${event.provider}:${event.operation}`;
    const metrics = this.performanceMetrics.get(key) || {
      requestCount: 0,
      avgResponseTime: 0,
      errorRate: 0,
      lastReset: new Date()
    };

    // 更新指标
    metrics.requestCount++;
    metrics.avgResponseTime = (
      (metrics.avgResponseTime * (metrics.requestCount - 1) + event.duration) / 
      metrics.requestCount
    );
    
    if (!event.success) {
      metrics.errorRate = (
        (metrics.errorRate * (metrics.requestCount - 1) + 1) / 
        metrics.requestCount
      );
    } else {
      metrics.errorRate = (
        (metrics.errorRate * (metrics.requestCount - 1)) / 
        metrics.requestCount
      );
    }

    this.performanceMetrics.set(key, metrics);

    // 检查错误率警报
    if (metrics.errorRate > this.alertThresholds.errorRate && 
        metrics.requestCount >= 10) {
      this.sendAlert({
        type: 'high_error_rate',
        provider: event.provider,
        operation: event.operation,
        errorRate: metrics.errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }
  }

  /**
   * 处理连接变化事件
   */
  private handleConnectionChange(event: {
    provider: EmailProvider;
    connected: boolean;
  }): void {
    if (!event.connected) {
      this.sendAlert({
        type: 'connection_lost',
        provider: event.provider,
        timestamp: new Date()
      });
    }

    logger.info('Connection status changed', event);
  }

  /**
   * 记录同步指标
   */
  private recordSyncMetrics(event: any): void {
    // 记录成功的同步操作
    logger.debug('Sync completed successfully', event);
  }

  /**
   * 处理同步失败
   */
  private handleSyncFailure(event: any): void {
    this.sendAlert({
      type: 'sync_failure',
      accountId: event.accountId,
      error: event.error,
      timestamp: new Date()
    });
  }

  /**
   * 处理服务错误
   */
  private handleServiceError(account: EmailAccount, error: Error): void {
    logger.error(`Service error for account ${account.id}:`, error);
    
    // 记录错误到数据库
    this.databaseService.logEmailError(account.id, {
      type: 'service_error',
      message: error.message,
      stack: error.stack,
      provider: account.provider,
      timestamp: new Date()
    });

    this.sendAlert({
      type: 'service_error',
      accountId: account.id,
      provider: account.provider,
      error: error.message
    });
  }

  /**
   * 发送警报
   */
  private sendAlert(alert: any): void {
    logger.warn('Email service alert', alert);
    
    this.emit('alert', alert);
    
    // 这里可以集成外部警报系统
    // 如 Slack、钉钉、邮件通知等
    this.sendToExternalAlertSystems(alert);
  }

  /**
   * 发送到外部警报系统
   */
  private async sendToExternalAlertSystems(alert: any): Promise<void> {
    // 可以集成多种警报系统
    try {
      // Webhook 通知
      if (process.env.ALERT_WEBHOOK_URL) {
        // 发送到 Webhook
      }
      
      // Slack 通知
      if (process.env.SLACK_WEBHOOK_URL) {
        // 发送到 Slack
      }
      
      // 邮件通知
      if (process.env.ALERT_EMAIL) {
        // 发送邮件警报
      }
      
    } catch (error) {
      logger.error('Failed to send external alert:', error);
    }
  }

  /**
   * 重置性能指标
   */
  private resetPerformanceMetrics(): void {
    const now = new Date();
    
    for (const [key, metrics] of this.performanceMetrics) {
      this.performanceMetrics.set(key, {
        requestCount: 0,
        avgResponseTime: 0,
        errorRate: 0,
        lastReset: now
      });
    }
    
    logger.debug('Performance metrics reset');
  }

  /**
   * 获取健康状态报告
   */
  public getHealthReport(): ApiResponse<{
    overall: {
      status: string;
      score: number;
    };
    services: Array<{
      provider: EmailProvider;
      accountId: string;
      status: string;
      lastCheck: Date;
      responseTime: number;
      error?: string;
    }>;
    performance: Array<{
      provider: EmailProvider;
      operation: string;
      requestCount: number;
      avgResponseTime: number;
      errorRate: number;
    }>;
  }> {
    try {
      const services = Array.from(this.healthChecks.entries()).map(
        ([key, check]) => {
          const [provider, accountId] = key.split(':');
          return {
            provider: provider as EmailProvider,
            accountId,
            status: check.status,
            lastCheck: check.lastCheck,
            responseTime: check.responseTime,
            error: check.error
          };
        }
      );

      const performance = Array.from(this.performanceMetrics.entries()).map(
        ([key, metrics]) => {
          const [provider, operation] = key.split(':');
          return {
            provider: provider as EmailProvider,
            operation,
            ...metrics
          };
        }
      );

      // 计算整体状态
      const healthyCount = services.filter(s => s.status === 'healthy').length;
      const overallScore = services.length > 0 
        ? (healthyCount / services.length) * 100 
        : 100;
      
      const overallStatus = overallScore >= 90 ? 'healthy' : 
                           overallScore >= 70 ? 'degraded' : 'critical';

      return {
        success: true,
        data: {
          overall: {
            status: overallStatus,
            score: overallScore
          },
          services,
          performance
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'health-report'
        }
      };
    } catch (error) {
      logger.error('Failed to generate health report:', error);
      
      return {
        success: false,
        error: {
          code: 'HEALTH_REPORT_FAILED',
          message: 'Failed to generate health report',
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'health-report'
        }
      };
    }
  }

  /**
   * 获取速率限制状态
   */
  public async getRateLimitStatus(): Promise<ApiResponse<Array<{
    provider: EmailProvider;
    accountId: string;
    status: RateLimitStatus;
  }>>> {
    try {
      const accounts = await this.databaseService.getActiveEmailAccounts();
      const rateLimitStatuses = [];

      for (const account of accounts) {
        const emailService = this.emailServiceFactory.getEmailService(
          account.provider,
          account.id
        );
        
        if (emailService && 'getRateLimitStatus' in emailService) {
          const status = (emailService as any).getRateLimitStatus();
          rateLimitStatuses.push({
            provider: account.provider,
            accountId: account.id,
            status
          });
        }
      }

      return {
        success: true,
        data: rateLimitStatuses,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'rate-limit-status'
        }
      };
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
      
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_STATUS_FAILED',
          message: 'Failed to get rate limit status',
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'rate-limit-status'
        }
      };
    }
  }

  /**
   * 设置警报阈值
   */
  public setAlertThresholds(thresholds: {
    responseTime?: number;
    errorRate?: number;
    downtime?: number;
  }): void {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds
    };
    
    logger.info('Alert thresholds updated', this.alertThresholds);
  }

  /**
   * 获取警报阈值
   */
  public getAlertThresholds(): typeof this.alertThresholds {
    return { ...this.alertThresholds };
  }

  /**
   * 获取错误统计
   */
  public async getErrorStatistics(timeRange: {
    start: Date;
    end: Date;
  }): Promise<ApiResponse<{
    totalErrors: number;
    errorsByProvider: Record<EmailProvider, number>;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
      timestamp: Date;
      provider: EmailProvider;
      type: string;
      message: string;
      accountId: string;
    }>;
  }>> {
    try {
      const errorStats = await this.databaseService.getErrorStatistics(
        timeRange.start,
        timeRange.end
      );

      return {
        success: true,
        data: errorStats,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'error-statistics'
        }
      };
    } catch (error) {
      logger.error('Failed to get error statistics:', error);
      
      return {
        success: false,
        error: {
          code: 'ERROR_STATS_FAILED',
          message: 'Failed to get error statistics',
          details: error
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: 'error-statistics'
        }
      };
    }
  }

  /**
   * 强制执行健康检查
   */
  public async forceHealthCheck(): Promise<void> {
    logger.info('Forcing health check...');
    await this.performHealthChecks();
  }

  /**
   * 关闭监控服务
   */
  public shutdown(): void {
    logger.info('Shutting down email service monitor...');
    
    // 清理定时器
    // 注意：在实际实现中需要保存定时器引用以便清理
    
    // 移除所有监听器
    this.removeAllListeners();
    
    logger.info('Email service monitor shutdown complete');
  }
}