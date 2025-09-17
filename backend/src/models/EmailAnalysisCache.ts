/**
 * Email Analysis Cache Model
 * 邮件AI分析结果缓存模型
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

export interface EmailAnalysisData {
  id?: string;
  message_id: string;
  sentiment_score: number; // -1 to 1
  sentiment_label: 'negative' | 'neutral' | 'positive';
  priority_score: number; // 0 to 1
  priority_label: 'low' | 'medium' | 'high' | 'urgent';
  keywords: string[];
  entities: EntityData[];
  topics: string[];
  language_detected?: string;
  category?: string;
  is_spam?: boolean;
  spam_score?: number;
  is_promotional?: boolean;
  is_automated?: boolean;
  urgency_indicators: string[];
  action_required?: boolean;
  estimated_response_time?: number; // in minutes
  model_version?: string;
  analysis_date?: Date;
  analysis_duration_ms?: number;
  confidence_score?: number;
  created_at?: Date;
}

export interface EntityData {
  type: 'person' | 'organization' | 'location' | 'datetime' | 'project' | 'task';
  value: string;
  confidence: number;
}

export interface AnalysisQuery {
  message_ids?: string[];
  sentiment_label?: 'negative' | 'neutral' | 'positive';
  priority_label?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  is_spam?: boolean;
  action_required?: boolean;
  language_detected?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface AnalysisStats {
  total_analyzed: number;
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  priority_distribution: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  categories: Record<string, number>;
  avg_confidence_score: number;
  avg_analysis_duration_ms: number;
  spam_detection: {
    total_spam: number;
    spam_percentage: number;
  };
  action_required_count: number;
}

export class EmailAnalysisCacheModel {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  constructor() {
    // Pool will be obtained lazily when needed
  }

  /**
   * 保存分析结果到缓存
   */
  async create(analysisData: EmailAnalysisData): Promise<EmailAnalysisData> {
    const client = await this.pool.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();
      
      const query = `
        INSERT INTO email_analysis_cache (
          id, message_id, sentiment_score, sentiment_label, priority_score, priority_label,
          keywords, entities, topics, language_detected, category, is_spam, spam_score,
          is_promotional, is_automated, urgency_indicators, action_required,
          estimated_response_time, model_version, analysis_date, analysis_duration_ms,
          confidence_score, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        )
        ON CONFLICT (message_id) DO UPDATE SET
          sentiment_score = EXCLUDED.sentiment_score,
          sentiment_label = EXCLUDED.sentiment_label,
          priority_score = EXCLUDED.priority_score,
          priority_label = EXCLUDED.priority_label,
          keywords = EXCLUDED.keywords,
          entities = EXCLUDED.entities,
          topics = EXCLUDED.topics,
          language_detected = EXCLUDED.language_detected,
          category = EXCLUDED.category,
          is_spam = EXCLUDED.is_spam,
          spam_score = EXCLUDED.spam_score,
          is_promotional = EXCLUDED.is_promotional,
          is_automated = EXCLUDED.is_automated,
          urgency_indicators = EXCLUDED.urgency_indicators,
          action_required = EXCLUDED.action_required,
          estimated_response_time = EXCLUDED.estimated_response_time,
          model_version = EXCLUDED.model_version,
          analysis_date = EXCLUDED.analysis_date,
          analysis_duration_ms = EXCLUDED.analysis_duration_ms,
          confidence_score = EXCLUDED.confidence_score,
          created_at = EXCLUDED.created_at
        RETURNING *
      `;

      const values = [
        id,
        analysisData.message_id,
        analysisData.sentiment_score,
        analysisData.sentiment_label,
        analysisData.priority_score,
        analysisData.priority_label,
        JSON.stringify(analysisData.keywords || []),
        JSON.stringify(analysisData.entities || []),
        JSON.stringify(analysisData.topics || []),
        analysisData.language_detected || 'en',
        analysisData.category,
        analysisData.is_spam || false,
        analysisData.spam_score,
        analysisData.is_promotional || false,
        analysisData.is_automated || false,
        JSON.stringify(analysisData.urgency_indicators || []),
        analysisData.action_required || false,
        analysisData.estimated_response_time,
        analysisData.model_version || 'v1.0',
        analysisData.analysis_date || now,
        analysisData.analysis_duration_ms,
        analysisData.confidence_score,
        now
      ];

      const result = await client.query(query, values);
      const row = result.rows[0];

      logger.info('Email analysis cached', { 
        id: row.id, 
        message_id: analysisData.message_id,
        sentiment_label: analysisData.sentiment_label,
        priority_label: analysisData.priority_label
      });

      return this.mapRowToAnalysisData(row);
    } catch (error) {
      logger.error('Failed to cache email analysis', { error, message_id: analysisData.message_id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量保存分析结果
   */
  async createBatch(analysisDataList: EmailAnalysisData[]): Promise<EmailAnalysisData[]> {
    if (analysisDataList.length === 0) return [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: EmailAnalysisData[] = [];
      const batchSize = 20; // 每批处理20条
      
      for (let i = 0; i < analysisDataList.length; i += batchSize) {
        const batch = analysisDataList.slice(i, i + batchSize);
        
        for (const analysisData of batch) {
          try {
            const result = await this.create(analysisData);
            results.push(result);
          } catch (error) {
            logger.error('Failed to cache single analysis in batch', {
              error,
              message_id: analysisData.message_id
            });
            // 继续处理其他项，不因单个失败而终止整批
          }
        }
        
        // 在批次间添加短暂延迟，避免数据库压力
        if (i + batchSize < analysisDataList.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Batch analysis caching completed', {
        total: analysisDataList.length,
        successful: results.length
      });

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cache analysis batch', { error, count: analysisDataList.length });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据消息ID获取分析结果
   */
  async findByMessageId(message_id: string): Promise<EmailAnalysisData | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_analysis_cache WHERE message_id = $1';
      const result = await client.query(query, [message_id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToAnalysisData(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find analysis by message id', { error, message_id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量获取分析结果
   */
  async findByMessageIds(message_ids: string[]): Promise<EmailAnalysisData[]> {
    if (message_ids.length === 0) return [];

    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM email_analysis_cache WHERE message_id = ANY($1)';
      const result = await client.query(query, [message_ids]);
      
      return result.rows.map(row => this.mapRowToAnalysisData(row));
    } catch (error) {
      logger.error('Failed to find analyses by message ids', { error, count: message_ids.length });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据查询条件获取分析结果
   */
  async findMany(query: AnalysisQuery): Promise<{
    analyses: EmailAnalysisData[];
    total: number;
    hasMore: boolean;
  }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // 构建WHERE条件
      if (query.message_ids && query.message_ids.length > 0) {
        whereConditions.push(`message_id = ANY($${paramIndex++})`);
        queryParams.push(query.message_ids);
      }

      if (query.sentiment_label) {
        whereConditions.push(`sentiment_label = $${paramIndex++}`);
        queryParams.push(query.sentiment_label);
      }

      if (query.priority_label) {
        whereConditions.push(`priority_label = $${paramIndex++}`);
        queryParams.push(query.priority_label);
      }

      if (query.category) {
        whereConditions.push(`category = $${paramIndex++}`);
        queryParams.push(query.category);
      }

      if (query.is_spam !== undefined) {
        whereConditions.push(`is_spam = $${paramIndex++}`);
        queryParams.push(query.is_spam);
      }

      if (query.action_required !== undefined) {
        whereConditions.push(`action_required = $${paramIndex++}`);
        queryParams.push(query.action_required);
      }

      if (query.language_detected) {
        whereConditions.push(`language_detected = $${paramIndex++}`);
        queryParams.push(query.language_detected);
      }

      if (query.start_date) {
        whereConditions.push(`analysis_date >= $${paramIndex++}`);
        queryParams.push(query.start_date);
      }

      if (query.end_date) {
        whereConditions.push(`analysis_date <= $${paramIndex++}`);
        queryParams.push(query.end_date);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取总数
      const countQuery = `SELECT COUNT(*) FROM email_analysis_cache ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 分页参数
      const limit = Math.min(query.limit || 50, 100);
      const offset = query.offset || 0;

      // 获取数据
      const dataQuery = `
        SELECT * FROM email_analysis_cache 
        ${whereClause} 
        ORDER BY analysis_date DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const dataResult = await client.query(dataQuery, queryParams);

      const analyses = dataResult.rows.map(row => this.mapRowToAnalysisData(row));
      const hasMore = offset + limit < total;

      return { analyses, total, hasMore };

    } catch (error) {
      logger.error('Failed to query email analysis cache', { error, query });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取分析统计信息
   */
  async getStats(message_ids?: string[]): Promise<AnalysisStats> {
    const client = await this.pool.connect();
    
    try {
      let whereClause = '';
      let queryParams: any[] = [];
      
      if (message_ids && message_ids.length > 0) {
        whereClause = 'WHERE message_id = ANY($1)';
        queryParams.push(message_ids);
      }

      const query = `
        SELECT 
          COUNT(*) as total_analyzed,
          AVG(confidence_score) as avg_confidence_score,
          AVG(analysis_duration_ms) as avg_analysis_duration_ms,
          
          -- Sentiment distribution
          COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_sentiment,
          COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_sentiment,
          COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_sentiment,
          
          -- Priority distribution
          COUNT(CASE WHEN priority_label = 'urgent' THEN 1 END) as urgent_priority,
          COUNT(CASE WHEN priority_label = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority_label = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority_label = 'low' THEN 1 END) as low_priority,
          
          -- Spam detection
          COUNT(CASE WHEN is_spam = true THEN 1 END) as total_spam,
          
          -- Action required
          COUNT(CASE WHEN action_required = true THEN 1 END) as action_required_count
          
        FROM email_analysis_cache ${whereClause}
      `;

      const result = await client.query(query, queryParams);
      const row = result.rows[0];

      const totalAnalyzed = parseInt(row.total_analyzed);
      const spamCount = parseInt(row.total_spam);

      // 获取分类统计
      const categoryQuery = `
        SELECT category, COUNT(*) as count
        FROM email_analysis_cache 
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
        LIMIT 20
      `;
      
      const categoryResult = await client.query(categoryQuery, queryParams);
      const categories: Record<string, number> = {};
      categoryResult.rows.forEach(catRow => {
        if (catRow.category) {
          categories[catRow.category] = parseInt(catRow.count);
        }
      });

      return {
        total_analyzed: totalAnalyzed,
        sentiment_distribution: {
          positive: parseInt(row.positive_sentiment),
          negative: parseInt(row.negative_sentiment),
          neutral: parseInt(row.neutral_sentiment)
        },
        priority_distribution: {
          urgent: parseInt(row.urgent_priority),
          high: parseInt(row.high_priority),
          medium: parseInt(row.medium_priority),
          low: parseInt(row.low_priority)
        },
        categories,
        avg_confidence_score: parseFloat(row.avg_confidence_score) || 0,
        avg_analysis_duration_ms: parseInt(row.avg_analysis_duration_ms) || 0,
        spam_detection: {
          total_spam: spamCount,
          spam_percentage: totalAnalyzed > 0 ? (spamCount / totalAnalyzed) * 100 : 0
        },
        action_required_count: parseInt(row.action_required_count)
      };

    } catch (error) {
      logger.error('Failed to get analysis stats', { error, message_ids });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新分析结果
   */
  async update(message_id: string, updates: Partial<EmailAnalysisData>): Promise<EmailAnalysisData | null> {
    const client = await this.pool.connect();
    
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // 构建动态更新字段
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'message_id' && key !== 'created_at') {
          if (key === 'keywords' || key === 'entities' || key === 'topics' || key === 'urgency_indicators') {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(JSON.stringify(value));
          } else {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        logger.warn('No valid fields to update in analysis cache', { message_id });
        return this.findByMessageId(message_id);
      }

      const query = `
        UPDATE email_analysis_cache 
        SET ${updateFields.join(', ')} 
        WHERE message_id = $${paramIndex}
        RETURNING *
      `;
      
      queryParams.push(message_id);
      
      const result = await client.query(query, queryParams);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Analysis cache updated', { message_id, fields: Object.keys(updates) });

      return this.mapRowToAnalysisData(result.rows[0]);

    } catch (error) {
      logger.error('Failed to update analysis cache', { error, message_id, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除分析缓存
   */
  async delete(message_id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM email_analysis_cache WHERE message_id = $1';
      const result = await client.query(query, [message_id]);
      
      logger.info('Analysis cache deleted', { message_id });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete analysis cache', { error, message_id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 清理过期的分析缓存（可选功能）
   */
  async cleanupOldCache(olderThanDays: number = 90): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const query = `
        DELETE FROM email_analysis_cache 
        WHERE created_at < $1
      `;
      
      const result = await client.query(query, [cutoffDate]);
      const deletedCount = result.rowCount;
      
      logger.info('Old analysis cache cleaned up', { 
        deletedCount, 
        cutoffDate: cutoffDate.toISOString() 
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old analysis cache', { error, olderThanDays });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 映射数据库行到分析数据对象
   */
  private mapRowToAnalysisData(row: any): EmailAnalysisData {
    return {
      id: row.id,
      message_id: row.message_id,
      sentiment_score: parseFloat(row.sentiment_score),
      sentiment_label: row.sentiment_label,
      priority_score: parseFloat(row.priority_score),
      priority_label: row.priority_label,
      keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords,
      entities: typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities,
      topics: typeof row.topics === 'string' ? JSON.parse(row.topics) : row.topics,
      language_detected: row.language_detected,
      category: row.category,
      is_spam: row.is_spam,
      spam_score: row.spam_score ? parseFloat(row.spam_score) : undefined,
      is_promotional: row.is_promotional,
      is_automated: row.is_automated,
      urgency_indicators: typeof row.urgency_indicators === 'string' ? 
        JSON.parse(row.urgency_indicators) : row.urgency_indicators,
      action_required: row.action_required,
      estimated_response_time: row.estimated_response_time,
      model_version: row.model_version,
      analysis_date: row.analysis_date ? new Date(row.analysis_date) : undefined,
      analysis_duration_ms: row.analysis_duration_ms,
      confidence_score: row.confidence_score ? parseFloat(row.confidence_score) : undefined,
      created_at: new Date(row.created_at)
    };
  }
}

export default EmailAnalysisCacheModel;