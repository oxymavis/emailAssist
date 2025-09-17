/**
 * API Optimization Middleware
 * API性能监控和缓存优化中间件
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import logger from '@/utils/logger';

/**
 * API响应缓存中间件
 */
export class ApiCache {
  private cache = new Map<string, {
    data: any;
    etag: string;
    timestamp: number;
    ttl: number;
  }>();

  /**
   * 创建缓存中间件
   * @param ttl 缓存生存时间（秒）
   * @param keyGenerator 自定义缓存键生成器
   */
  middleware(
    ttl: number = 300, // 默认5分钟
    keyGenerator?: (req: Request) => string
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // 只缓存GET请求
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = keyGenerator ? keyGenerator(req) : this.generateCacheKey(req);
      const cached = this.cache.get(cacheKey);

      // 检查缓存是否存在且未过期
      if (cached && (Date.now() - cached.timestamp) < cached.ttl * 1000) {
        // 检查客户端ETag
        const clientETag = req.headers['if-none-match'];
        if (clientETag === cached.etag) {
          res.status(304).end();
          return;
        }

        // 返回缓存的数据
        res.set('ETag', cached.etag);
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `max-age=${Math.floor((cached.ttl * 1000 - (Date.now() - cached.timestamp)) / 1000)}`);
        res.json(cached.data);

        logger.debug('Cache hit', {
          cacheKey,
          path: req.path,
          requestId: req.requestId
        });
        
        return;
      }

      // 重写res.json以缓存响应
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        // 生成ETag
        const etag = this.generateETag(data);
        
        // 缓存响应
        this.cache.set(cacheKey, {
          data,
          etag,
          timestamp: Date.now(),
          ttl
        });

        // 设置响应头
        res.set('ETag', etag);
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', `max-age=${ttl}`);

        logger.debug('Response cached', {
          cacheKey,
          path: req.path,
          ttl,
          requestId: req.requestId
        });

        return originalJson(data);
      };

      next();
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(req: Request): string {
    const { path, query, user } = req;
    const keyData = {
      path,
      query: JSON.stringify(query),
      userId: user?.id || 'anonymous'
    };
    
    return createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * 生成ETag
   */
  private generateETag(data: any): string {
    return createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * 清除缓存
   */
  clear(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const [key, value] of this.cache) {
      if ((now - value.timestamp) >= value.ttl * 1000) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.cache.size,
      active,
      expired
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, value] of this.cache) {
      if ((now - value.timestamp) >= value.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }
}

// 全局缓存实例
export const apiCache = new ApiCache();

/**
 * API性能监控中间件
 */
export class PerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    errors: number;
    lastRequest: number;
  }>();

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = process.hrtime.bigint();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;
      
      // 监听响应完成事件
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
        
        this.recordMetrics(endpoint, duration, res.statusCode >= 400);
        
        // 设置性能头
        res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
        
        // 记录慢请求
        if (duration > 1000) {
          logger.warn('Slow API request detected', {
            endpoint,
            duration: `${duration.toFixed(2)}ms`,
            statusCode: res.statusCode,
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            requestId: req.requestId
          });
        }
      });

      next();
    };
  }

  /**
   * 记录性能指标
   */
  private recordMetrics(endpoint: string, duration: number, isError: boolean): void {
    const existing = this.metrics.get(endpoint);
    
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.lastRequest = Date.now();
      if (isError) {
        existing.errors++;
      }
    } else {
      this.metrics.set(endpoint, {
        count: 1,
        totalTime: duration,
        minTime: duration,
        maxTime: duration,
        errors: isError ? 1 : 0,
        lastRequest: Date.now()
      });
    }
  }

  /**
   * 获取性能统计
   */
  getStats() {
    const stats = [];
    
    for (const [endpoint, metrics] of this.metrics) {
      stats.push({
        endpoint,
        requestCount: metrics.count,
        averageResponseTime: metrics.totalTime / metrics.count,
        minResponseTime: metrics.minTime,
        maxResponseTime: metrics.maxTime,
        errorRate: (metrics.errors / metrics.count) * 100,
        lastRequest: new Date(metrics.lastRequest).toISOString()
      });
    }
    
    return stats.sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * 获取系统性能摘要
   */
  getSummary() {
    const stats = this.getStats();
    const totalRequests = stats.reduce((sum, stat) => sum + stat.requestCount, 0);
    const totalErrors = stats.reduce((sum, stat) => sum + (stat.requestCount * stat.errorRate / 100), 0);
    const avgResponseTime = stats.reduce((sum, stat) => sum + stat.averageResponseTime, 0) / stats.length;
    
    return {
      totalEndpoints: stats.length,
      totalRequests,
      totalErrors,
      overallErrorRate: (totalErrors / totalRequests) * 100,
      averageResponseTime: avgResponseTime,
      slowestEndpoint: stats.reduce((slowest, current) => 
        current.averageResponseTime > slowest.averageResponseTime ? current : slowest,
        stats[0]
      ),
      mostUsedEndpoint: stats[0] // 已按请求数排序
    };
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics.clear();
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * API限流中间件
 */
export class RateLimiter {
  private requests = new Map<string, {
    count: number;
    resetTime: number;
  }>();

  /**
   * 创建限流中间件
   * @param windowMs 时间窗口（毫秒）
   * @param maxRequests 最大请求数
   * @param keyGenerator 自定义键生成器
   */
  middleware(
    windowMs: number = 60000, // 默认1分钟
    maxRequests: number = 100,
    keyGenerator?: (req: Request) => string
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = keyGenerator ? keyGenerator(req) : this.generateKey(req);
      const now = Date.now();
      const existing = this.requests.get(key);
      
      // 检查是否需要重置窗口
      if (!existing || now >= existing.resetTime) {
        this.requests.set(key, {
          count: 1,
          resetTime: now + windowMs
        });
        
        this.setRateLimitHeaders(res, maxRequests - 1, existing?.resetTime || (now + windowMs));
        return next();
      }
      
      // 检查是否超过限制
      if (existing.count >= maxRequests) {
        const retryAfter = Math.ceil((existing.resetTime - now) / 1000);
        
        logger.warn('Rate limit exceeded', {
          key,
          count: existing.count,
          limit: maxRequests,
          retryAfter,
          path: req.path,
          method: req.method,
          requestId: req.requestId
        });
        
        res.set('Retry-After', retryAfter.toString());
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        
        return;
      }
      
      // 增加计数
      existing.count++;
      this.requests.set(key, existing);
      
      this.setRateLimitHeaders(res, maxRequests - existing.count, existing.resetTime);
      next();
    };
  }

  /**
   * 生成限流键
   */
  private generateKey(req: Request): string {
    // 优先使用用户ID，否则使用IP
    return req.user?.id || req.ip || 'anonymous';
  }

  /**
   * 设置限流响应头
   */
  private setRateLimitHeaders(res: Response, remaining: number, resetTime: number): void {
    res.set('X-RateLimit-Remaining', remaining.toString());
    res.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
  }

  /**
   * 清理过期记录
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, data] of this.requests) {
      if (now >= data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * 获取限流统计
   */
  getStats() {
    const now = Date.now();
    const stats = [];
    
    for (const [key, data] of this.requests) {
      if (now < data.resetTime) {
        stats.push({
          key,
          currentCount: data.count,
          resetTime: new Date(data.resetTime).toISOString()
        });
      }
    }
    
    return stats;
  }
}

/**
 * 响应压缩中间件
 */
export const enableCompression = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    // 检查客户端是否支持压缩
    if (acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate')) {
      // 重写res.json以启用压缩
      const originalJson = res.json.bind(res);
      
      res.json = (data: any) => {
        const jsonString = JSON.stringify(data);
        
        // 只对大于1KB的响应启用压缩
        if (jsonString.length > 1024) {
          res.set('Content-Encoding', 'gzip');
          res.set('Vary', 'Accept-Encoding');
        }
        
        return originalJson(data);
      };
    }
    
    next();
  };
};

/**
 * API健康检查端点
 */
export const createHealthCheckEndpoint = () => {
  return async (req: Request, res: Response): Promise<void> => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // 获取性能统计
    const performanceStats = performanceMonitor.getSummary();
    const cacheStats = apiCache.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      performance: performanceStats,
      cache: cacheStats
    };
    
    // 检查健康状态
    const isHealthy = 
      health.memory.heapUsed < 512 && // 内存使用小于512MB
      (performanceStats?.overallErrorRate || 0) < 10 && // 错误率小于10%
      (performanceStats?.averageResponseTime || 0) < 2000; // 平均响应时间小于2秒
    
    const statusCode = isHealthy ? 200 : 503;
    health.status = isHealthy ? 'healthy' : 'degraded';
    
    res.status(statusCode).json({
      success: isHealthy,
      data: health,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
};

/**
 * 定期清理任务
 */
export const setupCleanupTasks = (): void => {
  // 每5分钟清理一次缓存
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
  
  // 每小时重置性能指标（保持最近1小时的数据）
  setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // 这里可以添加更复杂的清理逻辑
  }, 60 * 60 * 1000);
  
  logger.info('API optimization cleanup tasks started');
};

/**
 * Simple rate limit middleware
 */
export const rateLimitMiddleware = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    let requestData = requestCounts.get(key);
    
    if (!requestData || now > requestData.resetTime) {
      requestData = { count: 1, resetTime: now + windowMs };
      requestCounts.set(key, requestData);
      return next();
    }
    
    if (requestData.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((requestData.resetTime - now) / 1000)} seconds.`
      });
      return;
    }
    
    requestData.count++;
    next();
  };
};