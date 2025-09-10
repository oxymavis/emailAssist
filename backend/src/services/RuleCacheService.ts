import { FilterRule } from '@/types';
import { FilterRuleModel } from '@/models/FilterRule';
import cache from '@/config/redis';
import logger from '@/utils/logger';

/**
 * 规则缓存服务
 * 提供高性能的规则缓存和批量操作支持
 */
export class RuleCacheService {
  private static readonly CACHE_PREFIX = 'rules:';
  private static readonly USER_RULES_PREFIX = 'user_rules:';
  private static readonly RULE_STATS_PREFIX = 'rule_stats:';
  private static readonly DEFAULT_TTL = 300; // 5分钟
  private static readonly STATS_TTL = 600; // 10分钟

  /**
   * 获取用户的缓存规则列表
   */
  static async getUserRules(userId: string, forceRefresh = false): Promise<FilterRule[]> {
    const cacheKey = `${this.USER_RULES_PREFIX}${userId}:active`;
    
    try {
      if (!forceRefresh) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          const rules = JSON.parse(cached);
          logger.debug('Rules loaded from cache', { userId, count: rules.length });
          return rules.map((rule: any) => ({
            ...rule,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt)
          }));
        }
      }

      // 从数据库获取规则
      const rules = await FilterRuleModel.getActiveRules(userId);
      
      // 缓存规则列表
      await cache.setex(cacheKey, this.DEFAULT_TTL, JSON.stringify(rules));
      
      logger.debug('Rules loaded from database and cached', { 
        userId, 
        count: rules.length 
      });
      
      return rules;
    } catch (error) {
      logger.error('Failed to get user rules', { userId, error });
      // 降级：直接从数据库获取
      return await FilterRuleModel.getActiveRules(userId);
    }
  }

  /**
   * 缓存单个规则
   */
  static async cacheRule(rule: FilterRule): Promise<void> {
    const ruleKey = `${this.CACHE_PREFIX}rule:${rule.id}`;
    
    try {
      await cache.setex(ruleKey, this.DEFAULT_TTL, JSON.stringify(rule));
      logger.debug('Rule cached', { ruleId: rule.id, userId: rule.userId });
    } catch (error) {
      logger.error('Failed to cache rule', { ruleId: rule.id, error });
    }
  }

  /**
   * 获取缓存的规则
   */
  static async getCachedRule(ruleId: string): Promise<FilterRule | null> {
    const ruleKey = `${this.CACHE_PREFIX}rule:${ruleId}`;
    
    try {
      const cached = await cache.get(ruleKey);
      if (cached) {
        const rule = JSON.parse(cached);
        return {
          ...rule,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt)
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached rule', { ruleId, error });
      return null;
    }
  }

  /**
   * 批量缓存规则
   */
  static async batchCacheRules(rules: FilterRule[]): Promise<void> {
    if (rules.length === 0) return;

    try {
      const pipeline = cache.pipeline();
      
      for (const rule of rules) {
        const ruleKey = `${this.CACHE_PREFIX}rule:${rule.id}`;
        pipeline.setex(ruleKey, this.DEFAULT_TTL, JSON.stringify(rule));
      }
      
      await pipeline.exec();
      
      logger.debug('Rules batch cached', { count: rules.length });
    } catch (error) {
      logger.error('Failed to batch cache rules', { count: rules.length, error });
    }
  }

  /**
   * 清除用户的规则缓存
   */
  static async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `${this.USER_RULES_PREFIX}${userId}:*`,
      `${this.RULE_STATS_PREFIX}${userId}:*`
    ];

    try {
      for (const pattern of patterns) {
        const keys = await cache.keys(pattern);
        if (keys.length > 0) {
          await cache.del(keys as string[]);
        }
      }
      
      logger.debug('User rule cache cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear user rule cache', { userId, error });
    }
  }

  /**
   * 清除特定规则的缓存
   */
  static async clearRuleCache(ruleId: string, userId?: string): Promise<void> {
    const keys = [`${this.CACHE_PREFIX}rule:${ruleId}`];
    
    if (userId) {
      keys.push(`${this.USER_RULES_PREFIX}${userId}:active`);
      keys.push(`${this.RULE_STATS_PREFIX}${userId}:*`);
    }

    try {
      // 对于带通配符的key，需要先查找
      const keysToDelete = [];
      for (const key of keys) {
        if (key.includes('*')) {
          const matchedKeys = await cache.keys(key);
          keysToDelete.push(...matchedKeys);
        } else {
          keysToDelete.push(key);
        }
      }

      if (keysToDelete.length > 0) {
        await cache.del(keysToDelete as string[]);
      }
      
      logger.debug('Rule cache cleared', { ruleId, userId });
    } catch (error) {
      logger.error('Failed to clear rule cache', { ruleId, userId, error });
    }
  }

  /**
   * 缓存规则执行统计
   */
  static async cacheRuleStats(userId: string, stats: any, ttl = this.STATS_TTL): Promise<void> {
    const statsKey = `${this.RULE_STATS_PREFIX}${userId}:stats`;
    
    try {
      await cache.setex(statsKey, ttl, JSON.stringify(stats));
      logger.debug('Rule stats cached', { userId });
    } catch (error) {
      logger.error('Failed to cache rule stats', { userId, error });
    }
  }

  /**
   * 获取缓存的规则统计
   */
  static async getCachedRuleStats(userId: string): Promise<any | null> {
    const statsKey = `${this.RULE_STATS_PREFIX}${userId}:stats`;
    
    try {
      const cached = await cache.get(statsKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached rule stats', { userId, error });
      return null;
    }
  }

  /**
   * 预热用户规则缓存
   */
  static async warmupUserCache(userId: string): Promise<void> {
    try {
      logger.debug('Warming up user rule cache', { userId });
      
      // 预加载活动规则
      await this.getUserRules(userId, true);
      
      // 预加载规则统计（如果数据库可用）
      // const stats = await RuleExecutionLogModel.getStatistics(userId);
      // await this.cacheRuleStats(userId, stats);
      
      logger.debug('User rule cache warmed up', { userId });
    } catch (error) {
      logger.error('Failed to warmup user cache', { userId, error });
    }
  }

  /**
   * 获取缓存统计信息
   */
  static async getCacheInfo(): Promise<{
    totalKeys: number;
    ruleKeys: number;
    userRuleKeys: number;
    statsKeys: number;
    memoryUsage: string;
  }> {
    try {
      const allKeys = await cache.keys('*');
      const ruleKeys = await cache.keys(`${this.CACHE_PREFIX}*`);
      const userRuleKeys = await cache.keys(`${this.USER_RULES_PREFIX}*`);
      const statsKeys = await cache.keys(`${this.RULE_STATS_PREFIX}*`);
      
      const info = await cache.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        totalKeys: allKeys.length,
        ruleKeys: ruleKeys.length,
        userRuleKeys: userRuleKeys.length,
        statsKeys: statsKeys.length,
        memoryUsage
      };
    } catch (error) {
      logger.error('Failed to get cache info', error);
      return {
        totalKeys: 0,
        ruleKeys: 0,
        userRuleKeys: 0,
        statsKeys: 0,
        memoryUsage: 'unknown'
      };
    }
  }

  /**
   * 清理过期的缓存
   */
  static async cleanup(): Promise<number> {
    try {
      logger.info('Starting rule cache cleanup');
      
      // Redis会自动清理过期的key，但我们可以手动清理一些长期未使用的缓存
      const patterns = [
        `${this.CACHE_PREFIX}*`,
        `${this.USER_RULES_PREFIX}*`,
        `${this.RULE_STATS_PREFIX}*`
      ];

      let deletedCount = 0;
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24小时前

      for (const pattern of patterns) {
        const keys = await cache.keys(pattern);
        
        for (const key of keys) {
          try {
            const ttl = await cache.ttl(key);
            // 如果key没有过期时间或者创建时间超过24小时，检查是否需要清理
            if (ttl === -1) { // 永不过期的key
              const value = await cache.get(key);
              if (value) {
                const data = JSON.parse(value);
                // 检查数据的创建时间或更新时间
                const timestamp = data.updatedAt || data.createdAt || data.timestamp;
                if (timestamp && new Date(timestamp).getTime() < cutoffTime) {
                  await cache.del(key);
                  deletedCount++;
                }
              }
            }
          } catch (e) {
            // 忽略单个key的处理错误
            continue;
          }
        }
      }

      logger.info('Rule cache cleanup completed', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup rule cache', error);
      return 0;
    }
  }

  /**
   * 设置规则执行次数计数器
   */
  static async incrementRuleExecutionCount(ruleId: string): Promise<number> {
    const countKey = `${this.CACHE_PREFIX}exec_count:${ruleId}`;
    
    try {
      const count = await cache.incr(countKey);
      
      // 设置24小时过期时间
      if (count === 1) {
        await cache.expire(countKey, 24 * 60 * 60);
      }
      
      return count;
    } catch (error) {
      logger.error('Failed to increment rule execution count', { ruleId, error });
      return 0;
    }
  }

  /**
   * 获取规则执行次数
   */
  static async getRuleExecutionCount(ruleId: string): Promise<number> {
    const countKey = `${this.CACHE_PREFIX}exec_count:${ruleId}`;
    
    try {
      const count = await cache.get(countKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error('Failed to get rule execution count', { ruleId, error });
      return 0;
    }
  }

  /**
   * 批量获取规则执行次数
   */
  static async getBatchRuleExecutionCounts(ruleIds: string[]): Promise<Record<string, number>> {
    if (ruleIds.length === 0) return {};

    const counts: Record<string, number> = {};

    try {
      const pipeline = cache.pipeline();
      
      for (const ruleId of ruleIds) {
        const countKey = `${this.CACHE_PREFIX}exec_count:${ruleId}`;
        pipeline.get(countKey);
      }
      
      const results = await pipeline.exec();
      
      ruleIds.forEach((ruleId, index) => {
        const result = results?.[index];
        if (result && result[1]) {
          counts[ruleId] = parseInt(result[1] as string, 10);
        } else {
          counts[ruleId] = 0;
        }
      });
      
      return counts;
    } catch (error) {
      logger.error('Failed to get batch rule execution counts', { ruleIds, error });
      // 返回默认值
      ruleIds.forEach(ruleId => {
        counts[ruleId] = 0;
      });
      return counts;
    }
  }

  /**
   * 设置规则最后执行时间
   */
  static async setRuleLastExecution(ruleId: string, timestamp = new Date()): Promise<void> {
    const timeKey = `${this.CACHE_PREFIX}last_exec:${ruleId}`;
    
    try {
      await cache.setex(timeKey, 24 * 60 * 60, timestamp.toISOString());
    } catch (error) {
      logger.error('Failed to set rule last execution time', { ruleId, error });
    }
  }

  /**
   * 获取规则最后执行时间
   */
  static async getRuleLastExecution(ruleId: string): Promise<Date | null> {
    const timeKey = `${this.CACHE_PREFIX}last_exec:${ruleId}`;
    
    try {
      const timestamp = await cache.get(timeKey);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      logger.error('Failed to get rule last execution time', { ruleId, error });
      return null;
    }
  }
}