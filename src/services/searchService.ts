import { EventEmitter } from 'events';

export interface SearchIndex {
  id: string;
  type: 'email' | 'contact' | 'document' | 'help' | 'feature' | 'setting';
  title: string;
  content: string;
  metadata: Record<string, any>;
  tags: string[];
  category?: string;
  importance: number; // 0-1, 搜索权重
  lastUpdated: Date;
  searchKeywords: string[];
  semanticVector?: number[]; // 语义向量，用于语义搜索
}

export interface SearchQuery {
  query: string;
  type?: SearchIndex['type'][];
  filters?: Record<string, any>;
  sortBy?: 'relevance' | 'date' | 'importance' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  semantic?: boolean;
}

export interface SearchResult {
  item: SearchIndex;
  score: number;
  highlights: Array<{
    field: string;
    matches: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  }>;
  explanation?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took: number; // 搜索耗时（毫秒）
  query: SearchQuery;
  suggestions?: string[];
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

export interface SearchAnalytics {
  query: string;
  userId: string;
  timestamp: Date;
  resultsCount: number;
  clickedResults: string[];
  searchTime: number;
  refinements: string[];
  abandoned: boolean;
}

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'filter' | 'shortcut';
  weight: number;
  metadata?: Record<string, any>;
}

class SearchService extends EventEmitter {
  private index: Map<string, SearchIndex> = new Map();
  private queryHistory: SearchQuery[] = [];
  private analytics: SearchAnalytics[] = [];
  private stopWords = new Set(['的', '了', '在', '是', '和', '有', '与', '对', '及', 'a', 'an', 'the', 'is', 'are', 'and', 'or', 'but']);

  constructor() {
    super();
    this.initializeIndex();
  }

  // 索引管理
  async addToIndex(item: Omit<SearchIndex, 'id'>): Promise<SearchIndex> {
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const indexItem: SearchIndex = {
      ...item,
      id,
      searchKeywords: this.extractKeywords(item.title + ' ' + item.content),
      semanticVector: await this.generateSemanticVector(item.title + ' ' + item.content)
    };

    this.index.set(id, indexItem);
    this.emit('indexUpdated', { action: 'add', item: indexItem });
    return indexItem;
  }

  async updateIndex(id: string, updates: Partial<SearchIndex>): Promise<SearchIndex | null> {
    const item = this.index.get(id);
    if (!item) return null;

    const updatedItem = {
      ...item,
      ...updates,
      lastUpdated: new Date()
    };

    // 重新生成关键词和语义向量
    if (updates.title || updates.content) {
      const text = (updates.title || item.title) + ' ' + (updates.content || item.content);
      updatedItem.searchKeywords = this.extractKeywords(text);
      updatedItem.semanticVector = await this.generateSemanticVector(text);
    }

    this.index.set(id, updatedItem);
    this.emit('indexUpdated', { action: 'update', item: updatedItem });
    return updatedItem;
  }

  removeFromIndex(id: string): boolean {
    const removed = this.index.delete(id);
    if (removed) {
      this.emit('indexUpdated', { action: 'remove', id });
    }
    return removed;
  }

  clearIndex(): void {
    this.index.clear();
    this.emit('indexUpdated', { action: 'clear' });
  }

  getIndexSize(): number {
    return this.index.size;
  }

  // 搜索功能
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    let results = Array.from(this.index.values());

    // 类型过滤
    if (query.type && query.type.length > 0) {
      results = results.filter(item => query.type!.includes(item.type));
    }

    // 自定义过滤器
    if (query.filters) {
      results = results.filter(item => this.applyFilters(item, query.filters!));
    }

    // 文本搜索
    const searchResults: SearchResult[] = [];

    if (query.query.trim()) {
      const searchTerms = this.tokenize(query.query);

      for (const item of results) {
        const score = await this.calculateRelevanceScore(item, searchTerms, query);

        if (score > 0) {
          const highlights = this.generateHighlights(item, searchTerms);

          searchResults.push({
            item,
            score,
            highlights,
            explanation: this.generateScoreExplanation(score, searchTerms)
          });
        }
      }
    } else {
      // 无查询词时返回所有结果
      searchResults.push(...results.map(item => ({
        item,
        score: item.importance,
        highlights: [],
        explanation: '按重要性排序'
      })));
    }

    // 排序
    this.sortResults(searchResults, query.sortBy || 'relevance', query.sortOrder || 'desc');

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginatedResults = searchResults.slice(offset, offset + limit);

    const took = Date.now() - startTime;

    // 生成建议和分面
    const suggestions = await this.generateSuggestions(query.query);
    const facets = this.generateFacets(results);

    const response: SearchResponse = {
      results: paginatedResults,
      total: searchResults.length,
      took,
      query,
      suggestions,
      facets
    };

    // 记录查询历史
    this.queryHistory.push(query);

    this.emit('searchPerformed', {
      query,
      response,
      userId: 'current_user' // 实际应用中应从上下文获取
    });

    return response;
  }

  // 自动完成
  async getAutocompleteSuggestions(partial: string, limit = 10): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    const partialLower = partial.toLowerCase();

    // 基于历史查询的建议
    const queryTerms = new Set<string>();
    this.queryHistory.forEach(q => {
      this.tokenize(q.query).forEach(term => {
        if (term.toLowerCase().startsWith(partialLower)) {
          queryTerms.add(term);
        }
      });
    });

    queryTerms.forEach(term => {
      suggestions.push({
        text: term,
        type: 'query',
        weight: 0.8
      });
    });

    // 基于索引内容的建议
    this.index.forEach(item => {
      item.searchKeywords.forEach(keyword => {
        if (keyword.toLowerCase().startsWith(partialLower)) {
          suggestions.push({
            text: keyword,
            type: 'query',
            weight: 0.6,
            metadata: { source: item.title, type: item.type }
          });
        }
      });

      // 标题匹配
      if (item.title.toLowerCase().includes(partialLower)) {
        suggestions.push({
          text: item.title,
          type: 'shortcut',
          weight: 1.0,
          metadata: { id: item.id, type: item.type }
        });
      }
    });

    // 去重并排序
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, arr) =>
        arr.findIndex(s => s.text === suggestion.text) === index
      )
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    return uniqueSuggestions;
  }

  // 语义搜索
  async semanticSearch(query: string, limit = 10): Promise<SearchResult[]> {
    const queryVector = await this.generateSemanticVector(query);
    const results: SearchResult[] = [];

    this.index.forEach(item => {
      if (item.semanticVector) {
        const similarity = this.calculateCosineSimilarity(queryVector, item.semanticVector);

        if (similarity > 0.3) { // 相似度阈值
          results.push({
            item,
            score: similarity,
            highlights: [],
            explanation: `语义相似度: ${Math.round(similarity * 100)}%`
          });
        }
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // 搜索分析
  trackSearchAnalytics(analytics: Omit<SearchAnalytics, 'timestamp'>): void {
    this.analytics.push({
      ...analytics,
      timestamp: new Date()
    });

    this.emit('analyticsRecorded', analytics);
  }

  getSearchAnalytics(userId?: string, timeRange?: { start: Date; end: Date }): SearchAnalytics[] {
    let filtered = this.analytics;

    if (userId) {
      filtered = filtered.filter(a => a.userId === userId);
    }

    if (timeRange) {
      filtered = filtered.filter(a =>
        a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
      );
    }

    return filtered;
  }

  getPopularQueries(limit = 10): Array<{ query: string; count: number }> {
    const queryCount = new Map<string, number>();

    this.analytics.forEach(a => {
      const count = queryCount.get(a.query) || 0;
      queryCount.set(a.query, count + 1);
    });

    return Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // 私有方法
  private extractKeywords(text: string): string[] {
    const tokens = this.tokenize(text);
    return tokens.filter(token =>
      token.length > 2 &&
      !this.stopWords.has(token.toLowerCase()) &&
      !/^\d+$/.test(token)
    );
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private async generateSemanticVector(text: string): Promise<number[]> {
    // 简化的语义向量生成（实际应用中会使用预训练模型）
    const words = this.tokenize(text);
    const vector = new Array(100).fill(0);

    words.forEach((word, index) => {
      const hash = this.hashString(word);
      for (let i = 0; i < 100; i++) {
        vector[i] += Math.sin(hash + i) * 0.1;
      }
    });

    // 归一化
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async calculateRelevanceScore(
    item: SearchIndex,
    searchTerms: string[],
    query: SearchQuery
  ): Promise<number> {
    let score = 0;

    // 标题匹配权重更高
    const titleTokens = this.tokenize(item.title);
    const titleMatches = searchTerms.filter(term =>
      titleTokens.some(token =>
        query.fuzzy ? this.fuzzyMatch(token, term) : token.includes(term)
      )
    );
    score += titleMatches.length * 3;

    // 内容匹配
    const contentTokens = this.tokenize(item.content);
    const contentMatches = searchTerms.filter(term =>
      contentTokens.some(token =>
        query.fuzzy ? this.fuzzyMatch(token, term) : token.includes(term)
      )
    );
    score += contentMatches.length * 1;

    // 标签匹配
    const tagMatches = searchTerms.filter(term =>
      item.tags.some(tag =>
        query.fuzzy ? this.fuzzyMatch(tag.toLowerCase(), term) : tag.toLowerCase().includes(term)
      )
    );
    score += tagMatches.length * 2;

    // 重要性权重
    score *= item.importance;

    // 时间衰减（较新的内容权重更高）
    const daysSinceUpdate = (Date.now() - item.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysSinceUpdate / 365); // 一年衰减到 1/e
    score *= (1 + timeDecay);

    // 语义搜索加分
    if (query.semantic && item.semanticVector) {
      const queryVector = await this.generateSemanticVector(query.query);
      const semanticScore = this.calculateCosineSimilarity(queryVector, item.semanticVector);
      score += semanticScore * 5;
    }

    return score;
  }

  private fuzzyMatch(text: string, pattern: string, maxDistance = 2): boolean {
    return this.levenshteinDistance(text, pattern) <= maxDistance;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private generateHighlights(item: SearchIndex, searchTerms: string[]): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = [];

    // 标题高亮
    const titleHighlights = this.findHighlights(item.title, searchTerms);
    if (titleHighlights.length > 0) {
      highlights.push({ field: 'title', matches: titleHighlights });
    }

    // 内容高亮
    const contentHighlights = this.findHighlights(item.content, searchTerms);
    if (contentHighlights.length > 0) {
      highlights.push({ field: 'content', matches: contentHighlights });
    }

    return highlights;
  }

  private findHighlights(text: string, searchTerms: string[]): Array<{ text: string; start: number; end: number }> {
    const highlights: Array<{ text: string; start: number; end: number }> = [];
    const lowerText = text.toLowerCase();

    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      let startIndex = 0;

      while (true) {
        const index = lowerText.indexOf(termLower, startIndex);
        if (index === -1) break;

        highlights.push({
          text: text.substring(index, index + term.length),
          start: index,
          end: index + term.length
        });

        startIndex = index + term.length;
      }
    });

    return highlights.sort((a, b) => a.start - b.start);
  }

  private generateScoreExplanation(score: number, searchTerms: string[]): string {
    if (score > 10) return '高度相关';
    if (score > 5) return '中度相关';
    if (score > 1) return '低度相关';
    return '可能相关';
  }

  private applyFilters(item: SearchIndex, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'dateRange') {
        const { start, end } = value;
        if (item.lastUpdated < start || item.lastUpdated > end) {
          return false;
        }
      } else if (key === 'category') {
        if (item.category !== value) {
          return false;
        }
      } else if (key === 'tags') {
        const requiredTags = Array.isArray(value) ? value : [value];
        if (!requiredTags.every(tag => item.tags.includes(tag))) {
          return false;
        }
      } else if (item.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private sortResults(
    results: SearchResult[],
    sortBy: SearchQuery['sortBy'],
    sortOrder: SearchQuery['sortOrder']
  ): void {
    const modifier = sortOrder === 'desc' ? -1 : 1;

    results.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return modifier * (a.item.lastUpdated.getTime() - b.item.lastUpdated.getTime());
        case 'importance':
          return modifier * (a.item.importance - b.item.importance);
        case 'alphabetical':
          return modifier * a.item.title.localeCompare(b.item.title);
        case 'relevance':
        default:
          return modifier * (b.score - a.score);
      }
    });
  }

  private async generateSuggestions(query: string): Promise<string[]> {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    // 基于常见查询的建议
    const commonQueries = this.getPopularQueries(20);
    commonQueries.forEach(({ query: popularQuery }) => {
      if (popularQuery.toLowerCase().includes(queryLower) && popularQuery !== query) {
        suggestions.push(popularQuery);
      }
    });

    // 基于索引内容的建议
    this.index.forEach(item => {
      if (item.title.toLowerCase().includes(queryLower) && suggestions.length < 5) {
        suggestions.push(item.title);
      }
    });

    return suggestions.slice(0, 5);
  }

  private generateFacets(results: SearchIndex[]): Record<string, Array<{ value: string; count: number }>> {
    const facets: Record<string, Array<{ value: string; count: number }>> = {};

    // 类型分面
    const typeCounts = new Map<string, number>();
    results.forEach(item => {
      const count = typeCounts.get(item.type) || 0;
      typeCounts.set(item.type, count + 1);
    });

    facets.type = Array.from(typeCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // 分类分面
    const categoryCounts = new Map<string, number>();
    results.forEach(item => {
      if (item.category) {
        const count = categoryCounts.get(item.category) || 0;
        categoryCounts.set(item.category, count + 1);
      }
    });

    facets.category = Array.from(categoryCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    return facets;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private initializeIndex(): void {
    // 初始化一些示例数据
    this.addToIndex({
      type: 'help',
      title: '如何使用AI邮件分析',
      content: '使用AI邮件分析功能可以自动分类邮件、分析情感和提取关键信息。点击分析按钮开始使用。',
      metadata: { category: 'ai', difficulty: 'beginner' },
      tags: ['AI', '邮件', '分析', '自动化'],
      importance: 0.9,
      lastUpdated: new Date(),
      searchKeywords: ['AI', '邮件', '分析', '自动化', '分类', '情感']
    });

    this.addToIndex({
      type: 'feature',
      title: '邮件过滤规则',
      content: '创建自定义过滤规则来自动整理邮件。支持基于发件人、主题、内容等条件的过滤。',
      metadata: { category: 'filters', version: '2.0' },
      tags: ['过滤', '规则', '自动化', '整理'],
      importance: 0.8,
      lastUpdated: new Date(),
      searchKeywords: ['过滤', '规则', '自动化', '整理', '发件人', '主题']
    });

    this.addToIndex({
      type: 'help',
      title: '快捷键大全',
      content: '掌握快捷键可以显著提高工作效率。Ctrl+N新建邮件，Ctrl+R回复邮件，Space标记为已读。',
      metadata: { category: 'productivity', type: 'shortcuts' },
      tags: ['快捷键', '效率', '键盘'],
      importance: 0.7,
      lastUpdated: new Date(),
      searchKeywords: ['快捷键', '效率', '键盘', 'Ctrl+N', 'Ctrl+R', 'Space']
    });
  }
}

export const searchService = new SearchService();