/**
 * EmailMessage Model
 * 邮件消息数据模型
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

export interface EmailSender {
  name: string;
  email: string;
}

export interface EmailRecipient {
  name: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  userId: string;
  accountId: string;
  messageId: string;
  threadId?: string;
  subject: string;
  from: EmailSender;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  isRead: boolean;
  importance: 'high' | 'normal' | 'low';
  categories: string[];
  folderPath: string;
  rawData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailMessageData {
  userId: string;
  accountId: string;
  messageId: string;
  threadId?: string;
  subject: string;
  from: EmailSender;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  isRead: boolean;
  importance: 'high' | 'normal' | 'low';
  categories?: string[];
  folderPath: string;
  rawData?: any;
}

export interface EmailMessageFilters {
  userId?: string;
  accountId?: string;
  isRead?: boolean;
  importance?: 'high' | 'normal' | 'low';
  folderPath?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface EmailMessageStats {
  total: number;
  unread: number;
  byImportance: {
    high: number;
    normal: number;
    low: number;
  };
  byFolder: Record<string, number>;
}

export class EmailMessageModel {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  constructor() {
    // Pool will be obtained lazily when needed
  }

  /**
   * 创建邮件消息记录
   */
  async create(data: CreateEmailMessageData): Promise<EmailMessage> {
    const client = await this.pool.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();
      
      const query = `
        INSERT INTO email_messages (
          id, user_id, account_id, message_id, thread_id, subject,
          from_data, to_data, cc_data, bcc_data, received_at,
          body_text, body_html, has_attachments, is_read, importance,
          categories, folder_path, raw_data, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *
      `;

      const values = [
        id,
        data.userId,
        data.accountId,
        data.messageId,
        data.threadId || null,
        data.subject,
        JSON.stringify(data.from),
        JSON.stringify(data.to),
        data.cc ? JSON.stringify(data.cc) : null,
        data.bcc ? JSON.stringify(data.bcc) : null,
        data.receivedAt,
        data.bodyText || null,
        data.bodyHtml || null,
        data.hasAttachments,
        data.isRead,
        data.importance,
        data.categories || [],
        data.folderPath,
        data.rawData ? JSON.stringify(data.rawData) : null,
        now,
        now
      ];

      const result = await client.query(query, values);
      const row = result.rows[0];

      logger.info('Email message created', { id, messageId: data.messageId });

      return this.mapRowToEmailMessage(row);
    } catch (error) {
      logger.error('Failed to create email message', { error, data });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据ID获取邮件消息
   */
  async findById(id: string): Promise<EmailMessage | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_messages WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEmailMessage(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find email message by id', { error, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据消息ID获取邮件
   */
  async findByMessageId(messageId: string, userId: string): Promise<EmailMessage | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_messages WHERE message_id = $1 AND user_id = $2';
      const result = await client.query(query, [messageId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEmailMessage(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find email message by message id', { error, messageId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件列表（支持分页和筛选）
   */
  async findMany(
    filters: EmailMessageFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ emails: EmailMessage[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // 构建WHERE条件
      if (filters.userId) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        queryParams.push(filters.userId);
      }

      if (filters.accountId) {
        whereConditions.push(`account_id = $${paramIndex++}`);
        queryParams.push(filters.accountId);
      }

      if (filters.isRead !== undefined) {
        whereConditions.push(`is_read = $${paramIndex++}`);
        queryParams.push(filters.isRead);
      }

      if (filters.importance) {
        whereConditions.push(`importance = $${paramIndex++}`);
        queryParams.push(filters.importance);
      }

      if (filters.folderPath) {
        whereConditions.push(`folder_path = $${paramIndex++}`);
        queryParams.push(filters.folderPath);
      }

      if (filters.dateFrom) {
        whereConditions.push(`received_at >= $${paramIndex++}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        whereConditions.push(`received_at <= $${paramIndex++}`);
        queryParams.push(filters.dateTo);
      }

      if (filters.search) {
        whereConditions.push(`(subject ILIKE $${paramIndex++} OR body_text ILIKE $${paramIndex++})`);
        const searchPattern = `%${filters.search}%`;
        queryParams.push(searchPattern, searchPattern);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取总数
      const countQuery = `SELECT COUNT(*) FROM email_messages ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 获取分页数据
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM email_messages 
        ${whereClause}
        ORDER BY received_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      queryParams.push(limit, offset);

      const dataResult = await client.query(dataQuery, queryParams);
      const emails = dataResult.rows.map(row => this.mapRowToEmailMessage(row));

      return { emails, total };
    } catch (error) {
      logger.error('Failed to find email messages', { error, filters });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新邮件已读状态
   */
  async updateReadStatus(id: string, isRead: boolean): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE email_messages 
        SET is_read = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `;
      const result = await client.query(query, [isRead, id]);
      
      logger.info('Email message read status updated', { id, isRead });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to update email message read status', { error, id, isRead });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取邮件统计信息
   */
  async getStats(userId: string, accountId?: string): Promise<EmailMessageStats> {
    const client = await this.pool.connect();
    
    try {
      let whereClause = 'WHERE user_id = $1';
      let queryParams: any[] = [userId];
      
      if (accountId) {
        whereClause += ' AND account_id = $2';
        queryParams.push(accountId);
      }

      // 基础统计
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
          COUNT(CASE WHEN importance = 'high' THEN 1 END) as high_importance,
          COUNT(CASE WHEN importance = 'normal' THEN 1 END) as normal_importance,
          COUNT(CASE WHEN importance = 'low' THEN 1 END) as low_importance
        FROM email_messages ${whereClause}
      `;

      const basicResult = await client.query(basicStatsQuery, queryParams);
      const basic = basicResult.rows[0];

      // 按文件夹统计
      const folderStatsQuery = `
        SELECT folder_path, COUNT(*) as count
        FROM email_messages ${whereClause}
        GROUP BY folder_path
      `;

      const folderResult = await client.query(folderStatsQuery, queryParams);
      const byFolder: Record<string, number> = {};
      folderResult.rows.forEach(row => {
        byFolder[row.folder_path] = parseInt(row.count);
      });

      return {
        total: parseInt(basic.total),
        unread: parseInt(basic.unread),
        byImportance: {
          high: parseInt(basic.high_importance),
          normal: parseInt(basic.normal_importance),
          low: parseInt(basic.low_importance)
        },
        byFolder
      };
    } catch (error) {
      logger.error('Failed to get email message stats', { error, userId, accountId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除邮件消息
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM email_messages WHERE id = $1';
      const result = await client.query(query, [id]);
      
      logger.info('Email message deleted', { id });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete email message', { error, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量创建邮件消息
   */
  async createMany(emails: CreateEmailMessageData[]): Promise<EmailMessage[]> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: EmailMessage[] = [];
      
      for (const emailData of emails) {
        const existing = await this.findByMessageId(emailData.messageId, emailData.userId);
        if (!existing) {
          const created = await this.create(emailData);
          results.push(created);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Bulk email messages created', { count: results.length });
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create email messages in bulk', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 将数据库行映射为邮件消息对象
   */
  private mapRowToEmailMessage(row: any): EmailMessage {
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      messageId: row.message_id,
      threadId: row.thread_id,
      subject: row.subject,
      from: JSON.parse(row.from_data),
      to: JSON.parse(row.to_data),
      cc: row.cc_data ? JSON.parse(row.cc_data) : undefined,
      bcc: row.bcc_data ? JSON.parse(row.bcc_data) : undefined,
      receivedAt: new Date(row.received_at),
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      hasAttachments: row.has_attachments,
      isRead: row.is_read,
      importance: row.importance,
      categories: row.categories || [],
      folderPath: row.folder_path,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default EmailMessageModel;