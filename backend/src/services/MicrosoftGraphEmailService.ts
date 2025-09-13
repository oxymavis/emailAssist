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
      }));\n\n      const tokens = await MicrosoftAuthToken.findByUserId(userId);\n      const userEmail = tokens?.email || 'unknown@email.com';\n\n      return {\n        emails,\n        total: emails.length,\n        userEmail\n      };\n\n    } catch (error) {\n      logger.error('Failed to get emails', {\n        userId,\n        options,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      throw error;\n    }\n  }\n\n  /**\n   * Get a single email by ID\n   */\n  async getEmailById(userId: string, messageId: string): Promise<any> {\n    try {\n      const accessToken = await this.getValidAccessToken(userId);\n      if (!accessToken) {\n        throw new Error('No valid Microsoft access token available');\n      }\n\n      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;\n\n      const response = await this.httpClient.get(`/me/messages/${messageId}`);\n      const message = response.data;\n\n      return {\n        id: message.id,\n        subject: message.subject || '(No Subject)',\n        from: {\n          name: message.from?.emailAddress?.name || '',\n          address: message.from?.emailAddress?.address || ''\n        },\n        recipients: {\n          to: message.toRecipients?.map((r: any) => ({\n            name: r.emailAddress.name,\n            address: r.emailAddress.address\n          })) || [],\n          cc: message.ccRecipients?.map((r: any) => ({\n            name: r.emailAddress.name,\n            address: r.emailAddress.address\n          })) || []\n        },\n        content: {\n          text: message.body?.contentType === 'text' ? message.body.content : undefined,\n          html: message.body?.contentType === 'html' ? message.body.content : undefined,\n          snippet: message.bodyPreview\n        },\n        receivedAt: message.receivedDateTime,\n        sentAt: message.sentDateTime,\n        isRead: message.isRead,\n        hasAttachments: message.hasAttachments,\n        importance: message.importance,\n        conversationId: message.conversationId,\n        webLink: message.webLink\n      };\n\n    } catch (error) {\n      logger.error('Failed to get email by ID', {\n        userId,\n        messageId,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      throw error;\n    }\n  }\n\n  /**\n   * Mark email as read or unread\n   */\n  async markEmailAsRead(userId: string, messageId: string, isRead: boolean = true): Promise<void> {\n    try {\n      const accessToken = await this.getValidAccessToken(userId);\n      if (!accessToken) {\n        throw new Error('No valid Microsoft access token available');\n      }\n\n      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;\n\n      await this.httpClient.patch(`/me/messages/${messageId}`, {\n        isRead: Boolean(isRead)\n      });\n\n      logger.info('Email read status updated', {\n        userId,\n        messageId,\n        isRead: Boolean(isRead)\n      });\n\n    } catch (error) {\n      logger.error('Failed to update email read status', {\n        userId,\n        messageId,\n        isRead,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      throw error;\n    }\n  }\n\n  /**\n   * Get user's Microsoft account info\n   */\n  async getUserInfo(userId: string): Promise<{ email: string; name: string }> {\n    try {\n      const accessToken = await this.getValidAccessToken(userId);\n      if (!accessToken) {\n        throw new Error('No valid Microsoft access token available');\n      }\n\n      this.httpClient.defaults.headers.Authorization = `Bearer ${accessToken}`;\n\n      const response = await this.httpClient.get('/me');\n      const userInfo = response.data;\n\n      return {\n        email: userInfo.mail || userInfo.userPrincipalName,\n        name: userInfo.displayName || 'Unknown User'\n      };\n\n    } catch (error) {\n      logger.error('Failed to get user info', {\n        userId,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      throw error;\n    }\n  }\n\n  /**\n   * Check if user has valid Microsoft connection\n   */\n  async hasValidConnection(userId: string): Promise<boolean> {\n    try {\n      const tokens = await MicrosoftAuthToken.findByUserId(userId);\n      if (!tokens || !tokens.refreshToken) {\n        return false;\n      }\n\n      // Try to get a valid access token\n      const accessToken = await this.getValidAccessToken(userId);\n      return !!accessToken;\n\n    } catch (error) {\n      logger.error('Failed to check Microsoft connection', {\n        userId,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      return false;\n    }\n  }\n\n  /**\n   * Get valid access token for user (refresh if needed)\n   */\n  private async getValidAccessToken(userId: string): Promise<string | null> {\n    try {\n      const tokens = await MicrosoftAuthToken.findByUserId(userId);\n      \n      if (!tokens) {\n        logger.warn('No Microsoft tokens found for user', { userId });\n        return null;\n      }\n\n      // Check if token is still valid (with 5 minute buffer)\n      const now = new Date();\n      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds\n      \n      if (tokens.expiresAt.getTime() - now.getTime() > bufferTime) {\n        return tokens.accessToken;\n      }\n\n      // Token is expired or about to expire, need to refresh\n      if (!tokens.refreshToken) {\n        logger.warn('No refresh token available for user', { userId });\n        return null;\n      }\n\n      // Refresh the token\n      const newTokens = await this.refreshAccessToken(tokens.refreshToken);\n      \n      // Update tokens in database\n      await MicrosoftAuthToken.updateTokens(\n        userId,\n        newTokens.accessToken,\n        newTokens.refreshToken,\n        newTokens.expiresIn\n      );\n\n      logger.info('Microsoft access token refreshed successfully', { userId });\n      \n      return newTokens.accessToken;\n\n    } catch (error) {\n      logger.error('Failed to get valid access token', {\n        userId,\n        error: error instanceof Error ? error.message : 'Unknown error'\n      });\n      return null;\n    }\n  }\n\n  /**\n   * Refresh Microsoft access token\n   */\n  private async refreshAccessToken(refreshToken: string): Promise<{\n    accessToken: string;\n    refreshToken?: string;\n    expiresIn: number;\n  }> {\n    const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;\n    \n    const params = new URLSearchParams({\n      client_id: process.env.MICROSOFT_CLIENT_ID!,\n      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,\n      refresh_token: refreshToken,\n      grant_type: 'refresh_token',\n      scope: process.env.MICROSOFT_GRAPH_SCOPE || 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read'\n    });\n\n    const response = await axios.post(tokenUrl, params.toString(), {\n      headers: {\n        'Content-Type': 'application/x-www-form-urlencoded'\n      },\n      timeout: 30000\n    });\n\n    if (!response.data.access_token) {\n      throw new Error('No access token in refresh response');\n    }\n\n    return {\n      accessToken: response.data.access_token,\n      refreshToken: response.data.refresh_token,\n      expiresIn: response.data.expires_in || 3600\n    };\n  }\n\n  /**\n   * Truncate email preview text\n   */\n  private truncatePreview(text: string | undefined, maxLength: number = 200): string {\n    if (!text) return '';\n    \n    if (text.length <= maxLength) {\n      return text;\n    }\n    \n    return text.substring(0, maxLength).trim() + '...';\n  }\n}\n\n// Export singleton instance\nexport const microsoftGraphEmailService = new MicrosoftGraphEmailService();