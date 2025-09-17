import { 
  AdvancedSearchQuery, 
  SearchResponse, 
  SearchResult, 
  SearchSuggestion,
  SearchFacets,
  SearchHistory,
  SearchFilterPreset,
  SearchAnalytics,
  SearchIndex,
  IndexRebuildStatus,
  IAdvancedSearchService,
  EmailMessage,
  SearchError
} from '@/types';
import DatabaseManager from '@/config/database';
import CacheManager from '@/services/CacheManager';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 高级搜索服务
 * 提供全文搜索、高级过滤、搜索建议等功能
 */
export class AdvancedSearchService implements IAdvancedSearchService {
  private static instance: AdvancedSearchService;
  private db: DatabaseManager;
  private cache: CacheManager;
  private readonly CACHE_TTL = 300; // 5分钟缓存
  private readonly SEARCH_TIMEOUT = 30000; // 30秒超时

  private constructor() {
    this.db = DatabaseManager.getInstance();
    this.cache = CacheManager.getInstance();
  }

  public static getInstance(): AdvancedSearchService {
    if (!AdvancedSearchService.instance) {
      AdvancedSearchService.instance = new AdvancedSearchService();
    }
    return AdvancedSearchService.instance;
  }

  /**
   * 全文搜索
   */
  public async fulltextSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = uuidv4();

    try {
      // 验证查询参数
      this.validateSearchQuery(query);

      // 构建缓存键
      const cacheKey = this.buildCacheKey('fulltext', query, userId);
      
      // 检查缓存
      const cachedResult = await this.cache.get(cacheKey);
      if (cachedResult) {
        logger.info('Returning cached fulltext search results', { searchId, userId });
        return JSON.parse(cachedResult);
      }

      // 构建SQL查询
      const sqlQuery = this.buildFulltextQuery(query, userId);
      
      // 执行搜索
      const results = await this.executeSearch(sqlQuery);
      
      // 构建响应
      const response = await this.buildSearchResponse(results, query, searchId, startTime);
      
      // 缓存结果
      await this.cache.setWithExpiry(cacheKey, JSON.stringify(response), this.CACHE_TTL);
      
      // 记录搜索历史
      await this.recordSearchHistory({
        userId,
        queryText: query.query || '',
        queryType: 'fulltext',
        searchFilters: query.filters || {},
        resultsCount: response.total,
        executionTime: response.executionTime,
        clickedResults: [],
        searchSessionId: query.options?.groupByConversation ? searchId : undefined
      });

      return response;

    } catch (error) {
      logger.error('Fulltext search failed', { error, query, userId, searchId });
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 高级搜索（支持多种搜索方式组合）
   */
  public async advancedSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = uuidv4();

    try {
      this.validateSearchQuery(query);

      // 根据查询类型选择搜索策略
      switch (query.queryType) {
        case 'fulltext':
          return await this.fulltextSearch(query, userId);
        case 'semantic':
          // 语义搜索将在SemanticSearchService中实现
          throw new Error('语义搜索功能需要通过SemanticSearchService调用');
        case 'filter':
          return await this.filterOnlySearch(query, userId);
        default:
          return await this.combinedSearch(query, userId);
      }

    } catch (error) {
      logger.error('Advanced search failed', { error, query, userId, searchId });
      throw new Error(`高级搜索失败: ${error.message}`);
    }
  }

  /**
   * 仅过滤器搜索
   */
  private async filterOnlySearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = uuidv4();

    const cacheKey = this.buildCacheKey('filter', query, userId);
    const cachedResult = await this.cache.get(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    const sqlQuery = this.buildFilterQuery(query, userId);
    const results = await this.executeSearch(sqlQuery);
    const response = await this.buildSearchResponse(results, query, searchId, startTime);

    await this.cache.setWithExpiry(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    return response;
  }

  /**
   * 组合搜索（全文搜索 + 过滤器）
   */
  private async combinedSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = uuidv4();

    const cacheKey = this.buildCacheKey('combined', query, userId);
    const cachedResult = await this.cache.get(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    const sqlQuery = this.buildCombinedQuery(query, userId);
    const results = await this.executeSearch(sqlQuery);
    const response = await this.buildSearchResponse(results, query, searchId, startTime);

    await this.cache.setWithExpiry(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    await this.recordSearchHistory({
      userId,
      queryText: query.query || '',
      queryType: 'advanced',
      searchFilters: query.filters || {},
      resultsCount: response.total,
      executionTime: response.executionTime,
      clickedResults: []
    });

    return response;
  }

  /**
   * 获取搜索建议
   */
  public async getSuggestions(inputQuery: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const cacheKey = `search_suggestions:${userId}:${inputQuery}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const suggestions: SearchSuggestion[] = [];

      // 1. 从搜索建议表获取匹配项
      const suggestionQuery = `
        SELECT suggestion_text, category, frequency_count,
               similarity(suggestion_text, $1) as relevance
        FROM search_suggestions 
        WHERE is_active = true 
          AND (suggestion_text ILIKE $2 OR similarity(suggestion_text, $1) > 0.3)
        ORDER BY 
          CASE WHEN suggestion_text ILIKE $3 THEN 1 ELSE 2 END,
          frequency_count DESC,
          relevance DESC
        LIMIT 10
      `;

      const suggestionResults = await this.db.query(suggestionQuery, [
        inputQuery,
        `%${inputQuery}%`,
        `${inputQuery}%`
      ]);

      suggestionResults.rows.forEach(row => {
        suggestions.push({
          text: row.suggestion_text,
          type: 'keyword',
          category: row.category,
          confidence: Math.min(row.relevance * (1 + Math.log(row.frequency_count + 1) / 10), 1),
          frequency: row.frequency_count
        });
      });

      // 2. 从用户搜索历史获取相关建议
      const historyQuery = `
        SELECT DISTINCT query_text, COUNT(*) as frequency
        FROM search_history 
        WHERE user_id = $1 
          AND query_text ILIKE $2
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY query_text
        ORDER BY frequency DESC, MAX(created_at) DESC
        LIMIT 5
      `;

      const historyResults = await this.db.query(historyQuery, [userId, `%${inputQuery}%`]);
      
      historyResults.rows.forEach(row => {
        suggestions.push({
          text: row.query_text,
          type: 'query',
          category: 'history',
          confidence: Math.min(0.8 + (row.frequency * 0.1), 1),
          frequency: row.frequency
        });
      });

      // 3. 从邮件数据获取发件人建议
      const senderQuery = `
        SELECT DISTINCT sender_address, sender_name, COUNT(*) as frequency
        FROM email_messages em
        JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
          AND (sender_address ILIKE $2 OR sender_name ILIKE $2)
        GROUP BY sender_address, sender_name
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const senderResults = await this.db.query(senderQuery, [userId, `%${inputQuery}%`]);
      
      senderResults.rows.forEach(row => {
        suggestions.push({
          text: row.sender_name || row.sender_address,
          type: 'sender',
          category: 'sender',
          confidence: 0.7,
          frequency: row.frequency
        });
      });

      // 按相关性排序并去重
      const uniqueSuggestions = Array.from(
        new Map(suggestions.map(s => [s.text.toLowerCase(), s])).values()
      );

      const sortedSuggestions = uniqueSuggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      // 缓存结果
      await this.cache.setWithExpiry(cacheKey, JSON.stringify(sortedSuggestions), 60);

      return sortedSuggestions;

    } catch (error) {
      logger.error('Failed to get search suggestions', { error, inputQuery, userId });
      return [];
    }
  }

  /**
   * 自动完成
   */
  public async autocomplete(request: { query: string; type?: string; limit?: number }, userId: string): Promise<{ suggestions: Array<{ text: string; type: string; category: string; relevance: number; metadata?: any }>; executionTime: number }> {
    const startTime = Date.now();
    const { query, type = 'all', limit = 10 } = request;

    try {
      const suggestions = await this.getSuggestions(query, userId);
      
      // 过滤建议类型
      let filteredSuggestions = suggestions;
      if (type !== 'all') {
        filteredSuggestions = suggestions.filter(s => s.type === type);
      }

      // 转换格式
      const result = filteredSuggestions.slice(0, limit).map(s => ({
        text: s.text,
        type: s.type,
        category: s.category,
        relevance: s.confidence,
        metadata: {
          count: s.frequency,
          isPopular: (s.frequency || 0) > 5
        }
      }));

      return {
        suggestions: result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Autocomplete failed', { error, request, userId });
      throw new Error(`自动完成失败: ${error.message}`);
    }
  }

  /**
   * 获取搜索历史
   */
  public async getSearchHistory(userId: string, limit: number = 50): Promise<SearchHistory[]> {
    try {
      const query = `
        SELECT id, user_id, query_text, query_type, search_filters, 
               results_count, execution_time_ms, clicked_results, 
               search_session_id, created_at
        FROM search_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;

      const result = await this.db.query(query, [userId, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        queryText: row.query_text,
        queryType: row.query_type,
        searchFilters: row.search_filters || {},
        resultsCount: row.results_count,
        executionTime: row.execution_time_ms,
        clickedResults: row.clicked_results || [],
        searchSessionId: row.search_session_id,
        createdAt: row.created_at
      }));

    } catch (error) {
      logger.error('Failed to get search history', { error, userId });
      throw new Error(`获取搜索历史失败: ${error.message}`);
    }
  }

  /**
   * 保存搜索历史
   */
  public async saveSearchHistory(history: Omit<SearchHistory, 'id' | 'createdAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO search_history (
          user_id, query_text, query_type, search_filters, 
          results_count, execution_time_ms, clicked_results, search_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await this.db.query(query, [
        history.userId,
        history.queryText,
        history.queryType,
        JSON.stringify(history.searchFilters),
        history.resultsCount,
        history.executionTime,
        history.clickedResults,
        history.searchSessionId
      ]);

      // 更新搜索建议
      if (history.queryText.trim()) {
        await this.updateSearchSuggestions(history.queryText);
      }

    } catch (error) {
      logger.error('Failed to save search history', { error, history });
      throw new Error(`保存搜索历史失败: ${error.message}`);
    }
  }

  /**
   * 记录搜索历史
   */
  private async recordSearchHistory(history: Omit<SearchHistory, 'id' | 'createdAt'>): Promise<void> {
    try {
      await this.saveSearchHistory(history);
    } catch (error) {
      // 记录历史失败不应影响搜索结果
      logger.warn('Failed to record search history', { error, history });
    }
  }

  /**
   * 获取过滤器预设
   */
  public async getFilterPresets(userId: string): Promise<SearchFilterPreset[]> {
    try {
      const query = `
        SELECT id, user_id, name, description, filter_config, 
               is_public, usage_count, created_at, updated_at
        FROM search_filter_presets 
        WHERE user_id = $1 OR is_public = true
        ORDER BY usage_count DESC, created_at DESC
      `;

      const result = await this.db.query(query, [userId]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        filterConfig: row.filter_config,
        isPublic: row.is_public,
        usageCount: row.usage_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      logger.error('Failed to get filter presets', { error, userId });
      throw new Error(`获取过滤器预设失败: ${error.message}`);
    }
  }

  /**
   * 保存过滤器预设
   */
  public async saveFilterPreset(preset: Omit<SearchFilterPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SearchFilterPreset> {
    try {
      const query = `
        INSERT INTO search_filter_presets (
          user_id, name, description, filter_config, is_public, usage_count
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, name, description, filter_config, 
                  is_public, usage_count, created_at, updated_at
      `;

      const result = await this.db.query(query, [
        preset.userId,
        preset.name,
        preset.description,
        JSON.stringify(preset.filterConfig),
        preset.isPublic,
        preset.usageCount
      ]);

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to save filter preset', { error, preset });
      throw new Error(`保存过滤器预设失败: ${error.message}`);
    }
  }

  /**
   * 删除过滤器预设
   */
  public async deleteFilterPreset(presetId: string, userId: string): Promise<void> {
    try {
      const query = `
        DELETE FROM search_filter_presets 
        WHERE id = $1 AND user_id = $2
      `;

      const result = await this.db.query(query, [presetId, userId]);
      
      if (result.rowCount === 0) {
        throw new Error('预设不存在或无权限删除');
      }

    } catch (error) {
      logger.error('Failed to delete filter preset', { error, presetId, userId });
      throw new Error(`删除过滤器预设失败: ${error.message}`);
    }
  }

  /**
   * 获取搜索分析统计
   */
  public async getSearchAnalytics(userId?: string, timeRange?: { start: Date; end: Date }): Promise<SearchAnalytics> {
    try {
      const whereClause = this.buildAnalyticsWhereClause(userId, timeRange);
      
      // 基础统计
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total_queries,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_queries,
          COUNT(*) FILTER (WHERE results_count = 0) as no_result_queries,
          COUNT(DISTINCT user_id) as active_users
        FROM search_history 
        ${whereClause}
      `;

      const basicStats = await this.db.query(basicStatsQuery);
      const stats = basicStats.rows[0];

      // 查询类型统计
      const typeStatsQuery = `
        SELECT query_type, COUNT(*) as count
        FROM search_history 
        ${whereClause}
        GROUP BY query_type
      `;

      const typeStats = await this.db.query(typeStatsQuery);
      const queryTypes = {};
      typeStats.rows.forEach(row => {
        queryTypes[row.query_type] = parseInt(row.count);
      });

      // 热门搜索词
      const popularTermsQuery = `
        SELECT query_text as term, COUNT(*) as count
        FROM search_history 
        ${whereClause}
        AND query_text != ''
        GROUP BY query_text
        ORDER BY count DESC
        LIMIT 20
      `;

      const popularTerms = await this.db.query(popularTermsQuery);

      // 性能百分位数
      const performanceQuery = `
        SELECT 
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99
        FROM search_history 
        ${whereClause}
      `;

      const performance = await this.db.query(performanceQuery);
      const perfStats = performance.rows[0];

      return {
        totalQueries: parseInt(stats.total_queries),
        queryTypes,
        avgExecutionTime: parseFloat(stats.avg_execution_time) || 0,
        slowQueries: parseInt(stats.slow_queries),
        noResultQueries: parseInt(stats.no_result_queries),
        popularTerms: popularTerms.rows.map(row => ({
          term: row.term,
          count: parseInt(row.count)
        })),
        userActivity: {
          activeUsers: parseInt(stats.active_users),
          avgQueriesPerUser: stats.active_users > 0 ? 
            parseFloat(stats.total_queries) / parseInt(stats.active_users) : 0
        },
        performance: {
          p50ExecutionTime: parseFloat(perfStats.p50) || 0,
          p95ExecutionTime: parseFloat(perfStats.p95) || 0,
          p99ExecutionTime: parseFloat(perfStats.p99) || 0
        },
        timeRange: timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to get search analytics', { error, userId, timeRange });
      throw new Error(`获取搜索统计失败: ${error.message}`);
    }
  }

  /**
   * 获取索引状态
   */
  public async getIndexStatus(): Promise<SearchIndex[]> {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef,
          pg_size_pretty(pg_total_relation_size(indexrelid)) as size,
          pg_stat_get_tuples_inserted(indexrelid) as tuples_inserted
        FROM pg_indexes 
        JOIN pg_stat_user_indexes ON indexrelname = indexname
        WHERE indexname LIKE '%search%' OR indexname LIKE '%email%'
        ORDER BY tablename, indexname
      `;

      const result = await this.db.query(query);
      
      // 同时获取表的文档数量
      const docCountQuery = `
        SELECT 
          COUNT(*) as email_count,
          COUNT(*) FILTER (WHERE search_vector IS NOT NULL) as indexed_count
        FROM email_messages
      `;

      const docCount = await this.db.query(docCountQuery);
      const counts = docCount.rows[0];

      return result.rows.map(row => ({
        name: row.indexname,
        type: this.getIndexType(row.indexdef),
        table: row.tablename,
        columns: this.extractIndexColumns(row.indexdef),
        configuration: row.indexdef,
        isActive: true,
        lastUpdated: new Date(),
        documentCount: parseInt(counts.email_count),
        size: row.size || '0 bytes'
      }));

    } catch (error) {
      logger.error('Failed to get index status', { error });
      throw new Error(`获取索引状态失败: ${error.message}`);
    }
  }

  /**
   * 重建索引
   */
  public async rebuildIndex(indexName: string): Promise<IndexRebuildStatus> {
    try {
      const startTime = new Date();
      
      // 获取要重建的表信息
      const indexInfo = await this.getIndexInfo(indexName);
      if (!indexInfo) {
        throw new Error(`索引 ${indexName} 不存在`);
      }

      // 开始重建
      logger.info('Starting index rebuild', { indexName });

      const status: IndexRebuildStatus = {
        indexName,
        status: 'running',
        progress: 0,
        startTime,
        processedDocuments: 0,
        totalDocuments: 0
      };

      // 获取总文档数
      const countQuery = `SELECT COUNT(*) as total FROM ${indexInfo.table}`;
      const countResult = await this.db.query(countQuery);
      status.totalDocuments = parseInt(countResult.rows[0].total);

      try {
        // 重新创建搜索向量（如果是搜索向量索引）
        if (indexName.includes('search_vector')) {
          const updateQuery = `
            UPDATE email_messages 
            SET search_vector = to_tsvector(
              CASE 
                WHEN language_detected = 'en' THEN 'english'::regconfig
                ELSE 'simple'::regconfig
              END,
              COALESCE(subject, '') || ' ' || COALESCE(content_text, '')
            ),
            search_indexed_at = NOW()
            WHERE search_vector IS NULL OR search_indexed_at < updated_at
          `;
          
          await this.db.query(updateQuery);
        }

        // 重建索引
        await this.db.query(`REINDEX INDEX ${indexName}`);
        
        status.status = 'completed';
        status.progress = 100;
        status.endTime = new Date();
        status.processedDocuments = status.totalDocuments;

        logger.info('Index rebuild completed', { indexName, duration: status.endTime.getTime() - startTime.getTime() });

      } catch (rebuildError) {
        status.status = 'failed';
        status.errorMessage = rebuildError.message;
        status.endTime = new Date();
        
        logger.error('Index rebuild failed', { indexName, error: rebuildError });
      }

      return status;

    } catch (error) {
      logger.error('Failed to rebuild index', { error, indexName });
      throw new Error(`重建索引失败: ${error.message}`);
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 验证搜索查询
   */
  private validateSearchQuery(query: AdvancedSearchQuery): void {
    if (!query.query && !query.filters && query.queryType !== 'filter') {
      throw new Error('搜索查询不能为空');
    }

    if (query.query && query.query.length > 500) {
      throw new Error('搜索查询过长');
    }

    // 验证分页参数
    if (query.pagination) {
      const { page, limit } = query.pagination;
      if (page && page < 1) throw new Error('页码必须大于0');
      if (limit && (limit < 1 || limit > 100)) throw new Error('分页大小必须在1-100之间');
    }
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(type: string, query: AdvancedSearchQuery, userId: string): string {
    const queryString = JSON.stringify({
      type,
      query: query.query,
      filters: query.filters,
      sort: query.sort,
      pagination: query.pagination
    });
    
    // 使用简单哈希避免键过长
    const hash = Buffer.from(queryString).toString('base64').slice(0, 32);
    return `search:${type}:${userId}:${hash}`;
  }

  /**
   * 构建全文搜索查询
   */
  private buildFulltextQuery(query: AdvancedSearchQuery, userId: string): { text: string; params: any[] } {
    let sql = `
      SELECT DISTINCT em.id, em.subject, em.sender_address, em.sender_name,
             em.content_text, em.received_at, em.sent_at, em.importance,
             em.is_read, em.has_attachments, em.folders, em.tags,
             ts_rank(em.search_vector, plainto_tsquery($1)) as relevance_score,
             ts_headline('simple', COALESCE(em.subject, ''), plainto_tsquery($1), 
                        'MaxWords=20, MinWords=10, ShortWord=3') as subject_highlight,
             ts_headline('simple', COALESCE(em.content_text, ''), plainto_tsquery($1), 
                        'MaxWords=30, MinWords=15, ShortWord=3') as content_highlight
      FROM email_messages em
      JOIN email_accounts ea ON em.account_id = ea.id
      WHERE ea.user_id = $2
    `;

    const params = [query.query, userId];
    let paramIndex = 2;

    // 添加全文搜索条件
    if (query.query) {
      sql += ` AND em.search_vector @@ plainto_tsquery($1)`;
    }

    // 添加过滤条件
    const { filterSQL, filterParams } = this.buildFilterConditions(query.filters, paramIndex);
    sql += filterSQL;
    params.push(...filterParams);

    // 添加排序
    sql += this.buildOrderByClause(query.sort, true);

    // 添加分页
    const { page = 1, limit = 20 } = query.pagination || {};
    const offset = (page - 1) * limit;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return { text: sql, params };
  }

  /**
   * 构建过滤器查询
   */
  private buildFilterQuery(query: AdvancedSearchQuery, userId: string): { text: string; params: any[] } {
    let sql = `
      SELECT DISTINCT em.id, em.subject, em.sender_address, em.sender_name,
             em.content_text, em.received_at, em.sent_at, em.importance,
             em.is_read, em.has_attachments, em.folders, em.tags,
             1.0 as relevance_score
      FROM email_messages em
      JOIN email_accounts ea ON em.account_id = ea.id
      WHERE ea.user_id = $1
    `;

    const params = [userId];
    
    // 添加过滤条件
    const { filterSQL, filterParams } = this.buildFilterConditions(query.filters, 1);
    sql += filterSQL;
    params.push(...filterParams);

    // 添加排序
    sql += this.buildOrderByClause(query.sort, false);

    // 添加分页
    const { page = 1, limit = 20 } = query.pagination || {};
    const offset = (page - 1) * limit;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return { text: sql, params };
  }

  /**
   * 构建组合查询（全文 + 过滤器）
   */
  private buildCombinedQuery(query: AdvancedSearchQuery, userId: string): { text: string; params: any[] } {
    // 如果没有搜索词，使用过滤器查询
    if (!query.query) {
      return this.buildFilterQuery(query, userId);
    }

    return this.buildFulltextQuery(query, userId);
  }

  /**
   * 构建过滤条件
   */
  private buildFilterConditions(filters: AdvancedSearchQuery['filters'], startParamIndex: number): { filterSQL: string; filterParams: any[] } {
    if (!filters) {
      return { filterSQL: '', filterParams: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    // 发件人过滤
    if (filters.sender) {
      const senderConditions: string[] = [];
      
      if (filters.sender.addresses && filters.sender.addresses.length > 0) {
        senderConditions.push(`em.sender_address = ANY($${++paramIndex})`);
        params.push(filters.sender.addresses);
      }
      
      if (filters.sender.domains && filters.sender.domains.length > 0) {
        const domainConditions = filters.sender.domains.map(() => {
          paramIndex++;
          return `em.sender_address LIKE $${paramIndex}`;
        });
        senderConditions.push(`(${domainConditions.join(' OR ')})`);
        filters.sender.domains.forEach(domain => params.push(`%@${domain}`));
      }
      
      if (filters.sender.exclude && filters.sender.exclude.length > 0) {
        senderConditions.push(`em.sender_address != ALL($${++paramIndex})`);
        params.push(filters.sender.exclude);
      }
      
      if (senderConditions.length > 0) {
        conditions.push(`(${senderConditions.join(' AND ')})`);
      }
    }

    // 主题过滤
    if (filters.subject) {
      if (filters.subject.contains && filters.subject.contains.length > 0) {
        const subjectConditions = filters.subject.contains.map(() => {
          paramIndex++;
          return `em.subject ILIKE $${paramIndex}`;
        });
        conditions.push(`(${subjectConditions.join(' AND ')})`);
        filters.subject.contains.forEach(term => params.push(`%${term}%`));
      }
      
      if (filters.subject.excludes && filters.subject.excludes.length > 0) {
        const excludeConditions = filters.subject.excludes.map(() => {
          paramIndex++;
          return `em.subject NOT ILIKE $${paramIndex}`;
        });
        conditions.push(`(${excludeConditions.join(' AND ')})`);
        filters.subject.excludes.forEach(term => params.push(`%${term}%`));
      }
      
      if (filters.subject.exactMatch) {
        conditions.push(`em.subject = $${++paramIndex}`);
        params.push(filters.subject.exactMatch);
      }
    }

    // 日期过滤
    if (filters.dates) {
      if (filters.dates.received) {
        if (filters.dates.received.start) {
          conditions.push(`em.received_at >= $${++paramIndex}`);
          params.push(filters.dates.received.start);
        }
        if (filters.dates.received.end) {
          conditions.push(`em.received_at <= $${++paramIndex}`);
          params.push(filters.dates.received.end);
        }
      }
      
      if (filters.dates.relative) {
        const dateCondition = this.buildRelativeDateCondition(filters.dates.relative, ++paramIndex);
        if (dateCondition) {
          conditions.push(dateCondition.condition);
          params.push(...dateCondition.params);
          paramIndex += dateCondition.params.length - 1;
        }
      }
    }

    // 属性过滤
    if (filters.properties) {
      if (filters.properties.hasAttachments !== undefined) {
        conditions.push(`em.has_attachments = $${++paramIndex}`);
        params.push(filters.properties.hasAttachments);
      }
      
      if (filters.properties.isRead !== undefined) {
        conditions.push(`em.is_read = $${++paramIndex}`);
        params.push(filters.properties.isRead);
      }
      
      if (filters.properties.importance) {
        conditions.push(`em.importance = $${++paramIndex}`);
        params.push(filters.properties.importance);
      }
      
      if (filters.properties.folders && filters.properties.folders.length > 0) {
        conditions.push(`em.folders && $${++paramIndex}`);
        params.push(filters.properties.folders);
      }
    }

    const filterSQL = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
    return { filterSQL, filterParams: params };
  }

  /**
   * 构建相对日期条件
   */
  private buildRelativeDateCondition(relative: string, paramIndex: number): { condition: string; params: any[] } | null {
    const now = new Date();
    
    switch (relative) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return {
          condition: `em.received_at >= $${paramIndex}`,
          params: [todayStart]
        };
        
      case 'yesterday':
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return {
          condition: `em.received_at >= $${paramIndex} AND em.received_at < $${paramIndex + 1}`,
          params: [yesterdayStart, yesterdayEnd]
        };
        
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return {
          condition: `em.received_at >= $${paramIndex}`,
          params: [weekStart]
        };
        
      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          condition: `em.received_at >= $${paramIndex}`,
          params: [monthStart]
        };
        
      default:
        return null;
    }
  }

  /**
   * 构建排序子句
   */
  private buildOrderByClause(sort: AdvancedSearchQuery['sort'], hasRelevance: boolean): string {
    if (!sort) {
      return hasRelevance ? ' ORDER BY relevance_score DESC, em.received_at DESC' : ' ORDER BY em.received_at DESC';
    }

    const { field, direction } = sort;
    let orderField: string;

    switch (field) {
      case 'date':
        orderField = 'em.received_at';
        break;
      case 'sender':
        orderField = 'em.sender_address';
        break;
      case 'subject':
        orderField = 'em.subject';
        break;
      case 'importance':
        orderField = 'em.importance';
        break;
      case 'relevance':
        orderField = hasRelevance ? 'relevance_score' : 'em.received_at';
        break;
      default:
        orderField = 'em.received_at';
    }

    return ` ORDER BY ${orderField} ${direction.toUpperCase()}`;
  }

  /**
   * 执行搜索查询
   */
  private async executeSearch(sqlQuery: { text: string; params: any[] }): Promise<any[]> {
    try {
      const result = await this.db.query(sqlQuery.text, sqlQuery.params);
      return result.rows;
    } catch (error) {
      logger.error('Search query execution failed', { error, query: sqlQuery });
      throw error;
    }
  }

  /**
   * 构建搜索响应
   */
  private async buildSearchResponse(
    results: any[], 
    query: AdvancedSearchQuery, 
    searchId: string, 
    startTime: number
  ): Promise<SearchResponse> {
    const executionTime = Date.now() - startTime;
    
    // 转换为搜索结果格式
    const searchResults: SearchResult[] = results.map(row => ({
      id: row.id,
      score: row.relevance_score || 1,
      relevanceType: this.determineRelevanceType(row),
      email: this.mapToEmailMessage(row),
      highlights: query.options?.includeHighlight ? {
        subject: row.subject_highlight ? [row.subject_highlight] : undefined,
        content: row.content_highlight ? [row.content_highlight] : undefined
      } : undefined
    }));

    // 构建分页信息
    const { page = 1, limit = 20 } = query.pagination || {};
    const hasNext = results.length === limit;
    const hasPrevious = page > 1;

    // 获取建议（如果需要）
    let suggestions: SearchSuggestion[] | undefined;
    if (query.query && results.length === 0) {
      // 如果没有结果，提供搜索建议
      suggestions = await this.getSuggestions(query.query, 'system');
    }

    return {
      results: searchResults,
      total: results.length,
      executionTime,
      searchId,
      suggestions,
      pagination: {
        page,
        limit,
        hasNext,
        hasPrevious
      }
    };
  }

  /**
   * 确定相关性类型
   */
  private determineRelevanceType(row: any): 'exact' | 'fuzzy' | 'semantic' | 'keyword' {
    if (row.relevance_score > 0.9) return 'exact';
    if (row.relevance_score > 0.5) return 'keyword';
    return 'fuzzy';
  }

  /**
   * 映射到EmailMessage格式
   */
  private mapToEmailMessage(row: any): EmailMessage {
    return {
      id: row.id,
      userId: '', // 将在上层填充
      accountId: '', // 将在上层填充
      messageId: row.id,
      conversationId: '',
      subject: row.subject,
      sender: {
        name: row.sender_name,
        address: row.sender_address
      },
      recipients: {
        to: [], // 简化处理
        cc: [],
        bcc: []
      },
      content: {
        text: row.content_text,
        html: ''
      },
      receivedAt: row.received_at,
      sentAt: row.sent_at || row.received_at,
      importance: row.importance,
      isRead: row.is_read,
      isDraft: false,
      hasAttachments: row.has_attachments,
      attachments: [],
      folders: row.folders || [],
      tags: row.tags || [],
      customProperties: {},
      createdAt: row.received_at,
      updatedAt: row.received_at
    };
  }

  /**
   * 更新搜索建议
   */
  private async updateSearchSuggestions(queryText: string): Promise<void> {
    try {
      const words = queryText.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      
      for (const word of words) {
        await this.db.query(`
          INSERT INTO search_suggestions (suggestion_text, category, frequency_count, last_used_at)
          VALUES ($1, 'keyword', 1, NOW())
          ON CONFLICT (suggestion_text) 
          DO UPDATE SET 
            frequency_count = search_suggestions.frequency_count + 1,
            last_used_at = NOW(),
            updated_at = NOW()
        `, [word]);
      }
    } catch (error) {
      logger.warn('Failed to update search suggestions', { error, queryText });
    }
  }

  /**
   * 构建分析查询的WHERE子句
   */
  private buildAnalyticsWhereClause(userId?: string, timeRange?: { start: Date; end: Date }): string {
    const conditions = ['1=1'];
    
    if (userId) {
      conditions.push(`user_id = '${userId}'`);
    }
    
    if (timeRange) {
      conditions.push(`created_at >= '${timeRange.start.toISOString()}'`);
      conditions.push(`created_at <= '${timeRange.end.toISOString()}'`);
    } else {
      conditions.push(`created_at >= NOW() - INTERVAL '30 days'`);
    }
    
    return conditions.length > 1 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * 获取索引信息
   */
  private async getIndexInfo(indexName: string): Promise<{ table: string; definition: string } | null> {
    try {
      const query = `
        SELECT tablename, indexdef
        FROM pg_indexes 
        WHERE indexname = $1
      `;

      const result = await this.db.query(query, [indexName]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return {
        table: result.rows[0].tablename,
        definition: result.rows[0].indexdef
      };
    } catch (error) {
      logger.error('Failed to get index info', { error, indexName });
      return null;
    }
  }

  /**
   * 获取索引类型
   */
  private getIndexType(indexDef: string): 'fulltext' | 'trigram' | 'vector' {
    if (indexDef.includes('gin_trgm_ops')) return 'trigram';
    if (indexDef.includes('tsvector')) return 'fulltext';
    if (indexDef.includes('vector')) return 'vector';
    return 'fulltext';
  }

  /**
   * 提取索引列
   */
  private extractIndexColumns(indexDef: string): string[] {
    // 简单的正则提取，实际可能需要更复杂的解析
    const matches = indexDef.match(/\((.*?)\)/);
    if (matches && matches[1]) {
      return matches[1].split(',').map(col => col.trim());
    }
    return [];
  }
}

export default AdvancedSearchService;