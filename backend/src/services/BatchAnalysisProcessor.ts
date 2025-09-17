/**
 * Batch Analysis Processor Service
 * 批量邮件AI分析处理服务 - 优化API调用和避免限流
 */

import DatabaseManager from '@/config/database';
import EmailContentProcessor from './EmailContentProcessor';
import EmailAnalysisCacheModel from '@/models/EmailAnalysisCache';
import logger from '@/utils/logger';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface BatchAnalysisJob {
  id: string;
  user_id?: string;
  account_id?: string;
  message_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  options?: BatchAnalysisOptions;
  error_message?: string;
  estimated_completion?: Date;
}

export interface BatchAnalysisOptions {
  batch_size?: number;
  delay_between_batches?: number; // milliseconds
  max_retries?: number;
  skip_existing_analysis?: boolean;
  analysis_types?: Array<'sentiment' | 'priority' | 'category' | 'entities' | 'summary'>;
  enable_content_processing?: boolean;
  quality_threshold?: number;
}

export interface BatchAnalysisResult {
  job_id: string;
  success: boolean;
  total_processed: number;
  successful_analyses: number;
  failed_analyses: number;
  skipped_analyses: number;
  processing_duration_ms: number;
  average_processing_time_ms: number;
  rate_limit_hits: number;
  error_summary: Record<string, number>;
  quality_metrics: {
    average_confidence: number;
    high_confidence_count: number;
    low_confidence_count: number;
  };
}

export class BatchAnalysisProcessor {
  private static instance: BatchAnalysisProcessor;
  private pool: Pool;
  private contentProcessor: any;
  private analysisModel: EmailAnalysisCacheModel;
  private activeJobs: Map<string, BatchAnalysisJob> = new Map();
  private processingQueue: BatchAnalysisJob[] = [];
  private isProcessing: boolean = false;

  // Rate limiting configuration
  private readonly rateLimitConfig = {
    requests_per_minute: 60,
    requests_per_hour: 1000,
    concurrent_requests: 5,
    backoff_multiplier: 1.5,
    max_backoff_ms: 30000
  };

  private requestCount = {
    current_minute: 0,
    current_hour: 0,
    minute_window: new Date(),
    hour_window: new Date()
  };

  private constructor() {
    this.pool = DatabaseManager.getPool();
    this.contentProcessor = new EmailContentProcessor();
    this.analysisModel = new EmailAnalysisCacheModel();
    
    // 启动队列处理器
    this.startQueueProcessor();
    
    // 启动速率重置定时器
    this.startRateLimitReset();
  }

  public static getInstance(): BatchAnalysisProcessor {
    if (!BatchAnalysisProcessor.instance) {
      BatchAnalysisProcessor.instance = new BatchAnalysisProcessor();
    }
    return BatchAnalysisProcessor.instance;
  }

  /**
   * 创建批量分析任务
   */
  async createBatchJob(
    message_ids: string[],
    options: BatchAnalysisOptions = {},
    user_id?: string,
    account_id?: string
  ): Promise<BatchAnalysisJob> {
    if (message_ids.length === 0) {
      throw new Error('No message IDs provided for batch analysis');
    }

    const jobId = uuidv4();
    
    // 如果启用跳过已分析，则过滤已有分析的邮件
    let finalMessageIds = message_ids;
    if (options.skip_existing_analysis) {
      const existingAnalyses = await this.analysisModel.findByMessageIds(message_ids);
      const existingMessageIds = new Set(existingAnalyses.map(a => a.message_id));
      finalMessageIds = message_ids.filter(id => !existingMessageIds.has(id));
      
      logger.info('Filtered existing analyses', {
        jobId,
        originalCount: message_ids.length,
        filteredCount: finalMessageIds.length,
        skippedCount: message_ids.length - finalMessageIds.length
      });
    }

    if (finalMessageIds.length === 0) {
      throw new Error('All messages already have analysis results');
    }

    const job: BatchAnalysisJob = {
      id: jobId,
      user_id,
      account_id,
      message_ids: finalMessageIds,
      status: 'pending',
      priority: options.batch_size && options.batch_size > 100 ? 'high' : 'normal',
      created_at: new Date(),
      progress: {
        total: finalMessageIds.length,
        processed: 0,
        successful: 0,
        failed: 0
      },
      options: {
        batch_size: 10,
        delay_between_batches: 2000,
        max_retries: 3,
        skip_existing_analysis: true,
        analysis_types: ['sentiment', 'priority', 'category', 'entities', 'summary'],
        enable_content_processing: true,
        quality_threshold: 0.7,
        ...options
      }
    };

    // 添加到内存跟踪和队列
    this.activeJobs.set(jobId, job);
    this.addToQueue(job);

    // 持久化任务（如果需要）
    await this.saveJobToDatabase(job);

    logger.info('Batch analysis job created', {
      jobId,
      messageCount: finalMessageIds.length,
      priority: job.priority,
      options: job.options
    });

    return job;
  }

  /**
   * 获取任务状态
   */
  getJobStatus(job_id: string): BatchAnalysisJob | null {
    return this.activeJobs.get(job_id) || null;
  }

  /**
   * 获取所有活动任务
   */
  getActiveJobs(): BatchAnalysisJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * 取消任务
   */
  async cancelJob(job_id: string): Promise<boolean> {
    const job = this.activeJobs.get(job_id);
    if (!job) return false;

    if (job.status === 'pending') {
      // 从队列中移除
      const queueIndex = this.processingQueue.findIndex(j => j.id === job_id);
      if (queueIndex >= 0) {
        this.processingQueue.splice(queueIndex, 1);
      }
    }

    job.status = 'cancelled';
    job.completed_at = new Date();

    await this.updateJobInDatabase(job);
    
    logger.info('Batch analysis job cancelled', { job_id });
    return true;
  }

  /**
   * 处理单个批量任务
   */
  private async processBatchJob(job: BatchAnalysisJob): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const batchSize = job.options?.batch_size || 10;
    const delayBetweenBatches = job.options?.delay_between_batches || 2000;
    const maxRetries = job.options?.max_retries || 3;

    job.status = 'running';
    job.started_at = new Date();
    
    let successfulAnalyses = 0;
    let failedAnalyses = 0;
    let skippedAnalyses = 0;
    let rateLimitHits = 0;
    const errorSummary: Record<string, number> = {};
    const confidenceScores: number[] = [];

    logger.info('Starting batch job processing', {
      jobId: job.id,
      totalMessages: job.message_ids.length,
      batchSize
    });

    try {
      // 分批处理邮件
      for (let i = 0; i < job.message_ids.length; i += batchSize) {
        if (job.status === 'cancelled') {
          logger.info('Job cancelled during processing', { jobId: job.id });
          break;
        }

        const batch = job.message_ids.slice(i, i + batchSize);
        
        // 检查速率限制
        await this.enforceRateLimit();

        try {
          // 处理批次
          const batchResult = await this.processBatch(batch, job.options!);
          
          successfulAnalyses += batchResult.successful;
          failedAnalyses += batchResult.failed;
          skippedAnalyses += batchResult.skipped;
          
          // 收集质量指标
          batchResult.confidence_scores.forEach(score => {
            if (score > 0) confidenceScores.push(score);
          });

          // 更新错误统计
          Object.entries(batchResult.errors).forEach(([error, count]) => {
            errorSummary[error] = (errorSummary[error] || 0) + count;
          });

          // 更新进度
          job.progress.processed = Math.min(i + batchSize, job.message_ids.length);
          job.progress.successful = successfulAnalyses;
          job.progress.failed = failedAnalyses;

          // 更新预估完成时间
          if (job.progress.processed > 0) {
            const elapsed = Date.now() - startTime;
            const estimated_total = (elapsed / job.progress.processed) * job.message_ids.length;
            job.estimated_completion = new Date(startTime + estimated_total);
          }

          logger.debug('Batch processed', {
            jobId: job.id,
            batchIndex: Math.floor(i / batchSize) + 1,
            processed: batch.length,
            successful: batchResult.successful,
            failed: batchResult.failed
          });

        } catch (batchError) {
          logger.error('Batch processing error', {
            jobId: job.id,
            batchIndex: Math.floor(i / batchSize) + 1,
            error: batchError
          });

          if (batchError.message.includes('rate limit')) {
            rateLimitHits++;
            await this.handleRateLimit();
          }

          failedAnalyses += batch.length;
          errorSummary['batch_processing_error'] = (errorSummary['batch_processing_error'] || 0) + 1;
        }

        // 批次间延迟
        if (i + batchSize < job.message_ids.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      // 计算质量指标
      const qualityMetrics = {
        average_confidence: confidenceScores.length > 0 
          ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
          : 0,
        high_confidence_count: confidenceScores.filter(score => score >= 0.8).length,
        low_confidence_count: confidenceScores.filter(score => score < 0.5).length
      };

      const processingDuration = Date.now() - startTime;
      const averageProcessingTime = job.progress.processed > 0 
        ? processingDuration / job.progress.processed 
        : 0;

      // 更新任务状态
      job.status = job.status === 'cancelled' ? 'cancelled' : 'completed';
      job.completed_at = new Date();

      const result: BatchAnalysisResult = {
        job_id: job.id,
        success: failedAnalyses === 0 && job.status === 'completed',
        total_processed: job.progress.processed,
        successful_analyses: successfulAnalyses,
        failed_analyses: failedAnalyses,
        skipped_analyses: skippedAnalyses,
        processing_duration_ms: processingDuration,
        average_processing_time_ms: Math.round(averageProcessingTime),
        rate_limit_hits: rateLimitHits,
        error_summary: errorSummary,
        quality_metrics: qualityMetrics
      };

      await this.updateJobInDatabase(job);

      logger.info('Batch job completed', {
        jobId: job.id,
        result
      });

      return result;

    } catch (error) {
      job.status = 'failed';
      job.error_message = error.message;
      job.completed_at = new Date();

      await this.updateJobInDatabase(job);

      logger.error('Batch job failed', {
        jobId: job.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    message_ids: string[], 
    options: BatchAnalysisOptions
  ): Promise<{
    successful: number;
    failed: number;
    skipped: number;
    confidence_scores: number[];
    errors: Record<string, number>;
  }> {
    const results = await this.contentProcessor.processEmailBatch(message_ids, {
      enable_ai_analysis: true,
      batch_processing: true,
      max_batch_size: message_ids.length
    });

    const confidenceScores: number[] = [];
    const errors: Record<string, number> = {};

    results.results.forEach(result => {
      if (result.analysis_result?.confidence_score) {
        confidenceScores.push(result.analysis_result.confidence_score);
      }
      
      if (result.errors) {
        result.errors.forEach(error => {
          const errorType = this.categorizeError(error);
          errors[errorType] = (errors[errorType] || 0) + 1;
        });
      }
    });

    return {
      successful: results.successful,
      failed: results.failed,
      skipped: 0, // Currently not tracking skipped in content processor
      confidence_scores: confidenceScores,
      errors
    };
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) {
        return;
      }

      this.isProcessing = true;

      try {
        // 按优先级排序队列
        this.processingQueue.sort((a, b) => {
          const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        const job = this.processingQueue.shift();
        if (job) {
          await this.processBatchJob(job);
        }
      } catch (error) {
        logger.error('Queue processor error', { error });
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // 每5秒检查队列
  }

  /**
   * 速率限制执行
   */
  private async enforceRateLimit(): Promise<void> {
    const now = new Date();

    // 重置计数器（如果时间窗口已过）
    if (now.getMinutes() !== this.requestCount.minute_window.getMinutes()) {
      this.requestCount.current_minute = 0;
      this.requestCount.minute_window = now;
    }

    if (now.getHours() !== this.requestCount.hour_window.getHours()) {
      this.requestCount.current_hour = 0;
      this.requestCount.hour_window = now;
    }

    // 检查限制
    if (this.requestCount.current_minute >= this.rateLimitConfig.requests_per_minute ||
        this.requestCount.current_hour >= this.rateLimitConfig.requests_per_hour) {
      await this.handleRateLimit();
    }

    this.requestCount.current_minute++;
    this.requestCount.current_hour++;
  }

  /**
   * 处理速率限制
   */
  private async handleRateLimit(): Promise<void> {
    const waitTime = Math.min(
      60000, // 最多等待1分钟
      1000 * this.rateLimitConfig.backoff_multiplier
    );

    logger.warn('Rate limit hit, waiting', { waitTimeMs: waitTime });
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * 启动速率限制重置定时器
   */
  private startRateLimitReset(): void {
    setInterval(() => {
      this.requestCount.current_minute = 0;
    }, 60000); // 每分钟重置

    setInterval(() => {
      this.requestCount.current_hour = 0;
    }, 3600000); // 每小时重置
  }

  /**
   * 添加任务到队列
   */
  private addToQueue(job: BatchAnalysisJob): void {
    this.processingQueue.push(job);
    
    logger.debug('Job added to queue', {
      jobId: job.id,
      queueLength: this.processingQueue.length,
      priority: job.priority
    });
  }

  /**
   * 保存任务到数据库
   */
  private async saveJobToDatabase(job: BatchAnalysisJob): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO batch_analysis_jobs (
          id, user_id, account_id, message_ids, status, priority,
          created_at, progress, options
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await client.query(query, [
        job.id,
        job.user_id,
        job.account_id,
        JSON.stringify(job.message_ids),
        job.status,
        job.priority,
        job.created_at,
        JSON.stringify(job.progress),
        JSON.stringify(job.options)
      ]);

    } catch (error) {
      logger.error('Failed to save job to database', { jobId: job.id, error });
    } finally {
      client.release();
    }
  }

  /**
   * 更新数据库中的任务
   */
  private async updateJobInDatabase(job: BatchAnalysisJob): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE batch_analysis_jobs 
        SET 
          status = $2,
          started_at = $3,
          completed_at = $4,
          progress = $5,
          error_message = $6,
          estimated_completion = $7
        WHERE id = $1
      `;

      await client.query(query, [
        job.id,
        job.status,
        job.started_at,
        job.completed_at,
        JSON.stringify(job.progress),
        job.error_message,
        job.estimated_completion
      ]);

    } catch (error) {
      logger.error('Failed to update job in database', { jobId: job.id, error });
    } finally {
      client.release();
    }
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: string): string {
    if (error.includes('rate limit')) return 'rate_limit_error';
    if (error.includes('AI analysis')) return 'ai_analysis_error';
    if (error.includes('timeout')) return 'timeout_error';
    if (error.includes('network')) return 'network_error';
    if (error.includes('parsing')) return 'parsing_error';
    return 'unknown_error';
  }

  /**
   * 清理完成的任务（定期清理）
   */
  public async cleanupCompletedJobs(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    // 清理内存中的任务
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (['completed', 'failed', 'cancelled'].includes(job.status) &&
          job.completed_at && job.completed_at < cutoffTime) {
        this.activeJobs.delete(jobId);
        cleanedCount++;
      }
    }

    logger.info('Cleaned up completed jobs', { cleanedCount, cutoffTime });
    return cleanedCount;
  }
}

export default BatchAnalysisProcessor.getInstance();