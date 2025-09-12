/**
 * Intelligent Alerting System
 * 智能告警系统，提供多渠道告警通知、智能告警聚合、告警规则管理、告警升级机制等功能
 */

import EventEmitter from 'events';
import nodemailer from 'nodemailer';
import axios from 'axios';
import logger from '@/utils/logger';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import DatabaseManager from '@/config/database';

export interface Alert {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  category: 'system' | 'business' | 'security' | 'performance' | 'application';
  source: string;
  timestamp: Date;
  metadata: Record<string, any>;
  tags: string[];
  fingerprint: string;     // 用于告警去重
  status: 'active' | 'acknowledged' | 'resolved' | 'silenced';
  assignedTo?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  silencedBy?: string;
  silencedUntil?: Date;
  escalated: boolean;
  escalationLevel: number; // 升级级别 0-3
  notificationsSent: NotificationRecord[];
  relatedAlerts: string[]; // 关联告警ID
}

export interface NotificationRecord {
  id: string;
  channel: 'email' | 'slack' | 'webhook' | 'sms' | 'phone';
  recipient: string;
  sentAt: Date;
  status: 'sent' | 'failed' | 'delivered';
  error?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: Alert['category'];
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownPeriod: number;   // 冷却期(秒)
  maxAlerts: number;        // 最大告警次数
  escalationRules: EscalationRule[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type: 'metric' | 'event' | 'log' | 'anomaly';
  metric?: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'regex';
  threshold: number | string;
  aggregation?: 'avg' | 'sum' | 'count' | 'max' | 'min';
  timeWindow: number;       // 时间窗口(秒)
  minOccurrences: number;   // 最少出现次数
}

export interface AlertAction {
  type: 'notification' | 'webhook' | 'automation';
  channels: string[];       // 通知渠道
  recipients: string[];     // 接收者
  template?: string;        // 消息模板
  webhookUrl?: string;      // Webhook URL
  automationScript?: string; // 自动化脚本
  enabled: boolean;
}

export interface EscalationRule {
  level: number;
  delay: number;           // 延迟时间(秒)
  recipients: string[];    // 升级接收者
  channels: string[];      // 升级通知渠道
  condition: 'unacknowledged' | 'unresolved' | 'critical_duration';
  enabled: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'teams' | 'discord';
  enabled: boolean;
  config: Record<string, any>;
  rateLimit?: {
    maxPerMinute: number;
    maxPerHour: number;
  };
  failureCount: number;
  lastFailure?: Date;
}

export interface AlertTemplate {
  id: string;
  name: string;
  category: Alert['category'];
  subject: string;
  body: string;
  variables: string[];     // 可用变量列表
  format: 'text' | 'html' | 'markdown';
}

export interface AlertMetrics {
  timestamp: Date;
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  acknowledged: number;
  resolved: number;
  escalated: number;
  avgResolutionTime: number; // 平均解决时间(秒)
  avgAcknowledgmentTime: number; // 平均确认时间(秒)
  notificationSuccess: number;
  notificationFailure: number;
}

export class IntelligentAlertingSystem extends EventEmitter {
  private redis: Redis;
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private alertTemplates: Map<string, AlertTemplate> = new Map();
  private metrics: AlertMetrics[] = [];
  
  // 告警聚合
  private alertAggregations: Map<string, Alert[]> = new Map();
  
  // 告警抑制（维护模式等）
  private silencedCategories: Set<string> = new Set();
  
  // 通知限流
  private notificationLimiter: Map<string, { count: number; resetTime: Date }> = new Map();
  
  private monitoringInterval?: NodeJS.Timeout;
  private escalationInterval?: NodeJS.Timeout;
  
  private readonly MAX_ALERTS_HISTORY = 10000;
  private readonly MAX_METRICS_HISTORY = 2880; // 24小时

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.initializeDefaults();
  }

  /**
   * 启动告警系统
   */
  async startAlerting(): Promise<void> {
    logger.info('Starting intelligent alerting system');

    // 加载配置
    await this.loadConfiguration();

    // 启动监控
    this.monitoringInterval = setInterval(async () => {
      await this.processAlerts();
      await this.collectMetrics();
    }, 30000); // 30秒检查一次

    // 启动升级检查
    this.escalationInterval = setInterval(async () => {
      await this.checkEscalations();
    }, 60000); // 1分钟检查一次升级

    logger.info('Intelligent alerting system started');
  }

  /**
   * 停止告警系统
   */
  stopAlerting(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = undefined;
    }

    logger.info('Intelligent alerting system stopped');
  }

  /**
   * 创建告警
   */
  async createAlert(alertData: {
    title: string;
    message: string;
    level: Alert['level'];
    category: Alert['category'];
    source: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }): Promise<Alert> {
    const fingerprint = this.generateFingerprint(alertData);
    
    // 检查是否已存在相同指纹的活跃告警
    const existingAlert = this.findAlertByFingerprint(fingerprint);
    if (existingAlert && existingAlert.status === 'active') {
      // 更新现有告警的时间戳和计数
      existingAlert.timestamp = new Date();
      existingAlert.metadata.count = (existingAlert.metadata.count || 1) + 1;
      existingAlert.metadata.lastOccurrence = new Date();
      
      this.emit('alertUpdated', existingAlert);
      return existingAlert;
    }

    const alert: Alert = {
      id: uuidv4(),
      title: alertData.title,
      message: alertData.message,
      level: alertData.level,
      category: alertData.category,
      source: alertData.source,
      timestamp: new Date(),
      metadata: { count: 1, ...alertData.metadata },
      tags: alertData.tags || [],
      fingerprint,
      status: 'active',
      escalated: false,
      escalationLevel: 0,
      notificationsSent: [],
      relatedAlerts: []
    };

    // 检查告警抑制
    if (this.isAlertSilenced(alert)) {
      alert.status = 'silenced';
    }

    // 存储告警
    this.alerts.set(alert.id, alert);
    
    // 持久化告警
    await this.persistAlert(alert);

    // 处理告警聚合
    await this.aggregateAlert(alert);

    // 如果告警未被抑制，则处理通知
    if (alert.status === 'active') {
      await this.processAlertNotification(alert);
    }

    this.emit('alertCreated', alert);

    logger.info('Alert created', {
      alertId: alert.id,
      title: alert.title,
      level: alert.level,
      category: alert.category,
      source: alert.source
    });

    return alert;
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, userId: string, comment?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    
    if (comment) {
      alert.metadata.acknowledgmentComment = comment;
    }

    await this.persistAlert(alert);

    this.emit('alertAcknowledged', alert);

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy: userId,
      comment
    });

    return true;
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string, userId: string, comment?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    
    if (comment) {
      alert.metadata.resolutionComment = comment;
    }

    await this.persistAlert(alert);

    this.emit('alertResolved', alert);

    logger.info('Alert resolved', {
      alertId,
      resolvedBy: userId,
      comment
    });

    return true;
  }

  /**
   * 抑制告警
   */
  async silenceAlert(alertId: string, userId: string, duration: number, reason?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'silenced';
    alert.silencedBy = userId;
    alert.silencedUntil = new Date(Date.now() + duration * 1000);
    
    if (reason) {
      alert.metadata.silenceReason = reason;
    }

    await this.persistAlert(alert);

    this.emit('alertSilenced', alert);

    logger.info('Alert silenced', {
      alertId,
      silencedBy: userId,
      duration,
      reason
    });

    return true;
  }

  /**
   * 生成告警指纹（用于去重）
   */
  private generateFingerprint(alertData: {
    title: string;
    message: string;
    level: Alert['level'];
    category: Alert['category'];
    source: string;
    metadata?: Record<string, any>;
  }): string {
    const key = `${alertData.category}:${alertData.source}:${alertData.title}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * 根据指纹查找告警
   */
  private findAlertByFingerprint(fingerprint: string): Alert | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.fingerprint === fingerprint) {
        return alert;
      }
    }
    return undefined;
  }

  /**
   * 检查告警是否被抑制
   */
  private isAlertSilenced(alert: Alert): boolean {
    return this.silencedCategories.has(alert.category);
  }

  /**
   * 处理告警聚合
   */
  private async aggregateAlert(alert: Alert): Promise<void> {
    const aggregationKey = `${alert.category}:${alert.level}`;
    
    if (!this.alertAggregations.has(aggregationKey)) {
      this.alertAggregations.set(aggregationKey, []);
    }
    
    const aggregatedAlerts = this.alertAggregations.get(aggregationKey)!;
    aggregatedAlerts.push(alert);

    // 如果聚合的告警数量达到阈值，创建聚合告警
    if (aggregatedAlerts.length >= 5 && alert.level === 'warning') {
      await this.createAggregatedAlert(aggregationKey, aggregatedAlerts);
      this.alertAggregations.set(aggregationKey, []); // 清空聚合
    }
  }

  /**
   * 创建聚合告警
   */
  private async createAggregatedAlert(aggregationKey: string, alerts: Alert[]): Promise<void> {
    const [category, level] = aggregationKey.split(':') as [Alert['category'], Alert['level']];
    
    const aggregatedAlert = await this.createAlert({
      title: `聚合告警: ${category} (${alerts.length}个告警)`,
      message: `检测到${alerts.length}个${category}类别的${level}级别告警`,
      level: level as Alert['level'],
      category,
      source: 'aggregation_system',
      metadata: {
        aggregatedAlerts: alerts.map(a => a.id),
        aggregationKey,
        count: alerts.length
      },
      tags: ['aggregated', category]
    });

    // 设置关联告警
    aggregatedAlert.relatedAlerts = alerts.map(a => a.id);
    alerts.forEach(alert => {
      alert.relatedAlerts.push(aggregatedAlert.id);
    });

    logger.info('Aggregated alert created', {
      aggregatedAlertId: aggregatedAlert.id,
      alertCount: alerts.length,
      category,
      level
    });
  }

  /**
   * 处理告警通知
   */
  private async processAlertNotification(alert: Alert): Promise<void> {
    try {
      // 查找匹配的告警规则
      const matchingRules = this.findMatchingRules(alert);
      
      for (const rule of matchingRules) {
        // 检查冷却期
        if (await this.isInCooldown(rule, alert)) {
          continue;
        }

        // 执行告警动作
        for (const action of rule.actions) {
          if (!action.enabled) continue;

          await this.executeAlertAction(alert, rule, action);
        }

        // 设置冷却期
        await this.setCooldown(rule, alert);
      }

    } catch (error) {
      logger.error('Failed to process alert notification', error, { alertId: alert.id });
    }
  }

  /**
   * 查找匹配的告警规则
   */
  private findMatchingRules(alert: Alert): AlertRule[] {
    const matchingRules: AlertRule[] = [];

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      if (rule.category !== alert.category && rule.category !== 'all') {
        continue;
      }

      // 检查标签匹配
      if (rule.tags.length > 0) {
        const hasMatchingTag = rule.tags.some(tag => alert.tags.includes(tag));
        if (!hasMatchingTag) continue;
      }

      matchingRules.push(rule);
    }

    return matchingRules;
  }

  /**
   * 检查是否在冷却期内
   */
  private async isInCooldown(rule: AlertRule, alert: Alert): Promise<boolean> {
    const cooldownKey = `cooldown:${rule.id}:${alert.fingerprint}`;
    const cooldownEnd = await this.redis.get(cooldownKey);
    
    if (cooldownEnd) {
      const endTime = new Date(cooldownEnd);
      return new Date() < endTime;
    }

    return false;
  }

  /**
   * 设置冷却期
   */
  private async setCooldown(rule: AlertRule, alert: Alert): Promise<void> {
    const cooldownKey = `cooldown:${rule.id}:${alert.fingerprint}`;
    const endTime = new Date(Date.now() + rule.cooldownPeriod * 1000);
    
    await this.redis.setex(cooldownKey, rule.cooldownPeriod, endTime.toISOString());
  }

  /**
   * 执行告警动作
   */
  private async executeAlertAction(alert: Alert, rule: AlertRule, action: AlertAction): Promise<void> {
    try {
      switch (action.type) {
        case 'notification':
          await this.sendNotifications(alert, action);
          break;
          
        case 'webhook':
          if (action.webhookUrl) {
            await this.sendWebhook(alert, action.webhookUrl);
          }
          break;
          
        case 'automation':
          if (action.automationScript) {
            await this.runAutomation(alert, action.automationScript);
          }
          break;
      }

    } catch (error) {
      logger.error('Failed to execute alert action', error, {
        alertId: alert.id,
        ruleId: rule.id,
        actionType: action.type
      });
    }
  }

  /**
   * 发送通知
   */
  private async sendNotifications(alert: Alert, action: AlertAction): Promise<void> {
    for (const channelId of action.channels) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) continue;

      // 检查限流
      if (await this.isRateLimited(channel)) {
        logger.warn('Notification rate limited', { channelId, alertId: alert.id });
        continue;
      }

      for (const recipient of action.recipients) {
        try {
          const notification = await this.sendNotification(alert, channel, recipient, action.template);
          alert.notificationsSent.push(notification);

        } catch (error) {
          logger.error('Failed to send notification', error, {
            alertId: alert.id,
            channelId,
            recipient
          });

          // 记录失败的通知
          alert.notificationsSent.push({
            id: uuidv4(),
            channel: channel.type,
            recipient,
            sentAt: new Date(),
            status: 'failed',
            error: error.message
          });
        }
      }
    }
  }

  /**
   * 检查限流
   */
  private async isRateLimited(channel: NotificationChannel): Promise<boolean> {
    if (!channel.rateLimit) return false;

    const now = new Date();
    const limiterKey = `rate_limit:${channel.id}`;
    
    let limiter = this.notificationLimiter.get(limiterKey);
    if (!limiter || limiter.resetTime < now) {
      limiter = {
        count: 0,
        resetTime: new Date(now.getTime() + 60 * 1000) // 1分钟重置
      };
      this.notificationLimiter.set(limiterKey, limiter);
    }

    limiter.count++;
    return limiter.count > channel.rateLimit.maxPerMinute;
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(
    alert: Alert,
    channel: NotificationChannel,
    recipient: string,
    templateId?: string
  ): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: uuidv4(),
      channel: channel.type,
      recipient,
      sentAt: new Date(),
      status: 'sent'
    };

    try {
      const message = await this.formatMessage(alert, templateId || 'default');

      switch (channel.type) {
        case 'email':
          await this.sendEmail(recipient, alert.title, message, channel.config);
          break;
          
        case 'slack':
          await this.sendSlack(recipient, message, channel.config);
          break;
          
        case 'webhook':
          await this.sendWebhook(alert, channel.config.url);
          break;
          
        case 'sms':
          await this.sendSMS(recipient, message, channel.config);
          break;

        default:
          throw new Error(`Unsupported notification channel: ${channel.type}`);
      }

      notification.status = 'delivered';
      
    } catch (error) {
      notification.status = 'failed';
      notification.error = error.message;
      
      // 增加渠道失败计数
      channel.failureCount++;
      channel.lastFailure = new Date();
      
      throw error;
    }

    return notification;
  }

  /**
   * 格式化消息
   */
  private async formatMessage(alert: Alert, templateId: string): Promise<string> {
    const template = this.alertTemplates.get(templateId);
    if (!template) {
      return `告警: ${alert.title}\n消息: ${alert.message}\n级别: ${alert.level}\n时间: ${alert.timestamp.toLocaleString()}`;
    }

    let message = template.body;
    
    // 替换变量
    const variables: Record<string, string> = {
      'alert.title': alert.title,
      'alert.message': alert.message,
      'alert.level': alert.level,
      'alert.category': alert.category,
      'alert.source': alert.source,
      'alert.timestamp': alert.timestamp.toLocaleString(),
      'alert.id': alert.id,
      'alert.tags': alert.tags.join(', ')
    };

    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return message;
  }

  /**
   * 发送邮件
   */
  private async sendEmail(to: string, subject: string, body: string, config: any): Promise<void> {
    const transporter = nodemailer.createTransporter(config);
    
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html: body
    });
  }

  /**
   * 发送Slack通知
   */
  private async sendSlack(channel: string, message: string, config: any): Promise<void> {
    await axios.post(config.webhookUrl, {
      channel,
      text: message,
      username: 'AlertBot',
      icon_emoji: ':warning:'
    });
  }

  /**
   * 发送Webhook
   */
  private async sendWebhook(alert: Alert, url: string): Promise<void> {
    await axios.post(url, {
      alert,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发送短信
   */
  private async sendSMS(to: string, message: string, config: any): Promise<void> {
    // 这里应该集成SMS服务商API
    logger.info('SMS would be sent', { to, message });
  }

  /**
   * 运行自动化脚本
   */
  private async runAutomation(alert: Alert, script: string): Promise<void> {
    // 这里应该执行自动化脚本
    logger.info('Automation would be executed', { alertId: alert.id, script });
  }

  /**
   * 检查告警升级
   */
  private async checkEscalations(): Promise<void> {
    try {
      const activeAlerts = Array.from(this.alerts.values()).filter(a => 
        a.status === 'active' || a.status === 'acknowledged'
      );

      for (const alert of activeAlerts) {
        await this.checkAlertEscalation(alert);
      }

    } catch (error) {
      logger.error('Failed to check escalations', error);
    }
  }

  /**
   * 检查单个告警的升级
   */
  private async checkAlertEscalation(alert: Alert): Promise<void> {
    // 查找匹配的规则
    const matchingRules = this.findMatchingRules(alert);
    
    for (const rule of matchingRules) {
      for (const escalationRule of rule.escalationRules) {
        if (!escalationRule.enabled) continue;
        
        const shouldEscalate = await this.shouldEscalate(alert, escalationRule);
        if (shouldEscalate) {
          await this.escalateAlert(alert, escalationRule);
        }
      }
    }
  }

  /**
   * 检查是否应该升级
   */
  private async shouldEscalate(alert: Alert, escalationRule: EscalationRule): Promise<boolean> {
    const now = new Date();
    const alertAge = (now.getTime() - alert.timestamp.getTime()) / 1000;

    // 检查延迟时间
    if (alertAge < escalationRule.delay) {
      return false;
    }

    // 检查升级级别
    if (alert.escalationLevel >= escalationRule.level) {
      return false;
    }

    // 检查升级条件
    switch (escalationRule.condition) {
      case 'unacknowledged':
        return alert.status === 'active';
        
      case 'unresolved':
        return alert.status !== 'resolved';
        
      case 'critical_duration':
        return alert.level === 'critical' && alertAge > escalationRule.delay;
        
      default:
        return false;
    }
  }

  /**
   * 升级告警
   */
  private async escalateAlert(alert: Alert, escalationRule: EscalationRule): Promise<void> {
    alert.escalated = true;
    alert.escalationLevel = Math.max(alert.escalationLevel, escalationRule.level);

    // 发送升级通知
    const escalationAction: AlertAction = {
      type: 'notification',
      channels: escalationRule.channels,
      recipients: escalationRule.recipients,
      template: 'escalation',
      enabled: true
    };

    await this.sendNotifications(alert, escalationAction);

    await this.persistAlert(alert);

    this.emit('alertEscalated', alert, escalationRule);

    logger.warn('Alert escalated', {
      alertId: alert.id,
      escalationLevel: escalationRule.level,
      recipients: escalationRule.recipients
    });
  }

  /**
   * 处理告警
   */
  private async processAlerts(): Promise<void> {
    try {
      // 清理已解决的旧告警
      await this.cleanupResolvedAlerts();
      
      // 检查抑制过期的告警
      await this.checkSilencedAlerts();
      
    } catch (error) {
      logger.error('Failed to process alerts', error);
    }
  }

  /**
   * 清理已解决的告警
   */
  private async cleanupResolvedAlerts(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * 检查抑制过期的告警
   */
  private async checkSilencedAlerts(): Promise<void> {
    const now = new Date();
    
    for (const alert of this.alerts.values()) {
      if (alert.status === 'silenced' && alert.silencedUntil && alert.silencedUntil < now) {
        alert.status = 'active';
        alert.silencedBy = undefined;
        alert.silencedUntil = undefined;
        
        await this.persistAlert(alert);
        
        // 重新处理告警
        await this.processAlertNotification(alert);
      }
    }
  }

  /**
   * 收集告警指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const alerts = Array.from(this.alerts.values());
      
      const byLevel: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      
      let acknowledged = 0;
      let resolved = 0;
      let escalated = 0;
      let totalResolutionTime = 0;
      let totalAcknowledgmentTime = 0;
      let resolutionCount = 0;
      let acknowledgmentCount = 0;
      let notificationSuccess = 0;
      let notificationFailure = 0;

      alerts.forEach(alert => {
        // 按级别统计
        byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
        
        // 按类别统计
        byCategory[alert.category] = (byCategory[alert.category] || 0) + 1;
        
        // 按状态统计
        byStatus[alert.status] = (byStatus[alert.status] || 0) + 1;
        
        if (alert.status === 'acknowledged') acknowledged++;
        if (alert.status === 'resolved') resolved++;
        if (alert.escalated) escalated++;
        
        // 计算解决时间
        if (alert.resolvedAt) {
          totalResolutionTime += (alert.resolvedAt.getTime() - alert.timestamp.getTime()) / 1000;
          resolutionCount++;
        }
        
        // 计算确认时间
        if (alert.acknowledgedAt) {
          totalAcknowledgmentTime += (alert.acknowledgedAt.getTime() - alert.timestamp.getTime()) / 1000;
          acknowledgmentCount++;
        }
        
        // 通知统计
        alert.notificationsSent.forEach(notification => {
          if (notification.status === 'delivered') {
            notificationSuccess++;
          } else if (notification.status === 'failed') {
            notificationFailure++;
          }
        });
      });

      const metrics: AlertMetrics = {
        timestamp,
        total: alerts.length,
        byLevel,
        byCategory,
        byStatus,
        acknowledged,
        resolved,
        escalated,
        avgResolutionTime: resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : 0,
        avgAcknowledgmentTime: acknowledgmentCount > 0 ? Math.round(totalAcknowledgmentTime / acknowledgmentCount) : 0,
        notificationSuccess,
        notificationFailure
      };

      this.metrics.push(metrics);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // 缓存指标
      await this.cacheMetrics(metrics);

      this.emit('alertMetrics', metrics);

    } catch (error) {
      logger.error('Failed to collect alert metrics', error);
    }
  }

  /**
   * 持久化告警
   */
  private async persistAlert(alert: Alert): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const alertData = JSON.stringify(alert);
      
      await db.query(
        `INSERT INTO alerts (id, title, level, category, status, alert_data, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (id) DO UPDATE SET 
         status = EXCLUDED.status, 
         alert_data = EXCLUDED.alert_data, 
         timestamp = EXCLUDED.timestamp`,
        [alert.id, alert.title, alert.level, alert.category, alert.status, alertData, alert.timestamp]
      );

    } catch (error) {
      logger.error('Failed to persist alert', error, { alertId: alert.id });
    }
  }

  /**
   * 缓存指标
   */
  private async cacheMetrics(metrics: AlertMetrics): Promise<void> {
    try {
      const cacheKey = `alert_metrics:latest`;
      const metricsData = JSON.stringify(metrics);
      await this.redis.setex(cacheKey, 3600, metricsData);

      // 存储时序数据
      const timeSeriesKey = `alert_metrics:${metrics.timestamp.toISOString().split('T')[0]}`;
      await this.redis.zadd(timeSeriesKey, metrics.timestamp.getTime(), metricsData);
      await this.redis.expire(timeSeriesKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to cache alert metrics', error);
    }
  }

  /**
   * 加载配置
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // 从数据库加载告警规则、通知渠道、模板等配置
      await this.loadAlertRules();
      await this.loadNotificationChannels();
      await this.loadAlertTemplates();
      
      logger.info('Alert configuration loaded', {
        rules: this.alertRules.size,
        channels: this.notificationChannels.size,
        templates: this.alertTemplates.size
      });

    } catch (error) {
      logger.error('Failed to load alert configuration', error);
    }
  }

  /**
   * 加载告警规则
   */
  private async loadAlertRules(): Promise<void> {
    // 这里应该从数据库加载告警规则
    // 暂时使用默认规则
    const defaultRules: AlertRule[] = [
      {
        id: 'critical-alerts',
        name: 'Critical Alerts',
        description: 'Handle all critical alerts',
        enabled: true,
        category: 'all',
        conditions: [],
        actions: [
          {
            type: 'notification',
            channels: ['email', 'slack'],
            recipients: ['admin@example.com', '#alerts'],
            template: 'critical',
            enabled: true
          }
        ],
        cooldownPeriod: 300, // 5分钟
        maxAlerts: 10,
        escalationRules: [
          {
            level: 1,
            delay: 600, // 10分钟
            recipients: ['manager@example.com'],
            channels: ['email'],
            condition: 'unacknowledged',
            enabled: true
          }
        ],
        tags: ['critical'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * 加载通知渠道
   */
  private async loadNotificationChannels(): Promise<void> {
    // 默认通知渠道
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'email',
        name: 'Email',
        type: 'email',
        enabled: true,
        config: {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          from: process.env.SMTP_FROM || 'alerts@example.com'
        },
        rateLimit: {
          maxPerMinute: 10,
          maxPerHour: 100
        },
        failureCount: 0
      },
      {
        id: 'slack',
        name: 'Slack',
        type: 'slack',
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL
        },
        rateLimit: {
          maxPerMinute: 30,
          maxPerHour: 1000
        },
        failureCount: 0
      }
    ];

    defaultChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });
  }

  /**
   * 加载告警模板
   */
  private async loadAlertTemplates(): Promise<void> {
    const defaultTemplates: AlertTemplate[] = [
      {
        id: 'default',
        name: 'Default Alert Template',
        category: 'all',
        subject: '告警: {{alert.title}}',
        body: `
告警详情：
- 标题：{{alert.title}}
- 消息：{{alert.message}}
- 级别：{{alert.level}}
- 类别：{{alert.category}}
- 来源：{{alert.source}}
- 时间：{{alert.timestamp}}
- ID：{{alert.id}}

请及时处理此告警。
        `.trim(),
        variables: ['alert.title', 'alert.message', 'alert.level', 'alert.category', 'alert.source', 'alert.timestamp', 'alert.id'],
        format: 'text'
      },
      {
        id: 'critical',
        name: 'Critical Alert Template',
        category: 'all',
        subject: '🚨 严重告警: {{alert.title}}',
        body: `
🚨 检测到严重告警 🚨

告警信息：
📋 标题：{{alert.title}}
📝 描述：{{alert.message}}
⚠️  级别：{{alert.level}}
🏷️  类别：{{alert.category}}
🔍 来源：{{alert.source}}
⏰ 时间：{{alert.timestamp}}
🆔 ID：{{alert.id}}

⚡ 此告警需要立即处理，请及时响应！
        `.trim(),
        variables: ['alert.title', 'alert.message', 'alert.level', 'alert.category', 'alert.source', 'alert.timestamp', 'alert.id'],
        format: 'text'
      }
    ];

    defaultTemplates.forEach(template => {
      this.alertTemplates.set(template.id, template);
    });
  }

  /**
   * 初始化默认设置
   */
  private initializeDefaults(): void {
    logger.info('Initializing intelligent alerting system defaults');
  }

  /**
   * 获取告警统计
   */
  getAlertStatistics(): {
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    silenced: number;
    escalated: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const stats = {
      total: alerts.length,
      active: 0,
      acknowledged: 0,
      resolved: 0,
      silenced: 0,
      escalated: 0,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>
    };

    alerts.forEach(alert => {
      // 按状态统计
      switch (alert.status) {
        case 'active':
          stats.active++;
          break;
        case 'acknowledged':
          stats.acknowledged++;
          break;
        case 'resolved':
          stats.resolved++;
          break;
        case 'silenced':
          stats.silenced++;
          break;
      }

      if (alert.escalated) stats.escalated++;

      // 按级别统计
      stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;

      // 按类别统计
      stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1;
    });

    return stats;
  }

  /**
   * 获取告警列表
   */
  getAlerts(filters?: {
    status?: Alert['status'];
    level?: Alert['level'];
    category?: Alert['category'];
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters.level) {
        alerts = alerts.filter(a => a.level === filters.level);
      }
      if (filters.category) {
        alerts = alerts.filter(a => a.category === filters.category);
      }
      if (filters.limit) {
        alerts = alerts.slice(0, filters.limit);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取告警详情
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }
}

export default IntelligentAlertingSystem;