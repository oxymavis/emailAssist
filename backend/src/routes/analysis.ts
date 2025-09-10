/**
 * Analysis Routes
 * 邮件AI分析相关的路由配置
 */

import { Router } from 'express';
import AnalysisController, {
  validateAnalyzeEmail,
  validateBatchAnalyze,
  validateGetAnalysis,
  validateReanalyze,
  validateAnalysisHistory
} from '@/controllers/AnalysisController';
import { requireAuth } from '@/middleware/auth';
import { rateLimiter } from '@/middleware';

const router = Router();

// 所有分析路由都需要认证
router.use(requireAuth);

/**
 * @route POST /api/v1/emails/:id/analyze
 * @desc 分析单个邮件
 * @access Private
 */
router.post(
  '/emails/:id/analyze',
  rateLimiter({ maxRequests: 20, windowMs: 60 * 1000 }), // 限制每分钟20次
  validateAnalyzeEmail,
  AnalysisController.analyzeEmail
);

/**
 * @route POST /api/v1/emails/batch-analyze
 * @desc 批量分析邮件
 * @access Private
 */
router.post(
  '/emails/batch-analyze',
  rateLimiter({ maxRequests: 5, windowMs: 60 * 1000 }), // 限制每分钟5次
  validateBatchAnalyze,
  AnalysisController.batchAnalyzeEmails
);

/**
 * @route GET /api/v1/emails/:id/analysis
 * @desc 获取邮件分析结果
 * @access Private
 */
router.get(
  '/emails/:id/analysis',
  validateGetAnalysis,
  AnalysisController.getEmailAnalysis
);

/**
 * @route POST /api/v1/emails/:id/reanalyze
 * @desc 重新分析邮件
 * @access Private
 */
router.post(
  '/emails/:id/reanalyze',
  rateLimiter({ maxRequests: 10, windowMs: 60 * 1000 }), // 限制每分钟10次
  validateReanalyze,
  AnalysisController.reanalyzeEmail
);

/**
 * @route GET /api/v1/analysis/stats
 * @desc 获取分析统计信息
 * @access Private
 */
router.get(
  '/analysis/stats',
  AnalysisController.getAnalysisStats
);

/**
 * @route GET /api/v1/analysis/history
 * @desc 获取分析历史记录
 * @access Private
 */
router.get(
  '/analysis/history',
  validateAnalysisHistory,
  AnalysisController.getAnalysisHistory
);

export default router;