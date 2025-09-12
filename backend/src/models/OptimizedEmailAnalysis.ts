/**
 * Optimized EmailAnalysis Model
 * 优化版邮件AI分析数据模型，专注于高性能查询和批量处理
 */

import { Pool } from 'pg';
import DatabaseManager from '@/config/database';
import RedisManager from '@/config/redis';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

// 导入原始接口
import { 
  EmailAnalysis, 
  CreateEmailAnalysisData, 
  AnalysisFilters, 
  AnalysisStats 
} from './EmailAnalysis';

export interface OptimizedAnalysisFilters extends AnalysisFilters {
  cursor?: string;
  userIds?: string[];
}

export interface AnalysisTrend {
  date: string;
  priority_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  average_processing_time: number;
  total_analyses: number;
}

export interface KeywordInsight {
  keyword: string;
  count: number;
  trend: 'rising' | 'falling' | 'stable';
  context_categories: string[];
  avg_sentiment: number;
}

export class OptimizedEmailAnalysisModel {
  private get pool(): Pool {
    return DatabaseManager.getPool();
  }

  private redis = RedisManager;
  private readonly CACHE_TTL = 600; // 10分钟缓存
  private readonly STATS_CACHE_TTL = 1800; // 30分钟统计缓存

  constructor() {}

  /**
   * 批量创建分析结果（高性能版本）
   */
  async bulkCreateAnalyses(analyses: CreateEmailAnalysisData[]): Promise<EmailAnalysis[]> {
    if (analyses.length === 0) return [];

    const client = await this.pool.connect();
    
    try {
      const startTime = Date.now();
      
      await client.query('BEGIN');

      // 准备批量数据
      const ids = analyses.map(() => uuidv4());
      const now = new Date();
      
      const emailIds = analyses.map(a => a.emailId);
      const analysisVersions = analyses.map(a => a.analysisVersion);
      const sentimentData = analyses.map(a => JSON.stringify(a.sentiment));
      const priorityData = analyses.map(a => JSON.stringify(a.priority));
      const categoryData = analyses.map(a => JSON.stringify(a.category));
      const keywords = analyses.map(a => a.keywords);
      const entitiesData = analyses.map(a => JSON.stringify(a.entities));
      const summaries = analyses.map(a => a.summary);
      const suggestedActionsData = analyses.map(a => JSON.stringify(a.suggestedActions));
      const processingTimes = analyses.map(a => a.processingTime);

      // 使用UNNEST进行批量插入/更新
      const bulkUpsertQuery = `
        INSERT INTO email_analysis (
          id, email_id, analysis_version, sentiment_data, priority_data,
          category_data, keywords, entities_data, summary, suggested_actions_data,
          processing_time, analyzed_at, created_at, updated_at
        )
        SELECT * FROM UNNEST (
          $1::uuid[], $2::uuid[], $3::text[], $4::jsonb[], $5::jsonb[],
          $6::jsonb[], $7::text[][], $8::jsonb[], $9::text[], $10::jsonb[],
          $11::integer[], $12::timestamptz[], $13::timestamptz[], $14::timestamptz[]
        )
        ON CONFLICT (email_id) DO UPDATE SET
          analysis_version = EXCLUDED.analysis_version,
          sentiment_data = EXCLUDED.sentiment_data,
          priority_data = EXCLUDED.priority_data,
          category_data = EXCLUDED.category_data,
          keywords = EXCLUDED.keywords,
          entities_data = EXCLUDED.entities_data,
          summary = EXCLUDED.summary,
          suggested_actions_data = EXCLUDED.suggested_actions_data,
          processing_time = EXCLUDED.processing_time,
          analyzed_at = EXCLUDED.analyzed_at,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      const values = [
        ids, emailIds, analysisVersions, sentimentData, priorityData,
        categoryData, keywords, entitiesData, summaries, suggestedActionsData,
        processingTimes, Array(analyses.length).fill(now), 
        Array(analyses.length).fill(now), Array(analyses.length).fill(now)
      ];

      const result = await client.query(bulkUpsertQuery, values);
      
      await client.query('COMMIT');
      
      const queryTime = Date.now() - startTime;
      logger.dbOperation('UPSERT', 'bulk_analysis_create', queryTime);
      logger.info(`Bulk created/updated ${result.rows.length} email analyses`);

      // 清除相关缓存
      await this.invalidateCache(['analysis', 'stats']);

      return result.rows.map(row => this.mapRowToEmailAnalysis(row));

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to bulk create email analyses', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取高级统计信息（使用物化视图）
   */
  async getAdvancedStats(
    userIds: string[],
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AnalysisStats> {
    const cacheKey = `advanced_stats:${userIds.join(',')}_${dateFrom?.toISOString() || 'null'}_${dateTo?.toISOString() || 'null'}`;
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<AnalysisStats>(cacheKey);
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

      // 使用物化视图获取基础统计
      const basicStatsQuery = `
        SELECT 
          SUM(total_analyses)::INTEGER as total,
          SUM(critical_priority)::INTEGER as critical_priority,
          SUM(high_priority)::INTEGER as high_priority,
          SUM(total_analyses - critical_priority - high_priority)::INTEGER as medium_low_priority,
          SUM(positive_sentiment)::INTEGER as positive_sentiment,
          SUM(negative_sentiment)::INTEGER as negative_sentiment,
          SUM(total_analyses - positive_sentiment - negative_sentiment)::INTEGER as neutral_sentiment,
          AVG(avg_processing_time) as avg_processing_time
        FROM mv_analysis_statistics
        WHERE ${whereClause}
      `;

      const basicResult = await client.query(basicStatsQuery, queryParams);
      const basic = basicResult.rows[0];

      // 获取热门分类
      const categoryStatsQuery = `
        SELECT 
          ea.category_data->>'primary' as category,
          COUNT(*)::INTEGER as count
        FROM email_analysis ea
        JOIN email_messages em ON ea.email_id = em.id
        WHERE em.user_id = ANY($1)
        ${dateFrom ? `AND ea.analyzed_at >= $${paramIndex++}` : ''}
        ${dateTo ? `AND ea.analyzed_at <= $${paramIndex++}` : ''}
        GROUP BY ea.category_data->>'primary'
        ORDER BY count DESC
        LIMIT 10
      `;

      if (dateFrom) queryParams.push(dateFrom);
      if (dateTo) queryParams.push(dateTo);

      const categoryResult = await client.query(categoryStatsQuery, queryParams);

      // 获取关键词统计（优化版本）
      const keywordStatsQuery = `
        WITH keyword_stats AS (
          SELECT 
            unnest(ea.keywords) as keyword,
            COUNT(*) as count
          FROM email_analysis ea
          JOIN email_messages em ON ea.email_id = em.id
          WHERE em.user_id = ANY($1)
          ${dateFrom ? `AND ea.analyzed_at >= $${paramIndex - (dateTo ? 2 : 1)}` : ''}
          ${dateTo ? `AND ea.analyzed_at <= $${paramIndex - 1}` : ''}
          GROUP BY unnest(ea.keywords)
          HAVING COUNT(*) >= 2
        )
        SELECT keyword, count::INTEGER
        FROM keyword_stats
        ORDER BY count DESC
        LIMIT 20
      `;

      const keywordResult = await client.query(keywordStatsQuery, queryParams.slice(0, dateFrom || dateTo ? (dateFrom && dateTo ? 3 : 2) : 1));

      const queryTime = Date.now() - startTime;
      logger.dbOperation('SELECT', 'advanced_stats_query', queryTime);

      const result: AnalysisStats = {
        total: basic.total || 0,
        byPriority: {
          critical: basic.critical_priority || 0,
          high: basic.high_priority || 0,
          medium: Math.floor((basic.medium_low_priority || 0) * 0.7), // 估算
          low: Math.floor((basic.medium_low_priority || 0) * 0.3)
        },
        bySentiment: {
          positive: basic.positive_sentiment || 0,
          negative: basic.negative_sentiment || 0,
          neutral: basic.neutral_sentiment || 0
        },
        averageProcessingTime: parseFloat(basic.avg_processing_time) || 0,
        topCategories: categoryResult.rows.map(row => ({
          category: row.category,
          count: row.count
        })),
        topKeywords: keywordResult.rows.map(row => ({
          keyword: row.keyword,
          count: row.count
        }))
      };

      // 缓存结果
      await this.redis.set(cacheKey, result, this.STATS_CACHE_TTL);

      return result;

    } catch (error) {
      logger.error('Failed to get advanced stats', { error, userIds });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取分析趋势数据
   */
  async getAnalysisTrends(
    userId: string,
    days: number = 30
  ): Promise<AnalysisTrend[]> {
    const cacheKey = `analysis_trends:${userId}:${days}`;
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<AnalysisTrend[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const query = `
        WITH daily_stats AS (
          SELECT 
            DATE(ea.analyzed_at) as date,
            COUNT(*) as total_analyses,
            COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'critical') as critical_priority,
            COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'high') as high_priority,
            COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'medium') as medium_priority,
            COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'low') as low_priority,
            COUNT(*) FILTER (WHERE ea.sentiment_data->>'label' = 'positive') as positive_sentiment,
            COUNT(*) FILTER (WHERE ea.sentiment_data->>'label' = 'negative') as negative_sentiment,
            COUNT(*) FILTER (WHERE ea.sentiment_data->>'label' = 'neutral') as neutral_sentiment,
            AVG(ea.processing_time) as avg_processing_time
          FROM email_analysis ea
          JOIN email_messages em ON ea.email_id = em.id
          WHERE em.user_id = $1
          AND ea.analyzed_at >= CURRENT_DATE - INTERVAL '$2 days'
          GROUP BY DATE(ea.analyzed_at)
          ORDER BY date DESC
        )
        SELECT 
          date::TEXT,
          total_analyses::INTEGER,
          critical_priority::INTEGER,
          high_priority::INTEGER,
          medium_priority::INTEGER,
          low_priority::INTEGER,
          positive_sentiment::INTEGER,
          negative_sentiment::INTEGER,
          neutral_sentiment::INTEGER,
          avg_processing_time
        FROM daily_stats
      `;

      const result = await client.query(query, [userId, days]);
      
      const trends: AnalysisTrend[] = result.rows.map(row => ({
        date: row.date,
        priority_distribution: {
          critical: row.critical_priority,
          high: row.high_priority,
          medium: row.medium_priority,
          low: row.low_priority
        },
        sentiment_distribution: {
          positive: row.positive_sentiment,
          negative: row.negative_sentiment,
          neutral: row.neutral_sentiment
        },
        average_processing_time: parseFloat(row.avg_processing_time) || 0,
        total_analyses: row.total_analyses
      }));

      // 缓存结果
      await this.redis.set(cacheKey, trends, this.CACHE_TTL * 2);

      return trends;

    } catch (error) {
      logger.error('Failed to get analysis trends', { error, userId, days });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取关键词洞察
   */
  async getKeywordInsights(
    userId: string,
    limit: number = 20
  ): Promise<KeywordInsight[]> {
    const cacheKey = `keyword_insights:${userId}:${limit}`;
    
    // 尝试从缓存获取
    const cachedResult = await this.redis.getJson<KeywordInsight[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const query = `
        WITH keyword_analysis AS (
          SELECT 
            unnest(ea.keywords) as keyword,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE ea.analyzed_at >= CURRENT_DATE - INTERVAL '7 days') as recent_count,
            COUNT(*) FILTER (WHERE ea.analyzed_at >= CURRENT_DATE - INTERVAL '14 days' 
                           AND ea.analyzed_at < CURRENT_DATE - INTERVAL '7 days') as prev_count,
            AVG((ea.sentiment_data->>'confidence')::FLOAT) as avg_sentiment,
            ARRAY_AGG(DISTINCT ea.category_data->>'primary') as categories
          FROM email_analysis ea
          JOIN email_messages em ON ea.email_id = em.id
          WHERE em.user_id = $1
          AND ea.analyzed_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY unnest(ea.keywords)
          HAVING COUNT(*) >= 3
        )
        SELECT 
          keyword,
          total_count::INTEGER as count,
          CASE 
            WHEN recent_count > prev_count * 1.2 THEN 'rising'
            WHEN recent_count < prev_count * 0.8 THEN 'falling'
            ELSE 'stable'
          END as trend,
          categories as context_categories,
          avg_sentiment
        FROM keyword_analysis
        WHERE keyword IS NOT NULL AND keyword != ''
        ORDER BY total_count DESC
        LIMIT $2
      `;

      const result = await client.query(query, [userId, limit]);
      
      const insights: KeywordInsight[] = result.rows.map(row => ({
        keyword: row.keyword,
        count: row.count,
        trend: row.trend,
        context_categories: row.context_categories.filter(Boolean),
        avg_sentiment: parseFloat(row.avg_sentiment) || 0
      }));

      // 缓存结果
      await this.redis.set(cacheKey, insights, this.CACHE_TTL * 3);

      return insights;

    } catch (error) {
      logger.error('Failed to get keyword insights', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取实时分析状态
   */
  async getRealTimeAnalysisStatus(userId: string): Promise<{
    pending: number;
    processing: number;
    completed_today: number;
    avg_processing_time: number;
  }> {
    const cacheKey = `realtime_status:${userId}`;
    
    // 尝试从缓存获取（短缓存）
    const cachedResult = await this.redis.getJson<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE ea.id IS NULL) as pending,
          COUNT(*) FILTER (WHERE ea.analyzed_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes') as processing,
          COUNT(*) FILTER (WHERE ea.analyzed_at >= CURRENT_DATE) as completed_today,
          AVG(ea.processing_time) FILTER (WHERE ea.analyzed_at >= CURRENT_DATE) as avg_processing_time
        FROM email_messages em
        LEFT JOIN email_analysis ea ON em.id = ea.email_id
        WHERE em.user_id = $1
        AND em.received_at >= CURRENT_DATE - INTERVAL '1 day'
      `;

      const result = await client.query(query, [userId]);
      const row = result.rows[0];

      const status = {
        pending: parseInt(row.pending) || 0,
        processing: parseInt(row.processing) || 0,
        completed_today: parseInt(row.completed_today) || 0,
        avg_processing_time: parseFloat(row.avg_processing_time) || 0
      };

      // 短缓存（30秒）
      await this.redis.set(cacheKey, status, 30);

      return status;

    } catch (error) {
      logger.error('Failed to get realtime analysis status', { error, userId });
      throw error;
    } finally {
      client.release();
    }
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

export default OptimizedEmailAnalysisModel;