import { Router } from 'express';
import { RulesController, 
  createRuleValidation, 
  updateRuleValidation, 
  testRuleValidation,
  batchApplyValidation,
  updatePrioritiesValidation,
  fromTemplateValidation,
  importRulesValidation 
} from '@/controllers/RulesController';
import { authenticate } from '@/middleware/auth';
import { param } from 'express-validator';

const router = Router();

// 应用认证中间件到所有路由
router.use(authenticate);

// 规则管理路由
/**
 * @route   GET /api/v1/rules
 * @desc    获取用户的过滤规则列表
 * @access  Private
 * @query   {number} page - 页码（默认1）
 * @query   {number} limit - 每页数量（默认20，最大100）
 * @query   {boolean} active - 过滤活动状态
 * @query   {string} search - 搜索关键词
 */
router.get('/', RulesController.getRules);

/**
 * @route   GET /api/v1/rules/templates
 * @desc    获取规则模板列表
 * @access  Private
 * @query   {string} category - 模板分类
 */
router.get('/templates', RulesController.getRuleTemplates);

/**
 * @route   GET /api/v1/rules/statistics
 * @desc    获取规则执行统计信息
 * @access  Private
 * @query   {string} ruleId - 特定规则ID（可选）
 * @query   {string} dateFrom - 开始日期（可选）
 * @query   {string} dateTo - 结束日期（可选）
 */
router.get('/statistics', RulesController.getRuleStatistics);

/**
 * @route   GET /api/v1/rules/export
 * @desc    导出规则配置
 * @access  Private
 * @query   {string} ruleIds - 规则ID列表，用逗号分隔（可选，默认导出所有）
 */
router.get('/export', RulesController.exportRules);

/**
 * @route   POST /api/v1/rules
 * @desc    创建新的过滤规则
 * @access  Private
 * @body    {CreateFilterRuleRequest}
 */
router.post('/', createRuleValidation, RulesController.createRule);

/**
 * @route   POST /api/v1/rules/test
 * @desc    测试规则匹配
 * @access  Private
 * @body    {RuleTestRequest}
 */
router.post('/test', testRuleValidation, RulesController.testRule);

/**
 * @route   POST /api/v1/rules/batch-apply
 * @desc    批量应用规则到邮件
 * @access  Private
 * @body    {BatchRuleApplyRequest}
 */
router.post('/batch-apply', batchApplyValidation, RulesController.batchApplyRules);

/**
 * @route   POST /api/v1/rules/priorities
 * @desc    更新规则优先级顺序
 * @access  Private
 * @body    {ruleIds: string[]} - 按新优先级顺序排列的规则ID数组
 */
router.post('/priorities', updatePrioritiesValidation, RulesController.updateRulePriorities);

/**
 * @route   POST /api/v1/rules/from-template
 * @desc    从模板创建规则
 * @access  Private
 * @body    {templateId: string, customizations?: object}
 */
router.post('/from-template', fromTemplateValidation, RulesController.createRuleFromTemplate);

/**
 * @route   POST /api/v1/rules/import
 * @desc    导入规则配置
 * @access  Private
 * @body    {rules: CreateFilterRuleRequest[], replaceExisting?: boolean}
 */
router.post('/import', importRulesValidation, RulesController.importRules);

/**
 * @route   GET /api/v1/rules/:id
 * @desc    获取特定规则详情
 * @access  Private
 * @param   {string} id - 规则ID
 */
router.get('/:id', 
  param('id').isUUID().withMessage('Invalid rule ID'),
  RulesController.getRule
);

/**
 * @route   PUT /api/v1/rules/:id
 * @desc    更新特定规则
 * @access  Private
 * @param   {string} id - 规则ID
 * @body    {UpdateFilterRuleRequest}
 */
router.put('/:id', 
  param('id').isUUID().withMessage('Invalid rule ID'),
  updateRuleValidation,
  RulesController.updateRule
);

/**
 * @route   DELETE /api/v1/rules/:id
 * @desc    删除特定规则
 * @access  Private
 * @param   {string} id - 规则ID
 */
router.delete('/:id',
  param('id').isUUID().withMessage('Invalid rule ID'),
  RulesController.deleteRule
);

/**
 * @route   POST /api/v1/rules/:id/toggle
 * @desc    切换规则启用/禁用状态
 * @access  Private
 * @param   {string} id - 规则ID
 */
router.post('/:id/toggle',
  param('id').isUUID().withMessage('Invalid rule ID'),
  RulesController.toggleRule
);

/**
 * @route   GET /api/v1/rules/:id/logs
 * @desc    获取特定规则的执行日志
 * @access  Private
 * @param   {string} id - 规则ID
 * @query   {number} page - 页码（默认1）
 * @query   {number} limit - 每页数量（默认20）
 * @query   {string} status - 执行状态过滤（success|error|skipped）
 * @query   {string} dateFrom - 开始日期
 * @query   {string} dateTo - 结束日期
 */
router.get('/:id/logs',
  param('id').isUUID().withMessage('Invalid rule ID'),
  RulesController.getRuleLogs
);

export default router;