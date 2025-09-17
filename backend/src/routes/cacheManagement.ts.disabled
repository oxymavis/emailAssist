/**
 * 缓存管理API路由
 * 提供缓存操作、监控、配置管理的HTTP接口
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import UnifiedCacheManager from '@/services/UnifiedCacheManager';
import CacheMonitoringSystem from '@/services/CacheMonitoringSystem';
import CacheConfigManager from '@/services/CacheConfigManager';
import CacheConsistencyManager from '@/services/CacheConsistencyManager';
import logger from '@/utils/logger';

const router = Router();

// 验证中间件
const handleValidation = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// 错误处理中间件
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== 基础缓存操作 ====================

/**
 * 获取缓存数据
 */
router.get('/cache/:key',
  param('key').notEmpty().withMessage('Cache key is required'),
  query('userId').optional(),
  query('businessContext').optional().isIn(['email', 'analysis', 'user', 'search']),
  query('consistencyLevel').optional().isIn(['eventual', 'strong', 'weak']),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    const { userId, businessContext, consistencyLevel } = req.query;
    
    const options = {
      userId,
      businessContext,
      consistencyLevel
    };
    
    const data = await UnifiedCacheManager.get(key, options);
    
    res.json({
      success: true,
      data,
      cached: data !== null,
      timestamp: Date.now()
    });
  })
);

/**
 * 设置缓存数据
 */
router.post('/cache/:key',
  param('key').notEmpty().withMessage('Cache key is required'),
  body('data').exists().withMessage('Data is required'),
  body('ttl').optional().isInt({ min: 1 }).withMessage('TTL must be a positive integer'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1-10'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('userId').optional(),
  body('businessContext').optional().isIn(['email', 'analysis', 'user', 'search']),
  body('consistencyLevel').optional().isIn(['eventual', 'strong', 'weak']),
  body('compression').optional().isBoolean(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    const { data, ttl, priority, tags, userId, businessContext, consistencyLevel, compression } = req.body;
    
    const options = {
      ttl,
      priority,
      tags,
      userId,
      businessContext,
      consistencyLevel,
      compression
    };
    
    const success = await UnifiedCacheManager.set(key, data, options);
    
    res.json({
      success,
      message: success ? 'Cache set successfully' : 'Failed to set cache',
      timestamp: Date.now()
    });
  })
);

/**
 * 删除缓存数据
 */
router.delete('/cache/:key',
  param('key').notEmpty().withMessage('Cache key is required'),
  body('consistencyLevel').optional().isIn(['eventual', 'strong', 'weak']),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    const { consistencyLevel } = req.body;
    
    const success = await UnifiedCacheManager.delete(key, { consistencyLevel });
    
    res.json({
      success,
      message: success ? 'Cache deleted successfully' : 'Failed to delete cache',
      timestamp: Date.now()
    });
  })
);

/**
 * 批量获取缓存数据
 */
router.post('/cache/batch/get',
  body('keys').isArray().notEmpty().withMessage('Keys array is required'),
  body('userId').optional(),
  body('businessContext').optional().isIn(['email', 'analysis', 'user', 'search']),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { keys, userId, businessContext } = req.body;
    
    const results = await UnifiedCacheManager.mget(keys, { userId, businessContext });
    
    // 转换Map为Object以便JSON序列化
    const data = Object.fromEntries(results);
    
    res.json({
      success: true,
      data,
      hitCount: Array.from(results.values()).filter(v => v !== null).length,
      totalCount: keys.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 批量设置缓存数据
 */
router.post('/cache/batch/set',
  body('entries').isArray().notEmpty().withMessage('Entries array is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { entries, globalOptions = {} } = req.body;
    
    const results = await UnifiedCacheManager.mset(entries, globalOptions);
    
    const successCount = results.filter(r => r).length;
    
    res.json({
      success: true,
      results,
      successCount,
      totalCount: entries.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 带回源的缓存获取
 */
router.post('/cache/:key/get-or-set',
  param('key').notEmpty().withMessage('Cache key is required'),
  body('fetchUrl').optional().isURL().withMessage('Fetch URL must be valid'),
  body('ttl').optional().isInt({ min: 1 }),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    const { fetchUrl, ttl, userId, businessContext } = req.body;
    
    const fetchFunction = async () => {
      if (fetchUrl) {
        // 简化实现：从URL获取数据
        const fetch = require('node-fetch');
        const response = await fetch(fetchUrl);
        return await response.json();
      }
      throw new Error('No fetch function provided');
    };
    
    const data = await UnifiedCacheManager.getOrSet(key, fetchFunction, {
      ttl,
      userId,
      businessContext
    });
    
    res.json({
      success: true,
      data,
      timestamp: Date.now()
    });
  })
);

// ==================== 高级缓存操作 ====================

/**
 * 缓存预热
 */
router.post('/cache/warmup',
  body('entries').isArray().notEmpty().withMessage('Entries array is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { entries } = req.body;
    
    await UnifiedCacheManager.warmup(entries);
    
    res.json({
      success: true,
      message: `Cache warmup initiated for ${entries.length} entries`,
      timestamp: Date.now()
    });
  })
);

/**
 * 预测性缓存预加载
 */
router.post('/cache/preload',
  body('userId').optional(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { userId } = req.body;
    
    await UnifiedCacheManager.preloadCache(userId);
    
    res.json({
      success: true,
      message: 'Predictive cache preload completed',
      timestamp: Date.now()
    });
  })
);

/**
 * 按标签删除缓存
 */
router.delete('/cache/tags/:tag',
  param('tag').notEmpty().withMessage('Tag is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { tag } = req.params;
    
    const deletedCount = await UnifiedCacheManager.deleteByTag(tag);
    
    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} cache entries with tag: ${tag}`,
      timestamp: Date.now()
    });
  })
);

/**
 * 清空缓存层级
 */
router.delete('/cache/layers/:layer',
  param('layer').optional().isIn(['L1', 'L2', 'L3']),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { layer } = req.params;
    
    await UnifiedCacheManager.clear(layer as any);
    
    res.json({
      success: true,
      message: `Cache layer ${layer || 'all'} cleared successfully`,
      timestamp: Date.now()
    });
  })
);

// ==================== 监控和分析 ====================

/**
 * 获取缓存统计信息
 */
router.get('/stats',
  asyncHandler(async (req: any, res: any) => {
    const stats = await UnifiedCacheManager.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取性能报告
 */
router.get('/performance/:period',
  param('period').isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { period } = req.params;
    
    const report = await UnifiedCacheManager.getPerformanceReport(period as any);
    
    res.json({
      success: true,
      data: report,
      timestamp: Date.now()
    });
  })
);

/**
 * 健康检查
 */
router.get('/health',
  asyncHandler(async (req: any, res: any) => {
    const health = await UnifiedCacheManager.healthCheck();
    
    res.status(health.healthy ? 200 : 503).json({
      success: health.healthy,
      data: health,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取实时指标
 */
router.get('/metrics/current',
  asyncHandler(async (req: any, res: any) => {
    const metrics = CacheMonitoringSystem.getCurrentMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取指标历史
 */
router.get('/metrics/history',
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1-1000'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 100;
    
    const history = CacheMonitoringSystem.getMetricsHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取告警信息
 */
router.get('/alerts',
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1-1000'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const active = req.query.active === 'true';
    const limit = parseInt(req.query.limit as string) || 100;
    
    const alerts = active 
      ? CacheMonitoringSystem.getActiveAlerts()
      : CacheMonitoringSystem.getAllAlerts(limit);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取热点键统计
 */
router.get('/hotkeys',
  asyncHandler(async (req: any, res: any) => {
    const hotKeys = CacheMonitoringSystem.getHotKeysStats();
    
    res.json({
      success: true,
      data: hotKeys,
      count: hotKeys.length,
      timestamp: Date.now()
    });
  })
);

// ==================== 配置管理 ====================

/**
 * 获取当前配置
 */
router.get('/config/current',
  asyncHandler(async (req: any, res: any) => {
    const config = UnifiedCacheManager.getCurrentConfig();
    
    res.json({
      success: true,
      data: config,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取所有配置
 */
router.get('/config/all',
  asyncHandler(async (req: any, res: any) => {
    const configurations = CacheConfigManager.getAllConfigurations();
    
    res.json({
      success: true,
      data: configurations,
      count: configurations.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取配置模板
 */
router.get('/config/templates',
  asyncHandler(async (req: any, res: any) => {
    const templates = CacheConfigManager.getAllTemplates();
    
    res.json({
      success: true,
      data: templates,
      count: templates.length,
      timestamp: Date.now()
    });
  })
);

/**
 * 创建配置
 */
router.post('/config',
  body('name').notEmpty().withMessage('Configuration name is required'),
  body('description').optional(),
  body('templateId').optional(),
  body('baseConfig').optional().isObject(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { name, description, templateId, baseConfig } = req.body;
    
    const config = await CacheConfigManager.createConfiguration(
      name,
      description,
      baseConfig,
      templateId
    );
    
    res.status(201).json({
      success: true,
      data: config,
      message: 'Configuration created successfully',
      timestamp: Date.now()
    });
  })
);

/**
 * 更新配置
 */
router.put('/config/:configId',
  param('configId').notEmpty().withMessage('Configuration ID is required'),
  body('updates').isObject().notEmpty().withMessage('Updates object is required'),
  body('user').optional(),
  body('reason').optional(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configId } = req.params;
    const { updates, user = 'api', reason } = req.body;
    
    const success = await UnifiedCacheManager.updateConfig(configId, updates, user);
    
    res.json({
      success,
      message: success ? 'Configuration updated successfully' : 'Failed to update configuration',
      timestamp: Date.now()
    });
  })
);

/**
 * 启用配置
 */
router.post('/config/:configId/enable',
  param('configId').notEmpty().withMessage('Configuration ID is required'),
  body('user').optional(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configId } = req.params;
    const { user = 'api' } = req.body;
    
    const success = await UnifiedCacheManager.enableConfig(configId, user);
    
    res.json({
      success,
      message: success ? 'Configuration enabled successfully' : 'Failed to enable configuration',
      timestamp: Date.now()
    });
  })
);

/**
 * 禁用配置
 */
router.post('/config/:configId/disable',
  param('configId').notEmpty().withMessage('Configuration ID is required'),
  body('user').optional(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configId } = req.params;
    const { user = 'api' } = req.body;
    
    await CacheConfigManager.disableConfiguration(configId, user);
    
    res.json({
      success: true,
      message: 'Configuration disabled successfully',
      timestamp: Date.now()
    });
  })
);

/**
 * 验证配置
 */
router.post('/config/validate',
  body('config').isObject().notEmpty().withMessage('Configuration object is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { config } = req.body;
    
    const validation = await CacheConfigManager.validateConfiguration(config);
    
    res.json({
      success: true,
      data: validation,
      timestamp: Date.now()
    });
  })
);

/**
 * 导出配置
 */
router.get('/config/:configId/export',
  param('configId').notEmpty().withMessage('Configuration ID is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configId } = req.params;
    
    const configJson = await CacheConfigManager.exportConfiguration(configId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cache-config-${configId}.json"`);
    res.send(configJson);
  })
);

/**
 * 导入配置
 */
router.post('/config/import',
  body('configJson').notEmpty().withMessage('Configuration JSON is required'),
  body('user').optional(),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configJson, user = 'api' } = req.body;
    
    const config = await CacheConfigManager.importConfiguration(configJson, user);
    
    res.status(201).json({
      success: true,
      data: config,
      message: 'Configuration imported successfully',
      timestamp: Date.now()
    });
  })
);

/**
 * 获取配置变更日志
 */
router.get('/config/:configId/changelog',
  param('configId').optional(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { configId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const changelog = CacheConfigManager.getChangeLog(configId, limit);
    
    res.json({
      success: true,
      data: changelog,
      count: changelog.length,
      timestamp: Date.now()
    });
  })
);

// ==================== 数据一致性管理 ====================

/**
 * 检查数据一致性
 */
router.get('/consistency/:key',
  param('key').notEmpty().withMessage('Cache key is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    
    const consistency = await UnifiedCacheManager.checkConsistency(key);
    
    res.json({
      success: true,
      data: consistency,
      timestamp: Date.now()
    });
  })
);

/**
 * 强制数据同步
 */
router.post('/consistency/:key/sync',
  param('key').notEmpty().withMessage('Cache key is required'),
  handleValidation,
  asyncHandler(async (req: any, res: any) => {
    const { key } = req.params;
    
    const success = await UnifiedCacheManager.forceSync(key);
    
    res.json({
      success,
      message: success ? 'Data sync completed successfully' : 'Failed to sync data',
      timestamp: Date.now()
    });
  })
);

/**
 * 数据完整性检查
 */
router.post('/integrity/check',
  asyncHandler(async (req: any, res: any) => {
    const report = await UnifiedCacheManager.integrityCheck();
    
    res.json({
      success: true,
      data: report,
      timestamp: Date.now()
    });
  })
);

/**
 * 获取节点状态
 */
router.get('/consistency/node-status',
  asyncHandler(async (req: any, res: any) => {
    const status = await CacheConsistencyManager.getNodeStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: Date.now()
    });
  })
);

// ==================== 工具和调试 ====================

/**
 * 重置监控计数器
 */
router.post('/monitoring/reset',
  asyncHandler(async (req: any, res: any) => {
    CacheMonitoringSystem.resetCounters();
    
    res.json({
      success: true,
      message: 'Monitoring counters reset successfully',
      timestamp: Date.now()
    });
  })
);

/**
 * 获取系统信息
 */
router.get('/system/info',
  asyncHandler(async (req: any, res: any) => {
    const info = {
      nodeId: (await CacheConsistencyManager.getNodeStatus()).nodeId,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      data: info,
      timestamp: Date.now()
    });
  })
);

// 错误处理中间件
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Cache management API error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    timestamp: Date.now()
  });
});

export default router;