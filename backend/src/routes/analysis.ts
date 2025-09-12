/**
 * Analysis Routes
 * 邮件AI分析相关的路由配置
 */

import { Router } from 'express';
import { AnalysisController } from '@/controllers/AnalysisController';

const router = Router();
const analysisController = new AnalysisController();

// 基础测试路由
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Analysis routes are working!',
    timestamp: new Date().toISOString()
  });
});

// 分析单个邮件
router.post('/emails/:id/analyze', analysisController.analyzeEmail.bind(analysisController));

// 批量分析邮件
router.post('/analyze/batch', analysisController.batchAnalyze.bind(analysisController));

// 获取分析状态
router.get('/analyze/status', analysisController.getAnalysisStatus.bind(analysisController));

// 获取分析历史
router.get('/analyze/history', analysisController.getAnalysisHistory.bind(analysisController));

export default router;