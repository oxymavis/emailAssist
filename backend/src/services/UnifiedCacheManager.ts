/**
 * Unified Cache Manager
 * Provides a unified interface for different cache implementations
 */

import logger from '@/utils/logger';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

export class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;
  private cache: Map<string, { value: any; expires: number; tags: string[] }> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0
  };

  public static getInstance(): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager();
    }
    return UnifiedCacheManager.instance;
  }

  public async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      return null;
    }

    this.stats.hits++;
    return item.value as T;
  }

  public async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 3600000; // 1 hour default
    const expires = Date.now() + ttl;
    const tags = options.tags || [];

    this.cache.set(key, { value, expires, tags });
    this.stats.sets++;
    this.stats.size = this.cache.size;
  }

  public async del(key: string): Promise<void> {
    if (this.cache.delete(key)) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }
  }

  public async delete(key: string): Promise<void> {
    await this.del(key);
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0
    };
  }

  public async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  public async invalidateByTag(tag: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (item.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.del(key);
    }
  }

  public async disconnect(): Promise<void> {
    await this.clear();
    logger.info('UnifiedCacheManager disconnected');
  }
}

export default UnifiedCacheManager;
