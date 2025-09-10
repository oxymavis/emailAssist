import { Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { UserModel } from '@/models/User';
import { ResponseHandler } from '@/utils/response';
import logger from '@/utils/logger';
import {
  ValidationError,
  NotFoundError,
  MicrosoftGraphError,
  ERROR_MESSAGES
} from '@/utils/errors';

/**
 * Email controller
 * Handles email account connections and email operations
 */
export class EmailController {
  /**
   * Connect email account (Microsoft)
   * POST /api/email/connect
   */
  static async connectAccount(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { provider, code } = req.body;

      if (provider !== 'microsoft') {
        throw new ValidationError('Only Microsoft provider is supported currently');
      }

      if (!code) {
        throw new ValidationError('Authorization code is required');
      }

      // The connection should already be established during auth
      // This endpoint is mainly for reconnection scenarios
      const tokens = await UserModel.getMicrosoftTokens(user.id);
      if (!tokens) {
        throw new ValidationError('Microsoft account not connected. Please authenticate first.');
      }

      // Test the connection by getting user profile
      const graphService = new MicrosoftGraphService(user.id);
      const profile = await graphService.getUserProfile();

      logger.info('Email account connection verified', {
        userId: user.id,
        provider,
        email: profile.mail,
        requestId: req.requestId
      });

      ResponseHandler.success(res, {
        provider,
        email: profile.mail,
        displayName: profile.displayName,
        isConnected: true,
        connectedAt: new Date().toISOString()
      }, 'Email account connected successfully');
    } catch (error) {
      logger.error('Failed to connect email account', {
        userId: req.user?.id,
        error,
        requestId: req.requestId
      });

      if (error instanceof ValidationError) {
        ResponseHandler.validationError(res, [{
          field: 'provider',
          message: error.message
        }]);
        return;
      }

      ResponseHandler.error(
        res,
        'Failed to connect email account',
        500,
        'EMAIL_CONNECTION_ERROR'
      );
    }
  }

  /**
   * Get connected email accounts
   * GET /api/email/accounts
   */
  static async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Check Microsoft connection
      const microsoftTokens = await UserModel.getMicrosoftTokens(user.id);
      const accounts = [];

      if (microsoftTokens) {
        try {
          const graphService = new MicrosoftGraphService(user.id);
          const profile = await graphService.getUserProfile();
          
          accounts.push({
            id: `microsoft_${user.id}`,
            provider: 'microsoft',
            email: profile.mail || profile.userPrincipalName,
            displayName: profile.displayName,
            isConnected: true,
            lastSyncAt: null, // Will implement sync tracking later
            syncStatus: 'idle'
          });
        } catch (error) {
          // Connection exists but may be invalid
          accounts.push({
            id: `microsoft_${user.id}`,
            provider: 'microsoft',
            email: 'Unknown',
            displayName: 'Microsoft Account',
            isConnected: false,
            lastSyncAt: null,
            syncStatus: 'error',
            errorMessage: 'Connection invalid or expired'
          });
        }
      }

      logger.info('Email accounts retrieved', {
        userId: user.id,
        accountCount: accounts.length,
        requestId: req.requestId
      });

      ResponseHandler.success(res, {
        accounts,
        total: accounts.length
      }, 'Email accounts retrieved successfully');
    } catch (error) {
      logger.error('Failed to get email accounts', {
        userId: req.user?.id,
        error,
        requestId: req.requestId
      });

      ResponseHandler.error(
        res,
        'Failed to retrieve email accounts',
        500,
        'EMAIL_ACCOUNTS_ERROR'
      );
    }
  }

  /**
   * Get emails from connected accounts
   * GET /api/email/messages
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const {
        folder = 'inbox',
        top = 50,
        skip = 0,
        filter,
        orderBy = 'receivedDateTime desc'
      } = req.query;

      const graphService = new MicrosoftGraphService(user.id);
      
      const result = await graphService.getMessages(folder as string, {
        top: parseInt(top as string),
        skip: parseInt(skip as string),
        filter: filter as string,
        orderBy: orderBy as string
      });

      // Transform messages for frontend
      const transformedMessages = result.messages.map(message => ({
        id: message.id,
        subject: message.subject,
        sender: {
          name: message.from?.emailAddress?.name || message.sender?.emailAddress?.name,
          email: message.from?.emailAddress?.address || message.sender?.emailAddress?.address
        },
        receivedAt: message.receivedDateTime,
        isRead: message.isRead,
        importance: message.importance,
        hasAttachments: message.hasAttachments,
        bodyPreview: message.bodyPreview,
        conversationId: message.conversationId
      }));

      logger.info('Messages retrieved successfully', {
        userId: user.id,
        folder,
        messageCount: transformedMessages.length,
        requestId: req.requestId
      });

      const pagination = ResponseHandler.createPagination(
        Math.floor(parseInt(skip as string) / parseInt(top as string)) + 1,
        parseInt(top as string),
        transformedMessages.length // This is approximate, Graph API doesn't provide total count
      );

      ResponseHandler.success(
        res,
        {
          messages: transformedMessages,
          folder,
          hasMore: result.hasMore
        },
        'Messages retrieved successfully',
        200,
        pagination
      );
    } catch (error) {
      logger.error('Failed to get messages', {
        userId: req.user?.id,
        error,
        requestId: req.requestId
      });

      ResponseHandler.error(
        res,
        'Failed to retrieve messages',
        500,
        'EMAIL_MESSAGES_ERROR'
      );
    }
  }

  /**
   * Get specific message by ID
   * GET /api/email/messages/:id
   */
  static async getMessage(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { id: messageId } = req.params;

      const graphService = new MicrosoftGraphService(user.id);
      const message = await graphService.getMessage(messageId);

      // Transform message for frontend
      const transformedMessage = {
        id: message.id,
        subject: message.subject,
        sender: {
          name: message.from?.emailAddress?.name || message.sender?.emailAddress?.name,
          email: message.from?.emailAddress?.address || message.sender?.emailAddress?.address
        },
        recipients: message.toRecipients?.map(r => ({
          name: r.emailAddress.name,
          email: r.emailAddress.address
        })) || [],
        ccRecipients: message.ccRecipients?.map(r => ({
          name: r.emailAddress.name,
          email: r.emailAddress.address
        })) || [],
        receivedAt: message.receivedDateTime,
        sentAt: message.sentDateTime,
        isRead: message.isRead,
        importance: message.importance,
        hasAttachments: message.hasAttachments,
        body: {
          contentType: message.body.contentType,
          content: message.body.content
        },
        conversationId: message.conversationId
      };

      logger.info('Message retrieved successfully', {
        userId: user.id,
        messageId,
        requestId: req.requestId
      });

      ResponseHandler.success(res, transformedMessage, 'Message retrieved successfully');
    } catch (error) {
      logger.error('Failed to get message', {
        userId: req.user?.id,
        messageId: req.params.id,
        error,
        requestId: req.requestId
      });

      if (error instanceof MicrosoftGraphError && error.message.includes('404')) {
        ResponseHandler.notFound(res, 'Message');
        return;
      }

      ResponseHandler.error(
        res,
        'Failed to retrieve message',
        500,
        'EMAIL_MESSAGE_ERROR'
      );
    }
  }

  /**
   * Search messages
   * GET /api/email/search
   */
  static async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { q: query, top = 50, skip = 0, folder } = req.query;

      if (!query) {
        throw new ValidationError('Search query is required');
      }

      const graphService = new MicrosoftGraphService(user.id);
      const messages = await graphService.searchMessages(query as string, {
        top: parseInt(top as string),
        skip: parseInt(skip as string),
        folderId: folder as string
      });

      // Transform messages for frontend
      const transformedMessages = messages.map(message => ({
        id: message.id,
        subject: message.subject,
        sender: {
          name: message.from?.emailAddress?.name || message.sender?.emailAddress?.name,
          email: message.from?.emailAddress?.address || message.sender?.emailAddress?.address
        },
        receivedAt: message.receivedDateTime,
        isRead: message.isRead,
        importance: message.importance,
        hasAttachments: message.hasAttachments,
        bodyPreview: message.bodyPreview
      }));

      logger.info('Message search completed', {
        userId: user.id,
        query,
        resultCount: transformedMessages.length,
        requestId: req.requestId
      });

      ResponseHandler.success(res, {
        messages: transformedMessages,
        query,
        total: transformedMessages.length
      }, 'Search completed successfully');
    } catch (error) {
      logger.error('Failed to search messages', {
        userId: req.user?.id,
        query: req.query.q,
        error,
        requestId: req.requestId
      });

      if (error instanceof ValidationError) {
        ResponseHandler.validationError(res, [{
          field: 'q',
          message: error.message
        }]);
        return;
      }

      ResponseHandler.error(
        res,
        'Failed to search messages',
        500,
        'EMAIL_SEARCH_ERROR'
      );
    }
  }

  /**
   * Mark message as read/unread
   * PATCH /api/email/messages/:id/read
   */
  static async updateReadStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { id: messageId } = req.params;
      const { isRead } = req.body;

      const graphService = new MicrosoftGraphService(user.id);
      await graphService.updateMessageReadStatus(messageId, isRead);

      logger.info('Message read status updated', {
        userId: user.id,
        messageId,
        isRead,
        requestId: req.requestId
      });

      ResponseHandler.success(res, {
        messageId,
        isRead
      }, 'Message read status updated successfully');
    } catch (error) {
      logger.error('Failed to update message read status', {
        userId: req.user?.id,
        messageId: req.params.id,
        error,
        requestId: req.requestId
      });

      ResponseHandler.error(
        res,
        'Failed to update message read status',
        500,
        'EMAIL_UPDATE_ERROR'
      );
    }
  }

  /**
   * Get email statistics
   * GET /api/email/stats
   */
  static async getEmailStats(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      const graphService = new MicrosoftGraphService(user.id);
      const stats = await graphService.getEmailStats();

      logger.info('Email statistics retrieved', {
        userId: user.id,
        stats,
        requestId: req.requestId
      });

      ResponseHandler.success(res, stats, 'Email statistics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get email statistics', {
        userId: req.user?.id,
        error,
        requestId: req.requestId
      });

      ResponseHandler.error(
        res,
        'Failed to retrieve email statistics',
        500,
        'EMAIL_STATS_ERROR'
      );
    }
  }
}

/**
 * Validation rules for email endpoints
 */
export const emailValidation = {
  connectAccount: [
    body('provider')
      .notEmpty()
      .withMessage('Provider is required')
      .isIn(['microsoft'])
      .withMessage('Only microsoft provider is supported'),
    
    body('code')
      .notEmpty()
      .withMessage('Authorization code is required')
      .isString()
      .withMessage('Authorization code must be a string')
  ],

  getMessages: [
    query('folder')
      .optional()
      .isString()
      .withMessage('Folder must be a string'),
    
    query('top')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Top must be between 1 and 1000'),
    
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip must be a non-negative integer'),
    
    query('filter')
      .optional()
      .isString()
      .withMessage('Filter must be a string')
  ],

  getMessage: [
    param('id')
      .notEmpty()
      .withMessage('Message ID is required')
      .isString()
      .withMessage('Message ID must be a string')
  ],

  searchMessages: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .withMessage('Search query must be a string')
      .isLength({ min: 1, max: 500 })
      .withMessage('Search query must be between 1 and 500 characters'),
    
    query('top')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Top must be between 1 and 1000'),
    
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip must be a non-negative integer')
  ],

  updateReadStatus: [
    param('id')
      .notEmpty()
      .withMessage('Message ID is required')
      .isString()
      .withMessage('Message ID must be a string'),
    
    body('isRead')
      .notEmpty()
      .withMessage('isRead status is required')
      .isBoolean()
      .withMessage('isRead must be a boolean')
  ]
};