import axios, { AxiosInstance } from 'axios';
import { GraphUser, GraphMessage } from '@/types';
import { AuthService } from './AuthService';
import { MICROSOFT_CONFIG } from '@/config';
import logger from '@/utils/logger';
import { MicrosoftGraphError, ErrorUtils } from '@/utils/errors';

/**
 * Microsoft Graph API service
 * Handles communication with Microsoft Graph API for email and user data
 */
export class MicrosoftGraphService {
  private axiosInstance: AxiosInstance;

  constructor(private userId: string) {
    this.axiosInstance = axios.create({
      baseURL: MICROSOFT_CONFIG.GRAPH_ENDPOINT,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to automatically add auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          const accessToken = await AuthService.getValidMicrosoftToken(this.userId);
          config.headers.Authorization = `Bearer ${accessToken}`;
          return config;
        } catch (error) {
          logger.error('Failed to get Microsoft access token for request', { userId: this.userId, error });
          throw error;
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Microsoft Graph API error', {
          userId: this.userId,
          error: error.response?.data || error.message
        });
        throw ErrorUtils.handleMicrosoftGraphError(error);
      }
    );
  }

  /**
   * Get current user profile
   */
  async getUserProfile(): Promise<GraphUser> {
    try {
      const response = await this.axiosInstance.get('/me');
      logger.info('User profile retrieved successfully', { userId: this.userId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get user profile', { userId: this.userId, error });
      throw error;
    }
  }

  /**
   * Get user's mailboxes/folders
   */
  async getMailFolders(): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get('/me/mailFolders');
      logger.info('Mail folders retrieved successfully', { 
        userId: this.userId, 
        folderCount: response.data.value.length 
      });
      return response.data.value;
    } catch (error) {
      logger.error('Failed to get mail folders', { userId: this.userId, error });
      throw error;
    }
  }

  /**
   * Get messages from a specific folder
   */
  async getMessages(
    folderId = 'inbox',
    options: {
      top?: number;
      skip?: number;
      filter?: string;
      orderBy?: string;
      select?: string[];
    } = {}
  ): Promise<{
    messages: GraphMessage[];
    hasMore: boolean;
    nextLink?: string;
  }> {
    try {
      const params = new URLSearchParams();
      
      if (options.top) params.append('$top', options.top.toString());
      if (options.skip) params.append('$skip', options.skip.toString());
      if (options.filter) params.append('$filter', options.filter);
      if (options.orderBy) params.append('$orderby', options.orderBy);
      if (options.select) params.append('$select', options.select.join(','));

      const endpoint = folderId === 'inbox' 
        ? '/me/messages' 
        : `/me/mailFolders/${folderId}/messages`;

      const response = await this.axiosInstance.get(`${endpoint}?${params.toString()}`);
      
      logger.info('Messages retrieved successfully', { 
        userId: this.userId, 
        folderId,
        messageCount: response.data.value.length 
      });

      return {
        messages: response.data.value,
        hasMore: !!response.data['@odata.nextLink'],
        nextLink: response.data['@odata.nextLink']
      };
    } catch (error) {
      logger.error('Failed to get messages', { userId: this.userId, folderId, error });
      throw error;
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<GraphMessage> {
    try {
      const response = await this.axiosInstance.get(`/me/messages/${messageId}`);
      logger.info('Message retrieved successfully', { userId: this.userId, messageId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get message', { userId: this.userId, messageId, error });
      throw error;
    }
  }

  /**
   * Get recent messages (last 24 hours)
   */
  async getRecentMessages(top = 50): Promise<GraphMessage[]> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const filter = `receivedDateTime ge ${yesterday.toISOString()}`;
      
      const result = await this.getMessages('inbox', {
        top,
        filter,
        orderBy: 'receivedDateTime desc'
      });

      logger.info('Recent messages retrieved successfully', { 
        userId: this.userId, 
        messageCount: result.messages.length 
      });

      return result.messages;
    } catch (error) {
      logger.error('Failed to get recent messages', { userId: this.userId, error });
      throw error;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(
    query: string,
    options: {
      top?: number;
      skip?: number;
      folderId?: string;
    } = {}
  ): Promise<GraphMessage[]> {
    try {
      const params = new URLSearchParams();
      params.append('$search', `"${query}"`);
      
      if (options.top) params.append('$top', options.top.toString());
      if (options.skip) params.append('$skip', options.skip.toString());

      const endpoint = options.folderId 
        ? `/me/mailFolders/${options.folderId}/messages`
        : '/me/messages';

      const response = await this.axiosInstance.get(`${endpoint}?${params.toString()}`);
      
      logger.info('Message search completed', { 
        userId: this.userId, 
        query,
        resultCount: response.data.value.length 
      });

      return response.data.value;
    } catch (error) {
      logger.error('Failed to search messages', { userId: this.userId, query, error });
      throw error;
    }
  }

  /**
   * Mark message as read/unread
   */
  async updateMessageReadStatus(messageId: string, isRead: boolean): Promise<void> {
    try {
      await this.axiosInstance.patch(`/me/messages/${messageId}`, {
        isRead
      });
      
      logger.info('Message read status updated', { 
        userId: this.userId, 
        messageId, 
        isRead 
      });
    } catch (error) {
      logger.error('Failed to update message read status', { 
        userId: this.userId, 
        messageId, 
        isRead, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get message attachments
   */
  async getMessageAttachments(messageId: string): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(`/me/messages/${messageId}/attachments`);
      
      logger.info('Message attachments retrieved', { 
        userId: this.userId, 
        messageId,
        attachmentCount: response.data.value.length 
      });

      return response.data.value;
    } catch (error) {
      logger.error('Failed to get message attachments', { 
        userId: this.userId, 
        messageId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Send a reply to a message
   */
  async replyToMessage(
    messageId: string, 
    replyContent: string, 
    replyAll = false
  ): Promise<void> {
    try {
      const endpoint = replyAll 
        ? `/me/messages/${messageId}/replyAll`
        : `/me/messages/${messageId}/reply`;

      await this.axiosInstance.post(endpoint, {
        message: {
          body: {
            contentType: 'html',
            content: replyContent
          }
        }
      });

      logger.info('Reply sent successfully', { 
        userId: this.userId, 
        messageId, 
        replyAll 
      });
    } catch (error) {
      logger.error('Failed to send reply', { 
        userId: this.userId, 
        messageId, 
        replyAll, 
        error 
      });
      throw error;
    }
  }

  /**
   * Forward a message
   */
  async forwardMessage(
    messageId: string,
    toRecipients: string[],
    comment?: string
  ): Promise<void> {
    try {
      const recipients = toRecipients.map(email => ({
        emailAddress: { address: email }
      }));

      await this.axiosInstance.post(`/me/messages/${messageId}/forward`, {
        toRecipients: recipients,
        comment
      });

      logger.info('Message forwarded successfully', { 
        userId: this.userId, 
        messageId,
        recipientCount: toRecipients.length 
      });
    } catch (error) {
      logger.error('Failed to forward message', { 
        userId: this.userId, 
        messageId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get user's email usage statistics
   */
  async getEmailStats(): Promise<{
    totalMessages: number;
    unreadMessages: number;
    todayMessages: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [totalResult, unreadResult, todayResult] = await Promise.all([
        this.axiosInstance.get('/me/messages/$count'),
        this.axiosInstance.get('/me/messages/$count?$filter=isRead eq false'),
        this.axiosInstance.get(`/me/messages/$count?$filter=receivedDateTime ge ${today.toISOString()}`)
      ]);

      const stats = {
        totalMessages: parseInt(totalResult.data, 10),
        unreadMessages: parseInt(unreadResult.data, 10),
        todayMessages: parseInt(todayResult.data, 10)
      };

      logger.info('Email statistics retrieved', { userId: this.userId, stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get email statistics', { userId: this.userId, error });
      throw error;
    }
  }

  /**
   * Create subscription for real-time notifications
   */
  async createSubscription(notificationUrl: string): Promise<any> {
    try {
      const subscription = {
        changeType: 'created,updated',
        notificationUrl,
        resource: '/me/messages',
        expirationDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        clientState: this.userId
      };

      const response = await this.axiosInstance.post('/subscriptions', subscription);
      
      logger.info('Subscription created successfully', { 
        userId: this.userId, 
        subscriptionId: response.data.id 
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create subscription', { userId: this.userId, error });
      throw error;
    }
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/subscriptions/${subscriptionId}`);
      
      logger.info('Subscription deleted successfully', { 
        userId: this.userId, 
        subscriptionId 
      });
    } catch (error) {
      logger.error('Failed to delete subscription', { 
        userId: this.userId, 
        subscriptionId, 
        error 
      });
      throw error;
    }
  }
}