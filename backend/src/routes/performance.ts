/**
 * Performance Monitoring Routes
 * 性能监控API路由
 */

import { Router, Request, Response } from 'express';
import PerformanceMonitorService from '@/services/PerformanceMonitorService';
import DatabaseMonitor from '@/services/DatabaseMonitor';
import CacheManager from '@/services/CacheManager';
import MigrationManager from '@/config/migrations';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';

const router = Router();

/**
 * 获取当前性能状态
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = PerformanceMonitorService.getCurrentStatus();
    
    res.json(successResponse({
      status: status.status,
      summary: status.summary,
      metrics: status.metrics,
      activeAlerts: status.activeAlerts,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get performance status', error);
    res.status(500).json(errorResponse('获取性能状态失败'));
  }
});

/**
 * 获取详细性能指标
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 1;
    
    // 获取数据库健康状态
    const dbHealth = await DatabaseMonitor.getHealth();
    
    // 获取数据库统计
    const dbStats = DatabaseMonitor.getPerformanceStats();
    
    // 获取缓存统计
    const cacheStats = await CacheManager.getStats();
    
    // 获取性能报告
    const performanceReport = PerformanceMonitorService.getPerformanceReport(hours);

    res.json(successResponse({
      database: {
        health: dbHealth,
        stats: dbStats
      },
      cache: cacheStats,
      performance: performanceReport,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get performance metrics', error);
    res.status(500).json(errorResponse('获取性能指标失败'));
  }
});

/**
 * 获取慢查询报告
 */
router.get('/slow-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const report = DatabaseMonitor.getSlowQueriesReport(limit);
    
    res.json(successResponse({
      slowQueries: report,
      timestamp: new Date(),
      limit
    }));
  } catch (error) {
    logger.error('Failed to get slow queries report', error);
    res.status(500).json(errorResponse('获取慢查询报告失败'));
  }
});

/**
 * 获取数据库性能指标
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const metrics = await MigrationManager.getPerformanceMetrics();
    const health = await DatabaseMonitor.getHealth();
    
    res.json(successResponse({
      metrics,
      health,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get database performance', error);
    res.status(500).json(errorResponse('获取数据库性能失败'));
  }
});

/**
 * 获取缓存性能统计
 */
router.get('/cache', async (req: Request, res: Response) => {
  try {
    const stats = await CacheManager.getStats();
    
    res.json(successResponse({
      stats,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get cache performance', error);
    res.status(500).json(errorResponse('获取缓存性能失败'));
  }
});

/**
 * 清理缓存
 */
router.post('/cache/cleanup', async (req: Request, res: Response) => {
  try {
    await CacheManager.cleanup();
    
    logger.info('Cache cleanup initiated via API');
    res.json(successResponse({
      message: '缓存清理完成',
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to cleanup cache', error);
    res.status(500).json(errorResponse('缓存清理失败'));
  }
});

/**
 * 刷新物化视图
 */
router.post('/database/refresh-views', async (req: Request, res: Response) => {
  try {
    await MigrationManager.refreshMaterializedViews();
    
    logger.info('Materialized views refresh initiated via API');
    res.json(successResponse({
      message: '物化视图刷新完成',
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to refresh materialized views', error);
    res.status(500).json(errorResponse('物化视图刷新失败'));
  }
});

/**
 * 获取系统告警
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { status } = PerformanceMonitorService.getCurrentStatus();
    
    // 这里可以添加更详细的告警历史查询逻辑
    const alerts = status === 'critical' || status === 'warning' 
      ? PerformanceMonitorService.getCurrentStatus().activeAlerts
      : [];

    res.json(successResponse({
      alerts,
      count: alerts.length,
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get alerts', error);
    res.status(500).json(errorResponse('获取告警信息失败'));
  }
});

/**
 * 解决告警
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = PerformanceMonitorService.resolveAlert(alertId);
    
    if (resolved) {
      logger.info('Alert resolved via API', { alertId });
      res.json(successResponse({
        message: '告警已解决',
        alertId,
        timestamp: new Date()
      }));
    } else {
      res.status(404).json(errorResponse('告警不存在或已解决'));
    }
  } catch (error) {
    logger.error('Failed to resolve alert', error);
    res.status(500).json(errorResponse('解决告警失败'));
  }
});

/**
 * 获取性能趋势
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const report = PerformanceMonitorService.getPerformanceReport(hours);
    
    res.json(successResponse({
      trends: report.trends,
      timeRange: report.timeRange,
      summary: {
        totalMetrics: report.averages,
        peakMetrics: report.peaks
      },
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to get performance trends', error);
    res.status(500).json(errorResponse('获取性能趋势失败'));
  }
});

/**
 * 重置监控统计
 */
router.post('/monitoring/reset', async (req: Request, res: Response) => {
  try {
    DatabaseMonitor.resetMetrics();
    CacheManager.resetStats();
    
    logger.info('Monitoring stats reset via API');
    res.json(successResponse({
      message: '监控统计已重置',
      timestamp: new Date()
    }));
  } catch (error) {
    logger.error('Failed to reset monitoring stats', error);
    res.status(500).json(errorResponse('重置监控统计失败'));
  }
});

/**
 * 健康检查端点
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { status, summary } = PerformanceMonitorService.getCurrentStatus();
    
    // HTTP状态码映射
    const httpStatus = status === 'healthy' ? 200 : 
                      status === 'warning' ? 200 : 503;

    res.status(httpStatus).json({
      status,
      summary,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      summary: '健康检查失败',
      timestamp: new Date()
    });
  }
});

/**
 * 获取实时指标 (SSE)
 */
router.get('/metrics/stream', (req: Request, res: Response) => {
  // 设置SSE头部
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // 发送初始连接确认
  res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');

  // 监听性能指标事件
  const metricsListener = (metrics: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'metrics',
      data: metrics,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  const alertListener = (alert: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'alert',
      data: alert,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  PerformanceMonitorService.on('metrics', metricsListener);
  PerformanceMonitorService.on('alert', alertListener);

  // 客户端断开连接时清理
  req.on('close', () => {
    PerformanceMonitorService.removeListener('metrics', metricsListener);
    PerformanceMonitorService.removeListener('alert', alertListener);
  });
});

export default router;