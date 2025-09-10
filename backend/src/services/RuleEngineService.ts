import { 
  FilterRule, 
  FilterRuleCondition, 
  FilterRuleAction, 
  EmailMessage, 
  RuleMatchResult, 
  RuleExecutionResult,
  CreateRuleExecutionLogRequest
} from '@/types';
import { FilterRuleModel } from '@/models/FilterRule';
import { RuleExecutionLogModel } from '@/models/RuleExecutionLog';
import logger from '@/utils/logger';
import { ValidationError } from '@/utils/errors';
import cache from '@/config/redis';

/**
 * 规则引擎服务类
 * 负责规则匹配、条件评估和动作执行
 */
export class RuleEngineService {
  private static readonly CACHE_PREFIX = 'rules:';
  private static readonly CACHE_TTL = 300; // 5分钟缓存

  /**
   * 评估单个规则是否匹配邮件
   */
  static async evaluateRule(rule: FilterRule, email: EmailMessage): Promise<RuleMatchResult> {
    const startTime = Date.now();
    
    try {
      if (!rule.isActive || rule.conditions.length === 0) {
        return {
          matched: false,
          matchedConditions: [],
          nonMatchedConditions: rule.conditions,
          executionTime: Date.now() - startTime
        };
      }

      const matchedConditions: FilterRuleCondition[] = [];
      const nonMatchedConditions: FilterRuleCondition[] = [];

      // 评估每个条件
      for (const condition of rule.conditions) {
        const conditionMatched = await this.evaluateCondition(condition, email);
        
        if (conditionMatched) {
          matchedConditions.push(condition);
        } else {
          nonMatchedConditions.push(condition);
        }
      }

      // 根据逻辑运算符确定整体匹配结果
      let overallMatched = false;
      if (rule.logicOperator === 'AND') {
        overallMatched = matchedConditions.length === rule.conditions.length;
      } else if (rule.logicOperator === 'OR') {
        overallMatched = matchedConditions.length > 0;
      }

      return {
        matched: overallMatched,
        matchedConditions,
        nonMatchedConditions,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to evaluate rule', { 
        ruleId: rule.id, 
        emailId: email.id, 
        error 
      });
      
      return {
        matched: false,
        matchedConditions: [],
        nonMatchedConditions: rule.conditions,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 评估单个条件
   */
  private static async evaluateCondition(
    condition: FilterRuleCondition, 
    email: EmailMessage
  ): Promise<boolean> {
    try {
      const fieldValue = this.extractFieldValue(condition.field, email);
      const conditionValue = this.convertValue(condition.value, condition.valueType);
      
      return this.compareValues(fieldValue, condition.operator, conditionValue, condition.valueType);
    } catch (error) {
      logger.error('Failed to evaluate condition', { condition, error });
      return false;
    }
  }

  /**
   * 从邮件中提取字段值
   */
  private static extractFieldValue(field: string, email: EmailMessage): any {
    switch (field.toLowerCase()) {
      case 'subject':
        return email.subject || '';
      case 'sender':
      case 'from':
        return email.sender?.address || '';
      case 'sender_name':
      case 'from_name':
        return email.sender?.name || '';
      case 'content':
      case 'body':
        return email.content?.text || email.content?.html || '';
      case 'importance':
      case 'priority':
        return email.importance || 'normal';
      case 'is_read':
        return email.isRead;
      case 'has_attachments':
        return email.hasAttachments;
      case 'received_date':
      case 'received_at':
        return email.receivedAt;
      case 'sent_date':
      case 'sent_at':
        return email.sentAt;
      case 'to':
        return email.recipients?.to?.map(r => r.address).join(';') || '';
      case 'cc':
        return email.recipients?.cc?.map(r => r.address).join(';') || '';
      case 'tags':
        return email.tags || [];
      case 'folders':
        return email.folders || [];
      case 'attachment_count':
        return email.attachments?.length || 0;
      case 'conversation_id':
        return email.conversationId || '';
      default:
        // 检查自定义属性
        if (email.customProperties && field in email.customProperties) {
          return email.customProperties[field];
        }
        return '';
    }
  }

  /**
   * 转换值到指定类型
   */
  private static convertValue(value: any, valueType: string): any {
    switch (valueType) {
      case 'number':
        return typeof value === 'number' ? value : parseFloat(String(value));
      case 'boolean':
        return typeof value === 'boolean' ? value : value === 'true' || value === '1';
      case 'date':
        return value instanceof Date ? value : new Date(value);
      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * 比较值
   */
  private static compareValues(
    fieldValue: any, 
    operator: string, 
    conditionValue: any, 
    valueType: string
  ): boolean {
    try {
      // 统一类型转换
      const convertedFieldValue = this.convertValue(fieldValue, valueType);
      
      switch (operator) {
        case 'equals':
          return convertedFieldValue === conditionValue;
        
        case 'not_equals':
          return convertedFieldValue !== conditionValue;
        
        case 'contains':
          return String(convertedFieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        
        case 'not_contains':
          return !String(convertedFieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        
        case 'starts_with':
          return String(convertedFieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
        
        case 'ends_with':
          return String(convertedFieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
        
        case 'regex':
          try {
            const regex = new RegExp(String(conditionValue), 'i');
            return regex.test(String(convertedFieldValue));
          } catch {
            return false;
          }
        
        case 'gt':
          return convertedFieldValue > conditionValue;
        
        case 'lt':
          return convertedFieldValue < conditionValue;
        
        case 'gte':
          return convertedFieldValue >= conditionValue;
        
        case 'lte':
          return convertedFieldValue <= conditionValue;
        
        case 'in':
          const inValues = String(conditionValue).split(',').map(v => v.trim().toLowerCase());
          return inValues.includes(String(convertedFieldValue).toLowerCase());
        
        case 'not_in':
          const notInValues = String(conditionValue).split(',').map(v => v.trim().toLowerCase());
          return !notInValues.includes(String(convertedFieldValue).toLowerCase());
        
        default:
          logger.warn('Unknown operator', { operator });
          return false;
      }
    } catch (error) {
      logger.error('Error comparing values', { fieldValue, operator, conditionValue, error });
      return false;
    }
  }

  /**
   * 执行规则动作
   */
  static async executeRule(rule: FilterRule, email: EmailMessage): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    const executedActions: Array<{
      actionType: string;
      parameters: Record<string, any>;
      result: 'success' | 'error';
      errorMessage?: string;
      executionTime: number;
    }> = [];

    try {
      // 首先检查规则是否匹配
      const matchResult = await this.evaluateRule(rule, email);
      
      if (!matchResult.matched) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          actionsExecuted: [],
          totalExecutionTime: Date.now() - startTime
        };
      }

      // 执行所有动作
      for (const action of rule.actions) {
        const actionStartTime = Date.now();
        
        try {
          await this.executeAction(action, email, rule.userId);
          
          executedActions.push({
            actionType: action.type,
            parameters: action.parameters,
            result: 'success',
            executionTime: Date.now() - actionStartTime
          });
        } catch (error) {
          logger.error('Action execution failed', { 
            ruleId: rule.id, 
            actionType: action.type, 
            error 
          });
          
          executedActions.push({
            actionType: action.type,
            parameters: action.parameters,
            result: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - actionStartTime
          });
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      // 记录执行日志
      const logData: CreateRuleExecutionLogRequest = {
        ruleId: rule.id,
        userId: rule.userId,
        emailMessageId: email.messageId,
        executionTime: new Date(),
        status: executedActions.some(a => a.result === 'error') ? 'error' : 'success',
        actionsExecuted: executedActions,
        executionDurationMs: totalExecutionTime
      };

      await RuleExecutionLogModel.create(logData);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: true,
        actionsExecuted: executedActions,
        totalExecutionTime
      };

    } catch (error) {
      logger.error('Rule execution failed', { ruleId: rule.id, emailId: email.id, error });
      
      // 记录失败日志
      const logData: CreateRuleExecutionLogRequest = {
        ruleId: rule.id,
        userId: rule.userId,
        emailMessageId: email.messageId,
        executionTime: new Date(),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionDurationMs: Date.now() - startTime
      };

      await RuleExecutionLogModel.create(logData);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        actionsExecuted: executedActions,
        totalExecutionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 执行单个动作
   */
  private static async executeAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    switch (action.type) {
      case 'add_tag':
        await this.executeAddTagAction(action, email);
        break;
      
      case 'remove_tag':
        await this.executeRemoveTagAction(action, email);
        break;
      
      case 'move_to_folder':
        await this.executeMoveToFolderAction(action, email, userId);
        break;
      
      case 'copy_to_folder':
        await this.executeCopyToFolderAction(action, email, userId);
        break;
      
      case 'forward':
        await this.executeForwardAction(action, email, userId);
        break;
      
      case 'create_task':
        await this.executeCreateTaskAction(action, email, userId);
        break;
      
      case 'send_notification':
        await this.executeSendNotificationAction(action, email, userId);
        break;
      
      case 'mark_as_read':
        await this.executeMarkAsReadAction(action, email, userId);
        break;
      
      case 'mark_as_unread':
        await this.executeMarkAsUnreadAction(action, email, userId);
        break;
      
      case 'set_importance':
        await this.executeSetImportanceAction(action, email, userId);
        break;
      
      case 'delete_message':
        await this.executeDeleteMessageAction(action, email, userId);
        break;
      
      default:
        throw new ValidationError(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * 执行添加标签动作
   */
  private static async executeAddTagAction(action: FilterRuleAction, email: EmailMessage): Promise<void> {
    const tags = action.parameters.tags as string[];
    if (!Array.isArray(tags)) {
      throw new ValidationError('Tags parameter must be an array');
    }
    
    // 添加标签到邮件（这里需要与邮件系统集成）
    for (const tag of tags) {
      if (!email.tags.includes(tag)) {
        email.tags.push(tag);
      }
    }
    
    logger.info('Tags added to email', { 
      emailId: email.id, 
      tags, 
      totalTags: email.tags.length 
    });
  }

  /**
   * 执行移除标签动作
   */
  private static async executeRemoveTagAction(action: FilterRuleAction, email: EmailMessage): Promise<void> {
    const tags = action.parameters.tags as string[];
    if (!Array.isArray(tags)) {
      throw new ValidationError('Tags parameter must be an array');
    }
    
    // 从邮件中移除标签
    email.tags = email.tags.filter(tag => !tags.includes(tag));
    
    logger.info('Tags removed from email', { 
      emailId: email.id, 
      removedTags: tags, 
      remainingTags: email.tags.length 
    });
  }

  /**
   * 执行移动到文件夹动作
   */
  private static async executeMoveToFolderAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const folderId = action.parameters.folderId as string;
    if (!folderId) {
      throw new ValidationError('FolderId parameter is required for move_to_folder action');
    }
    
    // 这里需要调用Microsoft Graph API或其他邮件提供商API来移动邮件
    // 目前只记录日志和更新本地状态
    email.folders = [folderId];
    
    logger.info('Email moved to folder', { 
      emailId: email.id, 
      userId, 
      folderId 
    });
  }

  /**
   * 执行复制到文件夹动作
   */
  private static async executeCopyToFolderAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const folderId = action.parameters.folderId as string;
    if (!folderId) {
      throw new ValidationError('FolderId parameter is required for copy_to_folder action');
    }
    
    // 添加文件夹到邮件（复制不是移动）
    if (!email.folders.includes(folderId)) {
      email.folders.push(folderId);
    }
    
    logger.info('Email copied to folder', { 
      emailId: email.id, 
      userId, 
      folderId 
    });
  }

  /**
   * 执行转发动作
   */
  private static async executeForwardAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const recipients = action.parameters.recipients as string[];
    const message = action.parameters.message as string;
    
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new ValidationError('Recipients parameter is required for forward action');
    }
    
    // 这里需要调用邮件发送服务
    logger.info('Email forwarded', { 
      emailId: email.id, 
      userId, 
      recipients, 
      hasCustomMessage: !!message 
    });
  }

  /**
   * 执行创建任务动作
   */
  private static async executeCreateTaskAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const title = action.parameters.title as string;
    const description = action.parameters.description as string;
    const priority = action.parameters.priority as string;
    const dueDate = action.parameters.dueDate as string;
    
    if (!title) {
      throw new ValidationError('Title parameter is required for create_task action');
    }
    
    // 这里需要集成任务管理系统（如Microsoft To-Do、Jira等）
    logger.info('Task created from email', { 
      emailId: email.id, 
      userId, 
      taskTitle: title, 
      priority 
    });
  }

  /**
   * 执行发送通知动作
   */
  private static async executeSendNotificationAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const message = action.parameters.message as string;
    const type = action.parameters.type as string; // email, push, sms
    
    if (!message) {
      throw new ValidationError('Message parameter is required for send_notification action');
    }
    
    // 这里需要集成通知服务
    logger.info('Notification sent', { 
      emailId: email.id, 
      userId, 
      notificationType: type || 'push', 
      message 
    });
  }

  /**
   * 执行标记为已读动作
   */
  private static async executeMarkAsReadAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    email.isRead = true;
    
    logger.info('Email marked as read', { 
      emailId: email.id, 
      userId 
    });
  }

  /**
   * 执行标记为未读动作
   */
  private static async executeMarkAsUnreadAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    email.isRead = false;
    
    logger.info('Email marked as unread', { 
      emailId: email.id, 
      userId 
    });
  }

  /**
   * 执行设置重要性动作
   */
  private static async executeSetImportanceAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const importance = action.parameters.importance as 'low' | 'normal' | 'high';
    
    if (!['low', 'normal', 'high'].includes(importance)) {
      throw new ValidationError('Importance parameter must be low, normal, or high');
    }
    
    email.importance = importance;
    
    logger.info('Email importance set', { 
      emailId: email.id, 
      userId, 
      importance 
    });
  }

  /**
   * 执行删除邮件动作
   */
  private static async executeDeleteMessageAction(
    action: FilterRuleAction, 
    email: EmailMessage, 
    userId: string
  ): Promise<void> {
    const moveToTrash = action.parameters.moveToTrash !== false; // 默认移动到回收站
    
    // 这里需要调用Microsoft Graph API删除邮件
    logger.info('Email deleted', { 
      emailId: email.id, 
      userId, 
      moveToTrash 
    });
  }

  /**
   * 批量应用规则到邮件列表
   */
  static async applyRulesToEmails(
    userId: string, 
    emails: EmailMessage[], 
    ruleIds?: string[]
  ): Promise<RuleExecutionResult[]> {
    const startTime = Date.now();
    const results: RuleExecutionResult[] = [];
    
    try {
      // 获取用户的活动规则
      let rules: FilterRule[];
      
      if (ruleIds && ruleIds.length > 0) {
        // 获取指定规则
        rules = [];
        for (const ruleId of ruleIds) {
          const rule = await FilterRuleModel.findById(ruleId, userId);
          if (rule) {
            rules.push(rule);
          }
        }
      } else {
        // 获取所有活动规则
        rules = await FilterRuleModel.getActiveRules(userId);
      }

      if (rules.length === 0) {
        logger.info('No active rules found', { userId });
        return results;
      }

      // 按优先级排序规则
      rules.sort((a, b) => a.priority - b.priority);

      // 为每封邮件应用规则
      for (const email of emails) {
        for (const rule of rules) {
          const ruleResult = await this.executeRule(rule, email);
          results.push(ruleResult);
          
          // 如果规则匹配且包含停止处理的动作，停止后续规则的处理
          if (ruleResult.matched && this.shouldStopProcessing(rule)) {
            break;
          }
        }
      }

      logger.info('Batch rule application completed', {
        userId,
        emailCount: emails.length,
        ruleCount: rules.length,
        totalResults: results.length,
        executionTime: Date.now() - startTime
      });

      return results;

    } catch (error) {
      logger.error('Failed to apply rules to emails', { userId, error });
      return results;
    }
  }

  /**
   * 检查规则是否应该停止处理后续规则
   */
  private static shouldStopProcessing(rule: FilterRule): boolean {
    // 检查是否有停止后续处理的动作
    return rule.actions.some(action => {
      return ['delete_message', 'move_to_folder'].includes(action.type) &&
             action.parameters.stopProcessing === true;
    });
  }

  /**
   * 获取用户规则的缓存版本
   */
  static async getCachedActiveRules(userId: string): Promise<FilterRule[]> {
    const cacheKey = `${this.CACHE_PREFIX}active:${userId}`;
    
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const rules = await FilterRuleModel.getActiveRules(userId);
      await cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(rules));
      
      return rules;
    } catch (error) {
      logger.error('Failed to get cached rules', { userId, error });
      return await FilterRuleModel.getActiveRules(userId);
    }
  }

  /**
   * 清除用户规则缓存
   */
  static async clearUserRuleCache(userId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}active:${userId}`;
    
    try {
      await cache.delete(cacheKey);
      logger.info('User rule cache cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear rule cache', { userId, error });
    }
  }

  /**
   * 验证规则配置
   */
  static validateRule(rule: Partial<FilterRule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    if (!rule.actions || rule.actions.length === 0) {
      errors.push('At least one action is required');
    }

    if (rule.logicOperator && !['AND', 'OR'].includes(rule.logicOperator)) {
      errors.push('Logic operator must be AND or OR');
    }

    // 验证条件
    if (rule.conditions) {
      rule.conditions.forEach((condition, index) => {
        if (!condition.field) {
          errors.push(`Condition ${index + 1}: Field is required`);
        }
        if (!condition.operator) {
          errors.push(`Condition ${index + 1}: Operator is required`);
        }
        if (condition.value === undefined || condition.value === null) {
          errors.push(`Condition ${index + 1}: Value is required`);
        }
      });
    }

    // 验证动作
    if (rule.actions) {
      rule.actions.forEach((action, index) => {
        if (!action.type) {
          errors.push(`Action ${index + 1}: Type is required`);
        }
        
        // 根据动作类型验证参数
        switch (action.type) {
          case 'add_tag':
          case 'remove_tag':
            if (!action.parameters?.tags || !Array.isArray(action.parameters.tags)) {
              errors.push(`Action ${index + 1}: Tags parameter must be an array`);
            }
            break;
          case 'move_to_folder':
          case 'copy_to_folder':
            if (!action.parameters?.folderId) {
              errors.push(`Action ${index + 1}: FolderId parameter is required`);
            }
            break;
          case 'forward':
            if (!action.parameters?.recipients || !Array.isArray(action.parameters.recipients)) {
              errors.push(`Action ${index + 1}: Recipients parameter must be an array`);
            }
            break;
          case 'create_task':
            if (!action.parameters?.title) {
              errors.push(`Action ${index + 1}: Title parameter is required`);
            }
            break;
          case 'send_notification':
            if (!action.parameters?.message) {
              errors.push(`Action ${index + 1}: Message parameter is required`);
            }
            break;
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
}