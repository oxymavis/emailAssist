import { EventEmitter } from 'events';
import { 
  EmailAccount, 
  SyncOperation, 
  UnifiedEmailMessage, 
  WebhookNotification,
  EmailProvider
} from '../../types';
import { EmailServiceFactory } from './EmailServiceFactory';
import logger from '../../utils/logger';
import { DatabaseService } from '../database/DatabaseService';
import Bull from 'bull';
import config from '../../config';

/**
 * 邮件同步管理服务
 * 处理邮件账户的同步、实时更新和Webhook通知
 */
export class EmailSyncService extends EventEmitter {
  private static instance: EmailSyncService;
  private emailServiceFactory: EmailServiceFactory;
  private databaseService: DatabaseService;
  private syncQueue: Bull.Queue;
  private activeSyncOperations: Map<string, SyncOperation> = new Map();
  private webhookSubscriptions: Map<string, { subscriptionId: string; provider: EmailProvider }> = new Map();

  private constructor() {
    super();
    this.emailServiceFactory = EmailServiceFactory.getInstance();
    this.databaseService = DatabaseService.getInstance();
    this.initializeQueue();
  }

  public static getInstance(): EmailSyncService {
    if (!EmailSyncService.instance) {
      EmailSyncService.instance = new EmailSyncService();
    }
    return EmailSyncService.instance;
  }

  /**
   * 初始化同步队列
   */
  private initializeQueue(): void {
    this.syncQueue = new Bull('email-sync', {
      redis: {
        host: config.env.REDIS_HOST || 'localhost',
        port: parseInt(config.env.REDIS_PORT || '6379'),
        password: config.env.REDIS_PASSWORD
      }
    });

    // 处理同步任务
    this.syncQueue.process('full-sync', 5, this.processFullSync.bind(this));
    this.syncQueue.process('incremental-sync', 10, this.processIncrementalSync.bind(this));
    this.syncQueue.process('realtime-sync', 20, this.processRealtimeSync.bind(this));

    // 监听队列事件
    this.syncQueue.on('completed', (job) => {
      logger.info(`Sync job completed: ${job.id}`, job.data);
    });

    this.syncQueue.on('failed', (job, err) => {
      logger.error(`Sync job failed: ${job.id}`, { error: err, data: job.data });
    });
  }

  /**
   * 开始账户同步
   */
  public async startAccountSync(
    account: EmailAccount,
    options: {
      syncType: 'full' | 'incremental' | 'realtime';
      priority?: 'low' | 'normal' | 'high';
      delay?: number;
    }
  ): Promise<string> {
    try {
      const operationId = `sync_${account.id}_${Date.now()}`;
      
      // 创建同步操作记录
      const syncOperation: SyncOperation = {
        id: operationId,
        accountId: account.id,
        type: options.syncType,
        status: 'pending',
        startedAt: new Date(),
        progress: {
          processed: 0,
          total: 0
        },
        stats: {
          newMessages: 0,
          updatedMessages: 0,
          deletedMessages: 0,
          errors: 0
        }
      };

      this.activeSyncOperations.set(operationId, syncOperation);

      // 将任务加入队列
      const jobOptions = {
        priority: this.mapPriority(options.priority),
        delay: options.delay || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      };

      const job = await this.syncQueue.add(
        options.syncType === 'full' ? 'full-sync' : 
        options.syncType === 'incremental' ? 'incremental-sync' : 'realtime-sync',
        {
          operationId,
          accountId: account.id,
          account
        },
        jobOptions
      );

      logger.info(`Started ${options.syncType} sync for account ${account.id}`, {
        operationId,
        jobId: job.id
      });

      return operationId;
    } catch (error) {
      logger.error(`Failed to start sync for account ${account.id}:`, error);
      throw error;
    }
  }

  /**
   * 停止账户同步
   */
  public async stopAccountSync(operationId: string): Promise<void> {
    try {
      const operation = this.activeSyncOperations.get(operationId);
      if (!operation) {
        throw new Error(`Sync operation not found: ${operationId}`);
      }

      // 更新操作状态
      operation.status = 'cancelled';
      operation.completedAt = new Date();

      // 从队列中移除相关任务
      const jobs = await this.syncQueue.getJobs(['waiting', 'active', 'delayed']);
      for (const job of jobs) {
        if (job.data.operationId === operationId) {
          await job.remove();
        }
      }

      this.activeSyncOperations.delete(operationId);
      
      logger.info(`Stopped sync operation: ${operationId}`);
    } catch (error) {
      logger.error(`Failed to stop sync operation ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(operationId: string): SyncOperation | null {
    return this.activeSyncOperations.get(operationId) || null;
  }

  /**
   * 获取账户所有活动同步操作
   */
  public getAccountSyncStatus(accountId: string): SyncOperation[] {
    return Array.from(this.activeSyncOperations.values())
      .filter(op => op.accountId === accountId);
  }

  /**
   * 设置实时同步（Webhook）
   */
  public async setupRealtimeSync(account: EmailAccount): Promise<void> {
    try {
      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      // 检查是否支持Webhook
      if (!emailService.setupWebhook) {
        logger.warn(`Webhook not supported for provider: ${account.provider}`);
        return;
      }

      const webhookUrl = `${config.env.API_BASE_URL || 'http://localhost:3001'}/webhooks/email/${account.provider}/${account.id}`;
      const subscription = await emailService.setupWebhook(webhookUrl);

      this.webhookSubscriptions.set(account.id, {
        subscriptionId: subscription.subscriptionId,
        provider: account.provider
      });

      // 更新账户设置
      await this.databaseService.updateEmailAccount(account.id, {
        syncSettings: {
          ...account.syncSettings,
          enableRealtime: true
        }
      });

      logger.info(`Realtime sync setup for account ${account.id}`, {
        provider: account.provider,
        subscriptionId: subscription.subscriptionId
      });
    } catch (error) {
      logger.error(`Failed to setup realtime sync for account ${account.id}:`, error);
      throw error;
    }
  }

  /**
   * 移除实时同步
   */
  public async removeRealtimeSync(accountId: string): Promise<void> {
    try {
      const subscription = this.webhookSubscriptions.get(accountId);
      if (!subscription) {
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      if (emailService.removeWebhook) {
        await emailService.removeWebhook(subscription.subscriptionId);
      }

      this.webhookSubscriptions.delete(accountId);

      logger.info(`Removed realtime sync for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to remove realtime sync for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * 处理Webhook通知
   */
  public async handleWebhookNotification(notification: WebhookNotification): Promise<void> {
    try {
      logger.info(`Received webhook notification for account ${notification.accountId}`, {
        type: notification.type,
        provider: notification.provider
      });

      // 根据通知类型触发相应的同步操作
      switch (notification.type) {
        case 'message.created':
        case 'message.updated':
          await this.handleMessageChange(notification);
          break;
          
        case 'message.deleted':
          await this.handleMessageDeletion(notification);
          break;
          
        case 'folder.created':
        case 'folder.updated':
          await this.handleFolderChange(notification);
          break;
          
        default:
          logger.warn(`Unknown webhook notification type: ${notification.type}`);
      }

      this.emit('webhookNotification', notification);
    } catch (error) {
      logger.error(`Failed to handle webhook notification:`, error);
      throw error;
    }
  }

  /**
   * 执行定时同步任务
   */
  public async schedulePeriodicSync(): Promise<void> {
    try {
      const accounts = await this.databaseService.getActiveEmailAccounts();
      
      for (const account of accounts) {
        if (!account.syncSettings.autoSync) {
          continue;
        }

        const lastSync = account.lastSyncAt;
        const syncInterval = account.syncSettings.syncInterval * 60 * 1000; // 转换为毫秒
        
        if (!lastSync || Date.now() - lastSync.getTime() >= syncInterval) {
          await this.startAccountSync(account, {
            syncType: 'incremental',
            priority: 'normal'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to schedule periodic sync:', error);
    }
  }

  /**
   * 处理完整同步任务
   */
  private async processFullSync(job: Bull.Job): Promise<void> {
    const { operationId, accountId, account } = job.data;
    const operation = this.activeSyncOperations.get(operationId);
    
    if (!operation) {
      throw new Error(`Sync operation not found: ${operationId}`);
    }

    try {
      operation.status = 'running';
      
      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      // 获取所有文件夹
      const folders = await emailService.getFolders();
      operation.progress.total = folders.length;

      for (const folder of folders) {
        if (operation.status === 'cancelled') {
          break;
        }

        operation.progress.currentFolder = folder.name;
        
        try {
          const syncResult = await emailService.syncMessages({
            incremental: false,
            folderId: folder.id
          });

          // 保存新邮件到数据库
          for (const message of syncResult.newMessages) {
            // await this.databaseService.saveEmailMessage(message);
            operation.stats.newMessages++;
          }

          // 更新现有邮件
          for (const message of syncResult.updatedMessages) {
            await this.databaseService.updateEmailMessage(message.id, message);
            operation.stats.updatedMessages++;
          }

          // 标记删除的邮件
          for (const messageId of syncResult.deletedMessageIds) {
            await this.databaseService.markEmailMessageDeleted(messageId);
            operation.stats.deletedMessages++;
          }

        } catch (error) {
          logger.error(`Error syncing folder ${folder.name}:`, error);
          operation.stats.errors++;
        }

        operation.progress.processed++;
        
        // 更新进度
        job.progress(Math.round((operation.progress.processed / operation.progress.total) * 100));
      }

      operation.status = 'completed';
      operation.completedAt = new Date();

      // 更新账户最后同步时间
      await this.databaseService.updateEmailAccount(accountId, {
        lastSyncAt: new Date(),
        syncStatus: 'idle'
      });

      logger.info(`Full sync completed for account ${accountId}`, operation.stats);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = {
        code: 'SYNC_FAILED',
        message: error.message,
        details: error
      };
      operation.completedAt = new Date();
      
      await this.databaseService.updateEmailAccount(accountId, {
        syncStatus: 'error',
        errorMessage: error.message
      });

      throw error;
    }
  }

  /**
   * 处理增量同步任务
   */
  private async processIncrementalSync(job: Bull.Job): Promise<void> {
    const { operationId, accountId, account } = job.data;
    const operation = this.activeSyncOperations.get(operationId);
    
    if (!operation) {
      throw new Error(`Sync operation not found: ${operationId}`);
    }

    try {
      operation.status = 'running';
      
      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      // 只同步主要文件夹
      const folders = account.syncSettings.syncFolders.length > 0 
        ? account.syncSettings.syncFolders 
        : ['inbox'];
      
      operation.progress.total = folders.length;

      for (const folderId of folders) {
        if (operation.status === 'cancelled') {
          break;
        }

        try {
          const syncResult = await emailService.syncMessages({
            incremental: true,
            folderId
          });

          // 处理同步结果（与完整同步相同的逻辑）
          for (const message of syncResult.newMessages) {
            // await this.databaseService.saveEmailMessage(message);
            operation.stats.newMessages++;
          }

          for (const message of syncResult.updatedMessages) {
            await this.databaseService.updateEmailMessage(message.id, message);
            operation.stats.updatedMessages++;
          }

          for (const messageId of syncResult.deletedMessageIds) {
            await this.databaseService.markEmailMessageDeleted(messageId);
            operation.stats.deletedMessages++;
          }

        } catch (error) {
          logger.error(`Error syncing folder ${folderId}:`, error);
          operation.stats.errors++;
        }

        operation.progress.processed++;
        job.progress(Math.round((operation.progress.processed / operation.progress.total) * 100));
      }

      operation.status = 'completed';
      operation.completedAt = new Date();

      await this.databaseService.updateEmailAccount(accountId, {
        lastSyncAt: new Date(),
        syncStatus: 'idle'
      });

      logger.info(`Incremental sync completed for account ${accountId}`, operation.stats);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = {
        code: 'SYNC_FAILED',
        message: error.message,
        details: error
      };
      operation.completedAt = new Date();
      
      await this.databaseService.updateEmailAccount(accountId, {
        syncStatus: 'error',
        errorMessage: error.message
      });

      throw error;
    }
  }

  /**
   * 处理实时同步任务
   */
  private async processRealtimeSync(job: Bull.Job): Promise<void> {
    const { operationId, messageId, folderId } = job.data;
    
    try {
      // 实时同步通常只处理单条消息或文件夹
      logger.info(`Processing realtime sync: ${operationId}`, { messageId, folderId });
      
      // 实现实时同步逻辑
      // 这里可以根据具体需求实现
      
    } catch (error) {
      logger.error(`Realtime sync failed: ${operationId}`, error);
      throw error;
    }
  }

  /**
   * 处理消息变更通知
   */
  private async handleMessageChange(notification: WebhookNotification): Promise<void> {
    if (!notification.data.messageId) {
      return;
    }

    // 创建实时同步任务
    await this.syncQueue.add('realtime-sync', {
      operationId: `realtime_${notification.id}`,
      accountId: notification.accountId,
      messageId: notification.data.messageId,
      type: notification.type
    }, {
      priority: 10,
      attempts: 2
    });
  }

  /**
   * 处理消息删除通知
   */
  private async handleMessageDeletion(notification: WebhookNotification): Promise<void> {
    if (!notification.data.messageId) {
      return;
    }

    try {
      await this.databaseService.markEmailMessageDeleted(notification.data.messageId);
      logger.info(`Marked message as deleted: ${notification.data.messageId}`);
    } catch (error) {
      logger.error(`Failed to handle message deletion:`, error);
    }
  }

  /**
   * 处理文件夹变更通知
   */
  private async handleFolderChange(notification: WebhookNotification): Promise<void> {
    // 文件夹变更时可能需要重新同步文件夹结构
    logger.info(`Folder change detected for account ${notification.accountId}`);
  }

  /**
   * 映射优先级
   */
  private mapPriority(priority?: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 1;
      case 'normal': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  /**
   * 清理已完成的同步操作
   */
  public cleanupCompletedOperations(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    for (const [operationId, operation] of this.activeSyncOperations) {
      if (operation.status === 'completed' || operation.status === 'failed') {
        if (operation.completedAt && now - operation.completedAt.getTime() > maxAge) {
          this.activeSyncOperations.delete(operationId);
        }
      }
    }
  }

  /**
   * 获取同步统计信息
   */
  public getSyncStats(): {
    activeOperations: number;
    queueStats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  } {
    return {
      activeOperations: this.activeSyncOperations.size,
      queueStats: {
        waiting: 0, // 需要从Redis获取
        active: 0,
        completed: 0,
        failed: 0
      }
    };
  }

  /**
   * 关闭服务
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down EmailSyncService...');
    
    // 停止所有活动的同步操作
    for (const operationId of this.activeSyncOperations.keys()) {
      try {
        await this.stopAccountSync(operationId);
      } catch (error) {
        logger.error(`Error stopping sync operation ${operationId}:`, error);
      }
    }

    // 关闭队列
    await this.syncQueue.close();
    
    // 移除所有监听器
    this.removeAllListeners();
    
    logger.info('EmailSyncService shutdown complete');
  }
}