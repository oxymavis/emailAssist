import { EventEmitter } from 'events';
import { 
  EmailProvider, 
  IEmailService, 
  OAuthTokens, 
  UnifiedEmailMessage, 
  EmailSearchQuery, 
  EmailSendRequest, 
  EmailOperationResult, 
  RateLimitStatus,
  RateLimitConfig 
} from '../../types';
import { logger } from '../../utils/logger';

/**
 * 邮件服务抽象基类
 * 定义所有邮件服务提供商的通用接口和行为
 */
export abstract class BaseEmailService extends EventEmitter implements IEmailService {
  protected _isConnected: boolean = false;
  protected _rateLimitStatus: RateLimitStatus;
  protected _lastApiCall: Date = new Date();
  protected _apiCallCount: number = 0;

  constructor(
    public readonly provider: EmailProvider,
    protected config: any,
    protected rateLimitConfig: RateLimitConfig
  ) {
    super();
    this._rateLimitStatus = this.initializeRateLimitStatus();
  }

  // 抽象方法 - 子类必须实现
  abstract connect(config: any): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract authenticate(tokens: OAuthTokens): Promise<boolean>;
  abstract refreshTokens(): Promise<OAuthTokens>;
  abstract getMessages(query?: EmailSearchQuery): Promise<UnifiedEmailMessage[]>;
  abstract getMessage(messageId: string): Promise<UnifiedEmailMessage>;
  abstract sendMessage(message: EmailSendRequest): Promise<EmailOperationResult>;
  abstract deleteMessage(messageId: string): Promise<EmailOperationResult>;
  abstract markAsRead(messageId: string, isRead: boolean): Promise<EmailOperationResult>;
  abstract getFolders(): Promise<Array<{ id: string; name: string; type: string }>>;
  abstract moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult>;
  abstract syncMessages(options?: { incremental?: boolean; folderId?: string }): Promise<{
    newMessages: UnifiedEmailMessage[];
    updatedMessages: UnifiedEmailMessage[];
    deletedMessageIds: string[];
  }>;
  abstract getUserInfo(): Promise<{
    email: string;
    name: string;
    quota?: {
      used: number;
      total: number;
    };
  }>;

  // 通用实现方法
  public async isConnected(): Promise<boolean> {
    return this._isConnected;
  }

  /**
   * API调用前的速率限制检查
   */
  protected async checkRateLimit(): Promise<void> {
    const now = new Date();
    const timeSinceLastCall = now.getTime() - this._lastApiCall.getTime();
    
    // 更新计数器
    this.updateRateLimitCounters(now);
    
    // 检查是否超出限制
    if (this._rateLimitStatus.isThrottled) {
      const waitTime = this._rateLimitStatus.retryAfter || 1000;
      logger.warn(`Rate limit exceeded for ${this.provider}, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    // 确保最小间隔
    const minInterval = 1000 / this.rateLimitConfig.limits.requestsPerSecond;
    if (timeSinceLastCall < minInterval) {
      await this.sleep(minInterval - timeSinceLastCall);
    }
    
    this._lastApiCall = new Date();
    this._apiCallCount++;
  }

  /**
   * API调用包装器，自动处理速率限制和错误重试
   */
  protected async executeApiCall<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;
        
        logger.debug(`${this.provider} API call ${operationName} completed in ${duration}ms`);
        this.emit('apiCall', {
          provider: this.provider,
          operation: operationName,
          duration,
          success: true,
          attempt
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`${this.provider} API call ${operationName} failed (attempt ${attempt}/${maxRetries}):`, error);
        
        // 检查是否为速率限制错误
        if (this.isRateLimitError(error)) {
          const retryAfter = this.extractRetryAfter(error);
          if (retryAfter) {
            this._rateLimitStatus.isThrottled = true;
            this._rateLimitStatus.retryAfter = retryAfter;
            await this.sleep(retryAfter);
            continue;
          }
        }
        
        // 检查是否为临时错误
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          this.emit('apiCall', {
            provider: this.provider,
            operation: operationName,
            success: false,
            error: lastError,
            attempt
          });
          throw error;
        }
        
        // 指数退避
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.sleep(backoffTime);
      }
    }
    
    throw lastError;
  }

  /**
   * 将提供商特定的消息格式转换为统一格式
   */
  protected abstract convertToUnifiedMessage(message: any, accountId: string): UnifiedEmailMessage;

  /**
   * 处理错误并转换为标准格式
   */
  protected createErrorResult(error: Error, operation: string): EmailOperationResult {
    logger.error(`${this.provider} ${operation} error:`, error);
    
    return {
      success: false,
      error: {
        code: this.getErrorCode(error),
        message: error.message,
        details: error
      },
      metadata: {
        provider: this.provider,
        operationType: operation,
        timestamp: new Date(),
        executionTime: 0
      }
    };
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(data?: any, operation: string, startTime?: Date): EmailOperationResult {
    const executionTime = startTime ? Date.now() - startTime.getTime() : 0;
    
    return {
      success: true,
      data,
      metadata: {
        provider: this.provider,
        operationType: operation,
        timestamp: new Date(),
        executionTime
      }
    };
  }

  /**
   * 初始化速率限制状态
   */
  private initializeRateLimitStatus(): RateLimitStatus {
    const now = new Date();
    return {
      provider: this.provider,
      accountId: '', // 将由子类设置
      current: {
        requestsThisSecond: 0,
        requestsThisMinute: 0,
        requestsThisHour: 0,
        requestsThisDay: 0
      },
      limits: this.rateLimitConfig.limits,
      resetTimes: {
        second: new Date(now.getTime() + 1000),
        minute: new Date(now.getTime() + 60000),
        hour: new Date(now.getTime() + 3600000),
        day: new Date(now.getTime() + 86400000)
      },
      isThrottled: false
    };
  }

  /**
   * 更新速率限制计数器
   */
  private updateRateLimitCounters(now: Date): void {
    const status = this._rateLimitStatus;
    
    // 重置过期的计数器
    if (now >= status.resetTimes.second) {
      status.current.requestsThisSecond = 0;
      status.resetTimes.second = new Date(now.getTime() + 1000);
    }
    if (now >= status.resetTimes.minute) {
      status.current.requestsThisMinute = 0;
      status.resetTimes.minute = new Date(now.getTime() + 60000);
    }
    if (now >= status.resetTimes.hour) {
      status.current.requestsThisHour = 0;
      status.resetTimes.hour = new Date(now.getTime() + 3600000);
    }
    if (now >= status.resetTimes.day) {
      status.current.requestsThisDay = 0;
      status.resetTimes.day = new Date(now.getTime() + 86400000);
    }
    
    // 增加计数器
    status.current.requestsThisSecond++;
    status.current.requestsThisMinute++;
    status.current.requestsThisHour++;
    status.current.requestsThisDay++;
    
    // 检查是否达到限制
    status.isThrottled = (
      status.current.requestsThisSecond >= status.limits.requestsPerSecond ||
      status.current.requestsThisMinute >= status.limits.requestsPerMinute ||
      status.current.requestsThisHour >= status.limits.requestsPerHour ||
      status.current.requestsThisDay >= status.limits.requestsPerDay
    );
  }

  /**
   * 检查错误是否为速率限制错误
   */
  protected isRateLimitError(error: any): boolean {
    // 通用的速率限制错误检查
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }
    
    const message = error.message?.toLowerCase() || '';
    return message.includes('rate limit') || 
           message.includes('too many requests') ||
           message.includes('quota exceeded');
  }

  /**
   * 从错误中提取重试延迟时间
   */
  protected extractRetryAfter(error: any): number | null {
    // 检查Retry-After头
    if (error.headers && error.headers['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after']);
      return isNaN(retryAfter) ? null : retryAfter * 1000; // 转换为毫秒
    }
    
    // 检查响应体中的重试信息
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.retryAfterMs) {
        return data.retryAfterMs;
      }
      if (data.retryAfter) {
        return data.retryAfter * 1000;
      }
    }
    
    return null;
  }

  /**
   * 检查错误是否可重试
   */
  protected isRetryableError(error: any): boolean {
    // 网络错误
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
      return true;
    }
    
    // HTTP 5xx 错误
    const status = error.status || error.statusCode;
    if (status >= 500 && status < 600) {
      return true;
    }
    
    // 特定的临时错误状态码
    if (status === 408 || status === 423 || status === 429) {
      return true;
    }
    
    return false;
  }

  /**
   * 获取错误代码
   */
  protected getErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.status || error.statusCode) {
      return `HTTP_${error.status || error.statusCode}`;
    }
    if (error.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  /**
   * 延迟函数
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证邮件搜索查询
   */
  protected validateSearchQuery(query?: EmailSearchQuery): void {
    if (!query) return;
    
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      throw new Error('Search limit must be between 1 and 1000');
    }
    
    if (query.offset && query.offset < 0) {
      throw new Error('Search offset must be non-negative');
    }
    
    if (query.dateRange) {
      const { start, end } = query.dateRange;
      if (start >= end) {
        throw new Error('Date range start must be before end');
      }
    }
  }

  /**
   * 验证发送邮件请求
   */
  protected validateSendRequest(message: EmailSendRequest): void {
    if (!message.to || message.to.length === 0) {
      throw new Error('Email must have at least one recipient');
    }
    
    if (!message.subject || message.subject.trim().length === 0) {
      throw new Error('Email must have a subject');
    }
    
    if (!message.body || (!message.body.text && !message.body.html)) {
      throw new Error('Email must have body content');
    }
    
    // 验证邮件地址格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [
      ...message.to,
      ...(message.cc || []),
      ...(message.bcc || [])
    ];
    
    for (const recipient of allRecipients) {
      if (!emailRegex.test(recipient.address)) {
        throw new Error(`Invalid email address: ${recipient.address}`);
      }
    }
  }

  /**
   * 获取速率限制状态
   */
  public getRateLimitStatus(): RateLimitStatus {
    return { ...this._rateLimitStatus };
  }

  /**
   * 重置连接状态
   */
  protected setConnectionStatus(connected: boolean): void {
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this.emit('connectionChange', { provider: this.provider, connected });
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    try {
      await this.disconnect();
      this.removeAllListeners();
    } catch (error) {
      logger.error(`Error cleaning up ${this.provider} service:`, error);
    }
  }
}