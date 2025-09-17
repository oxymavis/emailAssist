import { Router } from 'express';
import { body, query, param } from 'express-validator';
import SearchController from '@/controllers/SearchController';
import { authenticateToken } from '@/middleware/auth';
import { apiOptimization } from '@/middleware/apiOptimization';
import rateLimit from 'express-rate-limit';

const router = Router();
const searchController = new SearchController();

// 搜索接口的速率限制
const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 每分钟最多100次搜索请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '搜索请求过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 语义搜索的更严格限制（因为调用外部API）
const semanticSearchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 每分钟最多20次语义搜索请求
  message: {
    success: false,
    error: {
      code: 'SEMANTIC_RATE_LIMIT_EXCEEDED',
      message: '语义搜索请求过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 管理员操作限制
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每分钟最多10次管理操作
  message: {
    success: false,
    error: {
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      message: '管理操作过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 搜索查询验证器
const searchQueryValidators = [
  body('query')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('搜索查询长度必须在1-500字符之间'),
  body('queryType')
    .optional()
    .isIn(['fulltext', 'semantic', 'advanced', 'filter'])
    .withMessage('查询类型无效'),
  body('fulltext')
    .optional()
    .isObject()
    .withMessage('全文搜索参数必须是对象'),
  body('fulltext.language')
    .optional()
    .isIn(['zh', 'en', 'auto'])
    .withMessage('语言参数无效'),
  body('fulltext.operator')
    .optional()
    .isIn(['and', 'or'])
    .withMessage('操作符必须是and或or'),
  body('semantic')
    .optional()
    .isObject()
    .withMessage('语义搜索参数必须是对象'),
  body('semantic.threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('相似度阈值必须在0-1之间'),
  body('semantic.maxResults')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('最大结果数必须在1-100之间'),
  body('pagination.page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须大于0'),
  body('pagination.limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('分页大小必须在1-100之间'),
  body('sort.field')
    .optional()
    .isIn(['date', 'sender', 'subject', 'importance', 'relevance', 'sentiment', 'priority'])
    .withMessage('排序字段无效'),
  body('sort.direction')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('排序方向必须是asc或desc'),
];

// 语义搜索验证器
const semanticSearchValidators = [
  body('query')
    .notEmpty()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('搜索查询不能为空且长度必须在1-500字符之间'),
  body('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('相似度阈值必须在0-1之间'),
  body('maxResults')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('最大结果数必须在1-100之间'),
  body('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('包含元数据标志必须是布尔值'),
];

// 过滤器预设验证器
const filterPresetValidators = [
  body('name')
    .notEmpty()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('预设名称不能为空且长度不超过100字符'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('描述长度不超过500字符'),
  body('filterConfig')
    .notEmpty()
    .isObject()
    .withMessage('过滤器配置不能为空且必须是对象'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('公开标志必须是布尔值'),
];

// 查询参数验证器
const queryValidators = {
  suggestions: [
    query('q')
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('查询不能为空且长度不超过100字符'),
  ],
  
  autocomplete: [
    query('q')
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('查询不能为空且长度不超过100字符'),
    query('type')
      .optional()
      .isIn(['all', 'sender', 'subject', 'keyword', 'filter'])
      .withMessage('类型参数无效'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('限制数量必须在1-50之间'),
  ],
  
  history: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('限制数量必须在1-200之间'),
  ],
  
  analytics: [
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d'])
      .withMessage('时间范围参数无效'),
    query('userId')
      .optional()
      .isUUID()
      .withMessage('用户ID格式无效'),
  ],
  
  similar: [
    param('messageId')
      .notEmpty()
      .isUUID()
      .withMessage('邮件ID格式无效'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('推荐数量必须在1-50之间'),
  ],
  
  rebuildIndex: [
    param('indexName')
      .notEmpty()
      .isString()
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('索引名称格式无效'),
  ]
};

// ===== 搜索接口 =====

/**
 * 高级搜索
 * POST /api/search/advanced
 */
router.post('/advanced',
  authenticateToken,
  searchRateLimit,
  apiOptimization,
  searchQueryValidators,
  searchController.searchAdvanced
);

/**
 * 全文搜索
 * POST /api/search/fulltext
 */
router.post('/fulltext',
  authenticateToken,
  searchRateLimit,
  apiOptimization,
  [
    body('query')
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('全文搜索查询不能为空且长度必须在1-500字符之间'),
    ...searchQueryValidators.slice(2) // 跳过可选的query验证
  ],
  searchController.searchFulltext
);

/**
 * 语义搜索
 * POST /api/search/semantic
 */
router.post('/semantic',
  authenticateToken,
  semanticSearchRateLimit,
  apiOptimization,
  semanticSearchValidators,
  searchController.searchSemantic
);

// ===== 搜索辅助功能 =====

/**
 * 获取搜索建议
 * GET /api/search/suggestions?q=query
 */
router.get('/suggestions',
  authenticateToken,
  searchRateLimit,
  queryValidators.suggestions,
  searchController.getSuggestions
);

/**
 * 自动完成搜索
 * GET /api/search/autocomplete?q=query&type=all&limit=10
 */
router.get('/autocomplete',
  authenticateToken,
  searchRateLimit,
  queryValidators.autocomplete,
  searchController.autocomplete
);

/**
 * 获取搜索历史
 * GET /api/search/history?limit=50
 */
router.get('/history',
  authenticateToken,
  queryValidators.history,
  searchController.getSearchHistory
);

// ===== 过滤器预设管理 =====

/**
 * 获取过滤器预设
 * GET /api/search/filter-presets
 */
router.get('/filter-presets',
  authenticateToken,
  searchController.getFilterPresets
);

/**
 * 保存过滤器预设
 * POST /api/search/filter-presets
 */
router.post('/filter-presets',
  authenticateToken,
  filterPresetValidators,
  searchController.saveFilterPreset
);

/**
 * 更新过滤器预设
 * PUT /api/search/filter-presets/:id
 */
router.put('/filter-presets/:id',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .isUUID()
      .withMessage('预设ID格式无效'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('预设名称长度不超过100字符'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('描述长度不超过500字符'),
    body('filterConfig')
      .optional()
      .isObject()
      .withMessage('过滤器配置必须是对象'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('公开标志必须是布尔值'),
  ],
  searchController.updateFilterPreset
);

/**
 * 删除过滤器预设
 * DELETE /api/search/filter-presets/:id
 */
router.delete('/filter-presets/:id',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .isUUID()
      .withMessage('预设ID格式无效'),
  ],
  searchController.deleteFilterPreset
);

// ===== 搜索分析和管理 =====

/**
 * 获取搜索分析统计
 * GET /api/search/analytics?timeRange=30d&userId=xxx
 */
router.get('/analytics',
  authenticateToken,
  queryValidators.analytics,
  searchController.getSearchAnalytics
);

/**
 * 获取索引状态（仅管理员）
 * GET /api/search/indexes
 */
router.get('/indexes',
  authenticateToken,
  adminRateLimit,
  searchController.getIndexStatus
);

/**
 * 重建索引（仅管理员）
 * POST /api/search/indexes/:indexName/rebuild
 */
router.post('/indexes/:indexName/rebuild',
  authenticateToken,
  adminRateLimit,
  queryValidators.rebuildIndex,
  searchController.rebuildIndex
);

// ===== 语义搜索功能 =====

/**
 * 获取相似邮件推荐
 * GET /api/search/similar/:messageId?limit=10
 */
router.get('/similar/:messageId',
  authenticateToken,
  searchRateLimit,
  queryValidators.similar,
  searchController.getSimilarEmails
);

/**
 * 更新邮件向量
 * POST /api/search/embeddings/update
 */
router.post('/embeddings/update',
  authenticateToken,
  adminRateLimit,
  [
    body('messageIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('邮件ID数组不能为空且不超过100个'),
    body('messageIds.*')
      .isUUID()
      .withMessage('邮件ID格式无效'),
    body('batchUpdate')
      .optional()
      .isBoolean()
      .withMessage('批量更新标志必须是布尔值'),
  ],
  searchController.updateEmbeddings
);

/**
 * 获取向量统计（仅管理员）
 * GET /api/search/embeddings/stats
 */
router.get('/embeddings/stats',
  authenticateToken,
  adminRateLimit,
  searchController.getEmbeddingStats
);

// ===== 开发和测试接口 =====

/**
 * 搜索测试接口（仅非生产环境）
 * POST /api/search/test
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test',
    authenticateToken,
    [
      body('type')
        .notEmpty()
        .isString()
        .withMessage('测试类型不能为空'),
      body('query')
        .optional()
        .isString()
        .withMessage('查询必须是字符串'),
    ],
    searchController.testSearch
  );
}

// ===== 文档和健康检查 =====

/**
 * 搜索服务健康检查
 * GET /api/search/health
 */
router.get('/health', 
  authenticateToken,
  async (req, res) => {
    try {
      // 简单的健康检查
      const timestamp = new Date();
      const status = {
        service: 'search',
        status: 'healthy',
        timestamp,
        features: {
          advancedSearch: true,
          fulltextSearch: true,
          semanticSearch: !!process.env.DEEPSEEK_API_KEY,
          suggestions: true,
          analytics: true,
          filterPresets: true
        },
        limits: {
          maxQueryLength: 500,
          maxResults: 100,
          searchRateLimit: '100/min',
          semanticRateLimit: '20/min'
        }
      };

      res.json({
        success: true,
        data: status,
        meta: {
          timestamp: timestamp.toISOString(),
          version: '1.0.0',
          requestId: req.requestId || 'unknown'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: '健康检查失败'
        }
      });
    }
  }
);

/**
 * 搜索功能说明
 * GET /api/search/info
 */
router.get('/info',
  authenticateToken,
  async (req, res) => {
    const info = {
      name: 'Email Assist 高级搜索系统',
      version: '1.0.0',
      description: '提供全文搜索、语义搜索、智能过滤等功能',
      features: {
        fulltext: {
          name: '全文搜索',
          description: '基于PostgreSQL全文搜索引擎，支持中英文分词',
          endpoint: 'POST /api/search/fulltext',
          supports: ['中文分词', '模糊匹配', '布尔操作', '结果高亮']
        },
        semantic: {
          name: '语义搜索',
          description: '基于DeepSeek API的向量相似度搜索',
          endpoint: 'POST /api/search/semantic',
          supports: ['语义理解', '相似度匹配', '上下文感知', '智能推荐'],
          enabled: !!process.env.DEEPSEEK_API_KEY
        },
        advanced: {
          name: '高级搜索',
          description: '支持复杂过滤条件的组合搜索',
          endpoint: 'POST /api/search/advanced',
          supports: ['多条件过滤', '日期范围', '发件人筛选', '内容分析']
        },
        suggestions: {
          name: '搜索建议',
          description: '基于历史搜索和热门词汇的智能建议',
          endpoint: 'GET /api/search/suggestions',
          supports: ['历史搜索', '热门推荐', '拼写纠错', '相关词汇']
        },
        analytics: {
          name: '搜索分析',
          description: '搜索行为统计和性能监控',
          endpoint: 'GET /api/search/analytics',
          supports: ['使用统计', '性能分析', '热门查询', '用户行为']
        }
      },
      limits: {
        queryLength: 500,
        resultsPerPage: 100,
        historyLimit: 200,
        presetLimit: 50,
        rateLimits: {
          search: '100 requests/minute',
          semantic: '20 requests/minute',
          admin: '10 requests/minute'
        }
      },
      documentation: '/api/docs/search'
    };

    res.json({
      success: true,
      data: info,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        requestId: req.requestId || 'unknown'
      }
    });
  }
);

export default router;