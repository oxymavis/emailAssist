import { Pool } from 'pg';
import { NotificationTemplate, NotificationChannel } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class NotificationTemplateManager {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Initialize system templates
   */
  async initializeSystemTemplates(channels: NotificationChannel[]): Promise<void> {
    try {
      console.log('Initializing system notification templates...');
      
      const templates = this.getSystemTemplates(channels);
      
      for (const template of templates) {
        await this.createSystemTemplateIfNotExists(template);
      }
      
      console.log(`Initialized ${templates.length} system notification templates`);
    } catch (error) {
      console.error('Error initializing system templates:', error);
      throw error;
    }
  }

  /**
   * Get system template definitions
   */
  private getSystemTemplates(channels: NotificationChannel[]): Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] {
    const websocketChannel = channels.find(c => c.type === 'websocket');
    const emailChannel = channels.find(c => c.type === 'email');
    const webhookChannel = channels.find(c => c.type === 'webhook');

    const templates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // High Priority Email Alert Template
    if (websocketChannel && emailChannel) {
      templates.push({
        name: '高优先级邮件提醒',
        description: '当收到高优先级或紧急邮件时发送的通知模板',
        category: 'priority_email',
        channels: [
          {
            channelId: websocketChannel.id,
            isEnabled: true,
            templateContent: {
              title: '🔴 高优先级邮件',
              message: '您收到了一封{{priority}}优先级的邮件：{{subject}}',
              icon: 'priority_high'
            }
          },
          {
            channelId: emailChannel.id,
            isEnabled: true,
            templateContent: {
              subject: '[高优先级] {{subject}}',
              htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #f44336; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 24px;">🔴 高优先级邮件提醒</h2>
                  </div>
                  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; color: #333;">您收到了一封<strong>{{priority}}</strong>优先级的邮件：</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                      <h3 style="margin: 0 0 10px 0; color: #333;">{{subject}}</h3>
                      <p style="margin: 0; color: #666;">发件人: {{senderName}} &lt;{{senderEmail}}&gt;</p>
                      <p style="margin: 5px 0 0 0; color: #666;">接收时间: {{receivedAt}}</p>
                    </div>
                    <p style="color: #666;">邮件预览：</p>
                    <div style="background-color: #fafafa; padding: 10px; border-left: 3px solid #f44336; margin: 10px 0;">
                      {{preview}}
                    </div>
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">
                      此邮件由Email Assist智能邮件管理系统自动发送
                    </p>
                  </div>
                </div>
              `,
              textBody: '您收到了一封{{priority}}优先级的邮件：{{subject}}\n发件人: {{senderName}} <{{senderEmail}}>\n接收时间: {{receivedAt}}\n\n邮件预览：\n{{preview}}'
            }
          }
        ],
        variables: [
          { name: 'priority', type: 'string', description: '邮件优先级', required: true, defaultValue: '高' },
          { name: 'subject', type: 'string', description: '邮件主题', required: true, defaultValue: '邮件主题' },
          { name: 'senderName', type: 'string', description: '发件人姓名', required: true, defaultValue: '发件人' },
          { name: 'senderEmail', type: 'string', description: '发件人邮箱', required: true, defaultValue: 'sender@example.com' },
          { name: 'receivedAt', type: 'date', description: '接收时间', required: true, defaultValue: new Date().toISOString() },
          { name: 'preview', type: 'string', description: '邮件预览', required: false, defaultValue: '邮件内容预览...' }
        ],
        isSystem: true,
        createdBy: 'system'
      });
    }

    // AI Analysis Alert Template
    if (websocketChannel) {
      templates.push({
        name: 'AI分析结果提醒',
        description: '当AI分析检测到重要邮件特征时发送的通知模板',
        category: 'ai_analysis',
        channels: [
          {
            channelId: websocketChannel.id,
            isEnabled: true,
            templateContent: {
              title: '🤖 AI分析提醒',
              message: 'AI检测到{{analysisType}}：{{subject}}（置信度：{{confidence}}%）',
              icon: 'psychology'
            }
          }
        ],
        variables: [
          { name: 'analysisType', type: 'string', description: '分析类型', required: true, defaultValue: '重要邮件' },
          { name: 'subject', type: 'string', description: '邮件主题', required: true, defaultValue: '邮件主题' },
          { name: 'confidence', type: 'number', description: '置信度百分比', required: true, defaultValue: 85 },
          { name: 'sentiment', type: 'string', description: '情感分析结果', required: false, defaultValue: '中性' },
          { name: 'category', type: 'string', description: '邮件分类', required: false, defaultValue: '工作邮件' }
        ],
        isSystem: true,
        createdBy: 'system'
      });
    }

    // System Alert Template
    if (websocketChannel && emailChannel) {
      templates.push({
        name: '系统状态提醒',
        description: '系统事件和状态变化的通知模板',
        category: 'system_alert',
        channels: [
          {
            channelId: websocketChannel.id,
            isEnabled: true,
            templateContent: {
              title: '⚠️ 系统提醒',
              message: '{{eventType}}: {{message}}',
              icon: 'notification_important'
            }
          },
          {
            channelId: emailChannel.id,
            isEnabled: false, // Disabled by default for system alerts
            templateContent: {
              subject: '[系统提醒] {{eventType}}',
              htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #ff9800; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 24px;">⚠️ 系统提醒</h2>
                  </div>
                  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h3 style="color: #333; margin-top: 0;">{{eventType}}</h3>
                    <p style="font-size: 16px; color: #333;">{{message}}</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                      <p style="margin: 0; color: #666;"><strong>时间:</strong> {{timestamp}}</p>
                      {{#if details}}
                      <p style="margin: 5px 0 0 0; color: #666;"><strong>详情:</strong> {{details}}</p>
                      {{/if}}
                    </div>
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">
                      此邮件由Email Assist系统自动发送
                    </p>
                  </div>
                </div>
              `,
              textBody: '系统提醒: {{eventType}}\n\n{{message}}\n\n时间: {{timestamp}}\n详情: {{details}}'
            }
          }
        ],
        variables: [
          { name: 'eventType', type: 'string', description: '事件类型', required: true, defaultValue: '系统事件' },
          { name: 'message', type: 'string', description: '消息内容', required: true, defaultValue: '系统消息' },
          { name: 'timestamp', type: 'date', description: '事件时间戳', required: true, defaultValue: new Date().toISOString() },
          { name: 'details', type: 'string', description: '详细信息', required: false, defaultValue: '' }
        ],
        isSystem: true,
        createdBy: 'system'
      });
    }

    // Email Alert Template (General)
    if (websocketChannel && emailChannel) {
      templates.push({
        name: '邮件到达提醒',
        description: '新邮件到达时的通用通知模板',
        category: 'email_alert',
        channels: [
          {
            channelId: websocketChannel.id,
            isEnabled: true,
            templateContent: {
              title: '📧 新邮件',
              message: '来自{{senderName}}的新邮件：{{subject}}',
              icon: 'email'
            }
          },
          {
            channelId: emailChannel.id,
            isEnabled: false, // Usually disabled for email notifications about emails
            templateContent: {
              subject: '[新邮件] {{subject}}',
              htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 24px;">📧 新邮件提醒</h2>
                  </div>
                  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; color: #333;">您收到了一封新邮件：</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                      <h3 style="margin: 0 0 10px 0; color: #333;">{{subject}}</h3>
                      <p style="margin: 0; color: #666;">发件人: {{senderName}} &lt;{{senderEmail}}&gt;</p>
                      <p style="margin: 5px 0 0 0; color: #666;">接收时间: {{receivedAt}}</p>
                    </div>
                    {{#if preview}}
                    <p style="color: #666;">邮件预览：</p>
                    <div style="background-color: #fafafa; padding: 10px; border-left: 3px solid #2196F3; margin: 10px 0;">
                      {{preview}}
                    </div>
                    {{/if}}
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">
                      此邮件由Email Assist智能邮件管理系统自动发送
                    </p>
                  </div>
                </div>
              `,
              textBody: '您收到了一封新邮件：{{subject}}\n发件人: {{senderName}} <{{senderEmail}}>\n接收时间: {{receivedAt}}\n\n{{#if preview}}邮件预览：\n{{preview}}{{/if}}'
            }
          }
        ],
        variables: [
          { name: 'subject', type: 'string', description: '邮件主题', required: true, defaultValue: '邮件主题' },
          { name: 'senderName', type: 'string', description: '发件人姓名', required: true, defaultValue: '发件人' },
          { name: 'senderEmail', type: 'string', description: '发件人邮箱', required: true, defaultValue: 'sender@example.com' },
          { name: 'receivedAt', type: 'date', description: '接收时间', required: true, defaultValue: new Date().toISOString() },
          { name: 'preview', type: 'string', description: '邮件预览', required: false, defaultValue: '' }
        ],
        isSystem: true,
        createdBy: 'system'
      });
    }

    // Webhook Template (for third-party integrations)
    if (webhookChannel) {
      templates.push({
        name: 'Webhook集成通知',
        description: '向第三方系统发送Webhook通知的模板',
        category: 'custom',
        channels: [
          {
            channelId: webhookChannel.id,
            isEnabled: true,
            templateContent: {
              payload: {
                type: 'notification',
                timestamp: '{{timestamp}}',
                user_id: '{{userId}}',
                notification: {
                  title: '{{title}}',
                  message: '{{message}}',
                  priority: '{{priority}}',
                  source: '{{source}}',
                  data: '{{data}}'
                }
              }
            }
          }
        ],
        variables: [
          { name: 'title', type: 'string', description: '通知标题', required: true, defaultValue: '通知标题' },
          { name: 'message', type: 'string', description: '通知消息', required: true, defaultValue: '通知消息' },
          { name: 'priority', type: 'number', description: '优先级', required: true, defaultValue: 5 },
          { name: 'source', type: 'string', description: '通知来源', required: true, defaultValue: 'email-assist' },
          { name: 'userId', type: 'string', description: '用户ID', required: true, defaultValue: '' },
          { name: 'timestamp', type: 'date', description: '时间戳', required: true, defaultValue: new Date().toISOString() },
          { name: 'data', type: 'string', description: '额外数据', required: false, defaultValue: '{}' }
        ],
        isSystem: true,
        createdBy: 'system'
      });
    }

    return templates;
  }

  /**
   * Create system template if it doesn't exist
   */
  private async createSystemTemplateIfNotExists(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Check if template already exists
      const existsQuery = `
        SELECT id FROM notification_templates 
        WHERE name = $1 AND is_system = true
      `;
      const existsResult = await client.query(existsQuery, [template.name]);
      
      if (existsResult.rows.length > 0) {
        console.log(`System template "${template.name}" already exists`);
        return;
      }

      // Create new template
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notification_templates (
          id, name, description, category, channels, variables, 
          is_system, created_by, usage_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      const values = [
        id,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.channels),
        JSON.stringify(template.variables),
        template.isSystem,
        template.createdBy,
        0,
        now,
        now
      ];

      await client.query(query, values);
      console.log(`Created system template: ${template.name}`);
    } catch (error) {
      console.error(`Error creating system template "${template.name}":`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update system templates
   */
  async updateSystemTemplates(channels: NotificationChannel[]): Promise<void> {
    try {
      console.log('Updating system notification templates...');
      
      const templates = this.getSystemTemplates(channels);
      
      for (const template of templates) {
        await this.updateSystemTemplateIfExists(template);
      }
      
      console.log(`Updated ${templates.length} system notification templates`);
    } catch (error) {
      console.error('Error updating system templates:', error);
      throw error;
    }
  }

  /**
   * Update system template if it exists
   */
  private async updateSystemTemplateIfExists(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE notification_templates 
        SET description = $2, channels = $3, variables = $4, updated_at = NOW()
        WHERE name = $1 AND is_system = true
      `;

      const values = [
        template.name,
        template.description,
        JSON.stringify(template.channels),
        JSON.stringify(template.variables)
      ];

      const result = await client.query(query, values);
      
      if (result.rowCount && result.rowCount > 0) {
        console.log(`Updated system template: ${template.name}`);
      }
    } catch (error) {
      console.error(`Error updating system template "${template.name}":`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(): Promise<Array<{
    templateId: string;
    templateName: string;
    usageCount: number;
    lastUsed: Date | null;
    successRate: number;
  }>> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT 
          nt.id,
          nt.name,
          nt.usage_count,
          MAX(n.created_at) as last_used,
          COUNT(n.id) as total_notifications,
          COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as successful_notifications
        FROM notification_templates nt
        LEFT JOIN notifications n ON nt.id = n.template_id
        GROUP BY nt.id, nt.name, nt.usage_count
        ORDER BY nt.usage_count DESC
      `;

      const result = await client.query(query);
      
      return result.rows.map(row => ({
        templateId: row.id,
        templateName: row.name,
        usageCount: parseInt(row.usage_count) || 0,
        lastUsed: row.last_used ? new Date(row.last_used) : null,
        successRate: row.total_notifications > 0 
          ? (parseInt(row.successful_notifications) / parseInt(row.total_notifications)) * 100 
          : 0
      }));
    } catch (error) {
      console.error('Error getting template usage stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean unused templates
   */
  async cleanUnusedTemplates(daysUnused: number = 90): Promise<number> {
    const client = await this.db.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysUnused);

      const query = `
        DELETE FROM notification_templates 
        WHERE is_system = false 
        AND usage_count = 0
        AND created_at < $1
        AND id NOT IN (
          SELECT DISTINCT template_id 
          FROM notifications 
          WHERE template_id IS NOT NULL
        )
      `;

      const result = await client.query(query, [cutoffDate]);
      
      console.log(`Cleaned ${result.rowCount} unused templates`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning unused templates:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Backup templates
   */
  async backupTemplates(): Promise<NotificationTemplate[]> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT * FROM notification_templates ORDER BY created_at ASC';
      const result = await client.query(query);
      
      return result.rows.map(row => ({
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
      }));
    } catch (error) {
      console.error('Error backing up templates:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Restore templates from backup
   */
  async restoreTemplates(templates: NotificationTemplate[]): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (const template of templates) {
        const query = `
          INSERT INTO notification_templates (
            id, name, description, category, channels, variables, 
            is_system, created_by, usage_count, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            channels = EXCLUDED.channels,
            variables = EXCLUDED.variables,
            updated_at = NOW()
        `;

        const values = [
          template.id,
          template.name,
          template.description,
          template.category,
          JSON.stringify(template.channels),
          JSON.stringify(template.variables),
          template.isSystem,
          template.createdBy,
          0, // Reset usage count
          template.createdAt,
          new Date()
        ];

        await client.query(query, values);
      }

      await client.query('COMMIT');
      console.log(`Restored ${templates.length} templates`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error restoring templates:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}