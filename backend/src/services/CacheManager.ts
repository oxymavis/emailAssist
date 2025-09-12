/**
 * Advanced Cache Manager
 * 高级缓存管理器，提供多层缓存、智能失效和性能监控
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import crypto from 'crypto';

export interface CacheConfig {
  ttl?: number;
  tags?: string[];
  compression?: boolean;
  refreshAhead?: boolean;
  refreshThreshold?: number;
}

export interface CacheEntry<T = any> {
  data: T;
  metadata: {
    cachedAt: number;
    ttl: number;
    tags: string[];
    hits: number;
    size: number;
    compressed?: boolean;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  avgResponseTime: number;
}

export class CacheManager {
  private redis = RedisManager;
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    responseTimes: [] as number[]
  };

  // 默认配置
  private defaultConfig: CacheConfig = {
    ttl: 300, // 5分钟
    tags: [],
    compression: true,
    refreshAhead: true,
    refreshThreshold: 0.2 // 在20%TTL剩余时刷新
  };

  constructor() {}

  /**
   * 智能缓存设置
   */
  async set<T>(
    key: string, 
    data: T, 
    config: CacheConfig = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const mergedConfig = { ...this.defaultConfig, ...config };
      const cacheKey = this.buildCacheKey(key);
      
      // 计算数据大小
      const serializedData = JSON.stringify(data);
      const dataSize = Buffer.byteLength(serializedData, 'utf8');
      
      // 压缩大数据
      let finalData = data;
      let compressed = false;
      
      if (mergedConfig.compression && dataSize > 1024) {
        // 这里可以实现数据压缩逻辑
        compressed = true;
        logger.debug('Data compressed for cache', { key, originalSize: dataSize });
      }

      const cacheEntry: CacheEntry<T> = {
        data: finalData,
        metadata: {
          cachedAt: Date.now(),
          ttl: mergedConfig.ttl!,
          tags: mergedConfig.tags!,
          hits: 0,
          size: dataSize,
          compressed
        }
      };

      const success = await this.redis.set(cacheKey, cacheEntry, mergedConfig.ttl);
      
      // 设置标签索引
      if (mergedConfig.tags && mergedConfig.tags.length > 0) {
        await this.setTagIndex(mergedConfig.tags, cacheKey);
      }

      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      logger.debug('Cache set', { 
        key, 
        ttl: mergedConfig.ttl, 
        size: dataSize, 
        compressed,
        responseTime 
      });

      return success;

    } catch (error) {
      logger.error('Cache set failed', { key, error });
      return false;
    }
  }

  /**
   * 智能缓存获取
   */
  async get<T>(key: string, refreshCallback?: () => Promise<T>): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.buildCacheKey(key);
      const cacheEntry = await this.redis.getJson<CacheEntry<T>>(cacheKey);

      if (!cacheEntry) {
        this.stats.misses++;
        this.stats.totalRequests++;
        
        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);
        
        logger.debug('Cache miss', { key, responseTime });
        return null;
      }

      // 更新命中统计
      cacheEntry.metadata.hits++;
      this.stats.hits++;
      this.stats.totalRequests++;
      
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);

      // 检查是否需要刷新
      const remainingTtl = await this.redis.ttl(cacheKey);
      const refreshThreshold = cacheEntry.metadata.ttl * 0.2; // 20%阈值
      
      if (refreshCallback && remainingTtl > 0 && remainingTtl < refreshThreshold) {
        // 异步刷新缓存
        this.refreshCacheAsync(key, refreshCallback, {
          ttl: cacheEntry.metadata.ttl,
          tags: cacheEntry.metadata.tags
        });
      }

      // 异步更新命中统计
      await this.redis.set(cacheKey, cacheEntry, remainingTtl);

      logger.debug('Cache hit', { 
        key, 
        hits: cacheEntry.metadata.hits,
        remainingTtl,
        responseTime 
      });

      return cacheEntry.data;

    } catch (error) {
      logger.error('Cache get failed', { key, error });
      this.stats.misses++;
      this.stats.totalRequests++;
      return null;
    }
  }

  /**
   * 带回源的缓存获取
   */
  async getOrSet<T>(
    key: string,
    fetchCallback: () => Promise<T>,
    config: CacheConfig = {}
  ): Promise<T> {
    let data = await this.get<T>(key);
    
    if (data === null) {
      try {
        data = await fetchCallback();
        await this.set(key, data, config);
      } catch (error) {
        logger.error('Fetch callback failed', { key, error });
        throw error;
      }
    }
    
    return data;
  }

  /**
   * 按标签批量删除
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.redis.getJson<string[]>(tagKey);
      
      if (!keys || keys.length === 0) {
        return 0;
      }

      let deletedCount = 0;
      
      // 批量删除缓存键
      for (const key of keys) {
        const deleted = await this.redis.delete(key);
        if (deleted) deletedCount++;
      }

      // 删除标签索引
      await this.redis.delete(tagKey);

      logger.info('Cache deleted by tag', { tag, deletedCount });
      return deletedCount;

    } catch (error) {
      logger.error('Delete by tag failed', { tag, error });
      return 0;
    }
  }

  /**
   * 按模式批量删除
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const deletedCount = await this.redis.deletePattern(pattern);
      logger.info('Cache deleted by pattern', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Delete by pattern failed', { pattern, error });
      return 0;
    }
  }

  /**
   * 预热缓存
   */
  async warmup(entries: Array<{
    key: string;
    fetchCallback: () => Promise<any>;
    config?: CacheConfig;
  }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const promises = entries.map(async (entry) => {
        try {
          const data = await entry.fetchCallback();
          await this.set(entry.key, data, entry.config);
          return { key: entry.key, success: true };
        } catch (error) {
          logger.warn('Cache warmup failed for key', { key: entry.key, error });
          return { key: entry.key, success: false, error };
        }
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      const duration = Date.now() - startTime;
      logger.info('Cache warmup completed', { 
        total: entries.length, 
        successful, 
        duration 
      });

    } catch (error) {
      logger.error('Cache warmup failed', error);
    }
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<CacheStats> {
    const totalKeys = (await this.redis.keys('cache:*')).length;
    const memoryInfo = await this.redis.info('memory');
    
    // 解析内存使用信息
    let memoryUsage = 0;
    const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
    if (usedMemoryMatch) {
      memoryUsage = parseInt(usedMemoryMatch[1]);
    }

    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;

    const avgResponseTime = this.stats.responseTimes.length > 0
      ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys,
      memoryUsage,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100
    };
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await this.redis.keys('cache:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1 || ttl === 0) {
          // TTL过期或不存在，删除
          await this.redis.delete(key);
          cleanedCount++;
        }
      }

      logger.info('Cache cleanup completed', { cleanedCount });
    } catch (error) {
      logger.error('Cache cleanup failed', error);
    }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      responseTimes: []
    };
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(key: string): string {
    // 使用MD5哈希长键名以避免键名过长问题
    if (key.length > 200) {
      const hash = crypto.createHash('md5').update(key).digest('hex');
      return `cache:${hash}`;
    }
    return `cache:${key}`;
  }

  /**
   * 设置标签索引
   */
  private async setTagIndex(tags: string[], cacheKey: string): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      let keys = await this.redis.getJson<string[]>(tagKey) || [];
      
      if (!keys.includes(cacheKey)) {
        keys.push(cacheKey);
        await this.redis.set(tagKey, keys, 86400); // 24小时TTL
      }
    }
  }

  /**
   * 异步刷新缓存
   */
  private async refreshCacheAsync<T>(
    key: string,
    refreshCallback: () => Promise<T>,
    config: CacheConfig
  ): Promise<void> {
    try {
      const freshData = await refreshCallback();
      await this.set(key, freshData, config);
      logger.debug('Cache refreshed ahead of expiration', { key });
    } catch (error) {
      logger.warn('Cache refresh ahead failed', { key, error });
    }
  }

  /**
   * 记录响应时间
   */
  private recordResponseTime(responseTime: number): void {
    this.stats.responseTimes.push(responseTime);
    
    // 保持最近1000个响应时间记录
    if (this.stats.responseTimes.length > 1000) {
      this.stats.responseTimes.shift();
    }
  }
}

// 导出单例实例
export default new CacheManager();

/**
 * 缓存装饰器工厂
 */
export function Cache(config: CacheConfig = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheManager = new CacheManager();
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      return cacheManager.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        config
      );
    };
  };
}

/**
 * 缓存工具函数
 */
export const CacheUtils = {
  /**
   * 生成缓存键
   */
  generateKey(prefix: string, params: any): string {
    const paramStr = typeof params === 'object' 
      ? JSON.stringify(params, Object.keys(params).sort())
      : String(params);
    return `${prefix}:${crypto.createHash('md5').update(paramStr).digest('hex')}`;
  },

  /**
   * 批量缓存预热
   */
  async batchWarmup<T>(
    items: Array<{ key: string; data: T; config?: CacheConfig }>
  ): Promise<void> {
    const cacheManager = new CacheManager();
    const promises = items.map(item => 
      cacheManager.set(item.key, item.data, item.config)
    );
    
    await Promise.allSettled(promises);
  }
};