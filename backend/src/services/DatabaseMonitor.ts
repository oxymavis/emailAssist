/**
 * Database Monitor Service
 * 数据库连接池监控和性能分析服务
 */

import DatabaseManager from '@/config/database';
import logger from '@/utils/logger';
import EventEmitter from 'events';

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  utilization: number;
  timestamp: Date;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'critical';
  poolMetrics: PoolMetrics;
  recentQueries: QueryMetrics[];
  alerts: string[];
  recommendations: string[];
  uptime: number;
}

export class DatabaseMonitor extends EventEmitter {
  private metrics: {
    poolHistory: PoolMetrics[];
    queryHistory: QueryMetrics[];
    slowQueries: QueryMetrics[];
    errorCount: number;
    startTime: Date;
  };

  private thresholds = {
    slowQueryMs: 1000,
    highUtilization: 80,
    criticalUtilization: 95,
    maxHistorySize: 1000
  };

  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.metrics = {
      poolHistory: [],
      queryHistory: [],
      slowQueries: [],
      errorCount: 0,
      startTime: new Date()
    };
  }

  /**
   * 启动监控
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting database monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // 立即收集一次指标
    this.collectMetrics();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Database monitoring stopped');
    }
  }

  /**
   * 收集连接池指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const pool = DatabaseManager.getPool();
      
      const poolMetrics: PoolMetrics = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        maxConnections: pool.options.max || 30,
        utilization: ((pool.totalCount) / (pool.options.max || 30)) * 100,
        timestamp: new Date()
      };

      this.metrics.poolHistory.push(poolMetrics);

      // 保持历史记录在限制范围内
      if (this.metrics.poolHistory.length > this.thresholds.maxHistorySize) {
        this.metrics.poolHistory.shift();
      }

      // 检查阈值并发出警告
      this.checkThresholds(poolMetrics);

      // 发出指标事件
      this.emit('poolMetrics', poolMetrics);

    } catch (error) {
      logger.error('Failed to collect database metrics', error);
      this.metrics.errorCount++;
    }
  }

  /**
   * 记录查询指标
   */
  recordQuery(query: string, duration: number, success: boolean, error?: string): void {
    const queryMetrics: QueryMetrics = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      success,
      error
    };

    this.metrics.queryHistory.push(queryMetrics);

    // 记录慢查询
    if (duration > this.thresholds.slowQueryMs) {
      this.metrics.slowQueries.push(queryMetrics);
      this.emit('slowQuery', queryMetrics);
      
      logger.warn('Slow query detected', {
        duration,
        query: queryMetrics.query.substring(0, 200) + '...'
      });
    }

    // 记录错误
    if (!success) {
      this.metrics.errorCount++;
      this.emit('queryError', queryMetrics);
    }

    // 保持历史记录在限制范围内
    if (this.metrics.queryHistory.length > this.thresholds.maxHistorySize) {
      this.metrics.queryHistory.shift();
    }

    if (this.metrics.slowQueries.length > 100) {
      this.metrics.slowQueries.shift();
    }
  }

  /**
   * 检查阈值
   */
  private checkThresholds(poolMetrics: PoolMetrics): void {
    // 检查连接池利用率
    if (poolMetrics.utilization >= this.thresholds.criticalUtilization) {
      const alert = `Critical: Connection pool utilization at ${poolMetrics.utilization.toFixed(1)}%`;
      this.emit('alert', { level: 'critical', message: alert });
      logger.error(alert);
    } else if (poolMetrics.utilization >= this.thresholds.highUtilization) {
      const alert = `Warning: Connection pool utilization at ${poolMetrics.utilization.toFixed(1)}%`;
      this.emit('alert', { level: 'warning', message: alert });
      logger.warn(alert);
    }

    // 检查等待客户端数量
    if (poolMetrics.waitingClients > 10) {
      const alert = `Warning: ${poolMetrics.waitingClients} clients waiting for connections`;
      this.emit('alert', { level: 'warning', message: alert });
      logger.warn(alert);
    }
  }

  /**
   * 获取当前健康状态
   */
  async getHealth(): Promise<DatabaseHealth> {
    const currentMetrics = this.getCurrentPoolMetrics();
    const recentQueries = this.metrics.queryHistory.slice(-10);
    
    // 确定健康状态
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // 检查连接池状态
    if (currentMetrics.utilization >= this.thresholds.criticalUtilization) {
      status = 'critical';
      alerts.push(`Connection pool utilization critical: ${currentMetrics.utilization.toFixed(1)}%`);
      recommendations.push('Consider increasing max connection pool size');
    } else if (currentMetrics.utilization >= this.thresholds.highUtilization) {
      status = status === 'healthy' ? 'warning' : status;
      alerts.push(`Connection pool utilization high: ${currentMetrics.utilization.toFixed(1)}%`);
      recommendations.push('Monitor connection pool usage closely');
    }

    // 检查等待客户端
    if (currentMetrics.waitingClients > 5) {
      status = status === 'healthy' ? 'warning' : status;
      alerts.push(`${currentMetrics.waitingClients} clients waiting for connections`);
      recommendations.push('Optimize query performance to reduce connection hold time');
    }

    // 检查慢查询
    const recentSlowQueries = this.metrics.slowQueries.filter(
      q => Date.now() - q.timestamp.getTime() < 300000 // 最近5分钟
    );
    
    if (recentSlowQueries.length > 5) {
      status = status === 'healthy' ? 'warning' : status;
      alerts.push(`${recentSlowQueries.length} slow queries in the last 5 minutes`);
      recommendations.push('Analyze and optimize slow queries');
    }

    // 检查错误率
    const recentErrors = this.metrics.queryHistory.filter(
      q => !q.success && Date.now() - q.timestamp.getTime() < 300000
    );
    
    if (recentErrors.length > 10) {
      status = 'critical';
      alerts.push(`${recentErrors.length} query errors in the last 5 minutes`);
      recommendations.push('Investigate database connectivity and query issues');
    }

    const uptime = Date.now() - this.metrics.startTime.getTime();

    return {
      status,
      poolMetrics: currentMetrics,
      recentQueries,
      alerts,
      recommendations,
      uptime
    };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    poolStats: {
      avgUtilization: number;
      maxUtilization: number;
      avgWaitingClients: number;
    };
    queryStats: {
      totalQueries: number;
      avgDuration: number;
      slowQueryCount: number;
      errorRate: number;
    };
  } {
    const poolStats = {
      avgUtilization: this.metrics.poolHistory.length > 0
        ? this.metrics.poolHistory.reduce((sum, m) => sum + m.utilization, 0) / this.metrics.poolHistory.length
        : 0,
      maxUtilization: this.metrics.poolHistory.length > 0
        ? Math.max(...this.metrics.poolHistory.map(m => m.utilization))
        : 0,
      avgWaitingClients: this.metrics.poolHistory.length > 0
        ? this.metrics.poolHistory.reduce((sum, m) => sum + m.waitingClients, 0) / this.metrics.poolHistory.length
        : 0
    };

    const queryStats = {
      totalQueries: this.metrics.queryHistory.length,
      avgDuration: this.metrics.queryHistory.length > 0
        ? this.metrics.queryHistory.reduce((sum, q) => sum + q.duration, 0) / this.metrics.queryHistory.length
        : 0,
      slowQueryCount: this.metrics.slowQueries.length,
      errorRate: this.metrics.queryHistory.length > 0
        ? (this.metrics.queryHistory.filter(q => !q.success).length / this.metrics.queryHistory.length) * 100
        : 0
    };

    return { poolStats, queryStats };
  }

  /**
   * 获取慢查询报告
   */
  getSlowQueriesReport(limit: number = 20): Array<{
    query: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
    lastOccurrence: Date;
  }> {
    const queryGroups = new Map<string, QueryMetrics[]>();

    // 按查询模式分组
    this.metrics.slowQueries.forEach(query => {
      const pattern = this.getQueryPattern(query.query);
      if (!queryGroups.has(pattern)) {
        queryGroups.set(pattern, []);
      }
      queryGroups.get(pattern)!.push(query);
    });

    // 生成报告
    const report = Array.from(queryGroups.entries()).map(([pattern, queries]) => ({
      query: pattern,
      count: queries.length,
      avgDuration: queries.reduce((sum, q) => sum + q.duration, 0) / queries.length,
      maxDuration: Math.max(...queries.map(q => q.duration)),
      lastOccurrence: new Date(Math.max(...queries.map(q => q.timestamp.getTime())))
    }));

    return report
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      poolHistory: [],
      queryHistory: [],
      slowQueries: [],
      errorCount: 0,
      startTime: new Date()
    };
    logger.info('Database monitoring metrics reset');
  }

  /**
   * 获取当前连接池指标
   */
  private getCurrentPoolMetrics(): PoolMetrics {
    if (this.metrics.poolHistory.length === 0) {
      const pool = DatabaseManager.getPool();
      return {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        maxConnections: pool.options.max || 30,
        utilization: ((pool.totalCount) / (pool.options.max || 30)) * 100,
        timestamp: new Date()
      };
    }
    return this.metrics.poolHistory[this.metrics.poolHistory.length - 1];
  }

  /**
   * 清理查询字符串
   */
  private sanitizeQuery(query: string): string {
    // 移除敏感信息和参数值
    return query
      .replace(/\$\d+/g, '$?') // 替换参数占位符
      .replace(/'\s*([^']*)\s*'/g, "'?'") // 替换字符串值
      .replace(/\d+/g, '?') // 替换数字值
      .trim();
  }

  /**
   * 获取查询模式
   */
  private getQueryPattern(query: string): string {
    // 提取查询的基本模式，用于分组统计
    return query
      .replace(/\s+/g, ' ')
      .replace(/WHERE\s+.*/i, 'WHERE ?')
      .replace(/VALUES\s*\([^)]*\)/gi, 'VALUES (?)')
      .substring(0, 200);
  }
}

// 导出单例实例
export default new DatabaseMonitor();