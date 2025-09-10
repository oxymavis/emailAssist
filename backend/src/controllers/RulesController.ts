import { Request, Response, NextFunction } from 'express';
import { validationResult, body, query, param } from 'express-validator';
import { 
  FilterRule, 
  CreateFilterRuleRequest, 
  UpdateFilterRuleRequest,
  RuleTestRequest,
  BatchRuleApplyRequest 
} from '@/types';
import { FilterRuleModel } from '@/models/FilterRule';
import { RuleExecutionLogModel } from '@/models/RuleExecutionLog';
import { RuleEngineService } from '@/services/RuleEngineService';
import { formatResponse, formatSuccessResponse, formatErrorResponse } from '@/utils/response';
import { ValidationError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * 规则管理控制器
 * 处理所有与过滤规则相关的HTTP请求
 */
export class RulesController {
  /**
   * 获取规则列表
   * GET /api/v1/rules
   */
  static async getRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
      const search = req.query.search as string;

      const { rules, total } = await FilterRuleModel.list(userId, {
        page,
        limit,
        active,
        search
      });

      const response = formatResponse(rules, 'Rules retrieved successfully', 200, {
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
   * 获取单个规则详情
   * GET /api/v1/rules/:id
   */
  static async getRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleId = req.params.id;

      const rule = await FilterRuleModel.findById(ruleId, userId);
      
      if (!rule) {
        throw new NotFoundError('Filter rule');
      }

      res.json(formatSuccessResponse(rule));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建新规则
   * POST /api/v1/rules
   */
  static async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const ruleData: CreateFilterRuleRequest = req.body;

      // 验证规则配置
      const validation = RuleEngineService.validateRule(ruleData);
      if (!validation.valid) {
        throw new ValidationError('Invalid rule configuration', validation.errors);
      }

      const rule = await FilterRuleModel.create(ruleData, userId);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.status(201).json(formatSuccessResponse(rule));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新规则
   * PUT /api/v1/rules/:id
   */
  static async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const ruleId = req.params.id;
      const updateData: UpdateFilterRuleRequest = req.body;

      // 验证规则配置（如果提供了完整数据）
      if (updateData.conditions && updateData.actions) {
        const validation = RuleEngineService.validateRule({
          ...updateData,
          name: updateData.name || 'temp'
        } as FilterRule);
        if (!validation.valid) {
          throw new ValidationError('Invalid rule configuration', validation.errors);
        }
      }

      const rule = await FilterRuleModel.update(ruleId, userId, updateData);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.json(formatSuccessResponse(rule));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除规则
   * DELETE /api/v1/rules/:id
   */
  static async deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleId = req.params.id;

      await FilterRuleModel.delete(ruleId, userId);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.json(formatSuccessResponse(null, 'Rule deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 切换规则启用状态
   * POST /api/v1/rules/:id/toggle
   */
  static async toggleRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleId = req.params.id;

      const rule = await FilterRuleModel.toggle(ruleId, userId);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.json(formatSuccessResponse(rule));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 测试规则
   * POST /api/v1/rules/test
   */
  static async testRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const testData: RuleTestRequest = req.body;
      
      // 创建临时规则用于测试
      const tempRule: FilterRule = {
        id: 'test',
        userId: req.user!.id,
        name: 'Test Rule',
        isActive: true,
        priority: 1,
        logicOperator: testData.logicOperator,
        conditions: testData.conditions,
        actions: [], // 测试时不执行动作
        createdBy: req.user!.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 测试每封邮件
      const results = [];
      for (const testEmail of testData.testEmails) {
        // 转换测试邮件格式
        const email = {
          id: testEmail.messageId,
          messageId: testEmail.messageId,
          subject: testEmail.subject,
          sender: { 
            name: testEmail.sender.split('<')[0].trim(),
            address: testEmail.sender.includes('<') ? 
              testEmail.sender.split('<')[1].replace('>', '') : testEmail.sender
          },
          content: { text: testEmail.content, html: testEmail.content },
          receivedAt: testEmail.receivedDate,
          importance: testEmail.importance,
          isRead: testEmail.isRead,
          userId: '',
          accountId: '',
          conversationId: '',
          recipients: { to: [] },
          sentAt: testEmail.receivedDate,
          isDraft: false,
          hasAttachments: false,
          attachments: [],
          folders: [],
          tags: [],
          customProperties: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const matchResult = await RuleEngineService.evaluateRule(tempRule, email);
        
        results.push({
          messageId: testEmail.messageId,
          matched: matchResult.matched,
          matchedConditions: matchResult.matchedConditions.map(c => c.field),
          nonMatchedConditions: matchResult.nonMatchedConditions.map(c => c.field),
          overallMatch: matchResult.matched
        });
      }

      res.json(formatSuccessResponse(results));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量应用规则
   * POST /api/v1/rules/batch-apply
   */
  static async batchApplyRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const { ruleIds, emailMessageIds, dryRun = false }: BatchRuleApplyRequest = req.body;

      // 这里需要从数据库或邮件服务获取实际的邮件数据
      // 目前返回模拟结果
      const result = {
        processedEmails: emailMessageIds.length,
        appliedRules: ruleIds.length,
        totalActions: 0,
        results: emailMessageIds.map(emailId => ({
          emailMessageId: emailId,
          appliedRules: ruleIds.map(ruleId => ({
            ruleId,
            ruleName: `Rule ${ruleId}`,
            matched: Math.random() > 0.5,
            actionsExecuted: Math.floor(Math.random() * 3),
            errors: Math.random() > 0.9 ? ['Sample error'] : undefined
          }))
        })),
        errors: []
      };

      logger.info('Batch rule application completed', {
        userId,
        ruleCount: ruleIds.length,
        emailCount: emailMessageIds.length,
        dryRun
      });

      res.json(formatSuccessResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取规则执行日志
   * GET /api/v1/rules/:id/logs
   */
  static async getRuleLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = req.query.status as 'success' | 'error' | 'skipped';
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const { logs, total } = await RuleExecutionLogModel.getByRuleId(ruleId, userId, {
        page,
        limit,
        status,
        dateFrom,
        dateTo
      });

      const response = formatResponse(logs, 'Rule logs retrieved successfully', 200, {
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
   * 获取规则统计信息
   * GET /api/v1/rules/statistics
   */
  static async getRuleStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleId = req.query.ruleId as string;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const stats = await RuleExecutionLogModel.getStatistics(userId, {
        ruleId,
        dateFrom,
        dateTo
      });

      res.json(formatSuccessResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新规则优先级
   * POST /api/v1/rules/priorities
   */
  static async updateRulePriorities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const { ruleIds } = req.body;

      if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
        throw new ValidationError('ruleIds must be a non-empty array');
      }

      await FilterRuleModel.updatePriorities(userId, ruleIds);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.json(formatSuccessResponse(null, 'Rule priorities updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取规则模板
   * GET /api/v1/rules/templates
   */
  static async getRuleTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query.category as string;
      
      // 这里应该从数据库获取模板，暂时返回示例数据
      const templates = [
        {
          id: '1',
          name: '高优先级邮件标记',
          description: '自动标记来自重要联系人或包含紧急关键词的邮件',
          category: 'productivity',
          templateData: {
            name: '高优先级邮件标记',
            logicOperator: 'OR',
            conditions: [
              { field: 'sender', operator: 'in', value: 'boss@company.com,manager@company.com', valueType: 'string' },
              { field: 'subject', operator: 'contains', value: '紧急', valueType: 'string' },
              { field: 'subject', operator: 'contains', value: 'urgent', valueType: 'string' }
            ],
            actions: [
              { type: 'add_tag', parameters: { tags: ['高优先级', '重要'] } }
            ]
          },
          isSystem: true
        },
        {
          id: '2',
          name: '垃圾邮件自动归档',
          description: '自动将疑似垃圾邮件移动到垃圾箱并标记',
          category: 'security',
          templateData: {
            name: '垃圾邮件自动归档',
            logicOperator: 'OR',
            conditions: [
              { field: 'subject', operator: 'contains', value: '中奖', valueType: 'string' },
              { field: 'subject', operator: 'contains', value: '免费', valueType: 'string' },
              { field: 'content', operator: 'contains', value: '点击链接', valueType: 'string' }
            ],
            actions: [
              { type: 'move_to_folder', parameters: { folderId: 'junkemail' } },
              { type: 'add_tag', parameters: { tags: ['垃圾邮件'] } }
            ]
          },
          isSystem: true
        }
      ];

      const filteredTemplates = category ? 
        templates.filter(t => t.category === category) : 
        templates;

      res.json(formatSuccessResponse(filteredTemplates));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 从模板创建规则
   * POST /api/v1/rules/from-template
   */
  static async createRuleFromTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const { templateId, customizations = {} } = req.body;

      // 这里应该从数据库获取模板数据，暂时使用硬编码
      const templateData = {
        name: '高优先级邮件标记',
        logicOperator: 'OR' as const,
        conditions: [
          { field: 'sender', operator: 'in' as const, value: 'boss@company.com,manager@company.com', valueType: 'string' as const },
          { field: 'subject', operator: 'contains' as const, value: '紧急', valueType: 'string' as const }
        ],
        actions: [
          { type: 'add_tag' as const, parameters: { tags: ['高优先级', '重要'] } }
        ]
      };

      // 应用自定义设置
      const ruleData: CreateFilterRuleRequest = {
        ...templateData,
        ...customizations
      };

      const rule = await FilterRuleModel.create(ruleData, userId);

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.status(201).json(formatSuccessResponse(rule));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 导出规则配置
   * GET /api/v1/rules/export
   */
  static async exportRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ruleIds = req.query.ruleIds as string;

      let rules: FilterRule[];
      
      if (ruleIds) {
        const ids = ruleIds.split(',');
        rules = [];
        for (const id of ids) {
          const rule = await FilterRuleModel.findById(id.trim(), userId);
          if (rule) {
            rules.push(rule);
          }
        }
      } else {
        const result = await FilterRuleModel.list(userId, { page: 1, limit: 1000 });
        rules = result.rules;
      }

      // 移除敏感信息
      const exportData = rules.map(rule => ({
        name: rule.name,
        description: rule.description,
        isActive: rule.isActive,
        priority: rule.priority,
        logicOperator: rule.logicOperator,
        conditions: rule.conditions,
        actions: rule.actions
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="email-rules-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        version: '1.0',
        rules: exportData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 导入规则配置
   * POST /api/v1/rules/import
   */
  static async importRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { rules, replaceExisting = false } = req.body;

      if (!Array.isArray(rules)) {
        throw new ValidationError('Rules must be an array');
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[]
      };

      // 如果选择替换现有规则，先删除所有规则
      if (replaceExisting) {
        const existingRules = await FilterRuleModel.list(userId, { page: 1, limit: 1000 });
        for (const rule of existingRules.rules) {
          await FilterRuleModel.delete(rule.id, userId);
        }
      }

      // 导入新规则
      for (let i = 0; i < rules.length; i++) {
        try {
          const ruleData: CreateFilterRuleRequest = rules[i];
          
          // 验证规则配置
          const validation = RuleEngineService.validateRule(ruleData);
          if (!validation.valid) {
            results.errors.push(`Rule ${i + 1}: ${validation.errors.join(', ')}`);
            results.skipped++;
            continue;
          }

          await FilterRuleModel.create(ruleData, userId);
          results.imported++;
        } catch (error) {
          results.errors.push(`Rule ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.skipped++;
        }
      }

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      res.json(formatSuccessResponse(results));
    } catch (error) {
      next(error);
    }
  }
}

// 验证器中间件
export const createRuleValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('priority')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Priority must be a positive integer'),
  body('logicOperator')
    .optional()
    .isIn(['AND', 'OR'])
    .withMessage('Logic operator must be AND or OR'),
  body('conditions')
    .isArray({ min: 1 })
    .withMessage('At least one condition is required'),
  body('conditions.*.field')
    .notEmpty()
    .withMessage('Condition field is required'),
  body('conditions.*.operator')
    .notEmpty()
    .withMessage('Condition operator is required'),
  body('conditions.*.value')
    .notEmpty()
    .withMessage('Condition value is required'),
  body('actions')
    .isArray({ min: 1 })
    .withMessage('At least one action is required'),
  body('actions.*.type')
    .notEmpty()
    .withMessage('Action type is required')
];

export const updateRuleValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('priority')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Priority must be a positive integer'),
  body('logicOperator')
    .optional()
    .isIn(['AND', 'OR'])
    .withMessage('Logic operator must be AND or OR')
];

export const testRuleValidation = [
  body('conditions')
    .isArray({ min: 1 })
    .withMessage('At least one condition is required'),
  body('logicOperator')
    .isIn(['AND', 'OR'])
    .withMessage('Logic operator must be AND or OR'),
  body('testEmails')
    .isArray({ min: 1 })
    .withMessage('At least one test email is required')
];

export const batchApplyValidation = [
  body('ruleIds')
    .isArray({ min: 1 })
    .withMessage('At least one rule ID is required'),
  body('emailMessageIds')
    .isArray({ min: 1 })
    .withMessage('At least one email message ID is required'),
  body('dryRun')
    .optional()
    .isBoolean()
    .withMessage('dryRun must be a boolean')
];

export const updatePrioritiesValidation = [
  body('ruleIds')
    .isArray({ min: 1 })
    .withMessage('ruleIds must be a non-empty array')
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

export const importRulesValidation = [
  body('rules')
    .isArray()
    .withMessage('Rules must be an array'),
  body('replaceExisting')
    .optional()
    .isBoolean()
    .withMessage('replaceExisting must be a boolean')
];