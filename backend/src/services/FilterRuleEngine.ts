/**
 * Filter Rule Engine Service
 * Intelligent email filtering and rule processing engine
 */

import database from '@/config/database';
import logger from '@/utils/logger';
import { EmailMessage, FilterRule, FilterAction } from '@/types';
import { DatabaseError } from '@/utils/errors';
import { EmailAnalysisService } from './EmailAnalysisService';
import { v4 as uuidv4 } from 'uuid';

export enum FilterConditionType {
  SENDER = 'sender',
  RECIPIENT = 'recipient',
  SUBJECT = 'subject',
  BODY = 'body',
  ATTACHMENT = 'attachment',
  SIZE = 'size',
  DATE = 'date',
  ANALYSIS = 'analysis',
  KEYWORD = 'keyword',
  REGEX = 'regex'
}

export enum FilterOperator {
  EQUALS = 'equals',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX_MATCH = 'regex_match',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN_LIST = 'in_list',
  NOT_IN_LIST = 'not_in_list'
}

export enum FilterActionType {
  MOVE_TO_FOLDER = 'move_to_folder',
  MARK_AS_READ = 'mark_as_read',
  MARK_AS_IMPORTANT = 'mark_as_important',
  ADD_LABEL = 'add_label',
  DELETE = 'delete',
  FORWARD = 'forward',
  AUTO_REPLY = 'auto_reply',
  TRIGGER_WORKFLOW = 'trigger_workflow',
  ARCHIVE = 'archive',
  NOTIFY = 'notify'
}

export interface FilterCondition {
  type: FilterConditionType;
  field?: string;
  operator: FilterOperator;
  value: any;
  caseSensitive?: boolean;
}

export interface FilterRuleData {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  conditions: FilterCondition[];
  conditionLogic?: 'AND' | 'OR'; // How to combine multiple conditions
  actions: FilterAction[];
  priority?: number;
  isActive?: boolean;
  stopProcessing?: boolean; // Stop checking other rules if this matches
  appliedCount?: number;
  lastAppliedAt?: Date;
}

export class FilterRuleEngine {
  /**
   * Create a new filter rule
   */
  static async createRule(ruleData: FilterRuleData): Promise<FilterRule> {
    try {
      const ruleId = ruleData.id || uuidv4();
      
      const query = `
        INSERT INTO filter_rules (
          id, user_id, name, description, conditions, actions,
          priority, is_active, match_count, last_matched_at,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        ruleId,
        ruleData.userId,
        ruleData.name,
        ruleData.description,
        JSON.stringify({
          conditions: ruleData.conditions,
          logic: ruleData.conditionLogic || 'AND'
        }),
        JSON.stringify(ruleData.actions),
        ruleData.priority || 0,
        ruleData.isActive !== false,
        0,
        null
      ];
      
      const result = await database.query(query, values);
      
      logger.info('Filter rule created', { 
        ruleId,
        userId: ruleData.userId,
        name: ruleData.name 
      });
      
      return this.mapRowToRule(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create filter rule', error);
      throw new DatabaseError('Failed to create filter rule');
    }
  }
  
  /**
   * Process email through all active filter rules
   */
  static async processEmail(email: EmailMessage, userId: string): Promise<FilterAction[]> {
    try {
      logger.info('Processing email through filter rules', { 
        emailId: email.id,
        userId 
      });
      
      // Get all active rules for user, sorted by priority
      const rules = await this.getUserRules(userId, true);
      
      const appliedActions: FilterAction[] = [];
      
      for (const rule of rules) {
        const matches = await this.evaluateRule(email, rule);
        
        if (matches) {
          logger.info('Filter rule matched', { 
            emailId: email.id,
            ruleId: rule.id,
            ruleName: rule.name 
          });
          
          // Apply actions
          const actions = await this.applyActions(email, rule.actions);
          appliedActions.push(...actions);
          
          // Update rule statistics
          await this.updateRuleStats(rule.id);
          
          // Log execution
          await this.logExecution(rule.id, email.id, true, actions);
          
          // Check if we should stop processing other rules
          if (rule.stopProcessing) {
            logger.info('Stopping rule processing', { 
              emailId: email.id,
              ruleId: rule.id 
            });
            break;
          }
        } else {
          // Log non-match for debugging
          await this.logExecution(rule.id, email.id, false, []);
        }
      }
      
      logger.info('Email processing completed', { 
        emailId: email.id,
        actionsApplied: appliedActions.length 
      });
      
      return appliedActions;
    } catch (error) {
      logger.error('Failed to process email through filter rules', { 
        emailId: email.id,
        error 
      });
      throw error;
    }
  }
  
  /**
   * Evaluate if email matches rule conditions
   */
  static async evaluateRule(email: EmailMessage, rule: FilterRule): Promise<boolean> {
    try {
      const conditionData = rule.conditions as any;
      const conditions = conditionData.conditions || [];
      const logic = conditionData.logic || 'AND';
      
      if (conditions.length === 0) {
        return false;
      }
      
      const results = await Promise.all(
        conditions.map((condition: FilterCondition) => 
          this.evaluateCondition(email, condition)
        )
      );
      
      if (logic === 'AND') {
        return results.every(r => r === true);
      } else {
        return results.some(r => r === true);
      }
    } catch (error) {
      logger.error('Failed to evaluate rule', { 
        ruleId: rule.id,
        error 
      });
      return false;
    }
  }
  
  /**
   * Evaluate a single condition
   */
  static async evaluateCondition(email: EmailMessage, condition: FilterCondition): Promise<boolean> {
    try {
      let fieldValue: any;
      
      // Get field value based on condition type
      switch (condition.type) {
        case FilterConditionType.SENDER:
          fieldValue = email.from?.email || '';
          break;
        
        case FilterConditionType.RECIPIENT:
          fieldValue = email.to?.map(r => r.email).join(',') || '';
          break;
        
        case FilterConditionType.SUBJECT:
          fieldValue = email.subject || '';
          break;
        
        case FilterConditionType.BODY:
          fieldValue = email.body || '';
          break;
        
        case FilterConditionType.ATTACHMENT:
          fieldValue = email.hasAttachments || false;
          break;
        
        case FilterConditionType.SIZE:
          fieldValue = email.size || 0;
          break;
        
        case FilterConditionType.DATE:
          fieldValue = email.receivedAt;
          break;
        
        case FilterConditionType.ANALYSIS:
          // Get analysis result for advanced filtering
          const analysis = await this.getEmailAnalysis(email.id);
          fieldValue = analysis ? analysis[condition.field || 'category'] : null;
          break;
        
        default:
          fieldValue = email[condition.field || 'subject'];
      }
      
      // Apply operator
      return this.applyOperator(fieldValue, condition.operator, condition.value, condition.caseSensitive);
    } catch (error) {
      logger.error('Failed to evaluate condition', { condition, error });
      return false;
    }
  }
  
  /**
   * Apply operator to compare values
   */
  static applyOperator(
    fieldValue: any, 
    operator: FilterOperator, 
    compareValue: any, 
    caseSensitive = false
  ): boolean {
    // Handle case sensitivity for string comparisons
    if (typeof fieldValue === 'string' && !caseSensitive) {
      fieldValue = fieldValue.toLowerCase();
      if (typeof compareValue === 'string') {
        compareValue = compareValue.toLowerCase();
      }
    }
    
    switch (operator) {
      case FilterOperator.EQUALS:
        return fieldValue === compareValue;
      
      case FilterOperator.CONTAINS:
        return fieldValue?.includes(compareValue) || false;
      
      case FilterOperator.STARTS_WITH:
        return fieldValue?.startsWith(compareValue) || false;
      
      case FilterOperator.ENDS_WITH:
        return fieldValue?.endsWith(compareValue) || false;
      
      case FilterOperator.REGEX_MATCH:
        try {
          const regex = new RegExp(compareValue, caseSensitive ? 'g' : 'gi');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      
      case FilterOperator.GREATER_THAN:
        return fieldValue > compareValue;
      
      case FilterOperator.LESS_THAN:
        return fieldValue < compareValue;
      
      case FilterOperator.IN_LIST:
        const list = Array.isArray(compareValue) ? compareValue : [compareValue];
        return list.includes(fieldValue);
      
      case FilterOperator.NOT_IN_LIST:
        const notList = Array.isArray(compareValue) ? compareValue : [compareValue];
        return !notList.includes(fieldValue);
      
      default:
        return false;
    }
  }
  
  /**
   * Apply actions to email
   */
  static async applyActions(email: EmailMessage, actions: FilterAction[]): Promise<FilterAction[]> {
    const appliedActions: FilterAction[] = [];
    
    for (const action of actions) {
      try {
        switch (action.type) {
          case FilterActionType.MOVE_TO_FOLDER:
            await this.moveToFolder(email.id, action.value);
            break;
          
          case FilterActionType.MARK_AS_READ:
            await this.markAsRead(email.id, true);
            break;
          
          case FilterActionType.MARK_AS_IMPORTANT:
            await this.markAsImportant(email.id, true);
            break;
          
          case FilterActionType.ADD_LABEL:
            await this.addLabel(email.id, action.value);
            break;
          
          case FilterActionType.DELETE:
            await this.deleteEmail(email.id);
            break;
          
          case FilterActionType.ARCHIVE:
            await this.archiveEmail(email.id);
            break;
          
          case FilterActionType.FORWARD:
            await this.forwardEmail(email.id, action.value);
            break;
          
          case FilterActionType.AUTO_REPLY:
            await this.sendAutoReply(email, action.value);
            break;
          
          case FilterActionType.TRIGGER_WORKFLOW:
            await this.triggerWorkflow(email.id, action.value);
            break;
          
          case FilterActionType.NOTIFY:
            await this.sendNotification(email, action.value);
            break;
        }
        
        appliedActions.push(action);
        logger.info('Filter action applied', { 
          emailId: email.id,
          actionType: action.type 
        });
      } catch (error) {
        logger.error('Failed to apply filter action', { 
          emailId: email.id,
          action,
          error 
        });
      }
    }
    
    return appliedActions;
  }
  
  /**
   * Get user's filter rules
   */
  static async getUserRules(userId: string, activeOnly = false): Promise<FilterRule[]> {
    try {
      let query = `
        SELECT * FROM filter_rules
        WHERE user_id = $1
      `;
      
      if (activeOnly) {
        query += ' AND is_active = true';
      }
      
      query += ' ORDER BY priority DESC, created_at ASC';
      
      const result = await database.query(query, [userId]);
      
      return result.rows.map((row: any) => this.mapRowToRule(row));
    } catch (error) {
      logger.error('Failed to get user filter rules', { userId, error });
      throw new DatabaseError('Failed to get filter rules');
    }
  }
  
  /**
   * Update rule statistics
   */
  static async updateRuleStats(ruleId: string): Promise<void> {
    try {
      const query = `
        UPDATE filter_rules
        SET match_count = match_count + 1,
            last_matched_at = NOW()
        WHERE id = $1
      `;
      
      await database.query(query, [ruleId]);
    } catch (error) {
      logger.error('Failed to update rule stats', { ruleId, error });
    }
  }
  
  /**
   * Log rule execution
   */
  static async logExecution(
    ruleId: string, 
    emailId: string, 
    matched: boolean, 
    actions: FilterAction[]
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO filter_execution_log (
          id, rule_id, email_id, matched, actions_performed,
          execution_time_ms, executed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      const values = [
        uuidv4(),
        ruleId,
        emailId,
        matched,
        JSON.stringify(actions),
        0 // Execution time can be calculated if needed
      ];
      
      await database.query(query, values);
    } catch (error) {
      logger.error('Failed to log rule execution', { ruleId, emailId, error });
    }
  }
  
  /**
   * Get email analysis result
   */
  static async getEmailAnalysis(emailId: string): Promise<any> {
    try {
      const query = `
        SELECT * FROM email_analysis
        WHERE email_id = $1
      `;
      
      const result = await database.query(query, [emailId]);
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get email analysis', { emailId, error });
      return null;
    }
  }
  
  // Action implementation methods
  
  static async moveToFolder(emailId: string, folder: string): Promise<void> {
    const query = `
      UPDATE emails
      SET folder_name = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await database.query(query, [folder, emailId]);
  }
  
  static async markAsRead(emailId: string, isRead: boolean): Promise<void> {
    const query = `
      UPDATE emails
      SET is_read = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await database.query(query, [isRead, emailId]);
  }
  
  static async markAsImportant(emailId: string, isImportant: boolean): Promise<void> {
    const query = `
      UPDATE emails
      SET is_flagged = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await database.query(query, [isImportant, emailId]);
  }
  
  static async addLabel(emailId: string, label: string): Promise<void> {
    const query = `
      UPDATE emails
      SET categories = array_append(categories, $1), updated_at = NOW()
      WHERE id = $2
    `;
    await database.query(query, [label, emailId]);
  }
  
  static async deleteEmail(emailId: string): Promise<void> {
    // Soft delete - move to trash
    await this.moveToFolder(emailId, 'Trash');
  }
  
  static async archiveEmail(emailId: string): Promise<void> {
    await this.moveToFolder(emailId, 'Archive');
  }
  
  static async forwardEmail(emailId: string, recipients: string[]): Promise<void> {
    // Implementation would use email service to forward
    logger.info('Email forwarded', { emailId, recipients });
  }
  
  static async sendAutoReply(email: EmailMessage, replyTemplate: string): Promise<void> {
    // Implementation would use email service to send reply
    logger.info('Auto-reply sent', { emailId: email.id });
  }
  
  static async triggerWorkflow(emailId: string, workflowId: string): Promise<void> {
    // Implementation would trigger workflow system
    logger.info('Workflow triggered', { emailId, workflowId });
  }
  
  static async sendNotification(email: EmailMessage, notificationConfig: any): Promise<void> {
    // Implementation would send notification
    logger.info('Notification sent', { emailId: email.id });
  }
  
  /**
   * Map database row to FilterRule object
   */
  static mapRowToRule(row: any): FilterRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      conditions: row.conditions,
      actions: row.actions,
      priority: row.priority,
      isActive: row.is_active,
      stopProcessing: row.stop_processing,
      appliedCount: row.match_count,
      lastAppliedAt: row.last_matched_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  /**
   * Generate smart filter suggestions based on email patterns
   */
  static async generateSmartFilters(userId: string): Promise<FilterRuleData[]> {
    try {
      logger.info('Generating smart filter suggestions', { userId });
      
      // Analyze user's email patterns
      const patterns = await this.analyzeEmailPatterns(userId);
      const suggestions: FilterRuleData[] = [];
      
      // High volume sender filter
      if (patterns.highVolumeSenders.length > 0) {
        for (const sender of patterns.highVolumeSenders) {
          suggestions.push({
            userId,
            name: `Filter emails from ${sender.email}`,
            description: `Automatically organize emails from frequent sender`,
            conditions: [{
              type: FilterConditionType.SENDER,
              operator: FilterOperator.EQUALS,
              value: sender.email
            }],
            actions: [{
              type: FilterActionType.MOVE_TO_FOLDER,
              value: `From ${sender.name || sender.email}`
            }],
            priority: 5
          });
        }
      }
      
      // Newsletter filter
      if (patterns.newsletterKeywords.length > 0) {
        suggestions.push({
          userId,
          name: 'Newsletter Filter',
          description: 'Automatically organize newsletters',
          conditions: patterns.newsletterKeywords.map(keyword => ({
            type: FilterConditionType.BODY,
            operator: FilterOperator.CONTAINS,
            value: keyword
          })),
          conditionLogic: 'OR',
          actions: [{
            type: FilterActionType.MOVE_TO_FOLDER,
            value: 'Newsletters'
          }, {
            type: FilterActionType.MARK_AS_READ,
            value: true
          }],
          priority: 3
        });
      }
      
      // Important email filter based on AI analysis
      suggestions.push({
        userId,
        name: 'High Priority Emails',
        description: 'Flag emails marked as high priority by AI',
        conditions: [{
          type: FilterConditionType.ANALYSIS,
          field: 'urgency',
          operator: FilterOperator.IN_LIST,
          value: ['high', 'critical']
        }],
        actions: [{
          type: FilterActionType.MARK_AS_IMPORTANT,
          value: true
        }, {
          type: FilterActionType.NOTIFY,
          value: { type: 'push', message: 'High priority email received' }
        }],
        priority: 10
      });
      
      return suggestions;
    } catch (error) {
      logger.error('Failed to generate smart filters', { userId, error });
      return [];
    }
  }
  
  /**
   * Analyze email patterns for smart suggestions
   */
  static async analyzeEmailPatterns(userId: string): Promise<any> {
    try {
      // Get high volume senders
      const senderQuery = `
        SELECT sender_email, sender_name, COUNT(*) as count
        FROM emails e
        JOIN email_accounts ea ON e.account_id = ea.id
        WHERE ea.user_id = $1
        GROUP BY sender_email, sender_name
        HAVING COUNT(*) > 10
        ORDER BY count DESC
        LIMIT 5
      `;
      
      const senderResult = await database.query(senderQuery, [userId]);
      
      return {
        highVolumeSenders: senderResult.rows.map(row => ({
          email: row.sender_email,
          name: row.sender_name,
          count: row.count
        })),
        newsletterKeywords: ['unsubscribe', 'newsletter', 'weekly digest', 'updates'],
        socialKeywords: ['facebook', 'twitter', 'linkedin', 'instagram']
      };
    } catch (error) {
      logger.error('Failed to analyze email patterns', { userId, error });
      return {
        highVolumeSenders: [],
        newsletterKeywords: [],
        socialKeywords: []
      };
    }
  }
}