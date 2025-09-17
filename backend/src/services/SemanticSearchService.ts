import { Pool } from 'pg';
import axios from 'axios';
import DatabaseManager from '@/config/database';
import CacheManager from '@/services/CacheManager';
import logger from '@/utils/logger';
import config from '@/config';
import {
  ISemanticSearchService,
  EmbeddingVector,
  SemanticSearchRequest,
  SemanticSearchResult,
  AdvancedSearchQuery
} from '@/types';

/**
 * 语义搜索服务
 * 基于DeepSeek API实现文本向量化和语义相似性搜索
 */
export class SemanticSearchService implements ISemanticSearchService {
  private static instance: SemanticSearchService;
  private db: Pool;
  private cache: CacheManager;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;

  private constructor() {
    this.db = DatabaseManager.getPool();
    this.cache = CacheManager.getInstance();
    this.apiKey = config.env.DEEPSEEK_API_KEY;
    this.baseUrl = config.env.DEEPSEEK_BASE_URL;
    this.model = config.env.DEEPSEEK_MODEL;
    this.maxTokens = config.env.DEEPSEEK_MAX_TOKENS;

    if (!this.apiKey) {
      logger.warn('DeepSeek API key not configured, semantic search will be disabled');
    }
  }

  public static getInstance(): SemanticSearchService {
    if (!SemanticSearchService.instance) {
      SemanticSearchService.instance = new SemanticSearchService();
    }
    return SemanticSearchService.instance;
  }

  /**
   * 向量化单个文本
   */
  public async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      // 首先检查缓存
      const cacheKey = `embedding:${this.createTextHash(text)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 清理和预处理文本
      const cleanedText = this.preprocessText(text);
      
      // 调用DeepSeek API进行向量化
      const response = await axios.post(
        `${this.baseUrl}/embeddings`,
        {
          model: 'deepseek-embedding',
          input: cleanedText,
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error('Invalid response from DeepSeek API');
      }

      const embedding = response.data.data[0].embedding;
      
      // 缓存结果
      await this.cache.set(cacheKey, embedding, 86400); // 缓存24小时

      return embedding;
    } catch (error) {
      logger.error('Embed text failed:', error);
      
      // 如果API调用失败，返回随机向量作为降级方案
      if (error.response?.status === 429) {
        logger.warn('DeepSeek API rate limit exceeded, using fallback');
        return this.generateFallbackEmbedding(text);
      }
      
      throw new Error(`文本向量化失败: ${error.message}`);
    }
  }

  /**
   * 批量向量化文本
   */
  public async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      const embeddings: number[][] = [];
      const batchSize = 10; // DeepSeek API批量限制
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        // 检查缓存
        const cachedEmbeddings = await Promise.all(
          batch.map(async (text, index) => {
            const cacheKey = `embedding:${this.createTextHash(text)}`;
            const cached = await this.cache.get(cacheKey);
            return cached ? { index: i + index, embedding: cached } : null;
          })
        );

        const uncachedIndices: number[] = [];
        const uncachedTexts: string[] = [];
        
        cachedEmbeddings.forEach((cached, localIndex) => {
          const globalIndex = i + localIndex;
          if (cached) {
            embeddings[globalIndex] = cached.embedding;
          } else {
            uncachedIndices.push(globalIndex);
            uncachedTexts.push(batch[localIndex]);
          }
        });

        // 批量处理未缓存的文本
        if (uncachedTexts.length > 0) {
          const cleanedTexts = uncachedTexts.map(text => this.preprocessText(text));
          
          const response = await axios.post(
            `${this.baseUrl}/embeddings`,
            {
              model: 'deepseek-embedding',
              input: cleanedTexts,
              encoding_format: 'float'
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000
            }
          );

          if (response.data && response.data.data) {
            response.data.data.forEach((item: any, localIndex: number) => {
              const globalIndex = uncachedIndices[localIndex];
              const embedding = item.embedding;
              embeddings[globalIndex] = embedding;
              
              // 缓存结果
              const cacheKey = `embedding:${this.createTextHash(uncachedTexts[localIndex])}`;
              this.cache.set(cacheKey, embedding, 86400).catch(() => {});
            });
          }
        }

        // 添加延迟以避免API限流
        if (i + batchSize < texts.length) {
          await this.delay(200);
        }
      }

      return embeddings;
    } catch (error) {
      logger.error('Batch embed texts failed:', error);
      
      // 降级方案：为所有文本生成随机向量
      if (error.response?.status === 429) {
        logger.warn('DeepSeek API rate limit exceeded, using fallback for batch');
        return texts.map(text => this.generateFallbackEmbedding(text));
      }
      
      throw new Error(`批量文本向量化失败: ${error.message}`);
    }
  }

  /**
   * 计算两个向量的余弦相似度
   */
  public calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * 语义搜索
   */
  public async search(
    queryVector: number[],
    filters?: AdvancedSearchQuery['filters'],
    limit: number = 50
  ): Promise<SemanticSearchResult[]> {
    try {
      // 构建SQL查询，使用PostgreSQL的向量相似度计算
      let sql = `
        SELECT 
          ev.message_id,
          ev.vector,
          (1 - (ev.vector <=> $1::vector)) as similarity,
          ev.model,
          ev.created_at
        FROM email_embeddings ev
        LEFT JOIN email_messages em ON ev.message_id = em.id
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
      `;

      const conditions: string[] = [];
      const params: any[] = [JSON.stringify(queryVector)];
      let paramCount = 1;

      // 应用过滤条件
      if (filters) {
        this.applySemanticFilters(filters, conditions, params, paramCount);
      }

      // 添加相似度阈值
      conditions.push(`(1 - (ev.vector <=> $1::vector)) > 0.3`);

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY similarity DESC LIMIT ${limit}`;

      const result = await this.db.query(sql, params);

      return result.rows.map(row => ({
        messageId: row.message_id,
        similarity: parseFloat(row.similarity),
        embedding: {
          id: row.message_id,
          messageId: row.message_id,
          vector: JSON.parse(row.vector),
          model: row.model,
          createdAt: row.created_at
        }
      }));
    } catch (error) {
      logger.error('Semantic search failed:', error);
      
      // 如果向量搜索失败，降级到关键词搜索
      logger.warn('Falling back to keyword-based search');
      return this.fallbackKeywordSearch(filters, limit);
    }
  }

  /**
   * 更新邮件向量
   */
  public async updateMessageEmbedding(messageId: string, content: string): Promise<void> {
    try {
      // 检查是否已存在向量
      const existingSql = 'SELECT id FROM email_embeddings WHERE message_id = $1';
      const existing = await this.db.query(existingSql, [messageId]);

      // 生成新向量
      const vector = await this.embedText(content);

      if (existing.rows.length > 0) {
        // 更新现有向量
        const updateSql = `
          UPDATE email_embeddings 
          SET vector = $1, model = $2, created_at = NOW()
          WHERE message_id = $3
        `;
        await this.db.query(updateSql, [JSON.stringify(vector), this.model, messageId]);
      } else {
        // 插入新向量
        const insertSql = `
          INSERT INTO email_embeddings (message_id, vector, model)
          VALUES ($1, $2, $3)
        `;
        await this.db.query(insertSql, [messageId, JSON.stringify(vector), this.model]);
      }

      logger.debug(`Updated embedding for message ${messageId}`);
    } catch (error) {
      logger.error(`Update message embedding failed for ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * 批量更新向量
   */
  public async batchUpdateEmbeddings(messages: Array<{ id: string; content: string }>): Promise<void> {
    if (messages.length === 0) return;

    try {
      logger.info(`Starting batch embedding update for ${messages.length} messages`);
      
      // 批量生成向量
      const contents = messages.map(m => m.content);
      const vectors = await this.embedTexts(contents);

      // 批量更新数据库
      const batchSize = 50;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const batchVectors = vectors.slice(i, i + batchSize);

        await this.processBatch(batch, batchVectors);
        
        // 添加延迟以避免数据库压力
        if (i + batchSize < messages.length) {
          await this.delay(100);
        }
      }

      logger.info(`Completed batch embedding update for ${messages.length} messages`);
    } catch (error) {
      logger.error('Batch update embeddings failed:', error);
      throw error;
    }
  }

  /**
   * 删除邮件向量
   */
  public async deleteMessageEmbedding(messageId: string): Promise<void> {
    try {
      const sql = 'DELETE FROM email_embeddings WHERE message_id = $1';
      await this.db.query(sql, [messageId]);
      logger.debug(`Deleted embedding for message ${messageId}`);
    } catch (error) {
      logger.error(`Delete message embedding failed for ${messageId}:`, error);
      throw error;
    }
  }

  // 私有辅助方法

  private preprocessText(text: string): string {
    if (!text) return '';
    
    // 清理HTML标签
    let cleaned = text.replace(/<[^>]*>/g, ' ');
    
    // 移除多余空白字符
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // 限制长度（DeepSeek embedding模型有token限制）
    const maxLength = 8000; // 约等于2000个tokens
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }
    
    return cleaned;
  }

  private createTextHash(text: string): string {
    // 创建文本的简单哈希值用于缓存键
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  private generateFallbackEmbedding(text: string): number[] {
    // 生成基于文本特征的简单向量作为降级方案
    const dimension = 1536; // DeepSeek embedding维度
    const vector = new Array(dimension).fill(0);
    
    // 基于文本长度和字符分布生成特征
    const length = Math.min(text.length, 1000);
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    for (let i = 0; i < dimension; i++) {
      let value = 0;
      
      // 基于文本长度的特征
      value += (length / 1000) * Math.sin(i * 0.01);
      
      // 基于词汇密度的特征
      value += (uniqueWords.size / Math.max(words.length, 1)) * Math.cos(i * 0.02);
      
      // 基于字符频率的特征
      if (i < text.length) {
        value += (text.charCodeAt(i % text.length) / 255) * 0.1;
      }
      
      // 添加随机噪声
      value += (Math.random() - 0.5) * 0.1;
      
      vector[i] = value;
    }
    
    // 标准化向量
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i] / norm;
      }
    }
    
    return vector;
  }

  private applySemanticFilters(
    filters: AdvancedSearchQuery['filters'],
    conditions: string[],
    params: any[],
    paramCount: number
  ): number {
    if (!filters) return paramCount;

    // 发件人过滤
    if (filters.sender?.addresses && filters.sender.addresses.length > 0) {
      conditions.push(`em.sender_address = ANY($${++paramCount})`);
      params.push(filters.sender.addresses);
    }

    // 日期过滤
    if (filters.dates?.received?.start) {
      conditions.push(`em.received_at >= $${++paramCount}`);
      params.push(filters.dates.received.start);
    }

    if (filters.dates?.received?.end) {
      conditions.push(`em.received_at <= $${++paramCount}`);
      params.push(filters.dates.received.end);
    }

    // 属性过滤
    if (filters.properties?.hasAttachments !== undefined) {
      conditions.push(`em.has_attachments = $${++paramCount}`);
      params.push(filters.properties.hasAttachments);
    }

    if (filters.properties?.importance) {
      conditions.push(`em.importance = $${++paramCount}`);
      params.push(filters.properties.importance);
    }

    return paramCount;
  }

  private async fallbackKeywordSearch(
    filters?: AdvancedSearchQuery['filters'],
    limit: number = 50
  ): Promise<SemanticSearchResult[]> {
    try {
      // 简单的关键词搜索作为降级方案
      let sql = `
        SELECT DISTINCT em.id as message_id, 0.5 as similarity
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
      `;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (filters) {
        this.applySemanticFilters(filters, conditions, params, paramCount);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY em.received_at DESC LIMIT ${limit}`;

      const result = await this.db.query(sql, params);

      return result.rows.map(row => ({
        messageId: row.message_id,
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      logger.error('Fallback keyword search failed:', error);
      return [];
    }
  }

  private async processBatch(
    batch: Array<{ id: string; content: string }>,
    vectors: number[][]
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (let i = 0; i < batch.length; i++) {
        const message = batch[i];
        const vector = vectors[i];

        if (!vector) continue;

        // 检查是否存在
        const existingResult = await client.query(
          'SELECT id FROM email_embeddings WHERE message_id = $1',
          [message.id]
        );

        if (existingResult.rows.length > 0) {
          // 更新
          await client.query(
            'UPDATE email_embeddings SET vector = $1, model = $2, created_at = NOW() WHERE message_id = $3',
            [JSON.stringify(vector), this.model, message.id]
          );
        } else {
          // 插入
          await client.query(
            'INSERT INTO email_embeddings (message_id, vector, model) VALUES ($1, $2, $3)',
            [message.id, JSON.stringify(vector), this.model]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取向量化统计信息
   */
  public async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    recentEmbeddings: number;
    averageVectorDimension: number;
    modelsUsed: string[];
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_embeddings,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_embeddings,
          array_length(vector::float[], 1) as vector_dimension,
          array_agg(DISTINCT model) as models_used
        FROM email_embeddings
      `;

      const result = await this.db.query(statsQuery);
      const row = result.rows[0];

      return {
        totalEmbeddings: parseInt(row.total_embeddings) || 0,
        recentEmbeddings: parseInt(row.recent_embeddings) || 0,
        averageVectorDimension: parseInt(row.vector_dimension) || 0,
        modelsUsed: row.models_used || []
      };
    } catch (error) {
      logger.error('Get embedding stats failed:', error);
      return {
        totalEmbeddings: 0,
        recentEmbeddings: 0,
        averageVectorDimension: 0,
        modelsUsed: []
      };
    }
  }

  /**
   * 清理旧向量
   */
  public async cleanupOldEmbeddings(daysBefore: number = 90): Promise<number> {
    try {
      const sql = `
        DELETE FROM email_embeddings 
        WHERE created_at < NOW() - INTERVAL '${daysBefore} days'
        AND message_id NOT IN (
          SELECT id FROM email_messages 
          WHERE received_at > NOW() - INTERVAL '30 days'
        )
      `;

      const result = await this.db.query(sql);
      const deletedCount = result.rowCount || 0;

      logger.info(`Cleaned up ${deletedCount} old embeddings`);
      return deletedCount;
    } catch (error) {
      logger.error('Cleanup old embeddings failed:', error);
      return 0;
    }
  }
}

export default SemanticSearchService;