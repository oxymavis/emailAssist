/**
 * Application Performance Monitoring (APM) Service
 * 应用性能监控服务，提供HTTP请求、API端点、数据库查询、第三方服务调用等应用层面的性能监控
 */

import EventEmitter from 'events';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import { Redis } from 'ioredis';

export interface HttpRequestMetrics {
  requestId: string;
  method: string;
  url: string;
  path: string;
  statusCode: number;
  duration: number;          // 响应时间 (ms)
  timestamp: Date;
  userAgent?: string;
  userId?: string;
  ip: string;
  size: {
    request: number;         // 请求体大小 (bytes)
    response: number;        // 响应体大小 (bytes)
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface DatabaseQueryMetrics {
  queryId: string;
  query: string;
  duration: number;          // 查询时间 (ms)
  timestamp: Date;
  database: string;
  table?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  rowsAffected?: number;
  error?: {
    message: string;
    code?: string;
  };
}

export interface ExternalServiceMetrics {
  serviceId: string;
  serviceName: string;
  endpoint: string;
  method: string;
  duration: number;          // 请求时间 (ms)
  timestamp: Date;
  statusCode?: number;
  success: boolean;
  retries: number;
  error?: {
    message: string;
    code?: string;
    timeout?: boolean;
  };
}

export interface PerformanceTransaction {
  transactionId: string;
  name: string;
  type: 'http' | 'background' | 'scheduled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'completed' | 'error';
  spans: PerformanceSpan[];
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface PerformanceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  type: 'db' | 'http' | 'cache' | 'compute' | 'io';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, string>;
  logs: SpanLog[];
  error?: {
    message: string;
    stack?: string;
  };
}

export interface SpanLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface APMMetricsSnapshot {
  timestamp: Date;
  http: {
    totalRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;        // 错误率 (%)
    throughput: number;       // 每秒请求数
    statusCodes: Record<string, number>;
  };
  database: {
    totalQueries: number;
    avgQueryTime: number;
    p95QueryTime: number;
    slowQueries: number;      // 慢查询数量
    errorRate: number;        // 查询错误率 (%)
    topQueries: Array<{
      query: string;
      count: number;
      avgDuration: number;
    }>;
  };
  external: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;        // 外部服务错误率 (%)
    serviceHealth: Record<string, {
      availability: number;   // 可用性 (%)
      avgResponseTime: number;
      errorRate: number;
    }>;
  };
  transactions: {
    total: number;
    completed: number;
    failed: number;
    avgDuration: number;
    p95Duration: number;
  };
}

export interface APMAlert {
  id: string;
  type: 'http' | 'database' | 'external' | 'transaction';
  level: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context?: Record<string, any>;
  resolved?: Date;
}

export class APMService extends EventEmitter {
  private redis: Redis;
  private httpMetrics: HttpRequestMetrics[] = [];
  private dbMetrics: DatabaseQueryMetrics[] = [];
  private externalMetrics: ExternalServiceMetrics[] = [];
  private transactions: Map<string, PerformanceTransaction> = new Map();
  private activeSpans: Map<string, PerformanceSpan> = new Map();
  private snapshots: APMMetricsSnapshot[] = [];
  private alerts: APMAlert[] = [];
  
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly MAX_SNAPSHOTS_HISTORY = 2880; // 24小时
  private readonly MAX_ALERTS_HISTORY = 1000;
  
  // 性能阈值配置
  private readonly thresholds = {
    http: {
      avgResponseTime: { warning: 2000, critical: 5000 },
      errorRate: { warning: 5, critical: 10 },
      p95ResponseTime: { warning: 5000, critical: 10000 }
    },
    database: {
      avgQueryTime: { warning: 1000, critical: 3000 },
      errorRate: { warning: 2, critical: 5 },
      slowQueries: { warning: 10, critical: 50 }
    },
    external: {
      errorRate: { warning: 10, critical: 25 },
      avgResponseTime: { warning: 5000, critical: 10000 }
    },
    transaction: {
      errorRate: { warning: 5, critical: 15 },
      avgDuration: { warning: 10000, critical: 30000 }
    }
  };

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * 启动APM监控
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting APM monitoring', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      await this.collectAPMMetrics();
    }, intervalMs);

    // 立即收集一次指标
    await this.collectAPMMetrics();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('APM monitoring stopped');
  }

  /**
   * Express中间件：监控HTTP请求
   */
  httpMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = uuidv4();
      const startTime = Date.now();
      const requestSize = parseInt(req.get('Content-Length') || '0');

      // 添加请求ID到request对象
      (req as any).requestId = requestId;

      // 创建事务
      const transaction = this.startTransaction(`${req.method} ${req.path}`, 'http', {
        requestId,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // 监听响应完成
      res.on('finish', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const responseSize = parseInt(res.get('Content-Length') || '0');

        const metrics: HttpRequestMetrics = {
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date(startTime),
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          ip: req.ip || '',
          size: {
            request: requestSize,
            response: responseSize
          }
        };

        // 如果是错误响应，记录错误信息
        if (res.statusCode >= 400) {
          metrics.error = {
            message: `HTTP ${res.statusCode}`,
            code: res.statusCode.toString()
          };
        }

        this.recordHttpMetrics(metrics);
        
        // 完成事务
        this.completeTransaction(transaction.transactionId, res.statusCode >= 400 ? {
          message: `HTTP ${res.statusCode}`
        } : undefined);
      });

      // 监听响应错误
      res.on('error', (error: Error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const metrics: HttpRequestMetrics = {
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          path: req.path,
          statusCode: 500,
          duration,
          timestamp: new Date(startTime),
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          ip: req.ip || '',
          size: {
            request: requestSize,
            response: 0
          },
          error: {
            message: error.message,
            stack: error.stack
          }
        };

        this.recordHttpMetrics(metrics);
        
        // 失败事务
        this.completeTransaction(transaction.transactionId, {
          message: error.message,
          stack: error.stack
        });
      });

      next();
    };
  }

  /**
   * 记录HTTP请求指标
   */
  recordHttpMetrics(metrics: HttpRequestMetrics): void {
    this.httpMetrics.push(metrics);
    if (this.httpMetrics.length > this.MAX_METRICS_HISTORY) {
      this.httpMetrics.shift();
    }

    this.emit('httpMetrics', metrics);
    
    if (metrics.error) {
      logger.warn('HTTP request error', metrics);
    } else if (metrics.duration > 5000) {
      logger.warn('Slow HTTP request', { 
        requestId: metrics.requestId,
        path: metrics.path,
        duration: metrics.duration 
      });
    }
  }

  /**
   * 记录数据库查询指标
   */
  recordDatabaseMetrics(metrics: DatabaseQueryMetrics): void {
    this.dbMetrics.push(metrics);
    if (this.dbMetrics.length > this.MAX_METRICS_HISTORY) {
      this.dbMetrics.shift();
    }

    this.emit('databaseMetrics', metrics);
    
    if (metrics.error) {
      logger.error('Database query error', metrics);
    } else if (metrics.duration > 3000) {
      logger.warn('Slow database query', {
        queryId: metrics.queryId,
        query: metrics.query.substring(0, 100),
        duration: metrics.duration
      });
    }
  }

  /**
   * 记录外部服务调用指标
   */
  recordExternalServiceMetrics(metrics: ExternalServiceMetrics): void {
    this.externalMetrics.push(metrics);
    if (this.externalMetrics.length > this.MAX_METRICS_HISTORY) {
      this.externalMetrics.shift();
    }

    this.emit('externalServiceMetrics', metrics);
    
    if (metrics.error) {
      logger.warn('External service error', metrics);
    }
  }

  /**
   * 开始性能事务
   */
  startTransaction(
    name: string, 
    type: PerformanceTransaction['type'],
    metadata?: Record<string, any>
  ): PerformanceTransaction {
    const transaction: PerformanceTransaction = {
      transactionId: uuidv4(),
      name,
      type,
      startTime: new Date(),
      status: 'pending',
      spans: [],
      metadata
    };

    this.transactions.set(transaction.transactionId, transaction);
    return transaction;
  }

  /**
   * 完成性能事务
   */
  completeTransaction(
    transactionId: string,
    error?: { message: string; stack?: string }
  ): PerformanceTransaction | null {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;

    transaction.endTime = new Date();
    transaction.duration = transaction.endTime.getTime() - transaction.startTime.getTime();
    transaction.status = error ? 'error' : 'completed';
    
    if (error) {
      transaction.error = error;
    }

    this.emit('transactionCompleted', transaction);
    return transaction;
  }

  /**
   * 开始性能跨度
   */
  startSpan(
    name: string,
    type: PerformanceSpan['type'],
    transactionId?: string,
    parentSpanId?: string,
    tags: Record<string, string> = {}
  ): PerformanceSpan {
    const span: PerformanceSpan = {
      spanId: uuidv4(),
      parentSpanId,
      name,
      type,
      startTime: new Date(),
      tags,
      logs: []
    };

    this.activeSpans.set(span.spanId, span);

    // 如果有关联的事务，将span添加到事务中
    if (transactionId) {
      const transaction = this.transactions.get(transactionId);
      if (transaction) {
        transaction.spans.push(span);
      }
    }

    return span;
  }

  /**
   * 完成性能跨度
   */
  finishSpan(
    spanId: string,
    error?: { message: string; stack?: string }
  ): PerformanceSpan | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    
    if (error) {
      span.error = error;
    }

    this.activeSpans.delete(spanId);
    this.emit('spanCompleted', span);
    return span;
  }

  /**
   * 添加跨度日志
   */
  addSpanLog(
    spanId: string,
    level: SpanLog['level'],
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: new Date(),
        level,
        message,
        fields
      });
    }
  }

  /**
   * 收集APM指标
   */
  private async collectAPMMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

      // 过滤最近一小时的指标
      const recentHttp = this.httpMetrics.filter(m => m.timestamp >= oneHourAgo);
      const recentDb = this.dbMetrics.filter(m => m.timestamp >= oneHourAgo);
      const recentExternal = this.externalMetrics.filter(m => m.timestamp >= oneHourAgo);
      const recentTransactions = Array.from(this.transactions.values())
        .filter(t => t.startTime >= oneHourAgo);

      const snapshot: APMMetricsSnapshot = {
        timestamp,
        http: this.calculateHttpMetrics(recentHttp),
        database: this.calculateDatabaseMetrics(recentDb),
        external: this.calculateExternalMetrics(recentExternal),
        transactions: this.calculateTransactionMetrics(recentTransactions)
      };

      // 存储快照
      this.snapshots.push(snapshot);
      if (this.snapshots.length > this.MAX_SNAPSHOTS_HISTORY) {
        this.snapshots.shift();
      }

      // 检查阈值
      await this.checkAPMThresholds(snapshot);

      // 缓存指标
      await this.cacheAPMMetrics(snapshot);

      // 发出事件
      this.emit('apmMetrics', snapshot);

      logger.debug('APM metrics collected', {
        httpRequests: snapshot.http.totalRequests,
        dbQueries: snapshot.database.totalQueries,
        externalRequests: snapshot.external.totalRequests,
        transactions: snapshot.transactions.total
      });

    } catch (error) {
      logger.error('Failed to collect APM metrics', error);
    }
  }

  /**
   * 计算HTTP指标
   */
  private calculateHttpMetrics(metrics: HttpRequestMetrics[]): APMMetricsSnapshot['http'] {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        statusCodes: {}
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const statusCodes: Record<string, number> = {};

    metrics.forEach(m => {
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
    });

    return {
      totalRequests: metrics.length,
      avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
      errorRate: Math.round((errorCount / metrics.length) * 100 * 100) / 100,
      throughput: Math.round((metrics.length / 3600) * 100) / 100, // 每秒请求数
      statusCodes
    };
  }

  /**
   * 计算数据库指标
   */
  private calculateDatabaseMetrics(metrics: DatabaseQueryMetrics[]): APMMetricsSnapshot['database'] {
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        avgQueryTime: 0,
        p95QueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        topQueries: []
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const errorCount = metrics.filter(m => m.error).length;
    const slowQueries = metrics.filter(m => m.duration > 3000).length;

    // 统计热门查询
    const queryStats: Record<string, { count: number; totalDuration: number }> = {};
    metrics.forEach(m => {
      const queryKey = m.query.substring(0, 100); // 截取前100字符作为key
      if (!queryStats[queryKey]) {
        queryStats[queryKey] = { count: 0, totalDuration: 0 };
      }
      queryStats[queryKey].count++;
      queryStats[queryKey].totalDuration += m.duration;
    });

    const topQueries = Object.entries(queryStats)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalQueries: metrics.length,
      avgQueryTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95QueryTime: durations[Math.floor(durations.length * 0.95)] || 0,
      slowQueries,
      errorRate: Math.round((errorCount / metrics.length) * 100 * 100) / 100,
      topQueries
    };
  }

  /**
   * 计算外部服务指标
   */
  private calculateExternalMetrics(metrics: ExternalServiceMetrics[]): APMMetricsSnapshot['external'] {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        serviceHealth: {}
      };
    }

    const durations = metrics.map(m => m.duration);
    const errorCount = metrics.filter(m => !m.success).length;

    // 按服务统计健康状态
    const serviceStats: Record<string, { total: number; success: number; totalDuration: number }> = {};
    metrics.forEach(m => {
      if (!serviceStats[m.serviceName]) {
        serviceStats[m.serviceName] = { total: 0, success: 0, totalDuration: 0 };
      }
      serviceStats[m.serviceName].total++;
      if (m.success) {
        serviceStats[m.serviceName].success++;
      }
      serviceStats[m.serviceName].totalDuration += m.duration;
    });

    const serviceHealth: Record<string, any> = {};
    Object.entries(serviceStats).forEach(([service, stats]) => {
      serviceHealth[service] = {
        availability: Math.round((stats.success / stats.total) * 100 * 100) / 100,
        avgResponseTime: Math.round(stats.totalDuration / stats.total),
        errorRate: Math.round(((stats.total - stats.success) / stats.total) * 100 * 100) / 100
      };
    });

    return {
      totalRequests: metrics.length,
      avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      errorRate: Math.round((errorCount / metrics.length) * 100 * 100) / 100,
      serviceHealth
    };
  }

  /**
   * 计算事务指标
   */
  private calculateTransactionMetrics(transactions: PerformanceTransaction[]): APMMetricsSnapshot['transactions'] {
    if (transactions.length === 0) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        avgDuration: 0,
        p95Duration: 0
      };
    }

    const completed = transactions.filter(t => t.status === 'completed');
    const failed = transactions.filter(t => t.status === 'error');
    const durations = transactions
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!)
      .sort((a, b) => a - b);

    return {
      total: transactions.length,
      completed: completed.length,
      failed: failed.length,
      avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0
    };
  }

  /**
   * 检查APM阈值
   */
  private async checkAPMThresholds(snapshot: APMMetricsSnapshot): Promise<void> {
    const checks = [
      {
        type: 'http' as const,
        checks: [
          {
            metric: 'avgResponseTime',
            value: snapshot.http.avgResponseTime,
            thresholds: this.thresholds.http.avgResponseTime,
            message: `HTTP平均响应时间: ${snapshot.http.avgResponseTime}ms`
          },
          {
            metric: 'errorRate',
            value: snapshot.http.errorRate,
            thresholds: this.thresholds.http.errorRate,
            message: `HTTP错误率: ${snapshot.http.errorRate}%`
          }
        ]
      },
      {
        type: 'database' as const,
        checks: [
          {
            metric: 'avgQueryTime',
            value: snapshot.database.avgQueryTime,
            thresholds: this.thresholds.database.avgQueryTime,
            message: `数据库平均查询时间: ${snapshot.database.avgQueryTime}ms`
          },
          {
            metric: 'errorRate',
            value: snapshot.database.errorRate,
            thresholds: this.thresholds.database.errorRate,
            message: `数据库错误率: ${snapshot.database.errorRate}%`
          }
        ]
      }
    ];

    for (const checkGroup of checks) {
      for (const check of checkGroup.checks) {
        await this.evaluateAPMThreshold(checkGroup.type, check, snapshot);
      }
    }
  }

  /**
   * 评估APM阈值
   */
  private async evaluateAPMThreshold(
    type: APMAlert['type'],
    check: {
      metric: string;
      value: number;
      thresholds: { warning: number; critical: number };
      message: string;
    },
    snapshot: APMMetricsSnapshot
  ): Promise<void> {
    const { metric, value, thresholds, message } = check;
    
    let alertLevel: 'warning' | 'critical' | null = null;
    let threshold: number = 0;

    if (value >= thresholds.critical) {
      alertLevel = 'critical';
      threshold = thresholds.critical;
    } else if (value >= thresholds.warning) {
      alertLevel = 'warning';
      threshold = thresholds.warning;
    }

    if (alertLevel) {
      await this.createAPMAlert(type, alertLevel, metric, message, value, threshold, snapshot);
    }
  }

  /**
   * 创建APM告警
   */
  private async createAPMAlert(
    type: APMAlert['type'],
    level: 'warning' | 'critical',
    metric: string,
    message: string,
    value: number,
    threshold: number,
    snapshot: APMMetricsSnapshot
  ): Promise<void> {
    const alertId = `apm_${type}_${metric}_${level}_${Date.now()}`;
    
    // 检查是否存在相同的未解决告警
    const existingAlert = this.alerts.find(alert =>
      alert.type === type &&
      alert.metric === metric &&
      alert.level === level &&
      !alert.resolved
    );

    if (existingAlert) return; // 避免重复告警

    const alert: APMAlert = {
      id: alertId,
      type,
      level,
      metric,
      message,
      value,
      threshold,
      timestamp: new Date(),
      context: { snapshot }
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts.shift();
    }

    // 缓存告警
    await this.cacheAPMAlert(alert);

    this.emit('apmAlert', alert);
    
    if (level === 'critical') {
      logger.error('Critical APM alert', alert);
    } else {
      logger.warn('APM warning', alert);
    }
  }

  /**
   * 缓存APM指标
   */
  private async cacheAPMMetrics(snapshot: APMMetricsSnapshot): Promise<void> {
    try {
      const cacheKey = `apm_metrics:latest`;
      const metricsData = JSON.stringify(snapshot);
      await this.redis.setex(cacheKey, 3600, metricsData);

      // 存储时序数据
      const timeSeriesKey = `apm_metrics:${snapshot.timestamp.toISOString().split('T')[0]}`;
      await this.redis.zadd(timeSeriesKey, snapshot.timestamp.getTime(), metricsData);
      await this.redis.expire(timeSeriesKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to cache APM metrics', error);
    }
  }

  /**
   * 缓存APM告警
   */
  private async cacheAPMAlert(alert: APMAlert): Promise<void> {
    try {
      const alertKey = `apm_alerts:${alert.type}`;
      const alertData = JSON.stringify(alert);
      await this.redis.zadd(alertKey, alert.timestamp.getTime(), alertData);
      await this.redis.expire(alertKey, 30 * 24 * 3600); // 保存30天

    } catch (error) {
      logger.error('Failed to cache APM alert', error);
    }
  }

  /**
   * 获取当前APM状态
   */
  getCurrentAPMStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: APMMetricsSnapshot | null;
    activeAlerts: APMAlert[];
    summary: string;
  } {
    const currentMetrics = this.snapshots[this.snapshots.length - 1] || null;
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (activeAlerts.some(alert => alert.level === 'critical')) {
      status = 'critical';
    } else if (activeAlerts.some(alert => alert.level === 'warning')) {
      status = 'warning';
    }

    const summary = this.generateAPMStatusSummary(status, activeAlerts.length, currentMetrics);

    return {
      status,
      metrics: currentMetrics,
      activeAlerts,
      summary
    };
  }

  /**
   * 生成APM状态摘要
   */
  private generateAPMStatusSummary(
    status: string,
    alertCount: number,
    metrics: APMMetricsSnapshot | null
  ): string {
    if (status === 'critical') {
      return `应用性能严重告警：存在${alertCount}个严重问题，应用性能严重受损`;
    } else if (status === 'warning') {
      return `应用性能警告：存在${alertCount}个告警，建议及时优化`;
    } else {
      if (!metrics) {
        return 'APM监控正在初始化中';
      }
      return `应用性能正常：HTTP平均响应时间${metrics.http.avgResponseTime}ms，` +
             `数据库平均查询时间${metrics.database.avgQueryTime}ms，` +
             `错误率${metrics.http.errorRate}%`;
    }
  }

  /**
   * 获取APM报告
   */
  getAPMReport(hours: number = 24): {
    timeRange: { start: Date; end: Date };
    summary: {
      totalRequests: number;
      avgResponseTime: number;
      errorRate: number;
      topEndpoints: Array<{
        path: string;
        requests: number;
        avgResponseTime: number;
        errorRate: number;
      }>;
      slowestEndpoints: Array<{
        path: string;
        avgResponseTime: number;
      }>;
    };
    trends: Array<{
      metric: string;
      trend: 'improving' | 'stable' | 'degrading';
      change: number;
    }>;
  } {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    const reportMetrics = this.httpMetrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    // 计算端点统计
    const endpointStats: Record<string, {
      requests: number;
      totalDuration: number;
      errors: number;
    }> = {};

    reportMetrics.forEach(m => {
      if (!endpointStats[m.path]) {
        endpointStats[m.path] = { requests: 0, totalDuration: 0, errors: 0 };
      }
      endpointStats[m.path].requests++;
      endpointStats[m.path].totalDuration += m.duration;
      if (m.statusCode >= 400) {
        endpointStats[m.path].errors++;
      }
    });

    const topEndpoints = Object.entries(endpointStats)
      .map(([path, stats]) => ({
        path,
        requests: stats.requests,
        avgResponseTime: Math.round(stats.totalDuration / stats.requests),
        errorRate: Math.round((stats.errors / stats.requests) * 100 * 100) / 100
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    const slowestEndpoints = Object.entries(endpointStats)
      .map(([path, stats]) => ({
        path,
        avgResponseTime: Math.round(stats.totalDuration / stats.requests)
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 10);

    return {
      timeRange: { start: startTime, end: endTime },
      summary: {
        totalRequests: reportMetrics.length,
        avgResponseTime: reportMetrics.length > 0 
          ? Math.round(reportMetrics.reduce((sum, m) => sum + m.duration, 0) / reportMetrics.length)
          : 0,
        errorRate: reportMetrics.length > 0
          ? Math.round((reportMetrics.filter(m => m.statusCode >= 400).length / reportMetrics.length) * 100 * 100) / 100
          : 0,
        topEndpoints,
        slowestEndpoints
      },
      trends: this.analyzeAPMTrends()
    };
  }

  /**
   * 分析APM趋势
   */
  private analyzeAPMTrends(): Array<{
    metric: string;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
  }> {
    if (this.snapshots.length < 10) return [];

    const recent = this.snapshots.slice(-5);
    const previous = this.snapshots.slice(-10, -5);

    const metrics = ['http.avgResponseTime', 'http.errorRate', 'database.avgQueryTime'];

    return metrics.map(metric => {
      const getMetricValue = (snapshot: APMMetricsSnapshot, path: string): number => {
        const parts = path.split('.');
        let value: any = snapshot;
        for (const part of parts) {
          value = value[part];
        }
        return value || 0;
      };

      const recentAvg = recent.reduce((sum, s) => sum + getMetricValue(s, metric), 0) / recent.length;
      const previousAvg = previous.reduce((sum, s) => sum + getMetricValue(s, metric), 0) / previous.length;
      
      const change = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
      
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      if (Math.abs(change) > 10) {
        // 对于响应时间和错误率，减少是好的
        trend = change < 0 ? 'improving' : 'degrading';
      }

      return { metric, trend, change: Math.round(change * 100) / 100 };
    });
  }

  /**
   * 解决APM告警
   */
  resolveAPMAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
    if (alert) {
      alert.resolved = new Date();
      this.emit('apmAlertResolved', alert);
      logger.info('APM alert resolved', { alertId, type: alert.type, metric: alert.metric });
      return true;
    }
    return false;
  }

  /**
   * 获取活跃事务
   */
  getActiveTransactions(): PerformanceTransaction[] {
    return Array.from(this.transactions.values()).filter(t => t.status === 'pending');
  }

  /**
   * 获取活跃跨度
   */
  getActiveSpans(): PerformanceSpan[] {
    return Array.from(this.activeSpans.values());
  }
}

export default APMService;