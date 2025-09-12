#!/usr/bin/env ts-node

/**
 * Performance Optimization Initialization Script
 * 性能优化初始化脚本，一键部署所有性能优化配置
 */

import DatabaseManager from '@/config/database';
import MigrationManager from '@/config/migrations';
import PerformanceMonitorService from '@/services/PerformanceMonitorService';
import CacheManager from '@/services/CacheManager';
import logger from '@/utils/logger';
import { Command } from 'commander';

interface InitializationOptions {
  skipMigrations?: boolean;
  skipMonitoring?: boolean;
  skipCache?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

class PerformanceOptimizationInitializer {
  private options: InitializationOptions;

  constructor(options: InitializationOptions = {}) {
    this.options = options;
  }

  /**
   * 执行完整的性能优化初始化
   */
  async initialize(): Promise<void> {
    logger.info('Starting Email Assist performance optimization initialization', {
      options: this.options
    });

    try {
      // 1. 初始化数据库连接
      await this.initializeDatabase();

      // 2. 执行数据库迁移和索引创建
      if (!this.options.skipMigrations) {
        await this.runMigrations();
      }

      // 3. 初始化缓存系统
      if (!this.options.skipCache) {
        await this.initializeCache();
      }

      // 4. 启动性能监控
      if (!this.options.skipMonitoring) {
        await this.startMonitoring();
      }

      // 5. 验证优化效果
      await this.validateOptimizations();

      logger.info('Performance optimization initialization completed successfully');

    } catch (error) {
      logger.error('Performance optimization initialization failed', error);
      throw error;
    }
  }

  /**
   * 初始化数据库连接
   */
  private async initializeDatabase(): Promise<void> {
    logger.info('Initializing database connection...');

    try {
      await DatabaseManager.initialize();
      
      // 测试连接
      const isHealthy = await DatabaseManager.healthCheck();
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }

      logger.info('Database connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  /**
   * 执行数据库迁移
   */
  private async runMigrations(): Promise<void> {
    logger.info('Running database migrations and performance optimizations...');

    try {
      if (this.options.dryRun) {
        logger.info('DRY RUN: Would execute database migrations');
        return;
      }

      // 执行性能优化迁移
      await MigrationManager.runPerformanceOptimizations();

      // 分析数据库配置
      await MigrationManager.optimizeDatabaseSettings();

      // 分析查询性能
      await MigrationManager.analyzeQueryPerformance();

      // 刷新物化视图
      await MigrationManager.refreshMaterializedViews();

      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run database migrations', error);
      throw error;
    }
  }

  /**
   * 初始化缓存系统
   */
  private async initializeCache(): Promise<void> {
    logger.info('Initializing cache system...');

    try {
      // 清理旧缓存
      await CacheManager.cleanup();

      // 预热关键数据缓存
      await this.warmupCache();

      logger.info('Cache system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache system', error);
      throw error;
    }
  }

  /**
   * 启动性能监控
   */
  private async startMonitoring(): Promise<void> {
    logger.info('Starting performance monitoring...');

    try {
      // 启动性能监控（每30秒收集一次指标）
      PerformanceMonitorService.startMonitoring(30000);

      // 设置监控事件监听器
      this.setupMonitoringListeners();

      logger.info('Performance monitoring started successfully');
    } catch (error) {
      logger.error('Failed to start performance monitoring', error);
      throw error;
    }
  }

  /**
   * 预热缓存
   */
  private async warmupCache(): Promise<void> {
    logger.info('Warming up cache...');

    try {
      const warmupEntries = [
        {
          key: 'system:config',
          fetchCallback: async () => ({ initialized: true, timestamp: new Date() }),
          config: { ttl: 3600, tags: ['system'] }
        }
        // 可以添加更多预热数据
      ];

      await CacheManager.warmup(warmupEntries);

      logger.info('Cache warmup completed');
    } catch (error) {
      logger.warn('Cache warmup failed, but continuing', error);
    }
  }

  /**
   * 设置监控事件监听器
   */
  private setupMonitoringListeners(): void {
    PerformanceMonitorService.on('alert', (alert) => {
      if (alert.level === 'critical') {
        logger.error('CRITICAL PERFORMANCE ALERT', alert);
        // 这里可以添加告警通知逻辑，如发送邮件、Slack消息等
      } else {
        logger.warn('Performance warning', alert);
      }
    });

    PerformanceMonitorService.on('metrics', (metrics) => {
      logger.debug('Performance metrics collected', {
        timestamp: metrics.timestamp,
        dbUtilization: metrics.database.poolUtilization,
        cacheHitRate: metrics.cache.hitRate
      });
    });
  }

  /**
   * 验证优化效果
   */
  private async validateOptimizations(): Promise<void> {
    logger.info('Validating performance optimizations...');

    try {
      // 获取性能指标
      const performanceMetrics = await MigrationManager.getPerformanceMetrics();
      
      logger.info('Performance metrics:', {
        poolConnections: performanceMetrics.pool.totalConnections,
        dbSize: performanceMetrics.database.size,
        tableCount: performanceMetrics.tables.length,
        connectionCount: performanceMetrics.connections
      });

      // 验证索引是否创建成功
      await this.validateIndexes();

      // 验证物化视图是否存在
      await this.validateMaterializedViews();

      // 验证缓存系统是否工作正常
      await this.validateCache();

      logger.info('Performance optimization validation completed successfully');
    } catch (error) {
      logger.error('Performance optimization validation failed', error);
      throw error;
    }
  }

  /**
   * 验证索引
   */
  private async validateIndexes(): Promise<void> {
    const client = await DatabaseManager.getPool().connect();
    
    try {
      const result = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
      `);

      const indexes = result.rows;
      logger.info(`Found ${indexes.length} performance indexes`);

      // 验证关键索引是否存在
      const criticalIndexes = [
        'idx_email_messages_user_received',
        'idx_email_messages_subject_gin',
        'idx_email_analysis_priority_gin',
        'idx_reports_user_status'
      ];

      const missingIndexes = criticalIndexes.filter(indexName =>
        !indexes.some(idx => idx.indexname === indexName)
      );

      if (missingIndexes.length > 0) {
        logger.warn('Missing critical indexes:', missingIndexes);
      } else {
        logger.info('All critical indexes are present');
      }

    } finally {
      client.release();
    }
  }

  /**
   * 验证物化视图
   */
  private async validateMaterializedViews(): Promise<void> {
    const client = await DatabaseManager.getPool().connect();
    
    try {
      const result = await client.query(`
        SELECT 
          schemaname,
          matviewname,
          ispopulated
        FROM pg_matviews
        WHERE schemaname = 'public'
      `);

      const views = result.rows;
      logger.info(`Found ${views.length} materialized views`);

      views.forEach(view => {
        if (!view.ispopulated) {
          logger.warn(`Materialized view ${view.matviewname} is not populated`);
        }
      });

    } finally {
      client.release();
    }
  }

  /**
   * 验证缓存系统
   */
  private async validateCache(): Promise<void> {
    try {
      // 测试缓存读写
      const testKey = 'test:validation';
      const testData = { timestamp: new Date(), test: true };

      await CacheManager.set(testKey, testData, { ttl: 60 });
      const retrievedData = await CacheManager.get(testKey);

      if (!retrievedData || JSON.stringify(retrievedData) !== JSON.stringify(testData)) {
        throw new Error('Cache validation failed: data mismatch');
      }

      // 清理测试数据
      await CacheManager.deleteByPattern('test:*');

      logger.info('Cache system validation successful');
    } catch (error) {
      logger.error('Cache system validation failed', error);
      throw error;
    }
  }

  /**
   * 清理和回滚
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up performance optimization initialization...');

    try {
      // 停止监控
      PerformanceMonitorService.stopMonitoring();

      // 关闭数据库连接
      await DatabaseManager.close();

      logger.info('Cleanup completed successfully');
    } catch (error) {
      logger.error('Cleanup failed', error);
      throw error;
    }
  }
}

// 命令行接口
const program = new Command();

program
  .name('performance-init')
  .description('Initialize Email Assist performance optimizations')
  .version('1.0.0');

program
  .option('--skip-migrations', 'Skip database migrations')
  .option('--skip-monitoring', 'Skip performance monitoring setup')
  .option('--skip-cache', 'Skip cache initialization')
  .option('--force', 'Force initialization even if already initialized')
  .option('--dry-run', 'Show what would be done without executing')
  .action(async (options) => {
    const initializer = new PerformanceOptimizationInitializer(options);
    
    try {
      await initializer.initialize();
      process.exit(0);
    } catch (error) {
      logger.error('Initialization failed:', error);
      await initializer.cleanup();
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate existing performance optimizations')
  .action(async () => {
    const initializer = new PerformanceOptimizationInitializer();
    
    try {
      await initializer.validateOptimizations();
      logger.info('Validation completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up performance optimization resources')
  .action(async () => {
    const initializer = new PerformanceOptimizationInitializer();
    
    try {
      await initializer.cleanup();
      logger.info('Cleanup completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Cleanup failed:', error);
      process.exit(1);
    }
  });

// 如果直接运行此脚本
if (require.main === module) {
  program.parse();
}

export { PerformanceOptimizationInitializer };
export default PerformanceOptimizationInitializer;