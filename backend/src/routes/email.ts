import { Router } from 'express';
import { body, param, query } from 'express-validator';

const router = Router();

// 基础的邮件路由用于测试
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Email routes are working!',
    timestamp: new Date().toISOString()
  });
});

// 获取邮件账户列表
router.get('/accounts', (req, res) => {
  res.json({
    success: true,
    data: {
      accounts: [],
      message: 'Email accounts endpoint working'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'test-request'
    }
  });
});

// 获取邮件列表
router.get('/messages', (req, res) => {
  res.json({
    success: true,
    data: {
      messages: [],
      total: 0,
      page: 1,
      limit: 20
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'test-request'
    }
  });
});

export default router;