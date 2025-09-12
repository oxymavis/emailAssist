/**
 * 多层缓存架构系统
 * L1: 应用内存缓存 (Node.js) | L2: Redis分布式缓存 | L3: CDN边缘缓存
 * 提供智能数据流动和缓存层级管理
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import LRU from 'lru-cache';
import zlib from 'zlib';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheItem<T = any> {
  data: T;
  metadata: {
    layer: 'L1' | 'L2' | 'L3';
    size: number;
    compressed: boolean;
    createdAt: number;
    lastAccess: number;
    accessCount: number;
    ttl: number;
    tags: string[];
    priority: number;
  };
}

export interface CacheMetrics {
  layer: string;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  averageResponseTime: number;
  totalRequests: number;
}

export interface CacheConfig {
  l1MaxSize: number;
  l1TTL: number;
  l2TTL: number;
  compressionThreshold: number;
  syncEnabled: boolean;
  prefetchEnabled: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

export class MultiLayerCache extends EventEmitter {
  private redis = RedisManager;
  
  // L1 缓存 - 应用内存缓存
  private l1Cache: LRU<string, CacheItem>;
  
  // 缓存配置
  private config: CacheConfig = {
    l1MaxSize: 1000, // 最大1000个条目
    l1TTL: 300000, // 5分钟
    l2TTL: 1800000, // 30分钟
    compressionThreshold: 1024, // 1KB
    syncEnabled: true,
    prefetchEnabled: true,
    evictionPolicy: 'lru'
  };
  
  // 性能指标
  private metrics = new Map<string, CacheMetrics>();
  
  // 同步队列
  private syncQueue: Array<{ key: string, data: CacheItem, operation: 'set' | 'delete' }> = [];
  private syncInProgress = false;
  
  constructor(config?: Partial<CacheConfig>) {
    super();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // 初始化L1缓存
    this.l1Cache = new LRU({
      max: this.config.l1MaxSize,
      maxAge: this.config.l1TTL,
      dispose: (key, value) => this.onL1Eviction(key, value),
      updateAgeOnGet: true
    });
    
    // 初始化指标
    this.initializeMetrics();
    
    // 启动后台同步
    this.startBackgroundSync();
    
    logger.info('MultiLayerCache initialized', { config: this.config });
  }

  /**
   * 智能缓存获取 - 从最快的层开始查找
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    let result: T | null = null;
    let hitLayer: string | null = null;
    
    try {
      // L1 缓存查找
      result = await this.getFromL1<T>(key);
      if (result !== null) {
        hitLayer = 'L1';
        await this.recordHit('L1', Date.now() - startTime);
        return result;
      }
      
      // L2 缓存查找
      result = await this.getFromL2<T>(key);
      if (result !== null) {
        hitLayer = 'L2';
        // 异步提升到L1
        this.promoteToL1(key, result);
        await this.recordHit('L2', Date.now() - startTime);
        return result;
      }
      
      // L3 缓存查找 (CDN/外部缓存)
      result = await this.getFromL3<T>(key);
      if (result !== null) {
        hitLayer = 'L3';
        // 异步提升到L2和L1
        this.promoteToL2(key, result);
        this.promoteToL1(key, result);
        await this.recordHit('L3', Date.now() - startTime);
        return result;
      }
      
      // 缓存未命中
      await this.recordMiss('ALL', Date.now() - startTime);
      return null;
      
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      return null;
    } finally {
      logger.debug('Cache get completed', {
        key,
        hitLayer,
        responseTime: Date.now() - startTime
      });
    }
  }

  /**
   * 智能缓存设置 - 根据数据特性选择合适的层级
   */
  async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      priority?: number;
      tags?: string[];
      forceLayer?: 'L1' | 'L2' | 'L3';
    } = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const serializedData = JSON.stringify(data);
      const dataSize = Buffer.byteLength(serializedData, 'utf8');
      
      // 创建缓存项
      const cacheItem: CacheItem<T> = {
        data,
        metadata: {
          layer: 'L1',
          size: dataSize,
          compressed: false,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          ttl: options.ttl || this.config.l1TTL,
          tags: options.tags || [],
          priority: options.priority || 1
        }
      };
      
      // 压缩大数据
      if (dataSize > this.config.compressionThreshold) {
        const compressed = await gzip(Buffer.from(serializedData));
        cacheItem.data = compressed as any;
        cacheItem.metadata.compressed = true;
        cacheItem.metadata.size = compressed.length;
      }
      
      let success = false;
      
      // 根据数据特性和配置选择存储层级
      if (options.forceLayer) {
        success = await this.setInLayer(options.forceLayer, key, cacheItem);
      } else {
        success = await this.setInOptimalLayer(key, cacheItem);
      }
      
      // 添加到同步队列
      if (success && this.config.syncEnabled) {
        this.queueForSync(key, cacheItem, 'set');
      }
      
      const responseTime = Date.now() - startTime;
      logger.debug('Cache set completed', {
        key,
        size: cacheItem.metadata.size,
        compressed: cacheItem.metadata.compressed,
        layer: cacheItem.metadata.layer,
        responseTime
      });
      
      return success;
      
    } catch (error) {
      logger.error('Cache set failed', { key, error });
      return false;
    }
  }

  /**
   * 批量获取
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const startTime = Date.now();
    
    try {
      // 并行获取所有键
      const promises = keys.map(async (key) => {
        const value = await this.get<T>(key);
        return { key, value };
      });
      
      const resolvedPromises = await Promise.allSettled(promises);
      
      resolvedPromises.forEach((result, index) => {
        const key = keys[index];
        if (result.status === 'fulfilled') {
          results.set(key, result.value.value);
        } else {
          results.set(key, null);
          logger.error('Batch get failed for key', { key, error: result.reason });
        }
      });
      
      const responseTime = Date.now() - startTime;
      logger.debug('Batch cache get completed', {
        requestedKeys: keys.length,
        responseTime
      });
      
      return results;
      
    } catch (error) {
      logger.error('Batch cache get failed', { keys, error });
      
      // 返回空结果
      keys.forEach(key => results.set(key, null));
      return results;
    }
  }

  /**
   * 批量设置
   */
  async mset<T>(entries: Array<{ key: string, value: T, options?: any }>): Promise<boolean[]> {
    const startTime = Date.now();
    const results: boolean[] = [];
    
    try {
      // 并行设置所有条目
      const promises = entries.map(async (entry) => {
        return await this.set(entry.key, entry.value, entry.options || {});
      });
      
      const resolvedPromises = await Promise.allSettled(promises);
      
      resolvedPromises.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push(false);
          logger.error('Batch set failed for entry', { 
            entry: entries[index], 
            error: result.reason 
          });
        }
      });
      
      const responseTime = Date.now() - startTime;
      const successCount = results.filter(r => r).length;
      
      logger.debug('Batch cache set completed', {
        totalEntries: entries.length,
        successCount,
        responseTime
      });
      
      return results;
      
    } catch (error) {
      logger.error('Batch cache set failed', { entries: entries.length, error });
      return entries.map(() => false);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<boolean> {
    try {
      let success = false;
      
      // 从所有层级删除
      const l1Success = this.l1Cache.del(key);
      const l2Success = await this.deleteFromL2(key);
      const l3Success = await this.deleteFromL3(key);
      
      success = l1Success || l2Success || l3Success;
      
      // 添加到同步队列
      if (this.config.syncEnabled) {
        this.queueForSync(key, null as any, 'delete');
      }
      
      logger.debug('Cache delete completed', { key, success });
      return success;
      
    } catch (error) {
      logger.error('Cache delete failed', { key, error });
      return false;
    }
  }

  /**
   * 按标签删除
   */
  async deleteByTag(tag: string): Promise<number> {
    let deletedCount = 0;
    
    try {
      // L1 层删除
      const l1Keys = Array.from(this.l1Cache.keys());
      for (const key of l1Keys) {
        const item = this.l1Cache.get(key);
        if (item && item.metadata.tags.includes(tag)) {
          this.l1Cache.del(key);
          deletedCount++;
        }
      }
      
      // L2 层删除
      const l2DeletedCount = await this.deleteByTagFromL2(tag);
      deletedCount += l2DeletedCount;
      
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
      if (!layer || layer === 'L1') {
        this.l1Cache.reset();
        logger.info('L1 cache cleared');
      }
      
      if (!layer || layer === 'L2') {
        await this.clearL2();
        logger.info('L2 cache cleared');
      }
      
      if (!layer || layer === 'L3') {
        await this.clearL3();
        logger.info('L3 cache cleared');
      }
      
      if (!layer) {
        logger.info('All cache layers cleared');
      }
      
    } catch (error) {
      logger.error('Cache clear failed', { layer, error });
    }
  }

  /**
   * 缓存预热
   */
  async warmup(entries: Array<{
    key: string;
    fetchCallback: () => Promise<any>;
    options?: any;
  }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting cache warmup', { entriesCount: entries.length });
      
      // 批量预热，限制并发数
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < entries.length; i += batchSize) {
        batches.push(entries.slice(i, i + batchSize));
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const batch of batches) {
        const promises = batch.map(async (entry) => {
          try {
            const data = await entry.fetchCallback();
            const success = await this.set(entry.key, data, entry.options);
            return success ? 'success' : 'failed';
          } catch (error) {
            logger.warn('Warmup entry failed', { key: entry.key, error });
            return 'error';
          }
        });
        
        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value === 'success') successCount++;
            else if (result.value === 'error') errorCount++;
          } else {
            errorCount++;
          }
        });
      }
      
      const duration = Date.now() - startTime;
      logger.info('Cache warmup completed', {
        total: entries.length,
        successful: successCount,
        errors: errorCount,
        duration
      });
      
    } catch (error) {
      logger.error('Cache warmup failed', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    layers: Record<string, CacheMetrics>;
    overall: {
      totalHitRate: number;
      averageResponseTime: number;
      memoryUsage: number;
    };
  }> {
    try {
      const layerStats = Object.fromEntries(this.metrics);
      
      // 计算总体统计
      const totalRequests = Array.from(this.metrics.values())
        .reduce((sum, metrics) => sum + metrics.totalRequests, 0);
      
      const totalHits = Array.from(this.metrics.values())
        .reduce((sum, metrics) => sum + (metrics.totalRequests * metrics.hitRate / 100), 0);
      
      const totalHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      
      const avgResponseTime = Array.from(this.metrics.values())
        .reduce((sum, metrics) => sum + metrics.averageResponseTime, 0) / this.metrics.size;
      
      const totalMemoryUsage = Array.from(this.metrics.values())
        .reduce((sum, metrics) => sum + metrics.memoryUsage, 0);
      
      return {
        layers: layerStats,
        overall: {
          totalHitRate: Math.round(totalHitRate * 100) / 100,
          averageResponseTime: Math.round(avgResponseTime * 100) / 100,
          memoryUsage: totalMemoryUsage
        }
      };
      
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return {
        layers: {},
        overall: {
          totalHitRate: 0,
          averageResponseTime: 0,
          memoryUsage: 0
        }
      };
    }
  }

  /**
   * 缓存健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    layers: Record<string, boolean>;
    issues: string[];
  }> {
    const issues: string[] = [];
    const layerHealth: Record<string, boolean> = {};
    
    try {
      // L1 健康检查
      layerHealth.L1 = this.l1Cache.length >= 0; // 基本可用性检查
      
      // L2 健康检查
      try {
        await this.redis.ping();
        layerHealth.L2 = true;
      } catch (error) {
        layerHealth.L2 = false;
        issues.push('Redis connection failed');
      }
      
      // L3 健康检查 (CDN或外部服务)
      layerHealth.L3 = true; // 简化实现
      
      // 检查缓存命中率
      const stats = await this.getStats();
      if (stats.overall.totalHitRate < 50) {
        issues.push('Low cache hit rate detected');
      }
      
      // 检查内存使用
      const l1Usage = (this.l1Cache.length / this.config.l1MaxSize) * 100;
      if (l1Usage > 90) {
        issues.push('L1 cache near capacity');
      }
      
      const healthy = Object.values(layerHealth).every(h => h) && issues.length === 0;
      
      return {
        healthy,
        layers: layerHealth,
        issues
      };
      
    } catch (error) {
      logger.error('Cache health check failed', error);
      return {
        healthy: false,
        layers: layerHealth,
        issues: [...issues, 'Health check failed']
      };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 从L1缓存获取
   */
  private async getFromL1<T>(key: string): Promise<T | null> {
    const item = this.l1Cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 更新访问统计
    item.metadata.lastAccess = Date.now();
    item.metadata.accessCount++;
    
    // 解压缩数据
    if (item.metadata.compressed) {
      try {
        const decompressed = await gunzip(item.data as Buffer);
        return JSON.parse(decompressed.toString());
      } catch (error) {
        logger.error('L1 cache decompression failed', { key, error });
        this.l1Cache.del(key); // 删除损坏的数据
        return null;
      }
    }
    
    return item.data as T;
  }

  /**
   * 从L2缓存获取
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    try {
      const serialized = await this.redis.get(`cache:l2:${key}`);
      
      if (!serialized) {
        return null;
      }
      
      const item: CacheItem<T> = JSON.parse(serialized);
      
      // 检查TTL
      if (Date.now() - item.metadata.createdAt > item.metadata.ttl) {
        await this.redis.delete(`cache:l2:${key}`);
        return null;
      }
      
      // 解压缩数据
      if (item.metadata.compressed) {
        const decompressed = await gunzip(Buffer.from(item.data as string, 'base64'));
        return JSON.parse(decompressed.toString());
      }
      
      return item.data;
      
    } catch (error) {
      logger.error('L2 cache get failed', { key, error });
      return null;
    }
  }

  /**
   * 从L3缓存获取 (CDN/外部缓存)
   */
  private async getFromL3<T>(key: string): Promise<T | null> {
    // 这里应该实现CDN或外部缓存的获取逻辑
    // 暂时返回null表示未实现
    return null;
  }

  /**
   * 提升到L1
   */
  private async promoteToL1<T>(key: string, data: T): Promise<void> {
    try {
      const item: CacheItem<T> = {
        data,
        metadata: {
          layer: 'L1',
          size: Buffer.byteLength(JSON.stringify(data), 'utf8'),
          compressed: false,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          ttl: this.config.l1TTL,
          tags: [],
          priority: 2 // 提升的数据优先级较高
        }
      };
      
      this.l1Cache.set(key, item);
      
    } catch (error) {
      logger.error('Failed to promote to L1', { key, error });
    }
  }

  /**
   * 提升到L2
   */
  private async promoteToL2<T>(key: string, data: T): Promise<void> {
    try {
      await this.setInLayer('L2', key, {
        data,
        metadata: {
          layer: 'L2',
          size: Buffer.byteLength(JSON.stringify(data), 'utf8'),
          compressed: false,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          ttl: this.config.l2TTL,
          tags: [],
          priority: 2
        }
      });
      
    } catch (error) {
      logger.error('Failed to promote to L2', { key, error });
    }
  }

  /**
   * 在指定层设置缓存
   */
  private async setInLayer<T>(layer: 'L1' | 'L2' | 'L3', key: string, item: CacheItem<T>): Promise<boolean> {
    try {
      switch (layer) {
        case 'L1':
          this.l1Cache.set(key, item);
          return true;
          
        case 'L2':
          const serialized = JSON.stringify({
            ...item,
            data: item.metadata.compressed 
              ? (item.data as Buffer).toString('base64') 
              : item.data
          });
          
          return await this.redis.set(
            `cache:l2:${key}`, 
            serialized, 
            Math.floor(item.metadata.ttl / 1000)
          );
          
        case 'L3':
          // CDN缓存实现
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      logger.error('Failed to set in layer', { layer, key, error });
      return false;
    }
  }

  /**
   * 选择最优存储层级
   */
  private async setInOptimalLayer<T>(key: string, item: CacheItem<T>): Promise<boolean> {
    // 根据数据大小和优先级选择层级
    if (item.metadata.size < 1024 && item.metadata.priority >= 3) {
      // 小数据高优先级存储在L1
      return await this.setInLayer('L1', key, item);
    } else if (item.metadata.size < 10240) {
      // 中等数据存储在L2，并复制到L1
      const l2Success = await this.setInLayer('L2', key, item);
      if (l2Success && this.l1Cache.length < this.config.l1MaxSize * 0.8) {
        await this.setInLayer('L1', key, item);
      }
      return l2Success;
    } else {
      // 大数据只存储在L2
      return await this.setInLayer('L2', key, item);
    }
  }

  /**
   * 从L2删除
   */
  private async deleteFromL2(key: string): Promise<boolean> {
    try {
      return await this.redis.delete(`cache:l2:${key}`);
    } catch (error) {
      logger.error('L2 cache delete failed', { key, error });
      return false;
    }
  }

  /**
   * 从L3删除
   */
  private async deleteFromL3(key: string): Promise<boolean> {
    // CDN缓存删除实现
    return true;
  }

  /**
   * 按标签从L2删除
   */
  private async deleteByTagFromL2(tag: string): Promise<number> {
    try {
      const keys = await this.redis.keys('cache:l2:*');
      let deletedCount = 0;
      
      for (const key of keys) {
        const serialized = await this.redis.get(key);
        if (serialized) {
          const item = JSON.parse(serialized);
          if (item.metadata && item.metadata.tags && item.metadata.tags.includes(tag)) {
            await this.redis.delete(key);
            deletedCount++;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('L2 delete by tag failed', { tag, error });
      return 0;
    }
  }

  /**
   * 清空L2缓存
   */
  private async clearL2(): Promise<void> {
    try {
      const keys = await this.redis.keys('cache:l2:*');
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      logger.error('L2 cache clear failed', error);
    }
  }

  /**
   * 清空L3缓存
   */
  private async clearL3(): Promise<void> {
    // CDN缓存清空实现
  }

  /**
   * L1缓存驱逐回调
   */
  private onL1Eviction(key: string, item: CacheItem): void {
    logger.debug('L1 cache eviction', {
      key,
      accessCount: item.metadata.accessCount,
      size: item.metadata.size
    });
    
    this.updateMetrics('L1', 'eviction');
  }

  /**
   * 队列同步操作
   */
  private queueForSync(key: string, data: CacheItem, operation: 'set' | 'delete'): void {
    this.syncQueue.push({ key, data, operation });
    
    // 限制队列大小
    if (this.syncQueue.length > 1000) {
      this.syncQueue.shift();
    }
  }

  /**
   * 启动后台同步
   */
  private startBackgroundSync(): void {
    setInterval(async () => {
      if (!this.syncInProgress && this.syncQueue.length > 0) {
        await this.processSyncQueue();
      }
    }, 5000); // 每5秒同步一次
  }

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      const batch = this.syncQueue.splice(0, 100); // 批量处理100个操作
      
      for (const { key, data, operation } of batch) {
        try {
          if (operation === 'set' && data) {
            // 同步到其他层级
            await this.setInLayer('L2', key, data);
          } else if (operation === 'delete') {
            await this.deleteFromL2(key);
          }
        } catch (error) {
          logger.error('Sync operation failed', { key, operation, error });
        }
      }
      
      logger.debug('Sync batch processed', { batchSize: batch.length });
      
    } catch (error) {
      logger.error('Sync queue processing failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    ['L1', 'L2', 'L3'].forEach(layer => {
      this.metrics.set(layer, {
        layer,
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        averageResponseTime: 0,
        totalRequests: 0
      });
    });
  }

  /**
   * 记录命中
   */
  private async recordHit(layer: string, responseTime: number): Promise<void> {
    const metrics = this.metrics.get(layer);
    if (metrics) {
      metrics.totalRequests++;
      metrics.hitRate = ((metrics.hitRate * (metrics.totalRequests - 1)) + 100) / metrics.totalRequests;
      metrics.averageResponseTime = ((metrics.averageResponseTime * (metrics.totalRequests - 1)) + responseTime) / metrics.totalRequests;
    }
  }

  /**
   * 记录未命中
   */
  private async recordMiss(layer: string, responseTime: number): Promise<void> {
    if (layer === 'ALL') {
      // 所有层都未命中
      ['L1', 'L2', 'L3'].forEach(l => {
        const metrics = this.metrics.get(l);
        if (metrics) {
          metrics.totalRequests++;
          metrics.missRate = ((metrics.missRate * (metrics.totalRequests - 1)) + 100) / metrics.totalRequests;
        }
      });
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(layer: string, type: 'hit' | 'miss' | 'eviction'): void {
    const metrics = this.metrics.get(layer);
    if (metrics) {
      if (type === 'eviction') {
        metrics.evictionRate++;
      }
    }
  }
}

// 导出单例实例
export default new MultiLayerCache();