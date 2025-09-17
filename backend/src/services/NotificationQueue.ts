import Bull, { Queue, Job } from 'bull';
import { Pool } from 'pg';
import { Notification } from '../types';
import { UnifiedCacheManager } from './UnifiedCacheManager';

export interface QueueOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  priority?: number;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  delayed: number;
}

export class NotificationQueue {
  private queue: Queue;
  private db: Pool;
  private cache: UnifiedCacheManager;
  private processors: Map<string, (job: Job<Notification>) => Promise<void>>;

  constructor(db: Pool, cache: UnifiedCacheManager, redisConfig?: any) {
    // Initialize Bull queue with Redis configuration
    this.queue = new Bull('notification-processing', {
      redis: redisConfig || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 0
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute base delay
        }
      }
    });

    this.db = db;
    this.cache = cache;
    this.processors = new Map();

    this.setupEventHandlers();
    this.setupProcessors();
  }

  /**
   * Add notification to queue
   */
  async add(notification: Notification, options?: QueueOptions): Promise<Job<Notification>> {
    try {
      // Store notification in database queue table
      await this.addToDatabase(notification, options);

      // Add to Bull queue
      const job = await this.queue.add(
        'process-notification',
        notification,
        {
          delay: options?.delay || 0,
          attempts: options?.attempts || 3,
          backoff: options?.backoff || {
            type: 'exponential',
            delay: 60000
          },
          priority: this.calculateJobPriority(notification.priority, options?.priority)
        }
      );

      console.log(`Added notification ${notification.id} to queue with job ID ${job.id}`);
      return job;
    } catch (error) {
      console.error('Error adding notification to queue:', error);
      throw error;
    }
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    try {
      const [pending, processing, failed, completed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getFailed(),
        this.queue.getCompleted(),
        this.queue.getDelayed()
      ]);

      return {
        pending: pending.length,
        processing: processing.length,
        failed: failed.length,
        completed: completed.length,
        delayed: delayed.length
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Pause queue processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('Notification queue paused');
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('Notification queue resumed');
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    await this.queue.empty();
    console.log('Notification queue cleared');
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<{
    throughput: number;
    averageProcessingTime: number;
    errorRate: number;
    queueLength: number;
  }> {
    const cacheKey = 'notification:queue:metrics';
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    try {
      const [completed, failed, waiting] = await Promise.all([
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getWaiting()
      ]);

      const totalJobs = completed.length + failed.length;
      const errorRate = totalJobs > 0 ? (failed.length / totalJobs) * 100 : 0;

      // Calculate average processing time from completed jobs
      let totalProcessingTime = 0;
      let validJobs = 0;

      for (const job of completed.slice(0, 100)) { // Last 100 jobs
        if (job.finishedOn && job.processedOn) {
          totalProcessingTime += job.finishedOn - job.processedOn;
          validJobs++;
        }
      }

      const averageProcessingTime = validJobs > 0 ? totalProcessingTime / validJobs : 0;

      // Calculate throughput (jobs per minute)
      const recentCompleted = completed.filter(job => 
        job.finishedOn && (Date.now() - job.finishedOn) < 60000 // Last minute
      );
      const throughput = recentCompleted.length;

      const metrics = {
        throughput,
        averageProcessingTime,
        errorRate,
        queueLength: waiting.length
      };

      // Cache for 30 seconds
      await this.cache.set(cacheKey, JSON.stringify(metrics), { ttl: 30 });

      return metrics;
    } catch (error) {
      console.error('Error getting queue metrics:', error);
      return {
        throughput: 0,
        averageProcessingTime: 0,
        errorRate: 0,
        queueLength: 0
      };
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(limit?: number): Promise<number> {
    try {
      const failedJobs = await this.queue.getFailed(0, limit || 100);
      let retriedCount = 0;

      for (const job of failedJobs) {
        try {
          await job.retry();
          retriedCount++;
        } catch (error) {
          console.error(`Error retrying job ${job.id}:`, error);
        }
      }

      console.log(`Retried ${retriedCount} failed jobs`);
      return retriedCount;
    } catch (error) {
      console.error('Error retrying failed jobs:', error);
      throw error;
    }
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(): Promise<void> {
    try {
      const hour = 3600000; // 1 hour in milliseconds
      const day = 24 * hour;

      await Promise.all([
        this.queue.clean(day, 'completed'),     // Clean completed jobs older than 1 day
        this.queue.clean(day * 7, 'failed'),   // Clean failed jobs older than 7 days
        this.queue.clean(hour, 'active')       // Clean stuck active jobs older than 1 hour
      ]);

      console.log('Cleaned old jobs from notification queue');
    } catch (error) {
      console.error('Error cleaning old jobs:', error);
      throw error;
    }
  }

  /**
   * Register notification processor
   */
  registerProcessor(name: string, processor: (job: Job<Notification>) => Promise<void>): void {
    this.processors.set(name, processor);
    console.log(`Registered processor: ${name}`);
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    console.log('Notification queue closed');
  }

  // =============================================
  // Private Methods
  // =============================================

  private setupEventHandlers(): void {
    this.queue.on('completed', (job: Job<Notification>, result: any) => {
      console.log(`Notification job ${job.id} completed for notification ${job.data.id}`);
      this.updateDatabaseStatus(job.data.id, 'completed');
    });

    this.queue.on('failed', (job: Job<Notification>, error: Error) => {
      console.error(`Notification job ${job.id} failed for notification ${job.data.id}:`, error.message);
      this.updateDatabaseStatus(job.data.id, 'failed', error.message);
    });

    this.queue.on('progress', (job: Job<Notification>, progress: number) => {
      console.log(`Notification job ${job.id} progress: ${progress}%`);
    });

    this.queue.on('stalled', (job: Job<Notification>) => {
      console.warn(`Notification job ${job.id} stalled for notification ${job.data.id}`);
    });

    this.queue.on('error', (error: Error) => {
      console.error('Notification queue error:', error);
    });

    // Health check
    this.queue.on('waiting', (jobId: number) => {
      console.log(`Job ${jobId} is waiting`);
    });
  }

  private setupProcessors(): void {
    // Main notification processor
    this.queue.process('process-notification', 10, async (job: Job<Notification>) => {
      const notification = job.data;
      
      try {
        console.log(`Processing notification ${notification.id}...`);
        
        // Update progress
        await job.progress(10);
        
        // Update database status
        await this.updateDatabaseStatus(notification.id, 'processing');
        
        await job.progress(30);

        // Get registered processor
        const processor = this.processors.get('notification-processor');
        if (processor) {
          await processor(job);
        } else {
          throw new Error('No notification processor registered');
        }

        await job.progress(90);
        
        // Update final status
        await this.updateDatabaseStatus(notification.id, 'completed');
        
        await job.progress(100);
        
        console.log(`Successfully processed notification ${notification.id}`);
        return { success: true, notificationId: notification.id };
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        await this.updateDatabaseStatus(notification.id, 'failed', error.message);
        throw error;
      }
    });

    // Cleanup processor
    this.queue.process('cleanup', 1, async (job: Job) => {
      await this.cleanOldJobs();
      return { success: true };
    });

    // Schedule periodic cleanup
    setInterval(async () => {
      try {
        await this.queue.add('cleanup', {}, { 
          delay: 0,
          attempts: 1,
          removeOnComplete: 1,
          removeOnFail: 1
        });
      } catch (error) {
        console.error('Error scheduling cleanup:', error);
      }
    }, 3600000); // Every hour
  }

  private calculateJobPriority(notificationPriority: number, jobPriority?: number): number {
    // Higher numbers = higher priority in Bull
    // Notification priority: 1-10 (10 = highest)
    // Convert to Bull priority range
    const basePriority = notificationPriority * 10;
    const finalPriority = jobPriority ? Math.max(basePriority, jobPriority) : basePriority;
    
    return Math.min(finalPriority, 100); // Cap at 100
  }

  private async addToDatabase(notification: Notification, options?: QueueOptions): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO notification_queue (
          notification_id, queue_name, priority, status, attempts, max_attempts,
          scheduled_at, next_retry_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `;

      const scheduledAt = options?.delay 
        ? new Date(Date.now() + options.delay)
        : new Date();

      const values = [
        notification.id,
        'default',
        this.calculateJobPriority(notification.priority, options?.priority),
        'pending',
        0,
        options?.attempts || 3,
        scheduledAt,
        null
      ];

      await client.query(query, values);
    } catch (error) {
      console.error('Error adding notification to database queue:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateDatabaseStatus(
    notificationId: string, 
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying',
    errorMessage?: string
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const setClauses = ['status = $2', 'updated_at = NOW()'];
      const values = [notificationId, status];
      let paramIndex = 3;

      if (status === 'processing') {
        setClauses.push(`processing_started_at = NOW()`);
      } else if (status === 'completed' || status === 'failed') {
        setClauses.push(`processing_completed_at = NOW()`);
      }

      if (status === 'failed' && errorMessage) {
        setClauses.push(`last_error = $${paramIndex}`);
        values.push(errorMessage);
        paramIndex++;
      }

      if (status === 'retrying') {
        setClauses.push(`attempts = attempts + 1`);
        setClauses.push(`next_retry_at = NOW() + INTERVAL '1 minute'`);
      }

      const query = `
        UPDATE notification_queue 
        SET ${setClauses.join(', ')}
        WHERE notification_id = $1
      `;

      await client.query(query, values);
    } catch (error) {
      console.error('Error updating database queue status:', error);
      // Don't throw - this is a background operation
    } finally {
      client.release();
    }
  }

  /**
   * Monitor queue health
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    queueLength: number;
    processingRate: number;
    errorRate: number;
    lastProcessed?: Date;
  }> {
    try {
      const metrics = await this.getMetrics();
      const status = await this.getStatus();

      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Determine health based on queue metrics
      if (metrics.errorRate > 20) {
        healthStatus = 'unhealthy';
      } else if (metrics.errorRate > 10 || status.pending > 1000) {
        healthStatus = 'degraded';
      }

      // Get last processed job timestamp
      const completed = await this.queue.getCompleted(0, 1);
      const lastProcessed = completed.length > 0 && completed[0].finishedOn 
        ? new Date(completed[0].finishedOn)
        : undefined;

      return {
        status: healthStatus,
        queueLength: status.pending + status.processing + status.delayed,
        processingRate: metrics.throughput,
        errorRate: metrics.errorRate,
        lastProcessed
      };
    } catch (error) {
      console.error('Error getting queue health status:', error);
      return {
        status: 'unhealthy',
        queueLength: -1,
        processingRate: -1,
        errorRate: -1
      };
    }
  }

  /**
   * Scale queue processing based on load
   */
  async autoScale(): Promise<void> {
    try {
      const status = await this.getStatus();
      const currentConcurrency = this.queue.settings.maxConcurrency || 10;

      // Scale up if queue is backing up
      if (status.pending > 100 && currentConcurrency < 50) {
        const newConcurrency = Math.min(currentConcurrency + 5, 50);
        // Note: Bull doesn't support dynamic concurrency changes
        console.log(`Queue scaling: ${currentConcurrency} -> ${newConcurrency} (requires restart)`);
      }

      // Scale down if queue is idle
      if (status.pending < 10 && currentConcurrency > 5) {
        const newConcurrency = Math.max(currentConcurrency - 2, 5);
        console.log(`Queue scaling: ${currentConcurrency} -> ${newConcurrency} (requires restart)`);
      }
    } catch (error) {
      console.error('Error auto-scaling queue:', error);
    }
  }
}