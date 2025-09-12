/**
 * Batch Operation Service
 * 批量操作服务，提供高性能的批量数据处理能力
 */

import DatabaseManager from '@/config/database';
import DatabaseMonitor from './DatabaseMonitor';
import logger from '@/utils/logger';
import { Pool, PoolClient } from 'pg';

export interface BatchOperation<T> {
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  table: string;
  data: T[];
  conflictColumns?: string[];
  updateColumns?: string[];
  batchSize?: number;
}

export interface BatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  duration: number;
}

export interface TransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class BatchOperationService {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  private monitor = DatabaseMonitor;
  private readonly DEFAULT_BATCH_SIZE = 1000;
  private readonly MAX_BATCH_SIZE = 5000;

  constructor() {}

  /**
   * 批量插入数据
   */
  async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    options: {
      batchSize?: number;
      onConflict?: 'IGNORE' | 'UPDATE' | 'ERROR';
      conflictColumns?: string[];
      updateColumns?: string[];
    } = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const batchSize = Math.min(options.batchSize || this.DEFAULT_BATCH_SIZE, this.MAX_BATCH_SIZE);
    
    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    try {
      // 分批处理数据
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          const result = await this.processBatchInsert(table, batch, options);
          successful += result.rowCount || 0;
          totalProcessed += batch.length;
        } catch (error) {
          failed += batch.length;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Batch insert failed for batch starting at index ${i}`, { error, table });
        }
      }

      const duration = Date.now() - startTime;
      
      // 记录性能指标
      this.monitor.recordQuery(
        `BATCH INSERT INTO ${table}`,
        duration,
        failed === 0,
        failed > 0 ? `${failed} items failed` : undefined
      );

      logger.info('Batch insert completed', {
        table,
        totalProcessed,
        successful,
        failed,
        duration,
        batchSize
      });

      return {
        totalProcessed,
        successful,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitor.recordQuery(`BATCH INSERT INTO ${table}`, duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 批量更新数据
   */
  async batchUpdate<T extends Record<string, any>>(
    table: string,
    data: Array<T & { id: string }>,
    updateColumns: string[],
    options: {
      batchSize?: number;
      whereConditions?: string[];
    } = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const batchSize = Math.min(options.batchSize || this.DEFAULT_BATCH_SIZE, this.MAX_BATCH_SIZE);
    
    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    try {
      // 分批处理数据
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          const result = await this.processBatchUpdate(table, batch, updateColumns, options);
          successful += result.rowCount || 0;
          totalProcessed += batch.length;
        } catch (error) {
          failed += batch.length;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Batch update failed for batch starting at index ${i}`, { error, table });
        }
      }

      const duration = Date.now() - startTime;
      
      this.monitor.recordQuery(
        `BATCH UPDATE ${table}`,
        duration,
        failed === 0,
        failed > 0 ? `${failed} items failed` : undefined
      );

      return {
        totalProcessed,
        successful,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitor.recordQuery(`BATCH UPDATE ${table}`, duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 批量删除数据
   */
  async batchDelete(
    table: string,
    ids: string[],
    options: {
      batchSize?: number;
      softDelete?: boolean;
      deletedAtColumn?: string;
    } = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const batchSize = Math.min(options.batchSize || this.DEFAULT_BATCH_SIZE, this.MAX_BATCH_SIZE);
    
    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    try {
      // 分批处理数据
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        try {
          const result = await this.processBatchDelete(table, batch, options);
          successful += result.rowCount || 0;
          totalProcessed += batch.length;
        } catch (error) {
          failed += batch.length;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Batch delete failed for batch starting at index ${i}`, { error, table });
        }
      }

      const duration = Date.now() - startTime;
      
      this.monitor.recordQuery(
        `BATCH DELETE FROM ${table}`,
        duration,
        failed === 0,
        failed > 0 ? `${failed} items failed` : undefined
      );

      return {
        totalProcessed,
        successful,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitor.recordQuery(`BATCH DELETE FROM ${table}`, duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 执行事务操作
   */
  async executeTransaction<T>(
    operations: Array<(client: PoolClient) => Promise<any>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    let attempts = 0;
    const maxAttempts = options.retryAttempts || 3;
    const retryDelay = options.retryDelay || 1000;

    while (attempts < maxAttempts) {
      try {
        await client.query('BEGIN');
        
        // 设置事务隔离级别
        if (options.isolationLevel) {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
        }

        // 设置事务超时
        if (options.timeout) {
          await client.query(`SET statement_timeout = ${options.timeout}`);
        }

        // 执行所有操作
        const results: T[] = [];
        for (const operation of operations) {
          const result = await operation(client);
          results.push(result);
        }

        await client.query('COMMIT');
        
        const duration = Date.now() - startTime;
        this.monitor.recordQuery('TRANSACTION', duration, true);
        
        logger.info('Transaction completed successfully', {
          operations: operations.length,
          attempts: attempts + 1,
          duration
        });

        return results;

      } catch (error) {
        await client.query('ROLLBACK');
        attempts++;

        const duration = Date.now() - startTime;
        this.monitor.recordQuery('TRANSACTION', duration, false, error instanceof Error ? error.message : 'Unknown error');

        if (attempts >= maxAttempts) {
          logger.error('Transaction failed after max attempts', {
            attempts,
            error,
            operations: operations.length
          });
          throw error;
        }

        // 等待后重试
        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
        }

        logger.warn(`Transaction attempt ${attempts} failed, retrying...`, { error });
      }
    }

    throw new Error('Transaction failed after all retry attempts');
  }

  /**
   * 批量执行查询（用于读取操作）
   */
  async batchQuery<T>(
    queries: Array<{ text: string; values?: any[] }>,
    options: {
      parallel?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<T[][]> {
    const startTime = Date.now();
    
    try {
      let results: T[][];
      
      if (options.parallel) {
        // 并行执行查询
        const maxConcurrent = options.maxConcurrent || 10;
        results = await this.executeQueriesParallel(queries, maxConcurrent);
      } else {
        // 串行执行查询
        results = await this.executeQueriesSerial(queries);
      }

      const duration = Date.now() - startTime;
      this.monitor.recordQuery('BATCH QUERY', duration, true);

      logger.debug('Batch query completed', {
        queryCount: queries.length,
        parallel: options.parallel,
        duration
      });

      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitor.recordQuery('BATCH QUERY', duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 处理批量插入
   */
  private async processBatchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    options: any
  ): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      if (data.length === 0) return { rowCount: 0 };

      const columns = Object.keys(data[0]);
      const values = data.map(row => columns.map(col => row[col]));
      
      // 构建VALUES子句
      const placeholders = values.map((_, index) => {
        const rowPlaceholders = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
        return `(${rowPlaceholders.join(', ')})`;
      }).join(', ');

      // 构建冲突处理子句
      let conflictClause = '';
      if (options.onConflict === 'IGNORE') {
        conflictClause = 'ON CONFLICT DO NOTHING';
      } else if (options.onConflict === 'UPDATE' && options.conflictColumns && options.updateColumns) {
        const updateSets = options.updateColumns.map((col: string) => `${col} = EXCLUDED.${col}`);
        conflictClause = `ON CONFLICT (${options.conflictColumns.join(', ')}) DO UPDATE SET ${updateSets.join(', ')}`;
      }

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
        ${conflictClause}
      `;

      const flatValues = values.flat();
      return await client.query(query, flatValues);

    } finally {
      client.release();
    }
  }

  /**
   * 处理批量更新
   */
  private async processBatchUpdate<T extends Record<string, any>>(
    table: string,
    data: Array<T & { id: string }>,
    updateColumns: string[],
    options: any
  ): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      if (data.length === 0) return { rowCount: 0 };

      // 构建临时值表
      const valueRows = data.map((row, index) => {
        const values = ['id', ...updateColumns].map(col => `$${index * (updateColumns.length + 1) + ['id', ...updateColumns].indexOf(col) + 1}`);
        return `(${values.join(', ')})`;
      }).join(', ');

      // 构建UPDATE语句
      const updateSets = updateColumns.map(col => `${col} = v.${col}`);
      const query = `
        UPDATE ${table}
        SET ${updateSets.join(', ')}
        FROM (VALUES ${valueRows}) AS v(id, ${updateColumns.join(', ')})
        WHERE ${table}.id = v.id::uuid
      `;

      const flatValues = data.flatMap(row => [row.id, ...updateColumns.map(col => row[col])]);
      return await client.query(query, flatValues);

    } finally {
      client.release();
    }
  }

  /**
   * 处理批量删除
   */
  private async processBatchDelete(
    table: string,
    ids: string[],
    options: any
  ): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      if (ids.length === 0) return { rowCount: 0 };

      let query: string;
      if (options.softDelete && options.deletedAtColumn) {
        // 软删除
        query = `
          UPDATE ${table}
          SET ${options.deletedAtColumn} = CURRENT_TIMESTAMP
          WHERE id = ANY($1) AND ${options.deletedAtColumn} IS NULL
        `;
      } else {
        // 硬删除
        query = `DELETE FROM ${table} WHERE id = ANY($1)`;
      }

      return await client.query(query, [ids]);

    } finally {
      client.release();
    }
  }

  /**
   * 并行执行查询
   */
  private async executeQueriesParallel<T>(
    queries: Array<{ text: string; values?: any[] }>,
    maxConcurrent: number
  ): Promise<T[][]> {
    const results: T[][] = [];
    
    // 分批并行执行
    for (let i = 0; i < queries.length; i += maxConcurrent) {
      const batch = queries.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (query, index) => {
        const client = await this.pool.connect();
        try {
          const result = await client.query(query.text, query.values);
          return { index: i + index, data: result.rows };
        } finally {
          client.release();
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        results[result.index] = result.data;
      });
    }

    return results;
  }

  /**
   * 串行执行查询
   */
  private async executeQueriesSerial<T>(
    queries: Array<{ text: string; values?: any[] }>
  ): Promise<T[][]> {
    const results: T[][] = [];
    const client = await this.pool.connect();
    
    try {
      for (const query of queries) {
        const result = await client.query(query.text, query.values);
        results.push(result.rows);
      }
    } finally {
      client.release();
    }

    return results;
  }
}

export default new BatchOperationService();