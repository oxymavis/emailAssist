import { Pool } from 'pg';
import Bull, { Queue, Job } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import { RuleEngineService } from './RuleEngineService';
import { CacheManager } from './CacheManager';

/**
 * 批量操作类型定义
 */
export type BatchOperationType = 
  | 'email_bulk_mark' 
  | 'email_bulk_move' 
  | 'email_bulk_delete' 
  | 'email_bulk_tag'
  | 'rule_apply' 
  | 'rule_batch_enable'
  | 'rule_batch_disable'
  | 'custom';

export type BatchOperationStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'paused';

export interface BatchOperationConfig {
  operationType: BatchOperationType;
  parameters: Record<string, any>;
  options?: {
    batchSize?: number;
    concurrency?: number;
    retryCount?: number;
    retryDelay?: number;
    timeout?: number;
  };
}

export interface BatchOperationItem {
  id: string;
  itemId: string;
  itemType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  resultData?: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
}

export interface BatchOperation {
  id: string;
  userId: string;
  name: string;
  description?: string;
  operationType: BatchOperationType;
  status: BatchOperationStatus;
  priority: number;
  operationConfig: BatchOperationConfig;
  targetItems: string[];
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  executionResults: Record<string, any>;
  errorDetails: Array<{
    itemId: string;
    error: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 邮件批量操作服务
 * 处理各种邮件和规则相关的批量操作任务
 */
export class EmailBatchOperationService {
  private pool: Pool;
  private batchQueue: Queue;
  private cacheManager: CacheManager;

  constructor(pool: Pool, redisConfig: any) {
    this.pool = pool;
    this.cacheManager = new CacheManager(redisConfig);
    
    // 初始化Bull队列
    this.batchQueue = new Bull('email-batch-operations', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupQueueProcessors();
  }

  /**
   * 创建批量操作
   */
  async createBatchOperation(
    userId: string,
    name: string,
    operationType: BatchOperationType,
    targetItems: string[],
    operationConfig: BatchOperationConfig,
    options?: {
      description?: string;
      priority?: number;
      scheduledAt?: Date;
    }
  ): Promise<BatchOperation> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const batchId = uuidv4();
      const now = new Date();
      
      // 估算完成时间（基于经验值）
      const estimatedTimePerItem = this.getEstimatedTimePerItem(operationType);
      const estimatedCompletion = new Date(
        now.getTime() + (targetItems.length * estimatedTimePerItem * 1000)
      );

      // 插入批量操作记录
      const batchResult = await client.query(`
        INSERT INTO batch_operations (
          id, user_id, name, description, operation_type, status, priority,
          operation_config, target_items, total_items, processed_items,
          success_items, failed_items, scheduled_at, estimated_completion,
          execution_results, error_details, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        batchId,
        userId,
        name,
        options?.description || '',
        operationType,
        'pending',
        options?.priority || 5,
        JSON.stringify(operationConfig),
        JSON.stringify(targetItems),
        targetItems.length,
        0,
        0,
        0,
        options?.scheduledAt || null,
        estimatedCompletion,
        JSON.stringify({}),
        JSON.stringify([]),
        now,
        now
      ]);

      // 插入操作项目记录
      for (let i = 0; i < targetItems.length; i++) {
        const itemId = targetItems[i];
        await client.query(`
          INSERT INTO batch_operation_items (
            batch_operation_id, item_id, item_type, status, retry_count, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          batchId,
          itemId,
          this.getItemTypeFromOperation(operationType),
          'pending',
          0,
          now,
          now
        ]);
      }

      await client.query('COMMIT');

      const batchOperation = this.mapRowToBatchOperation(batchResult.rows[0]);

      // 如果没有指定调度时间，立即加入队列
      if (!options?.scheduledAt) {
        await this.enqueueBatchOperation(batchOperation);
      }

      logger.info('Email batch operation created', {
        batchId: batchOperation.id,
        userId,
        operationType,
        itemCount: targetItems.length
      });

      return batchOperation;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create email batch operation', { error, userId, operationType });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取批量操作详情
   */
  async getBatchOperation(batchId: string, userId: string): Promise<BatchOperation | null> {
    const result = await this.pool.query(`
      SELECT * FROM batch_operations 
      WHERE id = $1 AND user_id = $2
    `, [batchId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBatchOperation(result.rows[0]);
  }

  /**
   * 获取用户的批量操作列表
   */
  async getUserBatchOperations(
    userId: string,
    options?: {
      status?: BatchOperationStatus;
      operationType?: BatchOperationType;
      page?: number;
      limit?: number;
    }
  ): Promise<{ operations: BatchOperation[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.operationType) {
      whereClause += ` AND operation_type = $${paramIndex}`;
      params.push(options.operationType);
      paramIndex++;
    }

    // 获取总数
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total FROM batch_operations ${whereClause}
    `, params);

    // 获取数据
    const result = await this.pool.query(`
      SELECT * FROM batch_operations ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      operations: result.rows.map(row => this.mapRowToBatchOperation(row)),
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * 取消批量操作
   */
  async cancelBatchOperation(batchId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 更新操作状态
      const result = await client.query(`
        UPDATE batch_operations 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running', 'paused')
        RETURNING id
      `, [batchId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Batch operation not found or cannot be cancelled');
      }

      // 取消队列中的任务
      await this.cancelQueueJob(batchId);

      // 更新未处理项目状态
      await client.query(`
        UPDATE batch_operation_items 
        SET status = 'skipped', updated_at = NOW()
        WHERE batch_operation_id = $1 AND status IN ('pending', 'processing')
      `, [batchId]);

      await client.query('COMMIT');

      logger.info('Email batch operation cancelled', { batchId, userId });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cancel email batch operation', { error, batchId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取批量操作统计信息
   */
  async getBatchOperationStats(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalOperations: number;
    completedOperations: number;
    failedOperations: number;
    runningOperations: number;
    totalItemsProcessed: number;
    averageSuccessRate: number;
    operationsByType: Record<BatchOperationType, number>;
    recentOperations: Array<{
      id: string;
      name: string;
      operationType: BatchOperationType;
      status: BatchOperationStatus;
      completedAt?: Date;
    }>;
  }> {
    const timeCondition = timeRange ? 
      'AND created_at BETWEEN $2 AND $3' : '';
    const timeParams = timeRange ? [timeRange.start, timeRange.end] : [];

    // 获取基础统计
    const statsResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_operations,
        SUM(processed_items) as total_items_processed,
        AVG(CASE WHEN processed_items > 0 THEN success_items::float / processed_items ELSE 0 END) as avg_success_rate
      FROM batch_operations 
      WHERE user_id = $1 ${timeCondition}
    `, [userId, ...timeParams]);

    // 获取按类型统计
    const typeResult = await this.pool.query(`
      SELECT operation_type, COUNT(*) as count
      FROM batch_operations 
      WHERE user_id = $1 ${timeCondition}
      GROUP BY operation_type
    `, [userId, ...timeParams]);

    // 获取最近操作
    const recentResult = await this.pool.query(`
      SELECT id, name, operation_type, status, completed_at
      FROM batch_operations 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);

    const stats = statsResult.rows[0];
    const operationsByType: Record<BatchOperationType, number> = {};
    
    typeResult.rows.forEach(row => {
      operationsByType[row.operation_type as BatchOperationType] = parseInt(row.count);
    });

    return {
      totalOperations: parseInt(stats.total_operations),
      completedOperations: parseInt(stats.completed_operations),
      failedOperations: parseInt(stats.failed_operations),
      runningOperations: parseInt(stats.running_operations),
      totalItemsProcessed: parseInt(stats.total_items_processed || '0'),
      averageSuccessRate: parseFloat(stats.avg_success_rate || '0') * 100,
      operationsByType,
      recentOperations: recentResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        operationType: row.operation_type,
        status: row.status,
        completedAt: row.completed_at
      }))
    };
  }

  /**
   * 设置队列处理器
   */
  private setupQueueProcessors(): void {
    // 批量操作主处理器
    this.batchQueue.process('process-batch', 5, async (job: Job) => {
      const { batchId } = job.data;
      await this.processBatchOperation(batchId);
    });

    // 队列事件监听
    this.batchQueue.on('completed', (job: Job) => {
      logger.info('Email batch operation job completed', { 
        jobId: job.id, 
        batchId: job.data.batchId 
      });
    });

    this.batchQueue.on('failed', (job: Job, err: Error) => {
      logger.error('Email batch operation job failed', { 
        jobId: job.id, 
        batchId: job.data.batchId, 
        error: err.message 
      });
    });
  }

  /**
   * 处理批量操作
   */
  private async processBatchOperation(batchId: string): Promise<void> {
    const client = await this.pool.connect();
    let batchOperation: BatchOperation | null = null;
    
    try {
      // 获取批量操作信息
      const batchResult = await client.query(`
        SELECT * FROM batch_operations WHERE id = $1
      `, [batchId]);

      if (batchResult.rows.length === 0) {
        throw new Error('Batch operation not found');
      }

      batchOperation = this.mapRowToBatchOperation(batchResult.rows[0]);

      // 检查状态
      if (batchOperation.status === 'cancelled') {
        logger.info('Email batch operation was cancelled', { batchId });
        return;
      }

      // 更新状态为运行中
      await client.query(`
        UPDATE batch_operations 
        SET status = 'running', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [batchId]);

      logger.info('Starting email batch operation processing', {
        batchId,
        operationType: batchOperation.operationType,
        totalItems: batchOperation.totalItems
      });

      // 获取待处理项目
      const itemsResult = await client.query(`
        SELECT * FROM batch_operation_items 
        WHERE batch_operation_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
      `, [batchId]);

      const items = itemsResult.rows;
      const batchSize = batchOperation.operationConfig.options?.batchSize || 10;
      const concurrency = batchOperation.operationConfig.options?.concurrency || 3;

      // 分批处理项目
      for (let i = 0; i < items.length; i += batchSize) {
        // 检查操作是否被取消或暂停
        const statusCheck = await client.query(`
          SELECT status FROM batch_operations WHERE id = $1
        `, [batchId]);
        
        if (statusCheck.rows[0].status === 'cancelled') {
          logger.info('Email batch operation cancelled during processing', { batchId });
          return;
        }
        
        if (statusCheck.rows[0].status === 'paused') {
          logger.info('Email batch operation paused during processing', { batchId });
          return;
        }

        const batch = items.slice(i, i + batchSize);
        
        // 并发处理当前批次
        const promises = batch.map(item => 
          this.processItem(batchId, item, batchOperation.operationType, batchOperation.operationConfig)
        );
        
        // 限制并发数
        for (let j = 0; j < promises.length; j += concurrency) {
          const concurrentBatch = promises.slice(j, j + concurrency);
          await Promise.allSettled(concurrentBatch);
        }

        // 更新进度
        await this.updateBatchProgress(batchId);
      }

      // 标记完成
      await this.completeBatchOperation(batchId);

    } catch (error) {
      logger.error('Email batch operation processing failed', { error, batchId });
      
      if (batchOperation) {
        await this.failBatchOperation(batchId, error.message);
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 处理单个项目
   */
  private async processItem(
    batchId: string,
    item: any,
    operationType: BatchOperationType,
    config: BatchOperationConfig
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // 更新项目状态为处理中
      await client.query(`
        UPDATE batch_operation_items 
        SET status = 'processing', processing_started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [item.id]);

      const startTime = Date.now();
      let result: any = null;
      let success = true;
      let errorMessage: string | null = null;

      try {
        // 根据操作类型执行相应的处理逻辑
        switch (operationType) {
          case 'email_bulk_mark':
            result = await this.processEmailMarkOperation(item.item_id, config);
            break;
          case 'email_bulk_move':
            result = await this.processEmailMoveOperation(item.item_id, config);
            break;
          case 'email_bulk_delete':
            result = await this.processEmailDeleteOperation(item.item_id, config);
            break;
          case 'email_bulk_tag':
            result = await this.processEmailTagOperation(item.item_id, config);
            break;
          case 'rule_apply':
            result = await this.processRuleApplyOperation(item.item_id, config);
            break;
          case 'rule_batch_enable':
            result = await this.processRuleEnableOperation(item.item_id, config);
            break;
          case 'rule_batch_disable':
            result = await this.processRuleDisableOperation(item.item_id, config);
            break;
          case 'custom':
            result = await this.processCustomOperation(item.item_id, config);
            break;
          default:
            throw new Error(`Unsupported operation type: ${operationType}`);
        }
      } catch (error) {
        success = false;
        errorMessage = error.message;
        logger.error('Item processing failed', {
          batchId,
          itemId: item.item_id,
          operationType,
          error: error.message
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 更新项目处理结果
      await client.query(`
        UPDATE batch_operation_items 
        SET 
          status = $1,
          processing_completed_at = NOW(),
          processing_duration_ms = $2,
          result_data = $3,
          error_message = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [
        success ? 'completed' : 'failed',
        duration,
        JSON.stringify(result || {}),
        errorMessage,
        item.id
      ]);

    } catch (error) {
      logger.error('Failed to process batch item', {
        error,
        batchId,
        itemId: item.item_id
      });
      
      // 标记项目为失败
      await client.query(`
        UPDATE batch_operation_items 
        SET 
          status = 'failed',
          error_message = $1,
          processing_completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [error.message, item.id]);
      
    } finally {
      client.release();
    }
  }

  /**
   * 处理邮件标记操作
   */
  private async processEmailMarkOperation(emailId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    // 这里应该调用邮件服务的API来标记邮件
    // 暂时返回模拟结果
    return {
      emailId,
      operation: 'mark_as_read',
      status: parameters.isRead ? 'read' : 'unread',
      success: true
    };
  }

  /**
   * 处理邮件移动操作
   */
  private async processEmailMoveOperation(emailId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    // 这里应该调用邮件服务的API来移动邮件
    return {
      emailId,
      operation: 'move_to_folder',
      targetFolder: parameters.folderId,
      success: true
    };
  }

  /**
   * 处理邮件删除操作
   */
  private async processEmailDeleteOperation(emailId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    // 这里应该调用邮件服务的API来删除邮件
    return {
      emailId,
      operation: 'delete',
      permanent: parameters.permanent || false,
      success: true
    };
  }

  /**
   * 处理邮件标签操作
   */
  private async processEmailTagOperation(emailId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    // 这里应该调用邮件服务的API来添加标签
    return {
      emailId,
      operation: 'add_tags',
      tags: parameters.tags,
      success: true
    };
  }

  /**
   * 处理规则应用操作
   */
  private async processRuleApplyOperation(emailId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    // 这里应该调用规则引擎来应用规则
    return {
      emailId,
      operation: 'apply_rules',
      appliedRules: parameters.ruleIds || [],
      success: true
    };
  }

  /**
   * 处理规则启用操作
   */
  private async processRuleEnableOperation(ruleId: string, config: BatchOperationConfig): Promise<any> {
    return {
      ruleId,
      operation: 'enable_rule',
      success: true
    };
  }

  /**
   * 处理规则禁用操作
   */
  private async processRuleDisableOperation(ruleId: string, config: BatchOperationConfig): Promise<any> {
    return {
      ruleId,
      operation: 'disable_rule',
      success: true
    };
  }

  /**
   * 处理自定义操作
   */
  private async processCustomOperation(itemId: string, config: BatchOperationConfig): Promise<any> {
    const { parameters } = config;
    
    return {
      itemId,
      operation: 'custom',
      customType: parameters.customType,
      success: true
    };
  }

  /**
   * 更新批量操作进度
   */
  private async updateBatchProgress(batchId: string): Promise<void> {
    await this.pool.query(`
      UPDATE batch_operations 
      SET 
        processed_items = (
          SELECT COUNT(*) 
          FROM batch_operation_items 
          WHERE batch_operation_id = $1 AND status IN ('completed', 'failed')
        ),
        success_items = (
          SELECT COUNT(*) 
          FROM batch_operation_items 
          WHERE batch_operation_id = $1 AND status = 'completed'
        ),
        failed_items = (
          SELECT COUNT(*) 
          FROM batch_operation_items 
          WHERE batch_operation_id = $1 AND status = 'failed'
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [batchId]);
  }

  /**
   * 完成批量操作
   */
  private async completeBatchOperation(batchId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 获取最终统计
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as success,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM batch_operation_items 
        WHERE batch_operation_id = $1
      `, [batchId]);

      const stats = statsResult.rows[0];

      // 更新批量操作状态
      await client.query(`
        UPDATE batch_operations 
        SET 
          status = 'completed',
          completed_at = NOW(),
          processed_items = $1,
          success_items = $2,
          failed_items = $3,
          execution_results = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [
        parseInt(stats.total),
        parseInt(stats.success),
        parseInt(stats.failed),
        JSON.stringify({
          totalProcessed: parseInt(stats.total),
          successCount: parseInt(stats.success),
          failedCount: parseInt(stats.failed),
          successRate: stats.total > 0 ? (parseInt(stats.success) / parseInt(stats.total)) * 100 : 0,
          completedAt: new Date().toISOString()
        }),
        batchId
      ]);

      await client.query('COMMIT');

      logger.info('Email batch operation completed', {
        batchId,
        totalItems: parseInt(stats.total),
        successItems: parseInt(stats.success),
        failedItems: parseInt(stats.failed)
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 标记批量操作失败
   */
  private async failBatchOperation(batchId: string, errorMessage: string): Promise<void> {
    await this.pool.query(`
      UPDATE batch_operations 
      SET 
        status = 'failed',
        completed_at = NOW(),
        error_details = jsonb_set(
          COALESCE(error_details, '[]'::jsonb),
          '{-1}',
          jsonb_build_object(
            'error', $2,
            'timestamp', to_jsonb(NOW())
          )
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [batchId, errorMessage]);

    logger.error('Email batch operation marked as failed', { batchId, errorMessage });
  }

  /**
   * 将批量操作加入队列
   */
  private async enqueueBatchOperation(batchOperation: BatchOperation): Promise<void> {
    const jobOptions: any = {
      priority: -batchOperation.priority,
      delay: 0
    };

    if (batchOperation.scheduledAt) {
      jobOptions.delay = batchOperation.scheduledAt.getTime() - Date.now();
    }

    await this.batchQueue.add('process-batch', {
      batchId: batchOperation.id,
      userId: batchOperation.userId,
      operationType: batchOperation.operationType
    }, jobOptions);

    logger.info('Email batch operation enqueued', {
      batchId: batchOperation.id,
      priority: batchOperation.priority,
      delay: jobOptions.delay
    });
  }

  /**
   * 取消队列中的任务
   */
  private async cancelQueueJob(batchId: string): Promise<void> {
    const jobs = await this.batchQueue.getJobs(['waiting', 'delayed', 'active']);
    
    for (const job of jobs) {
      if (job.data.batchId === batchId) {
        await job.remove();
        logger.info('Queue job cancelled', { jobId: job.id, batchId });
      }
    }
  }

  /**
   * 获取操作类型对应的项目类型
   */
  private getItemTypeFromOperation(operationType: BatchOperationType): string {
    switch (operationType) {
      case 'email_bulk_mark':
      case 'email_bulk_move':
      case 'email_bulk_delete':
      case 'email_bulk_tag':
        return 'email';
      case 'rule_apply':
      case 'rule_batch_enable':
      case 'rule_batch_disable':
        return 'rule';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取每个项目的预估处理时间（秒）
   */
  private getEstimatedTimePerItem(operationType: BatchOperationType): number {
    switch (operationType) {
      case 'email_bulk_mark':
        return 0.1;
      case 'email_bulk_move':
        return 0.5;
      case 'email_bulk_delete':
        return 0.3;
      case 'email_bulk_tag':
        return 0.2;
      case 'rule_apply':
        return 2.0;
      case 'rule_batch_enable':
      case 'rule_batch_disable':
        return 0.1;
      default:
        return 1.0;
    }
  }

  /**
   * 将数据库行映射为BatchOperation对象
   */
  private mapRowToBatchOperation(row: any): BatchOperation {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      operationType: row.operation_type,
      status: row.status,
      priority: row.priority,
      operationConfig: row.operation_config,
      targetItems: row.target_items,
      totalItems: row.total_items,
      processedItems: row.processed_items,
      successItems: row.success_items,
      failedItems: row.failed_items,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      estimatedCompletion: row.estimated_completion,
      executionResults: row.execution_results,
      errorDetails: row.error_details,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.batchQueue.getJobCounts();
    return counts;
  }
}