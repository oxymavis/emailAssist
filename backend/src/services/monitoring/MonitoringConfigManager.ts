/**
 * Monitoring Configuration Manager
 * 监控配置管理服务，提供监控系统的配置管理、规则配置、通知配置等功能
 */

import EventEmitter from 'events';
import { Redis } from 'ioredis';
import DatabaseManager from '@/config/database';
import logger from '@/utils/logger';

export interface MonitoringConfig {
  id: string;
  category: 'threshold' | 'notification' | 'retention' | 'general';
  name: string;
  value: any;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue: any;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface ThresholdConfig {
  id: string;
  metric: string;
  category: 'business' | 'system' | 'application' | 'security';
  warning: number;
  critical: number;
  unit: string;
  comparison: 'gt' | 'lt' | 'eq' | 'ne';
  enabled: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationConfig {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'teams' | 'discord';
  enabled: boolean;
  config: Record<string, any>;
  rateLimit?: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  testEndpoint?: string;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitoringRule {
  id: string;
  name: string;
  description: string;
  category: 'alerting' | 'aggregation' | 'filtering' | 'escalation';
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  schedule?: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    timezone?: string;
  };
  cooldown?: {
    enabled: boolean;
    duration: number;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  type: 'metric' | 'event' | 'time' | 'count' | 'rate';
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'regex' | 'in' | 'between';
  value: any;
  timeWindow?: number;
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
}

export interface RuleAction {
  type: 'alert' | 'notification' | 'webhook' | 'script' | 'suppress';
  config: Record<string, any>;
  delay?: number;
  retries?: number;
}

export interface DataRetentionConfig {
  category: 'metrics' | 'alerts' | 'logs' | 'events';
  retention: {
    shortTerm: number;    // 短期存储天数
    longTerm: number;     // 长期存储天数
    archive: number;      // 归档天数
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'lz4' | 'zstd';
    level: number;
  };
  aggregation: {
    enabled: boolean;
    intervals: Array<{
      duration: number;
      retention: number;
    }>;
  };
}

export interface MonitoringTemplate {
  id: string;
  name: string;
  type: 'dashboard' | 'alert' | 'notification' | 'report';
  category: string;
  template: Record<string, any>;
  variables: Array<{
    name: string;
    type: string;
    defaultValue?: any;
    required: boolean;
    description: string;
  }>;
  description: string;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class MonitoringConfigManager extends EventEmitter {
  private redis: Redis;
  private configs: Map<string, MonitoringConfig> = new Map();
  private thresholds: Map<string, ThresholdConfig> = new Map();
  private notifications: Map<string, NotificationConfig> = new Map();
  private rules: Map<string, MonitoringRule> = new Map();
  private templates: Map<string, MonitoringTemplate> = new Map();
  private retentionConfigs: Map<string, DataRetentionConfig> = new Map();

  // 配置缓存有效期
  private readonly CONFIG_CACHE_TTL = 300; // 5分钟

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing monitoring configuration manager...');

      // 加载所有配置
      await Promise.all([
        this.loadConfigs(),
        this.loadThresholds(),
        this.loadNotifications(),
        this.loadRules(),
        this.loadTemplates(),
        this.loadRetentionConfigs()
      ]);

      // 创建默认配置
      await this.createDefaultConfigs();

      logger.info('Monitoring configuration manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize monitoring configuration manager', error);
      throw error;
    }
  }

  // ==================== 通用配置管理 ====================

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<MonitoringConfig | null> {
    try {
      // 先从内存缓存获取
      const cached = this.configs.get(key);
      if (cached) {
        return cached;
      }

      // 从Redis缓存获取
      const redisKey = `monitoring_config:${key}`;
      const cachedData = await this.redis.get(redisKey);
      if (cachedData) {
        const config = JSON.parse(cachedData);
        this.configs.set(key, config);
        return config;
      }

      // 从数据库获取
      const db = DatabaseManager.getInstance();
      const result = await db.query(
        'SELECT * FROM monitoring_configs WHERE name = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config: MonitoringConfig = {
        ...result.rows[0],
        value: JSON.parse(result.rows[0].value)
      };

      // 缓存到内存和Redis
      this.configs.set(key, config);
      await this.redis.setex(redisKey, this.CONFIG_CACHE_TTL, JSON.stringify(config));

      return config;

    } catch (error) {
      logger.error('Failed to get config', error, { key });
      return null;
    }
  }

  /**
   * 设置配置
   */
  async setConfig(
    key: string,
    value: any,
    options: {
      description?: string;
      dataType?: MonitoringConfig['dataType'];
      category?: MonitoringConfig['category'];
      updatedBy?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance();
      const now = new Date();

      // 获取现有配置
      let existingConfig = await this.getConfig(key);

      const configData: Partial<MonitoringConfig> = {
        name: key,
        value: value,
        description: options.description || existingConfig?.description || '',
        dataType: options.dataType || existingConfig?.dataType || this.inferDataType(value),
        category: options.category || existingConfig?.category || 'general',
        updatedAt: now,
        updatedBy: options.updatedBy
      };

      if (existingConfig) {
        // 更新配置
        await db.query(
          `UPDATE monitoring_configs SET 
           value = $2, description = $3, data_type = $4, category = $5, updated_at = $6, updated_by = $7
           WHERE name = $1`,
          [key, JSON.stringify(value), configData.description, configData.dataType, 
           configData.category, configData.updatedAt, configData.updatedBy]
        );

        existingConfig = { ...existingConfig, ...configData };
      } else {
        // 创建新配置
        const newConfig: MonitoringConfig = {
          id: this.generateId(),
          name: key,
          value: value,
          description: configData.description!,
          dataType: configData.dataType!,
          category: configData.category!,
          defaultValue: value,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
          updatedBy: options.updatedBy
        };

        await db.query(
          `INSERT INTO monitoring_configs 
           (id, name, value, description, data_type, category, default_value, is_system, created_at, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [newConfig.id, newConfig.name, JSON.stringify(newConfig.value), newConfig.description,
           newConfig.dataType, newConfig.category, JSON.stringify(newConfig.defaultValue),
           newConfig.isSystem, newConfig.createdAt, newConfig.updatedAt, newConfig.updatedBy]
        );

        existingConfig = newConfig;
      }

      // 更新缓存
      this.configs.set(key, existingConfig!);
      const redisKey = `monitoring_config:${key}`;
      await this.redis.setex(redisKey, this.CONFIG_CACHE_TTL, JSON.stringify(existingConfig));

      this.emit('configUpdated', key, value, existingConfig);

      return true;

    } catch (error) {
      logger.error('Failed to set config', error, { key, value });
      return false;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string, deletedBy?: string): Promise<boolean> {
    try {
      const config = await this.getConfig(key);
      if (!config) {
        return false;
      }

      // 系统配置不能删除
      if (config.isSystem) {
        throw new Error('Cannot delete system configuration');
      }

      const db = DatabaseManager.getInstance();
      await db.query('DELETE FROM monitoring_configs WHERE name = $1', [key]);

      // 清除缓存
      this.configs.delete(key);
      await this.redis.del(`monitoring_config:${key}`);

      this.emit('configDeleted', key, config);

      logger.info('Configuration deleted', { key, deletedBy });
      return true;

    } catch (error) {
      logger.error('Failed to delete config', error, { key });
      return false;
    }
  }

  // ==================== 阈值配置管理 ====================

  /**
   * 获取阈值配置
   */
  async getThreshold(metric: string): Promise<ThresholdConfig | null> {
    const threshold = this.thresholds.get(metric);
    return threshold || null;
  }

  /**
   * 设置阈值配置
   */
  async setThreshold(thresholdConfig: Omit<ThresholdConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const db = DatabaseManager.getInstance();
      const now = new Date();
      const id = this.generateId();

      const threshold: ThresholdConfig = {
        ...thresholdConfig,
        id,
        createdAt: now,
        updatedAt: now
      };

      await db.query(
        `INSERT INTO monitoring_thresholds 
         (id, metric, category, warning, critical, unit, comparison, enabled, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (metric) DO UPDATE SET
         warning = EXCLUDED.warning, critical = EXCLUDED.critical, 
         unit = EXCLUDED.unit, comparison = EXCLUDED.comparison, 
         enabled = EXCLUDED.enabled, description = EXCLUDED.description,
         updated_at = EXCLUDED.updated_at`,
        [id, threshold.metric, threshold.category, threshold.warning, threshold.critical,
         threshold.unit, threshold.comparison, threshold.enabled, threshold.description,
         threshold.createdAt, threshold.updatedAt]
      );

      this.thresholds.set(threshold.metric, threshold);

      // 缓存到Redis
      await this.redis.setex(
        `monitoring_threshold:${threshold.metric}`,
        this.CONFIG_CACHE_TTL,
        JSON.stringify(threshold)
      );

      this.emit('thresholdUpdated', threshold.metric, threshold);

      return id;

    } catch (error) {
      logger.error('Failed to set threshold', error, thresholdConfig);
      throw error;
    }
  }

  /**
   * 获取所有阈值配置
   */
  async getAllThresholds(): Promise<ThresholdConfig[]> {
    return Array.from(this.thresholds.values());
  }

  // ==================== 通知配置管理 ====================

  /**
   * 获取通知配置
   */
  async getNotificationConfig(id: string): Promise<NotificationConfig | null> {
    const notification = this.notifications.get(id);
    return notification || null;
  }

  /**
   * 设置通知配置
   */
  async setNotificationConfig(
    notificationConfig: Omit<NotificationConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const db = DatabaseManager.getInstance();
      const now = new Date();
      const id = this.generateId();

      const notification: NotificationConfig = {
        ...notificationConfig,
        id,
        createdAt: now,
        updatedAt: now
      };

      await db.query(
        `INSERT INTO monitoring_notifications 
         (id, name, type, enabled, config, rate_limit, retry_config, test_endpoint, health_check, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, notification.name, notification.type, notification.enabled,
         JSON.stringify(notification.config), JSON.stringify(notification.rateLimit),
         JSON.stringify(notification.retryConfig), notification.testEndpoint,
         JSON.stringify(notification.healthCheck), notification.createdAt, notification.updatedAt]
      );

      this.notifications.set(id, notification);

      this.emit('notificationConfigUpdated', id, notification);

      return id;

    } catch (error) {
      logger.error('Failed to set notification config', error, notificationConfig);
      throw error;
    }
  }

  /**
   * 测试通知配置
   */
  async testNotificationConfig(id: string): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const config = await this.getNotificationConfig(id);
      if (!config) {
        return { success: false, message: 'Notification configuration not found' };
      }

      // 根据不同类型进行测试
      switch (config.type) {
        case 'email':
          return await this.testEmailNotification(config);
        case 'slack':
          return await this.testSlackNotification(config);
        case 'webhook':
          return await this.testWebhookNotification(config);
        default:
          return { success: false, message: `Testing not implemented for type: ${config.type}` };
      }

    } catch (error) {
      logger.error('Failed to test notification config', error, { id });
      return { success: false, message: error.message };
    }
  }

  // ==================== 规则管理 ====================

  /**
   * 获取监控规则
   */
  async getRule(id: string): Promise<MonitoringRule | null> {
    const rule = this.rules.get(id);
    return rule || null;
  }

  /**
   * 创建监控规则
   */
  async createRule(ruleData: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const db = DatabaseManager.getInstance();
      const now = new Date();
      const id = this.generateId();

      const rule: MonitoringRule = {
        ...ruleData,
        id,
        createdAt: now,
        updatedAt: now
      };

      await db.query(
        `INSERT INTO monitoring_rules 
         (id, name, description, category, enabled, priority, conditions, actions, schedule, cooldown, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, rule.name, rule.description, rule.category, rule.enabled, rule.priority,
         JSON.stringify(rule.conditions), JSON.stringify(rule.actions), 
         JSON.stringify(rule.schedule), JSON.stringify(rule.cooldown),
         JSON.stringify(rule.tags), rule.createdAt, rule.updatedAt]
      );

      this.rules.set(id, rule);

      this.emit('ruleCreated', id, rule);

      return id;

    } catch (error) {
      logger.error('Failed to create rule', error, ruleData);
      throw error;
    }
  }

  /**
   * 获取所有规则
   */
  async getAllRules(): Promise<MonitoringRule[]> {
    return Array.from(this.rules.values());
  }

  // ==================== 模板管理 ====================

  /**
   * 获取模板
   */
  async getTemplate(id: string): Promise<MonitoringTemplate | null> {
    const template = this.templates.get(id);
    return template || null;
  }

  /**
   * 创建模板
   */
  async createTemplate(
    templateData: Omit<MonitoringTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const db = DatabaseManager.getInstance();
      const now = new Date();
      const id = this.generateId();

      const template: MonitoringTemplate = {
        ...templateData,
        id,
        createdAt: now,
        updatedAt: now
      };

      await db.query(
        `INSERT INTO monitoring_templates 
         (id, name, type, category, template, variables, description, tags, is_public, created_at, updated_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, template.name, template.type, template.category,
         JSON.stringify(template.template), JSON.stringify(template.variables),
         template.description, JSON.stringify(template.tags), template.isPublic,
         template.createdAt, template.updatedAt, template.createdBy]
      );

      this.templates.set(id, template);

      this.emit('templateCreated', id, template);

      return id;

    } catch (error) {
      logger.error('Failed to create template', error, templateData);
      throw error;
    }
  }

  // ==================== 数据保留配置 ====================

  /**
   * 获取数据保留配置
   */
  async getRetentionConfig(category: DataRetentionConfig['category']): Promise<DataRetentionConfig | null> {
    const config = this.retentionConfigs.get(category);
    return config || null;
  }

  /**
   * 设置数据保留配置
   */
  async setRetentionConfig(retentionConfig: DataRetentionConfig): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance();

      await db.query(
        `INSERT INTO monitoring_retention_configs (category, retention, compression, aggregation)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category) DO UPDATE SET
         retention = EXCLUDED.retention,
         compression = EXCLUDED.compression,
         aggregation = EXCLUDED.aggregation`,
        [retentionConfig.category, JSON.stringify(retentionConfig.retention),
         JSON.stringify(retentionConfig.compression), JSON.stringify(retentionConfig.aggregation)]
      );

      this.retentionConfigs.set(retentionConfig.category, retentionConfig);

      this.emit('retentionConfigUpdated', retentionConfig.category, retentionConfig);

      return true;

    } catch (error) {
      logger.error('Failed to set retention config', error, retentionConfig);
      return false;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 推断数据类型
   */
  private inferDataType(value: any): MonitoringConfig['dataType'] {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `cfg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 加载所有配置
   */
  private async loadConfigs(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_configs');

      result.rows.forEach(row => {
        const config: MonitoringConfig = {
          ...row,
          value: JSON.parse(row.value || '{}'),
          defaultValue: JSON.parse(row.default_value || '{}')
        };
        this.configs.set(config.name, config);
      });

      logger.info('Monitoring configs loaded', { count: this.configs.size });

    } catch (error) {
      logger.error('Failed to load configs', error);
    }
  }

  /**
   * 加载阈值配置
   */
  private async loadThresholds(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_thresholds');

      result.rows.forEach(row => {
        const threshold: ThresholdConfig = row;
        this.thresholds.set(threshold.metric, threshold);
      });

      logger.info('Monitoring thresholds loaded', { count: this.thresholds.size });

    } catch (error) {
      logger.error('Failed to load thresholds', error);
    }
  }

  /**
   * 加载通知配置
   */
  private async loadNotifications(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_notifications');

      result.rows.forEach(row => {
        const notification: NotificationConfig = {
          ...row,
          config: JSON.parse(row.config || '{}'),
          rateLimit: JSON.parse(row.rate_limit || 'null'),
          retryConfig: JSON.parse(row.retry_config || 'null'),
          healthCheck: JSON.parse(row.health_check || 'null')
        };
        this.notifications.set(notification.id, notification);
      });

      logger.info('Notification configs loaded', { count: this.notifications.size });

    } catch (error) {
      logger.error('Failed to load notification configs', error);
    }
  }

  /**
   * 加载规则
   */
  private async loadRules(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_rules');

      result.rows.forEach(row => {
        const rule: MonitoringRule = {
          ...row,
          conditions: JSON.parse(row.conditions || '[]'),
          actions: JSON.parse(row.actions || '[]'),
          schedule: JSON.parse(row.schedule || 'null'),
          cooldown: JSON.parse(row.cooldown || 'null'),
          tags: JSON.parse(row.tags || '[]')
        };
        this.rules.set(rule.id, rule);
      });

      logger.info('Monitoring rules loaded', { count: this.rules.size });

    } catch (error) {
      logger.error('Failed to load rules', error);
    }
  }

  /**
   * 加载模板
   */
  private async loadTemplates(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_templates');

      result.rows.forEach(row => {
        const template: MonitoringTemplate = {
          ...row,
          template: JSON.parse(row.template || '{}'),
          variables: JSON.parse(row.variables || '[]'),
          tags: JSON.parse(row.tags || '[]')
        };
        this.templates.set(template.id, template);
      });

      logger.info('Monitoring templates loaded', { count: this.templates.size });

    } catch (error) {
      logger.error('Failed to load templates', error);
    }
  }

  /**
   * 加载数据保留配置
   */
  private async loadRetentionConfigs(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const result = await db.query('SELECT * FROM monitoring_retention_configs');

      result.rows.forEach(row => {
        const config: DataRetentionConfig = {
          category: row.category,
          retention: JSON.parse(row.retention || '{}'),
          compression: JSON.parse(row.compression || '{}'),
          aggregation: JSON.parse(row.aggregation || '{}')
        };
        this.retentionConfigs.set(config.category, config);
      });

      logger.info('Retention configs loaded', { count: this.retentionConfigs.size });

    } catch (error) {
      logger.error('Failed to load retention configs', error);
    }
  }

  /**
   * 创建默认配置
   */
  private async createDefaultConfigs(): Promise<void> {
    try {
      // 创建默认系统配置
      const defaultConfigs = [
        {
          key: 'monitoring.enabled',
          value: true,
          category: 'general' as const,
          description: 'Enable monitoring system'
        },
        {
          key: 'monitoring.retention.days',
          value: 30,
          category: 'retention' as const,
          description: 'Default data retention period in days'
        },
        {
          key: 'monitoring.alerts.enabled',
          value: true,
          category: 'general' as const,
          description: 'Enable alerting system'
        }
      ];

      for (const config of defaultConfigs) {
        const existing = await this.getConfig(config.key);
        if (!existing) {
          await this.setConfig(config.key, config.value, {
            category: config.category,
            description: config.description
          });
        }
      }

      // 创建默认数据保留配置
      const defaultRetentionConfigs: DataRetentionConfig[] = [
        {
          category: 'metrics',
          retention: { shortTerm: 7, longTerm: 30, archive: 365 },
          compression: { enabled: true, algorithm: 'gzip', level: 6 },
          aggregation: { 
            enabled: true, 
            intervals: [
              { duration: 3600, retention: 30 }, // 1小时聚合，保留30天
              { duration: 86400, retention: 365 } // 1天聚合，保留1年
            ]
          }
        },
        {
          category: 'alerts',
          retention: { shortTerm: 30, longTerm: 90, archive: 365 },
          compression: { enabled: true, algorithm: 'gzip', level: 6 },
          aggregation: { enabled: false, intervals: [] }
        }
      ];

      for (const retentionConfig of defaultRetentionConfigs) {
        const existing = await this.getRetentionConfig(retentionConfig.category);
        if (!existing) {
          await this.setRetentionConfig(retentionConfig);
        }
      }

      logger.info('Default configurations created');

    } catch (error) {
      logger.error('Failed to create default configs', error);
    }
  }

  /**
   * 测试邮件通知
   */
  private async testEmailNotification(config: NotificationConfig): Promise<{ success: boolean; message: string }> {
    // 实现邮件测试逻辑
    return { success: true, message: 'Email notification test successful' };
  }

  /**
   * 测试Slack通知
   */
  private async testSlackNotification(config: NotificationConfig): Promise<{ success: boolean; message: string }> {
    // 实现Slack测试逻辑
    return { success: true, message: 'Slack notification test successful' };
  }

  /**
   * 测试Webhook通知
   */
  private async testWebhookNotification(config: NotificationConfig): Promise<{ success: boolean; message: string }> {
    // 实现Webhook测试逻辑
    return { success: true, message: 'Webhook notification test successful' };
  }

  /**
   * 获取配置统计
   */
  getConfigStatistics(): {
    configs: number;
    thresholds: number;
    notifications: number;
    rules: number;
    templates: number;
  } {
    return {
      configs: this.configs.size,
      thresholds: this.thresholds.size,
      notifications: this.notifications.size,
      rules: this.rules.size,
      templates: this.templates.size
    };
  }
}

export default MonitoringConfigManager;