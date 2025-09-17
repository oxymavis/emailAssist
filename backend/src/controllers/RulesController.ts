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

  /**
   * 获取规则性能分析
   * GET /api/v1/rules/performance-analysis
   */
  static async getRulePerformanceAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const timeframe = req.query.timeframe as string || '7d';
      const includeInactive = req.query.includeInactive === 'true';

      // 验证时间范围
      const validTimeframes = ['1d', '7d', '30d', '90d'];
      if (!validTimeframes.includes(timeframe)) {
        throw new ValidationError(`Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`);
      }

      // 计算时间范围
      const now = new Date();
      const timeRanges: { [key: string]: Date } = {
        '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      };

      const fromDate = timeRanges[timeframe];

      // 获取用户所有规则
      const { rules } = await FilterRuleModel.list(userId, { 
        page: 1, 
        limit: 1000,
        active: includeInactive ? undefined : true
      });

      // 获取每个规则的性能指标
      const performanceData = await Promise.all(
        rules.map(async (rule) => {
          const stats = await RuleExecutionLogModel.getStatistics(userId, {
            ruleId: rule.id,
            dateFrom: fromDate,
            dateTo: now
          });

          return {
            ruleId: rule.id,
            ruleName: rule.name,
            isActive: rule.isActive,
            priority: rule.priority,
            performance: {
              totalExecutions: stats.totalExecutions,
              successfulExecutions: stats.successfulExecutions,
              failedExecutions: stats.failedExecutions,
              skippedExecutions: stats.skippedExecutions,
              averageExecutionTime: stats.averageExecutionTime,
              successRate: stats.totalExecutions > 0 ?
                (stats.successfulExecutions / stats.totalExecutions) * 100 : 0
            },
            trends: {
              executionsByDate: stats.executionsByDate || []
            },
            executionsByRule: stats.executionsByRule || []
          };
        })
      );

      // 计算总体性能指标
      const overallStats = {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.isActive).length,
        inactiveRules: rules.filter(r => !r.isActive).length,
        totalExecutions: performanceData.reduce((sum, p) => sum + p.performance.totalExecutions, 0),
        averageSuccessRate: performanceData.length > 0 ? 
          performanceData.reduce((sum, p) => sum + p.performance.successRate, 0) / performanceData.length : 0,
        mostActiveRule: performanceData.reduce((max, current) => 
          current.performance.totalExecutions > max.performance.totalExecutions ? current : max,
          performanceData[0] || null
        ),
        slowestRule: performanceData.reduce((max, current) => 
          current.performance.averageExecutionTime > max.performance.averageExecutionTime ? current : max,
          performanceData[0] || null
        )
      };

      const analysisResult = {
        timeframe,
        period: {
          from: fromDate.toISOString(),
          to: now.toISOString()
        },
        overallStats,
        rulePerformance: performanceData.sort((a, b) => 
          b.performance.totalExecutions - a.performance.totalExecutions
        ),
        recommendations: RulesController.generatePerformanceRecommendations(performanceData)
      };

      res.json(formatSuccessResponse(analysisResult));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量规则操作
   * POST /api/v1/rules/batch-operations
   */
  static async batchRuleOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const userId = req.user!.id;
      const { operation, ruleIds, parameters = {} } = req.body;

      if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
        throw new ValidationError('ruleIds must be a non-empty array');
      }

      const validOperations = ['enable', 'disable', 'delete', 'updatePriority', 'duplicateRule', 'moveToCategory'];
      if (!validOperations.includes(operation)) {
        throw new ValidationError(`Invalid operation. Must be one of: ${validOperations.join(', ')}`);
      }

      const results = {
        operation,
        totalRequested: ruleIds.length,
        successful: 0,
        failed: 0,
        results: [] as Array<{
          ruleId: string;
          success: boolean;
          error?: string;
          newRuleId?: string;
        }>
      };

      // 执行批量操作
      for (const ruleId of ruleIds) {
        try {
          let success = true;
          let newRuleId: string | undefined;

          switch (operation) {
            case 'enable':
              await FilterRuleModel.update(ruleId, userId, { isActive: true });
              break;

            case 'disable':
              await FilterRuleModel.update(ruleId, userId, { isActive: false });
              break;

            case 'delete':
              await FilterRuleModel.delete(ruleId, userId);
              break;

            case 'updatePriority':
              if (!parameters.priority || typeof parameters.priority !== 'number') {
                throw new Error('Priority parameter is required for updatePriority operation');
              }
              // 获取当前用户的所有规则，重新排序
              const allRules = await FilterRuleModel.list(userId, { limit: 1000 });
              const ruleIds = allRules.rules
                .sort((a, b) => a.priority - b.priority)
                .map(r => r.id);

              // 找到目标规则并更新优先级
              const targetIndex = ruleIds.indexOf(ruleId);
              if (targetIndex !== -1) {
                ruleIds.splice(targetIndex, 1);
                ruleIds.splice(parameters.priority - 1, 0, ruleId);
                await FilterRuleModel.updatePriorities(userId, ruleIds);
              }
              break;

            case 'duplicateRule':
              const originalRule = await FilterRuleModel.findById(ruleId, userId);
              if (!originalRule) {
                throw new Error('Rule not found');
              }
              
              const duplicateData: CreateFilterRuleRequest = {
                name: `${originalRule.name} (Copy)`,
                description: originalRule.description,
                isActive: false, // 复制的规则默认为非活动状态
                logicOperator: originalRule.logicOperator,
                conditions: originalRule.conditions,
                actions: originalRule.actions
              };
              
              const newRule = await FilterRuleModel.create(duplicateData, userId);
              newRuleId = newRule.id;
              break;

            case 'moveToCategory':
              if (!parameters.category || typeof parameters.category !== 'string') {
                throw new Error('Category parameter is required for moveToCategory operation');
              }
              // 注意：目前不支持分类功能，此操作将被跳过
              console.warn('moveToCategory operation is not yet implemented');
              break;

            default:
              throw new Error(`Unsupported operation: ${operation}`);
          }

          results.results.push({
            ruleId,
            success: true,
            newRuleId
          });
          results.successful++;

        } catch (error) {
          results.results.push({
            ruleId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          results.failed++;
        }
      }

      // 清除用户规则缓存
      await RuleEngineService.clearUserRuleCache(userId);

      logger.info('Batch rule operation completed', {
        userId,
        operation,
        totalRequested: results.totalRequested,
        successful: results.successful,
        failed: results.failed
      });

      res.json(formatSuccessResponse(results));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 规则健康检查
   * GET /api/v1/rules/health-check
   */
  static async getRuleHealthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // 获取所有规则
      const { rules } = await FilterRuleModel.list(userId, { page: 1, limit: 1000 });

      // 检查规则健康状态
      const healthChecks = await Promise.all(
        rules.map(async (rule) => {
          const issues = [];
          const warnings = [];

          // 检查规则是否长时间未执行
          const recentLogs = await RuleExecutionLogModel.getByRuleId(rule.id, userId, { limit: 1 });
          const lastExecution = recentLogs.logs.length > 0 ? recentLogs.logs[0].executionTime : null;
          if (!lastExecution && rule.isActive) {
            warnings.push('Rule has never been executed');
          } else if (lastExecution && rule.isActive) {
            const daysSinceLastExecution = Math.floor(
              (Date.now() - new Date(lastExecution).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastExecution > 30) {
              warnings.push(`Rule hasn't been executed for ${daysSinceLastExecution} days`);
            }
          }

          // 检查规则条件的有效性
          const conditionValidation = await RulesController.validateRuleConditions(rule);
          if (!conditionValidation.isValid) {
            issues.push(...conditionValidation.errors);
          }

          // 检查规则冲突
          const conflicts = await RulesController.detectRuleConflicts(rule, rules);
          if (conflicts.length > 0) {
            warnings.push(`Potential conflicts with rules: ${conflicts.map(c => c.name).join(', ')}`);
          }

          // 检查性能问题
          const performanceIssues = await RulesController.checkRulePerformance(rule, userId);
          if (performanceIssues.length > 0) {
            warnings.push(...performanceIssues);
          }

          // 计算健康分数 (0-100)
          let healthScore = 100;
          healthScore -= issues.length * 20;
          healthScore -= warnings.length * 10;
          healthScore = Math.max(0, healthScore);

          // 确定健康状态
          let healthStatus: 'healthy' | 'warning' | 'critical';
          if (issues.length > 0) {
            healthStatus = 'critical';
          } else if (warnings.length > 0) {
            healthStatus = 'warning';
          } else {
            healthStatus = 'healthy';
          }

          return {
            ruleId: rule.id,
            ruleName: rule.name,
            isActive: rule.isActive,
            healthStatus,
            healthScore,
            issues,
            warnings,
            lastChecked: new Date().toISOString(),
            recommendations: RulesController.generateRuleRecommendations(rule, issues, warnings)
          };
        })
      );

      // 计算总体健康指标
      const overallHealth = {
        totalRules: rules.length,
        healthyRules: healthChecks.filter(h => h.healthStatus === 'healthy').length,
        warningRules: healthChecks.filter(h => h.healthStatus === 'warning').length,
        criticalRules: healthChecks.filter(h => h.healthStatus === 'critical').length,
        averageHealthScore: healthChecks.length > 0 ? 
          healthChecks.reduce((sum, h) => sum + h.healthScore, 0) / healthChecks.length : 0,
        totalIssues: healthChecks.reduce((sum, h) => sum + h.issues.length, 0),
        totalWarnings: healthChecks.reduce((sum, h) => sum + h.warnings.length, 0)
      };

      const healthReport = {
        timestamp: new Date().toISOString(),
        overallHealth,
        ruleHealthChecks: healthChecks.sort((a, b) => a.healthScore - b.healthScore),
        systemRecommendations: RulesController.generateSystemRecommendations(overallHealth, healthChecks)
      };

      res.json(formatSuccessResponse(healthReport));
    } catch (error) {
      next(error);
    }
  }

  // 辅助方法
  private static generatePerformanceRecommendations(performanceData: any[]): string[] {
    const recommendations = [];

    // 检查是否有执行次数过低的规则
    const inactiveRules = performanceData.filter(p => p.performance.totalExecutions === 0 && p.isActive);
    if (inactiveRules.length > 0) {
      recommendations.push(`Consider reviewing ${inactiveRules.length} active rules that haven't been executed`);
    }

    // 检查是否有执行时间过长的规则
    const slowRules = performanceData.filter(p => p.performance.averageExecutionTime > 1000);
    if (slowRules.length > 0) {
      recommendations.push(`Optimize ${slowRules.length} rules with slow execution times (>1s)`);
    }

    // 检查是否有成功率低的规则
    const unreliableRules = performanceData.filter(p => p.performance.successRate < 90 && p.performance.totalExecutions > 10);
    if (unreliableRules.length > 0) {
      recommendations.push(`Review ${unreliableRules.length} rules with low success rates (<90%)`);
    }

    return recommendations;
  }

  private static async validateRuleConditions(rule: FilterRule): Promise<{ isValid: boolean; errors: string[] }> {
    const errors = [];

    // 验证条件字段
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        errors.push(`Invalid condition: missing field, operator, or value`);
      }

      // 检查字段是否有效
      const validFields = ['sender', 'subject', 'content', 'attachments', 'importance', 'isRead'];
      if (!validFields.includes(condition.field)) {
        errors.push(`Invalid condition field: ${condition.field}`);
      }

      // 检查操作符是否有效
      const validOperators = ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'greaterThan', 'lessThan'];
      if (!validOperators.includes(condition.operator)) {
        errors.push(`Invalid condition operator: ${condition.operator}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static async detectRuleConflicts(rule: FilterRule, allRules: FilterRule[]): Promise<FilterRule[]> {
    const conflicts = [];

    for (const otherRule of allRules) {
      if (otherRule.id === rule.id || !otherRule.isActive) continue;

      // 简单的冲突检测：如果两个规则的条件相似但动作不同
      const hasSimilarConditions = RulesController.compareSimilarConditions(rule.conditions, otherRule.conditions);
      const hasConflictingActions = RulesController.hasConflictingActions(rule.actions, otherRule.actions);

      if (hasSimilarConditions && hasConflictingActions) {
        conflicts.push(otherRule);
      }
    }

    return conflicts;
  }

  private static compareSimilarConditions(conditions1: any[], conditions2: any[]): boolean {
    // 简单的相似性检测
    const fields1 = conditions1.map(c => c.field);
    const fields2 = conditions2.map(c => c.field);
    
    const commonFields = fields1.filter(f => fields2.includes(f));
    return commonFields.length > 0;
  }

  private static hasConflictingActions(actions1: any[], actions2: any[]): boolean {
    // 检查是否有冲突的动作
    const moveActions1 = actions1.filter(a => a.type === 'move_to_folder');
    const moveActions2 = actions2.filter(a => a.type === 'move_to_folder');

    if (moveActions1.length > 0 && moveActions2.length > 0) {
      return moveActions1[0].parameters.folderId !== moveActions2[0].parameters.folderId;
    }

    return false;
  }

  private static async checkRulePerformance(rule: FilterRule, userId: string): Promise<string[]> {
    const issues = [];

    // 获取最近的性能数据
    const stats = await RuleExecutionLogModel.getStatistics(userId, {
      ruleId: rule.id,
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
      dateTo: new Date()
    });

    if (stats.averageExecutionTime > 2000) {
      issues.push(`Slow execution time: ${stats.averageExecutionTime}ms average`);
    }

    if (stats.totalExecutions > 10 && stats.successfulExecutions / stats.totalExecutions < 0.8) {
      issues.push(`Low success rate: ${((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1)}%`);
    }

    return issues;
  }

  private static generateRuleRecommendations(rule: FilterRule, issues: string[], warnings: string[]): string[] {
    const recommendations = [];

    if (issues.length > 0) {
      recommendations.push('Address critical issues immediately');
    }

    if (warnings.length > 0) {
      recommendations.push('Review and resolve warnings to improve rule reliability');
    }

    if (!rule.isActive && warnings.length === 0 && issues.length === 0) {
      recommendations.push('Consider activating this rule as it appears to be healthy');
    }

    return recommendations;
  }

  private static generateSystemRecommendations(overallHealth: any, healthChecks: any[]): string[] {
    const recommendations = [];

    if (overallHealth.criticalRules > 0) {
      recommendations.push(`Address ${overallHealth.criticalRules} critical rule issues immediately`);
    }

    if (overallHealth.averageHealthScore < 70) {
      recommendations.push('Overall rule health is below optimal. Consider reviewing and optimizing rules');
    }

    if (overallHealth.totalRules > 50) {
      recommendations.push('Large number of rules detected. Consider consolidating similar rules');
    }

    return recommendations;
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

export const performanceAnalysisValidation = [
  query('timeframe')
    .optional()
    .isIn(['1d', '7d', '30d', '90d'])
    .withMessage('Invalid timeframe. Must be one of: 1d, 7d, 30d, 90d'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean')
];

export const batchOperationsValidation = [
  body('operation')
    .isIn(['enable', 'disable', 'delete', 'updatePriority', 'duplicateRule', 'moveToCategory'])
    .withMessage('Invalid operation. Must be one of: enable, disable, delete, updatePriority, duplicateRule, moveToCategory'),
  body('ruleIds')
    .isArray({ min: 1 })
    .withMessage('ruleIds must be a non-empty array'),
  body('ruleIds.*')
    .isUUID()
    .withMessage('Each rule ID must be a valid UUID'),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('parameters must be an object')
];