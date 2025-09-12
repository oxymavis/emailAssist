/**
 * 智能缓存策略管理器
 * 提供基于访问模式的智能缓存、预测性缓存预加载、用户行为分析驱动的缓存策略
 */

import RedisManager from '@/config/redis';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';

export interface AccessPattern {
  key: string;
  accessCount: number;
  lastAccess: number;
  avgAccessInterval: number;
  accessHistory: number[];
  hotScore: number;
}

export interface CacheStrategy {
  strategyType: 'time-based' | 'frequency-based' | 'pattern-based' | 'predictive';
  priority: number;
  ttl: number;
  refreshAhead: boolean;
  preloadEnabled: boolean;
  compressionThreshold: number;
}

export interface UserBehaviorProfile {
  userId: string;
  accessPatterns: Map<string, AccessPattern>;
  peakHours: number[];
  averageSessionDuration: number;
  preferredDataTypes: string[];
  cacheHitRatio: number;
  lastUpdated: number;
}

export interface PredictionResult {
  key: string;
  probability: number;
  suggestedTtl: number;
  preloadTime: number;
  confidence: number;
}

export class SmartCacheStrategy extends EventEmitter {
  private redis = RedisManager;
  private userProfiles = new Map<string, UserBehaviorProfile>();
  private globalPatterns = new Map<string, AccessPattern>();
  private strategyCache = new Map<string, CacheStrategy>();
  private predictionModel = new Map<string, number[]>(); // 简化的预测模型

  // 配置参数
  private readonly config = {
    patternAnalysisWindow: 7 * 24 * 60 * 60 * 1000, // 7天
    hotDataThreshold: 10, // 热点数据访问次数阈值
    predictionAccuracy: 0.8, // 预测准确率目标
    maxUserProfiles: 10000, // 最大用户画像数
    patternUpdateInterval: 5 * 60 * 1000, // 5分钟更新间隔
    preloadLeadTime: 30 * 60 * 1000, // 30分钟预加载提前量
  };

  constructor() {
    super();
    this.initializeStrategies();
    this.startPatternAnalysis();
    this.startPredictivePreloading();
  }

  /**
   * 初始化缓存策略
   */
  private initializeStrategies(): void {
    // 时间基础策略
    this.strategyCache.set('emails:recent', {
      strategyType: 'time-based',
      priority: 100,
      ttl: 300, // 5分钟
      refreshAhead: true,
      preloadEnabled: true,
      compressionThreshold: 1024
    });

    // 频率基础策略  
    this.strategyCache.set('user:profile', {
      strategyType: 'frequency-based',
      priority: 90,
      ttl: 1800, // 30分钟
      refreshAhead: true,
      preloadEnabled: false,
      compressionThreshold: 512
    });

    // 模式基础策略
    this.strategyCache.set('analysis:results', {
      strategyType: 'pattern-based',
      priority: 80,
      ttl: 600, // 10分钟
      refreshAhead: false,
      preloadEnabled: true,
      compressionThreshold: 2048
    });

    // 预测性策略
    this.strategyCache.set('search:results', {
      strategyType: 'predictive',
      priority: 70,
      ttl: 900, // 15分钟
      refreshAhead: true,
      preloadEnabled: true,
      compressionThreshold: 1024
    });
  }

  /**
   * 根据访问模式智能选择缓存策略
   */
  async getOptimalStrategy(key: string, userId?: string): Promise<CacheStrategy> {
    try {
      // 分析键的模式
      const keyPattern = this.extractKeyPattern(key);
      
      // 获取访问模式
      const accessPattern = await this.getAccessPattern(key);
      
      // 获取用户行为画像
      const userProfile = userId ? await this.getUserProfile(userId) : null;
      
      // 计算策略权重
      const strategy = await this.calculateOptimalStrategy(keyPattern, accessPattern, userProfile);
      
      logger.debug('Optimal cache strategy calculated', {
        key,
        userId,
        strategy: strategy.strategyType,
        ttl: strategy.ttl,
        priority: strategy.priority
      });
      
      return strategy;
      
    } catch (error) {
      logger.error('Failed to get optimal strategy', { key, userId, error });
      return this.getDefaultStrategy(key);
    }
  }

  /**
   * 记录访问模式
   */
  async recordAccess(key: string, userId?: string): Promise<void> {
    const timestamp = Date.now();
    
    try {
      // 更新全局访问模式
      await this.updateAccessPattern(key, timestamp);
      
      // 更新用户行为画像
      if (userId) {
        await this.updateUserProfile(userId, key, timestamp);
      }
      
      // 触发模式分析
      this.emit('access-recorded', { key, userId, timestamp });
      
    } catch (error) {
      logger.error('Failed to record access pattern', { key, userId, error });
    }
  }

  /**
   * 预测性缓存预加载
   */
  async predictAndPreload(userId?: string): Promise<PredictionResult[]> {
    try {
      const predictions: PredictionResult[] = [];
      
      if (userId) {
        const userProfile = await this.getUserProfile(userId);
        if (userProfile) {
          const userPredictions = await this.generateUserPredictions(userProfile);
          predictions.push(...userPredictions);
        }
      }
      
      // 全局预测
      const globalPredictions = await this.generateGlobalPredictions();
      predictions.push(...globalPredictions);
      
      // 按概率排序并预加载高概率项
      const sortedPredictions = predictions
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 20); // 限制预加载数量
      
      // 异步预加载
      this.executePreload(sortedPredictions);
      
      logger.info('Predictive preload initiated', {
        userId,
        predictionsCount: predictions.length,
        preloadCount: sortedPredictions.length
      });
      
      return sortedPredictions;
      
    } catch (error) {
      logger.error('Failed to predict and preload', { userId, error });
      return [];
    }
  }

  /**
   * 动态调整TTL
   */
  async adjustTtl(key: string, currentTtl: number): Promise<number> {
    try {
      const accessPattern = await this.getAccessPattern(key);
      
      if (!accessPattern) {
        return currentTtl;
      }
      
      // 基于访问频率调整TTL
      let adjustmentFactor = 1.0;
      
      // 高频访问数据延长TTL
      if (accessPattern.accessCount > this.config.hotDataThreshold) {
        adjustmentFactor = Math.min(2.0, 1 + (accessPattern.accessCount / 100));
      }
      
      // 基于访问间隔调整
      if (accessPattern.avgAccessInterval > 0) {
        const intervalFactor = Math.max(0.5, Math.min(2.0, 
          accessPattern.avgAccessInterval / (60 * 1000) // 转换为分钟
        ));
        adjustmentFactor *= intervalFactor;
      }
      
      // 基于热点分数调整
      adjustmentFactor *= (1 + accessPattern.hotScore / 100);
      
      const newTtl = Math.round(currentTtl * adjustmentFactor);
      
      logger.debug('TTL adjusted', {
        key,
        originalTtl: currentTtl,
        newTtl,
        adjustmentFactor,
        accessPattern: {
          count: accessPattern.accessCount,
          hotScore: accessPattern.hotScore
        }
      });
      
      return Math.max(60, Math.min(3600, newTtl)); // 限制在1分钟到1小时之间
      
    } catch (error) {
      logger.error('Failed to adjust TTL', { key, currentTtl, error });
      return currentTtl;
    }
  }

  /**
   * 缓存热点识别
   */
  async identifyHotspots(timeWindow = 3600000): Promise<AccessPattern[]> {
    try {
      const cutoff = Date.now() - timeWindow;
      const hotspots: AccessPattern[] = [];
      
      for (const [key, pattern] of this.globalPatterns) {
        if (pattern.lastAccess > cutoff && pattern.hotScore > this.config.hotDataThreshold) {
          hotspots.push(pattern);
        }
      }
      
      // 按热点分数排序
      hotspots.sort((a, b) => b.hotScore - a.hotScore);
      
      logger.info('Cache hotspots identified', {
        timeWindow: timeWindow / 1000,
        hotspotsCount: hotspots.length,
        topHotspots: hotspots.slice(0, 5).map(h => ({
          key: h.key,
          score: h.hotScore,
          accessCount: h.accessCount
        }))
      });
      
      return hotspots;
      
    } catch (error) {
      logger.error('Failed to identify hotspots', error);
      return [];
    }
  }

  /**
   * 缓存效率分析
   */
  async analyzeEfficiency(): Promise<{
    overallHitRate: number;
    hotDataRatio: number;
    memoryEfficiency: number;
    recommendedActions: string[];
  }> {
    try {
      const stats = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      
      // 解析命中率
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const overallHitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;
      
      // 分析热点数据比例
      const totalKeys = this.globalPatterns.size;
      const hotKeys = Array.from(this.globalPatterns.values())
        .filter(p => p.hotScore > this.config.hotDataThreshold).length;
      const hotDataRatio = totalKeys > 0 ? (hotKeys / totalKeys) * 100 : 0;
      
      // 解析内存效率
      const usedMemoryMatch = memory.match(/used_memory:(\d+)/);
      const maxMemoryMatch = memory.match(/maxmemory:(\d+)/);
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
      const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;
      const memoryEfficiency = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;
      
      // 生成建议
      const recommendedActions = this.generateRecommendations(
        overallHitRate, 
        hotDataRatio, 
        memoryEfficiency
      );
      
      const result = {
        overallHitRate: Math.round(overallHitRate * 100) / 100,
        hotDataRatio: Math.round(hotDataRatio * 100) / 100,
        memoryEfficiency: Math.round(memoryEfficiency * 100) / 100,
        recommendedActions
      };
      
      logger.info('Cache efficiency analyzed', result);
      
      return result;
      
    } catch (error) {
      logger.error('Failed to analyze efficiency', error);
      return {
        overallHitRate: 0,
        hotDataRatio: 0,
        memoryEfficiency: 0,
        recommendedActions: ['无法分析缓存效率，请检查Redis连接']
      };
    }
  }

  /**
   * 启动模式分析定时器
   */
  private startPatternAnalysis(): void {
    setInterval(async () => {
      try {
        await this.analyzeAndUpdatePatterns();
      } catch (error) {
        logger.error('Pattern analysis failed', error);
      }
    }, this.config.patternUpdateInterval);
  }

  /**
   * 启动预测性预加载
   */
  private startPredictivePreloading(): void {
    setInterval(async () => {
      try {
        await this.predictAndPreload();
      } catch (error) {
        logger.error('Predictive preloading failed', error);
      }
    }, this.config.preloadLeadTime);
  }

  /**
   * 提取键的模式
   */
  private extractKeyPattern(key: string): string {
    const parts = key.split(':');
    return parts.length > 1 ? parts[0] : 'unknown';
  }

  /**
   * 获取访问模式
   */
  private async getAccessPattern(key: string): Promise<AccessPattern | null> {
    return this.globalPatterns.get(key) || null;
  }

  /**
   * 更新访问模式
   */
  private async updateAccessPattern(key: string, timestamp: number): Promise<void> {
    let pattern = this.globalPatterns.get(key);
    
    if (!pattern) {
      pattern = {
        key,
        accessCount: 0,
        lastAccess: timestamp,
        avgAccessInterval: 0,
        accessHistory: [],
        hotScore: 0
      };
      this.globalPatterns.set(key, pattern);
    }
    
    pattern.accessCount++;
    
    // 更新访问历史
    if (pattern.accessHistory.length > 0) {
      const interval = timestamp - pattern.lastAccess;
      pattern.accessHistory.push(interval);
      
      // 保持最近100次访问记录
      if (pattern.accessHistory.length > 100) {
        pattern.accessHistory.shift();
      }
      
      // 计算平均访问间隔
      pattern.avgAccessInterval = pattern.accessHistory.reduce((a, b) => a + b, 0) / pattern.accessHistory.length;
    }
    
    pattern.lastAccess = timestamp;
    
    // 计算热点分数
    pattern.hotScore = this.calculateHotScore(pattern);
  }

  /**
   * 计算热点分数
   */
  private calculateHotScore(pattern: AccessPattern): number {
    const now = Date.now();
    const hoursSinceLastAccess = (now - pattern.lastAccess) / (1000 * 60 * 60);
    
    // 基础分数 = 访问次数
    let score = pattern.accessCount;
    
    // 时间衰减因子
    const timeFactor = Math.max(0.1, Math.exp(-hoursSinceLastAccess / 24));
    score *= timeFactor;
    
    // 访问频率加成
    if (pattern.avgAccessInterval > 0 && pattern.avgAccessInterval < 3600000) { // 1小时内
      score *= 2;
    }
    
    return Math.round(score * 100) / 100;
  }

  /**
   * 获取用户行为画像
   */
  private async getUserProfile(userId: string): Promise<UserBehaviorProfile | null> {
    return this.userProfiles.get(userId) || null;
  }

  /**
   * 更新用户行为画像
   */
  private async updateUserProfile(userId: string, key: string, timestamp: number): Promise<void> {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        accessPatterns: new Map(),
        peakHours: [],
        averageSessionDuration: 0,
        preferredDataTypes: [],
        cacheHitRatio: 0,
        lastUpdated: timestamp
      };
      this.userProfiles.set(userId, profile);
    }
    
    // 更新访问模式
    const hour = new Date(timestamp).getHours();
    if (!profile.peakHours.includes(hour)) {
      profile.peakHours.push(hour);
    }
    
    profile.lastUpdated = timestamp;
  }

  /**
   * 计算最优策略
   */
  private async calculateOptimalStrategy(
    keyPattern: string, 
    accessPattern: AccessPattern | null, 
    userProfile: UserBehaviorProfile | null
  ): Promise<CacheStrategy> {
    
    // 获取基础策略
    let baseStrategy = this.strategyCache.get(keyPattern) || this.getDefaultStrategy(keyPattern);
    
    if (accessPattern) {
      // 基于访问模式调整
      if (accessPattern.hotScore > this.config.hotDataThreshold) {
        baseStrategy.ttl = Math.min(3600, baseStrategy.ttl * 2);
        baseStrategy.priority += 20;
        baseStrategy.refreshAhead = true;
      }
      
      // 高频访问启用预加载
      if (accessPattern.accessCount > 50) {
        baseStrategy.preloadEnabled = true;
      }
    }
    
    if (userProfile) {
      // 基于用户行为调整
      if (userProfile.cacheHitRatio > 0.9) {
        baseStrategy.ttl = Math.min(3600, baseStrategy.ttl * 1.5);
      }
    }
    
    return { ...baseStrategy };
  }

  /**
   * 获取默认策略
   */
  private getDefaultStrategy(key: string): CacheStrategy {
    return {
      strategyType: 'time-based',
      priority: 50,
      ttl: 300,
      refreshAhead: false,
      preloadEnabled: false,
      compressionThreshold: 1024
    };
  }

  /**
   * 生成用户预测
   */
  private async generateUserPredictions(profile: UserBehaviorProfile): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    const currentHour = new Date().getHours();
    
    // 基于用户高峰时段预测
    if (profile.peakHours.includes(currentHour)) {
      for (const [key, pattern] of profile.accessPatterns) {
        predictions.push({
          key,
          probability: 0.8,
          suggestedTtl: 600,
          preloadTime: Date.now() + 5 * 60 * 1000,
          confidence: 0.7
        });
      }
    }
    
    return predictions;
  }

  /**
   * 生成全局预测
   */
  private async generateGlobalPredictions(): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    const hotspots = await this.identifyHotspots(3600000); // 1小时窗口
    
    for (const hotspot of hotspots.slice(0, 10)) {
      predictions.push({
        key: hotspot.key,
        probability: Math.min(0.95, hotspot.hotScore / 100),
        suggestedTtl: 900,
        preloadTime: Date.now() + 10 * 60 * 1000,
        confidence: 0.8
      });
    }
    
    return predictions;
  }

  /**
   * 执行预加载
   */
  private async executePreload(predictions: PredictionResult[]): Promise<void> {
    logger.info('Executing predictive preload', { count: predictions.length });
    
    for (const prediction of predictions) {
      setTimeout(async () => {
        try {
          // 这里应该调用实际的数据加载函数
          // 由于是智能预加载，需要与具体业务逻辑结合
          this.emit('preload-requested', prediction);
        } catch (error) {
          logger.error('Preload failed', { prediction, error });
        }
      }, prediction.preloadTime - Date.now());
    }
  }

  /**
   * 分析和更新模式
   */
  private async analyzeAndUpdatePatterns(): Promise<void> {
    const cutoff = Date.now() - this.config.patternAnalysisWindow;
    
    // 清理过期模式
    for (const [key, pattern] of this.globalPatterns) {
      if (pattern.lastAccess < cutoff) {
        this.globalPatterns.delete(key);
      } else {
        // 更新热点分数
        pattern.hotScore = this.calculateHotScore(pattern);
      }
    }
    
    // 清理过期用户画像
    for (const [userId, profile] of this.userProfiles) {
      if (profile.lastUpdated < cutoff) {
        this.userProfiles.delete(userId);
      }
    }
    
    logger.debug('Pattern analysis completed', {
      activePatterns: this.globalPatterns.size,
      activeProfiles: this.userProfiles.size
    });
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(hitRate: number, hotDataRatio: number, memoryEfficiency: number): string[] {
    const recommendations: string[] = [];
    
    if (hitRate < 80) {
      recommendations.push('缓存命中率偏低，建议增加热点数据的TTL时间');
    }
    
    if (hotDataRatio < 20) {
      recommendations.push('热点数据比例偏低，建议启用预测性预加载');
    }
    
    if (memoryEfficiency > 90) {
      recommendations.push('内存使用率过高，建议清理低频访问数据');
    }
    
    if (memoryEfficiency < 50) {
      recommendations.push('内存使用率偏低，可以增加缓存数据量提升性能');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('缓存策略运行良好，无需调整');
    }
    
    return recommendations;
  }

  /**
   * 获取策略统计
   */
  async getStrategyStats(): Promise<{
    totalPatterns: number;
    activeStrategies: number;
    userProfiles: number;
    hotspots: number;
    averageHitRate: number;
  }> {
    const hotspots = await this.identifyHotspots();
    const efficiency = await this.analyzeEfficiency();
    
    return {
      totalPatterns: this.globalPatterns.size,
      activeStrategies: this.strategyCache.size,
      userProfiles: this.userProfiles.size,
      hotspots: hotspots.length,
      averageHitRate: efficiency.overallHitRate
    };
  }
}

// 导出单例实例
export default new SmartCacheStrategy();