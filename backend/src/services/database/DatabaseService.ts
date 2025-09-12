import { Pool } from 'pg';
import { 
  EmailAccount, 
  UnifiedEmailMessage, 
  EmailSearchQuery,
  EmailProvider 
} from '../../types';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * 数据库服务类
 * 处理所有数据库操作，包括邮件账户、消息、监控数据等
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeDatabase();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库连接和表结构
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.pool.connect();
      logger.info('Database connection established');
      
      // 这里可以添加表结构检查和创建逻辑
      await this.createTablesIfNotExists();
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * 创建必要的数据表
   */
  private async createTablesIfNotExists(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 邮件账户表
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          provider VARCHAR(20) NOT NULL,
          email VARCHAR(255) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          is_connected BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMP,
          sync_status VARCHAR(20) DEFAULT 'idle',
          error_message TEXT,
          connection_config JSONB NOT NULL,
          folder_structure JSONB NOT NULL,
          sync_settings JSONB NOT NULL,
          quota_info JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 邮件消息表
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_messages (
          id VARCHAR(255) PRIMARY KEY,
          provider_id VARCHAR(255) NOT NULL,
          provider VARCHAR(20) NOT NULL,
          account_id UUID NOT NULL REFERENCES email_accounts(id),
          subject TEXT,
          sender_name VARCHAR(255),
          sender_address VARCHAR(255) NOT NULL,
          recipients JSONB NOT NULL,
          content JSONB,
          received_at TIMESTAMP NOT NULL,
          sent_at TIMESTAMP,
          importance VARCHAR(10) DEFAULT 'normal',
          is_read BOOLEAN DEFAULT false,
          is_draft BOOLEAN DEFAULT false,
          has_attachments BOOLEAN DEFAULT false,
          attachments JSONB DEFAULT '[]',
          labels JSONB DEFAULT '[]',
          folders JSONB DEFAULT '[]',
          flags JSONB DEFAULT '[]',
          conversation_id VARCHAR(255),
          thread_id VARCHAR(255),
          internet_message_id VARCHAR(255),
          metadata JSONB DEFAULT '{}',
          is_deleted BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 健康监控表
      await client.query(`
        CREATE TABLE IF NOT EXISTS health_metrics (
          id SERIAL PRIMARY KEY,
          overall_score FLOAT NOT NULL,
          overall_status VARCHAR(20) NOT NULL,
          service_stats JSONB NOT NULL,
          sync_stats JSONB NOT NULL,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 错误日志表
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_errors (
          id SERIAL PRIMARY KEY,
          account_id UUID REFERENCES email_accounts(id),
          provider VARCHAR(20) NOT NULL,
          error_type VARCHAR(50) NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          context JSONB DEFAULT '{}',
          occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 操作日志表
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_operations (
          id SERIAL PRIMARY KEY,
          account_id UUID NOT NULL REFERENCES email_accounts(id),
          operation_type VARCHAR(50) NOT NULL,
          operation_data JSONB NOT NULL,
          success BOOLEAN NOT NULL,
          error_message TEXT,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
        CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at);
        CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON email_messages(sender_address);
        CREATE INDEX IF NOT EXISTS idx_email_messages_subject ON email_messages USING gin(to_tsvector('english', subject));
        CREATE INDEX IF NOT EXISTS idx_email_errors_account_id ON email_errors(account_id);
        CREATE INDEX IF NOT EXISTS idx_email_errors_occurred_at ON email_errors(occurred_at);
      `);

      await client.query('COMMIT');
      logger.info('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create database tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 创建邮件账户
   */
  public async createEmailAccount(accountData: Partial<EmailAccount>): Promise<EmailAccount> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO email_accounts (
          user_id, provider, email, display_name, is_connected,
          connection_config, folder_structure, sync_settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        accountData.userId,
        accountData.provider,
        accountData.email,
        accountData.displayName,
        accountData.isConnected,
        JSON.stringify(accountData.connectionConfig),
        JSON.stringify(accountData.folderStructure),
        JSON.stringify(accountData.syncSettings)
      ];

      const result = await client.query(query, values);
      const account = this.mapRowToEmailAccount(result.rows[0]);
      
      logger.info(`Email account created: ${account.id}`);
      return account;
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件账户
   */
  public async getEmailAccount(accountId: string): Promise<EmailAccount | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_accounts WHERE id = $1';
      const result = await client.query(query, [accountId]);
      
      return result.rows[0] ? this.mapRowToEmailAccount(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的邮件账户列表
   */
  public async getUserEmailAccounts(userId: string): Promise<EmailAccount[]> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_accounts WHERE user_id = $1 ORDER BY created_at';
      const result = await client.query(query, [userId]);
      
      return result.rows.map(row => this.mapRowToEmailAccount(row));
    } finally {
      client.release();
    }
  }

  /**
   * 获取活跃的邮件账户
   */
  public async getActiveEmailAccounts(): Promise<EmailAccount[]> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_accounts WHERE is_connected = true ORDER BY created_at';
      const result = await client.query(query);
      
      return result.rows.map(row => this.mapRowToEmailAccount(row));
    } finally {
      client.release();
    }
  }

  /**
   * 更新邮件账户
   */
  public async updateEmailAccount(accountId: string, updateData: Partial<EmailAccount>): Promise<EmailAccount> {
    const client = await this.pool.connect();
    
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          const dbKey = this.camelToSnake(key);
          if (['connection_config', 'folder_structure', 'sync_settings', 'quota_info'].includes(dbKey)) {
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(accountId);

      const query = `
        UPDATE email_accounts 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return this.mapRowToEmailAccount(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * 删除邮件账户
   */
  public async deleteEmailAccount(accountId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 删除相关的邮件消息
      await client.query('DELETE FROM email_messages WHERE account_id = $1', [accountId]);
      
      // 删除相关的错误日志
      await client.query('DELETE FROM email_errors WHERE account_id = $1', [accountId]);
      
      // 删除相关的操作日志
      await client.query('DELETE FROM email_operations WHERE account_id = $1', [accountId]);
      
      // 删除账户
      await client.query('DELETE FROM email_accounts WHERE id = $1', [accountId]);
      
      await client.query('COMMIT');
      logger.info(`Email account deleted: ${accountId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 保存或更新邮件消息
   */
  public async saveOrUpdateEmailMessage(message: UnifiedEmailMessage): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO email_messages (
          id, provider_id, provider, account_id, subject,
          sender_name, sender_address, recipients, content,
          received_at, sent_at, importance, is_read, is_draft,
          has_attachments, attachments, labels, folders, flags,
          conversation_id, thread_id, internet_message_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (id) DO UPDATE SET
          subject = EXCLUDED.subject,
          is_read = EXCLUDED.is_read,
          is_draft = EXCLUDED.is_draft,
          labels = EXCLUDED.labels,
          folders = EXCLUDED.folders,
          flags = EXCLUDED.flags,
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        message.id,
        message.providerId,
        message.provider,
        message.accountId,
        message.subject,
        message.sender.name,
        message.sender.address,
        JSON.stringify(message.recipients),
        JSON.stringify(message.content),
        message.receivedAt,
        message.sentAt,
        message.importance,
        message.isRead,
        message.isDraft,
        message.hasAttachments,
        JSON.stringify(message.attachments),
        JSON.stringify(message.labels),
        JSON.stringify(message.folders),
        JSON.stringify(message.flags),
        message.conversationId,
        message.threadId,
        message.internetMessageId,
        JSON.stringify(message.metadata)
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件消息
   */
  public async getEmailMessage(messageId: string): Promise<UnifiedEmailMessage | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_messages WHERE id = $1 AND is_deleted = false';
      const result = await client.query(query, [messageId]);
      
      return result.rows[0] ? this.mapRowToEmailMessage(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件消息列表
   */
  public async getEmailMessages(accountId: string, searchQuery: EmailSearchQuery): Promise<UnifiedEmailMessage[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM email_messages WHERE account_id = $1 AND is_deleted = false';
      const values = [accountId];
      let paramIndex = 2;

      // 添加过滤条件
      if (searchQuery.from) {
        query += ` AND sender_address ILIKE $${paramIndex}`;
        values.push(`%${searchQuery.from}%`);
        paramIndex++;
      }

      if (searchQuery.subject) {
        query += ` AND subject ILIKE $${paramIndex}`;
        values.push(`%${searchQuery.subject}%`);
        paramIndex++;
      }

      if (searchQuery.isRead !== undefined) {
        query += ` AND is_read = $${paramIndex}`;
        values.push(searchQuery.isRead);
        paramIndex++;
      }

      if (searchQuery.dateRange) {
        query += ` AND received_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        values.push(searchQuery.dateRange.start, searchQuery.dateRange.end);
        paramIndex += 2;
      }

      // 排序
      const orderBy = searchQuery.orderBy === 'date' ? 'received_at' : 
                     searchQuery.orderBy === 'subject' ? 'subject' :
                     searchQuery.orderBy === 'from' ? 'sender_address' : 'received_at';
      
      query += ` ORDER BY ${orderBy} ${searchQuery.orderDirection || 'DESC'}`;

      // 分页
      if (searchQuery.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(searchQuery.limit);
        paramIndex++;
      }

      if (searchQuery.offset) {
        query += ` OFFSET $${paramIndex}`;
        values.push(searchQuery.offset);
        paramIndex++;
      }

      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToEmailMessage(row));
    } finally {
      client.release();
    }
  }

  /**
   * 搜索邮件消息
   */
  public async searchEmailMessages(accountId: string, searchQuery: EmailSearchQuery): Promise<UnifiedEmailMessage[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT * FROM email_messages 
        WHERE account_id = $1 AND is_deleted = false
      `;
      const values = [accountId];
      let paramIndex = 2;

      if (searchQuery.query) {
        query += ` AND (
          subject ILIKE $${paramIndex} OR
          sender_address ILIKE $${paramIndex} OR
          content->>'text' ILIKE $${paramIndex} OR
          content->>'html' ILIKE $${paramIndex}
        )`;
        values.push(`%${searchQuery.query}%`);
        paramIndex++;
      }

      // 其他过滤条件...

      query += ' ORDER BY received_at DESC';
      
      if (searchQuery.limit) {
        query += ` LIMIT ${searchQuery.limit}`;
      }

      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToEmailMessage(row));
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件消息数量
   */
  public async getEmailMessageCount(accountId: string, searchQuery: EmailSearchQuery): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT COUNT(*) FROM email_messages WHERE account_id = $1 AND is_deleted = false';
      const values = [accountId];
      
      // 添加过滤条件（与getEmailMessages类似）
      
      const result = await client.query(query, values);
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  /**
   * 更新邮件消息
   */
  public async updateEmailMessage(messageId: string, updateData: Partial<UnifiedEmailMessage>): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          const dbKey = this.camelToSnake(key);
          if (['recipients', 'content', 'attachments', 'labels', 'folders', 'flags', 'metadata'].includes(dbKey)) {
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(messageId);

      const query = `
        UPDATE email_messages 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * 标记邮件消息为已删除
   */
  public async markEmailMessageDeleted(messageId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = 'UPDATE email_messages SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
      await client.query(query, [messageId]);
    } finally {
      client.release();
    }
  }

  /**
   * 记录健康指标
   */
  public async recordHealthMetrics(healthData: any): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO health_metrics (overall_score, overall_status, service_stats, sync_stats)
        VALUES ($1, $2, $3, $4)
      `;
      
      const values = [
        healthData.score,
        healthData.status,
        JSON.stringify(healthData.services),
        JSON.stringify(healthData.sync)
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * 记录邮件错误
   */
  public async logEmailError(accountId: string, errorData: {
    type: string;
    message: string;
    stack?: string;
    provider: EmailProvider;
    timestamp: Date;
  }): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO email_errors (account_id, provider, error_type, error_message, error_stack, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        accountId,
        errorData.provider,
        errorData.type,
        errorData.message,
        errorData.stack,
        errorData.timestamp
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * 记录邮件操作
   */
  public async logEmailAction(accountId: string, action: string, data: any): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO email_operations (account_id, operation_type, operation_data, success)
        VALUES ($1, $2, $3, $4)
      `;
      
      const values = [
        accountId,
        action,
        JSON.stringify(data),
        true
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * 获取错误统计
   */
  public async getErrorStatistics(startDate: Date, endDate: Date): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      const queries = await Promise.all([
        // 总错误数
        client.query(
          'SELECT COUNT(*) as total FROM email_errors WHERE occurred_at BETWEEN $1 AND $2',
          [startDate, endDate]
        ),
        
        // 按提供商分组
        client.query(
          'SELECT provider, COUNT(*) as count FROM email_errors WHERE occurred_at BETWEEN $1 AND $2 GROUP BY provider',
          [startDate, endDate]
        ),
        
        // 按错误类型分组
        client.query(
          'SELECT error_type, COUNT(*) as count FROM email_errors WHERE occurred_at BETWEEN $1 AND $2 GROUP BY error_type',
          [startDate, endDate]
        ),
        
        // 最近的错误
        client.query(
          'SELECT * FROM email_errors WHERE occurred_at BETWEEN $1 AND $2 ORDER BY occurred_at DESC LIMIT 50',
          [startDate, endDate]
        )
      ]);

      return {
        totalErrors: parseInt(queries[0].rows[0].total),
        errorsByProvider: queries[1].rows.reduce((acc, row) => {
          acc[row.provider] = parseInt(row.count);
          return acc;
        }, {}),
        errorsByType: queries[2].rows.reduce((acc, row) => {
          acc[row.error_type] = parseInt(row.count);
          return acc;
        }, {}),
        recentErrors: queries[3].rows.map(row => ({
          timestamp: row.occurred_at,
          provider: row.provider,
          type: row.error_type,
          message: row.error_message,
          accountId: row.account_id
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 数据库行映射到EmailAccount对象
   */
  private mapRowToEmailAccount(row: any): EmailAccount {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      email: row.email,
      displayName: row.display_name,
      isConnected: row.is_connected,
      lastSyncAt: row.last_sync_at,
      syncStatus: row.sync_status,
      errorMessage: row.error_message,
      connectionConfig: row.connection_config,
      folderStructure: row.folder_structure,
      syncSettings: row.sync_settings,
      quotaInfo: row.quota_info,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 数据库行映射到UnifiedEmailMessage对象
   */
  private mapRowToEmailMessage(row: any): UnifiedEmailMessage {
    return {
      id: row.id,
      providerId: row.provider_id,
      provider: row.provider,
      accountId: row.account_id,
      subject: row.subject,
      sender: {
        name: row.sender_name,
        address: row.sender_address
      },
      recipients: row.recipients,
      content: row.content,
      receivedAt: row.received_at,
      sentAt: row.sent_at,
      importance: row.importance,
      isRead: row.is_read,
      isDraft: row.is_draft,
      hasAttachments: row.has_attachments,
      attachments: row.attachments,
      labels: row.labels,
      folders: row.folders,
      flags: row.flags,
      conversationId: row.conversation_id,
      threadId: row.thread_id,
      internetMessageId: row.internet_message_id,
      metadata: row.metadata
    };
  }

  /**
   * 驼峰转蛇形命名
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * 关闭数据库连接
   */
  public async shutdown(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection closed');
  }
}