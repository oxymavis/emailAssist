/**
 * 业务场景特定缓存策略
 * 针对邮件列表、AI分析结果、用户偏好设置、搜索结果等业务场景的专门缓存优化
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import { EmailMessage } from '@/types';
import SmartCacheStrategy from './SmartCacheStrategy';
import MultiLayerCache from './MultiLayerCache';
import CachePerformanceOptimizer from './CachePerformanceOptimizer';

export interface EmailCacheConfig {
  listTTL: number;          // 邮件列表缓存时间
  contentTTL: number;       // 邮件内容缓存时间
  attachmentTTL: number;    // 附件缓存时间
  threadTTL: number;        // 邮件线程缓存时间
  maxListSize: number;      // 最大列表缓存数量
  compressionEnabled: boolean;
}

export interface AnalysisCacheConfig {
  resultTTL: number;        // AI分析结果缓存时间
  modelVersionTTL: number;  // 模型版本缓存时间
  batchResultTTL: number;   // 批量分析结果缓存时间
  precomputeEnabled: boolean; // 预计算功能
  incrementalUpdate: boolean; // 增量更新
}

export interface UserPreferenceCacheConfig {
  settingsTTL: number;      // 用户设置缓存时间
  filterRulesTTL: number;   // 过滤规则缓存时间
  dashboardTTL: number;     // 仪表板配置缓存时间
  themeTTL: number;         // 主题设置缓存时间
  persistentCache: boolean;  // 持久化缓存
}

export interface SearchCacheConfig {
  queryTTL: number;         // 搜索查询缓存时间
  resultTTL: number;        // 搜索结果缓存时间
  suggestionTTL: number;    // 搜索建议缓存时间
  facetTTL: number;         // 搜索分面缓存时间
  popularQueriesEnabled: boolean; // 热门查询缓存
}

export class BusinessCacheStrategies {
  private redis = RedisManager;
  private smartStrategy = SmartCacheStrategy;
  private multiLayer = MultiLayerCache;
  private optimizer = CachePerformanceOptimizer;

  private config = {
    email: {
      listTTL: 300,           // 5分钟
      contentTTL: 1800,       // 30分钟
      attachmentTTL: 3600,    // 1小时
      threadTTL: 900,         // 15分钟
      maxListSize: 1000,
      compressionEnabled: true
    } as EmailCacheConfig,

    analysis: {
      resultTTL: 3600,        // 1小时
      modelVersionTTL: 86400, // 24小时
      batchResultTTL: 1800,   // 30分钟
      precomputeEnabled: true,
      incrementalUpdate: true
    } as AnalysisCacheConfig,

    userPreference: {
      settingsTTL: 3600,      // 1小时
      filterRulesTTL: 1800,   // 30分钟
      dashboardTTL: 900,      // 15分钟
      themeTTL: 86400,        // 24小时
      persistentCache: true
    } as UserPreferenceCacheConfig,

    search: {
      queryTTL: 1800,         // 30分钟
      resultTTL: 900,         // 15分钟
      suggestionTTL: 3600,    // 1小时
      facetTTL: 1800,         // 30分钟
      popularQueriesEnabled: true
    } as SearchCacheConfig
  };

  constructor() {
    this.initializeBusinessStrategies();
  }

  // ==================== 邮件相关缓存策略 ====================

  /**
   * 智能邮件列表缓存
   */
  async getEmailList(
    userId: string,
    folder: string,
    page = 1,
    limit = 50,
    filters?: any
  ): Promise<EmailMessage[]> {
    const cacheKey = `emails:list:${userId}:${folder}:${page}:${limit}:${this.hashFilters(filters)}`;
    
    try {
      // 记录访问模式
      await this.smartStrategy.recordAccess(cacheKey, userId);
      
      // 获取最优策略
      const strategy = await this.smartStrategy.getOptimalStrategy(cacheKey, userId);
      
      // 使用性能优化器获取数据
      const emails = await this.optimizer.getWithProtection<EmailMessage[]>(
        cacheKey,
        async () => {
          // 这里应该调用实际的邮件获取逻辑
          return this.fetchEmailsFromDatabase(userId, folder, page, limit, filters);
        },
        strategy.ttl
      );
      
      if (emails) {
        logger.debug('Email list cache hit', {
          userId,
          folder,
          page,
          count: emails.length,
          strategy: strategy.strategyType
        });
      }
      
      return emails || [];
      
    } catch (error) {
      logger.error('Email list cache failed', { userId, folder, error });
      return [];
    }
  }

  /**
   * 邮件内容缓存 (支持分层存储)
   */
  async getEmailContent(emailId: string, userId: string): Promise<EmailMessage | null> {
    const cacheKey = `email:content:${emailId}`;
    
    try {
      // 先从多层缓存获取
      let email = await this.multiLayer.get<EmailMessage>(cacheKey);
      
      if (!email) {
        // 回源获取数据
        email = await this.fetchEmailContent(emailId, userId);
        
        if (email) {
          // 根据邮件大小选择缓存策略
          const emailSize = this.estimateEmailSize(email);
          const options: any = {
            ttl: this.config.email.contentTTL,
            priority: emailSize < 10240 ? 3 : 2, // 小邮件高优先级
            tags: [`user:${userId}`, 'email:content'],
            compress: emailSize > this.config.email.compressionEnabled ? 1024 : undefined
          };
          
          await this.multiLayer.set(cacheKey, email, options);
        }
      }
      
      return email;
      
    } catch (error) {
      logger.error('Email content cache failed', { emailId, userId, error });
      return null;
    }
  }

  /**
   * 邮件线程缓存
   */
  async getEmailThread(threadId: string, userId: string): Promise<EmailMessage[]> {
    const cacheKey = `email:thread:${threadId}`;
    
    return await this.optimizer.getWithProtection<EmailMessage[]>(
      cacheKey,
      async () => {
        return this.fetchEmailThread(threadId, userId);
      },
      this.config.email.threadTTL
    ) || [];
  }

  /**
   * 邮件附件缓存
   */
  async getEmailAttachment(
    attachmentId: string, 
    userId: string
  ): Promise<{ data: Buffer, metadata: any } | null> {
    const cacheKey = `email:attachment:${attachmentId}`;
    
    try {
      // 附件通常较大，优先存储在L2层
      const attachment = await this.multiLayer.get<{ data: string, metadata: any }>(cacheKey);
      
      if (attachment) {
        return {
          data: Buffer.from(attachment.data, 'base64'),
          metadata: attachment.metadata
        };
      }
      
      // 回源获取附件
      const fetchedAttachment = await this.fetchEmailAttachment(attachmentId, userId);
      
      if (fetchedAttachment) {
        // 转换为base64存储
        const cacheData = {
          data: fetchedAttachment.data.toString('base64'),
          metadata: fetchedAttachment.metadata
        };
        
        await this.multiLayer.set(cacheKey, cacheData, {
          ttl: this.config.email.attachmentTTL,
          forceLayer: 'L2', // 强制存储在L2层
          compress: true
        });
        
        return fetchedAttachment;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Email attachment cache failed', { attachmentId, userId, error });
      return null;
    }
  }

  // ==================== AI分析结果缓存策略 ====================

  /**
   * AI分析结果缓存
   */
  async getAnalysisResult(
    emailId: string, 
    analysisType: 'sentiment' | 'priority' | 'category' | 'summary',
    modelVersion = 'latest'
  ): Promise<any> {
    const cacheKey = `analysis:${analysisType}:${emailId}:${modelVersion}`;
    
    try {
      // 检查预计算缓存
      if (this.config.analysis.precomputeEnabled) {
        const precomputed = await this.getPrecomputedAnalysis(emailId, analysisType);
        if (precomputed) {
          return precomputed;
        }
      }
      
      // 使用智能策略获取分析结果
      const strategy = await this.smartStrategy.getOptimalStrategy(cacheKey);
      
      const result = await this.optimizer.getWithProtection(
        cacheKey,
        async () => {
          return this.performAIAnalysis(emailId, analysisType, modelVersion);
        },
        strategy.ttl
      );
      
      // 如果启用增量更新，触发相关缓存更新
      if (result && this.config.analysis.incrementalUpdate) {
        await this.triggerIncrementalUpdate(emailId, analysisType, result);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Analysis result cache failed', { emailId, analysisType, error });
      return null;
    }
  }

  /**
   * 批量AI分析结果缓存
   */
  async getBatchAnalysisResults(
    emailIds: string[],
    analysisType: string,
    modelVersion = 'latest'
  ): Promise<Map<string, any>> {
    const cacheKeys = emailIds.map(id => `analysis:${analysisType}:${id}:${modelVersion}`);
    
    try {
      // 批量获取缓存结果
      const cachedResults = await this.multiLayer.mget<any>(cacheKeys);
      const missingIds: string[] = [];
      const results = new Map<string, any>();
      
      // 处理缓存结果
      cacheKeys.forEach((key, index) => {
        const emailId = emailIds[index];
        const cached = cachedResults.get(key);
        
        if (cached) {
          results.set(emailId, cached);
        } else {
          missingIds.push(emailId);
        }
      });
      
      // 批量处理未命中的分析
      if (missingIds.length > 0) {
        const batchResults = await this.performBatchAIAnalysis(missingIds, analysisType, modelVersion);
        
        // 批量缓存结果
        const cacheEntries = Array.from(batchResults.entries()).map(([emailId, result]) => ({
          key: `analysis:${analysisType}:${emailId}:${modelVersion}`,
          value: result,
          options: { 
            ttl: this.config.analysis.batchResultTTL,
            tags: ['analysis', analysisType]
          }
        }));
        
        await this.multiLayer.mset(cacheEntries);
        
        // 合并结果
        batchResults.forEach((result, emailId) => {
          results.set(emailId, result);
        });
      }
      
      return results;
      
    } catch (error) {
      logger.error('Batch analysis cache failed', { emailIds: emailIds.length, analysisType, error });
      return new Map();
    }
  }

  /**
   * 预计算分析结果
   */
  async precomputeAnalysisResults(userId: string, emailIds: string[]): Promise<void> {
    try {
      const analysisTypes = ['sentiment', 'priority', 'category', 'summary'];
      const tasks = [];
      
      for (const emailId of emailIds) {
        for (const analysisType of analysisTypes) {
          tasks.push(async () => {
            const cacheKey = `analysis:${analysisType}:${emailId}:latest`;
            const exists = await this.redis.exists(`cache:optimized:${cacheKey}`);
            
            if (!exists) {
              const result = await this.performAIAnalysis(emailId, analysisType, 'latest');
              if (result) {
                await this.optimizer.setWithOptimization(cacheKey, result, this.config.analysis.resultTTL);
              }
            }
          });
        }
      }
      
      // 限制并发数量，避免系统过载
      const batchSize = 5;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(task => task()));
      }
      
      logger.info('Analysis precomputation completed', {
        userId,
        emailCount: emailIds.length,
        tasksCount: tasks.length
      });
      
    } catch (error) {
      logger.error('Analysis precomputation failed', { userId, error });
    }
  }

  // ==================== 用户偏好设置缓存策略 ====================

  /**
   * 用户设置缓存
   */
  async getUserSettings(userId: string): Promise<any> {
    const cacheKey = `user:settings:${userId}`;
    
    try {
      // 用户设置使用持久化缓存
      if (this.config.userPreference.persistentCache) {
        const settings = await this.multiLayer.get<any>(cacheKey);
        
        if (settings) {
          return settings;
        }
      }
      
      // 从数据库获取设置
      const settings = await this.fetchUserSettings(userId);
      
      if (settings) {
        await this.multiLayer.set(cacheKey, settings, {
          ttl: this.config.userPreference.settingsTTL,
          forceLayer: 'L1', // 用户设置常用，存储在L1
          tags: [`user:${userId}`, 'settings']
        });
      }
      
      return settings;
      
    } catch (error) {
      logger.error('User settings cache failed', { userId, error });
      return null;
    }
  }

  /**
   * 用户过滤规则缓存
   */
  async getUserFilterRules(userId: string): Promise<any[]> {
    const cacheKey = `user:filter_rules:${userId}`;
    
    return await this.optimizer.getWithProtection<any[]>(
      cacheKey,
      async () => {
        return this.fetchUserFilterRules(userId);
      },
      this.config.userPreference.filterRulesTTL
    ) || [];
  }

  /**
   * 仪表板配置缓存
   */
  async getDashboardConfig(userId: string): Promise<any> {
    const cacheKey = `user:dashboard:${userId}`;
    
    try {
      // 记录用户访问模式
      await this.smartStrategy.recordAccess(cacheKey, userId);
      
      // 获取仪表板配置
      const config = await this.optimizer.getWithProtection(
        cacheKey,
        async () => {
          return this.fetchDashboardConfig(userId);
        },
        this.config.userPreference.dashboardTTL
      );
      
      return config;
      
    } catch (error) {
      logger.error('Dashboard config cache failed', { userId, error });
      return null;
    }
  }

  // ==================== 搜索结果缓存策略 ====================

  /**
   * 搜索结果缓存
   */
  async getSearchResults(
    userId: string,
    query: string,
    filters?: any,
    page = 1,
    limit = 20
  ): Promise<{ results: any[], total: number, facets?: any }> {
    const normalizedQuery = this.normalizeSearchQuery(query);
    const cacheKey = `search:results:${userId}:${normalizedQuery}:${page}:${limit}:${this.hashFilters(filters)}`;
    
    try {
      // 记录搜索模式
      await this.smartStrategy.recordAccess(cacheKey, userId);
      
      // 检查热门查询缓存
      if (this.config.search.popularQueriesEnabled) {
        const popularResult = await this.getPopularQueryResult(normalizedQuery);
        if (popularResult) {
          return popularResult;
        }
      }
      
      // 获取搜索结果
      const searchResult = await this.optimizer.getWithProtection(
        cacheKey,
        async () => {
          return this.performSearch(userId, query, filters, page, limit);
        },
        this.config.search.resultTTL
      );
      
      if (searchResult) {
        // 更新热门查询统计
        await this.updatePopularQuery(normalizedQuery);
      }
      
      return searchResult || { results: [], total: 0 };
      
    } catch (error) {
      logger.error('Search results cache failed', { userId, query, error });
      return { results: [], total: 0 };
    }
  }

  /**
   * 搜索建议缓存
   */
  async getSearchSuggestions(userId: string, prefix: string): Promise<string[]> {
    const cacheKey = `search:suggestions:${userId}:${prefix.toLowerCase()}`;
    
    return await this.optimizer.getWithProtection<string[]>(
      cacheKey,
      async () => {
        return this.generateSearchSuggestions(userId, prefix);
      },
      this.config.search.suggestionTTL
    ) || [];
  }

  /**
   * 搜索分面缓存
   */
  async getSearchFacets(userId: string, query: string): Promise<any> {
    const cacheKey = `search:facets:${userId}:${this.normalizeSearchQuery(query)}`;
    
    return await this.optimizer.getWithProtection(
      cacheKey,
      async () => {
        return this.generateSearchFacets(userId, query);
      },
      this.config.search.facetTTL
    );
  }

  // ==================== 缓存失效策略 ====================

  /**
   * 用户相关缓存失效
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const patterns = [
        `user:*:${userId}`,
        `emails:list:${userId}:*`,
        `search:*:${userId}:*`,
        `analysis:*${userId}*`
      ];
      
      for (const pattern of patterns) {
        await this.multiLayer.deleteByTag(`user:${userId}`);
      }
      
      logger.info('User cache invalidated', { userId });
      
    } catch (error) {
      logger.error('User cache invalidation failed', { userId, error });
    }
  }

  /**
   * 邮件相关缓存失效
   */
  async invalidateEmailCache(emailId: string, userId?: string): Promise<void> {
    try {
      const keys = [
        `email:content:${emailId}`,
        `email:attachment:${emailId}:*`,
        `analysis:*:${emailId}:*`
      ];
      
      if (userId) {
        keys.push(`emails:list:${userId}:*`);
      }
      
      for (const key of keys) {
        await this.multiLayer.delete(key);
      }
      
      // 失效相关标签缓存
      await this.multiLayer.deleteByTag(`email:${emailId}`);
      
      logger.info('Email cache invalidated', { emailId, userId });
      
    } catch (error) {
      logger.error('Email cache invalidation failed', { emailId, userId, error });
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化业务策略
   */
  private initializeBusinessStrategies(): void {
    // 为不同业务场景配置智能策略
    this.smartStrategy.on('preload-requested', (prediction) => {
      this.handlePreloadRequest(prediction);
    });
    
    logger.info('Business cache strategies initialized');
  }

  /**
   * 处理预加载请求
   */
  private async handlePreloadRequest(prediction: any): Promise<void> {
    try {
      const keyPattern = prediction.key.split(':')[0];
      
      switch (keyPattern) {
        case 'emails':
          // 预加载邮件相关数据
          break;
        case 'analysis':
          // 预加载分析结果
          break;
        case 'user':
          // 预加载用户数据
          break;
      }
    } catch (error) {
      logger.error('Preload request handling failed', { prediction, error });
    }
  }

  /**
   * 哈希过滤条件
   */
  private hashFilters(filters: any): string {
    if (!filters) return 'no-filters';
    
    const sorted = Object.keys(filters).sort().reduce((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {} as any);
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64').slice(0, 16);
  }

  /**
   * 估算邮件大小
   */
  private estimateEmailSize(email: EmailMessage): number {
    const content = email.content || '';
    const subject = email.subject || '';
    const attachmentSize = (email as any).attachments?.length || 0;
    
    return Buffer.byteLength(content + subject, 'utf8') + (attachmentSize * 1000);
  }

  /**
   * 规范化搜索查询
   */
  private normalizeSearchQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // ==================== 数据获取方法 (需要实际实现) ====================

  private async fetchEmailsFromDatabase(
    userId: string, 
    folder: string, 
    page: number, 
    limit: number, 
    filters?: any
  ): Promise<EmailMessage[]> {
    // 实际的邮件数据库查询逻辑
    return [];
  }

  private async fetchEmailContent(emailId: string, userId: string): Promise<EmailMessage | null> {
    // 实际的邮件内容获取逻辑
    return null;
  }

  private async fetchEmailThread(threadId: string, userId: string): Promise<EmailMessage[]> {
    // 实际的邮件线程获取逻辑
    return [];
  }

  private async fetchEmailAttachment(
    attachmentId: string, 
    userId: string
  ): Promise<{ data: Buffer, metadata: any } | null> {
    // 实际的附件获取逻辑
    return null;
  }

  private async performAIAnalysis(
    emailId: string, 
    analysisType: string, 
    modelVersion: string
  ): Promise<any> {
    // 实际的AI分析逻辑
    return null;
  }

  private async performBatchAIAnalysis(
    emailIds: string[], 
    analysisType: string, 
    modelVersion: string
  ): Promise<Map<string, any>> {
    // 实际的批量AI分析逻辑
    return new Map();
  }

  private async getPrecomputedAnalysis(emailId: string, analysisType: string): Promise<any> {
    // 获取预计算的分析结果
    return null;
  }

  private async triggerIncrementalUpdate(emailId: string, analysisType: string, result: any): Promise<void> {
    // 触发增量更新逻辑
  }

  private async fetchUserSettings(userId: string): Promise<any> {
    // 实际的用户设置获取逻辑
    return null;
  }

  private async fetchUserFilterRules(userId: string): Promise<any[]> {
    // 实际的用户过滤规则获取逻辑
    return [];
  }

  private async fetchDashboardConfig(userId: string): Promise<any> {
    // 实际的仪表板配置获取逻辑
    return null;
  }

  private async performSearch(
    userId: string,
    query: string,
    filters: any,
    page: number,
    limit: number
  ): Promise<{ results: any[], total: number, facets?: any }> {
    // 实际的搜索逻辑
    return { results: [], total: 0 };
  }

  private async generateSearchSuggestions(userId: string, prefix: string): Promise<string[]> {
    // 实际的搜索建议生成逻辑
    return [];
  }

  private async generateSearchFacets(userId: string, query: string): Promise<any> {
    // 实际的搜索分面生成逻辑
    return {};
  }

  private async getPopularQueryResult(query: string): Promise<any> {
    // 获取热门查询结果
    return null;
  }

  private async updatePopularQuery(query: string): Promise<void> {
    // 更新热门查询统计
  }
}

// 导出单例实例
export default new BusinessCacheStrategies();