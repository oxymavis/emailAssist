import { Request, Response, NextFunction } from 'express';
import { RuleDemoService } from '@/services/RuleDemoService';
import { RuleCacheService } from '@/services/RuleCacheService';
import { formatSuccessResponse } from '@/utils/response';
import logger from '@/utils/logger';

/**
 * 规则引擎演示控制器
 * 提供规则引擎功能的演示和测试端点
 * 不依赖数据库，使用内存数据进行演示
 */
export class RuleDemoController {
  /**
   * 初始化演示数据
   * GET /api/v1/rules/demo/init
   */
  static async initDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      RuleDemoService.initializeDemoData();
      
      const rules = RuleDemoService.getDemoRules();
      const emails = RuleDemoService.getDemoEmails();
      
      res.json(formatSuccessResponse({
        message: '演示数据初始化完成',
        rulesCount: rules.length,
        emailsCount: emails.length,
        rules: rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          isActive: rule.isActive,
          priority: rule.priority,
          conditionsCount: rule.conditions.length,
          actionsCount: rule.actions.length
        })),
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          sender: email.sender.address,
          importance: email.importance,
          receivedAt: email.receivedAt
        }))
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 运行规则引擎演示
   * POST /api/v1/rules/demo/run
   */
  static async runDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RuleDemoService.demonstrateRuleExecution();
      
      // 格式化结果以便展示
      const formattedResults = result.executionResults.map(emailResult => ({
        emailId: emailResult.emailId,
        emailSubject: emailResult.emailSubject,
        matchedRules: emailResult.appliedRules.filter(rule => rule.matched).map(rule => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          actionsExecuted: rule.actionsExecuted.map(action => ({
            type: action.actionType,
            result: action.result,
            executionTime: action.executionTime
          })),
          totalExecutionTime: rule.totalExecutionTime
        })),
        totalMatchedRules: emailResult.appliedRules.filter(rule => rule.matched).length,
        totalRulesChecked: emailResult.appliedRules.length
      }));

      res.json(formatSuccessResponse({
        message: '规则引擎演示执行完成',
        summary: result.summary,
        totalEmails: result.totalEmails,
        totalRules: result.totalRules,
        results: formattedResults,
        insights: {
          mostMatchedEmail: formattedResults.reduce((prev, current) => 
            prev.totalMatchedRules > current.totalMatchedRules ? prev : current
          ),
          averageRulesMatchedPerEmail: result.summary.totalMatches / result.totalEmails,
          averageActionsPerMatch: result.summary.totalActions / (result.summary.totalMatches || 1)
        }
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取演示统计信息
   * GET /api/v1/rules/demo/stats
   */
  static async getDemoStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await RuleDemoService.getDemoStatistics();
      
      res.json(formatSuccessResponse({
        message: '演示统计信息获取成功',
        ...stats,
        performance: {
          cacheHitRatio: stats.cacheInfo.totalKeys > 0 ? 
            ((stats.cacheInfo.ruleKeys + stats.cacheInfo.userRuleKeys) / stats.cacheInfo.totalKeys * 100).toFixed(2) + '%' : '0%',
          memoryUsage: stats.cacheInfo.memoryUsage,
          totalCacheKeys: stats.cacheInfo.totalKeys
        }
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取演示规则列表
   * GET /api/v1/rules/demo/rules
   */
  static async getDemoRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = RuleDemoService.getDemoRules();
      
      // 获取每个规则的执行次数
      const rulesWithStats = await Promise.all(
        rules.map(async (rule) => {
          const executionCount = await RuleCacheService.getRuleExecutionCount(rule.id);
          const lastExecution = await RuleCacheService.getRuleLastExecution(rule.id);
          
          return {
            ...rule,
            statistics: {
              executionCount,
              lastExecution
            }
          };
        })
      );

      res.json(formatSuccessResponse(rulesWithStats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取演示邮件列表
   * GET /api/v1/rules/demo/emails
   */
  static async getDemoEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emails = RuleDemoService.getDemoEmails();
      
      res.json(formatSuccessResponse({
        count: emails.length,
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          sender: email.sender,
          importance: email.importance,
          isRead: email.isRead,
          hasAttachments: email.hasAttachments,
          tags: email.tags,
          folders: email.folders,
          receivedAt: email.receivedAt,
          contentPreview: email.content.text.substring(0, 100) + '...'
        }))
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 测试单个规则
   * POST /api/v1/rules/demo/test-rule/:ruleId
   */
  static async testSingleRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ruleId } = req.params;
      const rules = RuleDemoService.getDemoRules();
      const emails = RuleDemoService.getDemoEmails();
      
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) {
        res.status(404).json(formatSuccessResponse(null, '规则不存在'));
        return;
      }

      const testResults = [];
      
      for (const email of emails) {
        const result = await import('@/services/RuleEngineService').then(
          ({ RuleEngineService }) => RuleEngineService.executeRule(rule, email)
        );
        
        testResults.push({
          emailId: email.id,
          emailSubject: email.subject,
          matched: result.matched,
          actionsExecuted: result.actionsExecuted,
          executionTime: result.totalExecutionTime
        });
      }

      const matchedEmails = testResults.filter(r => r.matched);
      
      res.json(formatSuccessResponse({
        rule: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          conditions: rule.conditions,
          actions: rule.actions,
          logicOperator: rule.logicOperator
        },
        testResults,
        summary: {
          totalEmailsTested: emails.length,
          matchedEmails: matchedEmails.length,
          matchRate: ((matchedEmails.length / emails.length) * 100).toFixed(2) + '%',
          averageExecutionTime: testResults.reduce((sum, r) => sum + r.executionTime, 0) / testResults.length
        }
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建演示规则
   * POST /api/v1/rules/demo/create
   */
  static async createDemoRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ruleData = req.body;
      
      // 基本验证
      if (!ruleData.name || !ruleData.conditions || !ruleData.actions) {
        res.status(400).json(formatSuccessResponse(null, '规则名称、条件和动作为必填项'));
        return;
      }

      const rule = RuleDemoService.createDemoRule(ruleData);
      
      res.status(201).json(formatSuccessResponse(rule, '演示规则创建成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取规则执行效果预览
   * POST /api/v1/rules/demo/preview
   */
  static async previewRuleEffect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conditions, logicOperator = 'AND', actions } = req.body;
      
      if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        res.status(400).json(formatSuccessResponse(null, '必须提供规则条件'));
        return;
      }

      // 创建临时规则用于预览
      const tempRule = {
        id: 'temp-preview',
        userId: 'demo-user',
        name: '预览规则',
        description: '临时规则用于效果预览',
        isActive: true,
        priority: 1,
        logicOperator: logicOperator as 'AND' | 'OR',
        conditions,
        actions: actions || [],
        createdBy: 'demo-user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const emails = RuleDemoService.getDemoEmails();
      const previewResults = [];
      
      for (const email of emails) {
        const matchResult = await import('@/services/RuleEngineService').then(
          ({ RuleEngineService }) => RuleEngineService.evaluateRule(tempRule, email)
        );
        
        if (matchResult.matched) {
          previewResults.push({
            emailId: email.id,
            emailSubject: email.subject,
            emailSender: email.sender.address,
            matchedConditions: matchResult.matchedConditions.map(c => ({
              field: c.field,
              operator: c.operator,
              value: c.value
            })),
            wouldExecuteActions: actions?.map((action: any) => ({
              type: action.type,
              parameters: action.parameters
            })) || []
          });
        }
      }

      res.json(formatSuccessResponse({
        previewRule: {
          conditions,
          logicOperator,
          actions: actions || []
        },
        matchedEmails: previewResults,
        summary: {
          totalEmailsChecked: emails.length,
          matchedEmails: previewResults.length,
          matchRate: ((previewResults.length / emails.length) * 100).toFixed(2) + '%'
        },
        recommendations: this.generateRuleRecommendations(previewResults, emails.length)
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 清理缓存
   * POST /api/v1/rules/demo/cleanup
   */
  static async cleanupCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deletedCount = await RuleCacheService.cleanup();
      
      res.json(formatSuccessResponse({
        message: '缓存清理完成',
        deletedKeys: deletedCount
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 重置演示数据
   * POST /api/v1/rules/demo/reset
   */
  static async resetDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      RuleDemoService.resetDemoData();
      
      res.json(formatSuccessResponse({
        message: '演示数据已重置',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取系统健康状态
   * GET /api/v1/rules/demo/health
   */
  static async getSystemHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cacheInfo = await RuleCacheService.getCacheInfo();
      const rules = RuleDemoService.getDemoRules();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          ruleEngine: {
            status: 'operational',
            rulesLoaded: rules.length,
            activeRules: rules.filter(r => r.isActive).length
          },
          cache: {
            status: 'operational',
            totalKeys: cacheInfo.totalKeys,
            memoryUsage: cacheInfo.memoryUsage,
            ruleKeys: cacheInfo.ruleKeys
          },
          demo: {
            status: 'operational',
            demoDataInitialized: rules.length > 0,
            emailSamples: RuleDemoService.getDemoEmails().length
          }
        },
        performance: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        }
      };

      res.json(formatSuccessResponse(health));
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json(formatSuccessResponse({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * 生成规则建议
   */
  private static generateRuleRecommendations(matchedEmails: any[], totalEmails: number): string[] {
    const recommendations = [];
    const matchRate = matchedEmails.length / totalEmails;

    if (matchRate > 0.8) {
      recommendations.push('规则匹配率过高(>80%)，建议增加更具体的条件来提高精确性');
    } else if (matchRate < 0.1) {
      recommendations.push('规则匹配率过低(<10%)，建议放宽条件或使用OR逻辑');
    }

    if (matchedEmails.length === 0) {
      recommendations.push('没有邮件匹配此规则，请检查条件设置是否正确');
    }

    if (matchedEmails.length > 0 && matchedEmails.length <= 2) {
      recommendations.push('匹配的邮件较少，规则可能过于严格');
    }

    if (recommendations.length === 0) {
      recommendations.push('规则设置合理，匹配效果良好');
    }

    return recommendations;
  }
}