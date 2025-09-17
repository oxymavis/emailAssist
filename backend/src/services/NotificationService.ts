import { Pool } from 'pg';
import { 
  INotificationService, 
  NotificationTemplate, 
  NotificationRule, 
  NotificationChannel, 
  NotificationPreference, 
  Notification, 
  NotificationStats,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  CreateNotificationRuleRequest,
  UpdateNotificationRuleRequest,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  UpdateNotificationPreferencesRequest
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { UnifiedCacheManager } from './UnifiedCacheManager';
import { TemplateEngine } from './TemplateEngine';
import { NotificationQueue } from './NotificationQueue';
import { NotificationChannelManager } from './NotificationChannelManager';

export class NotificationService implements INotificationService {
  private db: Pool;
  private cache: UnifiedCacheManager;
  private templateEngine: TemplateEngine;
  private queue: NotificationQueue;
  private channelManager: NotificationChannelManager;

  constructor(
    db: Pool, 
    cache: UnifiedCacheManager,
    templateEngine: TemplateEngine,
    queue: NotificationQueue,
    channelManager: NotificationChannelManager
  ) {
    this.db = db;
    this.cache = cache;
    this.templateEngine = templateEngine;
    this.queue = queue;
    this.channelManager = channelManager;
  }

  // =============================================
  // Template Management
  // =============================================

  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const client = await this.db.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notification_templates (
          id, name, description, category, channels, variables, 
          is_system, created_by, usage_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        id,
        template.name,
        template.description || null,
        template.category,
        JSON.stringify(template.channels),
        JSON.stringify(template.variables || []),
        template.isSystem || false,
        template.createdBy,
        0,
        now,
        now
      ];

      const result = await client.query(query, values);
      const createdTemplate = this.mapDbRowToTemplate(result.rows[0]);

      // Clear related cache
      await this.cache.delete('notification:templates:*');
      
      return createdTemplate;
    } catch (error) {
      console.error('Error creating notification template:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.channels !== undefined) {
        setClauses.push(`channels = $${paramIndex}`);
        values.push(JSON.stringify(updates.channels));
        paramIndex++;
      }

      if (updates.variables !== undefined) {
        setClauses.push(`variables = $${paramIndex}`);
        values.push(JSON.stringify(updates.variables));
        paramIndex++;
      }

      setClauses.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      values.push(id);

      const query = `
        UPDATE notification_templates 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Template with id ${id} not found`);
      }

      const updatedTemplate = this.mapDbRowToTemplate(result.rows[0]);

      // Clear related cache
      await this.cache.delete('notification:templates:*');
      await this.cache.delete(`notification:template:${id}`);
      
      return updatedTemplate;
    } catch (error) {
      console.error('Error updating notification template:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM notification_templates WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error(`Template with id ${id} not found`);
      }

      // Clear related cache
      await this.cache.delete('notification:templates:*');
      await this.cache.delete(`notification:template:${id}`);
    } catch (error) {
      console.error('Error deleting notification template:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemplate(id: string): Promise<NotificationTemplate | null> {
    const cacheKey = `notification:template:${id}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_templates WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const template = this.mapDbRowToTemplate(result.rows[0]);

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(template), { ttl: 3600 });
      
      return template;
    } catch (error) {
      console.error('Error getting notification template:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemplates(category?: NotificationTemplate['category']): Promise<NotificationTemplate[]> {
    const cacheKey = category 
      ? `notification:templates:category:${category}`
      : 'notification:templates:all';
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      let query = 'SELECT * FROM notification_templates';
      const values: any[] = [];

      if (category) {
        query += ' WHERE category = $1';
        values.push(category);
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, values);
      const templates = result.rows.map(row => this.mapDbRowToTemplate(row));

      // Cache for 30 minutes
      await this.cache.set(cacheKey, JSON.stringify(templates), { ttl: 1800 });
      
      return templates;
    } catch (error) {
      console.error('Error getting notification templates:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // Rule Management
  // =============================================

  async createRule(rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule> {
    const client = await this.db.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notification_rules (
          id, user_id, name, description, is_enabled, priority,
          triggers, actions, trigger_count, execution_count,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        id,
        rule.userId,
        rule.name,
        rule.description || null,
        rule.isEnabled !== undefined ? rule.isEnabled : true,
        rule.priority || 5,
        JSON.stringify(rule.triggers),
        JSON.stringify(rule.actions),
        0,
        0,
        now,
        now
      ];

      const result = await client.query(query, values);
      const createdRule = this.mapDbRowToRule(result.rows[0]);

      // Clear related cache
      await this.cache.delete(`notification:rules:user:${rule.userId}`);
      
      return createdRule;
    } catch (error) {
      console.error('Error creating notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRule(id: string, updates: Partial<NotificationRule>): Promise<NotificationRule> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.isEnabled !== undefined) {
        setClauses.push(`is_enabled = $${paramIndex}`);
        values.push(updates.isEnabled);
        paramIndex++;
      }

      if (updates.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex}`);
        values.push(updates.priority);
        paramIndex++;
      }

      if (updates.triggers !== undefined) {
        setClauses.push(`triggers = $${paramIndex}`);
        values.push(JSON.stringify(updates.triggers));
        paramIndex++;
      }

      if (updates.actions !== undefined) {
        setClauses.push(`actions = $${paramIndex}`);
        values.push(JSON.stringify(updates.actions));
        paramIndex++;
      }

      setClauses.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      values.push(id);

      const query = `
        UPDATE notification_rules 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Rule with id ${id} not found`);
      }

      const updatedRule = this.mapDbRowToRule(result.rows[0]);

      // Clear related cache
      await this.cache.delete(`notification:rules:user:${updatedRule.userId}`);
      
      return updatedRule;
    } catch (error) {
      console.error('Error updating notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteRule(id: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // First get the rule to clear user cache
      const getQuery = 'SELECT user_id FROM notification_rules WHERE id = $1';
      const getResult = await client.query(getQuery, [id]);
      
      if (getResult.rows.length === 0) {
        throw new Error(`Rule with id ${id} not found`);
      }

      const userId = getResult.rows[0].user_id;

      const deleteQuery = 'DELETE FROM notification_rules WHERE id = $1';
      await client.query(deleteQuery, [id]);

      // Clear related cache
      await this.cache.delete(`notification:rules:user:${userId}`);
    } catch (error) {
      console.error('Error deleting notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getRule(id: string): Promise<NotificationRule | null> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_rules WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToRule(result.rows[0]);
    } catch (error) {
      console.error('Error getting notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserRules(userId: string): Promise<NotificationRule[]> {
    const cacheKey = `notification:rules:user:${userId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT * FROM notification_rules 
        WHERE user_id = $1 
        ORDER BY priority DESC, created_at DESC
      `;
      const result = await client.query(query, [userId]);
      const rules = result.rows.map(row => this.mapDbRowToRule(row));

      // Cache for 30 minutes
      await this.cache.set(cacheKey, JSON.stringify(rules), { ttl: 1800 });
      
      return rules;
    } catch (error) {
      console.error('Error getting user notification rules:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // Channel Management
  // =============================================

  async createChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel> {
    const client = await this.db.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notification_channels (
          id, name, type, is_enabled, config, retry_config,
          total_notifications, successful_notifications, failed_notifications,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        id,
        channel.name,
        channel.type,
        channel.isEnabled !== undefined ? channel.isEnabled : true,
        JSON.stringify(channel.config),
        JSON.stringify(channel.retryConfig),
        0,
        0,
        0,
        now,
        now
      ];

      const result = await client.query(query, values);
      const createdChannel = this.mapDbRowToChannel(result.rows[0]);

      // Clear related cache
      await this.cache.delete('notification:channels:*');
      
      return createdChannel;
    } catch (error) {
      console.error('Error creating notification channel:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.isEnabled !== undefined) {
        setClauses.push(`is_enabled = $${paramIndex}`);
        values.push(updates.isEnabled);
        paramIndex++;
      }

      if (updates.config !== undefined) {
        setClauses.push(`config = $${paramIndex}`);
        values.push(JSON.stringify(updates.config));
        paramIndex++;
      }

      if (updates.retryConfig !== undefined) {
        setClauses.push(`retry_config = $${paramIndex}`);
        values.push(JSON.stringify(updates.retryConfig));
        paramIndex++;
      }

      setClauses.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      values.push(id);

      const query = `
        UPDATE notification_channels 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Channel with id ${id} not found`);
      }

      const updatedChannel = this.mapDbRowToChannel(result.rows[0]);

      // Clear related cache
      await this.cache.delete('notification:channels:*');
      
      return updatedChannel;
    } catch (error) {
      console.error('Error updating notification channel:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteChannel(id: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM notification_channels WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error(`Channel with id ${id} not found`);
      }

      // Clear related cache
      await this.cache.delete('notification:channels:*');
    } catch (error) {
      console.error('Error deleting notification channel:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getChannel(id: string): Promise<NotificationChannel | null> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_channels WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToChannel(result.rows[0]);
    } catch (error) {
      console.error('Error getting notification channel:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getChannels(): Promise<NotificationChannel[]> {
    const cacheKey = 'notification:channels:all';
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_channels ORDER BY created_at DESC';
      const result = await client.query(query);
      const channels = result.rows.map(row => this.mapDbRowToChannel(row));

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(channels), { ttl: 3600 });
      
      return channels;
    } catch (error) {
      console.error('Error getting notification channels:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // Preference Management
  // =============================================

  async getUserPreferences(userId: string): Promise<NotificationPreference | null> {
    const cacheKey = `notification:preferences:${userId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_preferences WHERE user_id = $1';
      const result = await client.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Create default preferences
        return await this.createDefaultPreferences(userId);
      }

      const preferences = this.mapDbRowToPreferences(result.rows[0]);

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(preferences), { ttl: 3600 });
      
      return preferences;
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const client = await this.db.connect();
    
    try {
      // First check if preferences exist
      const existsQuery = 'SELECT id FROM notification_preferences WHERE user_id = $1';
      const existsResult = await client.query(existsQuery, [userId]);

      let query: string;
      let values: any[];

      if (existsResult.rows.length === 0) {
        // Create new preferences
        const id = uuidv4();
        const now = new Date();
        
        query = `
          INSERT INTO notification_preferences (
            id, user_id, global_settings, channel_preferences, 
            category_preferences, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

        values = [
          id,
          userId,
          JSON.stringify(preferences.globalSettings || {}),
          JSON.stringify(preferences.channelPreferences || []),
          JSON.stringify(preferences.categoryPreferences || []),
          now,
          now
        ];
      } else {
        // Update existing preferences
        const setClauses: string[] = [];
        values = [];
        let paramIndex = 1;

        if (preferences.globalSettings !== undefined) {
          setClauses.push(`global_settings = $${paramIndex}`);
          values.push(JSON.stringify(preferences.globalSettings));
          paramIndex++;
        }

        if (preferences.channelPreferences !== undefined) {
          setClauses.push(`channel_preferences = $${paramIndex}`);
          values.push(JSON.stringify(preferences.channelPreferences));
          paramIndex++;
        }

        if (preferences.categoryPreferences !== undefined) {
          setClauses.push(`category_preferences = $${paramIndex}`);
          values.push(JSON.stringify(preferences.categoryPreferences));
          paramIndex++;
        }

        setClauses.push(`updated_at = $${paramIndex}`);
        values.push(new Date());
        paramIndex++;

        values.push(userId);

        query = `
          UPDATE notification_preferences 
          SET ${setClauses.join(', ')}
          WHERE user_id = $${paramIndex}
          RETURNING *
        `;
      }

      const result = await client.query(query, values);
      const updatedPreferences = this.mapDbRowToPreferences(result.rows[0]);

      // Clear cache
      await this.cache.delete(`notification:preferences:${userId}`);
      
      return updatedPreferences;
    } catch (error) {
      console.error('Error updating user notification preferences:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // Notification Processing
  // =============================================

  async triggerNotification(trigger: {
    type: NotificationRule['triggers'][0]['type'];
    userId: string;
    data: Record<string, any>;
    sourceId?: string;
    priority?: number;
  }): Promise<Notification[]> {
    try {
      // Get user's notification rules
      const rules = await this.getUserRules(trigger.userId);
      
      // Filter rules that match the trigger
      const matchingRules = await this.findMatchingRules(rules, trigger);
      
      const notifications: Notification[] = [];

      // Process each matching rule
      for (const rule of matchingRules) {
        const ruleNotifications = await this.createNotificationsFromRule(rule, trigger);
        notifications.push(...ruleNotifications);
      }

      // Queue notifications for processing
      for (const notification of notifications) {
        await this.queue.add(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error triggering notification:', error);
      throw error;
    }
  }

  async processNotification(notificationId: string): Promise<void> {
    try {
      const notification = await this.getNotificationById(notificationId);
      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Update status to processing
      await this.updateNotificationStatus(notificationId, 'processing');

      // Get channel and template
      const [channel, template] = await Promise.all([
        this.getChannel(notification.channelId),
        this.getTemplate(notification.templateId)
      ]);

      if (!channel || !template) {
        throw new Error('Channel or template not found');
      }

      // Process notification through channel
      const result = await this.channelManager.sendNotification(
        channel,
        notification,
        template
      );

      // Update notification with result
      await this.updateNotificationDeliveryResult(notificationId, result);

      // Update status
      const finalStatus = result.success ? 'sent' : 'failed';
      await this.updateNotificationStatus(notificationId, finalStatus);

    } catch (error) {
      console.error('Error processing notification:', error);
      await this.updateNotificationStatus(notificationId, 'failed');
      throw error;
    }
  }

  async retryFailedNotification(notificationId: string): Promise<void> {
    // Add back to queue for retry
    const notification = await this.getNotificationById(notificationId);
    if (notification && notification.status === 'failed') {
      await this.queue.add(notification, { delay: 60000 }); // Retry after 1 minute
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await this.updateNotificationStatus(notificationId, 'cancelled');
  }

  async getQueueStatus(): Promise<{ pending: number; processing: number; failed: number; }> {
    return await this.queue.getStatus();
  }

  // =============================================
  // Analytics and User Operations
  // =============================================

  async getNotificationStats(userId?: string, timeRange?: { start: Date; end: Date }): Promise<NotificationStats> {
    const client = await this.db.connect();
    
    try {
      let whereClause = '1=1';
      const values: any[] = [];
      let paramIndex = 1;

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        values.push(userId);
        paramIndex++;
      }

      if (timeRange) {
        whereClause += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        values.push(timeRange.start);
        values.push(timeRange.end);
        paramIndex += 2;
      }

      const query = `
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(*) FILTER (WHERE status = 'sent') as sent_notifications,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_notifications,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_notifications,
          AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000)::integer as avg_delivery_time
        FROM notifications
        WHERE ${whereClause}
      `;

      const result = await client.query(query, values);
      const row = result.rows[0];

      const totalNotifications = parseInt(row.total_notifications);
      const sentNotifications = parseInt(row.sent_notifications);
      const successRate = totalNotifications > 0 ? (sentNotifications / totalNotifications) * 100 : 0;

      // Get channel and template breakdowns
      const channelQuery = `
        SELECT nc.name, COUNT(*) as count
        FROM notifications n
        JOIN notification_channels nc ON n.channel_id = nc.id
        WHERE ${whereClause}
        GROUP BY nc.name
      `;

      const templateQuery = `
        SELECT nt.name, COUNT(*) as count
        FROM notifications n
        JOIN notification_templates nt ON n.template_id = nt.id
        WHERE ${whereClause}
        GROUP BY nt.name
      `;

      const [channelResult, templateResult] = await Promise.all([
        client.query(channelQuery, values),
        client.query(templateQuery, values)
      ]);

      const notificationsByChannel: Record<string, number> = {};
      channelResult.rows.forEach(row => {
        notificationsByChannel[row.name] = parseInt(row.count);
      });

      const notificationsByTemplate: Record<string, number> = {};
      templateResult.rows.forEach(row => {
        notificationsByTemplate[row.name] = parseInt(row.count);
      });

      // Get recent failures
      const failuresQuery = `
        SELECT id, title, created_at
        FROM notifications
        WHERE status = 'failed' AND ${whereClause}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const failuresResult = await client.query(failuresQuery, values);
      const recentFailures = failuresResult.rows.map(row => ({
        notificationId: row.id,
        errorCode: 'DELIVERY_FAILED',
        errorMessage: row.title,
        occurredAt: new Date(row.created_at)
      }));

      return {
        totalNotifications,
        sentNotifications,
        failedNotifications: parseInt(row.failed_notifications),
        pendingNotifications: parseInt(row.pending_notifications),
        successRate,
        avgDeliveryTime: parseInt(row.avg_delivery_time) || 0,
        notificationsByChannel,
        notificationsByTemplate,
        recentFailures
      };

    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserNotifications(userId: string, options?: {
    limit?: number;
    offset?: number;
    status?: Notification['status'];
    unreadOnly?: boolean;
  }): Promise<{ notifications: Notification[]; total: number; }> {
    const client = await this.db.connect();
    
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      
      let whereClause = 'user_id = $1';
      const values: any[] = [userId];
      let paramIndex = 2;

      if (options?.status) {
        whereClause += ` AND status = $${paramIndex}`;
        values.push(options.status);
        paramIndex++;
      }

      if (options?.unreadOnly) {
        whereClause += ' AND read_at IS NULL';
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM notifications WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get notifications
      const query = `
        SELECT * FROM notifications 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await client.query(query, values);
      const notifications = result.rows.map(row => this.mapDbRowToNotification(row));

      return { notifications, total };

    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
      `;
      await client.query(query, [notificationId, userId]);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE notifications 
        SET archived_at = NOW() 
        WHERE id = $1 AND user_id = $2
      `;
      await client.query(query, [notificationId, userId]);
    } catch (error) {
      console.error('Error archiving notification:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private mapDbRowToTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      channels: JSON.parse(row.channels),
      variables: JSON.parse(row.variables),
      isSystem: row.is_system,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
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

  private mapDbRowToChannel(row: any): NotificationChannel {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isEnabled: row.is_enabled,
      config: JSON.parse(row.config),
      retryConfig: JSON.parse(row.retry_config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapDbRowToPreferences(row: any): NotificationPreference {
    return {
      id: row.id,
      userId: row.user_id,
      globalSettings: JSON.parse(row.global_settings),
      channelPreferences: JSON.parse(row.channel_preferences),
      categoryPreferences: JSON.parse(row.category_preferences),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapDbRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      ruleId: row.rule_id,
      templateId: row.template_id,
      channelId: row.channel_id,
      priority: row.priority,
      status: row.status,
      title: row.title,
      message: row.message,
      data: JSON.parse(row.data || '{}'),
      metadata: {
        sourceType: JSON.parse(row.metadata).sourceType || 'manual',
        sourceId: JSON.parse(row.metadata).sourceId,
        triggeredBy: JSON.parse(row.metadata).triggeredBy,
        processingStartedAt: row.processing_started_at ? new Date(row.processing_started_at) : undefined,
        processingCompletedAt: row.processing_completed_at ? new Date(row.processing_completed_at) : undefined,
        retryCount: JSON.parse(row.metadata).retryCount || 0,
        lastRetryAt: JSON.parse(row.metadata).lastRetryAt ? new Date(JSON.parse(row.metadata).lastRetryAt) : undefined
      },
      deliveryResults: JSON.parse(row.delivery_results || '[]'),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private async createDefaultPreferences(userId: string): Promise<NotificationPreference> {
    const defaultPreferences: Omit<NotificationPreference, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      globalSettings: {
        isEnabled: true,
        quietHours: {
          start: '22:00',
          end: '08:00',
          timezone: 'Asia/Shanghai'
        },
        workingDaysOnly: false,
        maxNotificationsPerHour: 20
      },
      channelPreferences: [],
      categoryPreferences: [
        { category: 'email_alert', isEnabled: true, minPriority: 1 },
        { category: 'priority_email', isEnabled: true, minPriority: 3 },
        { category: 'ai_analysis', isEnabled: true, minPriority: 2 },
        { category: 'system_alert', isEnabled: true, minPriority: 1 },
        { category: 'custom', isEnabled: true, minPriority: 1 }
      ]
    };

    return await this.updateUserPreferences(userId, defaultPreferences);
  }

  private async findMatchingRules(rules: NotificationRule[], trigger: any): Promise<NotificationRule[]> {
    // Implement rule matching logic based on trigger type and conditions
    // This is a simplified version - you would implement more sophisticated matching
    return rules.filter(rule => 
      rule.isEnabled && 
      rule.triggers.some(t => t.type === trigger.type)
    );
  }

  private async createNotificationsFromRule(rule: NotificationRule, trigger: any): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const action of rule.actions) {
      if (!action.isEnabled) continue;

      const notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: rule.userId,
        ruleId: rule.id,
        templateId: action.templateId,
        channelId: action.channelId,
        priority: trigger.priority || rule.priority,
        status: 'pending',
        title: trigger.data.title || 'New Notification',
        message: trigger.data.message || 'You have a new notification',
        data: trigger.data,
        metadata: {
          sourceType: trigger.type,
          sourceId: trigger.sourceId,
          triggeredBy: trigger.userId,
          retryCount: 0
        },
        deliveryResults: []
      };

      const createdNotification = await this.createNotification(notification);
      notifications.push(createdNotification);
    }

    return notifications;
  }

  private async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const client = await this.db.connect();
    
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notifications (
          id, user_id, rule_id, template_id, channel_id, priority, status,
          title, message, data, metadata, delivery_results, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const values = [
        id,
        notification.userId,
        notification.ruleId,
        notification.templateId,
        notification.channelId,
        notification.priority,
        notification.status,
        notification.title,
        notification.message,
        JSON.stringify(notification.data),
        JSON.stringify(notification.metadata),
        JSON.stringify(notification.deliveryResults),
        now,
        now
      ];

      const result = await client.query(query, values);
      return this.mapDbRowToNotification(result.rows[0]);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getNotificationById(id: string): Promise<Notification | null> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notifications WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToNotification(result.rows[0]);
    } catch (error) {
      console.error('Error getting notification by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateNotificationStatus(id: string, status: Notification['status']): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const updateFields = ['status = $2', 'updated_at = NOW()'];
      const values = [id, status];

      if (status === 'processing') {
        updateFields.push('processing_started_at = NOW()');
      } else if (status === 'sent' || status === 'failed') {
        updateFields.push('processing_completed_at = NOW()');
      }

      const query = `
        UPDATE notifications 
        SET ${updateFields.join(', ')}
        WHERE id = $1
      `;

      await client.query(query, values);
    } catch (error) {
      console.error('Error updating notification status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateNotificationDeliveryResult(id: string, result: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Get current delivery results
      const getQuery = 'SELECT delivery_results FROM notifications WHERE id = $1';
      const getResult = await client.query(getQuery, [id]);
      
      if (getResult.rows.length === 0) {
        return;
      }

      const currentResults = JSON.parse(getResult.rows[0].delivery_results || '[]');
      
      // Add new result
      const newResult = {
        attempt: currentResults.length + 1,
        attemptedAt: new Date(),
        result: result.success ? 'success' : 'error',
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        responseData: result.responseData || null
      };

      currentResults.push(newResult);

      // Update notification
      const updateQuery = `
        UPDATE notifications 
        SET delivery_results = $2, updated_at = NOW()
        WHERE id = $1
      `;

      await client.query(updateQuery, [id, JSON.stringify(currentResults)]);
    } catch (error) {
      console.error('Error updating notification delivery result:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}