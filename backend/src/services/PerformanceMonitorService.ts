/**
 * Performance Monitor Service
 * 性能监控服务，提供全方位的数据库和应用性能监控
 */

import DatabaseManager from '@/config/database';
import DatabaseMonitor from './DatabaseMonitor';
import CacheManager from './CacheManager';
import logger from '@/utils/logger';
import EventEmitter from 'events';

export interface PerformanceMetrics {
  timestamp: Date;
  database: {
    poolUtilization: number;
    activeConnections: number;
    waitingClients: number;
    avgQueryTime: number;
    slowQueries: number;
    errorRate: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    avgResponseTime: number;
    totalKeys: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIO: number;
  };
  application: {
    activeRequests: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface PerformanceAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: 'database' | 'cache' | 'system' | 'application';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  comparison: 'greater' | 'less';
  enabled: boolean;
}

export class PerformanceMonitorService extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private activeRequests = new Map<string, { startTime: number; endpoint: string }>();
  
  private thresholds: PerformanceThreshold[] = [
    {
      metric: 'database.poolUtilization',
      warning: 70,
      critical: 90,
      comparison: 'greater',
      enabled: true
    },
    {
      metric: 'database.avgQueryTime',
      warning: 1000,
      critical: 3000,
      comparison: 'greater',
      enabled: true
    },
    {
      metric: 'database.errorRate',
      warning: 1,
      critical: 5,
      comparison: 'greater',
      enabled: true
    },
    {
      metric: 'cache.hitRate',
      warning: 80,
      critical: 60,
      comparison: 'less',
      enabled: true
    },
    {
      metric: 'system.memoryUsage',
      warning: 80,
      critical: 95,
      comparison: 'greater',
      enabled: true
    },
    {
      metric: 'application.avgResponseTime',
      warning: 2000,
      critical: 5000,
      comparison: 'greater',
      enabled: true
    }
  ];

  private monitoringInterval?: NodeJS.Timeout;
  private readonly MAX_METRICS_HISTORY = 2880; // 24小时，每30秒一次
  private readonly MAX_ALERTS_HISTORY = 1000;

  constructor() {
    super();
  }

  /**
   * 启动性能监控
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting performance monitoring', { intervalMs });

    // 启动数据库监控
    DatabaseMonitor.startMonitoring(intervalMs);

    // 启动性能指标收集
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, intervalMs);

    // 立即收集一次指标
    this.collectMetrics();
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    DatabaseMonitor.stopMonitoring();
    logger.info('Performance monitoring stopped');
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // 收集数据库指标
      const dbHealth = await DatabaseMonitor.getHealth();
      const dbStats = DatabaseMonitor.getPerformanceStats();

      // 收集缓存指标
      const cacheStats = await CacheManager.getStats();

      // 收集系统指标
      const systemMetrics = await this.collectSystemMetrics();

      // 收集应用指标
      const appMetrics = this.collectApplicationMetrics();

      const metrics: PerformanceMetrics = {
        timestamp,
        database: {
          poolUtilization: dbHealth.poolMetrics.utilization,
          activeConnections: dbHealth.poolMetrics.totalConnections - dbHealth.poolMetrics.idleConnections,
          waitingClients: dbHealth.poolMetrics.waitingClients,
          avgQueryTime: dbStats.queryStats.avgDuration,
          slowQueries: dbStats.queryStats.slowQueryCount,
          errorRate: dbStats.queryStats.errorRate
        },
        cache: {
          hitRate: cacheStats.hitRate,
          memoryUsage: cacheStats.memoryUsage,
          avgResponseTime: cacheStats.avgResponseTime,
          totalKeys: cacheStats.totalKeys
        },
        system: systemMetrics,
        application: appMetrics
      };

      // 存储指标
      this.metrics.push(metrics);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // 检查阈值并生成告警
      this.checkThresholds(metrics);

      // 发出指标事件
      this.emit('metrics', metrics);

    } catch (error) {
      logger.error('Failed to collect performance metrics', error);
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<PerformanceMetrics['system']> {
    const os = require('os');
    
    // CPU使用率
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - Math.round(100 * totalIdle / totalTick);

    // 内存使用率
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    return {
      cpuUsage,
      memoryUsage,
      diskUsage: 0, // 需要额外库支持
      networkIO: 0  // 需要额外库支持
    };
  }

  /**
   * 收集应用指标
   */
  private collectApplicationMetrics(): PerformanceMetrics['application'] {
    const activeCount = this.activeRequests.size;
    
    // 计算平均响应时间
    let totalResponseTime = 0;
    let completedRequests = 0;
    const now = Date.now();

    this.activeRequests.forEach(request => {
      const duration = now - request.startTime;
      if (duration < 30000) { // 只考虑30秒内的请求
        totalResponseTime += duration;
        completedRequests++;
      }
    });

    const avgResponseTime = completedRequests > 0 ? totalResponseTime / completedRequests : 0;

    // 从最近的指标计算吞吐量
    const recentMetrics = this.metrics.slice(-10); // 最近10次
    const throughput = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.application.activeRequests, 0) / recentMetrics.length
      : 0;

    return {
      activeRequests: activeCount,
      avgResponseTime,
      errorRate: 0, // 需要从应用层统计
      throughput
    };
  }

  /**
   * 检查阈值
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    this.thresholds.forEach(threshold => {
      if (!threshold.enabled) return;

      const value = this.getMetricValue(metrics, threshold.metric);
      if (value === undefined) return;

      let alertLevel: 'warning' | 'critical' | null = null;
      
      if (threshold.comparison === 'greater') {
        if (value >= threshold.critical) {
          alertLevel = 'critical';
        } else if (value >= threshold.warning) {
          alertLevel = 'warning';
        }
      } else { // 'less'
        if (value <= threshold.critical) {
          alertLevel = 'critical';
        } else if (value <= threshold.warning) {
          alertLevel = 'warning';
        }
      }

      if (alertLevel) {
        this.createAlert(alertLevel, threshold, value);
      }
    });
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metrics: PerformanceMetrics, path: string): number | undefined {
    const parts = path.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * 创建告警
   */
  private createAlert(
    level: 'warning' | 'critical',
    threshold: PerformanceThreshold,
    value: number
  ): void {
    const id = `${threshold.metric}_${level}_${Date.now()}`;
    
    // 检查是否存在相同的未解决告警
    const existingAlert = this.alerts.find(alert => 
      alert.metric === threshold.metric && 
      alert.level === level && 
      !alert.resolved
    );

    if (existingAlert) return; // 避免重复告警

    const alert: PerformanceAlert = {
      id,
      level,
      type: threshold.metric.split('.')[0] as any,
      message: `${threshold.metric} ${level}: ${value} ${threshold.comparison === 'greater' ? '>' : '<'} ${level === 'critical' ? threshold.critical : threshold.warning}`,
      metric: threshold.metric,
      value,
      threshold: level === 'critical' ? threshold.critical : threshold.warning,
      timestamp: new Date()
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts.shift();
    }

    this.emit('alert', alert);
    
    if (level === 'critical') {
      logger.error('Critical performance alert', alert);
    } else {
      logger.warn('Performance warning', alert);
    }
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
    if (alert) {
      alert.resolved = new Date();
      this.emit('alertResolved', alert);
      logger.info('Performance alert resolved', { alertId, metric: alert.metric });
      return true;
    }
    return false;
  }

  /**
   * 记录请求开始
   */
  recordRequestStart(requestId: string, endpoint: string): void {
    this.activeRequests.set(requestId, {
      startTime: Date.now(),
      endpoint
    });
  }

  /**
   * 记录请求结束
   */
  recordRequestEnd(requestId: string): number {
    const request = this.activeRequests.get(requestId);
    if (request) {
      this.activeRequests.delete(requestId);
      return Date.now() - request.startTime;
    }
    return 0;
  }

  /**
   * 获取当前性能状态
   */
  getCurrentStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: PerformanceMetrics | null;
    activeAlerts: PerformanceAlert[];
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

    const summary = this.generateStatusSummary(status, activeAlerts.length, currentMetrics);

    return {
      status,
      metrics: currentMetrics,
      activeAlerts,
      summary
    };
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(hours: number = 24): {
    timeRange: { start: Date; end: Date };
    averages: Partial<PerformanceMetrics>;
    peaks: Partial<PerformanceMetrics>;
    alertSummary: {
      total: number;
      byLevel: Record<string, number>;
      byType: Record<string, number>;
    };
    trends: {
      metric: string;
      trend: 'improving' | 'stable' | 'degrading';
      change: number;
    }[];
  } {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    const reportMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const reportAlerts = this.alerts.filter(a =>
      a.timestamp >= startTime && a.timestamp <= endTime
    );

    // 计算平均值和峰值
    const averages = this.calculateAverages(reportMetrics);
    const peaks = this.calculatePeaks(reportMetrics);

    // 告警汇总
    const alertSummary = {
      total: reportAlerts.length,
      byLevel: this.groupBy(reportAlerts, 'level'),
      byType: this.groupBy(reportAlerts, 'type')
    };

    // 趋势分析
    const trends = this.analyzeTrends(reportMetrics);

    return {
      timeRange: { start: startTime, end: endTime },
      averages,
      peaks,
      alertSummary,
      trends
    };
  }

  /**
   * 生成状态摘要
   */
  private generateStatusSummary(
    status: string, 
    alertCount: number, 
    metrics: PerformanceMetrics | null
  ): string {
    if (status === 'critical') {
      return `系统状态严重：存在${alertCount}个活跃告警，需要立即处理`;
    } else if (status === 'warning') {
      return `系统状态警告：存在${alertCount}个告警，建议关注`;
    } else {
      const dbUtil = metrics ? Math.round(metrics.database.poolUtilization) : 0;
      const cacheHit = metrics ? Math.round(metrics.cache.hitRate) : 0;
      return `系统运行正常：数据库连接池利用率${dbUtil}%，缓存命中率${cacheHit}%`;
    }
  }

  /**
   * 计算平均值
   */
  private calculateAverages(metrics: PerformanceMetrics[]): Partial<PerformanceMetrics> {
    if (metrics.length === 0) return {};

    const sum = metrics.reduce((acc, m) => {
      acc.database.poolUtilization += m.database.poolUtilization;
      acc.database.avgQueryTime += m.database.avgQueryTime;
      acc.cache.hitRate += m.cache.hitRate;
      acc.system.cpuUsage += m.system.cpuUsage;
      acc.system.memoryUsage += m.system.memoryUsage;
      acc.application.avgResponseTime += m.application.avgResponseTime;
      return acc;
    }, {
      database: { poolUtilization: 0, avgQueryTime: 0 },
      cache: { hitRate: 0 },
      system: { cpuUsage: 0, memoryUsage: 0 },
      application: { avgResponseTime: 0 }
    } as any);

    const count = metrics.length;
    return {
      database: {
        poolUtilization: sum.database.poolUtilization / count,
        avgQueryTime: sum.database.avgQueryTime / count,
        activeConnections: 0,
        waitingClients: 0,
        slowQueries: 0,
        errorRate: 0
      },
      cache: {
        hitRate: sum.cache.hitRate / count,
        memoryUsage: 0,
        avgResponseTime: 0,
        totalKeys: 0
      },
      system: {
        cpuUsage: sum.system.cpuUsage / count,
        memoryUsage: sum.system.memoryUsage / count,
        diskUsage: 0,
        networkIO: 0
      },
      application: {
        avgResponseTime: sum.application.avgResponseTime / count,
        activeRequests: 0,
        errorRate: 0,
        throughput: 0
      }
    } as PerformanceMetrics;
  }

  /**
   * 计算峰值
   */
  private calculatePeaks(metrics: PerformanceMetrics[]): Partial<PerformanceMetrics> {
    if (metrics.length === 0) return {};

    return metrics.reduce((peaks, m) => {
      peaks.database!.poolUtilization = Math.max(peaks.database!.poolUtilization, m.database.poolUtilization);
      peaks.database!.avgQueryTime = Math.max(peaks.database!.avgQueryTime, m.database.avgQueryTime);
      peaks.cache!.hitRate = Math.min(peaks.cache!.hitRate, m.cache.hitRate); // 命中率越低越不好
      peaks.system!.cpuUsage = Math.max(peaks.system!.cpuUsage, m.system.cpuUsage);
      peaks.system!.memoryUsage = Math.max(peaks.system!.memoryUsage, m.system.memoryUsage);
      peaks.application!.avgResponseTime = Math.max(peaks.application!.avgResponseTime, m.application.avgResponseTime);
      return peaks;
    }, {
      database: { poolUtilization: 0, avgQueryTime: 0, activeConnections: 0, waitingClients: 0, slowQueries: 0, errorRate: 0 },
      cache: { hitRate: 100, memoryUsage: 0, avgResponseTime: 0, totalKeys: 0 },
      system: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkIO: 0 },
      application: { avgResponseTime: 0, activeRequests: 0, errorRate: 0, throughput: 0 }
    } as PerformanceMetrics);
  }

  /**
   * 分组统计
   */
  private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 趋势分析
   */
  private analyzeTrends(metrics: PerformanceMetrics[]): Array<{
    metric: string;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
  }> {
    if (metrics.length < 10) return [];

    const recent = metrics.slice(-5);
    const previous = metrics.slice(-10, -5);

    const trends = [
      'database.poolUtilization',
      'database.avgQueryTime',
      'cache.hitRate',
      'system.cpuUsage',
      'system.memoryUsage',
      'application.avgResponseTime'
    ];

    return trends.map(metric => {
      const recentAvg = recent.reduce((sum, m) => sum + this.getMetricValue(m, metric)!, 0) / recent.length;
      const previousAvg = previous.reduce((sum, m) => sum + this.getMetricValue(m, metric)!, 0) / previous.length;
      
      const change = ((recentAvg - previousAvg) / previousAvg) * 100;
      
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      if (Math.abs(change) > 10) {
        // 对于某些指标，增长是好的，对于某些是坏的
        const improvingOnIncrease = metric === 'cache.hitRate';
        trend = (change > 0) === improvingOnIncrease ? 'improving' : 'degrading';
      }

      return { metric, trend, change: Math.round(change * 100) / 100 };
    });
  }
}

// 导出单例实例
export default new PerformanceMonitorService();