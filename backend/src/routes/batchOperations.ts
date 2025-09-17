import { Router } from 'express';
import { BatchOperationController, 
  createBatchOperationValidation, 
  estimateOperationValidation,
  createWorkflowValidation,
  updateWorkflowValidation,
  fromTemplateValidation
} from '@/controllers/BatchOperationController';
import { authenticateToken } from '@/middleware/auth';
// import { validateRequest } from ../middleware/validation;

const router = Router();

// 应用认证中间件到所有路由
router.use(authenticateToken);

// ================================
// 批量操作相关路由
// ================================

/**
 * 创建批量操作
 * POST /batch-operations
 */
router.post('/', createBatchOperationValidation, // validateRequest, BatchOperationController.createBatchOperation);

/**
 * 获取用户的批量操作列表
 * GET /batch-operations
 * Query params: page, limit, status, operationType
 */
router.get('/', BatchOperationController.getUserBatchOperations);

/**
 * 获取批量操作详情
 * GET /batch-operations/:id
 */
router.get('/:id', BatchOperationController.getBatchOperation);

/**
 * 取消批量操作
 * POST /batch-operations/:id/cancel
 */
router.post('/:id/cancel', BatchOperationController.cancelBatchOperation);

/**
 * 获取批量操作统计信息
 * GET /batch-operations/statistics
 * Query params: startDate, endDate
 */
router.get('/statistics', BatchOperationController.getBatchOperationStats);

/**
 * 获取队列状态
 * GET /batch-operations/queue-status
 */
router.get('/queue-status', BatchOperationController.getQueueStatus);

/**
 * 获取支持的操作类型
 * GET /batch-operations/operation-types
 */
router.get('/operation-types', BatchOperationController.getOperationTypes);

/**
 * 预估批量操作执行时间
 * POST /batch-operations/estimate
 */
router.post('/estimate', estimateOperationValidation, // validateRequest, BatchOperationController.estimateOperation);

// ================================
// 工作流相关路由
// ================================

/**
 * 创建工作流
 * POST /workflows
 */
router.post('/workflows', createWorkflowValidation, // validateRequest, BatchOperationController.createWorkflow);

/**
 * 获取用户工作流列表
 * GET /workflows
 * Query params: page, limit, category, isActive, isTemplate
 */
router.get('/workflows', BatchOperationController.getUserWorkflows);

/**
 * 获取工作流详情
 * GET /workflows/:id
 */
router.get('/workflows/:id', BatchOperationController.getWorkflow);

/**
 * 更新工作流
 * PUT /workflows/:id
 */
router.put('/workflows/:id', updateWorkflowValidation, // validateRequest, BatchOperationController.updateWorkflow);

/**
 * 删除工作流
 * DELETE /workflows/:id
 */
router.delete('/workflows/:id', BatchOperationController.deleteWorkflow);

/**
 * 执行工作流
 * POST /workflows/:id/execute
 */
router.post('/workflows/:id/execute', BatchOperationController.executeWorkflow);

/**
 * 获取工作流执行历史
 * GET /workflows/:id/executions
 * Query params: page, limit, status
 */
router.get('/workflows/:id/executions', BatchOperationController.getWorkflowExecutions);

/**
 * 获取工作流统计信息
 * GET /workflows/statistics
 */
router.get('/workflows/statistics', BatchOperationController.getWorkflowStats);

// ================================
// 工作流模板相关路由
// ================================

/**
 * 获取工作流模板列表
 * GET /workflow-templates
 * Query params: category, difficulty, featured, page, limit
 */
router.get('/workflow-templates', BatchOperationController.getWorkflowTemplates);

/**
 * 从模板创建工作流
 * POST /workflows/from-template
 */
router.post('/workflows/from-template', fromTemplateValidation, // validateRequest, BatchOperationController.createWorkflowFromTemplate);

export default router;