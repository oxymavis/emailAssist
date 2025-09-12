/**
 * 缓存监控和分析系统
 * 提供实时监控、性能分析、告警机制、可视化报表
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import SmartCacheStrategy from './SmartCacheStrategy';
import MultiLayerCache from './MultiLayerCache';
import CachePerformanceOptimizer from './CachePerformanceOptimizer';
import BusinessCacheStrategies from './BusinessCacheStrategies';

export interface MonitoringConfig {
  // 监控设置
  enabled: boolean;
  sampleRate: number; // 采样率 (0-1)
  metricsRetention: number; // 指标保留天数
  alertThresholds: AlertThresholds;
  reportInterval: number; // 报告间隔 (毫秒)
  
  // 数据收集
  collectHitRate: boolean;
  collectResponseTime: boolean;
  collectMemoryUsage: boolean;
  collectErrorRate: boolean;
  collectThroughput: boolean;
}

export interface AlertThresholds {
  hitRateMin: number;     // 最小命中率
  responseTimeMax: number; // 最大响应时间
  errorRateMax: number;   // 最大错误率
  memoryUsageMax: number; // 最大内存使用率
  throughputMin: number;  // 最小吞吐量
}

export interface CacheMetrics {
  timestamp: number;
  
  // 基础指标
  hitRate: number;
  missRate: number;
  errorRate: number;
  avgResponseTime: number;
  throughput: number;
  
  // 内存指标
  memoryUsage: number;
  maxMemory: number;
  memoryFragmentation: number;
  evictionRate: number;
  
  // 业务指标
  activeKeys: number;
  expiredKeys: number;
  hotKeysCount: number;
  
  // 层级指标
  l1Stats: LayerStats;
  l2Stats: LayerStats;
  l3Stats: LayerStats;
}

export interface LayerStats {
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  evictionCount: number;
}

export interface Alert {
  id: string;
  type: 'WARNING' | 'CRITICAL';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    avgHitRate: number;
    avgResponseTime: number;
    totalRequests: number;
    totalErrors: number;
    peakThroughput: number;
    memoryPeakUsage: number;
  };
  trends: {
    hitRateTrend: number[];
    responseTimeTrend: number[];
    throughputTrend: number[];
    errorRateTrend: number[];
  };
  hotspots: Array<{
    key: string;
    accessCount: number;
    avgResponseTime: number;
    cacheHitRate: number;
  }>;
  recommendations: string[];
}

export class CacheMonitoringSystem extends EventEmitter {
  private redis = RedisManager;
  private smartStrategy = SmartCacheStrategy;
  private multiLayer = MultiLayerCache;
  private optimizer = CachePerformanceOptimizer;
  private businessStrategies = BusinessCacheStrategies;

  private config: MonitoringConfig = {
    enabled: true,
    sampleRate: 1.0,
    metricsRetention: 30, // 30天
    alertThresholds: {
      hitRateMin: 80,      // 80%
      responseTimeMax: 100, // 100ms
      errorRateMax: 1,     // 1%
      memoryUsageMax: 85,  // 85%
      throughputMin: 100   // 100 req/s
    },
    reportInterval: 60000, // 1分钟
    
    collectHitRate: true,
    collectResponseTime: true,
    collectMemoryUsage: true,
    collectErrorRate: true,
    collectThroughput: true
  };

  // 实时指标
  private currentMetrics: CacheMetrics | null = null;
  private metricsHistory: CacheMetrics[] = [];
  private alerts: Alert[] = [];
  
  // 性能监控计数器
  private counters = {
    requests: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    totalResponseTime: 0,
    lastResetTime: Date.now()
  };
  
  // 热键追踪
  private hotKeysTracker = new Map<string, {
    accessCount: number;
    totalResponseTime: number;
    lastAccess: number;
    hitCount: number;
  }>();

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    if (this.config.enabled) {
      this.startMonitoring();
    }
    
    logger.info('CacheMonitoringSystem initialized', { config: this.config });
  }

  /**
   * 开始监控
   */
  startMonitoring(): void {
    // 定期收集指标
    setInterval(async () => {
      await this.collectMetrics();
    }, this.config.reportInterval);
    
    // 定期检查告警
    setInterval(async () => {
      await this.checkAlerts();
    }, 30000); // 30秒检查一次
    
    // 定期清理历史数据
    setInterval(async () => {
      await this.cleanupHistoricalData();
    }, 24 * 60 * 60 * 1000); // 每天清理一次
    
    // 定期生成报告
    setInterval(async () => {
      const report = await this.generatePerformanceReport('1h');
      this.emit('performance-report', report);
    }, 60 * 60 * 1000); // 每小时生成一次报告
    
    logger.info('Cache monitoring started');
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.config.enabled = false;
    this.removeAllListeners();
    logger.info('Cache monitoring stopped');
  }

  /**
   * 记录缓存操作
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    key: string,
    hit: boolean,
    responseTime: number,
    error?: Error
  ): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }
    
    try {
      // 更新计数器
      this.counters.requests++;
      this.counters.totalResponseTime += responseTime;
      
      if (hit) {
        this.counters.hits++;
      } else {
        this.counters.misses++;
      }
      
      if (error) {
        this.counters.errors++;
      }
      
      // 更新热键追踪
      this.updateHotKeyTracking(key, hit, responseTime);
      
      // 触发实时事件
      this.emit('cache-operation', {
        operation,
        key,
        hit,
        responseTime,
        error,
        timestamp: Date.now()
      });
      
    } catch (monitoringError) {
      logger.error('Error recording cache operation', { error: monitoringError });
    }
  }

  /**
   * 收集指标
   */
  async collectMetrics(): Promise<CacheMetrics> {
    try {
      const timestamp = Date.now();
      const elapsed = (timestamp - this.counters.lastResetTime) / 1000;
      
      // 基础指标
      const hitRate = this.counters.requests > 0 
        ? (this.counters.hits / this.counters.requests) * 100 
        : 0;
      const missRate = 100 - hitRate;
      const errorRate = this.counters.requests > 0 
        ? (this.counters.errors / this.counters.requests) * 100 
        : 0;
      const avgResponseTime = this.counters.requests > 0 
        ? this.counters.totalResponseTime / this.counters.requests 
        : 0;
      const throughput = elapsed > 0 ? this.counters.requests / elapsed : 0;
      
      // Redis内存指标
      const memoryInfo = await this.getRedisMemoryInfo();
      
      // 业务指标
      const businessMetrics = await this.getBusinessMetrics();
      
      // 层级指标
      const layerStats = await this.getLayerStats();
      
      const metrics: CacheMetrics = {
        timestamp,
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        
        memoryUsage: memoryInfo.usedMemory,
        maxMemory: memoryInfo.maxMemory,
        memoryFragmentation: memoryInfo.fragmentation,
        evictionRate: memoryInfo.evictedKeys,
        
        activeKeys: businessMetrics.activeKeys,
        expiredKeys: businessMetrics.expiredKeys,
        hotKeysCount: this.hotKeysTracker.size,
        
        l1Stats: layerStats.l1,
        l2Stats: layerStats.l2,
        l3Stats: layerStats.l3
      };
      
      // 存储当前指标
      this.currentMetrics = metrics;
      
      // 添加到历史记录
      this.metricsHistory.push(metrics);
      
      // 限制历史记录数量
      const maxHistorySize = Math.floor((this.config.metricsRetention * 24 * 60) / (this.config.reportInterval / 60000));
      if (this.metricsHistory.length > maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
      }
      
      // 持久化指标到Redis
      await this.persistMetrics(metrics);
      
      // 触发指标更新事件
      this.emit('metrics-collected', metrics);
      
      logger.debug('Metrics collected', {
        hitRate: metrics.hitRate,
        avgResponseTime: metrics.avgResponseTime,
        throughput: metrics.throughput,
        memoryUsage: memoryInfo.usedMemoryHuman
      });
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to collect metrics', error);
      throw error;
    }
  }

  /**
   * 检查告警
   */
  async checkAlerts(): Promise<void> {
    if (!this.currentMetrics) {
      return;
    }
    
    const metrics = this.currentMetrics;
    const thresholds = this.config.alertThresholds;
    const now = Date.now();
    
    // 检查命中率告警
    if (metrics.hitRate < thresholds.hitRateMin) {
      await this.createAlert('WARNING', 'Cache hit rate is below threshold', 'hitRate', metrics.hitRate, thresholds.hitRateMin);
    }
    
    // 检查响应时间告警
    if (metrics.avgResponseTime > thresholds.responseTimeMax) {
      await this.createAlert('CRITICAL', 'Average response time exceeds threshold', 'responseTime', metrics.avgResponseTime, thresholds.responseTimeMax);
    }
    
    // 检查错误率告警
    if (metrics.errorRate > thresholds.errorRateMax) {
      await this.createAlert('CRITICAL', 'Error rate exceeds threshold', 'errorRate', metrics.errorRate, thresholds.errorRateMax);
    }
    
    // 检查内存使用告警
    const memoryUsagePercent = metrics.maxMemory > 0 ? (metrics.memoryUsage / metrics.maxMemory) * 100 : 0;
    if (memoryUsagePercent > thresholds.memoryUsageMax) {
      await this.createAlert('WARNING', 'Memory usage exceeds threshold', 'memoryUsage', memoryUsagePercent, thresholds.memoryUsageMax);
    }
    
    // 检查吞吐量告警
    if (metrics.throughput < thresholds.throughputMin) {
      await this.createAlert('WARNING', 'Throughput is below threshold', 'throughput', metrics.throughput, thresholds.throughputMin);
    }
    
    // 自动解决已恢复的告警
    await this.resolveRecoveredAlerts();
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(period: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<PerformanceReport> {
    try {
      const now = Date.now();
      let periodMs: number;
      
      switch (period) {
        case '1h':
          periodMs = 60 * 60 * 1000;
          break;
        case '24h':
          periodMs = 24 * 60 * 60 * 1000;
          break;
        case '7d':
          periodMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          periodMs = 30 * 24 * 60 * 60 * 1000;
          break;
      }
      
      const startTime = now - periodMs;
      const periodMetrics = this.metricsHistory.filter(m => m.timestamp >= startTime);
      
      if (periodMetrics.length === 0) {
        throw new Error('No metrics available for the specified period');
      }
      
      // 计算汇总数据
      const summary = {
        avgHitRate: this.calculateAverage(periodMetrics.map(m => m.hitRate)),
        avgResponseTime: this.calculateAverage(periodMetrics.map(m => m.avgResponseTime)),
        totalRequests: this.counters.requests,
        totalErrors: this.counters.errors,
        peakThroughput: Math.max(...periodMetrics.map(m => m.throughput)),
        memoryPeakUsage: Math.max(...periodMetrics.map(m => m.memoryUsage))
      };
      
      // 计算趋势数据
      const trends = {
        hitRateTrend: this.calculateTrend(periodMetrics.map(m => m.hitRate)),
        responseTimeTrend: this.calculateTrend(periodMetrics.map(m => m.avgResponseTime)),
        throughputTrend: this.calculateTrend(periodMetrics.map(m => m.throughput)),
        errorRateTrend: this.calculateTrend(periodMetrics.map(m => m.errorRate))
      };
      
      // 生成热点数据
      const hotspots = await this.generateHotspotReport();
      
      // 生成优化建议
      const recommendations = await this.generateRecommendations(summary, trends);
      
      const report: PerformanceReport = {
        period: {
          start: startTime,
          end: now
        },
        summary,
        trends,
        hotspots,
        recommendations
      };
      
      logger.info('Performance report generated', {
        period,
        avgHitRate: summary.avgHitRate,
        avgResponseTime: summary.avgResponseTime,
        recommendations: recommendations.length
      });
      
      return report;
      
    } catch (error) {
      logger.error('Failed to generate performance report', { period, error });
      throw error;
    }
  }

  /**
   * 获取当前指标
   */
  getCurrentMetrics(): CacheMetrics | null {
    return this.currentMetrics;
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(limit = 100): CacheMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * 获取所有告警
   */
  getAllAlerts(limit = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 获取热点键统计
   */
  getHotKeysStats(): Array<{ key: string; stats: any }> {
    const now = Date.now();
    const hotKeys = [];
    
    for (const [key, stats] of this.hotKeysTracker) {
      if (now - stats.lastAccess < 60 * 60 * 1000) { // 只显示1小时内活跃的键
        hotKeys.push({
          key,
          stats: {
            accessCount: stats.accessCount,
            avgResponseTime: stats.totalResponseTime / stats.accessCount,
            hitRate: (stats.hitCount / stats.accessCount) * 100,
            lastAccess: stats.lastAccess
          }
        });
      }
    }
    
    return hotKeys.sort((a, b) => b.stats.accessCount - a.stats.accessCount).slice(0, 20);
  }

  /**
   * 重置计数器
   */
  resetCounters(): void {
    this.counters = {
      requests: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      totalResponseTime: 0,
      lastResetTime: Date.now()
    };
    
    logger.info('Monitoring counters reset');
  }

  // ==================== 私有方法 ====================

  /**
   * 更新热键追踪
   */
  private updateHotKeyTracking(key: string, hit: boolean, responseTime: number): void {
    let stats = this.hotKeysTracker.get(key);
    
    if (!stats) {
      stats = {
        accessCount: 0,
        totalResponseTime: 0,
        lastAccess: 0,
        hitCount: 0
      };
      this.hotKeysTracker.set(key, stats);
    }
    
    stats.accessCount++;
    stats.totalResponseTime += responseTime;
    stats.lastAccess = Date.now();
    
    if (hit) {
      stats.hitCount++;
    }
    
    // 限制热键跟踪数量
    if (this.hotKeysTracker.size > 1000) {
      const oldestKey = this.findOldestTrackedKey();
      if (oldestKey) {
        this.hotKeysTracker.delete(oldestKey);
      }
    }
  }

  /**
   * 查找最老的追踪键
   */
  private findOldestTrackedKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, stats] of this.hotKeysTracker) {
      if (stats.lastAccess < oldestTime) {
        oldestTime = stats.lastAccess;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * 获取Redis内存信息
   */
  private async getRedisMemoryInfo(): Promise<{
    usedMemory: number;
    maxMemory: number;
    usedMemoryHuman: string;
    fragmentation: number;
    evictedKeys: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const stats = await this.redis.info('stats');
      
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
      const usedMemoryHumanMatch = info.match(/used_memory_human:(.+)/);
      const fragmentationMatch = info.match(/mem_fragmentation_ratio:(\d+\.\d+)/);
      const evictedKeysMatch = stats.match(/evicted_keys:(\d+)/);
      
      return {
        usedMemory: usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0,
        maxMemory: maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0,
        usedMemoryHuman: usedMemoryHumanMatch ? usedMemoryHumanMatch[1].trim() : '0B',
        fragmentation: fragmentationMatch ? parseFloat(fragmentationMatch[1]) : 1.0,
        evictedKeys: evictedKeysMatch ? parseInt(evictedKeysMatch[1]) : 0
      };
    } catch (error) {
      logger.error('Failed to get Redis memory info', error);
      return {
        usedMemory: 0,
        maxMemory: 0,
        usedMemoryHuman: '0B',
        fragmentation: 1.0,
        evictedKeys: 0
      };
    }
  }

  /**
   * 获取业务指标
   */
  private async getBusinessMetrics(): Promise<{
    activeKeys: number;
    expiredKeys: number;
  }> {
    try {
      const allKeys = await this.redis.keys('cache:*');
      let expiredCount = 0;
      
      // 采样检查过期键
      const sampleSize = Math.min(100, allKeys.length);
      const sampleKeys = allKeys.slice(0, sampleSize);
      
      for (const key of sampleKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -2) {
          expiredCount++;
        }
      }
      
      // 推算总过期键数
      const estimatedExpiredKeys = allKeys.length > 0 
        ? Math.floor((expiredCount / sampleSize) * allKeys.length) 
        : 0;
      
      return {
        activeKeys: allKeys.length - estimatedExpiredKeys,
        expiredKeys: estimatedExpiredKeys
      };
    } catch (error) {
      logger.error('Failed to get business metrics', error);
      return {
        activeKeys: 0,
        expiredKeys: 0
      };
    }
  }

  /**
   * 获取层级统计
   */
  private async getLayerStats(): Promise<{
    l1: LayerStats;
    l2: LayerStats;
    l3: LayerStats;
  }> {
    try {
      const multiLayerStats = await this.multiLayer.getStats();
      
      return {
        l1: {
          hitRate: multiLayerStats.layers.L1?.hitRate || 0,
          avgResponseTime: multiLayerStats.layers.L1?.averageResponseTime || 0,
          memoryUsage: multiLayerStats.layers.L1?.memoryUsage || 0,
          keyCount: 0,
          evictionCount: 0
        },
        l2: {
          hitRate: multiLayerStats.layers.L2?.hitRate || 0,
          avgResponseTime: multiLayerStats.layers.L2?.averageResponseTime || 0,
          memoryUsage: multiLayerStats.layers.L2?.memoryUsage || 0,
          keyCount: 0,
          evictionCount: 0
        },
        l3: {
          hitRate: multiLayerStats.layers.L3?.hitRate || 0,
          avgResponseTime: multiLayerStats.layers.L3?.averageResponseTime || 0,
          memoryUsage: multiLayerStats.layers.L3?.memoryUsage || 0,
          keyCount: 0,
          evictionCount: 0
        }
      };
    } catch (error) {
      logger.error('Failed to get layer stats', error);
      return {
        l1: { hitRate: 0, avgResponseTime: 0, memoryUsage: 0, keyCount: 0, evictionCount: 0 },
        l2: { hitRate: 0, avgResponseTime: 0, memoryUsage: 0, keyCount: 0, evictionCount: 0 },
        l3: { hitRate: 0, avgResponseTime: 0, memoryUsage: 0, keyCount: 0, evictionCount: 0 }
      };
    }
  }

  /**
   * 持久化指标
   */
  private async persistMetrics(metrics: CacheMetrics): Promise<void> {
    try {
      const key = `metrics:cache:${Math.floor(metrics.timestamp / 60000)}`; // 按分钟存储
      const ttl = this.config.metricsRetention * 24 * 60 * 60; // 保留天数转换为秒
      
      await this.redis.set(key, JSON.stringify(metrics), ttl);
    } catch (error) {
      logger.error('Failed to persist metrics', error);
    }
  }

  /**
   * 创建告警
   */
  private async createAlert(
    type: 'WARNING' | 'CRITICAL',
    message: string,
    metric: string,
    currentValue: number,
    threshold: number
  ): Promise<void> {
    const alertId = `${metric}_${Date.now()}`;
    
    // 检查是否已存在相同的活跃告警
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved && alert.metric === metric && alert.type === type
    );
    
    if (existingAlert) {
      return; // 避免重复告警
    }
    
    const alert: Alert = {
      id: alertId,
      type,
      message,
      metric,
      currentValue,
      threshold,
      timestamp: Date.now(),
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // 限制告警历史数量
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
    
    // 触发告警事件
    this.emit('alert-created', alert);
    
    logger.warn('Cache alert created', {
      type,
      metric,
      currentValue,
      threshold,
      message
    });
  }

  /**
   * 解决已恢复的告警
   */
  private async resolveRecoveredAlerts(): Promise<void> {
    if (!this.currentMetrics) {
      return;
    }
    
    const metrics = this.currentMetrics;
    const thresholds = this.config.alertThresholds;
    const now = Date.now();
    
    for (const alert of this.alerts) {
      if (alert.resolved) {
        continue;
      }
      
      let shouldResolve = false;
      
      switch (alert.metric) {
        case 'hitRate':
          shouldResolve = metrics.hitRate >= thresholds.hitRateMin;
          break;
        case 'responseTime':
          shouldResolve = metrics.avgResponseTime <= thresholds.responseTimeMax;
          break;
        case 'errorRate':
          shouldResolve = metrics.errorRate <= thresholds.errorRateMax;
          break;
        case 'memoryUsage':
          const memoryUsagePercent = metrics.maxMemory > 0 ? (metrics.memoryUsage / metrics.maxMemory) * 100 : 0;
          shouldResolve = memoryUsagePercent <= thresholds.memoryUsageMax;
          break;
        case 'throughput':
          shouldResolve = metrics.throughput >= thresholds.throughputMin;
          break;
      }
      
      if (shouldResolve) {
        alert.resolved = true;
        alert.resolvedAt = now;
        
        this.emit('alert-resolved', alert);
        
        logger.info('Cache alert resolved', {
          alertId: alert.id,
          metric: alert.metric,
          resolvedAt: now
        });
      }
    }
  }

  /**
   * 清理历史数据
   */
  private async cleanupHistoricalData(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (this.config.metricsRetention * 24 * 60 * 60 * 1000);
      
      // 清理指标历史
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);
      
      // 清理告警历史 (保留最近1000条)
      const resolvedAlerts = this.alerts.filter(a => a.resolved && a.timestamp < cutoffTime);
      if (resolvedAlerts.length > 1000) {
        this.alerts = this.alerts.filter(a => !resolvedAlerts.includes(a));
      }
      
      // 清理Redis中的历史指标
      const metricsKeys = await this.redis.keys('metrics:cache:*');
      for (const key of metricsKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -2 || ttl === 0) {
          await this.redis.delete(key);
        }
      }
      
      logger.info('Historical data cleanup completed', {
        metricsRetained: this.metricsHistory.length,
        alertsRetained: this.alerts.length
      });
      
    } catch (error) {
      logger.error('Failed to cleanup historical data', error);
    }
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 计算趋势 (简化的线性回归)
   */
  private calculateTrend(values: number[]): number[] {
    if (values.length < 2) return values;
    
    // 简单的移动平均
    const windowSize = Math.max(5, Math.floor(values.length / 10));
    const trend = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = this.calculateAverage(window);
      trend.push(Math.round(avg * 100) / 100);
    }
    
    return trend;
  }

  /**
   * 生成热点报告
   */
  private async generateHotspotReport(): Promise<Array<{
    key: string;
    accessCount: number;
    avgResponseTime: number;
    cacheHitRate: number;
  }>> {
    const hotKeys = this.getHotKeysStats();
    
    return hotKeys.slice(0, 10).map(({ key, stats }) => ({
      key,
      accessCount: stats.accessCount,
      avgResponseTime: stats.avgResponseTime,
      cacheHitRate: stats.hitRate
    }));
  }

  /**
   * 生成优化建议
   */
  private async generateRecommendations(
    summary: any,
    trends: any
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    // 命中率建议
    if (summary.avgHitRate < 80) {
      recommendations.push('缓存命中率偏低，建议检查缓存策略和TTL设置');
    }
    
    // 响应时间建议
    if (summary.avgResponseTime > 50) {
      recommendations.push('平均响应时间较高，考虑优化缓存层级结构');
    }
    
    // 内存使用建议
    if (summary.memoryPeakUsage > 0.8) {
      recommendations.push('内存使用率过高，建议清理低频数据或增加内存');
    }
    
    // 趋势分析建议
    const hitRateTrend = trends.hitRateTrend;
    if (hitRateTrend.length > 1) {
      const recentTrend = hitRateTrend.slice(-5);
      const isDecreasing = recentTrend.every((val, i) => i === 0 || val < recentTrend[i - 1]);
      
      if (isDecreasing) {
        recommendations.push('缓存命中率呈下降趋势，需要调整缓存策略');
      }
    }
    
    // 默认建议
    if (recommendations.length === 0) {
      recommendations.push('缓存系统运行良好，继续监控关键指标');
    }
    
    return recommendations;
  }
}

// 导出单例实例
export default new CacheMonitoringSystem();