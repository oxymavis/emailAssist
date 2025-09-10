/**
 * EmailAnalysis Model
 * 邮件AI分析结果数据模型
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

export interface SentimentAnalysis {
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
  };
}

export interface PriorityAnalysis {
  level: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  reasons: string[];
}

export interface CategoryAnalysis {
  primary: string;
  secondary?: string;
  confidence: number;
}

export interface EntityAnalysis {
  type: 'person' | 'organization' | 'location' | 'datetime' | 'project' | 'task';
  value: string;
  confidence: number;
}

export interface SuggestedAction {
  type: 'reply' | 'forward' | 'create_task' | 'escalate' | 'archive' | 'schedule';
  description: string;
  priority: number;
  metadata?: any;
}

export interface EmailAnalysis {
  id: string;
  emailId: string;
  analysisVersion: string;
  sentiment: SentimentAnalysis;
  priority: PriorityAnalysis;
  category: CategoryAnalysis;
  keywords: string[];
  entities: EntityAnalysis[];
  summary: string;
  suggestedActions: SuggestedAction[];
  processingTime: number; // 处理时间（毫秒）
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailAnalysisData {
  emailId: string;
  analysisVersion: string;
  sentiment: SentimentAnalysis;
  priority: PriorityAnalysis;
  category: CategoryAnalysis;
  keywords: string[];
  entities: EntityAnalysis[];
  summary: string;
  suggestedActions: SuggestedAction[];
  processingTime: number;
}

export interface AnalysisFilters {
  emailId?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  sentiment?: 'positive' | 'negative' | 'neutral';
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AnalysisStats {
  total: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  bySentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  averageProcessingTime: number;
  topCategories: Array<{ category: string; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export class EmailAnalysisModel {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  constructor() {
    // Pool will be obtained lazily when needed
  }

  /**
   * 创建邮件分析记录
   */
  async create(data: CreateEmailAnalysisData): Promise<EmailAnalysis> {
    const client = await this.pool.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();
      
      const query = `
        INSERT INTO email_analysis (
          id, email_id, analysis_version, sentiment_data, priority_data,
          category_data, keywords, entities_data, summary, suggested_actions_data,
          processing_time, analyzed_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `;

      const values = [
        id,
        data.emailId,
        data.analysisVersion,
        JSON.stringify(data.sentiment),
        JSON.stringify(data.priority),
        JSON.stringify(data.category),
        data.keywords,
        JSON.stringify(data.entities),
        data.summary,
        JSON.stringify(data.suggestedActions),
        data.processingTime,
        now,
        now,
        now
      ];

      const result = await client.query(query, values);
      const row = result.rows[0];

      logger.info('Email analysis created', { 
        id, 
        emailId: data.emailId, 
        priority: data.priority.level,
        sentiment: data.sentiment.label 
      });

      return this.mapRowToEmailAnalysis(row);
    } catch (error) {
      logger.error('Failed to create email analysis', { error, data });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据ID获取分析结果
   */
  async findById(id: string): Promise<EmailAnalysis | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_analysis WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEmailAnalysis(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find email analysis by id', { error, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据邮件ID获取分析结果
   */
  async findByEmailId(emailId: string): Promise<EmailAnalysis | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM email_analysis 
        WHERE email_id = $1 
        ORDER BY analyzed_at DESC 
        LIMIT 1
      `;
      const result = await client.query(query, [emailId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEmailAnalysis(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find email analysis by email id', { error, emailId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取分析结果列表（支持分页和筛选）
   */
  async findMany(
    filters: AnalysisFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ analyses: EmailAnalysis[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // 构建WHERE条件
      if (filters.emailId) {
        whereConditions.push(`email_id = $${paramIndex++}`);
        queryParams.push(filters.emailId);
      }

      if (filters.priority) {
        whereConditions.push(`priority_data->>'level' = $${paramIndex++}`);
        queryParams.push(filters.priority);
      }

      if (filters.sentiment) {
        whereConditions.push(`sentiment_data->>'label' = $${paramIndex++}`);
        queryParams.push(filters.sentiment);
      }

      if (filters.category) {
        whereConditions.push(`category_data->>'primary' = $${paramIndex++}`);
        queryParams.push(filters.category);
      }

      if (filters.dateFrom) {
        whereConditions.push(`analyzed_at >= $${paramIndex++}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        whereConditions.push(`analyzed_at <= $${paramIndex++}`);
        queryParams.push(filters.dateTo);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取总数
      const countQuery = `SELECT COUNT(*) FROM email_analysis ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 获取分页数据
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM email_analysis 
        ${whereClause}
        ORDER BY analyzed_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      queryParams.push(limit, offset);

      const dataResult = await client.query(dataQuery, queryParams);
      const analyses = dataResult.rows.map(row => this.mapRowToEmailAnalysis(row));

      return { analyses, total };
    } catch (error) {
      logger.error('Failed to find email analyses', { error, filters });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新分析结果
   */
  async update(id: string, data: Partial<CreateEmailAnalysisData>): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.sentiment) {
        updates.push(`sentiment_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.sentiment));
      }

      if (data.priority) {
        updates.push(`priority_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.priority));
      }

      if (data.category) {
        updates.push(`category_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.category));
      }

      if (data.keywords) {
        updates.push(`keywords = $${paramIndex++}`);
        values.push(data.keywords);
      }

      if (data.entities) {
        updates.push(`entities_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.entities));
      }

      if (data.summary) {
        updates.push(`summary = $${paramIndex++}`);
        values.push(data.summary);
      }

      if (data.suggestedActions) {
        updates.push(`suggested_actions_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.suggestedActions));
      }

      if (updates.length === 0) {
        return false;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE email_analysis 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
      `;

      const result = await client.query(query, values);
      
      logger.info('Email analysis updated', { id });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to update email analysis', { error, id, data });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除分析结果
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM email_analysis WHERE id = $1';
      const result = await client.query(query, [id]);
      
      logger.info('Email analysis deleted', { id });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete email analysis', { error, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据邮件ID删除分析结果
   */
  async deleteByEmailId(emailId: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM email_analysis WHERE email_id = $1';
      const result = await client.query(query, [emailId]);
      
      logger.info('Email analysis deleted by email id', { emailId, count: result.rowCount });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete email analysis by email id', { error, emailId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取分析统计信息
   */
  async getStats(userId?: string): Promise<AnalysisStats> {
    const client = await this.pool.connect();
    
    try {
      let joinClause = '';
      let whereClause = '';
      let queryParams: any[] = [];

      if (userId) {
        joinClause = 'JOIN email_messages em ON ea.email_id = em.id';
        whereClause = 'WHERE em.user_id = $1';
        queryParams.push(userId);
      }

      // 基础统计
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN priority_data->>'level' = 'critical' THEN 1 END) as critical_priority,
          COUNT(CASE WHEN priority_data->>'level' = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority_data->>'level' = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority_data->>'level' = 'low' THEN 1 END) as low_priority,
          COUNT(CASE WHEN sentiment_data->>'label' = 'positive' THEN 1 END) as positive_sentiment,
          COUNT(CASE WHEN sentiment_data->>'label' = 'negative' THEN 1 END) as negative_sentiment,
          COUNT(CASE WHEN sentiment_data->>'label' = 'neutral' THEN 1 END) as neutral_sentiment,
          AVG(processing_time) as avg_processing_time
        FROM email_analysis ea ${joinClause} ${whereClause}
      `;

      const basicResult = await client.query(basicStatsQuery, queryParams);
      const basic = basicResult.rows[0];

      // 分类统计
      const categoryStatsQuery = `
        SELECT category_data->>'primary' as category, COUNT(*) as count
        FROM email_analysis ea ${joinClause} ${whereClause}
        GROUP BY category_data->>'primary'
        ORDER BY count DESC
        LIMIT 10
      `;

      const categoryResult = await client.query(categoryStatsQuery, queryParams);
      const topCategories = categoryResult.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      }));

      // 关键词统计
      const keywordStatsQuery = `
        SELECT keyword, COUNT(*) as count
        FROM (
          SELECT unnest(keywords) as keyword
          FROM email_analysis ea ${joinClause} ${whereClause}
        ) as keywords_expanded
        GROUP BY keyword
        ORDER BY count DESC
        LIMIT 20
      `;

      const keywordResult = await client.query(keywordStatsQuery, queryParams);
      const topKeywords = keywordResult.rows.map(row => ({
        keyword: row.keyword,
        count: parseInt(row.count)
      }));

      return {
        total: parseInt(basic.total),
        byPriority: {
          critical: parseInt(basic.critical_priority),
          high: parseInt(basic.high_priority),
          medium: parseInt(basic.medium_priority),
          low: parseInt(basic.low_priority)
        },
        bySentiment: {
          positive: parseInt(basic.positive_sentiment),
          negative: parseInt(basic.negative_sentiment),
          neutral: parseInt(basic.neutral_sentiment)
        },
        averageProcessingTime: parseFloat(basic.avg_processing_time) || 0,
        topCategories,
        topKeywords
      };
    } catch (error) {
      logger.error('Failed to get analysis stats', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量创建分析结果
   */
  async createMany(analyses: CreateEmailAnalysisData[]): Promise<EmailAnalysis[]> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: EmailAnalysis[] = [];
      
      for (const analysisData of analyses) {
        const existing = await this.findByEmailId(analysisData.emailId);
        if (existing) {
          // 更新现有分析
          await this.update(existing.id, analysisData);
          const updated = await this.findById(existing.id);
          if (updated) results.push(updated);
        } else {
          // 创建新分析
          const created = await this.create(analysisData);
          results.push(created);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Bulk email analyses processed', { count: results.length });
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create email analyses in bulk', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 将数据库行映射为分析对象
   */
  private mapRowToEmailAnalysis(row: any): EmailAnalysis {
    return {
      id: row.id,
      emailId: row.email_id,
      analysisVersion: row.analysis_version,
      sentiment: JSON.parse(row.sentiment_data),
      priority: JSON.parse(row.priority_data),
      category: JSON.parse(row.category_data),
      keywords: row.keywords || [],
      entities: JSON.parse(row.entities_data || '[]'),
      summary: row.summary,
      suggestedActions: JSON.parse(row.suggested_actions_data || '[]'),
      processingTime: row.processing_time,
      analyzedAt: new Date(row.analyzed_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default EmailAnalysisModel;