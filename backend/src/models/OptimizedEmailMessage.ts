/**
 * Optimized EmailMessage Model
 * 优化版邮件消息数据模型，专注于高性能查询
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import RedisManager from '@/config/redis';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

// 导入原始接口
import { 
  EmailMessage, 
  CreateEmailMessageData, 
  EmailMessageFilters, 
  EmailMessageStats 
} from './EmailMessage';

export interface OptimizedEmailMessageFilters extends EmailMessageFilters {
  cursor?: string; // 用于游标分页
  useFullTextSearch?: boolean; // 是否使用全文搜索
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total?: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
    currentPage?: number;
    totalPages?: number;
  };
}

export class OptimizedEmailMessageModel {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  private redis = RedisManager;
  private readonly CACHE_TTL = 300; // 5分钟缓存

  constructor() {}

  /**
   * 高性能游标分页查询
   * 使用游标分页避免大偏移量性能问题
   */
  async findManyWithCursor(
    filters: OptimizedEmailMessageFilters = {},
    limit: number = 20
  ): Promise<PaginationResult<EmailMessage>> {
    const cacheKey = this.buildCacheKey('emails', filters, limit);
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<PaginationResult<EmailMessage>>(cacheKey);
    if (cachedResult) {
      logger.debug('Cache hit for email query', { cacheKey });
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const startTime = Date.now();
      
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

      // 优化的全文搜索
      if (filters.search) {
        if (filters.useFullTextSearch) {
          // 使用GIN索引进行全文搜索
          whereConditions.push(`(
            to_tsvector('english', subject) @@ plainto_tsquery('english', $${paramIndex++}) OR
            to_tsvector('english', COALESCE(body_text, '')) @@ plainto_tsquery('english', $${paramIndex++})
          )`);
          queryParams.push(filters.search, filters.search);
          paramIndex++;
        } else {
          // 使用ILIKE作为备选方案
          whereConditions.push(`(subject ILIKE $${paramIndex++} OR body_text ILIKE $${paramIndex++})`);
          const searchPattern = `%${filters.search}%`;
          queryParams.push(searchPattern, searchPattern);
          paramIndex++;
        }
      }

      // 游标分页处理
      if (filters.cursor) {
        whereConditions.push(`received_at < $${paramIndex++}`);
        queryParams.push(new Date(filters.cursor));
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取数据（多取1条来判断是否有下一页）
      const dataQuery = `
        SELECT 
          id, user_id, account_id, message_id, thread_id, subject,
          from_data, to_data, cc_data, bcc_data, received_at,
          body_text, body_html, has_attachments, is_read, importance,
          categories, folder_path, created_at, updated_at
        FROM email_messages 
        ${whereClause}
        ORDER BY received_at DESC
        LIMIT $${paramIndex++}
      `;
      queryParams.push(limit + 1);

      const dataResult = await client.query(dataQuery, queryParams);
      
      // 处理分页结果
      const hasMore = dataResult.rows.length > limit;
      const emails = hasMore ? dataResult.rows.slice(0, -1) : dataResult.rows;
      const nextCursor = hasMore && emails.length > 0 
        ? emails[emails.length - 1].received_at.toISOString()
        : undefined;

      const result: PaginationResult<EmailMessage> = {
        data: emails.map(row => this.mapRowToEmailMessage(row)),
        pagination: {
          hasMore,
          nextCursor
        }
      };

      const queryTime = Date.now() - startTime;
      logger.dbOperation('SELECT', 'optimized_email_query', queryTime);

      // 缓存结果
      await this.redis.set(cacheKey, result, this.CACHE_TTL);

      return result;
      
    } catch (error) {
      logger.error('Failed to find email messages with cursor', { error, filters });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量获取邮件统计信息（使用物化视图）
   */
  async getBatchStats(
    userIds: string[],
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<Record<string, EmailMessageStats>> {
    const cacheKey = `batch_stats:${userIds.join(',')}_${dateFrom?.toISOString() || 'null'}_${dateTo?.toISOString() || 'null'}`;
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<Record<string, EmailMessageStats>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const startTime = Date.now();
      
      let whereConditions: string[] = ['user_id = ANY($1)'];
      let queryParams: any[] = [userIds];
      let paramIndex = 2;

      if (dateFrom) {
        whereConditions.push(`date >= $${paramIndex++}`);
        queryParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push(`date <= $${paramIndex++}`);
        queryParams.push(dateTo);
      }

      const whereClause = whereConditions.join(' AND ');

      // 使用物化视图进行统计查询
      const statsQuery = `
        SELECT 
          user_id,
          SUM(total_emails)::INTEGER as total,
          SUM(unread_emails)::INTEGER as unread,
          SUM(high_importance_emails)::INTEGER as high_importance,
          SUM(total_emails - high_importance_emails)::INTEGER as normal_low_importance
        FROM mv_email_statistics
        WHERE ${whereClause}
        GROUP BY user_id
      `;

      const statsResult = await client.query(statsQuery, queryParams);
      
      // 获取文件夹统计
      const folderStatsQuery = `
        SELECT 
          user_id,
          folder_path,
          COUNT(*)::INTEGER as count
        FROM email_messages
        WHERE user_id = ANY($1)
        ${dateFrom ? `AND received_at >= $${paramIndex++}` : ''}
        ${dateTo ? `AND received_at <= $${paramIndex++}` : ''}
        GROUP BY user_id, folder_path
      `;
      
      if (dateFrom) queryParams.push(dateFrom);
      if (dateTo) queryParams.push(dateTo);

      const folderResult = await client.query(folderStatsQuery, queryParams.slice(0, dateFrom || dateTo ? (dateFrom && dateTo ? 3 : 2) : 1));

      // 构建结果
      const result: Record<string, EmailMessageStats> = {};
      
      // 基础统计
      statsResult.rows.forEach(row => {
        result[row.user_id] = {
          total: row.total || 0,
          unread: row.unread || 0,
          byImportance: {
            high: row.high_importance || 0,
            normal: Math.floor((row.normal_low_importance || 0) * 0.8), // 估算normal
            low: Math.floor((row.normal_low_importance || 0) * 0.2) // 估算low
          },
          byFolder: {}
        };
      });

      // 文件夹统计
      folderResult.rows.forEach(row => {
        if (result[row.user_id]) {
          result[row.user_id].byFolder[row.folder_path] = row.count;
        }
      });

      const queryTime = Date.now() - startTime;
      logger.dbOperation('SELECT', 'batch_stats_query', queryTime);

      // 缓存结果
      await this.redis.set(cacheKey, result, this.CACHE_TTL);

      return result;

    } catch (error) {
      logger.error('Failed to get batch stats', { error, userIds });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 高性能批量创建邮件（使用UNNEST批量插入）
   */
  async bulkCreate(emails: CreateEmailMessageData[]): Promise<EmailMessage[]> {
    if (emails.length === 0) return [];

    const client = await this.pool.connect();
    
    try {
      const startTime = Date.now();
      
      await client.query('BEGIN');

      // 准备批量数据
      const ids = emails.map(() => uuidv4());
      const now = new Date();
      
      const userIds = emails.map(e => e.userId);
      const accountIds = emails.map(e => e.accountId);
      const messageIds = emails.map(e => e.messageId);
      const threadIds = emails.map(e => e.threadId || null);
      const subjects = emails.map(e => e.subject);
      const fromData = emails.map(e => JSON.stringify(e.from));
      const toData = emails.map(e => JSON.stringify(e.to));
      const ccData = emails.map(e => e.cc ? JSON.stringify(e.cc) : null);
      const bccData = emails.map(e => e.bcc ? JSON.stringify(e.bcc) : null);
      const receivedAts = emails.map(e => e.receivedAt);
      const bodyTexts = emails.map(e => e.bodyText || null);
      const bodyHtmls = emails.map(e => e.bodyHtml || null);
      const hasAttachments = emails.map(e => e.hasAttachments);
      const isReads = emails.map(e => e.isRead);
      const importances = emails.map(e => e.importance);
      const categories = emails.map(e => e.categories || []);
      const folderPaths = emails.map(e => e.folderPath);
      const rawData = emails.map(e => e.rawData ? JSON.stringify(e.rawData) : null);

      // 使用UNNEST进行批量插入
      const bulkInsertQuery = `
        INSERT INTO email_messages (
          id, user_id, account_id, message_id, thread_id, subject,
          from_data, to_data, cc_data, bcc_data, received_at,
          body_text, body_html, has_attachments, is_read, importance,
          categories, folder_path, raw_data, created_at, updated_at
        )
        SELECT * FROM UNNEST (
          $1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[],
          $7::jsonb[], $8::jsonb[], $9::jsonb[], $10::jsonb[], $11::timestamptz[],
          $12::text[], $13::text[], $14::boolean[], $15::boolean[], $16::text[],
          $17::text[][], $18::text[], $19::jsonb[], $20::timestamptz[], $21::timestamptz[]
        )
        ON CONFLICT (user_id, message_id) DO NOTHING
        RETURNING *
      `;

      const values = [
        ids, userIds, accountIds, messageIds, threadIds, subjects,
        fromData, toData, ccData, bccData, receivedAts,
        bodyTexts, bodyHtmls, hasAttachments, isReads, importances,
        categories, folderPaths, rawData, 
        Array(emails.length).fill(now), Array(emails.length).fill(now)
      ];

      const result = await client.query(bulkInsertQuery, values);
      
      await client.query('COMMIT');
      
      const queryTime = Date.now() - startTime;
      logger.dbOperation('INSERT', 'bulk_email_create', queryTime);
      logger.info(`Bulk created ${result.rows.length} email messages`);

      // 清除相关缓存
      await this.invalidateCache(['emails', 'stats']);

      return result.rows.map(row => this.mapRowToEmailMessage(row));

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to bulk create email messages', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 高性能批量更新已读状态
   */
  async bulkUpdateReadStatus(
    emailIds: string[], 
    isRead: boolean,
    userId: string
  ): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const startTime = Date.now();
      
      const query = `
        UPDATE email_messages 
        SET is_read = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ANY($2) AND user_id = $3
      `;
      
      const result = await client.query(query, [isRead, emailIds, userId]);
      
      const queryTime = Date.now() - startTime;
      logger.dbOperation('UPDATE', 'bulk_read_status_update', queryTime);
      logger.info(`Updated read status for ${result.rowCount} emails`);

      // 清除相关缓存
      await this.invalidateCache(['emails', 'stats'], userId);

      return result.rowCount;

    } catch (error) {
      logger.error('Failed to bulk update read status', { error, emailIds, isRead, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取热门发件人（缓存优化）
   */
  async getTopSenders(userId: string, limit: number = 10): Promise<Array<{sender: string, count: number}>> {
    const cacheKey = `top_senders:${userId}:${limit}`;
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<Array<{sender: string, count: number}>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          from_data->>'email' as sender,
          COUNT(*)::INTEGER as count
        FROM email_messages 
        WHERE user_id = $1
        AND received_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY from_data->>'email'
        ORDER BY count DESC
        LIMIT $2
      `;

      const result = await client.query(query, [userId, limit]);
      const topSenders = result.rows;

      // 缓存结果
      await this.redis.set(cacheKey, topSenders, this.CACHE_TTL * 2); // 更长的缓存时间

      return topSenders;

    } catch (error) {
      logger.error('Failed to get top senders', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 智能搜索建议（基于历史搜索）
   */
  async getSearchSuggestions(userId: string, query: string, limit: number = 5): Promise<string[]> {
    const client = await this.pool.connect();
    
    try {
      const searchQuery = `
        SELECT DISTINCT subject
        FROM email_messages 
        WHERE user_id = $1
        AND subject ILIKE $2
        ORDER BY received_at DESC
        LIMIT $3
      `;

      const result = await client.query(searchQuery, [userId, `%${query}%`, limit]);
      return result.rows.map(row => row.subject);

    } catch (error) {
      logger.error('Failed to get search suggestions', { error, userId, query });
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(prefix: string, filters: any, limit?: number): string {
    const filterKeys = Object.keys(filters).sort().map(key => `${key}:${filters[key]}`);
    const keyParts = [prefix, ...filterKeys];
    if (limit) keyParts.push(`limit:${limit}`);
    return keyParts.join('|');
  }

  /**
   * 清除相关缓存
   */
  private async invalidateCache(prefixes: string[], userId?: string): Promise<void> {
    try {
      const patterns = prefixes.map(prefix => 
        userId ? `${prefix}*${userId}*` : `${prefix}*`
      );

      for (const pattern of patterns) {
        await this.redis.deletePattern(pattern);
      }

      logger.debug('Cache invalidated', { patterns });
    } catch (error) {
      logger.warn('Failed to invalidate cache', { error, prefixes, userId });
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

export default OptimizedEmailMessageModel;