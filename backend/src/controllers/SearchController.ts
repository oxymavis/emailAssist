import { Response } from 'express';
import { validationResult } from 'express-validator';
import AdvancedSearchService from '@/services/AdvancedSearchService';
import SemanticSearchService from '@/services/SemanticSearchService';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/response';
import {
  AuthRequest,
  AdvancedSearchQuery,
  SearchRequest,
  AutocompleteRequest,
  SaveFilterPresetRequest,
  UpdateFilterPresetRequest,
  TriggerNotificationRequest
} from '@/types';

/**
 * 搜索控制器
 * 处理高级搜索、语义搜索、自动完成等搜索相关功能
 */
export class SearchController {
  private advancedSearchService: AdvancedSearchService;
  private semanticSearchService: SemanticSearchService;

  constructor() {
    this.advancedSearchService = AdvancedSearchService.getInstance();
    this.semanticSearchService = SemanticSearchService.getInstance();
  }

  /**
   * 高级搜索
   */
  public search = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid search parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const searchQuery: AdvancedSearchQuery = req.body.query || {};
      const sessionId = req.body.sessionId;

      // 根据搜索类型调用相应的服务
      let response;
      switch (searchQuery.queryType) {
        case 'semantic':
          if (!searchQuery.semantic?.query) {
            res.status(400).json(createErrorResponse('INVALID_QUERY', 'Semantic query text is required'));
            return;
          }
          response = await this.advancedSearchService.semanticSearch(searchQuery.semantic, req.user.id);
          break;
          
        case 'fulltext':
          response = await this.advancedSearchService.fulltextSearch(searchQuery, req.user.id);
          break;
          
        case 'advanced':
          response = await this.advancedSearchService.advancedSearch(searchQuery, req.user.id);
          break;
          
        case 'filter':
        default:
          response = await this.advancedSearchService.fulltextSearch(searchQuery, req.user.id);
          break;
      }

      // 记录搜索会话信息
      if (sessionId) {
        response.searchId = sessionId;
      }

      res.json(createSuccessResponse(response.results, {
        search: {
          searchId: response.searchId,
          total: response.total,
          executionTime: response.executionTime,
          suggestions: response.suggestions,
          facets: response.facets,
          pagination: response.pagination
        }
      }));

    } catch (error) {
      logger.error('Search failed:', error);
      res.status(500).json(createErrorResponse(
        'SEARCH_FAILED', 
        error.message.includes('向量化失败') ? '语义搜索服务暂时不可用，请尝试其他搜索方式' : '搜索失败，请稍后重试'
      ));
    }
  };

  /**
   * 全文搜索
   */
  public fulltextSearch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid search parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const searchQuery: AdvancedSearchQuery = {
        queryType: 'fulltext',
        fulltext: {
          query: req.query.q as string,
          language: (req.query.lang as 'zh' | 'en') || 'auto',
          operator: (req.query.operator as 'and' | 'or') || 'and',
          fuzzy: req.query.fuzzy === 'true',
          highlight: req.query.highlight === 'true'
        },
        filters: req.body.filters,
        sort: req.body.sort,
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 50,
          offset: parseInt(req.query.offset as string) || 0
        },
        options: {
          includeHighlight: req.query.highlight === 'true',
          includeAnalysis: req.query.include_analysis === 'true',
          includeAttachments: req.query.include_attachments === 'true'
        }
      };

      const response = await this.advancedSearchService.fulltextSearch(searchQuery, req.user.id);

      res.json(createSuccessResponse(response.results, {
        search: {
          searchId: response.searchId,
          total: response.total,
          executionTime: response.executionTime,
          suggestions: response.suggestions,
          facets: response.facets,
          pagination: response.pagination
        }
      }));

    } catch (error) {
      logger.error('Fulltext search failed:', error);
      res.status(500).json(createErrorResponse('FULLTEXT_SEARCH_FAILED', '全文搜索失败，请稍后重试'));
    }
  };

  /**
   * 语义搜索
   */
  public semanticSearch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid search parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { query, threshold = 0.3, maxResults = 50, includeMetadata = true } = req.body;
      
      if (!query) {
        res.status(400).json(createErrorResponse('INVALID_QUERY', 'Search query is required'));
        return;
      }

      const semanticRequest = {
        query,
        threshold,
        maxResults,
        includeMetadata,
        filters: req.body.filters
      };

      const response = await this.advancedSearchService.semanticSearch(semanticRequest, req.user.id);

      res.json(createSuccessResponse(response.results, {
        search: {
          searchId: response.searchId,
          total: response.total,
          executionTime: response.executionTime,
          suggestions: response.suggestions,
          pagination: response.pagination
        }
      }));

    } catch (error) {
      logger.error('Semantic search failed:', error);
      
      if (error.message.includes('向量化失败') || error.message.includes('API key not configured')) {
        res.status(503).json(createErrorResponse('SEMANTIC_SERVICE_UNAVAILABLE', '语义搜索服务暂时不可用'));
      } else {
        res.status(500).json(createErrorResponse('SEMANTIC_SEARCH_FAILED', '语义搜索失败，请稍后重试'));
      }
    }
  };

  /**
   * 获取搜索建议
   */
  public getSuggestions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { q: query } = req.query;
      
      if (!query || typeof query !== 'string') {
        res.status(400).json(createErrorResponse('INVALID_QUERY', 'Query parameter is required'));
        return;
      }

      const suggestions = await this.advancedSearchService.getSuggestions(query, req.user.id);

      res.json(createSuccessResponse(suggestions));

    } catch (error) {
      logger.error('Get suggestions failed:', error);
      res.status(500).json(createErrorResponse('SUGGESTIONS_FAILED', '获取搜索建议失败'));
    }
  };

  /**
   * 自动完成
   */
  public autocomplete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { q: query, type, limit, include_history } = req.query;
      
      if (!query || typeof query !== 'string') {
        res.status(400).json(createErrorResponse('INVALID_QUERY', 'Query parameter is required'));
        return;
      }

      const request: AutocompleteRequest = {
        query,
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
        includeHistory: include_history === 'true'
      };

      const response = await this.advancedSearchService.autocomplete(request, req.user.id);

      res.json(createSuccessResponse(response.suggestions, {
        executionTime: response.executionTime
      }));

    } catch (error) {
      logger.error('Autocomplete failed:', error);
      res.status(500).json(createErrorResponse('AUTOCOMPLETE_FAILED', '自动完成失败'));
    }
  };

  /**
   * 获取搜索历史
   */
  public getSearchHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { limit } = req.query;
      const historyLimit = limit ? parseInt(limit as string) : 50;

      const history = await this.advancedSearchService.getSearchHistory(req.user.id, historyLimit);

      res.json(createSuccessResponse(history));

    } catch (error) {
      logger.error('Get search history failed:', error);
      res.status(500).json(createErrorResponse('HISTORY_FETCH_FAILED', '获取搜索历史失败'));
    }
  };

  /**
   * 获取过滤器预设
   */
  public getFilterPresets = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const presets = await this.advancedSearchService.getFilterPresets(req.user.id);

      res.json(createSuccessResponse(presets));

    } catch (error) {
      logger.error('Get filter presets failed:', error);
      res.status(500).json(createErrorResponse('PRESETS_FETCH_FAILED', '获取过滤器预设失败'));
    }
  };

  /**
   * 保存过滤器预设
   */
  public saveFilterPreset = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid preset parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { name, description, filterConfig, isPublic }: SaveFilterPresetRequest = req.body;

      if (!name || !filterConfig) {
        res.status(400).json(createErrorResponse('INVALID_INPUT', 'Name and filter configuration are required'));
        return;
      }

      const preset = await this.advancedSearchService.saveFilterPreset({
        userId: req.user.id,
        name,
        description,
        filterConfig,
        isPublic: isPublic || false,
        usageCount: 0
      });

      res.json(createSuccessResponse(preset, {
        message: 'Filter preset saved successfully'
      }));

    } catch (error) {
      logger.error('Save filter preset failed:', error);
      res.status(500).json(createErrorResponse('PRESET_SAVE_FAILED', '保存过滤器预设失败'));
    }
  };

  /**
   * 删除过滤器预设
   */
  public deleteFilterPreset = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { presetId } = req.params;

      await this.advancedSearchService.deleteFilterPreset(presetId, req.user.id);

      res.json(createSuccessResponse(null, {
        message: 'Filter preset deleted successfully'
      }));

    } catch (error) {
      logger.error('Delete filter preset failed:', error);
      res.status(500).json(createErrorResponse('PRESET_DELETE_FAILED', '删除过滤器预设失败'));
    }
  };

  /**
   * 获取搜索分析统计
   */
  public getSearchAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { start_date, end_date, global } = req.query;
      
      let timeRange;
      if (start_date && end_date) {
        timeRange = {
          start: new Date(start_date as string),
          end: new Date(end_date as string)
        };
      }

      const userId = global === 'true' && req.user.role === 'admin' ? undefined : req.user.id;
      const analytics = await this.advancedSearchService.getSearchAnalytics(userId, timeRange);

      res.json(createSuccessResponse(analytics));

    } catch (error) {
      logger.error('Get search analytics failed:', error);
      res.status(500).json(createErrorResponse('ANALYTICS_FETCH_FAILED', '获取搜索分析失败'));
    }
  };

  /**
   * 获取搜索索引状态
   */
  public getIndexStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
        return;
      }

      const indexes = await this.advancedSearchService.getIndexStatus();

      res.json(createSuccessResponse(indexes));

    } catch (error) {
      logger.error('Get index status failed:', error);
      res.status(500).json(createErrorResponse('INDEX_STATUS_FAILED', '获取索引状态失败'));
    }
  };

  /**
   * 重建搜索索引
   */
  public rebuildIndex = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
        return;
      }

      const { indexName } = req.params;
      
      if (!indexName) {
        res.status(400).json(createErrorResponse('INVALID_INPUT', 'Index name is required'));
        return;
      }

      const status = await this.advancedSearchService.rebuildIndex(indexName);

      res.json(createSuccessResponse(status, {
        message: `Index rebuild ${status.status === 'completed' ? 'completed' : 'started'}`
      }));

    } catch (error) {
      logger.error('Rebuild index failed:', error);
      res.status(500).json(createErrorResponse('INDEX_REBUILD_FAILED', '重建索引失败'));
    }
  };

  /**
   * 获取语义搜索统计
   */
  public getSemanticStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
        return;
      }

      const stats = await this.semanticSearchService.getEmbeddingStats();

      res.json(createSuccessResponse(stats));

    } catch (error) {
      logger.error('Get semantic stats failed:', error);
      res.status(500).json(createErrorResponse('SEMANTIC_STATS_FAILED', '获取语义搜索统计失败'));
    }
  };

  /**
   * 更新邮件向量
   */
  public updateMessageEmbedding = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { messageId } = req.params;
      const { content } = req.body;

      if (!content) {
        res.status(400).json(createErrorResponse('INVALID_INPUT', 'Content is required'));
        return;
      }

      await this.semanticSearchService.updateMessageEmbedding(messageId, content);

      res.json(createSuccessResponse(null, {
        message: 'Message embedding updated successfully'
      }));

    } catch (error) {
      logger.error('Update message embedding failed:', error);
      
      if (error.message.includes('API key not configured')) {
        res.status(503).json(createErrorResponse('EMBEDDING_SERVICE_UNAVAILABLE', '向量化服务不可用'));
      } else {
        res.status(500).json(createErrorResponse('EMBEDDING_UPDATE_FAILED', '更新邮件向量失败'));
      }
    }
  };

  /**
   * 批量更新邮件向量
   */
  public batchUpdateEmbeddings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid batch update parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
        return;
      }

      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json(createErrorResponse('INVALID_INPUT', 'Messages array is required'));
        return;
      }

      if (messages.length > 1000) {
        res.status(400).json(createErrorResponse('BATCH_TOO_LARGE', 'Maximum 1000 messages per batch'));
        return;
      }

      // 异步处理批量更新
      this.semanticSearchService.batchUpdateEmbeddings(messages)
        .catch(error => logger.error('Batch embedding update failed:', error));

      res.json(createSuccessResponse(null, {
        message: `Batch embedding update started for ${messages.length} messages`,
        batchSize: messages.length
      }));

    } catch (error) {
      logger.error('Batch update embeddings failed:', error);
      res.status(500).json(createErrorResponse('BATCH_EMBEDDING_FAILED', '批量更新向量失败'));
    }
  };

  /**
   * 清理旧向量
   */
  public cleanupEmbeddings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
        return;
      }

      const { days } = req.query;
      const daysBefore = days ? parseInt(days as string) : 90;

      const deletedCount = await this.semanticSearchService.cleanupOldEmbeddings(daysBefore);

      res.json(createSuccessResponse(null, {
        message: `Cleaned up ${deletedCount} old embeddings`,
        deletedCount
      }));

    } catch (error) {
      logger.error('Cleanup embeddings failed:', error);
      res.status(500).json(createErrorResponse('CLEANUP_FAILED', '清理旧向量失败'));
    }
  };

  /**
   * 搜索相似邮件
   */
  public findSimilarEmails = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { messageId } = req.params;
      const { limit = 10, threshold = 0.5 } = req.query;

      // 首先获取目标邮件的内容
      const emailQuery = `
        SELECT content_text, content_html 
        FROM email_messages em
        LEFT JOIN email_accounts ea ON em.account_id = ea.id
        WHERE em.id = $1 AND ea.user_id = $2
      `;
      
      const emailResult = await this.advancedSearchService.db.query(emailQuery, [messageId, req.user.id]);
      
      if (emailResult.rows.length === 0) {
        res.status(404).json(createErrorResponse('EMAIL_NOT_FOUND', 'Email not found'));
        return;
      }

      const email = emailResult.rows[0];
      const content = email.content_text || email.content_html || '';

      // 使用语义搜索找相似邮件
      const semanticRequest = {
        query: content,
        threshold: parseFloat(threshold as string),
        maxResults: parseInt(limit as string),
        filters: {
          // 排除当前邮件
        }
      };

      const response = await this.advancedSearchService.semanticSearch(semanticRequest, req.user.id);
      
      // 过滤掉当前邮件
      const similarEmails = response.results.filter(result => result.id !== messageId);

      res.json(createSuccessResponse(similarEmails.slice(0, parseInt(limit as string)), {
        sourceMessageId: messageId,
        threshold: parseFloat(threshold as string),
        totalFound: similarEmails.length
      }));

    } catch (error) {
      logger.error('Find similar emails failed:', error);
      res.status(500).json(createErrorResponse('SIMILAR_SEARCH_FAILED', '查找相似邮件失败'));
    }
  };
}

export default SearchController;