/**
 * Email Sync Service
 * 邮件数据同步服务 - 从Microsoft Graph获取邮件并存储到数据库
 */

import DatabaseManager from '@/config/database';
import { MicrosoftGraphService, GraphEmailMessage, EmailSyncOptions } from './email/MicrosoftGraphService';
import { MicrosoftAuthService, MicrosoftTokens } from './auth/MicrosoftAuthService';
import EmailMessageModel from '@/models/EmailMessage';

export interface EmailMessageData {
  id: string;
  subject: string;
  sender: string;
  body: string;
  receivedAt: Date;
  isRead: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
  
  // Additional properties for database compatibility
  account_id?: string;
  message_id?: string;
  folder_id?: string;
  internet_message_id?: string;
  thread_id?: string;
  conversation_id?: string;
  sender_email?: string;
  sender_name?: string;
  recipients?: Array<{ name: string; email: string }>;
  cc_recipients?: Array<{ name: string; email: string }>;
  bcc_recipients?: Array<{ name: string; email: string }>;
  body_text?: string;
  body_html?: string;
  preview_text?: string;
  sensitivity?: string;
  is_flagged?: boolean;
  is_draft?: boolean;
  attachment_count?: number;
  sent_at?: Date;
  received_at?: Date;
  analysis_status?: string;
}

export interface EmailRecipient {
  name: string;
  email: string;
}
import EmailAnalysisCacheModel from '@/models/EmailAnalysisCache';
import logger from '@/utils/logger';
import { EmailSyncError, AuthenticationError } from '@/types';
import { Pool } from 'pg';

export interface SyncConfiguration {
  account_id: string;
  user_email: string;
  sync_folders?: string[];
  max_emails_per_sync?: number;
  sync_attachments?: boolean;
  auto_analysis?: boolean;
  incremental_sync?: boolean;
  sync_interval_minutes?: number;
}

export interface SyncResult {
  success: boolean;
  total_processed: number;
  new_emails: number;
  updated_emails: number;
  errors: number;
  sync_duration_ms: number;
  last_sync_token?: string;
  error_details?: string[];
}

export interface SyncProgress {
  operation_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  current_folder?: string;
  start_time: Date;
  estimated_completion?: Date;
  error_message?: string;
}

export class EmailSyncService {
  private static instance: EmailSyncService;
  private pool: Pool;
  private graphService: MicrosoftGraphService;
  private authService: MicrosoftAuthService;
  private emailMessageModel: EmailMessageModel;
  private analysisModel: EmailAnalysisCacheModel;
  private activeSyncs: Map<string, SyncProgress> = new Map();

  private constructor() {
    this.pool = DatabaseManager.getPool();
    this.graphService = MicrosoftGraphService.getInstance();
    this.authService = MicrosoftAuthService.getInstance();
    this.emailMessageModel = new EmailMessageModel();
    this.analysisModel = new EmailAnalysisCacheModel();
  }

  public static getInstance(): EmailSyncService {
    if (!EmailSyncService.instance) {
      EmailSyncService.instance = new EmailSyncService();
    }
    return EmailSyncService.instance;
  }

  /**
   * 执行邮件同步
   */
  async syncEmails(config: SyncConfiguration): Promise<SyncResult> {
    const operationId = `sync_${config.account_id}_${Date.now()}`;
    const startTime = new Date();
    
    logger.info('Starting email sync', { 
      operationId, 
      account_id: config.account_id,
      user_email: config.user_email
    });

    // 初始化同步进度跟踪
    const progress: SyncProgress = {
      operation_id: operationId,
      status: 'running',
      total_items: 0,
      processed_items: 0,
      start_time: startTime
    };
    this.activeSyncs.set(operationId, progress);

    try {
      // 获取用户的Microsoft令牌
      const tokens = await this.getValidTokens(config.user_email);
      
      // 创建同步操作记录
      await this.createSyncOperation(config.account_id, 'full_sync', operationId);
      
      let totalProcessed = 0;
      let newEmails = 0;
      let updatedEmails = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      // 获取要同步的文件夹
      const folders = await this.getSyncFolders(tokens, config);
      progress.total_items = await this.estimateTotalEmails(tokens, folders);
      
      logger.info('Sync folders identified', { 
        operationId,
        folders: folders.length,
        estimated_emails: progress.total_items
      });

      // 同步每个文件夹的邮件
      for (const folder of folders) {
        try {
          progress.current_folder = folder.displayName;
          
          const folderResult = await this.syncFolderEmails(
            tokens, 
            config, 
            folder,
            progress,
            operationId
          );
          
          totalProcessed += folderResult.total_processed;
          newEmails += folderResult.new_emails;
          updatedEmails += folderResult.updated_emails;
          errors += folderResult.errors;
          
          if (folderResult.error_details) {
            errorDetails.push(...folderResult.error_details);
          }

        } catch (error) {
          logger.error('Failed to sync folder', { 
            operationId,
            folder: folder.displayName,
            error 
          });
          errors++;
          errorDetails.push(`Folder ${folder.displayName}: ${error.message}`);
        }
      }

      // 更新同步状态
      progress.status = errors > 0 ? 'completed' : 'completed';
      progress.processed_items = totalProcessed;
      
      // 更新账户同步状态
      await this.updateAccountSyncStatus(config.account_id, true);
      
      // 完成同步操作记录
      const syncDuration = Date.now() - startTime.getTime();
      await this.completeSyncOperation(operationId, {
        total_items: totalProcessed,
        processed_items: totalProcessed,
        failed_items: errors,
        result_summary: {
          new_emails: newEmails,
          updated_emails: updatedEmails,
          errors: errors,
          sync_duration_ms: syncDuration
        }
      });

      logger.info('Email sync completed', {
        operationId,
        totalProcessed,
        newEmails,
        updatedEmails,
        errors,
        syncDuration
      });

      return {
        success: errors === 0,
        total_processed: totalProcessed,
        new_emails: newEmails,
        updated_emails: updatedEmails,
        errors,
        sync_duration_ms: syncDuration,
        error_details: errorDetails.length > 0 ? errorDetails : undefined
      };

    } catch (error) {
      progress.status = 'failed';
      progress.error_message = error.message;
      
      await this.updateAccountSyncStatus(config.account_id, false, error.message);
      await this.failSyncOperation(operationId, error.message);
      
      logger.error('Email sync failed', { operationId, error });
      
      throw new EmailSyncError(`Email sync failed: ${error.message}`);
    } finally {
      // 清理进度跟踪
      setTimeout(() => {
        this.activeSyncs.delete(operationId);
      }, 300000); // 5分钟后清理
    }
  }

  /**
   * 同步单个文件夹的邮件
   */
  private async syncFolderEmails(
    tokens: MicrosoftTokens,
    config: SyncConfiguration,
    folder: any,
    progress: SyncProgress,
    operationId: string
  ): Promise<Omit<SyncResult, 'sync_duration_ms' | 'success'>> {
    let totalProcessed = 0;
    let newEmails = 0;
    let updatedEmails = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    let nextPageToken: string | undefined;
    
    const batchSize = Math.min(config.max_emails_per_sync || 50, 100);

    do {
      try {
        // 获取邮件批次
        const syncOptions: EmailSyncOptions = {
          folderId: folder.id,
          pageSize: batchSize,
          skipToken: nextPageToken,
          orderBy: 'receivedDateTime desc'
        };

        const emailResult = await this.graphService.getMessages(tokens, syncOptions);
        
        if (emailResult.messages.length === 0) {
          break;
        }

        // 转换并存储邮件
        const emailDataList: EmailMessageData[] = [];
        for (const graphEmail of emailResult.messages) {
          try {
            const emailData = this.convertGraphEmailToEmailData(
              graphEmail, 
              config.account_id, 
              folder.id
            );
            emailDataList.push(emailData);
          } catch (conversionError) {
            logger.error('Failed to convert email data', {
              operationId,
              messageId: graphEmail.id,
              error: conversionError
            });
            errors++;
            errorDetails.push(`Email conversion error: ${conversionError.message}`);
          }
        }

        // 批量存储邮件
        if (emailDataList.length > 0) {
          const storeResult = await this.storeEmails(emailDataList);
          newEmails += storeResult.created;
          updatedEmails += storeResult.updated;
          errors += storeResult.errors;
          
          if (storeResult.error_details) {
            errorDetails.push(...storeResult.error_details);
          }
        }

        totalProcessed += emailResult.messages.length;
        progress.processed_items += emailResult.messages.length;
        
        // 更新预估完成时间
        if (progress.processed_items > 0 && progress.total_items > 0) {
          const elapsed = Date.now() - progress.start_time.getTime();
          const estimatedTotal = (elapsed / progress.processed_items) * progress.total_items;
          progress.estimated_completion = new Date(progress.start_time.getTime() + estimatedTotal);
        }

        nextPageToken = emailResult.nextPageToken;
        
        // 短暂延迟避免API限制
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        logger.debug('Batch processed', {
          operationId,
          folder: folder.displayName,
          processed: emailResult.messages.length,
          total: totalProcessed,
          hasMore: !!nextPageToken
        });

      } catch (batchError) {
        logger.error('Failed to process email batch', {
          operationId,
          folder: folder.displayName,
          error: batchError
        });
        errors++;
        errorDetails.push(`Batch processing error: ${batchError.message}`);
        break; // 退出当前文件夹的同步
      }
    } while (nextPageToken);

    return {
      total_processed: totalProcessed,
      new_emails: newEmails,
      updated_emails: updatedEmails,
      errors,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    };
  }

  /**
   * 存储邮件到数据库
   */
  private async storeEmails(emails: EmailMessageData[]): Promise<{
    created: number;
    updated: number;
    errors: number;
    error_details?: string[];
  }> {
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const email of emails) {
        try {
          // 检查邮件是否已存在
          const existingQuery = `
            SELECT id FROM email_messages 
            WHERE account_id = $1 AND message_id = $2
          `;
          const existingResult = await client.query(existingQuery, [email.account_id, email.message_id]);

          if (existingResult.rows.length > 0) {
            // 更新现有邮件
            const updateQuery = `
              UPDATE email_messages 
              SET 
                subject = $3,
                is_read = $4,
                importance = $5,
                updated_at = NOW()
              WHERE account_id = $1 AND message_id = $2
            `;
            
            await client.query(updateQuery, [
              email.account_id,
              email.message_id,
              email.subject,
              email.isRead,
              email.importance
            ]);
            updated++;
          } else {
            // 创建新邮件记录
            const insertQuery = `
              INSERT INTO email_messages (
                account_id, folder_id, message_id, internet_message_id, thread_id, conversation_id,
                subject, sender_email, sender_name, recipients, cc_recipients, bcc_recipients,
                body_text, body_html, preview_text, importance, sensitivity, is_read, is_flagged,
                is_draft, has_attachments, attachment_count, sent_at, received_at, analysis_status
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25
              )
            `;

            const values = [
              email.account_id,
              email.folder_id,
              email.message_id,
              email.internet_message_id,
              email.thread_id,
              email.conversation_id,
              email.subject,
              email.sender_email,
              email.sender_name || '',
              JSON.stringify(email.recipients || []),
              JSON.stringify(email.cc_recipients || []),
              JSON.stringify(email.bcc_recipients || []),
              email.body_text || '',
              email.body_html || '',
              email.preview_text || '',
              email.importance || 'normal',
              email.sensitivity || 'normal',
              email.isRead || false,
              email.is_flagged || false,
              email.is_draft || false,
              email.hasAttachments || false,
              email.attachment_count || 0,
              email.sent_at,
              email.received_at,
              'pending'
            ];

            await client.query(insertQuery, values);
            created++;
          }
        } catch (emailError) {
          logger.error('Failed to store individual email', {
            messageId: email.message_id,
            error: emailError
          });
          errors++;
          errorDetails.push(`Email ${email.message_id}: ${emailError.message}`);
        }
      }

      await client.query('COMMIT');
      
      logger.info('Batch email storage completed', { created, updated, errors });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      logger.error('Email storage transaction failed', { error: transactionError });
      throw transactionError;
    } finally {
      client.release();
    }

    return {
      created,
      updated,
      errors,
      error_details: errorDetails.length > 0 ? errorDetails : undefined
    };
  }

  /**
   * 转换Graph API邮件数据为内部邮件数据格式
   */
  private convertGraphEmailToEmailData(
    graphEmail: GraphEmailMessage,
    account_id: string,
    folder_id?: string
  ): EmailMessageData {
    // 转换收件人信息
    const recipients: EmailRecipient[] = (graphEmail.toRecipients || []).map(recipient => ({
      email: recipient.emailAddress.address,
      name: recipient.emailAddress.name || '',
      type: 'to' as const
    }));

    const cc_recipients: EmailRecipient[] = (graphEmail.ccRecipients || []).map(recipient => ({
      email: recipient.emailAddress.address,
      name: recipient.emailAddress.name || '',
      type: 'cc' as const
    }));

    // 提取纯文本内容
    let body_text = '';
    let body_html = '';
    
    if (graphEmail.body) {
      if (graphEmail.body.contentType === 'text') {
        body_text = graphEmail.body.content || '';
      } else if (graphEmail.body.contentType === 'html') {
        body_html = graphEmail.body.content || '';
        // 简单的HTML到文本转换
        body_text = body_html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    // 生成预览文本
    let preview_text = graphEmail.bodyPreview || '';
    if (!preview_text && body_text) {
      preview_text = body_text.substring(0, 150) + (body_text.length > 150 ? '...' : '');
    }

    return {
      id: graphEmail.id,
      account_id,
      folder_id,
      message_id: graphEmail.id,
      internet_message_id: graphEmail.internetMessageId,
      thread_id: graphEmail.conversationId,
      conversation_id: graphEmail.conversationId,
      subject: graphEmail.subject || '(无主题)',
      sender: graphEmail.from?.emailAddress?.address || '',
      sender_email: graphEmail.from?.emailAddress?.address || '',
      sender_name: graphEmail.from?.emailAddress?.name || '',
      recipients,
      cc_recipients: cc_recipients.length > 0 ? cc_recipients : undefined,
      body: body_text || body_html || '',
      body_text,
      body_html,
      preview_text,
      importance: this.mapImportance(graphEmail.importance),
      isRead: graphEmail.isRead || false,
      hasAttachments: graphEmail.hasAttachments || false,
      sent_at: new Date(graphEmail.sentDateTime),
      receivedAt: new Date(graphEmail.receivedDateTime),
      received_at: new Date(graphEmail.receivedDateTime),
      analysis_status: 'pending'
    };
  }

  /**
   * 映射重要性级别
   */
  private mapImportance(importance: 'low' | 'normal' | 'high'): 'low' | 'normal' | 'high' {
    return importance || 'normal';
  }

  /**
   * 获取有效的Microsoft令牌
   */
  private async getValidTokens(user_email: string): Promise<MicrosoftTokens> {
    try {
      const tokens = await this.authService.getStoredTokensByEmail(user_email);
      return await this.authService.ensureValidToken(tokens);
    } catch (error) {
      logger.error('Failed to get valid tokens', { user_email, error });
      throw new AuthenticationError(`Failed to get valid Microsoft tokens for ${user_email}`);
    }
  }

  /**
   * 获取要同步的文件夹列表
   */
  private async getSyncFolders(tokens: MicrosoftTokens, config: SyncConfiguration) {
    const allFolders = await this.graphService.getFolders(tokens);
    
    if (config.sync_folders && config.sync_folders.length > 0) {
      // 筛选指定的文件夹
      return allFolders.filter(folder => 
        config.sync_folders!.includes(folder.displayName) ||
        config.sync_folders!.includes(folder.id)
      );
    } else {
      // 默认同步常用文件夹
      const defaultFolders = ['Inbox', 'Sent Items', 'Drafts'];
      return allFolders.filter(folder => 
        defaultFolders.includes(folder.displayName)
      );
    }
  }

  /**
   * 估算总邮件数
   */
  private async estimateTotalEmails(tokens: MicrosoftTokens, folders: any[]): Promise<number> {
    return folders.reduce((total, folder) => total + (folder.totalItemCount || 0), 0);
  }

  /**
   * 创建同步操作记录
   */
  private async createSyncOperation(account_id: string, operation_type: string, operation_id: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO sync_operations (
          id, account_id, operation_type, status, started_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await client.query(query, [operation_id, account_id, operation_type, 'running']);
    } catch (error) {
      logger.error('Failed to create sync operation record', { error, operation_id });
    } finally {
      client.release();
    }
  }

  /**
   * 完成同步操作记录
   */
  private async completeSyncOperation(operation_id: string, result: any): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE sync_operations 
        SET 
          status = $2,
          completed_at = NOW(),
          total_items = $3,
          processed_items = $4,
          failed_items = $5,
          result_summary = $6
        WHERE id = $1
      `;
      
      await client.query(query, [
        operation_id,
        'completed',
        result.total_items,
        result.processed_items,
        result.failed_items,
        JSON.stringify(result.result_summary)
      ]);
    } catch (error) {
      logger.error('Failed to complete sync operation record', { error, operation_id });
    } finally {
      client.release();
    }
  }

  /**
   * 标记同步操作失败
   */
  private async failSyncOperation(operation_id: string, error_message: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE sync_operations 
        SET 
          status = $2,
          completed_at = NOW(),
          error_details = $3
        WHERE id = $1
      `;
      
      await client.query(query, [operation_id, 'failed', error_message]);
    } catch (error) {
      logger.error('Failed to mark sync operation as failed', { error, operation_id });
    } finally {
      client.release();
    }
  }

  /**
   * 更新账户同步状态
   */
  private async updateAccountSyncStatus(
    account_id: string, 
    success: boolean, 
    error_message?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE email_accounts 
        SET 
          last_sync_at = NOW(),
          sync_status = $2,
          error_message = $3,
          error_count = CASE 
            WHEN $2 = 'idle' THEN 0 
            ELSE error_count + 1 
          END
        WHERE id = $1
      `;
      
      await client.query(query, [
        account_id,
        success ? 'idle' : 'error',
        error_message
      ]);
    } catch (error) {
      logger.error('Failed to update account sync status', { error, account_id });
    } finally {
      client.release();
    }
  }

  /**
   * 获取同步进度
   */
  getSyncProgress(operation_id: string): SyncProgress | null {
    return this.activeSyncs.get(operation_id) || null;
  }

  /**
   * 获取所有活动同步操作
   */
  getActiveSyncs(): SyncProgress[] {
    return Array.from(this.activeSyncs.values());
  }

  /**
   * 取消同步操作
   */
  async cancelSync(operation_id: string): Promise<boolean> {
    const progress = this.activeSyncs.get(operation_id);
    if (progress) {
      progress.status = 'cancelled';
      await this.failSyncOperation(operation_id, 'Cancelled by user');
      return true;
    }
    return false;
  }
}

export default EmailSyncService.getInstance();