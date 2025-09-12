/**
 * Database Migration Manager
 * 数据库迁移管理器，用于执行数据库架构更新和性能优化
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import logger from '@/utils/logger';
import path from 'path';
import fs from 'fs';

export interface Migration {
  id: string;
  name: string;
  description: string;
  sql: string;
  executedAt?: Date;
  rollbackSql?: string;
}

export class MigrationManager {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  constructor() {}

  /**
   * 初始化迁移表
   */
  async initializeMigrationsTable(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64)
        )
      `);
      
      logger.info('Migrations table initialized');
    } catch (error) {
      logger.error('Failed to initialize migrations table', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行性能优化迁移
   */
  async runPerformanceOptimizations(): Promise<void> {
    const migrations: Migration[] = [
      {
        id: '001_performance_indexes',
        name: 'Performance Indexes',
        description: '创建高性能索引以优化查询性能',
        sql: await this.loadSQLFile('database-schema.sql')
      },
      {
        id: '002_materialized_views',
        name: 'Materialized Views',
        description: '创建物化视图以提升报告生成性能',
        sql: this.getMaterializedViewsSQL()
      },
      {
        id: '003_partitioning',
        name: 'Table Partitioning',
        description: '为大表创建分区以提升性能',
        sql: this.getPartitioningSQL()
      }
    ];

    await this.initializeMigrationsTable();

    for (const migration of migrations) {
      await this.executeMigration(migration);
    }
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // 检查迁移是否已执行
      const result = await client.query(
        'SELECT id FROM migrations WHERE id = $1',
        [migration.id]
      );

      if (result.rows.length > 0) {
        logger.info(`Migration ${migration.id} already executed, skipping`);
        return;
      }

      logger.info(`Executing migration: ${migration.name}`);
      
      // 开始事务
      await client.query('BEGIN');
      
      // 执行迁移SQL
      await client.query(migration.sql);
      
      // 记录迁移
      await client.query(
        `INSERT INTO migrations (id, name, description) VALUES ($1, $2, $3)`,
        [migration.id, migration.name, migration.description]
      );
      
      // 提交事务
      await client.query('COMMIT');
      
      logger.info(`Migration ${migration.id} executed successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${migration.id} failed`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 加载SQL文件
   */
  private async loadSQLFile(filename: string): Promise<string> {
    const filePath = path.join(__dirname, filename);
    
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to load SQL file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 获取物化视图SQL
   */
  private getMaterializedViewsSQL(): string {
    return `
      -- 刷新物化视图的函数
      CREATE OR REPLACE FUNCTION refresh_materialized_views() 
      RETURNS VOID AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_statistics;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_analysis_statistics;
      END;
      $$ LANGUAGE plpgsql;

      -- 创建定时刷新物化视图的作业（需要pg_cron扩展）
      -- SELECT cron.schedule('refresh-stats', '0 1 * * *', 'SELECT refresh_materialized_views();');
    `;
  }

  /**
   * 获取分区SQL
   */
  private getPartitioningSQL(): string {
    return `
      -- 为大表创建按日期分区（如果数据量很大）
      -- 注意：这需要在生产环境中谨慎执行，可能需要停机时间

      -- 创建分区表函数
      CREATE OR REPLACE FUNCTION create_monthly_partitions(
        table_name TEXT,
        start_date DATE,
        end_date DATE
      ) RETURNS VOID AS $$
      DECLARE
        partition_date DATE;
        partition_name TEXT;
        partition_start DATE;
        partition_end DATE;
      BEGIN
        partition_date := DATE_TRUNC('month', start_date);
        
        WHILE partition_date <= end_date LOOP
          partition_name := table_name || '_' || TO_CHAR(partition_date, 'YYYY_MM');
          partition_start := partition_date;
          partition_end := partition_date + INTERVAL '1 month';
          
          -- 创建分区表
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, table_name, partition_start, partition_end
          );
          
          partition_date := partition_date + INTERVAL '1 month';
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;

      -- 如果需要，可以为email_messages表创建分区
      -- 注意：这是一个重大变更，需要在维护窗口期间执行
      /*
      -- 1. 重命名原表
      ALTER TABLE email_messages RENAME TO email_messages_old;
      
      -- 2. 创建分区表
      CREATE TABLE email_messages (
        LIKE email_messages_old INCLUDING ALL
      ) PARTITION BY RANGE (received_at);
      
      -- 3. 创建分区
      SELECT create_monthly_partitions('email_messages', '2024-01-01'::DATE, '2025-12-31'::DATE);
      
      -- 4. 迁移数据
      INSERT INTO email_messages SELECT * FROM email_messages_old;
      
      -- 5. 删除旧表（在确认数据正确后）
      -- DROP TABLE email_messages_old;
      */
    `;
  }

  /**
   * 优化数据库配置
   */
  async optimizeDatabaseSettings(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // 获取当前数据库配置
      const configs = [
        { name: 'shared_buffers', recommended: '256MB' },
        { name: 'effective_cache_size', recommended: '1GB' },
        { name: 'work_mem', recommended: '4MB' },
        { name: 'maintenance_work_mem', recommended: '64MB' },
        { name: 'checkpoint_completion_target', recommended: '0.9' },
        { name: 'wal_buffers', recommended: '16MB' },
        { name: 'default_statistics_target', recommended: '100' },
        { name: 'random_page_cost', recommended: '1.1' },
        { name: 'effective_io_concurrency', recommended: '2' }
      ];

      logger.info('Current database configuration:');
      
      for (const config of configs) {
        const result = await client.query(
          'SELECT name, setting, unit FROM pg_settings WHERE name = $1',
          [config.name]
        );
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const currentValue = row.unit ? `${row.setting}${row.unit}` : row.setting;
          logger.info(`${config.name}: ${currentValue} (recommended: ${config.recommended})`);
        }
      }
      
      logger.info('To optimize performance, consider adjusting these settings in postgresql.conf');
      
    } catch (error) {
      logger.error('Failed to analyze database configuration', error);
    } finally {
      client.release();
    }
  }

  /**
   * 分析查询性能
   */
  async analyzeQueryPerformance(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // 检查慢查询
      const slowQueries = await client.query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time,
          stddev_time
        FROM pg_stat_statements 
        WHERE mean_time > 100
        ORDER BY mean_time DESC 
        LIMIT 10
      `);

      if (slowQueries.rows.length > 0) {
        logger.info('Top slow queries:');
        slowQueries.rows.forEach((row, index) => {
          logger.info(`${index + 1}. Mean time: ${row.mean_time}ms, Calls: ${row.calls}`);
          logger.info(`   Query: ${row.query.substring(0, 100)}...`);
        });
      }

      // 检查未使用的索引
      const unusedIndexes = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY schemaname, tablename, indexname
      `);

      if (unusedIndexes.rows.length > 0) {
        logger.info('Unused indexes (consider removing):');
        unusedIndexes.rows.forEach((row) => {
          logger.info(`- ${row.schemaname}.${row.tablename}.${row.indexname}`);
        });
      }

      // 检查表统计信息
      const tableStats = await client.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_live_tup,
          n_dead_tup,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
      `);

      logger.info('Table statistics:');
      tableStats.rows.forEach((row) => {
        logger.info(`${row.tablename}: ${row.n_live_tup} live tuples, ${row.n_dead_tup} dead tuples`);
        if (row.last_analyze) {
          logger.info(`  Last analyze: ${row.last_analyze}`);
        }
      });

    } catch (error) {
      logger.error('Failed to analyze query performance', error);
    } finally {
      client.release();
    }
  }

  /**
   * 刷新物化视图
   */
  async refreshMaterializedViews(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      logger.info('Refreshing materialized views...');
      
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_statistics');
      logger.info('Refreshed mv_email_statistics');
      
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_analysis_statistics');
      logger.info('Refreshed mv_analysis_statistics');
      
      logger.info('All materialized views refreshed successfully');
      
    } catch (error) {
      logger.error('Failed to refresh materialized views', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取数据库性能指标
   */
  async getPerformanceMetrics(): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      // 连接池状态
      const poolStats = {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount
      };

      // 数据库大小
      const dbSize = await client.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_database_size(current_database()) as db_size_bytes
      `);

      // 表大小
      const tableSizes = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      // 活跃连接
      const activeConnections = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      return {
        pool: poolStats,
        database: {
          size: dbSize.rows[0].db_size,
          sizeBytes: parseInt(dbSize.rows[0].db_size_bytes)
        },
        tables: tableSizes.rows,
        connections: activeConnections.rows[0],
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to get performance metrics', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

// 导出单例实例
export default new MigrationManager();