import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import { EmailBatchOperationService } from './EmailBatchOperationService';
import { WorkflowEngine } from './WorkflowEngine';
import { WorkflowTemplateService, SystemTemplateInitializer } from './WorkflowTemplateService';
import { queueManager, initializeQueues } from '@/config/queueConfig';
import { BatchOperationController } from '@/controllers/BatchOperationController';
import { CacheManager } from './CacheManager';
import logger from '@/utils/logger';
import config from '@/config';

/**
 * 批量操作和工作流系统集成管理器
 * 负责初始化和管理整个批量操作和工作流系统
 */
export class BatchWorkflowIntegration {
  private static instance: BatchWorkflowIntegration;
  
  private pool: Pool;
  private emailBatchOperationService: EmailBatchOperationService;
  private workflowEngine: WorkflowEngine;
  private workflowTemplateService: WorkflowTemplateService;
  private systemTemplateInitializer: SystemTemplateInitializer;
  private cacheManager: CacheManager;
  private initialized = false;

  private constructor() {
    this.pool = DatabaseManager.getPool();
    this.cacheManager = new CacheManager({
      host: config.env.REDIS_HOST || 'localhost',
      port: parseInt(config.env.REDIS_PORT || '6379'),
      password: config.env.REDIS_PASSWORD,
      db: parseInt(config.env.REDIS_DB || '0')
    });
  }

  static getInstance(): BatchWorkflowIntegration {
    if (!BatchWorkflowIntegration.instance) {
      BatchWorkflowIntegration.instance = new BatchWorkflowIntegration();
    }
    return BatchWorkflowIntegration.instance;
  }

  /**
   * 初始化整个批量操作和工作流系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('Batch workflow system already initialized');
      return;
    }

    try {
      logger.info('Initializing batch workflow system...');

      // 1. 初始化队列系统
      await this.initializeQueueSystem();

      // 2. 初始化服务实例
      await this.initializeServices();

      // 3. 初始化控制器
      await this.initializeControllers();

      // 4. 创建数据库表和索引
      await this.initializeDatabase();

      // 5. 初始化系统模板
      await this.initializeSystemTemplates();

      // 6. 启动定时任务
      await this.startScheduledTasks();

      // 7. 设置系统监控
      await this.setupSystemMonitoring();

      this.initialized = true;
      logger.info('Batch workflow system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize batch workflow system', { error });
      throw error;
    }
  }

  /**
   * 获取邮件批量操作服务
   */
  getEmailBatchOperationService(): EmailBatchOperationService {
    if (!this.initialized) {
      throw new Error('System not initialized');
    }
    return this.emailBatchOperationService;
  }

  /**
   * 获取工作流引擎
   */
  getWorkflowEngine(): WorkflowEngine {
    if (!this.initialized) {
      throw new Error('System not initialized');
    }
    return this.workflowEngine;
  }

  /**
   * 获取工作流模板服务
   */
  getWorkflowTemplateService(): WorkflowTemplateService {
    if (!this.initialized) {
      throw new Error('System not initialized');
    }
    return this.workflowTemplateService;
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down batch workflow system...');

    try {
      // 关闭队列系统
      await queueManager.shutdown();

      // 关闭缓存管理器
      await this.cacheManager.disconnect();

      this.initialized = false;
      logger.info('Batch workflow system shut down successfully');

    } catch (error) {
      logger.error('Error during batch workflow system shutdown', { error });
      throw error;
    }
  }

  /**
   * 初始化队列系统
   */
  private async initializeQueueSystem(): Promise<void> {
    logger.info('Initializing queue system...');
    await initializeQueues();
    logger.info('Queue system initialized');
  }

  /**
   * 初始化服务实例
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing service instances...');

    const redisConfig = {
      host: config.env.REDIS_HOST || 'localhost',
      port: parseInt(config.env.REDIS_PORT || '6379'),
      password: config.env.REDIS_PASSWORD,
      db: parseInt(config.env.REDIS_DB || '0')
    };

    // 初始化邮件批量操作服务
    this.emailBatchOperationService = new EmailBatchOperationService(this.pool, redisConfig);
    logger.info('Email batch operation service initialized');

    // 初始化工作流引擎
    this.workflowEngine = new WorkflowEngine(this.pool, redisConfig, this.emailBatchOperationService);
    logger.info('Workflow engine initialized');

    // 初始化工作流模板服务
    this.workflowTemplateService = new WorkflowTemplateService(this.pool);
    logger.info('Workflow template service initialized');

    // 初始化系统模板初始化器
    this.systemTemplateInitializer = new SystemTemplateInitializer(this.workflowTemplateService);
    logger.info('System template initializer initialized');

    logger.info('Service instances initialized');
  }

  /**
   * 初始化控制器
   */
  private async initializeControllers(): Promise<void> {
    logger.info('Initializing controllers...');

    // 初始化批量操作控制器
    BatchOperationController.initialize(this.emailBatchOperationService, this.workflowEngine);

    logger.info('Controllers initialized');
  }

  /**
   * 初始化数据库
   */
  private async initializeDatabase(): Promise<void> {
    logger.info('Initializing database schema...');

    try {
      // 执行数据库schema创建脚本
      const fs = await import('fs');
      const path = await import('path');
      
      const schemaPath = path.join(__dirname, '../config/workflow-schema.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await this.pool.query(schemaSql);
        logger.info('Database schema initialized');
      } else {
        logger.warn('Schema file not found, skipping database initialization');
      }

    } catch (error) {
      logger.error('Failed to initialize database schema', { error });
      // 不抛出错误，继续初始化其他部分
    }
  }

  /**
   * 初始化系统模板
   */
  private async initializeSystemTemplates(): Promise<void> {
    logger.info('Initializing system templates...');

    try {
      await this.systemTemplateInitializer.initializeSystemTemplates();
      logger.info('System templates initialized');
    } catch (error) {
      logger.error('Failed to initialize system templates', { error });
      // 不抛出错误，系统模板初始化失败不应该阻止系统启动
    }
  }

  /**
   * 启动定时任务
   */
  private async startScheduledTasks(): Promise<void> {
    logger.info('Starting scheduled tasks...');

    try {
      // 启动批量操作清理任务（每天清理过期的批量操作记录）
      this.scheduleCleanupTasks();

      // 启动队列监控任务
      this.scheduleQueueMonitoring();

      // 启动系统健康检查任务
      this.scheduleHealthCheck();

      logger.info('Scheduled tasks started');
    } catch (error) {
      logger.error('Failed to start scheduled tasks', { error });
    }
  }

  /**
   * 设置系统监控
   */
  private async setupSystemMonitoring(): Promise<void> {
    logger.info('Setting up system monitoring...');

    try {
      // 设置性能监控
      this.setupPerformanceMonitoring();

      // 设置错误监控
      this.setupErrorMonitoring();

      // 设置资源监控
      this.setupResourceMonitoring();

      logger.info('System monitoring set up');
    } catch (error) {
      logger.error('Failed to set up system monitoring', { error });
    }
  }

  /**
   * 安排清理任务
   */
  private scheduleCleanupTasks(): void {
    // 每天凌晨2点清理过期的批量操作记录
    setInterval(async () => {
      try {
        const deletedCount = await this.emailBatchOperationService.cleanupExpiredOperations(30); // 保留30天
        logger.info('Batch operations cleanup completed', { deletedCount });
      } catch (error) {
        logger.error('Batch operations cleanup failed', { error });
      }
    }, 24 * 60 * 60 * 1000); // 24小时
  }

  /**
   * 安排队列监控
   */
  private scheduleQueueMonitoring(): void {
    // 每5分钟检查队列状态
    setInterval(async () => {
      try {
        const queueStatus = await queueManager.getAllQueueStatus();
        
        // 检查是否有异常队列
        for (const [queueName, status] of Object.entries(queueStatus)) {
          if (status.failed > 100 || status.waiting > 1000) {
            logger.warn('Queue status alert', { queueName, status });
          }
        }

        // 记录队列统计信息
        logger.debug('Queue status check', { queueStatus });

      } catch (error) {
        logger.error('Queue monitoring failed', { error });
      }
    }, 5 * 60 * 1000); // 5分钟
  }

  /**
   * 安排健康检查
   */
  private scheduleHealthCheck(): void {
    // 每10分钟进行系统健康检查
    setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck();
        
        if (!healthStatus.healthy) {
          logger.warn('System health check failed', { healthStatus });
        } else {
          logger.debug('System health check passed', { healthStatus });
        }

      } catch (error) {
        logger.error('Health check failed', { error });
      }
    }, 10 * 60 * 1000); // 10分钟
  }

  /**
   * 执行系统健康检查
   */
  private async performHealthCheck(): Promise<{
    healthy: boolean;
    checks: Record<string, any>;
    timestamp: string;
  }> {
    const checks: Record<string, any> = {};
    let overallHealthy = true;

    try {
      // 检查数据库连接
      const dbCheck = await this.checkDatabaseHealth();
      checks.database = dbCheck;
      if (!dbCheck.healthy) overallHealthy = false;

      // 检查Redis连接
      const redisCheck = await this.checkRedisHealth();
      checks.redis = redisCheck;
      if (!redisCheck.healthy) overallHealthy = false;

      // 检查队列状态
      const queueCheck = await this.checkQueueHealth();
      checks.queues = queueCheck;
      if (!queueCheck.healthy) overallHealthy = false;

    } catch (error) {
      overallHealthy = false;
      checks.error = error.message;
    }

    return {
      healthy: overallHealthy,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.pool.query('SELECT 1');
      const responseTime = Date.now() - start;
      
      return {
        healthy: true,
        responseTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * 检查Redis健康状态
   */
  private async checkRedisHealth(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.cacheManager.get('health-check');
      const responseTime = Date.now() - start;
      
      return {
        healthy: true,
        responseTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * 检查队列健康状态
   */
  private async checkQueueHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    try {
      const queueStatus = await queueManager.getAllQueueStatus();
      const issues: string[] = [];

      for (const [queueName, status] of Object.entries(queueStatus)) {
        if (status.error) {
          issues.push(`Queue ${queueName} has error: ${status.error}`);
        } else if (status.failed > 100) {
          issues.push(`Queue ${queueName} has too many failed jobs: ${status.failed}`);
        } else if (status.waiting > 1000) {
          issues.push(`Queue ${queueName} has too many waiting jobs: ${status.waiting}`);
        }
      }

      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Queue health check failed: ${error.message}`]
      };
    }
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    // 监控批量操作性能指标
    setInterval(async () => {
      try {
        const stats = await this.collectPerformanceStats();
        logger.debug('Performance stats', { stats });
      } catch (error) {
        logger.error('Performance monitoring failed', { error });
      }
    }, 30 * 60 * 1000); // 30分钟
  }

  /**
   * 收集性能统计信息
   */
  private async collectPerformanceStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    try {
      // 获取队列性能统计
      const queueStatus = await queueManager.getAllQueueStatus();
      stats.queues = queueStatus;

      // 获取内存使用情况
      const memUsage = process.memoryUsage();
      stats.memory = {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      };

      // 获取CPU使用情况
      const cpuUsage = process.cpuUsage();
      stats.cpu = {
        user: cpuUsage.user,
        system: cpuUsage.system
      };

    } catch (error) {
      stats.error = error.message;
    }

    return stats;
  }

  /**
   * 设置错误监控
   */
  private setupErrorMonitoring(): void {
    // 监听未处理的错误
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection in batch workflow system', {
        reason,
        promise,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception in batch workflow system', {
        error: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * 设置资源监控
   */
  private setupResourceMonitoring(): void {
    // 监控内存使用情况
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memUsedMB > 1024) { // 超过1GB内存使用
        logger.warn('High memory usage detected', {
          heapUsed: memUsedMB,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        });
      }
    }, 60 * 1000); // 每分钟检查
  }

  /**
   * 获取系统状态信息
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    version: string;
    uptime: number;
    health: any;
    performance: any;
    queues: any;
  }> {
    return {
      initialized: this.initialized,
      version: '1.0.0',
      uptime: process.uptime(),
      health: await this.performHealthCheck(),
      performance: await this.collectPerformanceStats(),
      queues: await queueManager.getAllQueueStatus()
    };
  }
}

// 导出单例实例
export const batchWorkflowIntegration = BatchWorkflowIntegration.getInstance();

// 导出初始化函数
export async function initializeBatchWorkflowSystem(): Promise<void> {
  await batchWorkflowIntegration.initialize();
}

// 导出关闭函数
export async function shutdownBatchWorkflowSystem(): Promise<void> {
  await batchWorkflowIntegration.shutdown();
}