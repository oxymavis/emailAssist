import { Pool } from 'pg';
import { createHash } from 'crypto';
import DatabaseManager from '@/config/database';
import CacheManager from '@/services/CacheManager';
import logger from '@/utils/logger';
import {
  AdvancedSearchQuery,
  SearchResult,
  SearchResponse,
  SearchSuggestion,
  SearchFacets,
  SearchHistory,
  SearchFilterPreset,
  SearchAnalytics,
  SearchIndex,
  IndexRebuildStatus,
  IAdvancedSearchService,
  AutocompleteRequest,
  AutocompleteResponse,
  EmailMessage
} from '@/types';

/**
 * 高级搜索服务
 * 实现全文搜索、过滤、排序和搜索分析功能
 */
export class AdvancedSearchService implements IAdvancedSearchService {
  private static instance: AdvancedSearchService;
  private db: Pool;
  private cache: CacheManager;

  private constructor() {
    this.db = DatabaseManager.getPool();
    this.cache = CacheManager.getInstance();
  }

  public static getInstance(): AdvancedSearchService {
    if (!AdvancedSearchService.instance) {
      AdvancedSearchService.instance = new AdvancedSearchService();
    }
    return AdvancedSearchService.instance;
  }

  /**
   * 全文搜索实现
   */
  public async fulltextSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = this.generateSearchId(query, userId);

    try {
      // 构建SQL查询
      const { sql, params } = this.buildFulltextQuery(query, userId);
      
      // 执行搜索
      const result = await this.db.query(sql, params);
      const results = this.formatSearchResults(result.rows, query);

      // 获取总数
      const countSql = this.buildCountQuery(query, userId);
      const countResult = await this.db.query(countSql.sql, countSql.params);
      const total = parseInt(countResult.rows[0].count);

      // 获取搜索分面统计
      const facets = await this.buildSearchFacets(query, userId);

      // 获取搜索建议
      const suggestions = await this.generateSearchSuggestions(query, userId);

      const executionTime = Date.now() - startTime;

      // 保存搜索历史
      await this.saveSearchHistory({
        userId,
        queryText: query.fulltext?.query || query.query || '',
        queryType: query.queryType || 'fulltext',
        searchFilters: query.filters,
        resultsCount: total,
        executionTime,
        clickedResults: [],
        searchSessionId: searchId
      });

      const response: SearchResponse = {
        results,
        total,
        executionTime,
        searchId,
        suggestions,
        facets,
        pagination: {
          page: query.pagination?.page || 1,
          limit: query.pagination?.limit || 50,
          hasNext: (query.pagination?.offset || 0) + results.length < total,
          hasPrevious: (query.pagination?.page || 1) > 1
        }
      };

      // 缓存结果
      await this.cacheSearchResults(searchId, response);

      return response;
    } catch (error) {
      logger.error('Fulltext search failed:', error);
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 语义搜索实现
   */
  public async semanticSearch(query: any, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = this.generateSearchId(query, userId);

    try {
      // 获取语义搜索服务实例
      const semanticService = (await import('./SemanticSearchService')).SemanticSearchService.getInstance();
      
      // 将查询文本向量化
      const queryVector = await semanticService.embedText(query.query);
      
      // 执行语义搜索
      const semanticResults = await semanticService.search(queryVector, query.filters, query.maxResults || 50);
      
      // 转换为标准搜索结果格式
      const results = await this.convertSemanticResults(semanticResults, query);
      
      const executionTime = Date.now() - startTime;
      const total = results.length;

      // 保存搜索历史
      await this.saveSearchHistory({
        userId,
        queryText: query.query || '',
        queryType: 'semantic',
        searchFilters: query.filters,
        resultsCount: total,
        executionTime,
        clickedResults: [],
        searchSessionId: searchId
      });

      const response: SearchResponse = {
        results,
        total,
        executionTime,
        searchId,
        suggestions: [],
        facets: await this.buildSearchFacets(query, userId),
        pagination: {
          page: 1,
          limit: total,
          hasNext: false,
          hasPrevious: false
        }
      };

      return response;
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw new Error(`语义搜索失败: ${error.message}`);
    }
  }

  /**
   * 高级搜索（组合多种搜索方式）
   */
  public async advancedSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      let results: SearchResult[] = [];
      
      // 根据查询类型选择搜索方式
      if (query.queryType === 'semantic' && query.semantic) {
        const semanticResponse = await this.semanticSearch(query.semantic, userId);
        results = semanticResponse.results;
      } else if (query.queryType === 'fulltext' && query.fulltext) {
        const fulltextResponse = await this.fulltextSearch(query, userId);
        results = fulltextResponse.results;
      } else if (query.queryType === 'advanced') {
        // 组合搜索：先执行全文搜索，然后补充语义搜索
        const fulltextResponse = await this.fulltextSearch(query, userId);
        results = fulltextResponse.results;

        // 如果结果较少且有查询文本，补充语义搜索
        if (results.length < 10 && query.query) {
          try {
            const semanticResponse = await this.semanticSearch({
              query: query.query,
              filters: query.filters,
              maxResults: 20
            }, userId);
            
            // 合并结果，避免重复
            const existingIds = new Set(results.map(r => r.id));
            const additionalResults = semanticResponse.results.filter(r => !existingIds.has(r.id));
            results = [...results, ...additionalResults.slice(0, 10)];
          } catch (error) {
            logger.warn('Semantic search supplement failed:', error);
          }
        }
      } else {
        // 纯过滤搜索
        const filterResponse = await this.fulltextSearch(query, userId);
        results = filterResponse.results;
      }

      const executionTime = Date.now() - startTime;
      const searchId = this.generateSearchId(query, userId);

      return {
        results,
        total: results.length,
        executionTime,
        searchId,
        suggestions: await this.generateSearchSuggestions(query, userId),
        facets: await this.buildSearchFacets(query, userId),
        pagination: {
          page: query.pagination?.page || 1,
          limit: query.pagination?.limit || 50,
          hasNext: false,
          hasPrevious: false
        }
      };
    } catch (error) {
      logger.error('Advanced search failed:', error);
      throw new Error(`高级搜索失败: ${error.message}`);
    }
  }

  /**
   * 获取搜索建议
   */
  public async getSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const cacheKey = `search_suggestions:${userId}:${createHash('md5').update(query).digest('hex')}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const suggestions: SearchSuggestion[] = [];

      // 1. 基于历史搜索的建议
      const historySuggestions = await this.getHistoryBasedSuggestions(query, userId);
      suggestions.push(...historySuggestions);

      // 2. 基于发件人的建议
      const senderSuggestions = await this.getSenderSuggestions(query, userId);
      suggestions.push(...senderSuggestions);

      // 3. 基于主题的建议
      const subjectSuggestions = await this.getSubjectSuggestions(query, userId);
      suggestions.push(...subjectSuggestions);

      // 4. 基于关键词的建议
      const keywordSuggestions = await this.getKeywordSuggestions(query, userId);
      suggestions.push(...keywordSuggestions);

      // 排序并限制数量
      const sortedSuggestions = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      // 缓存结果
      await this.cache.set(cacheKey, sortedSuggestions, 300);

      return sortedSuggestions;
    } catch (error) {
      logger.error('Get suggestions failed:', error);
      return [];
    }
  }

  /**
   * 自动完成
   */
  public async autocomplete(request: AutocompleteRequest, userId: string): Promise<AutocompleteResponse> {
    const startTime = Date.now();

    try {
      const suggestions: AutocompleteResponse['suggestions'] = [];

      // 根据类型获取不同的建议
      if (!request.type || request.type === 'all' || request.type === 'sender') {
        const senderSuggestions = await this.getAutocompleteSenders(request.query, userId, request.limit);
        suggestions.push(...senderSuggestions);
      }

      if (!request.type || request.type === 'all' || request.type === 'subject') {
        const subjectSuggestions = await this.getAutocompleteSubjects(request.query, userId, request.limit);
        suggestions.push(...subjectSuggestions);
      }

      if (!request.type || request.type === 'all' || request.type === 'keyword') {
        const keywordSuggestions = await this.getAutocompleteKeywords(request.query, userId, request.limit);
        suggestions.push(...keywordSuggestions);
      }

      // 包含历史搜索
      if (request.includeHistory) {
        const historySuggestions = await this.getAutocompleteHistory(request.query, userId, request.limit);
        suggestions.push(...historySuggestions);
      }

      // 排序和去重
      const uniqueSuggestions = suggestions
        .filter((s, index, self) => index === self.findIndex(t => t.text === s.text))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, request.limit || 10);

      return {
        suggestions: uniqueSuggestions,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Autocomplete failed:', error);
      return {
        suggestions: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 获取搜索历史
   */
  public async getSearchHistory(userId: string, limit: number = 50): Promise<SearchHistory[]> {
    try {
      const sql = `
        SELECT *
        FROM search_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const result = await this.db.query(sql, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Get search history failed:', error);
      return [];
    }
  }

  /**
   * 保存搜索历史
   */
  public async saveSearchHistory(history: Omit<SearchHistory, 'id' | 'createdAt'>): Promise<void> {
    try {
      const sql = `
        INSERT INTO search_history (
          user_id, query_text, query_type, search_filters,
          results_count, execution_time, clicked_results, search_session_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await this.db.query(sql, [
        history.userId,
        history.queryText,
        history.queryType,
        JSON.stringify(history.searchFilters || {}),
        history.resultsCount,
        history.executionTime,
        JSON.stringify(history.clickedResults || []),
        history.searchSessionId
      ]);
    } catch (error) {
      logger.error('Save search history failed:', error);
    }
  }

  /**
   * 获取过滤器预设
   */
  public async getFilterPresets(userId: string): Promise<SearchFilterPreset[]> {
    try {
      const sql = `
        SELECT *
        FROM search_filter_presets
        WHERE user_id = $1 OR is_public = true
        ORDER BY usage_count DESC, created_at DESC
      `;
      const result = await this.db.query(sql, [userId]);
      return result.rows.map(row => ({
        ...row,
        filterConfig: JSON.parse(row.filter_config)
      }));
    } catch (error) {
      logger.error('Get filter presets failed:', error);
      return [];
    }
  }

  /**
   * 保存过滤器预设
   */
  public async saveFilterPreset(preset: Omit<SearchFilterPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SearchFilterPreset> {
    try {
      const sql = `
        INSERT INTO search_filter_presets (
          user_id, name, description, filter_config, is_public, usage_count
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await this.db.query(sql, [
        preset.userId,
        preset.name,
        preset.description,
        JSON.stringify(preset.filterConfig),
        preset.isPublic || false,
        0
      ]);
      
      const saved = result.rows[0];
      return {
        ...saved,
        filterConfig: JSON.parse(saved.filter_config)
      };
    } catch (error) {
      logger.error('Save filter preset failed:', error);
      throw error;
    }
  }

  /**
   * 删除过滤器预设
   */
  public async deleteFilterPreset(presetId: string, userId: string): Promise<void> {
    try {
      const sql = `
        DELETE FROM search_filter_presets
        WHERE id = $1 AND user_id = $2
      `;
      await this.db.query(sql, [presetId, userId]);
    } catch (error) {
      logger.error('Delete filter preset failed:', error);
      throw error;
    }
  }

  /**
   * 获取搜索分析统计
   */
  public async getSearchAnalytics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<SearchAnalytics> {
    try {
      const baseWhere = userId ? 'WHERE user_id = $1' : '';
      const timeWhere = timeRange 
        ? `${baseWhere ? 'AND' : 'WHERE'} created_at BETWEEN $${userId ? '2' : '1'} AND $${userId ? '3' : '2'}`
        : '';
      
      const params = [];
      if (userId) params.push(userId);
      if (timeRange) {
        params.push(timeRange.start, timeRange.end);
      }

      // 基础统计
      const basicStatsSql = `
        SELECT
          COUNT(*) as total_queries,
          AVG(execution_time) as avg_execution_time,
          COUNT(CASE WHEN results_count = 0 THEN 1 END) as no_result_queries,
          COUNT(CASE WHEN execution_time > 5000 THEN 1 END) as slow_queries
        FROM search_history
        ${baseWhere} ${timeWhere}
      `;

      const basicStats = await this.db.query(basicStatsSql, params);

      // 查询类型统计
      const queryTypesSql = `
        SELECT query_type, COUNT(*) as count
        FROM search_history
        ${baseWhere} ${timeWhere}
        GROUP BY query_type
      `;

      const queryTypes = await this.db.query(queryTypesSql, params);

      // 热门搜索词
      const popularTermsSql = `
        SELECT query_text, COUNT(*) as count
        FROM search_history
        ${baseWhere} ${timeWhere}
        WHERE query_text IS NOT NULL AND query_text != ''
        GROUP BY query_text
        ORDER BY count DESC
        LIMIT 20
      `;

      const popularTerms = await this.db.query(popularTermsSql, params);

      // 用户活动统计（仅在不限制用户时计算）
      let userActivity = { activeUsers: 0, avgQueriesPerUser: 0 };
      if (!userId) {
        const userActivitySql = `
          SELECT
            COUNT(DISTINCT user_id) as active_users,
            AVG(query_count) as avg_queries_per_user
          FROM (
            SELECT user_id, COUNT(*) as query_count
            FROM search_history
            ${timeWhere}
            GROUP BY user_id
          ) user_stats
        `;

        const userActivityResult = await this.db.query(userActivitySql, timeRange ? [timeRange.start, timeRange.end] : []);
        userActivity = {
          activeUsers: parseInt(userActivityResult.rows[0].active_users) || 0,
          avgQueriesPerUser: parseFloat(userActivityResult.rows[0].avg_queries_per_user) || 0
        };
      }

      // 性能百分位数
      const performanceSql = `
        SELECT
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time) as p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time) as p99
        FROM search_history
        ${baseWhere} ${timeWhere}
      `;

      const performance = await this.db.query(performanceSql, params);

      return {
        totalQueries: parseInt(basicStats.rows[0].total_queries) || 0,
        queryTypes: queryTypes.rows.reduce((acc, row) => {
          acc[row.query_type] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>),
        avgExecutionTime: parseFloat(basicStats.rows[0].avg_execution_time) || 0,
        slowQueries: parseInt(basicStats.rows[0].slow_queries) || 0,
        noResultQueries: parseInt(basicStats.rows[0].no_result_queries) || 0,
        popularTerms: popularTerms.rows.map(row => ({
          term: row.query_text,
          count: parseInt(row.count)
        })),
        userActivity,
        performance: {
          p50ExecutionTime: parseFloat(performance.rows[0].p50) || 0,
          p95ExecutionTime: parseFloat(performance.rows[0].p95) || 0,
          p99ExecutionTime: parseFloat(performance.rows[0].p99) || 0
        },
        timeRange: timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      };
    } catch (error) {
      logger.error('Get search analytics failed:', error);
      throw error;
    }
  }

  /**
   * 获取索引状态
   */
  public async getIndexStatus(): Promise<SearchIndex[]> {
    try {
      const sql = `
        SELECT
          schemaname,
          tablename,
          indexname as name,
          indexdef as definition
        FROM pg_indexes
        WHERE tablename IN ('email_messages', 'email_analysis_cache')
        ORDER BY tablename, indexname
      `;

      const result = await this.db.query(sql);
      
      return result.rows.map(row => ({
        name: row.name,
        type: this.determineIndexType(row.definition),
        table: row.tablename,
        columns: this.extractIndexColumns(row.definition),
        configuration: row.definition,
        isActive: true,
        lastUpdated: new Date(),
        documentCount: 0,
        size: '0 MB'
      }));
    } catch (error) {
      logger.error('Get index status failed:', error);
      return [];
    }
  }

  /**
   * 重建索引
   */
  public async rebuildIndex(indexName: string): Promise<IndexRebuildStatus> {
    try {
      const startTime = new Date();
      
      // 获取当前索引定义
      const indexInfo = await this.getIndexInfo(indexName);
      if (!indexInfo) {
        throw new Error(`Index ${indexName} not found`);
      }

      // 删除旧索引
      await this.db.query(`DROP INDEX IF EXISTS ${indexName}`);
      
      // 重建索引
      await this.db.query(indexInfo.definition);
      
      const endTime = new Date();

      return {
        indexName,
        status: 'completed',
        progress: 100,
        startTime,
        endTime,
        processedDocuments: 0,
        totalDocuments: 0
      };
    } catch (error) {
      logger.error(`Rebuild index ${indexName} failed:`, error);
      return {
        indexName,
        status: 'failed',
        progress: 0,
        startTime: new Date(),
        errorMessage: error.message,
        processedDocuments: 0,
        totalDocuments: 0
      };
    }
  }

  // 私有辅助方法

  private generateSearchId(query: any, userId: string): string {
    const content = JSON.stringify({ query, userId, timestamp: Date.now() });
    return createHash('md5').update(content).digest('hex');
  }

  private buildFulltextQuery(query: AdvancedSearchQuery, userId: string): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // 基础表连接
    let sql = `
      SELECT DISTINCT
        em.*,
        eac.sentiment,
        eac.priority_score,
        eac.category,
        eac.keywords,
        eac.confidence_score,
        ts_rank(
          to_tsvector('simple', COALESCE(em.subject, '') || ' ' || COALESCE(em.content_text, '')),
          plainto_tsquery('simple', $${++paramCount})
        ) as relevance_score
      FROM email_messages em
      LEFT JOIN email_analysis_cache eac ON em.id = eac.message_id
      LEFT JOIN email_accounts ea ON em.account_id = ea.id
    `;

    // 添加用户权限过滤
    conditions.push(`ea.user_id = $${++paramCount}`);
    params.push(userId);

    // 全文搜索条件
    if (query.fulltext?.query || query.query) {
      const searchQuery = query.fulltext?.query || query.query || '';
      params.splice(0, 0, searchQuery); // 插入到第一个参数位置
      
      conditions.push(`
        to_tsvector('simple', COALESCE(em.subject, '') || ' ' || COALESCE(em.content_text, ''))
        @@ plainto_tsquery('simple', $1)
      `);
    } else {
      params.splice(0, 0, ''); // 插入空查询
    }

    // 应用过滤条件
    this.applyFilters(query.filters, conditions, params, paramCount);

    // 组合查询
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序
    sql += this.buildOrderBy(query.sort);

    // 分页
    const limit = query.pagination?.limit || 50;
    const offset = query.pagination?.offset || 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    return { sql, params };
  }

  private buildCountQuery(query: AdvancedSearchQuery, userId: string): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    let sql = `
      SELECT COUNT(DISTINCT em.id) as count
      FROM email_messages em
      LEFT JOIN email_analysis_cache eac ON em.id = eac.message_id
      LEFT JOIN email_accounts ea ON em.account_id = ea.id
    `;

    // 添加用户权限过滤
    conditions.push(`ea.user_id = $${++paramCount}`);
    params.push(userId);

    // 全文搜索条件
    if (query.fulltext?.query || query.query) {
      const searchQuery = query.fulltext?.query || query.query || '';
      conditions.push(`
        to_tsvector('simple', COALESCE(em.subject, '') || ' ' || COALESCE(em.content_text, ''))
        @@ plainto_tsquery('simple', $${++paramCount})
      `);
      params.push(searchQuery);
    }

    // 应用过滤条件
    this.applyFilters(query.filters, conditions, params, paramCount);

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    return { sql, params };
  }

  private applyFilters(
    filters: AdvancedSearchQuery['filters'], 
    conditions: string[], 
    params: any[], 
    paramCount: number
  ): number {
    if (!filters) return paramCount;

    // 发件人过滤
    if (filters.sender) {
      if (filters.sender.addresses && filters.sender.addresses.length > 0) {
        conditions.push(`em.sender_address = ANY($${++paramCount})`);
        params.push(filters.sender.addresses);
      }
      if (filters.sender.domains && filters.sender.domains.length > 0) {
        const domainConditions = filters.sender.domains.map(() => 
          `em.sender_address LIKE $${++paramCount}`
        );
        conditions.push(`(${domainConditions.join(' OR ')})`);
        filters.sender.domains.forEach(domain => params.push(`%@${domain}`));
      }
      if (filters.sender.exclude && filters.sender.exclude.length > 0) {
        conditions.push(`em.sender_address != ALL($${++paramCount})`);
        params.push(filters.sender.exclude);
      }
    }

    // 主题过滤
    if (filters.subject) {
      if (filters.subject.contains && filters.subject.contains.length > 0) {
        const subjectConditions = filters.subject.contains.map(() => 
          `em.subject ILIKE $${++paramCount}`
        );
        conditions.push(`(${subjectConditions.join(' OR ')})`);
        filters.subject.contains.forEach(term => params.push(`%${term}%`));
      }
      if (filters.subject.excludes && filters.subject.excludes.length > 0) {
        const excludeConditions = filters.subject.excludes.map(() => 
          `em.subject NOT ILIKE $${++paramCount}`
        );
        conditions.push(`(${excludeConditions.join(' AND ')})`);
        filters.subject.excludes.forEach(term => params.push(`%${term}%`));
      }
      if (filters.subject.exactMatch) {
        conditions.push(`em.subject = $${++paramCount}`);
        params.push(filters.subject.exactMatch);
      }
    }

    // 日期过滤
    if (filters.dates) {
      if (filters.dates.received?.start) {
        conditions.push(`em.received_at >= $${++paramCount}`);
        params.push(filters.dates.received.start);
      }
      if (filters.dates.received?.end) {
        conditions.push(`em.received_at <= $${++paramCount}`);
        params.push(filters.dates.received.end);
      }
      if (filters.dates.sent?.start) {
        conditions.push(`em.sent_at >= $${++paramCount}`);
        params.push(filters.dates.sent.start);
      }
      if (filters.dates.sent?.end) {
        conditions.push(`em.sent_at <= $${++paramCount}`);
        params.push(filters.dates.sent.end);
      }
    }

    // 属性过滤
    if (filters.properties) {
      if (filters.properties.hasAttachments !== undefined) {
        conditions.push(`em.has_attachments = $${++paramCount}`);
        params.push(filters.properties.hasAttachments);
      }
      if (filters.properties.isRead !== undefined) {
        conditions.push(`em.is_read = $${++paramCount}`);
        params.push(filters.properties.isRead);
      }
      if (filters.properties.importance) {
        conditions.push(`em.importance = $${++paramCount}`);
        params.push(filters.properties.importance);
      }
      if (filters.properties.folders && filters.properties.folders.length > 0) {
        conditions.push(`em.folders && $${++paramCount}`);
        params.push(filters.properties.folders);
      }
    }

    // 分析结果过滤
    if (filters.analysis) {
      if (filters.analysis.sentiment?.min !== undefined) {
        conditions.push(`eac.sentiment >= $${++paramCount}`);
        params.push(filters.analysis.sentiment.min);
      }
      if (filters.analysis.sentiment?.max !== undefined) {
        conditions.push(`eac.sentiment <= $${++paramCount}`);
        params.push(filters.analysis.sentiment.max);
      }
      if (filters.analysis.categories && filters.analysis.categories.length > 0) {
        conditions.push(`eac.category = ANY($${++paramCount})`);
        params.push(filters.analysis.categories);
      }
    }

    return paramCount;
  }

  private buildOrderBy(sort?: AdvancedSearchQuery['sort']): string {
    if (!sort) {
      return ' ORDER BY relevance_score DESC, em.received_at DESC';
    }

    const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
    
    switch (sort.field) {
      case 'date':
        return ` ORDER BY em.received_at ${direction}`;
      case 'sender':
        return ` ORDER BY em.sender_address ${direction}`;
      case 'subject':
        return ` ORDER BY em.subject ${direction}`;
      case 'importance':
        return ` ORDER BY em.importance ${direction}`;
      case 'sentiment':
        return ` ORDER BY eac.sentiment ${direction}`;
      case 'priority':
        return ` ORDER BY eac.priority_score ${direction}`;
      case 'relevance':
      default:
        return ` ORDER BY relevance_score ${direction}, em.received_at DESC`;
    }
  }

  private formatSearchResults(rows: any[], query: AdvancedSearchQuery): SearchResult[] {
    return rows.map((row, index) => ({
      id: row.id,
      score: row.relevance_score || 1.0,
      relevanceType: query.queryType === 'semantic' ? 'semantic' : 'exact',
      email: {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        messageId: row.message_id,
        conversationId: row.conversation_id,
        subject: row.subject,
        sender: {
          name: row.sender_name,
          address: row.sender_address
        },
        recipients: {
          to: JSON.parse(row.recipients_to || '[]'),
          cc: JSON.parse(row.recipients_cc || '[]'),
          bcc: JSON.parse(row.recipients_bcc || '[]')
        },
        content: {
          text: row.content_text,
          html: row.content_html
        },
        receivedAt: row.received_at,
        sentAt: row.sent_at,
        importance: row.importance,
        isRead: row.is_read,
        isDraft: row.is_draft,
        hasAttachments: row.has_attachments,
        attachments: JSON.parse(row.attachments || '[]'),
        folders: JSON.parse(row.folders || '[]'),
        tags: JSON.parse(row.tags || '[]'),
        customProperties: JSON.parse(row.custom_properties || '{}'),
        analysisResult: row.sentiment !== null ? {
          sentiment: row.sentiment,
          priority: row.priority_score,
          category: row.category,
          keywords: JSON.parse(row.keywords || '[]'),
          confidence: row.confidence_score
        } : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      highlights: query.options?.includeHighlight ? this.generateHighlights(row, query) : undefined,
      explanation: {
        matchedTerms: this.extractMatchedTerms(row, query),
        searchType: query.queryType || 'fulltext',
        scoreBreakdown: {
          textRelevance: row.relevance_score || 1.0,
          semanticSimilarity: 0,
          recencyBoost: this.calculateRecencyBoost(row.received_at),
          importanceBoost: this.calculateImportanceBoost(row.importance)
        }
      }
    }));
  }

  private async buildSearchFacets(query: AdvancedSearchQuery, userId: string): Promise<SearchFacets> {
    try {
      // 构建基础查询条件（不包含分面字段的过滤）
      const { baseConditions, baseParams } = this.buildBaseFacetQuery(query, userId);
      
      // 获取发件人分面
      const senders = await this.getFacetData(
        'sender_address', 'sender_name',
        baseConditions, baseParams,
        query.filters?.sender ? [] : undefined
      );

      // 获取日期分面
      const dates = await this.getDateFacets(baseConditions, baseParams);

      // 获取重要性分面
      const importance = await this.getFacetData(
        'importance', null,
        baseConditions, baseParams
      );

      // 获取文件夹分面
      const folders = await this.getFolderFacets(baseConditions, baseParams);

      return {
        senders,
        subjects: [], // 主题分面需要特殊处理
        dates,
        attachments: [
          { value: 'true', count: 0 },
          { value: 'false', count: 0 }
        ],
        importance,
        folders
      };
    } catch (error) {
      logger.error('Build search facets failed:', error);
      return {
        senders: [],
        subjects: [],
        dates: [],
        attachments: [],
        importance: [],
        folders: []
      };
    }
  }

  private buildBaseFacetQuery(query: AdvancedSearchQuery, userId: string): { baseConditions: string[], baseParams: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // 用户权限过滤
    conditions.push(`ea.user_id = $${++paramCount}`);
    params.push(userId);

    // 全文搜索条件
    if (query.fulltext?.query || query.query) {
      const searchQuery = query.fulltext?.query || query.query || '';
      conditions.push(`
        to_tsvector('simple', COALESCE(em.subject, '') || ' ' || COALESCE(em.content_text, ''))
        @@ plainto_tsquery('simple', $${++paramCount})
      `);
      params.push(searchQuery);
    }

    return { baseConditions: conditions, baseParams: params };
  }

  private async getFacetData(
    field: string, 
    labelField: string | null, 
    baseConditions: string[], 
    baseParams: any[],
    excludeValues?: string[]
  ): Promise<Array<{ value: string; count: number }>> {
    try {
      const excludeCondition = excludeValues && excludeValues.length > 0
        ? ` AND ${field} != ALL($${baseParams.length + 1})`
        : '';
      
      const params = [...baseParams];
      if (excludeValues && excludeValues.length > 0) {
        params.push(excludeValues);
      }

      const sql = `
        SELECT 
          ${field} as value,
          ${labelField || field} as label,
          COUNT(*) as count
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ${baseConditions.join(' AND ')}${excludeCondition}
        AND ${field} IS NOT NULL
        GROUP BY ${field}${labelField ? `, ${labelField}` : ''}
        ORDER BY count DESC
        LIMIT 20
      `;

      const result = await this.db.query(sql, params);
      
      return result.rows.map(row => ({
        value: row.value,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error(`Get facet data for ${field} failed:`, error);
      return [];
    }
  }

  private async getDateFacets(baseConditions: string[], baseParams: any[]): Promise<Array<{ value: string; count: number }>> {
    try {
      const sql = `
        SELECT 
          DATE_TRUNC('day', received_at)::date as date_value,
          COUNT(*) as count
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY DATE_TRUNC('day', received_at)
        ORDER BY date_value DESC
        LIMIT 30
      `;

      const result = await this.db.query(sql, baseParams);
      
      return result.rows.map(row => ({
        value: row.date_value,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('Get date facets failed:', error);
      return [];
    }
  }

  private async getFolderFacets(baseConditions: string[], baseParams: any[]): Promise<Array<{ value: string; count: number }>> {
    try {
      const sql = `
        SELECT 
          unnest(folders) as folder,
          COUNT(*) as count
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY folder
        ORDER BY count DESC
        LIMIT 10
      `;

      const result = await this.db.query(sql, baseParams);
      
      return result.rows.map(row => ({
        value: row.folder,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('Get folder facets failed:', error);
      return [];
    }
  }

  private async generateSearchSuggestions(query: AdvancedSearchQuery, userId: string): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    try {
      // 如果查询结果较少，提供相关建议
      if (query.query) {
        const similarTerms = await this.getSimilarSearchTerms(query.query, userId);
        suggestions.push(...similarTerms);
      }

      // 基于当前过滤条件提供建议
      if (query.filters?.sender?.addresses) {
        const senderSuggestions = await this.getRelatedSenders(query.filters.sender.addresses, userId);
        suggestions.push(...senderSuggestions);
      }
    } catch (error) {
      logger.error('Generate search suggestions failed:', error);
    }

    return suggestions.slice(0, 5);
  }

  private async getSimilarSearchTerms(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const sql = `
        SELECT DISTINCT query_text, COUNT(*) as frequency
        FROM search_history
        WHERE user_id = $1 
        AND query_text ILIKE $2
        AND query_text != $3
        GROUP BY query_text
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const result = await this.db.query(sql, [userId, `%${query}%`, query]);
      
      return result.rows.map(row => ({
        text: row.query_text,
        type: 'query',
        category: 'similar',
        confidence: Math.min(0.9, parseInt(row.frequency) / 10),
        frequency: parseInt(row.frequency)
      }));
    } catch (error) {
      logger.error('Get similar search terms failed:', error);
      return [];
    }
  }

  private async getRelatedSenders(addresses: string[], userId: string): Promise<SearchSuggestion[]> {
    try {
      // 获取与指定发件人经常一起出现的其他发件人
      const sql = `
        SELECT sender_address, COUNT(*) as frequency
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND sender_address NOT = ANY($2)
        AND conversation_id IN (
          SELECT DISTINCT conversation_id
          FROM email_messages em2
          LEFT JOIN email_accounts ea2 ON em2.account_id = ea2.id
          WHERE ea2.user_id = $1
          AND em2.sender_address = ANY($2)
        )
        GROUP BY sender_address
        ORDER BY frequency DESC
        LIMIT 3
      `;

      const result = await this.db.query(sql, [userId, addresses, addresses]);
      
      return result.rows.map(row => ({
        text: row.sender_address,
        type: 'sender',
        category: 'related',
        confidence: 0.8,
        frequency: parseInt(row.frequency)
      }));
    } catch (error) {
      logger.error('Get related senders failed:', error);
      return [];
    }
  }

  private async getHistoryBasedSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const sql = `
        SELECT query_text, COUNT(*) as frequency
        FROM search_history
        WHERE user_id = $1
        AND query_text ILIKE $2
        AND results_count > 0
        GROUP BY query_text
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const result = await this.db.query(sql, [userId, `%${query}%`]);
      
      return result.rows.map(row => ({
        text: row.query_text,
        type: 'query',
        category: 'history',
        confidence: 0.9,
        frequency: parseInt(row.frequency)
      }));
    } catch (error) {
      logger.error('Get history based suggestions failed:', error);
      return [];
    }
  }

  private async getSenderSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const sql = `
        SELECT sender_address, sender_name, COUNT(*) as frequency
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND (sender_address ILIKE $2 OR sender_name ILIKE $2)
        GROUP BY sender_address, sender_name
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const result = await this.db.query(sql, [userId, `%${query}%`]);
      
      return result.rows.map(row => ({
        text: row.sender_name || row.sender_address,
        type: 'sender',
        category: 'sender',
        confidence: 0.8
      }));
    } catch (error) {
      logger.error('Get sender suggestions failed:', error);
      return [];
    }
  }

  private async getSubjectSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const sql = `
        SELECT subject, COUNT(*) as frequency
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND subject ILIKE $2
        GROUP BY subject
        ORDER BY frequency DESC
        LIMIT 3
      `;

      const result = await this.db.query(sql, [userId, `%${query}%`]);
      
      return result.rows.map(row => ({
        text: row.subject,
        type: 'subject',
        category: 'subject',
        confidence: 0.7
      }));
    } catch (error) {
      logger.error('Get subject suggestions failed:', error);
      return [];
    }
  }

  private async getKeywordSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    try {
      const sql = `
        SELECT unnest(keywords) as keyword, COUNT(*) as frequency
        FROM email_analysis_cache eac
        LEFT JOIN email_messages em ON eac.message_id = em.id
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND unnest(keywords) ILIKE $2
        GROUP BY keyword
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const result = await this.db.query(sql, [userId, `%${query}%`]);
      
      return result.rows.map(row => ({
        text: row.keyword,
        type: 'keyword',
        category: 'analysis',
        confidence: 0.6
      }));
    } catch (error) {
      logger.error('Get keyword suggestions failed:', error);
      return [];
    }
  }

  private async getAutocompleteSenders(query: string, userId: string, limit?: number): Promise<AutocompleteResponse['suggestions']> {
    try {
      const sql = `
        SELECT DISTINCT sender_address, sender_name, COUNT(*) as frequency
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND (sender_address ILIKE $2 OR sender_name ILIKE $2)
        GROUP BY sender_address, sender_name
        ORDER BY frequency DESC
        LIMIT $3
      `;

      const result = await this.db.query(sql, [userId, `${query}%`, limit || 5]);
      
      return result.rows.map(row => ({
        text: row.sender_name || row.sender_address,
        type: 'sender',
        category: 'sender',
        relevance: Math.min(1.0, parseInt(row.frequency) / 10),
        metadata: {
          count: parseInt(row.frequency)
        }
      }));
    } catch (error) {
      logger.error('Get autocomplete senders failed:', error);
      return [];
    }
  }

  private async getAutocompleteSubjects(query: string, userId: string, limit?: number): Promise<AutocompleteResponse['suggestions']> {
    try {
      const sql = `
        SELECT subject, COUNT(*) as frequency
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND subject ILIKE $2
        GROUP BY subject
        ORDER BY frequency DESC
        LIMIT $3
      `;

      const result = await this.db.query(sql, [userId, `${query}%`, limit || 3]);
      
      return result.rows.map(row => ({
        text: row.subject,
        type: 'subject',
        category: 'subject',
        relevance: 0.8,
        metadata: {
          count: parseInt(row.frequency)
        }
      }));
    } catch (error) {
      logger.error('Get autocomplete subjects failed:', error);
      return [];
    }
  }

  private async getAutocompleteKeywords(query: string, userId: string, limit?: number): Promise<AutocompleteResponse['suggestions']> {
    try {
      const sql = `
        SELECT unnest(keywords) as keyword, COUNT(*) as frequency
        FROM email_analysis_cache eac
        LEFT JOIN email_messages em ON eac.message_id = em.id
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE ea.user_id = $1
        AND unnest(keywords) ILIKE $2
        GROUP BY keyword
        ORDER BY frequency DESC
        LIMIT $3
      `;

      const result = await this.db.query(sql, [userId, `${query}%`, limit || 5]);
      
      return result.rows.map(row => ({
        text: row.keyword,
        type: 'keyword',
        category: 'analysis',
        relevance: 0.7,
        metadata: {
          count: parseInt(row.frequency)
        }
      }));
    } catch (error) {
      logger.error('Get autocomplete keywords failed:', error);
      return [];
    }
  }

  private async getAutocompleteHistory(query: string, userId: string, limit?: number): Promise<AutocompleteResponse['suggestions']> {
    try {
      const sql = `
        SELECT query_text, COUNT(*) as frequency, MAX(created_at) as last_used
        FROM search_history
        WHERE user_id = $1
        AND query_text ILIKE $2
        AND results_count > 0
        GROUP BY query_text
        ORDER BY frequency DESC, last_used DESC
        LIMIT $3
      `;

      const result = await this.db.query(sql, [userId, `${query}%`, limit || 3]);
      
      return result.rows.map(row => ({
        text: row.query_text,
        type: 'history',
        category: 'history',
        relevance: 0.9,
        metadata: {
          count: parseInt(row.frequency),
          lastUsed: new Date(row.last_used),
          isPopular: parseInt(row.frequency) > 5
        }
      }));
    } catch (error) {
      logger.error('Get autocomplete history failed:', error);
      return [];
    }
  }

  private async convertSemanticResults(semanticResults: any[], query: any): Promise<SearchResult[]> {
    if (semanticResults.length === 0) return [];

    try {
      const messageIds = semanticResults.map(r => r.messageId);
      const sql = `
        SELECT em.*, eac.sentiment, eac.priority_score, eac.category, eac.keywords, eac.confidence_score
        FROM email_messages em
        LEFT JOIN email_analysis_cache eac ON em.id = eac.message_id
        WHERE em.id = ANY($1)
      `;

      const result = await this.db.query(sql, [messageIds]);
      const emailsMap = new Map(result.rows.map(row => [row.id, row]));

      return semanticResults.map((semanticResult, index) => {
        const email = emailsMap.get(semanticResult.messageId);
        if (!email) return null;

        return {
          id: email.id,
          score: semanticResult.similarity,
          relevanceType: 'semantic' as const,
          email: {
            id: email.id,
            userId: email.user_id,
            accountId: email.account_id,
            messageId: email.message_id,
            conversationId: email.conversation_id,
            subject: email.subject,
            sender: {
              name: email.sender_name,
              address: email.sender_address
            },
            recipients: {
              to: JSON.parse(email.recipients_to || '[]'),
              cc: JSON.parse(email.recipients_cc || '[]'),
              bcc: JSON.parse(email.recipients_bcc || '[]')
            },
            content: {
              text: email.content_text,
              html: email.content_html
            },
            receivedAt: email.received_at,
            sentAt: email.sent_at,
            importance: email.importance,
            isRead: email.is_read,
            isDraft: email.is_draft,
            hasAttachments: email.has_attachments,
            attachments: JSON.parse(email.attachments || '[]'),
            folders: JSON.parse(email.folders || '[]'),
            tags: JSON.parse(email.tags || '[]'),
            customProperties: JSON.parse(email.custom_properties || '{}'),
            analysisResult: email.sentiment !== null ? {
              sentiment: email.sentiment,
              priority: email.priority_score,
              category: email.category,
              keywords: JSON.parse(email.keywords || '[]'),
              confidence: email.confidence_score
            } : undefined,
            createdAt: email.created_at,
            updatedAt: email.updated_at
          },
          explanation: {
            matchedTerms: [],
            searchType: 'semantic',
            scoreBreakdown: {
              textRelevance: 0,
              semanticSimilarity: semanticResult.similarity,
              recencyBoost: this.calculateRecencyBoost(email.received_at),
              importanceBoost: this.calculateImportanceBoost(email.importance)
            }
          }
        };
      }).filter(Boolean) as SearchResult[];
    } catch (error) {
      logger.error('Convert semantic results failed:', error);
      return [];
    }
  }

  private generateHighlights(row: any, query: AdvancedSearchQuery): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = {};

    const searchTerm = query.fulltext?.query || query.query || '';
    if (searchTerm) {
      // 简单的高亮实现
      const highlightTerm = (text: string, term: string): string[] => {
        if (!text || !term) return [];
        const regex = new RegExp(`(${term})`, 'gi');
        const matches = text.match(regex);
        return matches || [];
      };

      if (row.subject) {
        highlights.subject = highlightTerm(row.subject, searchTerm);
      }
      if (row.content_text) {
        highlights.content = highlightTerm(row.content_text.substring(0, 500), searchTerm);
      }
      if (row.sender_name) {
        highlights.sender = highlightTerm(row.sender_name, searchTerm);
      }
    }

    return highlights;
  }

  private extractMatchedTerms(row: any, query: AdvancedSearchQuery): string[] {
    const terms: string[] = [];
    const searchTerm = query.fulltext?.query || query.query || '';
    
    if (searchTerm) {
      terms.push(searchTerm);
    }

    return terms;
  }

  private calculateRecencyBoost(receivedAt: Date): number {
    const now = new Date();
    const daysDiff = (now.getTime() - receivedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 1) return 1.0;
    if (daysDiff <= 7) return 0.8;
    if (daysDiff <= 30) return 0.6;
    if (daysDiff <= 90) return 0.4;
    return 0.2;
  }

  private calculateImportanceBoost(importance: string): number {
    switch (importance) {
      case 'high': return 1.0;
      case 'normal': return 0.7;
      case 'low': return 0.5;
      default: return 0.7;
    }
  }

  private async cacheSearchResults(searchId: string, response: SearchResponse): Promise<void> {
    try {
      const cacheKey = `search_results:${searchId}`;
      await this.cache.set(cacheKey, response, 300); // 缓存5分钟
    } catch (error) {
      logger.error('Cache search results failed:', error);
    }
  }

  private determineIndexType(definition: string): 'fulltext' | 'trigram' | 'vector' {
    if (definition.includes('gin') && definition.includes('tsvector')) {
      return 'fulltext';
    }
    if (definition.includes('gin') && definition.includes('trgm')) {
      return 'trigram';
    }
    return 'vector';
  }

  private extractIndexColumns(definition: string): string[] {
    const match = definition.match(/\((.*?)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim());
    }
    return [];
  }

  private async getIndexInfo(indexName: string): Promise<{ definition: string } | null> {
    try {
      const sql = `
        SELECT indexdef as definition
        FROM pg_indexes
        WHERE indexname = $1
      `;
      const result = await this.db.query(sql, [indexName]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Get index info for ${indexName} failed:`, error);
      return null;
    }
  }
}

export default AdvancedSearchService;