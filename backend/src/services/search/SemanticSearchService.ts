import { 
  SemanticSearchRequest, 
  SemanticSearchResult, 
  EmbeddingVector,
  AdvancedSearchQuery,
  SearchResponse,
  SearchResult,
  ISemanticSearchService,
  EmailMessage
} from '@/types';
import DatabaseManager from '@/config/database';
import CacheManager from '@/services/CacheManager';
import logger from '@/utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * 语义搜索服务
 * 基于DeepSeek API提供向量化和语义搜索功能
 */
export class SemanticSearchService implements ISemanticSearchService {
  private static instance: SemanticSearchService;
  private db: DatabaseManager;
  private cache: CacheManager;
  private readonly DEEPSEEK_API_KEY: string;
  private readonly DEEPSEEK_BASE_URL: string;
  private readonly EMBEDDING_MODEL: string;
  private readonly VECTOR_CACHE_TTL = 7 * 24 * 60 * 60; // 7天缓存
  private readonly SIMILARITY_THRESHOLD = 0.7;

  private constructor() {
    this.db = DatabaseManager.getInstance();
    this.cache = CacheManager.getInstance();
    this.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
    this.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.EMBEDDING_MODEL = process.env.DEEPSEEK_EMBEDDING_MODEL || 'text-embedding-ada-002';

    if (!this.DEEPSEEK_API_KEY) {
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
    if (!this.DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API密钥未配置');
    }

    try {
      // 检查缓存
      const cacheKey = `embedding:${Buffer.from(text).toString('base64').slice(0, 32)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 预处理文本
      const cleanText = this.preprocessText(text);
      if (cleanText.length === 0) {
        throw new Error('文本内容为空');
      }

      // 调用DeepSeek API
      const response = await axios.post(
        `${this.DEEPSEEK_BASE_URL}/embeddings`,
        {
          model: this.EMBEDDING_MODEL,
          input: cleanText,
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (!response.data?.data?.[0]?.embedding) {
        throw new Error('API响应格式错误');
      }

      const embedding = response.data.data[0].embedding;
      
      // 缓存结果
      await this.cache.setWithExpiry(cacheKey, JSON.stringify(embedding), this.VECTOR_CACHE_TTL);
      
      return embedding;

    } catch (error) {
      logger.error('Text embedding failed', { error, textLength: text.length });
      
      if (error.response?.status === 429) {
        throw new Error('API调用频率限制，请稍后重试');
      }
      if (error.response?.status === 401) {
        throw new Error('API密钥无效');
      }
      
      throw new Error(`文本向量化失败: ${error.message}`);
    }
  }

  /**
   * 批量向量化文本
   */
  public async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API密钥未配置');
    }

    try {
      // 分批处理以避免API限制
      const batchSize = 10;
      const results: number[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(text => this.embedText(text))
        );
        results.push(...batchResults);
        
        // 添加延迟以遵守API限制
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;

    } catch (error) {
      logger.error('Batch text embedding failed', { error, textCount: texts.length });
      throw new Error(`批量文本向量化失败: ${error.message}`);
    }
  }

  /**
   * 计算向量相似度（余弦相似度）
   */
  public calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * 语义搜索
   */
  public async search(
    queryVector: number[], 
    filters?: AdvancedSearchQuery['filters'], 
    limit: number = 20
  ): Promise<SemanticSearchResult[]> {
    try {
      // 构建基础查询
      let sql = `
        SELECT 
          em.id as message_id,
          em.subject,
          em.content_text,
          em.sender_address,
          em.sender_name,
          em.received_at,
          em.importance,
          ev.vector,
          ev.model,
          ev.created_at as embedding_created_at
        FROM email_messages em
        JOIN email_embeddings ev ON em.id = ev.message_id
        JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ev.vector IS NOT NULL
      `;

      const params: any[] = [];
      let paramIndex = 0;

      // 添加过滤条件
      if (filters) {
        const { filterSQL, filterParams } = this.buildSemanticFilterConditions(filters, paramIndex);
        sql += filterSQL;
        params.push(...filterParams);
        paramIndex += filterParams.length;
      }

      // 添加限制
      sql += ` ORDER BY ev.created_at DESC LIMIT $${++paramIndex}`;
      params.push(limit * 5); // 获取更多结果进行相似度计算

      // 执行查询
      const result = await this.db.query(sql, params);
      
      // 计算相似度并排序
      const similarities = result.rows
        .map(row => {
          const storedVector = this.parseVector(row.vector);
          const similarity = this.calculateSimilarity(queryVector, storedVector);
          
          return {
            messageId: row.message_id,
            similarity,
            embedding: {
              id: `${row.message_id}_embedding`,
              messageId: row.message_id,
              vector: storedVector,
              model: row.model,
              createdAt: row.embedding_created_at
            },
            message: this.mapToEmailMessage(row)
          };
        })
        .filter(item => item.similarity >= this.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return similarities;

    } catch (error) {
      logger.error('Semantic search failed', { error, vectorLength: queryVector.length });
      throw new Error(`语义搜索失败: ${error.message}`);
    }
  }

  /**
   * 语义搜索（基于查询文本）
   */
  public async searchByText(request: SemanticSearchRequest, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = uuidv4();

    try {
      // 1. 向量化查询文本
      const queryVector = await this.embedText(request.query);
      
      // 2. 执行语义搜索
      const semanticResults = await this.search(
        queryVector, 
        request.filters, 
        request.maxResults || 20
      );

      // 3. 如果启用了全文搜索组合
      let allResults = semanticResults;
      if (request.includeMetadata) {
        // 可以在这里组合全文搜索结果
        // const fulltextResults = await this.combineWithFulltext(request, userId);
        // allResults = this.mergeResults(semanticResults, fulltextResults);
      }

      // 4. 过滤低于阈值的结果
      const threshold = request.threshold || this.SIMILARITY_THRESHOLD;
      const filteredResults = allResults.filter(result => result.similarity >= threshold);

      // 5. 转换为统一的搜索结果格式
      const searchResults: SearchResult[] = filteredResults.map(result => ({
        id: result.messageId,
        score: result.similarity,
        relevanceType: 'semantic',
        email: result.message!,
        explanation: {
          matchedTerms: [request.query],
          searchType: 'semantic',
          scoreBreakdown: {
            semanticSimilarity: result.similarity,
            textRelevance: 0,
            recencyBoost: 0,
            importanceBoost: 0
          }
        }
      }));

      const executionTime = Date.now() - startTime;

      return {
        results: searchResults,
        total: searchResults.length,
        executionTime,
        searchId,
        pagination: {
          page: 1,
          limit: request.maxResults || 20,
          hasNext: false,
          hasPrevious: false
        }
      };

    } catch (error) {
      logger.error('Semantic search by text failed', { error, request, userId });
      throw new Error(`语义搜索失败: ${error.message}`);
    }
  }

  /**
   * 更新邮件向量
   */
  public async updateMessageEmbedding(messageId: string, content: string): Promise<void> {
    try {
      // 1. 生成向量
      const embedding = await this.embedText(content);
      
      // 2. 存储到数据库
      await this.storeEmbedding(messageId, embedding);
      
      logger.info('Message embedding updated', { messageId, vectorLength: embedding.length });

    } catch (error) {
      logger.error('Failed to update message embedding', { error, messageId });
      throw new Error(`更新邮件向量失败: ${error.message}`);
    }
  }

  /**
   * 批量更新向量
   */
  public async batchUpdateEmbeddings(messages: Array<{ id: string; content: string }>): Promise<void> {
    try {
      const batchSize = 5; // 限制并发数
      
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        // 并行处理批次
        await Promise.all(
          batch.map(async message => {
            try {
              await this.updateMessageEmbedding(message.id, message.content);
            } catch (error) {
              logger.warn('Failed to update single message embedding', { 
                error, 
                messageId: message.id 
              });
            }
          })
        );
        
        // 批次间延迟
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info('Batch embedding update completed', { 
        totalMessages: messages.length,
        batchSize 
      });

    } catch (error) {
      logger.error('Batch embedding update failed', { error, messageCount: messages.length });
      throw new Error(`批量更新向量失败: ${error.message}`);
    }
  }

  /**
   * 删除邮件向量
   */
  public async deleteMessageEmbedding(messageId: string): Promise<void> {
    try {
      const query = `
        DELETE FROM email_embeddings 
        WHERE message_id = $1
      `;
      
      await this.db.query(query, [messageId]);
      
      logger.info('Message embedding deleted', { messageId });

    } catch (error) {
      logger.error('Failed to delete message embedding', { error, messageId });
      throw new Error(`删除邮件向量失败: ${error.message}`);
    }
  }

  /**
   * 获取相似邮件推荐
   */
  public async getSimilarEmails(messageId: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    try {
      // 1. 获取目标邮件的向量
      const vectorQuery = `
        SELECT vector FROM email_embeddings 
        WHERE message_id = $1
      `;
      
      const vectorResult = await this.db.query(vectorQuery, [messageId]);
      if (vectorResult.rows.length === 0) {
        throw new Error('邮件向量不存在');
      }
      
      const queryVector = this.parseVector(vectorResult.rows[0].vector);
      
      // 2. 搜索相似邮件
      const results = await this.search(queryVector, undefined, limit + 1);
      
      // 3. 过滤掉自己
      return results.filter(result => result.messageId !== messageId).slice(0, limit);

    } catch (error) {
      logger.error('Failed to get similar emails', { error, messageId });
      throw new Error(`获取相似邮件失败: ${error.message}`);
    }
  }

  /**
   * 获取向量统计信息
   */
  public async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    modelsUsed: Array<{ model: string; count: number }>;
    avgVectorLength: number;
    oldestEmbedding: Date;
    newestEmbedding: Date;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_embeddings,
          AVG(array_length(vector, 1)) as avg_vector_length,
          MIN(created_at) as oldest_embedding,
          MAX(created_at) as newest_embedding
        FROM email_embeddings
      `;
      
      const modelsQuery = `
        SELECT model, COUNT(*) as count
        FROM email_embeddings
        GROUP BY model
        ORDER BY count DESC
      `;
      
      const [statsResult, modelsResult] = await Promise.all([
        this.db.query(statsQuery),
        this.db.query(modelsQuery)
      ]);
      
      const stats = statsResult.rows[0];
      const models = modelsResult.rows;
      
      return {
        totalEmbeddings: parseInt(stats.total_embeddings),
        modelsUsed: models.map(m => ({
          model: m.model,
          count: parseInt(m.count)
        })),
        avgVectorLength: parseFloat(stats.avg_vector_length) || 0,
        oldestEmbedding: stats.oldest_embedding,
        newestEmbedding: stats.newest_embedding
      };

    } catch (error) {
      logger.error('Failed to get embedding stats', { error });
      throw new Error(`获取向量统计失败: ${error.message}`);
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 预处理文本
   */
  private preprocessText(text: string): string {
    // 1. 去除HTML标签
    let clean = text.replace(/<[^>]*>/g, ' ');
    
    // 2. 去除多余空白
    clean = clean.replace(/\s+/g, ' ').trim();
    
    // 3. 限制长度（避免API限制）
    const maxLength = 8000; // DeepSeek API通常限制token数量
    if (clean.length > maxLength) {
      clean = clean.substring(0, maxLength);
    }
    
    // 4. 去除特殊字符（保留中文、英文、数字、常用标点）
    clean = clean.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.,!?;:()[\]{}'"@#$%^&*+=\-_/\\]/g, ' ');
    
    return clean.trim();
  }

  /**
   * 存储向量到数据库
   */
  private async storeEmbedding(messageId: string, vector: number[]): Promise<void> {
    try {
      // 检查邮件嵌入表是否存在，如果不存在则创建
      await this.ensureEmbeddingTableExists();
      
      const query = `
        INSERT INTO email_embeddings (message_id, vector, model, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (message_id) 
        DO UPDATE SET 
          vector = $2,
          model = $3,
          updated_at = NOW()
      `;
      
      await this.db.query(query, [
        messageId, 
        JSON.stringify(vector),
        this.EMBEDDING_MODEL
      ]);
      
    } catch (error) {
      logger.error('Failed to store embedding', { error, messageId });
      throw error;
    }
  }

  /**
   * 确保嵌入表存在
   */
  private async ensureEmbeddingTableExists(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS email_embeddings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL,
          vector JSONB NOT NULL,
          model VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(message_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_email_embeddings_message_id 
          ON email_embeddings(message_id);
        CREATE INDEX IF NOT EXISTS idx_email_embeddings_model 
          ON email_embeddings(model);
        CREATE INDEX IF NOT EXISTS idx_email_embeddings_created_at 
          ON email_embeddings(created_at);
      `;
      
      await this.db.query(createTableQuery);
      
    } catch (error) {
      logger.error('Failed to ensure embedding table exists', { error });
      throw error;
    }
  }

  /**
   * 解析存储的向量
   */
  private parseVector(vectorData: any): number[] {
    try {
      if (typeof vectorData === 'string') {
        return JSON.parse(vectorData);
      }
      if (Array.isArray(vectorData)) {
        return vectorData;
      }
      throw new Error('Invalid vector format');
    } catch (error) {
      logger.error('Failed to parse vector', { error, vectorData });
      throw new Error('向量数据格式错误');
    }
  }

  /**
   * 构建语义搜索过滤条件
   */
  private buildSemanticFilterConditions(
    filters: AdvancedSearchQuery['filters'], 
    startParamIndex: number
  ): { filterSQL: string; filterParams: any[] } {
    if (!filters) {
      return { filterSQL: '', filterParams: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    // 发件人过滤
    if (filters.sender?.addresses) {
      conditions.push(`em.sender_address = ANY($${++paramIndex})`);
      params.push(filters.sender.addresses);
    }

    // 日期过滤
    if (filters.dates?.received) {
      if (filters.dates.received.start) {
        conditions.push(`em.received_at >= $${++paramIndex}`);
        params.push(filters.dates.received.start);
      }
      if (filters.dates.received.end) {
        conditions.push(`em.received_at <= $${++paramIndex}`);
        params.push(filters.dates.received.end);
      }
    }

    // 重要性过滤
    if (filters.properties?.importance) {
      conditions.push(`em.importance = $${++paramIndex}`);
      params.push(filters.properties.importance);
    }

    // 附件过滤
    if (filters.properties?.hasAttachments !== undefined) {
      conditions.push(`em.has_attachments = $${++paramIndex}`);
      params.push(filters.properties.hasAttachments);
    }

    const filterSQL = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
    return { filterSQL, filterParams: params };
  }

  /**
   * 映射到EmailMessage格式
   */
  private mapToEmailMessage(row: any): EmailMessage {
    return {
      id: row.message_id,
      userId: '',
      accountId: '',
      messageId: row.message_id,
      conversationId: '',
      subject: row.subject,
      sender: {
        name: row.sender_name,
        address: row.sender_address
      },
      recipients: {
        to: [],
        cc: [],
        bcc: []
      },
      content: {
        text: row.content_text,
        html: ''
      },
      receivedAt: row.received_at,
      sentAt: row.received_at,
      importance: row.importance,
      isRead: true,
      isDraft: false,
      hasAttachments: false,
      attachments: [],
      folders: [],
      tags: [],
      customProperties: {},
      createdAt: row.received_at,
      updatedAt: row.received_at
    };
  }
}

export default SemanticSearchService;