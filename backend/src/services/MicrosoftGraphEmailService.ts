/**
 * Microsoft Graph Email Service
 * Simplified service for Email Assist backend integration
 */

import axios, { AxiosInstance } from 'axios';
import { MicrosoftAuthToken } from '@/models/MicrosoftAuthToken';
import logger from '@/utils/logger';

export interface UnreadEmailMessage {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  conversationId?: string;
  webLink?: string;
}

export interface EmailSearchOptions {
  limit?: number;
  folder?: string;
  isRead?: boolean;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Microsoft Graph Email Service
 * Handles email operations using Microsoft Graph API
 */
export class MicrosoftGraphEmailService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get unread emails for a user
   */
  async getUnreadEmails(userId: string, options: EmailSearchOptions = {}): Promise<{
    emails: UnreadEmailMessage[];
    total: number;
    userEmail: string;
  }> {
    try {
      // Get valid access token for user
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No valid Microsoft access token available');
      }

      // Set authorization header
      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;

      const {
        limit = 50,
        folder = 'inbox',
        orderBy = 'receivedDateTime',
        orderDirection = 'desc'
      } = options;

      // Build query parameters for unread emails
      const queryParams = new URLSearchParams();
      queryParams.set('$filter', 'isRead eq false');
      queryParams.set('$top', String(Math.min(Number(limit), 100))); // Microsoft Graph limit
      queryParams.set('$orderby', `${orderBy} ${orderDirection}`);
      queryParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance,conversationId,webLink');

      // Determine endpoint based on folder
      const endpoint = folder === 'inbox' 
        ? '/me/messages' 
        : `/me/mailFolders/${folder}/messages`;

      logger.info('Fetching unread emails from Microsoft Graph', {
        userId,
        endpoint,
        limit,
        folder
      });

      // Make request to Microsoft Graph
      const response = await this.httpClient.get(`${endpoint}?${queryParams.toString()}`);

      // Transform messages to our format
      const emails: UnreadEmailMessage[] = response.data.value.map((message: any) => ({
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: {
          name: message.from?.emailAddress?.name || 'Unknown Sender',
          address: message.from?.emailAddress?.address || 'unknown@email.com'
        },
        receivedAt: message.receivedDateTime,
        preview: this.truncatePreview(message.bodyPreview),
        isRead: message.isRead,
        hasAttachments: message.hasAttachments || false,
        importance: message.importance || 'normal',
        conversationId: message.conversationId,
        webLink: message.webLink
      }));

      // Get user email from tokens
      const tokens = await MicrosoftAuthToken.findByUserId(userId);
      const userEmail = tokens?.email || 'unknown@email.com';

      logger.info('Unread emails retrieved successfully', {
        userId,
        userEmail,
        count: emails.length
      });

      return {
        emails,
        total: emails.length,
        userEmail
      };

    } catch (error) {
      logger.error('Failed to get unread emails', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get all emails (with filtering options)
   */
  async getEmails(userId: string, options: EmailSearchOptions = {}): Promise<{
    emails: UnreadEmailMessage[];
    total: number;
    userEmail: string;
  }> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No valid Microsoft access token available');
      }

      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;

      const {
        limit = 20,
        folder = 'inbox',
        isRead,
        orderBy = 'receivedDateTime',
        orderDirection = 'desc'
      } = options;

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.set('$top', String(Math.min(Number(limit), 100)));
      queryParams.set('$orderby', `${orderBy} ${orderDirection}`);
      queryParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance,conversationId,webLink');

      // Add read/unread filter if specified
      if (isRead !== undefined) {
        queryParams.set('$filter', `isRead eq ${Boolean(isRead)}`);
      }

      const endpoint = folder === 'inbox' 
        ? '/me/messages' 
        : `/me/mailFolders/${folder}/messages`;

      const response = await this.httpClient.get(`${endpoint}?${queryParams.toString()}`);

      const emails: UnreadEmailMessage[] = response.data.value.map((message: any) => ({
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: {
          name: message.from?.emailAddress?.name || 'Unknown Sender',
          address: message.from?.emailAddress?.address || 'unknown@email.com'
        },
        receivedAt: message.receivedDateTime,
        preview: this.truncatePreview(message.bodyPreview),
        isRead: message.isRead,
        hasAttachments: message.hasAttachments || false,
        importance: message.importance || 'normal',
        conversationId: message.conversationId,
        webLink: message.webLink
      }));

      const tokens = await MicrosoftAuthToken.findByUserId(userId);
      const userEmail = tokens?.email || 'unknown@email.com';

      return {
        emails,
        total: emails.length,
        userEmail
      };

    } catch (error) {
      logger.error('Failed to get emails', {
        userId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get a single email by ID
   */
  async getEmailById(userId: string, messageId: string): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No valid Microsoft access token available');
      }

      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;

      const response = await this.httpClient.get(`/me/messages/${messageId}`);
      const message = response.data;

      return {
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: {
          name: message.from?.emailAddress?.name || '',
          address: message.from?.emailAddress?.address || ''
        },
        recipients: {
          to: message.toRecipients?.map((r: any) => ({
            name: r.emailAddress.name,
            address: r.emailAddress.address
          })) || [],
          cc: message.ccRecipients?.map((r: any) => ({
            name: r.emailAddress.name,
            address: r.emailAddress.address
          })) || []
        },
        content: {
          text: message.body?.contentType === 'text' ? message.body.content : undefined,
          html: message.body?.contentType === 'html' ? message.body.content : undefined,
          snippet: message.bodyPreview
        },
        receivedAt: message.receivedDateTime,
        sentAt: message.sentDateTime,
        isRead: message.isRead,
        hasAttachments: message.hasAttachments,
        importance: message.importance,
        conversationId: message.conversationId,
        webLink: message.webLink
      };

    } catch (error) {
      logger.error('Failed to get email by ID', {
        userId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Mark email as read or unread
   */
  async markEmailAsRead(userId: string, messageId: string, isRead: boolean = true): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No valid Microsoft access token available');
      }

      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;

      await this.httpClient.patch(`/me/messages/${messageId}`, {
        isRead: Boolean(isRead)
      });

      logger.info('Email read status updated', {
        userId,
        messageId,
        isRead: Boolean(isRead)
      });

    } catch (error) {
      logger.error('Failed to update email read status', {
        userId,
        messageId,
        isRead,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's Microsoft account info
   */
  async getUserInfo(userId: string): Promise<{ email: string; name: string }> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No valid Microsoft access token available');
      }

      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;

      const response = await this.httpClient.get('/me');
      const userInfo = response.data;

      return {
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName || 'Unknown User'
      };

    } catch (error) {
      logger.error('Failed to get user info', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if user has valid Microsoft connection
   */
  async hasValidConnection(userId: string): Promise<boolean> {
    try {
      const tokens = await MicrosoftAuthToken.findByUserId(userId);
      if (!tokens || !tokens.refreshToken) {
        return false;
      }

      // Try to get a valid access token
      const accessToken = await this.getValidAccessToken(userId);
      return !!accessToken;

    } catch (error) {
      logger.error('Failed to check Microsoft connection', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get valid access token for user (refresh if needed)
   */
  private async getValidAccessToken(userId: string): Promise<string | null> {
    try {
      const tokens = await MicrosoftAuthToken.findByUserId(userId);

      if (!tokens) {
        logger.warn('No Microsoft tokens found for user', { userId });
        return null;
      }

      // Check if token is still valid (with 5 minute buffer)
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (tokens.expiresAt.getTime() - now.getTime() > bufferTime) {
        return tokens.accessToken;
      }

      // Token is expired or about to expire, need to refresh
      if (!tokens.refreshToken) {
        logger.warn('No refresh token available for user', { userId });
        return null;
      }

      // Refresh the token
      const newTokens = await this.refreshAccessToken(tokens.refreshToken);

      // Update tokens in database
      await MicrosoftAuthToken.updateTokens(
        userId,
        newTokens.accessToken,
        newTokens.refreshToken,
        newTokens.expiresIn
      );

      logger.info('Microsoft access token refreshed successfully', { userId });

      return newTokens.accessToken;

    } catch (error) {
      logger.error('Failed to get valid access token', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Refresh Microsoft access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: process.env.MICROSOFT_GRAPH_SCOPE || 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read'
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (!response.data.access_token) {
      throw new Error('No access token in refresh response');
    }

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in || 3600
    };
  }

  /**
   * Truncate email preview text
   */
  private truncatePreview(text: string | undefined, maxLength: number = 200): string {
    if (!text) return '';

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength).trim() + '...';
  }
}

// Export singleton instance
export const microsoftGraphEmailService = new MicrosoftGraphEmailService();