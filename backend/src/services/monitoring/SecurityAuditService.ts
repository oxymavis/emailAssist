/**
 * Security Audit Service
 * 安全监控和审计服务，提供身份验证监控、访问控制审计、敏感操作日志记录等安全相关功能
 */

import EventEmitter from 'events';
import crypto from 'crypto';
import { Request } from 'express';
import logger from '@/utils/logger';
import { Redis } from 'ioredis';
import DatabaseManager from '@/config/database';

export interface AuthenticationEvent {
  id: string;
  type: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'password_changed' | 'account_locked';
  userId?: string;
  username?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  details: {
    success: boolean;
    failureReason?: string;
    sessionId?: string;
    location?: {
      country?: string;
      city?: string;
      region?: string;
    };
    deviceInfo?: {
      browser?: string;
      os?: string;
      isMobile?: boolean;
    };
  };
  riskScore: number;  // 风险评分 0-100
}

export interface AccessControlEvent {
  id: string;
  type: 'access_granted' | 'access_denied' | 'permission_escalation' | 'role_changed';
  userId: string;
  resource: string;
  action: string;
  ip: string;
  timestamp: Date;
  details: {
    success: boolean;
    requiredPermissions: string[];
    userPermissions: string[];
    denialReason?: string;
    oldRole?: string;
    newRole?: string;
  };
  riskScore: number;
}

export interface SensitiveOperationEvent {
  id: string;
  type: 'data_export' | 'data_deletion' | 'configuration_change' | 'user_management' | 'system_access';
  userId: string;
  operation: string;
  resource: string;
  ip: string;
  timestamp: Date;
  details: {
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    affectedRecords?: number;
    operationParams?: Record<string, any>;
    approvalRequired?: boolean;
    approvedBy?: string;
  };
  riskScore: number;
}

export interface SecurityAnomaly {
  id: string;
  type: 'suspicious_login' | 'unusual_access_pattern' | 'brute_force_attack' | 'privilege_abuse' | 'data_exfiltration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  timestamp: Date;
  description: string;
  indicators: string[];
  relatedEvents: string[]; // 关联事件ID
  investigated: boolean;
  resolved: boolean;
  details: Record<string, any>;
}

export interface SecurityMetrics {
  timestamp: Date;
  authentication: {
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    successRate: number;
    uniqueUsers: number;
    suspiciousLogins: number;
    blockedIPs: number;
  };
  accessControl: {
    totalRequests: number;
    grantedRequests: number;
    deniedRequests: number;
    privilegeEscalations: number;
    unauthorizedAttempts: number;
  };
  sensitiveOperations: {
    totalOperations: number;
    dataExports: number;
    dataDeletions: number;
    configChanges: number;
    highRiskOperations: number;
  };
  anomalies: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    pending: number;
  };
}

export interface ThreatIntelligence {
  ip: string;
  threats: string[];
  riskScore: number;
  lastSeen: Date;
  source: string;
  details: Record<string, any>;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  type: 'authentication' | 'access_control' | 'data_protection' | 'monitoring';
  enabled: boolean;
  rules: SecurityRule[];
  severity: 'info' | 'warning' | 'critical';
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRule {
  id: string;
  condition: string;
  action: 'log' | 'alert' | 'block' | 'require_approval';
  parameters: Record<string, any>;
  enabled: boolean;
}

export class SecurityAuditService extends EventEmitter {
  private redis: Redis;
  private authEvents: AuthenticationEvent[] = [];
  private accessEvents: AccessControlEvent[] = [];
  private operationEvents: SensitiveOperationEvent[] = [];
  private anomalies: SecurityAnomaly[] = [];
  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();
  private securityPolicies: SecurityPolicy[] = [];
  private metrics: SecurityMetrics[] = [];
  
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MAX_EVENTS_HISTORY = 50000;
  private readonly MAX_METRICS_HISTORY = 2880; // 24小时
  
  // 风险评分权重
  private readonly riskWeights = {
    failedLoginAttempts: 10,
    unusualLocation: 20,
    unusualTimeAccess: 15,
    privilegeEscalation: 30,
    suspiciousUserAgent: 5,
    knownThreatIP: 50,
    multipleFailuresShortTime: 25,
    accessOutsideBusinessHours: 10,
    dataExportVolume: 20,
    configurationChanges: 15
  };

  // IP黑名单
  private blockedIPs: Set<string> = new Set();
  
  // 用户登录失败计数
  private loginFailures: Map<string, { count: number; lastAttempt: Date; blocked: boolean }> = new Map();

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.initializeSecurityPolicies();
  }

  /**
   * 启动安全监控
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting security monitoring', { intervalMs });

    // 加载威胁情报
    await this.loadThreatIntelligence();

    // 加载安全策略
    await this.loadSecurityPolicies();

    this.monitoringInterval = setInterval(async () => {
      await this.collectSecurityMetrics();
      await this.detectAnomalies();
    }, intervalMs);

    // 立即收集一次指标
    await this.collectSecurityMetrics();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Security monitoring stopped');
  }

  /**
   * 记录身份验证事件
   */
  async recordAuthenticationEvent(
    type: AuthenticationEvent['type'],
    userId: string | undefined,
    username: string | undefined,
    req: Request,
    details: Partial<AuthenticationEvent['details']> = {}
  ): Promise<void> {
    const event: AuthenticationEvent = {
      id: this.generateEventId(),
      type,
      userId,
      username,
      ip: this.extractIP(req),
      userAgent: req.get('User-Agent') || '',
      timestamp: new Date(),
      details: {
        success: type !== 'login_failed',
        ...details
      },
      riskScore: 0
    };

    // 计算风险评分
    event.riskScore = await this.calculateAuthRiskScore(event, req);

    // 检查是否需要阻止IP
    if (type === 'login_failed') {
      await this.handleFailedLogin(event);
    } else if (type === 'login') {
      await this.handleSuccessfulLogin(event);
    }

    // 存储事件
    this.authEvents.push(event);
    if (this.authEvents.length > this.MAX_EVENTS_HISTORY) {
      this.authEvents.shift();
    }

    // 持久化事件
    await this.persistEvent('auth', event);

    // 检查安全策略
    await this.checkSecurityPolicies(event);

    this.emit('authenticationEvent', event);

    // 记录高风险事件
    if (event.riskScore >= 70) {
      logger.warn('High risk authentication event', {
        type: event.type,
        userId: event.userId,
        ip: event.ip,
        riskScore: event.riskScore
      });
    }
  }

  /**
   * 记录访问控制事件
   */
  async recordAccessControlEvent(
    type: AccessControlEvent['type'],
    userId: string,
    resource: string,
    action: string,
    req: Request,
    details: Partial<AccessControlEvent['details']> = {}
  ): Promise<void> {
    const event: AccessControlEvent = {
      id: this.generateEventId(),
      type,
      userId,
      resource,
      action,
      ip: this.extractIP(req),
      timestamp: new Date(),
      details: {
        success: type === 'access_granted',
        requiredPermissions: [],
        userPermissions: [],
        ...details
      },
      riskScore: 0
    };

    // 计算风险评分
    event.riskScore = await this.calculateAccessRiskScore(event);

    // 存储事件
    this.accessEvents.push(event);
    if (this.accessEvents.length > this.MAX_EVENTS_HISTORY) {
      this.accessEvents.shift();
    }

    // 持久化事件
    await this.persistEvent('access', event);

    // 检查安全策略
    await this.checkSecurityPolicies(event);

    this.emit('accessControlEvent', event);

    // 记录拒绝访问事件
    if (type === 'access_denied') {
      logger.warn('Access denied', {
        userId,
        resource,
        action,
        ip: event.ip,
        reason: details.denialReason
      });
    }
  }

  /**
   * 记录敏感操作事件
   */
  async recordSensitiveOperation(
    type: SensitiveOperationEvent['type'],
    userId: string,
    operation: string,
    resource: string,
    req: Request,
    details: Partial<SensitiveOperationEvent['details']> = {}
  ): Promise<void> {
    const event: SensitiveOperationEvent = {
      id: this.generateEventId(),
      type,
      userId,
      operation,
      resource,
      ip: this.extractIP(req),
      timestamp: new Date(),
      details,
      riskScore: 0
    };

    // 计算风险评分
    event.riskScore = await this.calculateOperationRiskScore(event);

    // 存储事件
    this.operationEvents.push(event);
    if (this.operationEvents.length > this.MAX_EVENTS_HISTORY) {
      this.operationEvents.shift();
    }

    // 持久化事件
    await this.persistEvent('operation', event);

    // 检查安全策略
    await this.checkSecurityPolicies(event);

    this.emit('sensitiveOperationEvent', event);

    // 记录高风险操作
    if (event.riskScore >= 60) {
      logger.error('High risk sensitive operation', {
        type: event.type,
        userId: event.userId,
        operation: event.operation,
        resource: event.resource,
        riskScore: event.riskScore
      });
    }
  }

  /**
   * 计算身份验证风险评分
   */
  private async calculateAuthRiskScore(event: AuthenticationEvent, req: Request): Promise<number> {
    let score = 0;

    // 失败登录增加风险
    if (!event.details.success) {
      score += this.riskWeights.failedLoginAttempts;
      
      // 检查短时间内多次失败
      const key = `${event.ip}:${event.username}`;
      const failures = this.loginFailures.get(key);
      if (failures && failures.count > 3) {
        score += this.riskWeights.multipleFailuresShortTime;
      }
    }

    // 检查威胁情报
    const threatInfo = this.threatIntelligence.get(event.ip);
    if (threatInfo) {
      score += this.riskWeights.knownThreatIP;
    }

    // 检查用户代理
    if (this.isSuspiciousUserAgent(event.userAgent)) {
      score += this.riskWeights.suspiciousUserAgent;
    }

    // 检查访问时间（非工作时间）
    if (this.isOutsideBusinessHours(event.timestamp)) {
      score += this.riskWeights.accessOutsideBusinessHours;
    }

    // 检查地理位置异常（需要IP地理位置服务）
    if (await this.isUnusualLocation(event.userId, event.ip)) {
      score += this.riskWeights.unusualLocation;
    }

    return Math.min(100, score);
  }

  /**
   * 计算访问控制风险评分
   */
  private async calculateAccessRiskScore(event: AccessControlEvent): Promise<number> {
    let score = 0;

    // 拒绝访问增加风险
    if (!event.details.success) {
      score += 20;
    }

    // 权限提升高风险
    if (event.type === 'permission_escalation') {
      score += this.riskWeights.privilegeEscalation;
    }

    // 角色变更
    if (event.type === 'role_changed') {
      score += 15;
    }

    // 检查威胁IP
    const threatInfo = this.threatIntelligence.get(event.ip);
    if (threatInfo) {
      score += this.riskWeights.knownThreatIP;
    }

    // 检查访问时间
    if (this.isOutsideBusinessHours(event.timestamp)) {
      score += this.riskWeights.accessOutsideBusinessHours;
    }

    return Math.min(100, score);
  }

  /**
   * 计算敏感操作风险评分
   */
  private async calculateOperationRiskScore(event: SensitiveOperationEvent): Promise<number> {
    let score = 0;

    // 不同操作类型的基础风险
    switch (event.type) {
      case 'data_deletion':
        score += 40;
        break;
      case 'data_export':
        score += 30;
        if (event.details.affectedRecords && event.details.affectedRecords > 1000) {
          score += this.riskWeights.dataExportVolume;
        }
        break;
      case 'configuration_change':
        score += this.riskWeights.configurationChanges;
        break;
      case 'user_management':
        score += 25;
        break;
      case 'system_access':
        score += 20;
        break;
    }

    // 检查威胁IP
    const threatInfo = this.threatIntelligence.get(event.ip);
    if (threatInfo) {
      score += this.riskWeights.knownThreatIP;
    }

    // 检查访问时间
    if (this.isOutsideBusinessHours(event.timestamp)) {
      score += this.riskWeights.accessOutsideBusinessHours;
    }

    return Math.min(100, score);
  }

  /**
   * 处理失败登录
   */
  private async handleFailedLogin(event: AuthenticationEvent): Promise<void> {
    const key = `${event.ip}:${event.username}`;
    const now = new Date();
    
    let failures = this.loginFailures.get(key);
    if (!failures) {
      failures = { count: 0, lastAttempt: now, blocked: false };
      this.loginFailures.set(key, failures);
    }

    failures.count++;
    failures.lastAttempt = now;

    // 如果1小时内失败次数超过10次，阻止IP
    if (failures.count >= 10) {
      failures.blocked = true;
      this.blockedIPs.add(event.ip);
      
      // 缓存阻止状态
      await this.redis.setex(`blocked_ip:${event.ip}`, 3600, '1'); // 1小时
      
      logger.warn('IP blocked due to multiple failed login attempts', {
        ip: event.ip,
        username: event.username,
        attempts: failures.count
      });

      // 创建异常记录
      await this.createAnomaly({
        type: 'brute_force_attack',
        severity: 'high',
        userId: event.userId,
        ip: event.ip,
        description: `IP ${event.ip} blocked after ${failures.count} failed login attempts`,
        indicators: ['multiple_failed_logins', 'time_pattern_suspicious'],
        relatedEvents: [event.id],
        details: {
          attempts: failures.count,
          username: event.username,
          timeSpan: '1 hour'
        }
      });
    }
  }

  /**
   * 处理成功登录
   */
  private async handleSuccessfulLogin(event: AuthenticationEvent): Promise<void> {
    const key = `${event.ip}:${event.username}`;
    
    // 清除失败计数
    if (this.loginFailures.has(key)) {
      this.loginFailures.delete(key);
    }

    // 记录用户位置（用于异常检测）
    if (event.userId) {
      const locationKey = `user_location:${event.userId}`;
      await this.redis.lpush(locationKey, JSON.stringify({
        ip: event.ip,
        timestamp: event.timestamp.toISOString(),
        location: event.details.location
      }));
      await this.redis.ltrim(locationKey, 0, 10); // 保留最近10次位置
      await this.redis.expire(locationKey, 30 * 24 * 3600); // 30天过期
    }
  }

  /**
   * 检查是否为可疑用户代理
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /curl/i,
      /wget/i,
      /postman/i,
      /^$/,
      /hack/i,
      /scan/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * 检查是否在工作时间外
   */
  private isOutsideBusinessHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    
    // 假设工作时间为周一到周五 9:00-18:00
    return day === 0 || day === 6 || hour < 9 || hour >= 18;
  }

  /**
   * 检查是否为异常位置
   */
  private async isUnusualLocation(userId: string | undefined, ip: string): Promise<boolean> {
    if (!userId) return false;

    try {
      const locationKey = `user_location:${userId}`;
      const recentLocations = await this.redis.lrange(locationKey, 0, 4); // 获取最近5次位置
      
      if (recentLocations.length < 2) return false;

      // 简单的地理位置检查（实际应用中需要IP地理位置服务）
      const currentIPClass = this.getIPClass(ip);
      const recentIPClasses = recentLocations.map(loc => {
        const data = JSON.parse(loc);
        return this.getIPClass(data.ip);
      });

      // 如果IP段完全不同，认为是异常位置
      return !recentIPClasses.includes(currentIPClass);

    } catch (error) {
      logger.debug('Failed to check unusual location', error);
      return false;
    }
  }

  /**
   * 获取IP地址类别（简化版）
   */
  private getIPClass(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return ip;
  }

  /**
   * 提取客户端IP
   */
  private extractIP(req: Request): string {
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    const cfConnectingIP = req.get('CF-Connecting-IP');
    
    return cfConnectingIP || xRealIP || (xForwardedFor && xForwardedFor.split(',')[0]) || req.ip || 'unknown';
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 持久化事件到数据库
   */
  private async persistEvent(type: 'auth' | 'access' | 'operation', event: any): Promise<void> {
    try {
      const db = DatabaseManager;
      
      const tableName = `security_${type}_events`;
      const eventData = JSON.stringify(event);
      
      await db.query(
        `INSERT INTO ${tableName} (id, event_data, timestamp, user_id, ip, risk_score) VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, eventData, event.timestamp, event.userId || null, event.ip, event.riskScore]
      );

    } catch (error) {
      logger.error(`Failed to persist ${type} event`, error);
    }
  }

  /**
   * 检查安全策略
   */
  private async checkSecurityPolicies(event: any): Promise<void> {
    for (const policy of this.securityPolicies) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        if (!rule.enabled) continue;

        const matched = await this.evaluateSecurityRule(rule, event);
        if (matched) {
          await this.executeSecurityAction(rule, policy, event);
        }
      }
    }
  }

  /**
   * 评估安全规则
   */
  private async evaluateSecurityRule(rule: SecurityRule, event: any): Promise<boolean> {
    try {
      // 简化的规则评估逻辑
      const condition = rule.condition;
      
      // 支持的条件类型
      if (condition.includes('risk_score >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return event.riskScore > threshold;
      }
      
      if (condition.includes('failed_login_count >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        if (event.type === 'login_failed') {
          const key = `${event.ip}:${event.username}`;
          const failures = this.loginFailures.get(key);
          return failures ? failures.count > threshold : false;
        }
      }

      if (condition.includes('sensitive_operation')) {
        return event.type && ['data_export', 'data_deletion', 'configuration_change'].includes(event.type);
      }

      return false;

    } catch (error) {
      logger.error('Failed to evaluate security rule', error);
      return false;
    }
  }

  /**
   * 执行安全动作
   */
  private async executeSecurityAction(
    rule: SecurityRule,
    policy: SecurityPolicy,
    event: any
  ): Promise<void> {
    try {
      switch (rule.action) {
        case 'log':
          logger.info('Security policy triggered', {
            policyName: policy.name,
            ruleId: rule.id,
            eventId: event.id,
            eventType: event.type
          });
          break;

        case 'alert':
          await this.createAnomaly({
            type: 'privilege_abuse',
            severity: policy.severity as any,
            userId: event.userId,
            ip: event.ip,
            description: `Security policy "${policy.name}" triggered`,
            indicators: ['policy_violation'],
            relatedEvents: [event.id],
            details: {
              policyName: policy.name,
              ruleId: rule.id,
              ruleParameters: rule.parameters
            }
          });
          break;

        case 'block':
          this.blockedIPs.add(event.ip);
          await this.redis.setex(`blocked_ip:${event.ip}`, 3600, '1');
          logger.warn('IP blocked by security policy', {
            ip: event.ip,
            policyName: policy.name
          });
          break;

        case 'require_approval':
          // 实现审批流程（这里简化处理）
          logger.warn('Operation requires approval', {
            eventId: event.id,
            policyName: policy.name,
            userId: event.userId
          });
          break;
      }

    } catch (error) {
      logger.error('Failed to execute security action', error);
    }
  }

  /**
   * 创建异常记录
   */
  private async createAnomaly(anomalyData: Omit<SecurityAnomaly, 'id' | 'timestamp' | 'investigated' | 'resolved'>): Promise<void> {
    const anomaly: SecurityAnomaly = {
      id: this.generateEventId(),
      timestamp: new Date(),
      investigated: false,
      resolved: false,
      ...anomalyData
    };

    this.anomalies.push(anomaly);
    
    // 持久化异常
    try {
      const db = DatabaseManager;
      await db.query(
        `INSERT INTO security_anomalies (id, type, severity, user_id, ip, description, indicators, related_events, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          anomaly.id,
          anomaly.type,
          anomaly.severity,
          anomaly.userId || null,
          anomaly.ip,
          anomaly.description,
          JSON.stringify(anomaly.indicators),
          JSON.stringify(anomaly.relatedEvents),
          JSON.stringify(anomaly.details),
          anomaly.timestamp
        ]
      );
    } catch (error) {
      logger.error('Failed to persist security anomaly', error);
    }

    this.emit('securityAnomaly', anomaly);

    if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
      logger.error('High severity security anomaly detected', anomaly);
    }
  }

  /**
   * 检测异常
   */
  private async detectAnomalies(): Promise<void> {
    try {
      // 检测暴力破解攻击
      await this.detectBruteForceAttacks();
      
      // 检测异常访问模式
      await this.detectUnusualAccessPatterns();
      
      // 检测数据外泄
      await this.detectDataExfiltration();

    } catch (error) {
      logger.error('Failed to detect anomalies', error);
    }
  }

  /**
   * 检测暴力破解攻击
   */
  private async detectBruteForceAttacks(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 统计最近1小时的失败登录
    const recentFailures = this.authEvents.filter(event => 
      event.type === 'login_failed' && 
      event.timestamp >= oneHourAgo
    );

    // 按IP分组
    const failuresByIP: Record<string, AuthenticationEvent[]> = {};
    recentFailures.forEach(event => {
      if (!failuresByIP[event.ip]) {
        failuresByIP[event.ip] = [];
      }
      failuresByIP[event.ip].push(event);
    });

    // 检测超过阈值的IP
    for (const [ip, failures] of Object.entries(failuresByIP)) {
      if (failures.length >= 20) { // 1小时内20次失败登录
        const usernames = [...new Set(failures.map(f => f.username).filter(Boolean))];
        
        await this.createAnomaly({
          type: 'brute_force_attack',
          severity: 'high',
          ip,
          description: `Detected brute force attack from IP ${ip}: ${failures.length} failed attempts in 1 hour`,
          indicators: [
            'high_failure_rate',
            'multiple_usernames',
            'time_clustering'
          ],
          relatedEvents: failures.map(f => f.id),
          details: {
            attemptCount: failures.length,
            targetUsernames: usernames,
            timeSpan: '1 hour'
          }
        });
      }
    }
  }

  /**
   * 检测异常访问模式
   */
  private async detectUnusualAccessPatterns(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 检测高频访问
    const recentAccess = this.accessEvents.filter(event => event.timestamp >= oneHourAgo);
    
    // 按用户分组
    const accessByUser: Record<string, AccessControlEvent[]> = {};
    recentAccess.forEach(event => {
      if (!accessByUser[event.userId]) {
        accessByUser[event.userId] = [];
      }
      accessByUser[event.userId].push(event);
    });

    // 检测异常高频用户
    for (const [userId, accesses] of Object.entries(accessByUser)) {
      if (accesses.length >= 1000) { // 1小时内1000次访问
        await this.createAnomaly({
          type: 'unusual_access_pattern',
          severity: 'medium',
          userId,
          ip: accesses[0].ip,
          description: `User ${userId} has unusual high access frequency: ${accesses.length} requests in 1 hour`,
          indicators: ['high_frequency_access', 'potential_automation'],
          relatedEvents: accesses.map(a => a.id),
          details: {
            accessCount: accesses.length,
            timeSpan: '1 hour',
            uniqueResources: [...new Set(accesses.map(a => a.resource))].length
          }
        });
      }
    }
  }

  /**
   * 检测数据外泄
   */
  private async detectDataExfiltration(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 检测大量数据导出
    const recentExports = this.operationEvents.filter(event => 
      event.type === 'data_export' && 
      event.timestamp >= oneDayAgo
    );

    // 按用户分组
    const exportsByUser: Record<string, SensitiveOperationEvent[]> = {};
    recentExports.forEach(event => {
      if (!exportsByUser[event.userId]) {
        exportsByUser[event.userId] = [];
      }
      exportsByUser[event.userId].push(event);
    });

    // 检测异常导出行为
    for (const [userId, exports] of Object.entries(exportsByUser)) {
      const totalRecords = exports.reduce((sum, exp) => 
        sum + (exp.details.affectedRecords || 0), 0
      );

      if (totalRecords >= 10000) { // 24小时内导出1万条记录
        await this.createAnomaly({
          type: 'data_exfiltration',
          severity: 'critical',
          userId,
          ip: exports[0].ip,
          description: `Potential data exfiltration: User ${userId} exported ${totalRecords} records in 24 hours`,
          indicators: ['large_data_export', 'multiple_exports', 'suspicious_timing'],
          relatedEvents: exports.map(e => e.id),
          details: {
            totalRecords,
            exportCount: exports.length,
            timeSpan: '24 hours'
          }
        });
      }
    }
  }

  /**
   * 收集安全指标
   */
  private async collectSecurityMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

      // 过滤最近一小时的事件
      const recentAuth = this.authEvents.filter(e => e.timestamp >= oneHourAgo);
      const recentAccess = this.accessEvents.filter(e => e.timestamp >= oneHourAgo);
      const recentOperations = this.operationEvents.filter(e => e.timestamp >= oneHourAgo);
      const recentAnomalies = this.anomalies.filter(a => a.timestamp >= oneHourAgo);

      const metrics: SecurityMetrics = {
        timestamp,
        authentication: this.calculateAuthMetrics(recentAuth),
        accessControl: this.calculateAccessMetrics(recentAccess),
        sensitiveOperations: this.calculateOperationMetrics(recentOperations),
        anomalies: this.calculateAnomalyMetrics(recentAnomalies)
      };

      this.metrics.push(metrics);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // 缓存指标
      await this.cacheSecurityMetrics(metrics);

      this.emit('securityMetrics', metrics);

    } catch (error) {
      logger.error('Failed to collect security metrics', error);
    }
  }

  /**
   * 计算认证指标
   */
  private calculateAuthMetrics(events: AuthenticationEvent[]): SecurityMetrics['authentication'] {
    const logins = events.filter(e => e.type === 'login' || e.type === 'login_failed');
    const successful = events.filter(e => e.type === 'login');
    const failed = events.filter(e => e.type === 'login_failed');
    const suspicious = events.filter(e => e.riskScore >= 70);
    const uniqueUsers = new Set(events.filter(e => e.userId).map(e => e.userId)).size;

    return {
      totalLogins: logins.length,
      successfulLogins: successful.length,
      failedLogins: failed.length,
      successRate: logins.length > 0 ? Math.round((successful.length / logins.length) * 100) : 100,
      uniqueUsers,
      suspiciousLogins: suspicious.length,
      blockedIPs: this.blockedIPs.size
    };
  }

  /**
   * 计算访问控制指标
   */
  private calculateAccessMetrics(events: AccessControlEvent[]): SecurityMetrics['accessControl'] {
    const granted = events.filter(e => e.type === 'access_granted');
    const denied = events.filter(e => e.type === 'access_denied');
    const escalations = events.filter(e => e.type === 'permission_escalation');

    return {
      totalRequests: events.length,
      grantedRequests: granted.length,
      deniedRequests: denied.length,
      privilegeEscalations: escalations.length,
      unauthorizedAttempts: denied.length
    };
  }

  /**
   * 计算敏感操作指标
   */
  private calculateOperationMetrics(events: SensitiveOperationEvent[]): SecurityMetrics['sensitiveOperations'] {
    const exports = events.filter(e => e.type === 'data_export');
    const deletions = events.filter(e => e.type === 'data_deletion');
    const configs = events.filter(e => e.type === 'configuration_change');
    const highRisk = events.filter(e => e.riskScore >= 60);

    return {
      totalOperations: events.length,
      dataExports: exports.length,
      dataDeletions: deletions.length,
      configChanges: configs.length,
      highRiskOperations: highRisk.length
    };
  }

  /**
   * 计算异常指标
   */
  private calculateAnomalyMetrics(anomalies: SecurityAnomaly[]): SecurityMetrics['anomalies'] {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let resolved = 0;

    anomalies.forEach(anomaly => {
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      if (anomaly.resolved) resolved++;
    });

    return {
      total: anomalies.length,
      byType,
      bySeverity,
      resolved,
      pending: anomalies.length - resolved
    };
  }

  /**
   * 缓存安全指标
   */
  private async cacheSecurityMetrics(metrics: SecurityMetrics): Promise<void> {
    try {
      const cacheKey = `security_metrics:latest`;
      const metricsData = JSON.stringify(metrics);
      await this.redis.setex(cacheKey, 3600, metricsData);

      // 存储时序数据
      const timeSeriesKey = `security_metrics:${metrics.timestamp.toISOString().split('T')[0]}`;
      await this.redis.zadd(timeSeriesKey, metrics.timestamp.getTime(), metricsData);
      await this.redis.expire(timeSeriesKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to cache security metrics', error);
    }
  }

  /**
   * 初始化安全策略
   */
  private initializeSecurityPolicies(): void {
    this.securityPolicies = [
      {
        id: 'high-risk-auth',
        name: 'High Risk Authentication',
        type: 'authentication',
        enabled: true,
        severity: 'warning',
        description: 'Monitor high risk authentication attempts',
        rules: [
          {
            id: 'high-risk-score',
            condition: 'risk_score > 70',
            action: 'alert',
            parameters: { threshold: 70 },
            enabled: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'brute-force-protection',
        name: 'Brute Force Protection',
        type: 'authentication',
        enabled: true,
        severity: 'critical',
        description: 'Protect against brute force attacks',
        rules: [
          {
            id: 'multiple-failures',
            condition: 'failed_login_count > 5',
            action: 'block',
            parameters: { threshold: 5, duration: 3600 },
            enabled: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'sensitive-operations',
        name: 'Sensitive Operations Monitoring',
        type: 'data_protection',
        enabled: true,
        severity: 'warning',
        description: 'Monitor sensitive data operations',
        rules: [
          {
            id: 'sensitive-ops',
            condition: 'sensitive_operation',
            action: 'log',
            parameters: {},
            enabled: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * 加载威胁情报
   */
  private async loadThreatIntelligence(): Promise<void> {
    try {
      // 这里应该从威胁情报数据库或第三方服务加载
      // 示例数据
      const threatData = [
        {
          ip: '192.168.1.100',
          threats: ['brute_force', 'malware'],
          riskScore: 85,
          source: 'internal_detection'
        }
      ];

      threatData.forEach(threat => {
        this.threatIntelligence.set(threat.ip, {
          ...threat,
          lastSeen: new Date(),
          details: {}
        });
      });

      logger.info('Threat intelligence loaded', { count: this.threatIntelligence.size });

    } catch (error) {
      logger.error('Failed to load threat intelligence', error);
    }
  }

  /**
   * 加载安全策略
   */
  private async loadSecurityPolicies(): Promise<void> {
    try {
      // 这里可以从数据库加载自定义策略
      logger.info('Security policies loaded', { count: this.securityPolicies.length });

    } catch (error) {
      logger.error('Failed to load security policies', error);
    }
  }

  /**
   * 检查IP是否被阻止
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    if (this.blockedIPs.has(ip)) return true;
    
    const blocked = await this.redis.get(`blocked_ip:${ip}`);
    return blocked === '1';
  }

  /**
   * 获取安全状态摘要
   */
  getSecurityStatus(): {
    status: 'secure' | 'warning' | 'critical';
    metrics: SecurityMetrics | null;
    activeAnomalies: SecurityAnomaly[];
    summary: string;
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1] || null;
    const activeAnomalies = this.anomalies.filter(a => !a.resolved);
    
    let status: 'secure' | 'warning' | 'critical' = 'secure';
    
    if (activeAnomalies.some(a => a.severity === 'critical')) {
      status = 'critical';
    } else if (activeAnomalies.some(a => a.severity === 'high' || a.severity === 'medium')) {
      status = 'warning';
    }

    const summary = this.generateSecuritySummary(status, activeAnomalies.length, currentMetrics);

    return {
      status,
      metrics: currentMetrics,
      activeAnomalies,
      summary
    };
  }

  /**
   * 生成安全状态摘要
   */
  private generateSecuritySummary(
    status: string,
    anomalyCount: number,
    metrics: SecurityMetrics | null
  ): string {
    if (status === 'critical') {
      return `安全状态严重：检测到${anomalyCount}个严重安全异常，需要立即处理`;
    } else if (status === 'warning') {
      return `安全状态警告：检测到${anomalyCount}个安全异常，建议及时调查`;
    } else {
      if (!metrics) {
        return '安全监控正在初始化中';
      }
      return `安全状态正常：登录成功率${metrics.authentication.successRate}%，` +
             `访问控制正常，${metrics.anomalies.total}个异常已处理`;
    }
  }
}

export default SecurityAuditService;