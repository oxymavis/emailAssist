import axios, { AxiosInstance } from 'axios';
import { 
  OAuthTokens, 
  UnifiedEmailMessage, 
  EmailSearchQuery, 
  EmailSendRequest, 
  EmailOperationResult,
  EwsMessage,
  RateLimitConfig
} from '../../../types';
import { BaseEmailService } from '../BaseEmailService';
import { logger } from '../../../utils/logger';

/**
 * Exchange Web Services (EWS) 邮件服务实现
 * 支持企业Exchange Server和Exchange Online
 */
export class ExchangeService extends BaseEmailService {
  private httpClient: AxiosInstance;
  private config: {
    serverUrl: string;
    username: string;
    password: string;
    domain?: string;
    version?: string;
  };
  private accountId: string = '';

  constructor(config: any, rateLimitConfig: RateLimitConfig) {
    super('exchange', config, rateLimitConfig);
    this.config = config;
    
    this.httpClient = axios.create({
      baseURL: this.config.serverUrl,
      timeout: 60000, // Exchange可能需要更长的超时时间
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://schemas.microsoft.com/exchange/services/2006/messages/FindItem"'
      }
    });

    this.setupHttpInterceptors();
  }

  /**
   * 设置HTTP请求拦截器
   */
  private setupHttpInterceptors(): void {
    // 请求拦截器：添加认证
    this.httpClient.interceptors.request.use((config) => {
      // 使用NTLM或基本认证
      const auth = Buffer.from(`${this.config.domain ? `${this.config.domain}\\` : ''}${this.config.username}:${this.config.password}`).toString('base64');
      config.headers.Authorization = `Basic ${auth}`;
      return config;
    });

    // 响应拦截器：处理EWS响应
    this.httpClient.interceptors.response.use(
      (response) => {
        // EWS返回XML，需要解析错误
        if (response.data && typeof response.data === 'string') {
          if (response.data.includes('ErrorAccessDenied') || response.data.includes('ErrorUnauthorized')) {
            throw new Error('Exchange authentication failed');
          }
        }
        return response;
      },
      (error) => {
        logger.error('Exchange API error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 连接到Exchange Web Services
   */
  public async connect(config: {
    serverUrl: string;
    username: string;
    password: string;
    domain?: string;
    accountId: string;
  }): Promise<void> {
    try {
      this.config = config;
      this.accountId = config.accountId;
      
      // 测试连接
      await this.testConnection();
      
      this.setConnectionStatus(true);
      logger.info(`Exchange service connected for account: ${this.accountId}`);
    } catch (error) {
      logger.error('Failed to connect Exchange service:', error);
      this.setConnectionStatus(false);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    this.setConnectionStatus(false);
    logger.info('Exchange service disconnected');
  }

  /**
   * 认证（Exchange使用NTLM或基本认证）
   */
  public async authenticate(tokens: OAuthTokens): Promise<boolean> {
    // Exchange EWS通常使用Windows认证，OAuth tokens在这里不直接适用
    // 实际认证在HTTP拦截器中处理
    return this._isConnected;
  }

  /**
   * 刷新令牌（Exchange EWS不需要）
   */
  public async refreshTokens(): Promise<OAuthTokens> {
    throw new Error('Exchange EWS does not support token refresh');
  }

  /**
   * 获取邮件列表
   */
  public async getMessages(query?: EmailSearchQuery): Promise<UnifiedEmailMessage[]> {
    this.validateSearchQuery(query);
    
    try {
      const soapRequest = this.buildFindItemsRequest(query);
      
      const response = await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
        'getMessages'
      );

      const messages = this.parseItemsResponse(response.data);
      return messages.map(message => this.convertToUnifiedMessage(message, this.accountId));
    } catch (error) {
      logger.error('Failed to get Exchange messages:', error);
      throw error;
    }
  }

  /**
   * 获取单条邮件
   */
  public async getMessage(messageId: string): Promise<UnifiedEmailMessage> {
    try {
      const soapRequest = this.buildGetItemRequest(messageId);
      
      const response = await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
        'getMessage'
      );

      const message = this.parseGetItemResponse(response.data);
      return this.convertToUnifiedMessage(message, this.accountId);
    } catch (error) {
      logger.error(`Failed to get Exchange message ${messageId}:`, error);
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
      const soapRequest = this.buildCreateItemRequest(message);
      
      await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
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
      const soapRequest = this.buildDeleteItemRequest(messageId);
      
      await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
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
      const soapRequest = this.buildUpdateItemRequest(messageId, { isRead });
      
      await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
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
      const soapRequest = this.buildFindFoldersRequest();
      
      const response = await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
        'getFolders'
      );

      const folders = this.parseFoldersResponse(response.data);
      return folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        type: this.mapFolderType(folder.name)
      }));
    } catch (error) {
      logger.error('Failed to get Exchange folders:', error);
      throw error;
    }
  }

  /**
   * 移动邮件到指定文件夹
   */
  public async moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult> {
    const startTime = new Date();
    
    try {
      const soapRequest = this.buildMoveItemRequest(messageId, folderId);
      
      await this.executeApiCall(
        () => this.httpClient.post('/EWS/Exchange.asmx', soapRequest),
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
      const query: EmailSearchQuery = {
        folder: options?.folderId || 'inbox',
        limit: 100,
        orderBy: 'date',
        orderDirection: 'desc'
      };

      if (options?.incremental) {
        // 只同步最近的邮件
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query.dateRange = {
          start: yesterday,
          end: new Date()
        };
      }

      const messages = await this.getMessages(query);

      // Exchange EWS支持同步操作，但这里简化处理
      return {
        newMessages: messages,
        updatedMessages: [],
        deletedMessageIds: []
      };
    } catch (error) {
      logger.error('Failed to sync Exchange messages:', error);
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
    return {
      email: this.config.username,
      name: this.config.username,
      quota: undefined
    };
  }

  /**
   * 将EWS消息转换为统一格式
   */
  protected convertToUnifiedMessage(message: EwsMessage, accountId: string): UnifiedEmailMessage {
    return {
      id: message.itemId.id,
      providerId: message.itemId.id,
      provider: 'exchange',
      accountId: accountId,
      subject: message.subject || '',
      sender: {
        name: message.from?.name,
        address: message.from?.emailAddress || ''
      },
      recipients: {
        to: message.toRecipients?.map(recipient => ({
          name: recipient.name,
          address: recipient.emailAddress
        })) || [],
        cc: message.ccRecipients?.map(recipient => ({
          name: recipient.name,
          address: recipient.emailAddress
        })) || []
      },
      content: {
        text: message.body?.bodyType === 'Text' ? message.body.value : undefined,
        html: message.body?.bodyType === 'HTML' ? message.body.value : undefined,
        snippet: message.body?.value?.substring(0, 200)
      },
      receivedAt: new Date(message.dateTimeReceived),
      sentAt: new Date(message.dateTimeSent),
      importance: message.importance?.toLowerCase() as 'low' | 'normal' | 'high' || 'normal',
      isRead: message.isRead,
      isDraft: false, // EWS需要额外判断
      hasAttachments: message.hasAttachments,
      attachments: [],
      labels: [],
      folders: [],
      flags: [],
      conversationId: message.conversationId,
      metadata: {
        originalData: message
      }
    };
  }

  /**
   * 测试Exchange连接
   */
  private async testConnection(): Promise<void> {
    const soapRequest = this.buildFindFoldersRequest();
    await this.httpClient.post('/EWS/Exchange.asmx', soapRequest);
  }

  /**
   * 构建FindItem SOAP请求
   */
  private buildFindItemsRequest(query?: EmailSearchQuery): string {
    const limit = query?.limit || 50;
    const folder = this.mapFolderName(query?.folder || 'inbox');
    
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>Default</t:BaseShape>
      </m:ItemShape>
      <m:IndexedPageItemView MaxEntriesReturned="${limit}" Offset="0" BasePoint="Beginning" />
      <m:ParentFolderIds>
        <t:DistinguishedFolderId Id="${folder}" />
      </m:ParentFolderIds>
    </m:FindItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建GetItem SOAP请求
   */
  private buildGetItemRequest(itemId: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:GetItem>
      <m:ItemShape>
        <t:BaseShape>AllProperties</t:BaseShape>
      </m:ItemShape>
      <m:ItemIds>
        <t:ItemId Id="${itemId}" />
      </m:ItemIds>
    </m:GetItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建CreateItem SOAP请求（发送邮件）
   */
  private buildCreateItemRequest(message: EmailSendRequest): string {
    const toRecipients = message.to.map(recipient => 
      `<t:Mailbox><t:EmailAddress>${recipient.address}</t:EmailAddress>${recipient.name ? `<t:Name>${recipient.name}</t:Name>` : ''}</t:Mailbox>`
    ).join('');

    const ccRecipients = message.cc?.map(recipient => 
      `<t:Mailbox><t:EmailAddress>${recipient.address}</t:EmailAddress>${recipient.name ? `<t:Name>${recipient.name}</t:Name>` : ''}</t:Mailbox>`
    ).join('') || '';

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:CreateItem MessageDisposition="SendAndSaveCopy">
      <m:Items>
        <t:Message>
          <t:Subject>${message.subject}</t:Subject>
          <t:Body BodyType="${message.body.html ? 'HTML' : 'Text'}">${message.body.html || message.body.text}</t:Body>
          <t:ToRecipients>${toRecipients}</t:ToRecipients>
          ${ccRecipients ? `<t:CcRecipients>${ccRecipients}</t:CcRecipients>` : ''}
        </t:Message>
      </m:Items>
    </m:CreateItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建DeleteItem SOAP请求
   */
  private buildDeleteItemRequest(itemId: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:DeleteItem DeleteType="MoveToDeletedItems">
      <m:ItemIds>
        <t:ItemId Id="${itemId}" />
      </m:ItemIds>
    </m:DeleteItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建UpdateItem SOAP请求
   */
  private buildUpdateItemRequest(itemId: string, updates: { isRead?: boolean }): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:UpdateItem ConflictResolution="AutoResolve" MessageDisposition="SaveOnly">
      <m:ItemChanges>
        <t:ItemChange>
          <t:ItemId Id="${itemId}" />
          <t:Updates>
            ${updates.isRead !== undefined ? `
            <t:SetItemField>
              <t:FieldURI FieldURI="message:IsRead" />
              <t:Message>
                <t:IsRead>${updates.isRead}</t:IsRead>
              </t:Message>
            </t:SetItemField>` : ''}
          </t:Updates>
        </t:ItemChange>
      </m:ItemChanges>
    </m:UpdateItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建FindFolder SOAP请求
   */
  private buildFindFoldersRequest(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:FindFolder Traversal="Shallow">
      <m:FolderShape>
        <t:BaseShape>Default</t:BaseShape>
      </m:FolderShape>
      <m:ParentFolderIds>
        <t:DistinguishedFolderId Id="msgfolderroot" />
      </m:ParentFolderIds>
    </m:FindFolder>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 构建MoveItem SOAP请求
   */
  private buildMoveItemRequest(itemId: string, folderId: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" 
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2010_SP2" />
  </soap:Header>
  <soap:Body>
    <m:MoveItem>
      <m:ToFolderId>
        <t:FolderId Id="${folderId}" />
      </m:ToFolderId>
      <m:ItemIds>
        <t:ItemId Id="${itemId}" />
      </m:ItemIds>
    </m:MoveItem>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * 解析FindItem响应
   */
  private parseItemsResponse(xmlResponse: string): EwsMessage[] {
    // 这里需要使用XML解析器，为简化示例使用正则表达式
    // 实际项目中应该使用xml2js或类似的库
    const messages: EwsMessage[] = [];
    
    // 简化的XML解析实现
    // 实际项目中应该使用专门的XML解析库
    try {
      // 这里应该实现完整的XML解析逻辑
      // 现在返回空数组作为占位符
      return messages;
    } catch (error) {
      logger.error('Failed to parse EWS response:', error);
      return messages;
    }
  }

  /**
   * 解析GetItem响应
   */
  private parseGetItemResponse(xmlResponse: string): EwsMessage {
    // 简化的实现，实际项目中需要完整的XML解析
    return {} as EwsMessage;
  }

  /**
   * 解析FindFolder响应
   */
  private parseFoldersResponse(xmlResponse: string): Array<{ id: string; name: string }> {
    // 简化的实现，实际项目中需要完整的XML解析
    return [];
  }

  /**
   * 映射文件夹名称
   */
  private mapFolderName(folder: string): string {
    const folderMap: Record<string, string> = {
      'inbox': 'inbox',
      'sent': 'sentitems',
      'drafts': 'drafts',
      'trash': 'deleteditems',
      'spam': 'junkemail'
    };
    
    return folderMap[folder.toLowerCase()] || folder;
  }

  /**
   * 映射文件夹类型
   */
  private mapFolderType(folderName: string): string {
    const lowerName = folderName.toLowerCase();
    if (lowerName.includes('inbox')) return 'inbox';
    if (lowerName.includes('sent')) return 'sent';
    if (lowerName.includes('draft')) return 'drafts';
    if (lowerName.includes('deleted')) return 'trash';
    if (lowerName.includes('junk')) return 'spam';
    return 'custom';
  }
}