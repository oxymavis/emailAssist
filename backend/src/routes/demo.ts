import { Router } from 'express';
import { RuleDemoController } from '@/controllers/RuleDemoController';

const router = Router();

/**
 * 规则引擎演示路由
 * 提供完整的规则引擎功能演示，不需要数据库
 */

/**
 * @route   GET /api/v1/demo/init
 * @desc    初始化演示数据
 * @access  Public
 */
router.get('/init', RuleDemoController.initDemo);

/**
 * @route   POST /api/v1/demo/run
 * @desc    运行完整的规则引擎演示
 * @access  Public
 */
router.post('/run', RuleDemoController.runDemo);

/**
 * @route   GET /api/v1/demo/stats
 * @desc    获取演示统计信息
 * @access  Public
 */
router.get('/stats', RuleDemoController.getDemoStats);

/**
 * @route   GET /api/v1/demo/rules
 * @desc    获取演示规则列表
 * @access  Public
 */
router.get('/rules', RuleDemoController.getDemoRules);

/**
 * @route   GET /api/v1/demo/emails
 * @desc    获取演示邮件列表
 * @access  Public
 */
router.get('/emails', RuleDemoController.getDemoEmails);

/**
 * @route   POST /api/v1/demo/test-rule/:ruleId
 * @desc    测试单个规则对所有演示邮件的匹配效果
 * @access  Public
 */
router.post('/test-rule/:ruleId', RuleDemoController.testSingleRule);

/**
 * @route   POST /api/v1/demo/create
 * @desc    创建演示规则
 * @access  Public
 * @body    {CreateFilterRuleRequest}
 */
router.post('/create', RuleDemoController.createDemoRule);

/**
 * @route   POST /api/v1/demo/preview
 * @desc    预览规则执行效果
 * @access  Public
 * @body    {conditions, logicOperator, actions}
 */
router.post('/preview', RuleDemoController.previewRuleEffect);

/**
 * @route   POST /api/v1/demo/cleanup
 * @desc    清理缓存
 * @access  Public
 */
router.post('/cleanup', RuleDemoController.cleanupCache);

/**
 * @route   POST /api/v1/demo/reset
 * @desc    重置演示数据
 * @access  Public
 */
router.post('/reset', RuleDemoController.resetDemo);

/**
 * @route   GET /api/v1/demo/health
 * @desc    获取系统健康状态
 * @access  Public
 */
router.get('/health', RuleDemoController.getSystemHealth);

export default router;