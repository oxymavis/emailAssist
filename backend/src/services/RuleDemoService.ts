import { 
  FilterRule, 
  FilterRuleCondition, 
  FilterRuleAction, 
  EmailMessage, 
  RuleExecutionResult,
  CreateFilterRuleRequest 
} from '@/types';
import { RuleEngineService } from './RuleEngineService';
import { RuleCacheService } from './RuleCacheService';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 规则引擎演示服务
 * 提供内存中的规则管理和执行演示
 * 用于展示规则引擎功能，不依赖数据库
 */
export class RuleDemoService {
  private static demoRules = new Map<string, FilterRule>();
  private static userRules = new Map<string, string[]>(); // userId -> ruleIds
  
  /**
   * 初始化演示数据
   */
  static initializeDemoData(): void {
    logger.info('Initializing rule engine demo data');

    // 创建示例规则
    const demoRules: CreateFilterRuleRequest[] = [
      {
        name: '高优先级邮件自动标记',
        description: '自动标记来自VIP发件人或包含紧急关键词的邮件',
        isActive: true,
        priority: 1,
        logicOperator: 'OR',
        conditions: [
          { field: 'sender', operator: 'in', value: 'boss@company.com,ceo@company.com', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: '紧急', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: 'urgent', valueType: 'string' },
          { field: 'importance', operator: 'equals', value: 'high', valueType: 'string' }
        ],
        actions: [
          { type: 'add_tag', parameters: { tags: ['高优先级', '重要', 'VIP'] } },
          { type: 'send_notification', parameters: { message: '收到重要邮件', type: 'push' } }
        ]
      },
      {
        name: '垃圾邮件自动过滤',
        description: '自动识别和处理垃圾邮件',
        isActive: true,
        priority: 2,
        logicOperator: 'OR',
        conditions: [
          { field: 'subject', operator: 'contains', value: '中奖', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: '免费', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: '优惠', valueType: 'string' },
          { field: 'content', operator: 'contains', value: '点击链接', valueType: 'string' },
          { field: 'sender', operator: 'contains', value: 'noreply@spam', valueType: 'string' }
        ],
        actions: [
          { type: 'add_tag', parameters: { tags: ['垃圾邮件', '自动过滤'] } },
          { type: 'move_to_folder', parameters: { folderId: 'junkemail' } },
          { type: 'mark_as_read', parameters: {} }
        ]
      },
      {
        name: '工作邮件分类管理',
        description: '自动分类和处理工作相关邮件',
        isActive: true,
        priority: 3,
        logicOperator: 'AND',
        conditions: [
          { field: 'sender', operator: 'contains', value: '@company.com', valueType: 'string' },
          { field: 'subject', operator: 'not_contains', value: '个人', valueType: 'string' }
        ],
        actions: [
          { type: 'add_tag', parameters: { tags: ['工作', '公司'] } },
          { type: 'move_to_folder', parameters: { folderId: 'work' } }
        ]
      },
      {
        name: '会议邀请智能处理',
        description: '自动处理会议邀请，创建任务提醒',
        isActive: true,
        priority: 4,
        logicOperator: 'OR',
        conditions: [
          { field: 'subject', operator: 'contains', value: '会议邀请', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: 'meeting', valueType: 'string' },
          { field: 'content', operator: 'contains', value: '会议时间', valueType: 'string' },
          { field: 'content', operator: 'contains', value: '腾讯会议', valueType: 'string' }
        ],
        actions: [
          { type: 'add_tag', parameters: { tags: ['会议', '日程', '待处理'] } },
          { type: 'create_task', parameters: { 
            title: '处理会议邀请', 
            description: '查看会议详情并确认参加',
            priority: 'normal'
          } }
        ]
      },
      {
        name: '项目邮件自动归档',
        description: '根据项目关键词自动归档邮件',
        isActive: true,
        priority: 5,
        logicOperator: 'OR',
        conditions: [
          { field: 'subject', operator: 'regex', value: '项目[A-Z0-9]+', valueType: 'string' },
          { field: 'subject', operator: 'contains', value: 'Project', valueType: 'string' },
          { field: 'content', operator: 'contains', value: '里程碑', valueType: 'string' }
        ],
        actions: [
          { type: 'add_tag', parameters: { tags: ['项目', '工作进展'] } },
          { type: 'copy_to_folder', parameters: { folderId: 'projects' } }
        ]
      }
    ];

    // 创建演示用户ID
    const demoUserId = 'demo-user-12345';
    this.userRules.set(demoUserId, []);

    // 创建规则实例
    demoRules.forEach((ruleData, index) => {
      const rule: FilterRule = {
        id: uuidv4(),
        userId: demoUserId,
        name: ruleData.name,
        description: ruleData.description,
        isActive: ruleData.isActive || true,
        priority: ruleData.priority || index + 1,
        logicOperator: ruleData.logicOperator || 'AND',
        conditions: ruleData.conditions,
        actions: ruleData.actions,
        createdBy: demoUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.demoRules.set(rule.id, rule);
      this.userRules.get(demoUserId)!.push(rule.id);
    });

    logger.info('Demo data initialized', { 
      rulesCount: this.demoRules.size, 
      userId: demoUserId 
    });
  }

  /**
   * 获取演示规则列表
   */
  static getDemoRules(userId = 'demo-user-12345'): FilterRule[] {
    const userRuleIds = this.userRules.get(userId) || [];
    return userRuleIds.map(id => this.demoRules.get(id)).filter(Boolean) as FilterRule[];
  }

  /**
   * 获取演示邮件数据
   */
  static getDemoEmails(): EmailMessage[] {
    return [
      {
        id: '1',
        userId: 'demo-user-12345',
        accountId: 'demo-account',
        messageId: 'msg-001',
        conversationId: 'conv-001',
        subject: '紧急：季度业绩报告需要您的审核',
        sender: { name: '王总', address: 'boss@company.com' },
        recipients: { to: [{ name: '您', address: 'you@company.com' }] },
        content: { text: '请尽快审核本季度业绩报告，明天上午需要提交给董事会。', html: '<p>请尽快审核本季度业绩报告...</p>' },
        receivedAt: new Date('2024-01-15T09:30:00'),
        sentAt: new Date('2024-01-15T09:28:00'),
        importance: 'high' as const,
        isRead: false,
        isDraft: false,
        hasAttachments: true,
        attachments: [{ id: 'att1', name: 'Q4业绩报告.pdf', contentType: 'application/pdf', size: 1024000 }],
        folders: ['inbox'],
        tags: [],
        customProperties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        userId: 'demo-user-12345',
        accountId: 'demo-account',
        messageId: 'msg-002',
        conversationId: 'conv-002',
        subject: '恭喜您中奖了！点击领取百万大奖！',
        sender: { name: '幸运大转盘', address: 'noreply@spam-lottery.com' },
        recipients: { to: [{ name: '您', address: 'you@company.com' }] },
        content: { text: '恭喜您在我们的抽奖活动中获得一等奖！请点击链接立即领取奖金...', html: '<p>恭喜您...</p>' },
        receivedAt: new Date('2024-01-15T10:15:00'),
        sentAt: new Date('2024-01-15T10:14:00'),
        importance: 'normal' as const,
        isRead: false,
        isDraft: false,
        hasAttachments: false,
        attachments: [],
        folders: ['inbox'],
        tags: [],
        customProperties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        userId: 'demo-user-12345',
        accountId: 'demo-account',
        messageId: 'msg-003',
        conversationId: 'conv-003',
        subject: '项目A进度更新 - 本周里程碑达成',
        sender: { name: '李项目经理', address: 'project.manager@company.com' },
        recipients: { to: [{ name: '项目组', address: 'project-team@company.com' }] },
        content: { text: '各位同事，本周项目A的主要里程碑已经达成，详细进展如下...', html: '<p>各位同事...</p>' },
        receivedAt: new Date('2024-01-15T11:20:00'),
        sentAt: new Date('2024-01-15T11:18:00'),
        importance: 'normal' as const,
        isRead: false,
        isDraft: false,
        hasAttachments: false,
        attachments: [],
        folders: ['inbox'],
        tags: [],
        customProperties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        userId: 'demo-user-12345',
        accountId: 'demo-account',
        messageId: 'msg-004',
        conversationId: 'conv-004',
        subject: '会议邀请：周例会 - 明天下午3点',
        sender: { name: '助理小张', address: 'assistant@company.com' },
        recipients: { to: [{ name: '开发团队', address: 'dev-team@company.com' }] },
        content: { text: '各位同事，明天（周三）下午3点在会议室A召开周例会，会议时间约1小时，请准时参加。腾讯会议号：123456789', html: '<p>各位同事...</p>' },
        receivedAt: new Date('2024-01-15T14:30:00'),
        sentAt: new Date('2024-01-15T14:28:00'),
        importance: 'normal' as const,
        isRead: false,
        isDraft: false,
        hasAttachments: false,
        attachments: [],
        folders: ['inbox'],
        tags: [],
        customProperties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '5',
        userId: 'demo-user-12345',
        accountId: 'demo-account',
        messageId: 'msg-005',
        conversationId: 'conv-005',
        subject: '个人事务：银行对账单',
        sender: { name: '建设银行', address: 'statement@ccb.com' },
        recipients: { to: [{ name: '您', address: 'personal@email.com' }] },
        content: { text: '尊敬的客户，您的12月份银行对账单已生成，请查收...', html: '<p>尊敬的客户...</p>' },
        receivedAt: new Date('2024-01-15T16:45:00'),
        sentAt: new Date('2024-01-15T16:40:00'),
        importance: 'low' as const,
        isRead: false,
        isDraft: false,
        hasAttachments: true,
        attachments: [{ id: 'att2', name: '对账单.pdf', contentType: 'application/pdf', size: 512000 }],
        folders: ['inbox'],
        tags: [],
        customProperties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * 演示规则执行
   */
  static async demonstrateRuleExecution(userId = 'demo-user-12345'): Promise<{
    totalEmails: number;
    totalRules: number;
    executionResults: Array<{
      emailId: string;
      emailSubject: string;
      appliedRules: RuleExecutionResult[];
    }>;
    summary: {
      emailsProcessed: number;
      rulesExecuted: number;
      totalMatches: number;
      totalActions: number;
    };
  }> {
    logger.info('Starting rule engine demonstration', { userId });

    const rules = this.getDemoRules(userId);
    const emails = this.getDemoEmails();
    
    if (rules.length === 0) {
      this.initializeDemoData();
      return this.demonstrateRuleExecution(userId);
    }

    const executionResults = [];
    let totalMatches = 0;
    let totalActions = 0;
    let rulesExecuted = 0;

    for (const email of emails) {
      const emailResults: RuleExecutionResult[] = [];
      
      for (const rule of rules) {
        try {
          const result = await RuleEngineService.executeRule(rule, email);
          emailResults.push(result);
          rulesExecuted++;
          
          if (result.matched) {
            totalMatches++;
            totalActions += result.actionsExecuted.length;
            
            // 更新缓存计数
            await RuleCacheService.incrementRuleExecutionCount(rule.id);
            await RuleCacheService.setRuleLastExecution(rule.id);
          }
        } catch (error) {
          logger.error('Rule execution failed in demo', { 
            ruleId: rule.id, 
            emailId: email.id, 
            error 
          });
        }
      }
      
      executionResults.push({
        emailId: email.id,
        emailSubject: email.subject,
        appliedRules: emailResults
      });
    }

    const summary = {
      emailsProcessed: emails.length,
      rulesExecuted,
      totalMatches,
      totalActions
    };

    logger.info('Rule engine demonstration completed', { 
      userId, 
      ...summary 
    });

    return {
      totalEmails: emails.length,
      totalRules: rules.length,
      executionResults,
      summary
    };
  }

  /**
   * 获取演示统计信息
   */
  static async getDemoStatistics(userId = 'demo-user-12345'): Promise<{
    ruleStats: Array<{
      ruleId: string;
      ruleName: string;
      isActive: boolean;
      priority: number;
      conditionsCount: number;
      actionsCount: number;
      executionCount: number;
      lastExecution: Date | null;
    }>;
    overallStats: {
      totalRules: number;
      activeRules: number;
      inactiveRules: number;
      totalExecutions: number;
      averageConditionsPerRule: number;
      averageActionsPerRule: number;
    };
    cacheInfo: any;
  }> {
    const rules = this.getDemoRules(userId);
    const ruleStats = [];

    // 获取每个规则的统计信息
    for (const rule of rules) {
      const executionCount = await RuleCacheService.getRuleExecutionCount(rule.id);
      const lastExecution = await RuleCacheService.getRuleLastExecution(rule.id);

      ruleStats.push({
        ruleId: rule.id,
        ruleName: rule.name,
        isActive: rule.isActive,
        priority: rule.priority,
        conditionsCount: rule.conditions.length,
        actionsCount: rule.actions.length,
        executionCount,
        lastExecution
      });
    }

    // 计算总体统计
    const totalRules = rules.length;
    const activeRules = rules.filter(r => r.isActive).length;
    const inactiveRules = totalRules - activeRules;
    const totalExecutions = ruleStats.reduce((sum, stat) => sum + stat.executionCount, 0);
    const averageConditionsPerRule = totalRules > 0 ? 
      rules.reduce((sum, r) => sum + r.conditions.length, 0) / totalRules : 0;
    const averageActionsPerRule = totalRules > 0 ? 
      rules.reduce((sum, r) => sum + r.actions.length, 0) / totalRules : 0;

    // 获取缓存信息
    const cacheInfo = await RuleCacheService.getCacheInfo();

    return {
      ruleStats,
      overallStats: {
        totalRules,
        activeRules,
        inactiveRules,
        totalExecutions,
        averageConditionsPerRule: Math.round(averageConditionsPerRule * 100) / 100,
        averageActionsPerRule: Math.round(averageActionsPerRule * 100) / 100
      },
      cacheInfo
    };
  }

  /**
   * 创建演示规则
   */
  static createDemoRule(ruleData: CreateFilterRuleRequest, userId = 'demo-user-12345'): FilterRule {
    const rule: FilterRule = {
      id: uuidv4(),
      userId,
      name: ruleData.name,
      description: ruleData.description,
      isActive: ruleData.isActive !== false,
      priority: ruleData.priority || this.demoRules.size + 1,
      logicOperator: ruleData.logicOperator || 'AND',
      conditions: ruleData.conditions,
      actions: ruleData.actions,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.demoRules.set(rule.id, rule);
    
    if (!this.userRules.has(userId)) {
      this.userRules.set(userId, []);
    }
    this.userRules.get(userId)!.push(rule.id);

    logger.info('Demo rule created', { ruleId: rule.id, userId });
    return rule;
  }

  /**
   * 更新演示规则
   */
  static updateDemoRule(ruleId: string, updates: Partial<FilterRule>): FilterRule | null {
    const rule = this.demoRules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates, updatedAt: new Date() };
    this.demoRules.set(ruleId, updatedRule);

    logger.info('Demo rule updated', { ruleId });
    return updatedRule;
  }

  /**
   * 删除演示规则
   */
  static deleteDemoRule(ruleId: string, userId = 'demo-user-12345'): boolean {
    const rule = this.demoRules.get(ruleId);
    if (!rule || rule.userId !== userId) return false;

    this.demoRules.delete(ruleId);
    
    const userRuleIds = this.userRules.get(userId);
    if (userRuleIds) {
      const index = userRuleIds.indexOf(ruleId);
      if (index > -1) {
        userRuleIds.splice(index, 1);
      }
    }

    logger.info('Demo rule deleted', { ruleId, userId });
    return true;
  }

  /**
   * 重置演示数据
   */
  static resetDemoData(): void {
    this.demoRules.clear();
    this.userRules.clear();
    this.initializeDemoData();
    logger.info('Demo data reset completed');
  }
}