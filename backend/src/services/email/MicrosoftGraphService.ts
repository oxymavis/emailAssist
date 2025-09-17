import axios, { AxiosResponse } from 'axios';
import logger from '@/utils/logger';
import { AuthenticationError, EmailSyncError } from '@/types';
import { MicrosoftAuthService, MicrosoftTokens } from '../auth/MicrosoftAuthService';

/**
 * Microsoft Graph API邮件服务
 * 处理邮件数据的获取和同步
 */

export interface GraphEmailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  internetMessageId: string;
  conversationId: string;
  parentFolderId: string;
}

export interface GraphFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
  sizeInBytes?: number;
  isHidden?: boolean;
}

export interface EmailSyncOptions {
  folderId?: string;
  pageSize?: number;
  skipToken?: string;
  filter?: string;
  orderBy?: string;
  select?: string[];
}

export interface EmailSyncResult {
  messages: GraphEmailMessage[];
  nextPageToken?: string;
  totalCount?: number;
  hasMore: boolean;
}

export class MicrosoftGraphService {
  private static instance: MicrosoftGraphService;
  private readonly authService: MicrosoftAuthService;
  private readonly graphUrl = 'https://graph.microsoft.com/v1.0';
  private readonly betaUrl = 'https://graph.microsoft.com/beta';

  private constructor() {
    this.authService = MicrosoftAuthService.getInstance();
  }

  public static getInstance(): MicrosoftGraphService {
    if (!MicrosoftGraphService.instance) {
      MicrosoftGraphService.instance = new MicrosoftGraphService();
    }
    return MicrosoftGraphService.instance;
  }

  /**
   * 执行认证请求的通用方法
   */
  private async makeAuthenticatedRequest(
    tokens: MicrosoftTokens,
    url: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    data?: any
  ): Promise<AxiosResponse> {
    try {
      // Ensure token is valid
      const validTokens = await this.authService.ensureValidToken(tokens);

      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${validTokens.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'outlook.timezone="UTC"', // Ensure consistent timezone
        },
        data,
        timeout: 30000
      });

      return response;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new AuthenticationError('Microsoft Graph API authentication failed');
      }
      
      logger.error('Microsoft Graph API request failed', {
        url,
        method,
        status: error.response?.status,
        error: error.response?.data || error.message
      });
      
      throw new EmailSyncError(`Microsoft Graph API request failed: ${error.message}`);
    }
  }

  /**
   * 获取用户邮箱文件夹列表
   */
  public async getFolders(tokens: MicrosoftTokens, includeHidden: boolean = false): Promise<GraphFolder[]> {
    try {
      const url = `${this.graphUrl}/me/mailFolders`;
      const params = new URLSearchParams({
        '$select': 'id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount,sizeInBytes,isHidden',
        '$top': '250'
      });

      if (includeHidden) {
        params.append('$filter', 'isHidden eq false or isHidden eq true');
      }

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      logger.info('Successfully retrieved mail folders', {
        count: response.data.value?.length || 0
      });

      return response.data.value || [];
    } catch (error) {
      logger.error('Failed to get mail folders', error);
      throw error;
    }
  }

  /**
   * 获取指定文件夹的子文件夹
   */
  public async getChildFolders(tokens: MicrosoftTokens, folderId: string): Promise<GraphFolder[]> {
    try {
      const url = `${this.graphUrl}/me/mailFolders/${folderId}/childFolders`;
      const params = new URLSearchParams({
        '$select': 'id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount,sizeInBytes',
        '$top': '100'
      });

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      return response.data.value || [];
    } catch (error) {
      logger.error('Failed to get child folders', { folderId, error });
      throw error;
    }
  }

  /**
   * 获取邮件列表
   */
  public async getMessages(tokens: MicrosoftTokens, options: EmailSyncOptions = {}): Promise<EmailSyncResult> {
    try {
      const {
        folderId = 'inbox',
        pageSize = 50,
        skipToken,
        filter,
        orderBy = 'receivedDateTime desc',
        select
      } = options;

      let url: string;
      if (folderId === 'inbox') {
        url = `${this.graphUrl}/me/messages`;
      } else {
        url = `${this.graphUrl}/me/mailFolders/${folderId}/messages`;
      }

      const params = new URLSearchParams({
        '$top': pageSize.toString(),
        '$orderby': orderBy
      });

      // 选择需要的字段以优化性能
      const defaultSelect = [
        'id', 'subject', 'bodyPreview', 'body', 'from', 'toRecipients', 'ccRecipients',
        'receivedDateTime', 'sentDateTime', 'isRead', 'importance', 'hasAttachments',
        'internetMessageId', 'conversationId', 'parentFolderId'
      ];
      params.append('$select', (select || defaultSelect).join(','));

      if (filter) {
        params.append('$filter', filter);
      }

      if (skipToken) {
        params.append('$skiptoken', skipToken);
      }

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      const messages: GraphEmailMessage[] = response.data.value || [];
      const nextLink = response.data['@odata.nextLink'];
      const nextPageToken = nextLink ? this.extractSkipToken(nextLink) : undefined;

      logger.info('Successfully retrieved messages', {
        folderId,
        count: messages.length,
        hasMore: !!nextPageToken
      });

      return {
        messages,
        nextPageToken,
        hasMore: !!nextPageToken,
        totalCount: response.data['@odata.count']
      };
    } catch (error) {
      logger.error('Failed to get messages', { options, error });
      throw error;
    }
  }

  /**
   * 获取增量邮件更新（Delta Query）
   */
  public async getDeltaMessages(tokens: MicrosoftTokens, deltaToken?: string, folderId?: string): Promise<{
    messages: GraphEmailMessage[];
    deltaToken: string;
    hasMore: boolean;
  }> {
    try {
      let url: string;
      if (folderId) {
        url = `${this.graphUrl}/me/mailFolders/${folderId}/messages/delta`;
      } else {
        url = `${this.graphUrl}/me/messages/delta`;
      }

      const params = new URLSearchParams({
        '$select': 'id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,importance,hasAttachments'
      });

      if (deltaToken) {
        params.append('$deltatoken', deltaToken);
      }

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      const messages: GraphEmailMessage[] = response.data.value || [];
      const nextLink = response.data['@odata.nextLink'];
      const newDeltaToken = response.data['@odata.deltaLink'] ? 
        this.extractDeltaToken(response.data['@odata.deltaLink']) : '';

      logger.info('Successfully retrieved delta messages', {
        count: messages.length,
        hasMore: !!nextLink,
        hasDeltaToken: !!newDeltaToken
      });

      return {
        messages,
        deltaToken: newDeltaToken,
        hasMore: !!nextLink
      };
    } catch (error) {
      logger.error('Failed to get delta messages', error);
      throw error;
    }
  }

  /**
   * 获取邮件详细内容
   */
  public async getMessageDetail(tokens: MicrosoftTokens, messageId: string): Promise<GraphEmailMessage> {
    try {
      const url = `${this.graphUrl}/me/messages/${messageId}`;
      const params = new URLSearchParams({
        '$select': 'id,subject,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,internetMessageId,conversationId,parentFolderId'
      });

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      logger.debug('Successfully retrieved message detail', { messageId });

      return response.data;
    } catch (error) {
      logger.error('Failed to get message detail', { messageId, error });
      throw error;
    }
  }

  /**
   * 获取邮件附件列表
   */
  public async getMessageAttachments(tokens: MicrosoftTokens, messageId: string): Promise<any[]> {
    try {
      const url = `${this.graphUrl}/me/messages/${messageId}/attachments`;
      const params = new URLSearchParams({
        '$select': 'id,name,size,contentType,isInline'
      });

      const response = await this.makeAuthenticatedRequest(tokens, `${url}?${params.toString()}`);
      
      return response.data.value || [];
    } catch (error) {
      logger.error('Failed to get message attachments', { messageId, error });
      throw error;
    }
  }

  /**
   * 标记邮件为已读/未读
   */
  public async markMessageAsRead(tokens: MicrosoftTokens, messageId: string, isRead: boolean = true): Promise<void> {
    try {
      const url = `${this.graphUrl}/me/messages/${messageId}`;
      const data = { isRead };

      await this.makeAuthenticatedRequest(tokens, url, 'PATCH', data);
      
      logger.debug('Successfully updated message read status', { messageId, isRead });
    } catch (error) {
      logger.error('Failed to update message read status', { messageId, isRead, error });
      throw error;
    }
  }

  /**
   * 移动邮件到指定文件夹
   */
  public async moveMessage(tokens: MicrosoftTokens, messageId: string, destinationFolderId: string): Promise<void> {
    try {
      const url = `${this.graphUrl}/me/messages/${messageId}/move`;
      const data = { destinationId: destinationFolderId };

      await this.makeAuthenticatedRequest(tokens, url, 'POST', data);
      
      logger.debug('Successfully moved message', { messageId, destinationFolderId });
    } catch (error) {
      logger.error('Failed to move message', { messageId, destinationFolderId, error });
      throw error;
    }
  }

  /**
   * 删除邮件
   */
  public async deleteMessage(tokens: MicrosoftTokens, messageId: string): Promise<void> {
    try {
      const url = `${this.graphUrl}/me/messages/${messageId}`;

      await this.makeAuthenticatedRequest(tokens, url, 'DELETE');
      
      logger.debug('Successfully deleted message', { messageId });
    } catch (error) {
      logger.error('Failed to delete message', { messageId, error });
      throw error;
    }
  }

  /**
   * 设置邮件Webhook订阅 (用于实时同步)
   */
  public async createSubscription(tokens: MicrosoftTokens, notificationUrl: string, resource: string = 'me/messages'): Promise<any> {
    try {
      const url = `${this.graphUrl}/subscriptions`;
      const expirationDateTime = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days from now
      
      const data = {
        changeType: 'created,updated',
        notificationUrl,
        resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: 'email-assist-subscription'
      };

      const response = await this.makeAuthenticatedRequest(tokens, url, 'POST', data);
      
      logger.info('Successfully created subscription', {
        subscriptionId: response.data.id,
        resource,
        expirationDateTime
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create subscription', { notificationUrl, resource, error });
      throw error;
    }
  }

  /**
   * 更新订阅到期时间
   */
  public async renewSubscription(tokens: MicrosoftTokens, subscriptionId: string): Promise<any> {
    try {
      const url = `${this.graphUrl}/subscriptions/${subscriptionId}`;
      const expirationDateTime = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days from now
      
      const data = {
        expirationDateTime: expirationDateTime.toISOString()
      };

      const response = await this.makeAuthenticatedRequest(tokens, url, 'PATCH', data);
      
      logger.info('Successfully renewed subscription', {
        subscriptionId,
        expirationDateTime
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to renew subscription', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * 删除订阅
   */
  public async deleteSubscription(tokens: MicrosoftTokens, subscriptionId: string): Promise<void> {
    try {
      const url = `${this.graphUrl}/subscriptions/${subscriptionId}`;

      await this.makeAuthenticatedRequest(tokens, url, 'DELETE');
      
      logger.info('Successfully deleted subscription', { subscriptionId });
    } catch (error) {
      logger.error('Failed to delete subscription', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * 辅助方法：从nextLink中提取skipToken
   */
  private extractSkipToken(nextLink: string): string | undefined {
    const url = new URL(nextLink);
    return url.searchParams.get('$skiptoken') || undefined;
  }

  /**
   * 辅助方法：从deltaLink中提取deltaToken
   */
  private extractDeltaToken(deltaLink: string): string {
    const url = new URL(deltaLink);
    return url.searchParams.get('$deltatoken') || '';
  }

  /**
   * 检查Graph API服务健康状态
   */
  public async checkHealth(tokens: MicrosoftTokens): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest(tokens, `${this.graphUrl}/me`);
      return true;
    } catch (error) {
      logger.error('Microsoft Graph health check failed', error);
      return false;
    }
  }

  /**
   * 获取用户邮箱统计信息
   */
  public async getMailboxStats(tokens: MicrosoftTokens): Promise<{
    totalMessages: number;
    unreadMessages: number;
    folders: number;
  }> {
    try {
      // Get folder statistics
      const folders = await this.getFolders(tokens);
      const totalMessages = folders.reduce((sum, folder) => sum + (folder.totalItemCount || 0), 0);
      const unreadMessages = folders.reduce((sum, folder) => sum + (folder.unreadItemCount || 0), 0);

      return {
        totalMessages,
        unreadMessages,
        folders: folders.length
      };
    } catch (error) {
      logger.error('Failed to get mailbox stats', error);
      throw error;
    }
  }
}

export default MicrosoftGraphService;