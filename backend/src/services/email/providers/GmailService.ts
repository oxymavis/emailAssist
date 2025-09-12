import axios, { AxiosInstance } from 'axios';
import { 
  OAuthTokens, 
  UnifiedEmailMessage, 
  EmailSearchQuery, 
  EmailSendRequest, 
  EmailOperationResult,
  GmailMessage,
  GmailProfile,
  RateLimitConfig
} from '../../../types';
import { BaseEmailService } from '../BaseEmailService';
import { logger } from '../../../utils/logger';

/**
 * Gmail API服务实现
 * 支持Google Workspace和个人Gmail账户
 */
export class GmailService extends BaseEmailService {
  private httpClient: AxiosInstance;
  private tokens?: OAuthTokens;
  private userProfile?: GmailProfile;
  private accountId: string = '';

  constructor(config: any, rateLimitConfig: RateLimitConfig) {
    super('gmail', config, rateLimitConfig);
    
    this.httpClient = axios.create({
      baseURL: 'https://gmail.googleapis.com/gmail/v1',
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
            logger.info('Gmail access token expired, refreshing...');
            const newTokens = await this.refreshTokens();
            this.tokens = newTokens;
            
            // 重试原始请求
            error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return this.httpClient.request(error.config);
          } catch (refreshError) {
            logger.error('Failed to refresh Gmail tokens:', refreshError);
            this.setConnectionStatus(false);
            throw refreshError;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 连接到Gmail API
   */
  public async connect(config: { tokens: OAuthTokens; accountId: string }): Promise<void> {
    try {
      this.tokens = config.tokens;
      this.accountId = config.accountId;
      
      // 验证token并获取用户配置文件
      const isValid = await this.authenticate(this.tokens);
      if (!isValid) {
        throw new Error('Invalid Gmail tokens');
      }

      this.setConnectionStatus(true);
      logger.info(`Gmail service connected for account: ${this.accountId}`);
    } catch (error) {
      logger.error('Failed to connect Gmail service:', error);
      this.setConnectionStatus(false);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    this.tokens = undefined;
    this.userProfile = undefined;
    this.accountId = '';
    this.setConnectionStatus(false);
    logger.info('Gmail service disconnected');
  }

  /**
   * 认证用户
   */
  public async authenticate(tokens: OAuthTokens): Promise<boolean> {
    try {
      this.tokens = tokens;
      this.userProfile = await this.executeApiCall(
        () => this.httpClient.get<GmailProfile>('/users/me/profile'),
        'getUserProfile'
      ).then(response => response.data);
      
      return true;
    } catch (error) {
      logger.error('Gmail authentication failed:', error);
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
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token'
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
      logger.info('Gmail tokens refreshed successfully');
      
      return newTokens;
    } catch (error) {
      logger.error('Failed to refresh Gmail tokens:', error);
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
      
      // 先获取消息ID列表
      const listResponse = await this.executeApiCall(
        () => this.httpClient.get(`/users/me/messages${searchParams}`),
        'getMessagesList'
      );

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) {
        return [];
      }

      // 批量获取消息详情
      const messages = await Promise.all(
        messageIds.slice(0, query?.limit || 50).map(async (msg: any) => {
          const messageResponse = await this.executeApiCall(
            () => this.httpClient.get(`/users/me/messages/${msg.id}`),
            'getMessageDetails'
          );
          return this.convertToUnifiedMessage(messageResponse.data, this.accountId);
        })
      );

      return messages;
    } catch (error) {
      logger.error('Failed to get Gmail messages:', error);
      throw error;
    }
  }

  /**
   * 获取单条邮件
   */
  public async getMessage(messageId: string): Promise<UnifiedEmailMessage> {
    try {
      const response = await this.executeApiCall(
        () => this.httpClient.get<GmailMessage>(`/users/me/messages/${messageId}`),
        'getMessage'
      );

      return this.convertToUnifiedMessage(response.data, this.accountId);
    } catch (error) {
      logger.error(`Failed to get Gmail message ${messageId}:`, error);
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
      const rawMessage = this.createRawMessage(message);
      
      await this.executeApiCall(
        () => this.httpClient.post('/users/me/messages/send', {
          raw: rawMessage
        }),
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
        () => this.httpClient.delete(`/users/me/messages/${messageId}`),
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
      const action = isRead ? 'addLabelIds' : 'removeLabelIds';
      const body: any = {};
      body[action] = ['UNREAD'];

      await this.executeApiCall(
        () => this.httpClient.post(`/users/me/messages/${messageId}/modify`, body),
        'markAsRead'
      );

      return this.createSuccessResult(null, 'markAsRead', startTime);
    } catch (error) {
      return this.createErrorResult(error as Error, 'markAsRead');
    }
  }

  /**
   * 获取标签列表（Gmail的文件夹概念）
   */
  public async getFolders(): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const response = await this.executeApiCall(
        () => this.httpClient.get('/users/me/labels'),
        'getLabels'
      );

      return response.data.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        type: this.mapLabelType(label.id, label.name)
      }));
    } catch (error) {
      logger.error('Failed to get Gmail labels:', error);
      throw error;
    }
  }

  /**
   * 移动邮件（通过修改标签实现）
   */
  public async moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    try {
      // Gmail没有真正的移动概念，而是通过添加/删除标签实现
      // 这里简化处理，只添加指定标签
      await this.executeApiCall(
        () => this.httpClient.post(`/users/me/messages/${messageId}/modify`, {
          addLabelIds: [folderId]
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
      let query = '';
      
      if (options?.folderId) {
        query = `label:${options.folderId}`;
      }
      
      if (options?.incremental) {
        // 只获取最近的邮件进行增量同步
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateQuery = `after:${Math.floor(yesterday.getTime() / 1000)}`;
        query = query ? `${query} ${dateQuery}` : dateQuery;
      }
      
      const messages = await this.getMessages({
        query,
        limit: 100,
        orderBy: 'date',
        orderDirection: 'desc'
      });

      // Gmail API不直接支持增量同步的删除检测
      // 这里简化处理，将所有消息视为新消息
      return {
        newMessages: messages,
        updatedMessages: [],
        deletedMessageIds: []
      };
    } catch (error) {
      logger.error('Failed to sync Gmail messages:', error);
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
    if (!this.userProfile) {
      this.userProfile = await this.executeApiCall(
        () => this.httpClient.get<GmailProfile>('/users/me/profile'),
        'getUserProfile'
      ).then(response => response.data);
    }

    return {
      email: this.userProfile.emailAddress,
      name: this.userProfile.emailAddress,
      quota: undefined // Gmail API不直接提供配额信息
    };
  }

  /**
   * 设置Webhook订阅（Gmail推送通知）
   */
  public async setupWebhook(callbackUrl: string): Promise<{ subscriptionId: string }> {
    try {
      const response = await this.executeApiCall(
        () => this.httpClient.post('/users/me/watch', {
          topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/gmail-notifications`,
          labelIds: ['INBOX']
        }),
        'setupWebhook'
      );

      return { subscriptionId: response.data.historyId };
    } catch (error) {
      logger.error('Failed to setup Gmail webhook:', error);
      throw error;
    }
  }

  /**
   * 删除Webhook订阅
   */
  public async removeWebhook(subscriptionId: string): Promise<void> {
    try {
      await this.executeApiCall(
        () => this.httpClient.post('/users/me/stop'),
        'removeWebhook'
      );
    } catch (error) {
      logger.error('Failed to remove Gmail webhook:', error);
      throw error;
    }
  }

  /**
   * 将Gmail消息转换为统一格式
   */
  protected convertToUnifiedMessage(message: GmailMessage, accountId: string): UnifiedEmailMessage {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    return {
      id: message.id,
      providerId: message.id,
      provider: 'gmail',
      accountId: accountId,
      subject: getHeader('Subject'),
      sender: {
        name: this.extractName(getHeader('From')),
        address: this.extractEmail(getHeader('From'))
      },
      recipients: {
        to: this.parseEmailList(getHeader('To')),
        cc: this.parseEmailList(getHeader('Cc')),
        bcc: this.parseEmailList(getHeader('Bcc'))
      },
      content: {
        text: this.extractTextContent(message.payload),
        html: this.extractHtmlContent(message.payload),
        snippet: message.snippet
      },
      receivedAt: new Date(parseInt(message.internalDate)),
      sentAt: new Date(getHeader('Date') || message.internalDate),
      importance: this.mapImportance(getHeader('X-Priority')),
      isRead: !message.labelIds?.includes('UNREAD'),
      isDraft: message.labelIds?.includes('DRAFT') || false,
      hasAttachments: this.hasAttachments(message.payload),
      attachments: [], // 附件需要单独处理
      labels: message.labelIds || [],
      folders: message.labelIds || [],
      flags: [],
      threadId: message.threadId,
      internetMessageId: getHeader('Message-ID'),
      metadata: {
        originalData: message
      }
    };
  }

  /**
   * 构建搜索参数
   */
  private buildSearchParams(query?: EmailSearchQuery): string {
    if (!query) return '';
    
    const params = new URLSearchParams();
    
    // Gmail搜索查询
    let gmailQuery = query.query || '';
    
    if (query.from) {
      gmailQuery += ` from:${query.from}`;
    }
    
    if (query.to) {
      gmailQuery += ` to:${query.to}`;
    }
    
    if (query.subject) {
      gmailQuery += ` subject:"${query.subject}"`;
    }
    
    if (query.hasAttachment) {
      gmailQuery += ' has:attachment';
    }
    
    if (query.isRead === false) {
      gmailQuery += ' is:unread';
    } else if (query.isRead === true) {
      gmailQuery += ' -is:unread';
    }
    
    if (query.importance === 'high') {
      gmailQuery += ' is:important';
    }
    
    if (query.dateRange) {
      const start = Math.floor(query.dateRange.start.getTime() / 1000);
      const end = Math.floor(query.dateRange.end.getTime() / 1000);
      gmailQuery += ` after:${start} before:${end}`;
    }
    
    if (query.labels && query.labels.length > 0) {
      query.labels.forEach(label => {
        gmailQuery += ` label:${label}`;
      });
    }
    
    if (gmailQuery.trim()) {
      params.set('q', gmailQuery.trim());
    }
    
    // 分页参数
    if (query.limit) {
      params.set('maxResults', query.limit.toString());
    }
    
    return params.toString() ? `?${params.toString()}` : '';
  }

  /**
   * 创建RFC 2822格式的原始邮件
   */
  private createRawMessage(message: EmailSendRequest): string {
    const boundary = `boundary_${Date.now()}`;
    let rawMessage = '';
    
    // 头部
    rawMessage += `To: ${message.to.map(r => r.name ? `${r.name} <${r.address}>` : r.address).join(', ')}\r\n`;
    
    if (message.cc && message.cc.length > 0) {
      rawMessage += `Cc: ${message.cc.map(r => r.name ? `${r.name} <${r.address}>` : r.address).join(', ')}\r\n`;
    }
    
    rawMessage += `Subject: ${message.subject}\r\n`;
    rawMessage += `MIME-Version: 1.0\r\n`;
    rawMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    
    // 文本内容
    if (message.body.text) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
      rawMessage += Buffer.from(message.body.text).toString('base64') + '\r\n\r\n';
    }
    
    // HTML内容
    if (message.body.html) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: text/html; charset="UTF-8"\r\n`;
      rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
      rawMessage += Buffer.from(message.body.html).toString('base64') + '\r\n\r\n';
    }
    
    rawMessage += `--${boundary}--\r\n`;
    
    return Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * 提取邮件地址
   */
  private extractEmail(emailString: string): string {
    const match = emailString.match(/<(.+?)>/);
    return match ? match[1] : emailString.trim();
  }

  /**
   * 提取显示名称
   */
  private extractName(emailString: string): string | undefined {
    const match = emailString.match(/^(.+?)\s*<.+?>$/);
    return match ? match[1].replace(/"/g, '').trim() : undefined;
  }

  /**
   * 解析邮件地址列表
   */
  private parseEmailList(emailString: string): Array<{ name?: string; address: string }> {
    if (!emailString) return [];
    
    return emailString.split(',').map(email => ({
      name: this.extractName(email.trim()),
      address: this.extractEmail(email.trim())
    })).filter(item => item.address);
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(payload: any): string | undefined {
    if (payload?.body?.data && payload.mimeType === 'text/plain') {
      return Buffer.from(payload.body.data, 'base64').toString();
    }
    
    if (payload?.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }
    
    return undefined;
  }

  /**
   * 提取HTML内容
   */
  private extractHtmlContent(payload: any): string | undefined {
    if (payload?.body?.data && payload.mimeType === 'text/html') {
      return Buffer.from(payload.body.data, 'base64').toString();
    }
    
    if (payload?.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }
    
    return undefined;
  }

  /**
   * 检查是否有附件
   */
  private hasAttachments(payload: any): boolean {
    if (payload?.parts) {
      return payload.parts.some((part: any) => 
        part.filename && part.filename.length > 0
      );
    }
    return false;
  }

  /**
   * 映射重要性级别
   */
  private mapImportance(priority: string): 'low' | 'normal' | 'high' {
    if (!priority) return 'normal';
    
    const num = parseInt(priority);
    if (num <= 2) return 'high';
    if (num >= 4) return 'low';
    return 'normal';
  }

  /**
   * 映射标签类型
   */
  private mapLabelType(labelId: string, labelName: string): string {
    const systemLabels: Record<string, string> = {
      'INBOX': 'inbox',
      'SENT': 'sent',
      'DRAFT': 'drafts',
      'TRASH': 'trash',
      'SPAM': 'spam'
    };
    
    return systemLabels[labelId] || 'custom';
  }
}