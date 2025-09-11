import { Router } from 'express';
import { Pool } from 'pg';
import RedisManager from '@/config/redis';
import { API_CONFIG } from '@/config';
import { healthCheck } from '@/middleware';
// 逐步启用路由，现在添加邮件处理、分析、规则引擎和演示
import authRoutes from './auth';
import emailRoutes from './email';
import analysisRoutes from './analysis';
import rulesRoutes from './rules';
import demoRoutes from './demo';
// import { createReportsRoutes } from './reports'; // 暂时注释掉

// Create a function to setup routes with database connections
export function createRoutes(db: Pool, redis: typeof RedisManager): Router {
  const router = Router();
  
  // Add debugging to track route creation
  console.log('🔧 Creating routes with dependencies...');
  console.log('📦 Database pool:', db ? '✅ Available' : '❌ Missing');
  console.log('📦 Redis manager:', redis ? '✅ Available' : '❌ Missing');

/**
 * API Routes Configuration
 */

// Health check endpoint (no authentication required)
router.get('/health', healthCheck);

// API version info
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Email Assist API',
      version: process.env.API_VERSION || 'v1',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: `${API_CONFIG.BASE_PATH}/auth`,
        email: `${API_CONFIG.BASE_PATH}/email`,
        analysis: `${API_CONFIG.BASE_PATH}/analysis`,
        rules: `${API_CONFIG.BASE_PATH}/rules`,
        demo: `${API_CONFIG.BASE_PATH}/demo`,
        reports: `${API_CONFIG.BASE_PATH}/reports`,
        health: '/health'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'api-info'
    }
  });
});

  // Simple test route to verify routing system
  router.get('/test', (req, res) => {
    res.json({
      success: true,
      message: 'API routing system is working!',
      timestamp: new Date().toISOString()
    });
  });

  // Mount route modules (逐步启用路由)
  try {
    console.log('📊 Mounting auth routes...');
    router.use('/auth', authRoutes);
    console.log('✅ Auth routes mounted successfully');
    
    console.log('📧 Mounting email routes...');
    router.use('/email', emailRoutes);
    console.log('✅ Email routes mounted successfully');
    
    console.log('🧠 Mounting analysis routes...');
    router.use('/', analysisRoutes); // Analysis routes are mounted directly since they include full paths
    console.log('✅ Analysis routes mounted successfully');
    
    console.log('⚙️ Mounting rules routes...');
    router.use('/rules', rulesRoutes);
    console.log('✅ Rules routes mounted successfully');
    
    console.log('🎮 Mounting demo routes...');
    router.use('/demo', demoRoutes); // Demo routes for rule engine demonstration
    console.log('✅ Demo routes mounted successfully');
    // router.use('/', analysisRoutes); // Analysis routes are mounted directly since they include full paths
    // router.use('/reports', createReportsRoutes(db, redis)); // 暂时注释掉，等修复TypeScript错误后再启用
  } catch (error) {
    console.error('❌ Error mounting routes:', error);
    throw error;
  }

  console.log('🎯 Routes setup completed, about to return router');
  
  return router;
}

// For backward compatibility, create a default export without database connections
const defaultRouter = Router();
// Health check endpoint (no authentication required)
defaultRouter.get('/health', healthCheck);

// API version info
defaultRouter.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Email Assist API',
      version: process.env.API_VERSION || 'v1',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: `${API_CONFIG.BASE_PATH}/auth`,
        email: `${API_CONFIG.BASE_PATH}/email`,
        analysis: `${API_CONFIG.BASE_PATH}/analysis`,
        rules: `${API_CONFIG.BASE_PATH}/rules`,
        demo: `${API_CONFIG.BASE_PATH}/demo`,
        reports: `${API_CONFIG.BASE_PATH}/reports`,
        health: '/health'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'api-info'
    }
  });
});

// Mount basic route modules (without reports) - 暂时注释掉直到修复控制器
// defaultRouter.use('/auth', authRoutes);
// defaultRouter.use('/email', emailRoutes);
// defaultRouter.use('/rules', rulesRoutes);
// defaultRouter.use('/demo', demoRoutes);
// defaultRouter.use('/', analysisRoutes);

export default defaultRouter;