/**
 * Workflow Manager Service
 * Manages email to task conversion and third-party integrations
 * P1 Feature Implementation
 */

import logger from '@/utils/logger';
import TrelloIntegration from './integrations/TrelloIntegration';
import JiraIntegration from './integrations/JiraIntegration';
import { NotificationService } from './NotificationService';
import { EmailMessage } from '@/types';

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  userId: string;
  enabled: boolean;
  priority: number;

  // Trigger conditions
  conditions: {
    priority?: 'high' | 'medium' | 'low';
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    senders?: string[];
    subjects?: string[];
    hasAttachments?: boolean;
    minImportanceScore?: number;
  };

  // Actions to perform
  actions: {
    platform: 'trello' | 'jira' | 'internal';
    config: TrelloWorkflowConfig | JiraWorkflowConfig | InternalWorkflowConfig;
    notifyUser?: boolean;
    addToReport?: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface TrelloWorkflowConfig {
  boardId: string;
  listId: string;
  labels?: string[];
  assignMembers?: string[];
  addAttachments?: boolean;
  dueDate?: {
    type: 'fixed' | 'relative';
    value: Date | number; // Date for fixed, days for relative
  };
}

export interface JiraWorkflowConfig {
  projectKey: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  dueDate?: {
    type: 'fixed' | 'relative';
    value: Date | number;
  };
  customFields?: Record<string, any>;
}

export interface InternalWorkflowConfig {
  taskTitle: string;
  taskDescription?: string;
  assignToUser?: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  tags?: string[];
}

export interface WorkflowExecution {
  id: string;
  ruleId: string;
  emailId: string;
  userId: string;
  platform: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WorkflowStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  executionsByPlatform: Record<string, number>;
  avgExecutionTime: number;
  recentExecutions: WorkflowExecution[];
}

export class WorkflowManager {
  private trelloIntegrations: Map<string, TrelloIntegration> = new Map();
  private jiraIntegrations: Map<string, JiraIntegration> = new Map();
  private notificationService: NotificationService;
  private activeRules: Map<string, WorkflowRule[]> = new Map(); // userId -> rules
  private executionQueue: WorkflowExecution[] = [];
  private isProcessing = false;

  constructor() {
    this.notificationService = new NotificationService();
    this.startProcessing();
  }

  /**
   * Configure Trello integration for user
   */
  async configureTrelloIntegration(userId: string, config: TrelloConfig): Promise<boolean> {
    try {
      const integration = new TrelloIntegration(config);

      // Test connection
      const isConnected = await integration.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Trello');
      }

      this.trelloIntegrations.set(userId, integration);

      logger.info('Trello integration configured', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to configure Trello integration', { userId, error });
      throw error;
    }
  }

  /**
   * Configure Jira integration for user
   */
  async configureJiraIntegration(userId: string, config: JiraConfig): Promise<boolean> {
    try {
      const integration = new JiraIntegration(config);

      // Test connection
      const isConnected = await integration.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Jira');
      }

      this.jiraIntegrations.set(userId, integration);

      logger.info('Jira integration configured', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to configure Jira integration', { userId, error });
      throw error;
    }
  }

  /**
   * Create workflow rule
   */
  async createWorkflowRule(rule: Omit<WorkflowRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowRule> {
    try {
      const newRule: WorkflowRule = {
        ...rule,
        id: this.generateRuleId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store rule (in production, this would be in database)
      if (!this.activeRules.has(rule.userId)) {
        this.activeRules.set(rule.userId, []);
      }

      const userRules = this.activeRules.get(rule.userId)!;
      userRules.push(newRule);

      // Sort rules by priority
      userRules.sort((a, b) => b.priority - a.priority);

      logger.info('Workflow rule created', {
        ruleId: newRule.id,
        userId: rule.userId
      });

      return newRule;
    } catch (error) {
      logger.error('Failed to create workflow rule', { userId: rule.userId, error });
      throw error;
    }
  }

  /**
   * Update workflow rule
   */
  async updateWorkflowRule(ruleId: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule> {
    try {
      const userRules = this.activeRules.get(updates.userId || '');
      if (!userRules) {
        throw new Error('User rules not found');
      }

      const ruleIndex = userRules.findIndex(r => r.id === ruleId);
      if (ruleIndex === -1) {
        throw new Error('Rule not found');
      }

      userRules[ruleIndex] = {
        ...userRules[ruleIndex],
        ...updates,
        updatedAt: new Date()
      };

      logger.info('Workflow rule updated', { ruleId });
      return userRules[ruleIndex];
    } catch (error) {
      logger.error('Failed to update workflow rule', { ruleId, error });
      throw error;
    }
  }

  /**
   * Delete workflow rule
   */
  async deleteWorkflowRule(userId: string, ruleId: string): Promise<boolean> {
    try {
      const userRules = this.activeRules.get(userId);
      if (!userRules) {
        return false;
      }

      const ruleIndex = userRules.findIndex(r => r.id === ruleId);
      if (ruleIndex === -1) {
        return false;
      }

      userRules.splice(ruleIndex, 1);

      logger.info('Workflow rule deleted', { ruleId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to delete workflow rule', { ruleId, userId, error });
      return false;
    }
  }

  /**
   * Get user workflow rules
   */
  async getUserWorkflowRules(userId: string): Promise<WorkflowRule[]> {
    return this.activeRules.get(userId) || [];
  }

  /**
   * Process email through workflow rules
   */
  async processEmailWorkflow(email: EmailMessage, userId: string): Promise<WorkflowExecution[]> {
    try {
      const userRules = this.activeRules.get(userId) || [];
      const executions: WorkflowExecution[] = [];

      for (const rule of userRules) {
        if (!rule.enabled) {
          continue;
        }

        if (await this.evaluateRuleConditions(email, rule)) {
          const execution = this.createExecution(rule, email, userId);
          executions.push(execution);
          this.executionQueue.push(execution);

          logger.info('Email matched workflow rule', {
            emailId: email.id,
            ruleId: rule.id,
            ruleName: rule.name
          });
        }
      }

      return executions;
    } catch (error) {
      logger.error('Failed to process email workflow', {
        emailId: email.id,
        userId,
        error
      });
      return [];
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(userId: string, days = 30): Promise<WorkflowStats> {
    try {
      // In production, this would query the database
      // For now, return mock statistics
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const stats: WorkflowStats = {
        totalExecutions: 156,
        successfulExecutions: 142,
        failedExecutions: 14,
        executionsByPlatform: {
          'trello': 89,
          'jira': 53,
          'internal': 14
        },
        avgExecutionTime: 2.3, // seconds
        recentExecutions: [] // Would be populated from database
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get workflow stats', { userId, error });
      throw error;
    }
  }

  /**
   * Test workflow rule against email
   */
  async testWorkflowRule(rule: WorkflowRule, email: EmailMessage): Promise<{
    matched: boolean;
    conditions: Record<string, boolean>;
    wouldExecute: boolean;
  }> {
    try {
      const conditionResults: Record<string, boolean> = {};

      // Test each condition
      if (rule.conditions.priority) {
        conditionResults.priority = email.importance === rule.conditions.priority;
      }

      if (rule.conditions.sentiment) {
        // Assuming email has sentiment analysis result
        conditionResults.sentiment = (email as any).sentiment === rule.conditions.sentiment;
      }

      if (rule.conditions.keywords && rule.conditions.keywords.length > 0) {
        const content = `${email.subject} ${email.body}`.toLowerCase();
        conditionResults.keywords = rule.conditions.keywords.some(keyword =>
          content.includes(keyword.toLowerCase())
        );
      }

      if (rule.conditions.senders && rule.conditions.senders.length > 0) {
        conditionResults.senders = rule.conditions.senders.some(sender =>
          email.from?.email?.toLowerCase().includes(sender.toLowerCase())
        );
      }

      if (rule.conditions.subjects && rule.conditions.subjects.length > 0) {
        const subject = email.subject?.toLowerCase() || '';
        conditionResults.subjects = rule.conditions.subjects.some(pattern =>
          subject.includes(pattern.toLowerCase())
        );
      }

      if (rule.conditions.hasAttachments !== undefined) {
        conditionResults.hasAttachments = Boolean(email.attachments?.length) === rule.conditions.hasAttachments;
      }

      if (rule.conditions.minImportanceScore) {
        // Assuming email has importance score
        conditionResults.minImportanceScore = (email as any).importanceScore >= rule.conditions.minImportanceScore;
      }

      const matched = await this.evaluateRuleConditions(email, rule);

      return {
        matched,
        conditions: conditionResults,
        wouldExecute: matched && rule.enabled
      };
    } catch (error) {
      logger.error('Failed to test workflow rule', { ruleId: rule.id, error });
      throw error;
    }
  }

  /**
   * Retry failed execution
   */
  async retryExecution(executionId: string): Promise<boolean> {
    try {
      // Find execution (in production, would query database)
      const execution = this.executionQueue.find(e => e.id === executionId);
      if (!execution) {
        throw new Error('Execution not found');
      }

      if (execution.status !== 'failed') {
        throw new Error('Only failed executions can be retried');
      }

      execution.status = 'pending';
      execution.error = undefined;

      logger.info('Execution retry queued', { executionId });
      return true;
    } catch (error) {
      logger.error('Failed to retry execution', { executionId, error });
      return false;
    }
  }

  /**
   * Process execution queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    setInterval(async () => {
      const pendingExecutions = this.executionQueue.filter(e => e.status === 'pending');

      for (const execution of pendingExecutions.slice(0, 5)) { // Process 5 at a time
        await this.executeWorkflow(execution);
      }
    }, 2000); // Process every 2 seconds
  }

  /**
   * Execute workflow action
   */
  private async executeWorkflow(execution: WorkflowExecution): Promise<void> {
    try {
      execution.status = 'processing';

      const rule = await this.findRuleById(execution.ruleId);
      if (!rule) {
        throw new Error('Rule not found');
      }

      // Get email data (in production, would fetch from database)
      const email = await this.getEmailById(execution.emailId);
      if (!email) {
        throw new Error('Email not found');
      }

      let result: any;

      switch (rule.actions.platform) {
        case 'trello':
          result = await this.executeTrelloAction(execution.userId, email, rule.actions.config as TrelloWorkflowConfig);
          break;

        case 'jira':
          result = await this.executeJiraAction(execution.userId, email, rule.actions.config as JiraWorkflowConfig);
          break;

        case 'internal':
          result = await this.executeInternalAction(execution.userId, email, rule.actions.config as InternalWorkflowConfig);
          break;

        default:
          throw new Error(`Unsupported platform: ${rule.actions.platform}`);
      }

      execution.status = 'completed';
      execution.result = result;
      execution.completedAt = new Date();

      // Send notification if configured
      if (rule.actions.notifyUser) {
        await this.sendWorkflowNotification(execution, rule, email);
      }

      logger.info('Workflow execution completed', {
        executionId: execution.id,
        platform: rule.actions.platform
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;

      logger.error('Workflow execution failed', {
        executionId: execution.id,
        error
      });
    }
  }

  /**
   * Execute Trello action
   */
  private async executeTrelloAction(userId: string, email: EmailMessage, config: TrelloWorkflowConfig): Promise<any> {
    const integration = this.trelloIntegrations.get(userId);
    if (!integration) {
      throw new Error('Trello integration not configured');
    }

    let dueDate: Date | undefined;
    if (config.dueDate) {
      if (config.dueDate.type === 'fixed') {
        dueDate = config.dueDate.value as Date;
      } else {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (config.dueDate.value as number));
      }
    }

    const card = await integration.createCardFromEmail(email, config.listId, {
      addLabels: config.labels,
      assignMembers: config.assignMembers,
      addAttachments: config.addAttachments,
      dueDate
    });

    return { platform: 'trello', cardId: card.id, cardUrl: `https://trello.com/c/${card.id}` };
  }

  /**
   * Execute Jira action
   */
  private async executeJiraAction(userId: string, email: EmailMessage, config: JiraWorkflowConfig): Promise<any> {
    const integration = this.jiraIntegrations.get(userId);
    if (!integration) {
      throw new Error('Jira integration not configured');
    }

    let dueDate: Date | undefined;
    if (config.dueDate) {
      if (config.dueDate.type === 'fixed') {
        dueDate = config.dueDate.value as Date;
      } else {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (config.dueDate.value as number));
      }
    }

    const issue = await integration.createIssueFromEmail(email, {
      issueType: config.issueType,
      priority: config.priority,
      assignee: config.assignee,
      labels: config.labels,
      components: config.components,
      dueDate,
      customFields: config.customFields
    });

    return {
      platform: 'jira',
      issueId: issue.id,
      issueKey: issue.key,
      issueUrl: `https://${integration['config'].host}/browse/${issue.key}`
    };
  }

  /**
   * Execute internal action
   */
  private async executeInternalAction(userId: string, email: EmailMessage, config: InternalWorkflowConfig): Promise<any> {
    // Create internal task (in production, would store in database)
    const task = {
      id: this.generateTaskId(),
      title: config.taskTitle,
      description: config.taskDescription || email.body,
      userId,
      assignedTo: config.assignToUser || userId,
      priority: config.priority,
      dueDate: config.dueDate,
      tags: config.tags || [],
      emailId: email.id,
      status: 'pending',
      createdAt: new Date()
    };

    logger.info('Internal task created', { taskId: task.id, emailId: email.id });

    return { platform: 'internal', taskId: task.id };
  }

  /**
   * Send workflow completion notification
   */
  private async sendWorkflowNotification(execution: WorkflowExecution, rule: WorkflowRule, email: EmailMessage): Promise<void> {
    try {
      const message = `Workflow "${rule.name}" executed successfully for email "${email.subject}". Task created in ${rule.actions.platform}.`;

      await (this.notificationService as any).createNotification({
        userId: execution.userId,
        // type: 'workflow_completed',
        title: 'Workflow Executed',
        message,
        data: {
          executionId: execution.id,
          ruleId: rule.id,
          emailId: email.id,
          platform: rule.actions.platform,
          result: execution.result
        }
      });
    } catch (error) {
      logger.error('Failed to send workflow notification', { executionId: execution.id, error });
    }
  }

  /**
   * Evaluate rule conditions against email
   */
  private async evaluateRuleConditions(email: EmailMessage, rule: WorkflowRule): Promise<boolean> {
    const { conditions } = rule;

    // Priority condition
    if (conditions.priority && email.importance !== conditions.priority) {
      return false;
    }

    // Sentiment condition (assuming email has sentiment analysis)
    if (conditions.sentiment && (email as any).sentiment !== conditions.sentiment) {
      return false;
    }

    // Keywords condition
    if (conditions.keywords && conditions.keywords.length > 0) {
      const content = `${email.subject} ${email.body}`.toLowerCase();
      const hasKeyword = conditions.keywords.some(keyword =>
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Senders condition
    if (conditions.senders && conditions.senders.length > 0) {
      const hasSender = conditions.senders.some(sender =>
        email.from?.email?.toLowerCase().includes(sender.toLowerCase())
      );
      if (!hasSender) {
        return false;
      }
    }

    // Subject patterns condition
    if (conditions.subjects && conditions.subjects.length > 0) {
      const subject = email.subject?.toLowerCase() || '';
      const hasSubjectPattern = conditions.subjects.some(pattern =>
        subject.includes(pattern.toLowerCase())
      );
      if (!hasSubjectPattern) {
        return false;
      }
    }

    // Attachments condition
    if (conditions.hasAttachments !== undefined) {
      const hasAttachments = Boolean(email.attachments?.length);
      if (hasAttachments !== conditions.hasAttachments) {
        return false;
      }
    }

    // Minimum importance score condition
    if (conditions.minImportanceScore && (email as any).importanceScore < conditions.minImportanceScore) {
      return false;
    }

    return true;
  }

  /**
   * Helper methods
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createExecution(rule: WorkflowRule, email: EmailMessage, userId: string): WorkflowExecution {
    return {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      emailId: email.id,
      userId,
      platform: rule.actions.platform,
      status: 'pending',
      createdAt: new Date()
    };
  }

  private async findRuleById(ruleId: string): Promise<WorkflowRule | null> {
    for (const [, rules] of this.activeRules) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        return rule;
      }
    }
    return null;
  }

  private async getEmailById(emailId: string): Promise<EmailMessage | null> {
    // In production, would query database
    // For now, return mock data
    return {
      id: emailId,
      subject: 'Test Email',
      body: 'Test email body',
      from: { email: 'test@example.com' },
      receivedAt: new Date()
    } as EmailMessage;
  }
}