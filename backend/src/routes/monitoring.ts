/**
 * Monitoring Routes
 * 监控相关的路由定义，提供监控数据和告警管理的API接口
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import MonitoringController from '@/controllers/MonitoringController';
import { authMiddleware } from '@/middleware/auth';
import redis from '@/config/redis';

const router = express.Router();
const monitoringController = new MonitoringController(redis);

// 验证规则
const alertValidation = [
  body('title')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('告警标题必须是1-200字符的字符串'),
  body('message')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('告警消息必须是1-1000字符的字符串'),
  body('level')
    .isIn(['info', 'warning', 'critical'])
    .withMessage('告警级别必须是info、warning或critical'),
  body('category')
    .isIn(['system', 'business', 'security', 'performance', 'application'])
    .withMessage('告警类别必须是有效的类别')
];

const historicalMetricsValidation = [
  param('category')
    .isIn(['business', 'system', 'application', 'security', 'performance'])
    .withMessage('监控类别必须是有效的类别'),
  query('hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('小时数必须是1-168之间的整数'),
  query('interval')
    .optional()
    .isIn(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'])
    .withMessage('时间间隔必须是有效的间隔值')
];

const silenceAlertValidation = [
  body('duration')
    .isInt({ min: 60, max: 86400 })
    .withMessage('抑制持续时间必须是60-86400秒之间的整数'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('抑制原因不能超过500字符')
];

/**
 * @route GET /api/monitoring/dashboard
 * @description 获取监控仪表板概览数据
 * @access Private
 */
router.get('/dashboard', authMiddleware, monitoringController.getDashboardOverview);

/**
 * @route GET /api/monitoring/realtime/:category
 * @description 获取实时监控数据
 * @param {string} category - 监控类别 (business|system|application|security|performance)
 * @access Private
 */
router.get('/realtime/:category', 
  authMiddleware,
  param('category').isIn(['business', 'system', 'application', 'security', 'performance']),
  monitoringController.getRealtimeMetrics
);

/**
 * @route GET /api/monitoring/historical/:category
 * @description 获取历史监控数据
 * @param {string} category - 监控类别
 * @query {number} hours - 查询小时数 (默认24)
 * @query {string} interval - 数据聚合间隔 (默认1h)
 * @access Private
 */
router.get('/historical/:category',
  authMiddleware,
  historicalMetricsValidation,
  monitoringController.getHistoricalMetrics
);

/**
 * @route GET /api/monitoring/alerts
 * @description 获取告警列表
 * @query {string} status - 告警状态过滤
 * @query {string} level - 告警级别过滤
 * @query {string} category - 告警类别过滤
 * @query {number} limit - 每页数量 (默认50)
 * @query {number} offset - 偏移量 (默认0)
 * @access Private
 */
router.get('/alerts',
  authMiddleware,
  query('status').optional().isIn(['active', 'acknowledged', 'resolved', 'silenced']),
  query('level').optional().isIn(['info', 'warning', 'critical']),
  query('category').optional().isIn(['system', 'business', 'security', 'performance', 'application']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  monitoringController.getAlerts
);

/**
 * @route GET /api/monitoring/alerts/:alertId
 * @description 获取告警详情
 * @param {string} alertId - 告警ID
 * @access Private
 */
router.get('/alerts/:alertId',
  authMiddleware,
  param('alertId').isUUID().withMessage('告警ID必须是有效的UUID'),
  monitoringController.getAlertDetail
);

/**
 * @route POST /api/monitoring/alerts
 * @description 创建自定义告警
 * @body {string} title - 告警标题
 * @body {string} message - 告警消息
 * @body {string} level - 告警级别
 * @body {string} category - 告警类别
 * @body {object} metadata - 附加元数据
 * @body {array} tags - 标签数组
 * @access Private
 */
router.post('/alerts',
  authMiddleware,
  alertValidation,
  monitoringController.createCustomAlert
);

/**
 * @route PATCH /api/monitoring/alerts/:alertId/acknowledge
 * @description 确认告警
 * @param {string} alertId - 告警ID
 * @body {string} comment - 确认备注 (可选)
 * @access Private
 */
router.patch('/alerts/:alertId/acknowledge',
  authMiddleware,
  param('alertId').isUUID(),
  body('comment').optional().isString().isLength({ max: 500 }),
  monitoringController.acknowledgeAlert
);

/**
 * @route PATCH /api/monitoring/alerts/:alertId/resolve
 * @description 解决告警
 * @param {string} alertId - 告警ID
 * @body {string} comment - 解决备注 (可选)
 * @access Private
 */
router.patch('/alerts/:alertId/resolve',
  authMiddleware,
  param('alertId').isUUID(),
  body('comment').optional().isString().isLength({ max: 500 }),
  monitoringController.resolveAlert
);

/**
 * @route PATCH /api/monitoring/alerts/:alertId/silence
 * @description 抑制告警
 * @param {string} alertId - 告警ID
 * @body {number} duration - 抑制持续时间(秒)
 * @body {string} reason - 抑制原因 (可选)
 * @access Private
 */
router.patch('/alerts/:alertId/silence',
  authMiddleware,
  param('alertId').isUUID(),
  silenceAlertValidation,
  monitoringController.silenceAlert
);

/**
 * @route GET /api/monitoring/reports/performance
 * @description 获取性能报告
 * @query {number} hours - 报告时间范围 (默认24小时)
 * @access Private
 */
router.get('/reports/performance',
  authMiddleware,
  query('hours').optional().isInt({ min: 1, max: 168 }),
  monitoringController.getPerformanceReport
);

/**
 * @route GET /api/monitoring/health
 * @description 获取监控系统健康状态
 * @access Private
 */
router.get('/health', authMiddleware, monitoringController.getHealthStatus);

/**
 * @route GET /api/monitoring/config
 * @description 获取监控配置信息
 * @access Private
 */
router.get('/config', authMiddleware, monitoringController.getMonitoringConfig);

// WebSocket 实时监控数据推送路由
/**
 * @route WS /api/monitoring/ws
 * @description WebSocket连接，用于实时推送监控数据和告警
 * @access Private
 */
router.get('/ws', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'WebSocket endpoints should be handled by WebSocket server',
    data: {
      endpoint: '/api/monitoring/ws',
      protocol: 'ws',
      description: 'Use WebSocket client to connect for real-time monitoring data'
    }
  });
});

// 监控中间件 - 记录API调用指标
router.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // 记录API性能指标
    if ((monitoringController as any).apmService) {
      // 这里可以记录API调用的性能数据
      // 由于APM中间件已经在应用级别处理，这里主要用于监控API特定的指标
    }
  });
  
  next();
});

// 错误处理中间件
router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Monitoring route error:', error);
  
  // 创建监控系统错误告警
  if ((monitoringController as any).alertingSystem) {
    (monitoringController as any).alertingSystem.createAlert({
      title: 'Monitoring API Error',
      message: `Error in monitoring API: ${error.message}`,
      level: 'warning' as const,
      category: 'system' as const,
      source: 'monitoring_api',
      metadata: {
        endpoint: req.path,
        method: req.method,
        error: error.message,
        stack: error.stack
      },
      tags: ['api', 'monitoring', 'error']
    }).catch(alertError => {
      console.error('Failed to create alert for monitoring API error:', alertError);
    });
  }
  
  res.status(500).json({
    success: false,
    message: '监控API发生错误',
    error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
  });
});

export default router;