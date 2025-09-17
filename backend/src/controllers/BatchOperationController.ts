import { Request, Response, NextFunction } from 'express';
import { validationResult, body, query, param } from 'express-validator';
import { 
  EmailBatchOperationService,
  BatchOperationType,
  BatchOperationStatus,
  BatchOperationConfig
} from '@/services/EmailBatchOperationService';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { formatResponse, formatSuccessResponse, formatErrorResponse } from '@/utils/response';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { AuthRequest } from '@/types';
import logger from '@/utils/logger';

/**
 * 批量操作控制器
 * 处理邮件和规则的批量操作API请求
 */
export class BatchOperationController {
  private static batchOperationService: EmailBatchOperationService;
  private static workflowEngine: WorkflowEngine;

  static initialize(
    batchOperationService: EmailBatchOperationService,
    workflowEngine: WorkflowEngine
  ) {
    this.batchOperationService = batchOperationService;
    this.workflowEngine = workflowEngine;
  }

  /**
   * 创建批量操作
   * POST /api/v1/batch-operations
   */
  static async createBatchOperation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const {
        name,
        description,
        operationType,
        targetItems,
        parameters,
        options,
        priority,
        scheduledAt
      } = req.body;

      const operationConfig: BatchOperationConfig = {
        operationType,
        parameters,
        options
      };

      const batchOperation = await this.batchOperationService.createBatchOperation(
        userId,
        name,
        operationType,
        targetItems,
        operationConfig,
        {
          description,
          priority,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
        }
      );

      res.status(201).json(formatSuccessResponse(batchOperation));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取批量操作详情
   * GET /api/v1/batch-operations/:id
   */
  static async getBatchOperation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const batchId = req.params.id;

      const batchOperation = await this.batchOperationService.getBatchOperation(batchId, userId);
      
      if (!batchOperation) {
        throw new NotFoundError('Batch operation');
      }

      res.json(formatSuccessResponse(batchOperation));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取用户的批量操作列表
   * GET /api/v1/batch-operations
   */
  static async getUserBatchOperations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = req.query.status as BatchOperationStatus;
      const operationType = req.query.operationType as BatchOperationType;

      const { operations, total } = await this.batchOperationService.getUserBatchOperations(userId, {
        status,
        operationType,
        page,
        limit
      });

      const response = formatResponse(operations, 'Batch operations retrieved successfully', 200, {
        page,
        limit,
        total,
        hasNext: page * limit < total
      });

      res.json(response);

    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消批量操作
   * POST /api/v1/batch-operations/:id/cancel
   */
  static async cancelBatchOperation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const batchId = req.params.id;

      await this.batchOperationService.cancelBatchOperation(batchId, userId);

      res.json(formatSuccessResponse(null, 'Batch operation cancelled successfully'));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取批量操作统计信息
   * GET /api/v1/batch-operations/statistics
   */
  static async getBatchOperationStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const timeRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
      const stats = await this.batchOperationService.getBatchOperationStats(userId, timeRange);

      res.json(formatSuccessResponse(stats));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取队列状态
   * GET /api/v1/batch-operations/queue-status
   */
  static async getQueueStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const queueStatus = await this.batchOperationService.getQueueStatus();
      res.json(formatSuccessResponse(queueStatus));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取支持的操作类型
   * GET /api/v1/batch-operations/operation-types
   */
  static async getOperationTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const operationTypes = [
        {
          type: 'email_bulk_mark',
          name: '批量标记邮件',
          description: '批量标记邮件为已读或未读状态',
          parameters: [
            { name: 'isRead', type: 'boolean', required: true, description: '是否标记为已读' }
          ]
        },
        {
          type: 'email_bulk_move',
          name: '批量移动邮件',
          description: '批量移动邮件到指定文件夹',
          parameters: [
            { name: 'folderId', type: 'string', required: true, description: '目标文件夹ID' }
          ]
        },
        {
          type: 'email_bulk_delete',
          name: '批量删除邮件',
          description: '批量删除邮件（可选择软删除或永久删除）',
          parameters: [
            { name: 'permanent', type: 'boolean', required: false, description: '是否永久删除，默认false' }
          ]
        },
        {
          type: 'email_bulk_tag',
          name: '批量添加标签',
          description: '批量为邮件添加标签',
          parameters: [
            { name: 'tags', type: 'string[]', required: true, description: '要添加的标签列表' }
          ]
        },
        {
          type: 'rule_apply',
          name: '批量应用规则',
          description: '对选中的邮件批量应用过滤规则',
          parameters: [
            { name: 'ruleIds', type: 'string[]', required: false, description: '要应用的规则ID列表，空则应用所有激活规则' }
          ]
        },
        {
          type: 'rule_batch_enable',
          name: '批量启用规则',
          description: '批量启用过滤规则',
          parameters: []
        },
        {
          type: 'rule_batch_disable',
          name: '批量禁用规则',
          description: '批量禁用过滤规则',
          parameters: []
        }
      ];

      res.json(formatSuccessResponse(operationTypes));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 预估批量操作执行时间
   * POST /api/v1/batch-operations/estimate
   */
  static async estimateOperation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const { operationType, targetItems } = req.body;
      
      // 根据操作类型和项目数量估算执行时间
      const timePerItem = this.getEstimatedTimePerItem(operationType);
      const estimatedSeconds = targetItems.length * timePerItem;
      const estimatedCompletion = new Date(Date.now() + estimatedSeconds * 1000);

      const estimate = {
        operationType,
        totalItems: targetItems.length,
        estimatedDurationSeconds: Math.ceil(estimatedSeconds),
        estimatedCompletion: estimatedCompletion.toISOString(),
        recommendedBatchSize: this.getRecommendedBatchSize(operationType, targetItems.length),
        estimatedBatches: Math.ceil(targetItems.length / this.getRecommendedBatchSize(operationType, targetItems.length))
      };

      res.json(formatSuccessResponse(estimate));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建工作流
   * POST /api/v1/workflows
   */
  static async createWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const workflowData = req.body;

      const workflow = await this.workflowEngine.createWorkflow(userId, workflowData);

      res.status(201).json(formatSuccessResponse(workflow));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工作流列表
   * GET /api/v1/workflows
   */
  static async getUserWorkflows(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const category = req.query.category as string;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const isTemplate = req.query.isTemplate === 'true' ? true : req.query.isTemplate === 'false' ? false : undefined;

      const { workflows, total } = await this.workflowEngine.getUserWorkflows(userId, {
        category,
        isActive,
        isTemplate,
        page,
        limit
      });

      const response = formatResponse(workflows, 'Workflows retrieved successfully', 200, {
        page,
        limit,
        total,
        hasNext: page * limit < total
      });

      res.json(response);

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工作流详情
   * GET /api/v1/workflows/:id
   */
  static async getWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflowId = req.params.id;
      const workflow = await this.workflowEngine.getWorkflow(workflowId);
      
      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      // 验证用户权限
      if (workflow.userId !== req.user!.id) {
        throw new Error('Access denied');
      }

      res.json(formatSuccessResponse(workflow));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新工作流
   * PUT /api/v1/workflows/:id
   */
  static async updateWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const workflowId = req.params.id;
      const updates = req.body;

      const workflow = await this.workflowEngine.updateWorkflow(workflowId, userId, updates);

      res.json(formatSuccessResponse(workflow));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除工作流
   * DELETE /api/v1/workflows/:id
   */
  static async deleteWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workflowId = req.params.id;

      await this.workflowEngine.deleteWorkflow(workflowId, userId);

      res.json(formatSuccessResponse(null, 'Workflow deleted successfully'));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 执行工作流
   * POST /api/v1/workflows/:id/execute
   */
  static async executeWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflowId = req.params.id;
      const { triggerData = {}, priority, delay } = req.body;

      const execution = await this.workflowEngine.executeWorkflow(workflowId, triggerData, {
        priority,
        delay,
        triggerType: 'manual'
      });

      res.json(formatSuccessResponse(execution));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工作流执行历史
   * GET /api/v1/workflows/:id/executions
   */
  static async getWorkflowExecutions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workflowId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = req.query.status as any;

      const { executions, total } = await this.workflowEngine.getWorkflowExecutions(workflowId, userId, {
        status,
        page,
        limit
      });

      const response = formatResponse(executions, 'Workflow executions retrieved successfully', 200, {
        page,
        limit,
        total,
        hasNext: page * limit < total
      });

      res.json(response);

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工作流统计信息
   * GET /api/v1/workflows/statistics
   */
  static async getWorkflowStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const stats = await this.workflowEngine.getWorkflowStats(userId);

      res.json(formatSuccessResponse(stats));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工作流模板
   * GET /api/v1/workflow-templates
   */
  static async getWorkflowTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query.category as string;
      const difficulty = req.query.difficulty as string;
      const featured = req.query.featured === 'true';

      // 这里应该从数据库获取模板，暂时返回示例数据
      const templates = [
        {
          id: '1',
          name: '高优先级邮件自动处理',
          description: '自动识别和处理来自重要联系人或包含紧急关键词的邮件',
          category: 'email_automation',
          difficulty: 'beginner',
          isFeatured: true,
          templateDefinition: {
            nodes: [
              {
                id: 'start',
                type: 'start',
                name: '开始',
                config: {},
                position: { x: 100, y: 100 }
              },
              {
                id: 'filter',
                type: 'email_filter',
                name: '邮件过滤',
                config: {
                  conditions: [
                    { field: 'sender', operator: 'in', value: '${important_senders}' },
                    { field: 'subject', operator: 'contains', value: '${urgent_keywords}' }
                  ],
                  logicOperator: 'OR'
                },
                position: { x: 300, y: 100 }
              },
              {
                id: 'tag',
                type: 'batch_operation',
                name: '添加标签',
                config: {
                  operationType: 'email_bulk_tag',
                  parameters: { tags: ['重要', '高优先级'] }
                },
                position: { x: 500, y: 100 }
              },
              {
                id: 'end',
                type: 'end',
                name: '结束',
                config: {},
                position: { x: 700, y: 100 }
              }
            ],
            connections: [
              { id: 'c1', from: 'start', to: 'filter' },
              { id: 'c2', from: 'filter', to: 'tag', condition: 'success' },
              { id: 'c3', from: 'tag', to: 'end' }
            ],
            variables: {}
          },
          variables: [
            {
              name: 'important_senders',
              type: 'string',
              description: '重要发件人邮箱地址（逗号分隔）',
              required: true,
              defaultValue: 'boss@company.com,manager@company.com'
            },
            {
              name: 'urgent_keywords',
              type: 'string',
              description: '紧急关键词（逗号分隔）',
              required: true,
              defaultValue: '紧急,urgent,ASAP'
            }
          ],
          tags: ['email', 'automation', 'priority'],
          usageCount: 156,
          rating: 4.8
        },
        {
          id: '2',
          name: '垃圾邮件批量清理',
          description: '自动识别垃圾邮件并批量移动到垃圾箱',
          category: 'email_automation',
          difficulty: 'beginner',
          isFeatured: true,
          templateDefinition: {
            nodes: [
              {
                id: 'start',
                type: 'start',
                name: '开始',
                config: {},
                position: { x: 100, y: 100 }
              },
              {
                id: 'spam_filter',
                type: 'email_filter',
                name: '垃圾邮件筛选',
                config: {
                  conditions: [
                    { field: 'subject', operator: 'contains', value: '${spam_keywords}' },
                    { field: 'sender', operator: 'not_in', value: '${whitelist_domains}' }
                  ],
                  logicOperator: 'OR'
                },
                position: { x: 300, y: 100 }
              },
              {
                id: 'move_spam',
                type: 'batch_operation',
                name: '移动到垃圾箱',
                config: {
                  operationType: 'email_bulk_move',
                  parameters: { folderId: 'spam' }
                },
                position: { x: 500, y: 100 }
              },
              {
                id: 'end',
                type: 'end',
                name: '结束',
                config: {},
                position: { x: 700, y: 100 }
              }
            ],
            connections: [
              { id: 'c1', from: 'start', to: 'spam_filter' },
              { id: 'c2', from: 'spam_filter', to: 'move_spam', condition: 'success' },
              { id: 'c3', from: 'move_spam', to: 'end' }
            ],
            variables: {}
          },
          variables: [
            {
              name: 'spam_keywords',
              type: 'string',
              description: '垃圾邮件关键词',
              required: true,
              defaultValue: '中奖,免费,促销'
            },
            {
              name: 'whitelist_domains',
              type: 'string',
              description: '白名单域名',
              required: false,
              defaultValue: 'company.com,trusted-partner.com'
            }
          ],
          tags: ['spam', 'cleanup', 'automation'],
          usageCount: 89,
          rating: 4.5
        }
      ];

      let filteredTemplates = templates;

      if (category) {
        filteredTemplates = filteredTemplates.filter(t => t.category === category);
      }

      if (difficulty) {
        filteredTemplates = filteredTemplates.filter(t => t.difficulty === difficulty);
      }

      if (featured) {
        filteredTemplates = filteredTemplates.filter(t => t.isFeatured);
      }

      res.json(formatSuccessResponse(filteredTemplates));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 从模板创建工作流
   * POST /api/v1/workflows/from-template
   */
  static async createWorkflowFromTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const { templateId, customizations = {} } = req.body;

      // 这里应该从数据库获取模板数据，暂时使用硬编码
      const templateData = {
        name: customizations.name || '基于模板的工作流',
        description: customizations.description || '从模板创建的工作流',
        category: customizations.category || 'email_automation',
        triggerConfig: {
          type: 'manual' as const,
          config: {}
        },
        workflowDefinition: {
          nodes: [
            {
              id: 'start',
              type: 'start' as const,
              name: '开始',
              config: {},
              position: { x: 100, y: 100 }
            },
            {
              id: 'end',
              type: 'end' as const,
              name: '结束',
              config: {},
              position: { x: 300, y: 100 }
            }
          ],
          connections: [
            { id: 'c1', from: 'start', to: 'end' }
          ],
          variables: customizations.variables || {}
        }
      };

      const workflow = await this.workflowEngine.createWorkflow(userId, templateData);

      res.status(201).json(formatSuccessResponse(workflow));

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取每个项目的预估处理时间（秒）
   */
  private static getEstimatedTimePerItem(operationType: BatchOperationType): number {
    switch (operationType) {
      case 'email_bulk_mark':
        return 0.1;
      case 'email_bulk_move':
        return 0.5;
      case 'email_bulk_delete':
        return 0.3;
      case 'email_bulk_tag':
        return 0.2;
      case 'rule_apply':
        return 2.0;
      case 'rule_batch_enable':
      case 'rule_batch_disable':
        return 0.1;
      default:
        return 1.0;
    }
  }

  /**
   * 获取推荐的批处理大小
   */
  private static getRecommendedBatchSize(operationType: BatchOperationType, totalItems: number): number {
    const baseBatchSize = {
      'email_bulk_mark': 100,
      'email_bulk_move': 50,
      'email_bulk_delete': 30,
      'email_bulk_tag': 80,
      'rule_apply': 20,
      'rule_batch_enable': 50,
      'rule_batch_disable': 50,
      'custom': 25
    }[operationType] || 25;

    // 根据总项目数调整批处理大小
    if (totalItems < 100) {
      return Math.min(baseBatchSize, totalItems);
    } else if (totalItems > 1000) {
      return Math.min(baseBatchSize * 2, 200);
    }

    return baseBatchSize;
  }
}

// 验证器中间件
export const createBatchOperationValidation = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Operation name must be between 1 and 255 characters'),
  body('operationType')
    .isIn(['email_bulk_mark', 'email_bulk_move', 'email_bulk_delete', 'email_bulk_tag', 'rule_apply', 'rule_batch_enable', 'rule_batch_disable', 'custom'])
    .withMessage('Invalid operation type'),
  body('targetItems')
    .isArray({ min: 1 })
    .withMessage('At least one target item is required'),
  body('parameters')
    .isObject()
    .withMessage('Parameters must be an object'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Priority must be between 1 and 10'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO8601 date')
];

export const estimateOperationValidation = [
  body('operationType')
    .isIn(['email_bulk_mark', 'email_bulk_move', 'email_bulk_delete', 'email_bulk_tag', 'rule_apply', 'rule_batch_enable', 'rule_batch_disable'])
    .withMessage('Invalid operation type'),
  body('targetItems')
    .isArray({ min: 1 })
    .withMessage('At least one target item is required')
];

export const createWorkflowValidation = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Workflow name must be between 1 and 255 characters'),
  body('category')
    .isLength({ min: 1, max: 100 })
    .withMessage('Category is required'),
  body('triggerConfig')
    .isObject()
    .withMessage('Trigger config is required'),
  body('workflowDefinition')
    .isObject()
    .withMessage('Workflow definition is required'),
  body('workflowDefinition.nodes')
    .isArray({ min: 2 })
    .withMessage('Workflow must have at least 2 nodes'),
  body('workflowDefinition.connections')
    .isArray()
    .withMessage('Connections must be an array')
];

export const updateWorkflowValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Workflow name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Priority must be between 1 and 10')
];

export const fromTemplateValidation = [
  body('templateId')
    .notEmpty()
    .withMessage('Template ID is required'),
  body('customizations')
    .optional()
    .isObject()
    .withMessage('Customizations must be an object')
];