import { Pool } from 'pg';
import { NotificationRule, EmailMessage } from '../types';
import { UnifiedCacheManager } from './UnifiedCacheManager';
import { NotificationService } from './NotificationService';
import * as cron from 'node-cron';

export interface RuleEvaluationContext {
  emailMessage?: EmailMessage;
  analysisResult?: any;
  systemEvent?: {
    type: string;
    data: any;
  };
  userContext?: {
    userId: string;
    timezone: string;
    workingHours: {
      start: string;
      end: string;
    };
  };
}

export interface RuleMatchResult {
  matched: boolean;
  matchedTriggers: any[];
  evaluationTime: number;
  context: RuleEvaluationContext;
}

export class NotificationRuleEngine {
  private db: Pool;
  private cache: UnifiedCacheManager;
  private notificationService: NotificationService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    db: Pool, 
    cache: UnifiedCacheManager, 
    notificationService: NotificationService
  ) {
    this.db = db;
    this.cache = cache;
    this.notificationService = notificationService;
    
    // Initialize scheduled tasks
    this.initializeScheduledRules();
  }

  /**
   * Evaluate rules against email analysis results
   */
  async evaluateEmailAnalysisRules(
    userId: string,
    emailMessage: EmailMessage,
    analysisResult: any
  ): Promise<RuleMatchResult[]> {
    try {
      const startTime = Date.now();
      
      // Get user's active notification rules
      const rules = await this.getUserActiveRules(userId);
      
      // Filter rules that have email analysis triggers
      const emailAnalysisRules = rules.filter(rule =>
        rule.triggers.some(trigger => trigger.type === 'email_analysis')
      );

      const results: RuleMatchResult[] = [];

      for (const rule of emailAnalysisRules) {
        const result = await this.evaluateRuleForEmailAnalysis(
          rule,
          emailMessage,
          analysisResult
        );
        
        if (result.matched) {
          results.push(result);
          
          // Update rule statistics
          await this.updateRuleStats(rule.id, true);
          
          // Trigger notifications for matched rule
          await this.triggerNotificationsForRule(rule, result.context);
        } else {
          await this.updateRuleStats(rule.id, false);
        }
      }

      const evaluationTime = Date.now() - startTime;
      console.log(`Evaluated ${emailAnalysisRules.length} email analysis rules in ${evaluationTime}ms`);

      return results;
    } catch (error) {
      console.error('Error evaluating email analysis rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate rules for filter rule execution
   */
  async evaluateFilterRuleRules(
    userId: string,
    ruleId: string,
    emailMessage: EmailMessage,
    executionResult: any
  ): Promise<RuleMatchResult[]> {
    try {
      const rules = await this.getUserActiveRules(userId);
      
      // Filter rules that have filter rule triggers
      const filterRuleRules = rules.filter(rule =>
        rule.triggers.some(trigger => 
          trigger.type === 'filter_rule' && 
          trigger.conditions.ruleIds?.includes(ruleId)
        )
      );

      const results: RuleMatchResult[] = [];

      for (const rule of filterRuleRules) {
        const result = await this.evaluateRuleForFilterRule(
          rule,
          ruleId,
          emailMessage,
          executionResult
        );
        
        if (result.matched) {
          results.push(result);
          await this.triggerNotificationsForRule(rule, result.context);
        }
      }

      return results;
    } catch (error) {
      console.error('Error evaluating filter rule rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate rules for system events
   */
  async evaluateSystemEventRules(
    eventType: string,
    eventData: any,
    affectedUserId?: string
  ): Promise<RuleMatchResult[]> {
    try {
      let rules: NotificationRule[] = [];

      if (affectedUserId) {
        // Get rules for specific user
        rules = await this.getUserActiveRules(affectedUserId);
      } else {
        // Get all active system rules for global events
        rules = await this.getAllActiveRules();
      }

      const systemEventRules = rules.filter(rule =>
        rule.triggers.some(trigger => 
          trigger.type === 'system_event' &&
          trigger.conditions.eventTypes?.includes(eventType)
        )
      );

      const results: RuleMatchResult[] = [];

      for (const rule of systemEventRules) {
        const result = await this.evaluateRuleForSystemEvent(
          rule,
          eventType,
          eventData
        );
        
        if (result.matched) {
          results.push(result);
          await this.triggerNotificationsForRule(rule, result.context);
        }
      }

      return results;
    } catch (error) {
      console.error('Error evaluating system event rules:', error);
      throw error;
    }
  }

  /**
   * Initialize scheduled notification rules
   */
  private async initializeScheduledRules(): Promise<void> {
    try {
      const scheduledRules = await this.getScheduledRules();
      
      for (const rule of scheduledRules) {
        await this.scheduleRule(rule);
      }

      console.log(`Initialized ${scheduledRules.length} scheduled notification rules`);
    } catch (error) {
      console.error('Error initializing scheduled rules:', error);
    }
  }

  /**
   * Schedule a time-based rule
   */
  private async scheduleRule(rule: NotificationRule): Promise<void> {
    try {
      for (const trigger of rule.triggers) {
        if (trigger.type === 'time_based' && trigger.conditions.schedule) {
          const schedule = trigger.conditions.schedule;
          
          if (schedule.type === 'cron') {
            const task = cron.schedule(
              schedule.expression,
              async () => {
                console.log(`Executing scheduled rule: ${rule.name}`);
                
                try {
                  const context: RuleEvaluationContext = {
                    userContext: {
                      userId: rule.userId,
                      timezone: schedule.timezone || 'UTC',
                      workingHours: {
                        start: '09:00',
                        end: '17:00'
                      }
                    }
                  };

                  await this.triggerNotificationsForRule(rule, context);
                  await this.updateRuleStats(rule.id, true);
                } catch (error) {
                  console.error(`Error executing scheduled rule ${rule.id}:`, error);
                  await this.updateRuleStats(rule.id, false);
                }
              },
              {
                scheduled: true,
                timezone: schedule.timezone || 'UTC'
              }
            );

            this.scheduledJobs.set(rule.id, task);
            console.log(`Scheduled rule ${rule.name} with cron: ${schedule.expression}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error scheduling rule ${rule.id}:`, error);
    }
  }

  /**
   * Unschedule a rule
   */
  async unscheduleRule(ruleId: string): Promise<void> {
    const task = this.scheduledJobs.get(ruleId);
    if (task) {
      task.stop();
      task.destroy();
      this.scheduledJobs.delete(ruleId);
      console.log(`Unscheduled rule ${ruleId}`);
    }
  }

  /**
   * Update rule when it changes
   */
  async updateScheduledRule(rule: NotificationRule): Promise<void> {
    // Unschedule existing task
    await this.unscheduleRule(rule.id);
    
    // Schedule new task if rule is active and has time-based triggers
    if (rule.isEnabled) {
      await this.scheduleRule(rule);
    }
  }

  // =============================================
  // Private Evaluation Methods
  // =============================================

  private async evaluateRuleForEmailAnalysis(
    rule: NotificationRule,
    emailMessage: EmailMessage,
    analysisResult: any
  ): Promise<RuleMatchResult> {
    const startTime = Date.now();
    const matchedTriggers: any[] = [];
    
    try {
      for (const trigger of rule.triggers) {
        if (trigger.type !== 'email_analysis') continue;
        
        const conditions = trigger.conditions;
        let triggerMatched = true;
        
        // Check analysis type requirements
        if (conditions.analysisTypes) {
          const hasRequiredAnalysis = conditions.analysisTypes.some(type => {
            switch (type) {
              case 'sentiment':
                return analysisResult.sentiment_score !== undefined &&
                       this.checkThreshold(analysisResult.sentiment_score, conditions.sentimentThreshold, 'sentiment');
              case 'priority':
                return analysisResult.priority_score !== undefined &&
                       this.checkThreshold(analysisResult.priority_score, conditions.priorityThreshold, 'priority');
              case 'category':
                return conditions.categories?.includes(analysisResult.category);
              default:
                return false;
            }
          });
          
          if (!hasRequiredAnalysis) {
            triggerMatched = false;
          }
        }

        // Check additional filters
        if (triggerMatched && conditions.additionalFilters) {
          triggerMatched = await this.evaluateAdditionalFilters(
            conditions.additionalFilters,
            emailMessage
          );
        }

        if (triggerMatched) {
          matchedTriggers.push(trigger);
        }
      }

      const evaluationTime = Date.now() - startTime;
      const matched = matchedTriggers.length > 0;

      return {
        matched,
        matchedTriggers,
        evaluationTime,
        context: {
          emailMessage,
          analysisResult,
          userContext: {
            userId: rule.userId,
            timezone: 'UTC',
            workingHours: { start: '09:00', end: '17:00' }
          }
        }
      };
    } catch (error) {
      console.error('Error evaluating email analysis rule:', error);
      return {
        matched: false,
        matchedTriggers: [],
        evaluationTime: Date.now() - startTime,
        context: {}
      };
    }
  }

  private async evaluateRuleForFilterRule(
    rule: NotificationRule,
    triggeredRuleId: string,
    emailMessage: EmailMessage,
    executionResult: any
  ): Promise<RuleMatchResult> {
    const startTime = Date.now();
    const matchedTriggers: any[] = [];

    try {
      for (const trigger of rule.triggers) {
        if (trigger.type !== 'filter_rule') continue;
        
        const conditions = trigger.conditions;
        let triggerMatched = false;
        
        // Check if the triggered rule is in the list
        if (conditions.ruleIds?.includes(triggeredRuleId)) {
          triggerMatched = true;
        }

        // Check additional filters
        if (triggerMatched && conditions.additionalFilters) {
          triggerMatched = await this.evaluateAdditionalFilters(
            conditions.additionalFilters,
            emailMessage
          );
        }

        if (triggerMatched) {
          matchedTriggers.push(trigger);
        }
      }

      return {
        matched: matchedTriggers.length > 0,
        matchedTriggers,
        evaluationTime: Date.now() - startTime,
        context: {
          emailMessage,
          userContext: {
            userId: rule.userId,
            timezone: 'UTC',
            workingHours: { start: '09:00', end: '17:00' }
          }
        }
      };
    } catch (error) {
      console.error('Error evaluating filter rule:', error);
      return {
        matched: false,
        matchedTriggers: [],
        evaluationTime: Date.now() - startTime,
        context: {}
      };
    }
  }

  private async evaluateRuleForSystemEvent(
    rule: NotificationRule,
    eventType: string,
    eventData: any
  ): Promise<RuleMatchResult> {
    const startTime = Date.now();
    const matchedTriggers: any[] = [];

    try {
      for (const trigger of rule.triggers) {
        if (trigger.type !== 'system_event') continue;
        
        const conditions = trigger.conditions;
        let triggerMatched = false;
        
        // Check if event type matches
        if (conditions.eventTypes?.includes(eventType)) {
          triggerMatched = true;
        }

        if (triggerMatched) {
          matchedTriggers.push(trigger);
        }
      }

      return {
        matched: matchedTriggers.length > 0,
        matchedTriggers,
        evaluationTime: Date.now() - startTime,
        context: {
          systemEvent: {
            type: eventType,
            data: eventData
          },
          userContext: {
            userId: rule.userId,
            timezone: 'UTC',
            workingHours: { start: '09:00', end: '17:00' }
          }
        }
      };
    } catch (error) {
      console.error('Error evaluating system event rule:', error);
      return {
        matched: false,
        matchedTriggers: [],
        evaluationTime: Date.now() - startTime,
        context: {}
      };
    }
  }

  private async evaluateAdditionalFilters(
    filters: any,
    emailMessage: EmailMessage
  ): Promise<boolean> {
    try {
      // Check sender domains
      if (filters.senderDomains && filters.senderDomains.length > 0) {
        const senderDomain = emailMessage.sender.address.split('@')[1];
        if (!filters.senderDomains.some((domain: string) => 
          senderDomain.includes(domain.replace('@', ''))
        )) {
          return false;
        }
      }

      // Check subject keywords
      if (filters.subjectKeywords && filters.subjectKeywords.length > 0) {
        const hasKeyword = filters.subjectKeywords.some((keyword: string) =>
          emailMessage.subject.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasKeyword) {
          return false;
        }
      }

      // Check time range
      if (filters.timeRange) {
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        
        const startTime = this.parseTime(filters.timeRange.start);
        const endTime = this.parseTime(filters.timeRange.end);
        
        if (currentTimeMinutes < startTime || currentTimeMinutes > endTime) {
          return false;
        }
      }

      // Check working days only
      if (filters.workingDaysOnly) {
        const currentDay = new Date().getDay();
        // 0 = Sunday, 6 = Saturday
        if (currentDay === 0 || currentDay === 6) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error evaluating additional filters:', error);
      return false;
    }
  }

  private checkThreshold(value: number, threshold?: number, type?: string): boolean {
    if (threshold === undefined) return true;
    
    switch (type) {
      case 'sentiment':
        // Negative sentiment threshold (trigger on negative sentiment)
        return threshold < 0 ? value <= threshold : value >= threshold;
      case 'priority':
        // Priority threshold (trigger on high priority)
        return value >= threshold;
      default:
        return value >= threshold;
    }
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async triggerNotificationsForRule(
    rule: NotificationRule,
    context: RuleEvaluationContext
  ): Promise<void> {
    try {
      // Prepare notification data
      const notificationData = {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        timestamp: new Date(),
        context
      };

      // Check throttling for each action
      for (const action of rule.actions) {
        if (!action.isEnabled) continue;

        const canTrigger = await this.checkActionThrottling(rule.id, action);
        if (!canTrigger) {
          console.log(`Action throttled for rule ${rule.id}`);
          continue;
        }

        // Trigger notification
        await this.notificationService.triggerNotification({
          type: 'filter_rule', // This will be mapped to the appropriate trigger type
          userId: rule.userId,
          data: notificationData,
          sourceId: context.emailMessage?.id,
          priority: rule.priority
        });

        // Update throttling tracking
        await this.updateActionThrottling(rule.id, action);
      }
    } catch (error) {
      console.error('Error triggering notifications for rule:', error);
    }
  }

  // =============================================
  // Database Operations
  // =============================================

  private async getUserActiveRules(userId: string): Promise<NotificationRule[]> {
    const cacheKey = `notification:rules:active:${userId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT * FROM notification_rules 
        WHERE user_id = $1 AND is_enabled = true 
        ORDER BY priority DESC, created_at DESC
      `;
      const result = await client.query(query, [userId]);
      const rules = result.rows.map(row => this.mapDbRowToRule(row));

      // Cache for 10 minutes
      await this.cache.set(cacheKey, JSON.stringify(rules), { ttl: 600 });
      
      return rules;
    } catch (error) {
      console.error('Error getting user active rules:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getAllActiveRules(): Promise<NotificationRule[]> {
    const cacheKey = 'notification:rules:all:active';
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT * FROM notification_rules 
        WHERE is_enabled = true 
        ORDER BY priority DESC, created_at DESC
      `;
      const result = await client.query(query);
      const rules = result.rows.map(row => this.mapDbRowToRule(row));

      // Cache for 10 minutes
      await this.cache.set(cacheKey, JSON.stringify(rules), { ttl: 600 });
      
      return rules;
    } catch (error) {
      console.error('Error getting all active rules:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getScheduledRules(): Promise<NotificationRule[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT * FROM notification_rules 
        WHERE is_enabled = true 
        AND triggers::text LIKE '%"type":"time_based"%'
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);
      return result.rows.map(row => this.mapDbRowToRule(row));
    } catch (error) {
      console.error('Error getting scheduled rules:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateRuleStats(ruleId: string, matched: boolean): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const updateClause = matched 
        ? 'trigger_count = trigger_count + 1, execution_count = execution_count + 1, last_triggered_at = NOW()'
        : 'execution_count = execution_count + 1';

      const query = `
        UPDATE notification_rules 
        SET ${updateClause}, updated_at = NOW()
        WHERE id = $1
      `;
      await client.query(query, [ruleId]);
    } catch (error) {
      console.error('Error updating rule stats:', error);
    } finally {
      client.release();
    }
  }

  private async checkActionThrottling(ruleId: string, action: any): Promise<boolean> {
    if (!action.throttling) return true;

    const client = await this.db.connect();
    
    try {
      const throttling = action.throttling;
      const now = new Date();
      
      // Check hourly limit
      if (throttling.maxPerHour) {
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const query = `
          SELECT COUNT(*) as count 
          FROM notifications 
          WHERE rule_id = $1 AND channel_id = $2 
          AND created_at > $3
        `;
        const result = await client.query(query, [ruleId, action.channelId, hourAgo]);
        const hourlyCount = parseInt(result.rows[0].count);
        
        if (hourlyCount >= throttling.maxPerHour) {
          return false;
        }
      }

      // Check daily limit
      if (throttling.maxPerDay) {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const query = `
          SELECT COUNT(*) as count 
          FROM notifications 
          WHERE rule_id = $1 AND channel_id = $2 
          AND created_at > $3
        `;
        const result = await client.query(query, [ruleId, action.channelId, dayAgo]);
        const dailyCount = parseInt(result.rows[0].count);
        
        if (dailyCount >= throttling.maxPerDay) {
          return false;
        }
      }

      // Check cooldown
      if (throttling.cooldownMinutes) {
        const cooldownAgo = new Date(now.getTime() - throttling.cooldownMinutes * 60 * 1000);
        const query = `
          SELECT COUNT(*) as count 
          FROM notifications 
          WHERE rule_id = $1 AND channel_id = $2 
          AND created_at > $3
        `;
        const result = await client.query(query, [ruleId, action.channelId, cooldownAgo]);
        const recentCount = parseInt(result.rows[0].count);
        
        if (recentCount > 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking action throttling:', error);
      return true; // Allow on error
    } finally {
      client.release();
    }
  }

  private async updateActionThrottling(ruleId: string, action: any): Promise<void> {
    // This is handled by the notification creation in the database
    // No additional tracking needed for basic throttling
  }

  private mapDbRowToRule(row: any): NotificationRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isEnabled: row.is_enabled,
      priority: row.priority,
      triggers: JSON.parse(row.triggers),
      actions: JSON.parse(row.actions),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Stop all scheduled jobs
    for (const [ruleId, task] of this.scheduledJobs.entries()) {
      task.stop();
      task.destroy();
    }
    this.scheduledJobs.clear();
    
    console.log('Notification rule engine cleaned up');
  }
}