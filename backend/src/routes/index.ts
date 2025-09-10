import { Router } from 'express';
import { Pool } from 'pg';
import RedisManager from '@/config/redis';
import { API_CONFIG } from '@/config';
import { healthCheck } from '@/middleware';
import authRoutes from './auth';
import emailRoutes from './email';
import analysisRoutes from './analysis';
import rulesRoutes from './rules';
import demoRoutes from './demo';
import { createReportsRoutes } from './reports';

// Create a function to setup routes with database connections
export function createRoutes(db: Pool, redis: typeof RedisManager): Router {
  const router = Router();

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

  // Mount route modules
  router.use('/auth', authRoutes);
  router.use('/email', emailRoutes);
  router.use('/rules', rulesRoutes);
  router.use('/demo', demoRoutes); // Demo routes for rule engine demonstration
  router.use('/', analysisRoutes); // Analysis routes are mounted directly since they include full paths
  router.use('/reports', createReportsRoutes(db, redis)); // Reports routes with database connections

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

// Mount basic route modules (without reports)
defaultRouter.use('/auth', authRoutes);
defaultRouter.use('/email', emailRoutes);
defaultRouter.use('/rules', rulesRoutes);
defaultRouter.use('/demo', demoRoutes);
defaultRouter.use('/', analysisRoutes);

export default defaultRouter;