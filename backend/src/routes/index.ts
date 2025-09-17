import { Router } from 'express';
import { Pool } from 'pg';
import RedisManager from '@/config/redis';
import { API_CONFIG } from '@/config';
import { healthCheck } from '@/middleware';
// 逐步启用路由，现在添加邮件处理、分析、规则引擎和演示
import authRoutes from './auth';
import microsoftAuthRoutes from './microsoft-auth';
import emailServiceRoutes from './email';
import analysisRoutes from './analysis';
import rulesRoutes from './rules';
import demoRoutes from './demo';
import { createReportsRoutes } from './reports';
import performanceRoutes from './performance';
// import cacheManagementRoutes from './cacheManagement'; // temporarily disabled
// import monitoringRoutes from './monitoring'; // temporarily disabled
import { createNotificationRoutes } from './notifications';
// import integrationsRoutes from './integrations'; // temporarily disabled
import workflowsRoutes from './workflows';

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
        performance: `${API_CONFIG.BASE_PATH}/performance`,
        cache: `${API_CONFIG.BASE_PATH}/cache`,
        monitoring: `${API_CONFIG.BASE_PATH}/monitoring`,
        notifications: `${API_CONFIG.BASE_PATH}/notifications`,
        integrations: `${API_CONFIG.BASE_PATH}/integrations`,
        workflows: `${API_CONFIG.BASE_PATH}/workflows`,
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
    router.use('/auth', microsoftAuthRoutes); // 添加 Microsoft 认证路由
    console.log('✅ Auth routes mounted successfully');
    
    console.log('📧 Mounting email service routes...');
    router.use('/email', emailServiceRoutes);
    console.log('✅ Email service routes mounted successfully');
    
    console.log('🧠 Mounting analysis routes...');
    router.use('/', analysisRoutes); // Analysis routes are mounted directly since they include full paths
    console.log('✅ Analysis routes mounted successfully');
    
    console.log('⚙️ Mounting rules routes...');
    router.use('/rules', rulesRoutes);
    console.log('✅ Rules routes mounted successfully');
    
    console.log('🎮 Mounting demo routes...');
    router.use('/demo', demoRoutes); // Demo routes for rule engine demonstration
    console.log('✅ Demo routes mounted successfully');
    
    console.log('📊 Mounting reports routes...');
    router.use('/reports', createReportsRoutes(db, redis));
    console.log('✅ Reports routes mounted successfully');
    
    console.log('🚀 Mounting performance routes...');
    router.use('/performance', performanceRoutes);
    console.log('✅ Performance routes mounted successfully');

    // console.log('🔗 Mounting integrations routes...');
    // router.use('/integrations', integrationsRoutes);
    // console.log('✅ Integrations routes mounted successfully');

    console.log('⚙️ Mounting workflows routes...');
    router.use('/workflows', workflowsRoutes);
    console.log('✅ Workflows routes mounted successfully');

    // console.log('💾 Mounting cache management routes...');
    // router.use('/cache', cacheManagementRoutes);
    // console.log('✅ Cache management routes mounted successfully');

    // console.log('📊 Mounting monitoring routes...');
    // router.use('/monitoring', monitoringRoutes);
    // console.log('✅ Monitoring routes mounted successfully');

    // Note: Notification routes will be mounted during service initialization
    // This is because they require NotificationService to be fully initialized
    console.log('🔔 Notification routes will be mounted during service initialization');
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
        performance: `${API_CONFIG.BASE_PATH}/performance`,
        cache: `${API_CONFIG.BASE_PATH}/cache`,
        monitoring: `${API_CONFIG.BASE_PATH}/monitoring`,
        notifications: `${API_CONFIG.BASE_PATH}/notifications`,
        integrations: `${API_CONFIG.BASE_PATH}/integrations`,
        workflows: `${API_CONFIG.BASE_PATH}/workflows`,
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