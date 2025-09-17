import { 
  EmailProvider, 
  EmailProviderConfig, 
  IEmailService,
  RateLimitConfig,
  OAuthConfig 
} from '../../types';
import { BaseEmailService } from './BaseEmailService';
import logger from '../../utils/logger';
import config from '../../config';

/**
 * 邮件服务工厂类
 * 负责创建和管理不同的邮件服务实例
 */
export class EmailServiceFactory {
  private static instance: EmailServiceFactory;
  private serviceInstances: Map<string, IEmailService> = new Map();
  private providerConfigs: Map<EmailProvider, EmailProviderConfig> = new Map();
  private rateLimitConfigs: Map<EmailProvider, RateLimitConfig> = new Map();

  private constructor() {
    this.initializeProviderConfigs();
    this.initializeRateLimitConfigs();
  }

  public static getInstance(): EmailServiceFactory {
    if (!EmailServiceFactory.instance) {
      EmailServiceFactory.instance = new EmailServiceFactory();
    }
    return EmailServiceFactory.instance;
  }

  /**
   * 初始化邮件服务提供商配置
   */
  private initializeProviderConfigs(): void {
    // Microsoft Graph API 配置
    this.providerConfigs.set('microsoft', {
      provider: 'microsoft',
      displayName: 'Microsoft Outlook',
      authType: 'oauth2',
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/User.Read',
        'offline_access'
      ],
      endpoints: {
        auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        api: 'https://graph.microsoft.com/v1.0'
      },
      capabilities: {
        sendEmail: true,
        readEmail: true,
        searchEmail: true,
        webhooks: true,
        calendar: true,
        contacts: true
      }
    });

    // Gmail API 配置
    this.providerConfigs.set('gmail', {
      provider: 'gmail',
      displayName: 'Gmail',
      authType: 'oauth2',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      endpoints: {
        auth: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        api: 'https://gmail.googleapis.com/gmail/v1'
      },
      capabilities: {
        sendEmail: true,
        readEmail: true,
        searchEmail: true,
        webhooks: true,
        calendar: false,
        contacts: false
      }
    });

    // IMAP 配置
    this.providerConfigs.set('imap', {
      provider: 'imap',
      displayName: 'IMAP/SMTP',
      authType: 'basic',
      endpoints: {},
      capabilities: {
        sendEmail: true,
        readEmail: true,
        searchEmail: true,
        webhooks: false,
        calendar: false,
        contacts: false
      }
    });

    // Exchange Web Services 配置
    this.providerConfigs.set('exchange', {
      provider: 'exchange',
      displayName: 'Exchange Server',
      authType: 'ntlm',
      endpoints: {},
      capabilities: {
        sendEmail: true,
        readEmail: true,
        searchEmail: true,
        webhooks: false,
        calendar: true,
        contacts: true
      }
    });
  }

  /**
   * 初始化速率限制配置
   */
  private initializeRateLimitConfigs(): void {
    // Microsoft Graph API 限制
    this.rateLimitConfigs.set('microsoft', {
      provider: 'microsoft',
      limits: {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        requestsPerHour: 10000,
        requestsPerDay: 1000000
      },
      quotas: {
        emailsPerDay: 10000,
        apiCallsPerMonth: 1000000
      }
    });

    // Gmail API 限制
    this.rateLimitConfigs.set('gmail', {
      provider: 'gmail',
      limits: {
        requestsPerSecond: 5,
        requestsPerMinute: 250,
        requestsPerHour: 1000,
        requestsPerDay: 1000000000 // 实际上 Gmail 没有每日限制，这里设置一个很大的值
      },
      quotas: {
        emailsPerDay: 1000000000,
        apiCallsPerMonth: 1000000000
      }
    });

    // IMAP 限制（较为保守）
    this.rateLimitConfigs.set('imap', {
      provider: 'imap',
      limits: {
        requestsPerSecond: 2,
        requestsPerMinute: 120,
        requestsPerHour: 7200,
        requestsPerDay: 172800
      },
      quotas: {}
    });

    // Exchange 限制
    this.rateLimitConfigs.set('exchange', {
      provider: 'exchange',
      limits: {
        requestsPerSecond: 5,
        requestsPerMinute: 300,
        requestsPerHour: 18000,
        requestsPerDay: 432000
      },
      quotas: {}
    });
  }

  /**
   * 创建邮件服务实例
   */
  public async createEmailService(
    provider: EmailProvider, 
    accountId: string,
    connectionConfig?: any
  ): Promise<IEmailService> {
    const key = `${provider}:${accountId}`;
    
    // 检查是否已存在实例
    if (this.serviceInstances.has(key)) {
      const existingService = this.serviceInstances.get(key)!;
      if (await existingService.isConnected()) {
        return existingService;
      } else {
        // 清理断开的连接
        this.serviceInstances.delete(key);
      }
    }

    const providerConfig = this.providerConfigs.get(provider);
    const rateLimitConfig = this.rateLimitConfigs.get(provider);

    if (!providerConfig || !rateLimitConfig) {
      throw new Error(`Unsupported email provider: ${provider}`);
    }

    let service: IEmailService;

    try {
      switch (provider) {
        case 'microsoft':
          const { MicrosoftEmailService } = await import('./providers/MicrosoftEmailService');
          service = new MicrosoftEmailService(connectionConfig, rateLimitConfig);
          break;

        case 'gmail':
          const { GmailService } = await import('./providers/GmailService');
          service = new GmailService(connectionConfig, rateLimitConfig);
          break;

        case 'imap':
          const { ImapService } = await import('./providers/ImapService');
          service = new ImapService(connectionConfig, rateLimitConfig);
          break;

        case 'exchange':
          const { ExchangeService } = await import('./providers/ExchangeService');
          service = new ExchangeService(connectionConfig, rateLimitConfig);
          break;

        default:
          throw new Error(`Unsupported email provider: ${provider}`);
      }

      // 连接服务
      await service.connect(connectionConfig);
      
      // 缓存服务实例
      this.serviceInstances.set(key, service);
      
      // 设置事件监听器
      this.setupServiceEventListeners(service, key);
      
      logger.info(`Email service created and connected: ${provider} for account ${accountId}`);
      
      return service;
    } catch (error) {
      logger.error(`Failed to create email service for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * 获取现有的邮件服务实例
   */
  public getEmailService(provider: EmailProvider, accountId: string): IEmailService | null {
    const key = `${provider}:${accountId}`;
    return this.serviceInstances.get(key) || null;
  }

  /**
   * 删除邮件服务实例
   */
  public async removeEmailService(provider: EmailProvider, accountId: string): Promise<void> {
    const key = `${provider}:${accountId}`;
    const service = this.serviceInstances.get(key);
    
    if (service) {
      try {
        if (service instanceof BaseEmailService) {
          await service.cleanup();
        } else {
          await service.disconnect();
        }
      } catch (error) {
        logger.warn(`Error disconnecting email service ${key}:`, error);
      }
      
      this.serviceInstances.delete(key);
      logger.info(`Email service removed: ${key}`);
    }
  }

  /**
   * 获取支持的邮件提供商列表
   */
  public getSupportedProviders(): EmailProviderConfig[] {
    return Array.from(this.providerConfigs.values());
  }

  /**
   * 获取提供商配置
   */
  public getProviderConfig(provider: EmailProvider): EmailProviderConfig | null {
    return this.providerConfigs.get(provider) || null;
  }

  /**
   * 获取OAuth配置
   */
  public getOAuthConfig(provider: EmailProvider): OAuthConfig | null {
    const providerConfig = this.providerConfigs.get(provider);
    if (!providerConfig || providerConfig.authType !== 'oauth2') {
      return null;
    }

    switch (provider) {
      case 'microsoft':
        return {
          clientId: config.env.MICROSOFT_CLIENT_ID,
          clientSecret: config.env.MICROSOFT_CLIENT_SECRET,
          redirectUri: config.env.MICROSOFT_REDIRECT_URI,
          scope: config.env.MICROSOFT_GRAPH_SCOPE,
          authUrl: providerConfig.endpoints.auth!,
          tokenUrl: providerConfig.endpoints.token!,
          userInfoUrl: `${providerConfig.endpoints.api}/me`
        };

      case 'gmail':
        return {
          clientId: config.env.GOOGLE_CLIENT_ID,
          clientSecret: config.env.GOOGLE_CLIENT_SECRET,
          redirectUri: config.env.GOOGLE_REDIRECT_URI,
          scope: config.env.GOOGLE_GMAIL_SCOPE,
          authUrl: providerConfig.endpoints.auth!,
          tokenUrl: providerConfig.endpoints.token!,
          userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
        };

      default:
        return null;
    }
  }

  /**
   * 生成OAuth授权URL
   */
  public generateAuthUrl(provider: EmailProvider, state?: string): string {
    const oauthConfig = this.getOAuthConfig(provider);
    if (!oauthConfig) {
      throw new Error(`Provider ${provider} does not support OAuth`);
    }

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      response_type: 'code',
      scope: oauthConfig.scope
    });

    if (state) {
      params.set('state', state);
    }

    // 添加提供商特定的参数
    switch (provider) {
      case 'microsoft':
        params.set('response_mode', 'query');
        break;
      case 'gmail':
        params.set('access_type', 'offline');
        params.set('prompt', 'consent');
        break;
    }

    return `${oauthConfig.authUrl}?${params.toString()}`;
  }

  /**
   * 设置服务事件监听器
   */
  private setupServiceEventListeners(service: IEmailService, key: string): void {
    if (service instanceof BaseEmailService) {
      service.on('connectionChange', (event) => {
        logger.info(`Email service connection changed: ${key}`, event);
        if (!event.connected) {
          // 连接断开时清理实例
          this.serviceInstances.delete(key);
        }
      });

      service.on('apiCall', (event) => {
        logger.debug(`API call completed: ${key}`, event);
      });
    }
  }

  /**
   * 获取所有活动的服务实例统计
   */
  public getServiceStats(): {
    totalServices: number;
    servicesByProvider: Record<EmailProvider, number>;
    connectedServices: number;
  } {
    const stats = {
      totalServices: this.serviceInstances.size,
      servicesByProvider: {} as Record<EmailProvider, number>,
      connectedServices: 0
    };

    // 初始化提供商计数
    for (const provider of this.providerConfigs.keys()) {
      stats.servicesByProvider[provider] = 0;
    }

    // 统计每个提供商的服务数量
    for (const [key, service] of this.serviceInstances) {
      const provider = key.split(':')[0] as EmailProvider;
      stats.servicesByProvider[provider]++;
      
      // 这里只能同步检查，异步检查会影响性能
      if (service instanceof BaseEmailService && (service as any)._isConnected) {
        stats.connectedServices++;
      }
    }

    return stats;
  }

  /**
   * 清理所有服务实例
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up all email services...');
    
    const cleanupPromises = Array.from(this.serviceInstances.entries()).map(
      async ([key, service]) => {
        try {
          if (service instanceof BaseEmailService) {
            await service.cleanup();
          } else {
            await service.disconnect();
          }
        } catch (error) {
          logger.error(`Error cleaning up service ${key}:`, error);
        }
      }
    );

    await Promise.allSettled(cleanupPromises);
    this.serviceInstances.clear();
    
    logger.info('All email services cleaned up');
  }
}