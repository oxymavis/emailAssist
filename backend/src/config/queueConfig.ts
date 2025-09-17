import Bull, { Queue } from 'bull';
import Redis from 'ioredis';
import config from './index';
import logger from '@/utils/logger';

/**
 * 队列配置和管理
 * 统一管理所有Bull队列的配置和初始化
 */

// Redis配置
const redisConfig = {
  host: config.redisConfig.host || 'localhost',
  port: config.redisConfig.port || 6379,
  password: config.redisConfig.password,
  db: config.redisConfig.db || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  family: 4, // 4 (IPv4) or 6 (IPv6)
  keepAlive: 30000,
  connectTimeout: 10000
};

// 创建Redis连接
const redisConnection = new Redis(redisConfig);

// 默认队列选项
const defaultQueueOptions = {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  },
  settings: {
    stalledInterval: 30000, // 30秒
    maxStalledCount: 1
  }
};

// 队列实例存储
const queues: Map<string, Queue> = new Map();

/**
 * 队列配置定义
 */
export const QUEUE_CONFIGS = {
  // 邮件批量操作队列
  EMAIL_BATCH_OPERATIONS: {
    name: 'email-batch-operations',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        delay: 0
      }
    },
    concurrency: 5, // 同时处理5个批量操作
    processors: [
      {
        name: 'process-batch',
        concurrency: 5,
        processor: './processors/batchOperationProcessor'
      }
    ]
  },

  // 工作流执行队列
  WORKFLOW_EXECUTIONS: {
    name: 'workflow-executions',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      }
    },
    concurrency: 10, // 同时处理10个工作流
    processors: [
      {
        name: 'execute-workflow',
        concurrency: 10,
        processor: './processors/workflowProcessor'
      }
    ]
  },

  // 邮件分析队列
  EMAIL_ANALYSIS: {
    name: 'email-analysis',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000
        }
      }
    },
    concurrency: 8, // 同时处理8个分析任务
    processors: [
      {
        name: 'analyze-email',
        concurrency: 8,
        processor: './processors/emailAnalysisProcessor'
      }
    ]
  },

  // 规则引擎队列
  RULE_ENGINE: {
    name: 'rule-engine',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500
        }
      }
    },
    concurrency: 15, // 同时处理15个规则应用任务
    processors: [
      {
        name: 'apply-rules',
        concurrency: 15,
        processor: './processors/ruleEngineProcessor'
      }
    ]
  },

  // 通知队列
  NOTIFICATIONS: {
    name: 'notifications',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    },
    concurrency: 20, // 同时处理20个通知任务
    processors: [
      {
        name: 'send-notification',
        concurrency: 20,
        processor: './processors/notificationProcessor'
      }
    ]
  },

  // 邮件同步队列
  EMAIL_SYNC: {
    name: 'email-sync',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000
        }
      }
    },
    concurrency: 3, // 同时处理3个同步任务（避免API限制）
    processors: [
      {
        name: 'sync-emails',
        concurrency: 3,
        processor: './processors/emailSyncProcessor'
      }
    ]
  },

  // 报告生成队列
  REPORT_GENERATION: {
    name: 'report-generation',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 30000
        }
      }
    },
    concurrency: 2, // 同时处理2个报告生成任务
    processors: [
      {
        name: 'generate-report',
        concurrency: 2,
        processor: './processors/reportGenerationProcessor'
      }
    ]
  },

  // 定时任务队列
  SCHEDULED_TASKS: {
    name: 'scheduled-tasks',
    options: {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    },
    concurrency: 5, // 同时处理5个定时任务
    processors: [
      {
        name: 'execute-scheduled-task',
        concurrency: 5,
        processor: './processors/scheduledTaskProcessor'
      }
    ]
  }
};

/**
 * 队列管理器
 */
export class QueueManager {
  private static instance: QueueManager;
  private initialized = false;

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * 初始化所有队列
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 测试Redis连接
      await this.testRedisConnection();

      // 创建所有队列
      for (const [key, queueConfig] of Object.entries(QUEUE_CONFIGS)) {
        const queue = new Bull(queueConfig.name, queueConfig.options);
        
        // 设置队列事件监听
        this.setupQueueEventListeners(queue, queueConfig.name);
        
        queues.set(key, queue);
        
        logger.info(`Queue initialized: ${queueConfig.name}`);
      }

      // 设置全局错误处理
      this.setupGlobalErrorHandling();

      this.initialized = true;
      logger.info('All queues initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize queues', { error });
      throw error;
    }
  }

  /**
   * 获取队列实例
   */
  getQueue(queueKey: keyof typeof QUEUE_CONFIGS): Queue {
    const queue = queues.get(queueKey);
    if (!queue) {
      throw new Error(`Queue not found: ${queueKey}`);
    }
    return queue;
  }

  /**
   * 获取所有队列
   */
  getAllQueues(): Map<string, Queue> {
    return new Map(queues);
  }

  /**
   * 添加任务到队列
   */
  async addJob(
    queueKey: keyof typeof QUEUE_CONFIGS,
    jobName: string,
    data: any,
    options?: Bull.JobOptions
  ): Promise<Bull.Job> {
    const queue = this.getQueue(queueKey);
    
    const job = await queue.add(jobName, data, options);
    
    logger.debug('Job added to queue', {
      queueName: QUEUE_CONFIGS[queueKey].name,
      jobName,
      jobId: job.id,
      priority: options?.priority
    });

    return job;
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(queueKey: keyof typeof QUEUE_CONFIGS): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(queueKey);
    const counts = await queue.getJobCounts();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: (counts as any).paused || 0 // Bull queue might not have paused in JobCounts type
    };
  }

  /**
   * 获取所有队列状态
   */
  async getAllQueueStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const [key] of Object.entries(QUEUE_CONFIGS)) {
      try {
        status[key] = await this.getQueueStatus(key as keyof typeof QUEUE_CONFIGS);
      } catch (error) {
        logger.error(`Failed to get status for queue ${key}`, { error });
        status[key] = { error: error.message };
      }
    }
    
    return status;
  }

  /**
   * 暂停队列
   */
  async pauseQueue(queueKey: keyof typeof QUEUE_CONFIGS): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.pause();
    logger.info(`Queue paused: ${QUEUE_CONFIGS[queueKey].name}`);
  }

  /**
   * 恢复队列
   */
  async resumeQueue(queueKey: keyof typeof QUEUE_CONFIGS): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.resume();
    logger.info(`Queue resumed: ${QUEUE_CONFIGS[queueKey].name}`);
  }

  /**
   * 清空队列
   */
  async clearQueue(queueKey: keyof typeof QUEUE_CONFIGS): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.empty();
    logger.info(`Queue cleared: ${QUEUE_CONFIGS[queueKey].name}`);
  }

  /**
   * 获取失败的任务
   */
  async getFailedJobs(
    queueKey: keyof typeof QUEUE_CONFIGS,
    start = 0,
    end = -1
  ): Promise<Bull.Job[]> {
    const queue = this.getQueue(queueKey);
    return await queue.getFailed(start, end);
  }

  /**
   * 重试失败的任务
   */
  async retryFailedJob(
    queueKey: keyof typeof QUEUE_CONFIGS,
    jobId: string
  ): Promise<void> {
    const queue = this.getQueue(queueKey);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.retry();
    logger.info(`Job retried: ${jobId} in queue ${QUEUE_CONFIGS[queueKey].name}`);
  }

  /**
   * 批量重试失败的任务
   */
  async retryAllFailedJobs(queueKey: keyof typeof QUEUE_CONFIGS): Promise<number> {
    const failedJobs = await this.getFailedJobs(queueKey);
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        logger.error(`Failed to retry job ${job.id}`, { error });
      }
    }

    logger.info(`Retried ${retriedCount} failed jobs in queue ${QUEUE_CONFIGS[queueKey].name}`);
    return retriedCount;
  }

  /**
   * 关闭所有队列
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all queues...');

    const shutdownPromises = Array.from(queues.values()).map(async (queue) => {
      try {
        await queue.close();
        logger.info(`Queue closed: ${queue.name}`);
      } catch (error) {
        logger.error(`Error closing queue ${queue.name}`, { error });
      }
    });

    await Promise.all(shutdownPromises);

    // 关闭Redis连接
    if (redisConnection) {
      await redisConnection.quit();
      logger.info('Redis connection closed');
    }

    queues.clear();
    this.initialized = false;
    logger.info('All queues shut down');
  }

  /**
   * 测试Redis连接
   */
  private async testRedisConnection(): Promise<void> {
    try {
      await redisConnection.ping();
      logger.info('Redis connection test successful');
    } catch (error) {
      logger.error('Redis connection test failed', { error });
      throw new Error('Redis connection failed');
    }
  }

  /**
   * 设置队列事件监听
   */
  private setupQueueEventListeners(queue: Queue, queueName: string): void {
    // 任务完成事件
    queue.on('completed', (job, result) => {
      logger.debug(`Job completed in queue ${queueName}`, {
        jobId: job.id,
        jobName: job.name,
        processingTime: Date.now() - job.processedOn!
      });
    });

    // 任务失败事件
    queue.on('failed', (job, err) => {
      logger.error(`Job failed in queue ${queueName}`, {
        jobId: job.id,
        jobName: job.name,
        error: err.message,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });
    });

    // 任务停滞事件
    queue.on('stalled', (job) => {
      logger.warn(`Job stalled in queue ${queueName}`, {
        jobId: job.id,
        jobName: job.name,
        stallCount: job.opts.attempts
      });
    });

    // 队列错误事件
    queue.on('error', (error) => {
      logger.error(`Queue error in ${queueName}`, { error });
    });

    // 队列清理事件
    queue.on('cleaned', (jobs, type) => {
      logger.info(`Queue cleaned in ${queueName}`, {
        jobsRemoved: jobs.length,
        type
      });
    });
  }

  /**
   * 设置全局错误处理
   */
  private setupGlobalErrorHandling(): void {
    // 监听未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection in queue system', {
        reason,
        promise
      });
    });

    // 监听未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception in queue system', { error });
    });
  }
}

/**
 * 队列健康检查
 */
export class QueueHealthChecker {
  private queueManager: QueueManager;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * 检查所有队列健康状态
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    checks: Record<string, any>;
    summary: {
      totalQueues: number;
      healthyQueues: number;
      unhealthyQueues: number;
    };
  }> {
    const checks: Record<string, any> = {};
    let healthyQueues = 0;
    let unhealthyQueues = 0;

    for (const [key, config] of Object.entries(QUEUE_CONFIGS)) {
      try {
        const queue = this.queueManager.getQueue(key as keyof typeof QUEUE_CONFIGS);
        const status = await this.queueManager.getQueueStatus(key as keyof typeof QUEUE_CONFIGS);
        
        // 健康检查逻辑
        const isHealthy = this.isQueueHealthy(status);
        
        checks[key] = {
          name: config.name,
          healthy: isHealthy,
          status,
          issues: isHealthy ? [] : this.getQueueIssues(status)
        };

        if (isHealthy) {
          healthyQueues++;
        } else {
          unhealthyQueues++;
        }

      } catch (error) {
        checks[key] = {
          name: config.name,
          healthy: false,
          error: error.message,
          issues: ['Queue not accessible']
        };
        unhealthyQueues++;
      }
    }

    const totalQueues = Object.keys(QUEUE_CONFIGS).length;
    const overallHealthy = unhealthyQueues === 0;

    return {
      healthy: overallHealthy,
      checks,
      summary: {
        totalQueues,
        healthyQueues,
        unhealthyQueues
      }
    };
  }

  /**
   * 判断队列是否健康
   */
  private isQueueHealthy(status: any): boolean {
    // 检查是否有太多失败的任务
    const failureRate = status.failed / (status.completed + status.failed + 1);
    if (failureRate > 0.1) { // 失败率超过10%
      return false;
    }

    // 检查是否有太多等待的任务（可能表示处理能力不足）
    if (status.waiting > 1000) {
      return false;
    }

    // 检查是否有停滞的任务
    if (status.active > 100) { // 可能表示任务处理缓慢
      return false;
    }

    return true;
  }

  /**
   * 获取队列问题列表
   */
  private getQueueIssues(status: any): string[] {
    const issues: string[] = [];

    const failureRate = status.failed / (status.completed + status.failed + 1);
    if (failureRate > 0.1) {
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
    }

    if (status.waiting > 1000) {
      issues.push(`Too many waiting jobs: ${status.waiting}`);
    }

    if (status.active > 100) {
      issues.push(`Too many active jobs: ${status.active}`);
    }

    return issues;
  }
}

// 导出单例实例
export const queueManager = QueueManager.getInstance();
export const queueHealthChecker = new QueueHealthChecker(queueManager);

// 应用启动时初始化队列
export async function initializeQueues(): Promise<void> {
  await queueManager.initialize();
}

// 应用关闭时清理队列
export async function shutdownQueues(): Promise<void> {
  await queueManager.shutdown();
}