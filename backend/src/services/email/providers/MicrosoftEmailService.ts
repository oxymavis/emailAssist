import axios, { AxiosInstance } from 'axios';
import { 
  OAuthTokens, 
  UnifiedEmailMessage, 
  EmailSearchQuery, 
  EmailSendRequest, 
  EmailOperationResult,
  GraphMessage,
  GraphUser,
  RateLimitConfig
} from '../../../types';
import { BaseEmailService } from '../BaseEmailService';
import logger from '../../../utils/logger';

/**
 * Microsoft Graph API邮件服务实现
 * 支持Office 365和Outlook.com账户
 */
export class MicrosoftEmailService extends BaseEmailService {
  private httpClient: AxiosInstance;
  private tokens?: OAuthTokens;
  private userInfo?: GraphUser;
  private accountId: string = '';

  constructor(config: any, rateLimitConfig: RateLimitConfig) {
    super('microsoft', config, rateLimitConfig);
    
    this.httpClient = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.setupHttpInterceptors();
  }

  /**
   * 设置HTTP请求拦截器
   */
  private setupHttpInterceptors(): void {
    // 请求拦截器：添加认证头
    this.httpClient.interceptors.request.use((config) => {
      if (this.tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
      }
      return config;
    });

    // 响应拦截器：处理token刷新
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.tokens?.refreshToken) {
          try {
            logger.info('Microsoft access token expired, refreshing...');
            const newTokens = await this.refreshTokens();
            this.tokens = newTokens;
            
            // 重试原始请求
            error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return this.httpClient.request(error.config);
          } catch (refreshError) {
            logger.error('Failed to refresh Microsoft tokens:', refreshError);
            this.setConnectionStatus(false);
            throw refreshError;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 连接到Microsoft Graph API
   */
  public async connect(config: { tokens: OAuthTokens; accountId: string }): Promise<void> {
    try {
      this.tokens = config.tokens;
      this.accountId = config.accountId;
      
      // 验证token并获取用户信息
      const isValid = await this.authenticate(this.tokens);
      if (!isValid) {
        throw new Error('Invalid Microsoft tokens');
      }

      this.setConnectionStatus(true);
      logger.info(`Microsoft email service connected for account: ${this.accountId}`);
    } catch (error) {
      logger.error('Failed to connect Microsoft email service:', error);
      this.setConnectionStatus(false);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    this.tokens = undefined;
    this.userInfo = undefined;
    this.accountId = '';
    this.setConnectionStatus(false);
    logger.info('Microsoft email service disconnected');
  }

  /**
   * 认证用户
   */
  public async authenticate(tokens: OAuthTokens): Promise<boolean> {
    try {
      this.tokens = tokens;
      this.userInfo = await this.executeApiCall(
        () => this.httpClient.get<GraphUser>('/me'),
        'getUserInfo'
      ).then(response => response.data);
      
      return true;
    } catch (error) {
      logger.error('Microsoft authentication failed:', error);
      return false;
    }
  }

  /**
   * 刷新访问令牌
   */
  public async refreshTokens(): Promise<OAuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      const newTokens: OAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || this.tokens.refreshToken,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scope: tokenData.scope
      };

      this.tokens = newTokens;
      logger.info('Microsoft tokens refreshed successfully');
      
      return newTokens;
    } catch (error) {
      logger.error('Failed to refresh Microsoft tokens:', error);
      throw new Error('Token refresh failed');
    }
  }

  /**
   * 获取邮件列表
   */
  public async getMessages(query?: EmailSearchQuery): Promise<UnifiedEmailMessage[]> {
    this.validateSearchQuery(query);
    
    try {
      const searchParams = this.buildSearchParams(query);
      const response = await this.executeApiCall(
        () => this.httpClient.get<{ value: GraphMessage[] }>(`/me/messages${searchParams}`),
        'getMessages'
      );

      return response.data.value.map(message => 
        this.convertToUnifiedMessage(message, this.accountId)
      );
    } catch (error) {
      logger.error('Failed to get Microsoft messages:', error);
      throw error;
    }
  }

  /**
   * 获取单条邮件
   */
  public async getMessage(messageId: string): Promise<UnifiedEmailMessage> {
    try {
      const response = await this.executeApiCall(
        () => this.httpClient.get<GraphMessage>(`/me/messages/${messageId}`),
        'getMessage'
      );

      return this.convertToUnifiedMessage(response.data, this.accountId);
    } catch (error) {
      logger.error(`Failed to get Microsoft message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * 发送邮件
   */
  public async sendMessage(message: EmailSendRequest): Promise<EmailOperationResult> {
    this.validateSendRequest(message);
    
    const startTime = new Date();
    
    try {
      const graphMessage = this.convertToGraphMessage(message);
      
      await this.executeApiCall(
        () => this.httpClient.post('/me/sendMail', { message: graphMessage }),
        'sendMessage'
      );

      return this.createSuccessResult(null, 'sendMessage', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'sendMessage');
    }
  }

  /**
   * 删除邮件
   */
  public async deleteMessage(messageId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    try {
      await this.executeApiCall(
        () => this.httpClient.delete(`/me/messages/${messageId}`),
        'deleteMessage'
      );

      return this.createSuccessResult(null, 'deleteMessage', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'deleteMessage');
    }
  }

  /**
   * 标记邮件为已读/未读
   */
  public async markAsRead(messageId: string, isRead: boolean): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    try {
      await this.executeApiCall(
        () => this.httpClient.patch(`/me/messages/${messageId}`, { isRead }),
        'markAsRead'
      );

      return this.createSuccessResult(null, 'markAsRead', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'markAsRead');
    }
  }

  /**
   * 获取文件夹列表
   */
  public async getFolders(): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const response = await this.executeApiCall(
        () => this.httpClient.get('/me/mailFolders'),
        'getFolders'
      );

      return response.data.value.map((folder: any) => ({
        id: folder.id,
        name: folder.displayName,
        type: this.mapFolderType(folder.displayName)
      }));
    } catch (error) {
      logger.error('Failed to get Microsoft folders:', error);
      throw error;
    }
  }

  /**
   * 移动邮件到指定文件夹
   */
  public async moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    try {
      await this.executeApiCall(
        () => this.httpClient.post(`/me/messages/${messageId}/move`, {
          destinationId: folderId
        }),
        'moveMessage'
      );

      return this.createSuccessResult(null, 'moveMessage', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'moveMessage');
    }
  }

  /**
   * 同步邮件
   */
  public async syncMessages(options?: { incremental?: boolean; folderId?: string }): Promise<{
    newMessages: UnifiedEmailMessage[];
    updatedMessages: UnifiedEmailMessage[];
    deletedMessageIds: string[];
  }> {
    try {
      const folderId = options?.folderId || 'inbox';
      let endpoint = `/me/mailFolders/${folderId}/messages`;
      
      if (options?.incremental) {
        // 使用Delta查询进行增量同步
        endpoint += '/delta';
      }
      
      const response = await this.executeApiCall(
        () => this.httpClient.get(endpoint),
        'syncMessages'
      );

      const messages = response.data.value.map((message: GraphMessage) => 
        this.convertToUnifiedMessage(message, this.accountId)
      );

      // 对于Microsoft Graph，增量同步需要额外的逻辑来区分新增、更新和删除
      // 这里简化处理，将所有消息视为新消息
      return {
        newMessages: messages,
        updatedMessages: [],
        deletedMessageIds: []
      };
    } catch (error) {
      logger.error('Failed to sync Microsoft messages:', error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  public async getUserInfo(): Promise<{
    email: string;
    name: string;
    quota?: {
      used: number;
      total: number;
    };
  }> {
    if (!this.userInfo) {
      this.userInfo = await this.executeApiCall(
        () => this.httpClient.get<GraphUser>('/me'),
        'getUserInfo'
      ).then(response => response.data);
    }

    return {
      email: this.userInfo.mail || this.userInfo.userPrincipalName,
      name: this.userInfo.displayName,
      quota: undefined // Microsoft Graph API 不直接提供邮箱配额信息
    };
  }

  /**
   * 设置Webhook订阅
   */
  public async setupWebhook(callbackUrl: string): Promise<{ subscriptionId: string }> {
    try {
      const subscription = {
        changeType: 'created,updated,deleted',
        notificationUrl: callbackUrl,
        resource: '/me/messages',
        expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(), // 最长4230分钟
        clientState: `microsoft_${this.accountId}`
      };

      const response = await this.executeApiCall(
        () => this.httpClient.post('/subscriptions', subscription),
        'setupWebhook'
      );

      return { subscriptionId: response.data.id };
    } catch (error) {
      logger.error('Failed to setup Microsoft webhook:', error);
      throw error;
    }
  }

  /**
   * 删除Webhook订阅
   */
  public async removeWebhook(subscriptionId: string): Promise<void> {
    try {
      await this.executeApiCall(
        () => this.httpClient.delete(`/subscriptions/${subscriptionId}`),
        'removeWebhook'
      );
    } catch (error) {
      logger.error('Failed to remove Microsoft webhook:', error);
      throw error;
    }
  }

  /**
   * 将Graph消息转换为统一格式
   */
  protected convertToUnifiedMessage(message: GraphMessage, accountId: string): UnifiedEmailMessage {
    return {
      id: message.id,
      providerId: message.id,
      provider: 'microsoft',
      accountId: accountId,
      subject: message.subject || '',
      sender: {
        name: message.from?.emailAddress?.name,
        address: message.from?.emailAddress?.address || message.sender?.emailAddress?.address || ''
      },
      recipients: {
        to: message.toRecipients?.map(recipient => ({
          name: recipient.emailAddress.name,
          address: recipient.emailAddress.address
        })) || [],
        cc: message.ccRecipients?.map(recipient => ({
          name: recipient.emailAddress.name,
          address: recipient.emailAddress.address
        })) || []
      },
      content: {
        text: message.body?.contentType === 'text' ? message.body.content : undefined,
        html: message.body?.contentType === 'html' ? message.body.content : undefined,
        snippet: message.bodyPreview
      },
      receivedAt: new Date(message.receivedDateTime),
      sentAt: new Date(message.sentDateTime),
      importance: message.importance,
      isRead: message.isRead,
      isDraft: message.isDraft,
      hasAttachments: message.hasAttachments,
      attachments: [], // 附件需要单独获取
      labels: [],
      folders: [message.parentFolderId],
      flags: [],
      conversationId: message.conversationId,
      internetMessageId: message.internetMessageId,
      metadata: {
        originalData: message
      }
    };
  }

  /**
   * 将统一邮件格式转换为Graph消息格式
   */
  private convertToGraphMessage(message: EmailSendRequest): any {
    return {
      subject: message.subject,
      body: {
        contentType: message.body.html ? 'HTML' : 'Text',
        content: message.body.html || message.body.text
      },
      toRecipients: message.to.map(recipient => ({
        emailAddress: {
          address: recipient.address,
          name: recipient.name
        }
      })),
      ccRecipients: message.cc?.map(recipient => ({
        emailAddress: {
          address: recipient.address,
          name: recipient.name
        }
      })) || [],
      bccRecipients: message.bcc?.map(recipient => ({
        emailAddress: {
          address: recipient.address,
          name: recipient.name
        }
      })) || [],
      importance: message.importance || 'normal'
    };
  }

  /**
   * 构建搜索参数
   */
  private buildSearchParams(query?: EmailSearchQuery): string {
    if (!query) return '';
    
    const params = new URLSearchParams();
    
    // 分页参数
    if (query.limit) {
      params.set('$top', query.limit.toString());
    }
    if (query.offset) {
      params.set('$skip', query.offset.toString());
    }
    
    // 排序参数
    if (query.orderBy) {
      const orderBy = query.orderBy === 'date' ? 'receivedDateTime' : query.orderBy;
      const direction = query.orderDirection === 'asc' ? 'asc' : 'desc';
      params.set('$orderby', `${orderBy} ${direction}`);
    }
    
    // 过滤参数
    const filters: string[] = [];
    
    if (query.from) {
      filters.push(`from/emailAddress/address eq '${query.from}'`);
    }
    
    if (query.subject) {
      filters.push(`contains(subject, '${query.subject}')`);
    }
    
    if (query.hasAttachment !== undefined) {
      filters.push(`hasAttachments eq ${query.hasAttachment}`);
    }
    
    if (query.isRead !== undefined) {
      filters.push(`isRead eq ${query.isRead}`);
    }
    
    if (query.importance) {
      filters.push(`importance eq '${query.importance}'`);
    }
    
    if (query.dateRange) {
      const start = query.dateRange.start.toISOString();
      const end = query.dateRange.end.toISOString();
      filters.push(`receivedDateTime ge ${start} and receivedDateTime le ${end}`);
    }
    
    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }
    
    // 搜索参数
    if (query.query) {
      params.set('$search', `"${query.query}"`);
    }
    
    return params.toString() ? `?${params.toString()}` : '';
  }

  /**
   * 映射文件夹类型
   */
  private mapFolderType(displayName: string): string {
    const lowerName = displayName.toLowerCase();
    if (lowerName.includes('inbox') || lowerName.includes('收件箱')) return 'inbox';
    if (lowerName.includes('sent') || lowerName.includes('已发送')) return 'sent';
    if (lowerName.includes('draft') || lowerName.includes('草稿')) return 'drafts';
    if (lowerName.includes('trash') || lowerName.includes('删除')) return 'trash';
    if (lowerName.includes('spam') || lowerName.includes('垃圾')) return 'spam';
    return 'custom';
  }
}