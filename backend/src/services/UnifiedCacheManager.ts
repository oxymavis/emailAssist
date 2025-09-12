/**
 * 统一缓存管理器
 * 整合所有缓存服务，提供统一的API接口
 */

import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import SmartCacheStrategy from './SmartCacheStrategy';
import MultiLayerCache from './MultiLayerCache';
import CachePerformanceOptimizer from './CachePerformanceOptimizer';
import BusinessCacheStrategies from './BusinessCacheStrategies';
import CacheMonitoringSystem from './CacheMonitoringSystem';
import CacheConfigManager from './CacheConfigManager';
import CacheConsistencyManager from './CacheConsistencyManager';

export interface UnifiedCacheOptions {
  ttl?: number;
  priority?: number;
  tags?: string[];
  userId?: string;
  consistencyLevel?: 'eventual' | 'strong' | 'weak';
  businessContext?: 'email' | 'analysis' | 'user' | 'search';
  compression?: boolean;
  replicate?: boolean;
  monitor?: boolean;
}

export interface CacheStats {
  // 基础统计
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  
  // 性能统计
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  
  // 层级统计
  layerStats: {
    l1: any;
    l2: any;
    l3: any;
  };
  
  // 业务统计
  businessStats: {
    email: any;
    analysis: any;
    user: any;
    search: any;
  };
  
  // 一致性统计
  consistencyRate: number;
  conflictCount: number;
  
  // 系统统计
  memoryUsage: number;
  activeLocks: number;
  queueSize: number;
}

export interface HealthStatus {
  healthy: boolean;
  issues: string[];
  services: {
    smartStrategy: boolean;
    multiLayer: boolean;
    optimizer: boolean;
    monitoring: boolean;
    consistency: boolean;
  };
}

export class UnifiedCacheManager extends EventEmitter {
  // 缓存服务实例
  private smartStrategy = SmartCacheStrategy;
  private multiLayer = MultiLayerCache;
  private optimizer = CachePerformanceOptimizer;
  private businessStrategies = BusinessCacheStrategies;
  private monitoring = CacheMonitoringSystem;
  private configManager = CacheConfigManager;
  private consistency = CacheConsistencyManager;
  
  // 状态标记
  private initialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * 初始化统一缓存管理器
   */
  private async initialize(): Promise<void> {
    try {
      // 监听配置变更
      this.configManager.on('configuration-hot-reload', (config) => {
        this.handleConfigurationChange(config);
      });
      
      // 监听缓存操作
      this.multiLayer.on('cache-operation', (operation) => {
        this.monitoring.recordCacheOperation(
          operation.operation,
          operation.key,
          operation.hit,
          operation.responseTime,
          operation.error
        );
      });
      
      // 启动健康检查
      this.startHealthCheck();
      
      this.initialized = true;
      logger.info('UnifiedCacheManager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize UnifiedCacheManager', error);
      throw error;
    }
  }

  // ==================== 核心缓存操作 ====================

  /**
   * 智能缓存获取
   */
  async get<T>(key: string, options: UnifiedCacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // 记录访问模式
      if (options.userId) {
        await this.smartStrategy.recordAccess(key, options.userId);
      }
      
      let result: T | null = null;
      
      // 根据业务上下文选择获取策略
      if (options.businessContext) {
        result = await this.getByBusinessContext<T>(key, options);
      } else if (options.consistencyLevel) {
        result = await this.getWithConsistency<T>(key, options);
      } else {
        // 默认多层缓存获取
        result = await this.multiLayer.get<T>(key);
      }
      
      const responseTime = Date.now() - startTime;
      
      // 记录监控指标
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'get',
          key,
          result !== null,
          responseTime
        );
      }
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'get',
          key,
          false,
          responseTime,
          error as Error
        );
      }
      
      logger.error('Unified cache get failed', { key, error });
      return null;
    }
  }

  /**
   * 智能缓存设置
   */
  async set<T>(key: string, data: T, options: UnifiedCacheOptions = {}): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      let success = false;
      
      // 根据业务上下文选择设置策略
      if (options.businessContext) {
        success = await this.setByBusinessContext(key, data, options);
      } else if (options.consistencyLevel) {
        success = await this.setWithConsistency(key, data, options);
      } else {
        // 获取最优策略
        const strategy = await this.smartStrategy.getOptimalStrategy(key, options.userId);
        
        // 使用性能优化器设置
        success = await this.optimizer.setWithOptimization(key, data, strategy.ttl || options.ttl, {
          compress: options.compression,
          tags: options.tags
        });
      }
      
      const responseTime = Date.now() - startTime;
      
      // 记录监控指标
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'set',
          key,
          true,
          responseTime
        );
      }
      
      return success;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'set',
          key,
          false,
          responseTime,
          error as Error
        );
      }
      
      logger.error('Unified cache set failed', { key, error });
      return false;
    }
  }

  /**
   * 缓存删除
   */
  async delete(key: string, options: UnifiedCacheOptions = {}): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      let success = false;
      
      if (options.consistencyLevel === 'strong') {
        // 使用分布式锁确保强一致性删除
        const lockId = await this.consistency.acquireLock(`delete:${key}`, 5000);
        
        if (lockId) {
          try {
            success = await this.multiLayer.delete(key);
          } finally {
            await this.consistency.releaseLock(`delete:${key}`, lockId);
          }
        }
      } else {
        success = await this.multiLayer.delete(key);
      }
      
      const responseTime = Date.now() - startTime;
      
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'delete',
          key,
          success,
          responseTime
        );
      }
      
      return success;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (options.monitor !== false) {
        this.monitoring.recordCacheOperation(
          'delete',
          key,
          false,
          responseTime,
          error as Error
        );
      }
      
      logger.error('Unified cache delete failed', { key, error });
      return false;
    }
  }

  /**
   * 批量获取
   */
  async mget<T>(keys: string[], options: UnifiedCacheOptions = {}): Promise<Map<string, T | null>> {
    try {
      // 记录访问模式
      if (options.userId) {
        for (const key of keys) {
          await this.smartStrategy.recordAccess(key, options.userId);
        }
      }
      
      let results: Map<string, T | null>;
      
      if (options.businessContext) {
        // 业务上下文批量获取
        results = await this.batchGetByBusinessContext<T>(keys, options);
      } else {
        // 默认批量获取
        results = await this.multiLayer.mget<T>(keys);
      }
      
      return results;
      
    } catch (error) {
      logger.error('Unified cache mget failed', { keysCount: keys.length, error });
      
      // 返回空结果
      const results = new Map<string, T | null>();
      keys.forEach(key => results.set(key, null));
      return results;
    }
  }

  /**
   * 批量设置
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; options?: UnifiedCacheOptions }>,
    globalOptions: UnifiedCacheOptions = {}
  ): Promise<boolean[]> {
    try {
      const promises = entries.map(entry => 
        this.set(entry.key, entry.value, { ...globalOptions, ...entry.options })
      );
      
      return await Promise.all(promises);
      
    } catch (error) {
      logger.error('Unified cache mset failed', { entriesCount: entries.length, error });
      return entries.map(() => false);
    }
  }

  // ==================== 高级功能 ====================

  /**
   * 带回源的缓存获取
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: UnifiedCacheOptions = {}
  ): Promise<T> {
    try {
      // 先尝试获取缓存
      let data = await this.get<T>(key, options);
      
      if (data === null) {
        // 缓存未命中，执行回源
        data = await fetchFunction();
        
        if (data !== null) {
          // 缓存回源结果
          await this.set(key, data, options);
        }
      }
      
      return data as T;
      
    } catch (error) {
      logger.error('getOrSet operation failed', { key, error });
      throw error;
    }
  }

  /**
   * 预测性缓存预加载
   */
  async preloadCache(userId?: string): Promise<void> {
    try {
      const predictions = await this.smartStrategy.predictAndPreload(userId);
      
      logger.info('Cache preload completed', {
        userId,
        predictionsCount: predictions.length
      });
      
    } catch (error) {
      logger.error('Cache preload failed', { userId, error });
    }
  }

  /**
   * 缓存预热
   */
  async warmup(entries: Array<{
    key: string;
    fetchCallback: () => Promise<any>;
    options?: UnifiedCacheOptions;
  }>): Promise<void> {
    try {
      const warmupEntries = entries.map(entry => ({
        key: entry.key,
        fetchCallback: entry.fetchCallback,
        options: entry.options
      }));
      
      await this.multiLayer.warmup(warmupEntries);
      
      logger.info('Cache warmup completed', { entriesCount: entries.length });
      
    } catch (error) {
      logger.error('Cache warmup failed', error);
    }
  }

  /**
   * 按标签删除缓存
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      const deletedCount = await this.multiLayer.deleteByTag(tag);
      
      logger.info('Cache deleted by tag', { tag, deletedCount });
      
      return deletedCount;
      
    } catch (error) {
      logger.error('Delete by tag failed', { tag, error });
      return 0;
    }
  }

  /**
   * 清空指定层级缓存
   */
  async clear(layer?: 'L1' | 'L2' | 'L3'): Promise<void> {
    try {
      await this.multiLayer.clear(layer);
      
      logger.info('Cache cleared', { layer: layer || 'all' });
      
    } catch (error) {
      logger.error('Cache clear failed', { layer, error });
    }
  }

  // ==================== 监控和分析 ====================

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<CacheStats> {
    try {
      const [
        multiLayerStats,
        optimizerMetrics,
        monitoringMetrics,
        consistencyStatus,
        strategyStats
      ] = await Promise.all([
        this.multiLayer.getStats(),
        this.optimizer.getPerformanceMetrics(),
        this.monitoring.getCurrentMetrics(),
        this.consistency.getNodeStatus(),
        this.smartStrategy.getStrategyStats()
      ]);
      
      const stats: CacheStats = {
        // 基础统计
        totalRequests: optimizerMetrics.throughput,
        cacheHits: Math.round(optimizerMetrics.throughput * optimizerMetrics.cacheHitRate / 100),
        cacheMisses: Math.round(optimizerMetrics.throughput * (100 - optimizerMetrics.cacheHitRate) / 100),
        hitRate: optimizerMetrics.cacheHitRate,
        
        // 性能统计
        averageResponseTime: optimizerMetrics.avgResponseTime,
        throughput: optimizerMetrics.throughput,
        errorRate: optimizerMetrics.errorRate,
        
        // 层级统计
        layerStats: multiLayerStats.layers,
        
        // 业务统计
        businessStats: {
          email: {},
          analysis: {},
          user: {},
          search: {}
        },
        
        // 一致性统计
        consistencyRate: monitoringMetrics?.hitRate || 0,
        conflictCount: 0,
        
        // 系统统计
        memoryUsage: optimizerMetrics.memoryUsage,
        activeLocks: consistencyStatus.activeLocks,
        queueSize: consistencyStatus.syncQueueSize
      };
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      throw error;
    }
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(period: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      return await this.monitoring.generatePerformanceReport(period);
    } catch (error) {
      logger.error('Failed to get performance report', { period, error });
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const [
        multiLayerHealth,
        consistencyHealth
      ] = await Promise.all([
        this.multiLayer.healthCheck(),
        Promise.resolve({ healthy: true, layers: {}, issues: [] }) // 简化实现
      ]);
      
      const services = {
        smartStrategy: true,
        multiLayer: multiLayerHealth.healthy,
        optimizer: true,
        monitoring: true,
        consistency: consistencyHealth.healthy
      };
      
      const allHealthy = Object.values(services).every(healthy => healthy);
      const issues = [
        ...multiLayerHealth.issues,
        ...consistencyHealth.issues
      ];
      
      return {
        healthy: allHealthy,
        issues,
        services
      };
      
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        healthy: false,
        issues: ['Health check execution failed'],
        services: {
          smartStrategy: false,
          multiLayer: false,
          optimizer: false,
          monitoring: false,
          consistency: false
        }
      };
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 获取当前配置
   */
  getCurrentConfig(): any {
    return this.configManager.getCurrentConfiguration();
  }

  /**
   * 更新配置
   */
  async updateConfig(configId: string, updates: any, user = 'system'): Promise<boolean> {
    try {
      await this.configManager.updateConfiguration(configId, updates, user);
      return true;
    } catch (error) {
      logger.error('Failed to update config', { configId, error });
      return false;
    }
  }

  /**
   * 启用配置
   */
  async enableConfig(configId: string, user = 'system'): Promise<boolean> {
    try {
      await this.configManager.enableConfiguration(configId, user);
      return true;
    } catch (error) {
      logger.error('Failed to enable config', { configId, error });
      return false;
    }
  }

  // ==================== 数据一致性 ====================

  /**
   * 检查数据一致性
   */
  async checkConsistency(key: string): Promise<any> {
    try {
      return await this.consistency.checkConsistency(key);
    } catch (error) {
      logger.error('Consistency check failed', { key, error });
      throw error;
    }
  }

  /**
   * 强制数据同步
   */
  async forceSync(key: string): Promise<boolean> {
    try {
      return await this.consistency.forceSyncData(key);
    } catch (error) {
      logger.error('Force sync failed', { key, error });
      return false;
    }
  }

  /**
   * 数据完整性检查
   */
  async integrityCheck(): Promise<any> {
    try {
      return await this.consistency.performIntegrityCheck();
    } catch (error) {
      logger.error('Integrity check failed', error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 根据业务上下文获取数据
   */
  private async getByBusinessContext<T>(key: string, options: UnifiedCacheOptions): Promise<T | null> {
    switch (options.businessContext) {
      case 'email':
        // 这里应该调用具体的业务缓存方法
        return await this.multiLayer.get<T>(key);
        
      case 'analysis':
        return await this.multiLayer.get<T>(key);
        
      case 'user':
        return await this.multiLayer.get<T>(key);
        
      case 'search':
        return await this.multiLayer.get<T>(key);
        
      default:
        return await this.multiLayer.get<T>(key);
    }
  }

  /**
   * 根据业务上下文设置数据
   */
  private async setByBusinessContext<T>(key: string, data: T, options: UnifiedCacheOptions): Promise<boolean> {
    switch (options.businessContext) {
      case 'email':
        return await this.multiLayer.set(key, data, options);
        
      case 'analysis':
        return await this.multiLayer.set(key, data, options);
        
      case 'user':
        return await this.multiLayer.set(key, data, options);
        
      case 'search':
        return await this.multiLayer.set(key, data, options);
        
      default:
        return await this.multiLayer.set(key, data, options);
    }
  }

  /**
   * 业务上下文批量获取
   */
  private async batchGetByBusinessContext<T>(keys: string[], options: UnifiedCacheOptions): Promise<Map<string, T | null>> {
    // 根据业务上下文选择批量获取策略
    return await this.multiLayer.mget<T>(keys);
  }

  /**
   * 带一致性保证的获取
   */
  private async getWithConsistency<T>(key: string, options: UnifiedCacheOptions): Promise<T | null> {
    const versionedData = await this.consistency.getConsistentData<T>(key, {
      consistencyLevel: options.consistencyLevel
    });
    
    return versionedData ? versionedData.data : null;
  }

  /**
   * 带一致性保证的设置
   */
  private async setWithConsistency<T>(key: string, data: T, options: UnifiedCacheOptions): Promise<boolean> {
    return await this.consistency.setConsistentData(key, data, {
      ttl: options.ttl,
      userId: options.userId,
      replicate: options.replicate
    });
  }

  /**
   * 处理配置变更
   */
  private handleConfigurationChange(config: any): void {
    try {
      logger.info('Handling configuration change', {
        configId: config.id,
        version: config.version
      });
      
      // 触发配置更新事件
      this.emit('configuration-changed', config);
      
    } catch (error) {
      logger.error('Failed to handle configuration change', error);
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    // 每5分钟进行一次健康检查
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        
        if (!health.healthy) {
          logger.warn('Cache system health issues detected', {
            issues: health.issues,
            services: health.services
          });
          
          this.emit('health-issues', health);
        }
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 停止服务
   */
  async shutdown(): Promise<void> {
    try {
      // 停止健康检查
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // 停止监控
      this.monitoring.stopMonitoring();
      
      // 清理事件监听器
      this.removeAllListeners();
      
      logger.info('UnifiedCacheManager shutdown completed');
      
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
}

// 导出单例实例
export default new UnifiedCacheManager();