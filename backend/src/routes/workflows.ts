import { Router } from 'express';
import { WorkflowController } from '../controllers/WorkflowController';
import { authenticateToken } from '../middleware/auth';
// import { validateRequest } from ../middleware/validation;
import { body, param, query } from 'express-validator';

/**
 * Workflow routes
 * 工作流路由
 *
 * 处理工作流任务的创建、管理和同步
 * 所有路由都需要认证
 */

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/workflows/tasks
 * Get all workflow tasks with filtering and pagination
 */
router.get('/tasks',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['created', 'in_progress', 'completed', 'failed', 'cancelled'])
      .withMessage('Invalid status'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority'),
    query('integrationId')
      .optional()
      .isUUID()
      .withMessage('Invalid integration ID'),
    query('assignee')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Assignee must be between 1 and 255 characters'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 500 })
      .withMessage('Search term must be between 1 and 500 characters')
  ],
  // validateRequest,
  WorkflowController.getTasks
);

/**
 * GET /api/workflows/tasks/:id
 * Get single task details
 */
router.get('/tasks/:id',
  [
    param('id').isUUID().withMessage('Invalid task ID')
  ],
  // validateRequest,
  WorkflowController.getTask
);

/**
 * POST /api/workflows/create-task
 * Create task from email
 */
router.post('/create-task',
  [
    body('emailId')
      .isUUID()
      .withMessage('Invalid email ID'),
    body('integrationId')
      .isUUID()
      .withMessage('Invalid integration ID'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority'),
    body('assignee')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Assignee must be between 1 and 255 characters'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('description')
      .optional()
      .isLength({ max: 5000 })
      .withMessage('Description must be at most 5000 characters'),
    body('customTitle')
      .optional()
      .isLength({ min: 1, max: 500 })
      .withMessage('Custom title must be between 1 and 500 characters')
  ],
  // validateRequest,
  WorkflowController.createTaskFromEmail
);

/**
 * PUT /api/workflows/tasks/:id/status
 * Update task status
 */
router.put('/tasks/:id/status',
  [
    param('id').isUUID().withMessage('Invalid task ID'),
    body('status')
      .isIn(['created', 'in_progress', 'completed', 'failed', 'cancelled'])
      .withMessage('Invalid status')
  ],
  // validateRequest,
  WorkflowController.updateTaskStatus
);

/**
 * DELETE /api/workflows/tasks/:id
 * Delete workflow task
 */
router.delete('/tasks/:id',
  [
    param('id').isUUID().withMessage('Invalid task ID')
  ],
  // validateRequest,
  WorkflowController.deleteTask
);

/**
 * GET /api/workflows/stats
 * Get workflow statistics
 */
router.get('/stats',
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d'])
      .withMessage('Invalid period, must be 7d, 30d, or 90d')
  ],
  // validateRequest,
  WorkflowController.getWorkflowStats
);

/**
 * POST /api/workflows/sync
 * Sync all pending tasks for user
 */
router.post('/sync',
  WorkflowController.syncAllTasks
);

export default router;