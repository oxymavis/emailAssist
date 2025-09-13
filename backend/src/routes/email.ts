import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { requireMicrosoftAuth, createMicrosoftGraphClient } from '@/middleware/microsoftAuth';
import { ResponseHandler } from '@/utils/response';
import logger from '@/utils/logger';
import { MicrosoftEmailService } from '@/services/email/providers/MicrosoftEmailService';
import { EmailServiceFactory } from '@/services/email/EmailServiceFactory';

const router = Router();

// 基础的邮件路由用于测试
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Email routes are working!',
    timestamp: new Date().toISOString()
  });
});

// 获取邮件账户列表
router.get('/accounts', authenticate, async (req, res) => {
  try {
    // Check if user has Microsoft connection
    const tokens = await import('@/models/MicrosoftAuthToken').then(m => m.MicrosoftAuthToken.findByUserId(req.user!.id));
    
    const accounts = [];
    
    if (tokens) {
      accounts.push({
        id: tokens.id,
        provider: 'microsoft',
        email: tokens.email,
        connected: true,
        lastSync: tokens.updatedAt,
        status: 'active'
      });
    }
    
    ResponseHandler.success(res, {
      accounts,
      count: accounts.length
    });
  } catch (error) {
    logger.error('Failed to get email accounts', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });
    
    ResponseHandler.error(res, 'Failed to retrieve email accounts', 500);
  }
});

// 获取邮件列表
router.get('/messages', authenticate, requireMicrosoftAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, folder = 'inbox', isRead } = req.query;
    
    // Create Microsoft Graph client
    const graphClient = createMicrosoftGraphClient(req.microsoftAuth!.accessToken);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('$top', String(Math.min(Number(limit), 100))); // Microsoft Graph限制为100
    queryParams.set('$skip', String((Number(page) - 1) * Number(limit)));
    queryParams.set('$orderby', 'receivedDateTime desc');
    queryParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance,isDraft');
    
    // Add read/unread filter if specified
    if (isRead !== undefined) {
      queryParams.set('$filter', `isRead eq ${isRead === 'true'}`);
    }
    
    // Get messages from Microsoft Graph
    const endpoint = folder === 'inbox' ? '/me/messages' : `/me/mailFolders/${folder}/messages`;
    const response = await graphClient.get(`${endpoint}?${queryParams.toString()}`);
    
    const messages = response.data.value.map((message: any) => ({
      id: message.id,
      subject: message.subject || '(No Subject)',
      from: {
        name: message.from?.emailAddress?.name || '',
        address: message.from?.emailAddress?.address || ''
      },
      receivedAt: message.receivedDateTime,
      preview: message.bodyPreview?.substring(0, 150) + (message.bodyPreview?.length > 150 ? '...' : ''),
      isRead: message.isRead,
      hasAttachments: message.hasAttachments,
      importance: message.importance,
      isDraft: message.isDraft
    }));
    
    ResponseHandler.success(res, {
      messages,
      total: messages.length, // Microsoft Graph doesn't provide total count in basic query
      page: Number(page),
      limit: Number(limit),
      folder,
      userEmail: req.microsoftAuth!.email
    });
  } catch (error) {
    logger.error('Failed to get messages', {
      userId: req.user?.id,
      email: req.microsoftAuth?.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });
    
    ResponseHandler.error(res, 'Failed to retrieve messages', 500);
  }
});

// 获取未读邮件列表 - 新增的主要功能
router.get('/unread', authenticate, requireMicrosoftAuth, async (req, res) => {
  try {
    const { limit = 50, folder = 'inbox' } = req.query;
    
    logger.info('Fetching unread emails', {
      userId: req.user?.id,
      email: req.microsoftAuth?.email,
      limit,
      folder
    });
    
    // Create Microsoft Graph client
    const graphClient = createMicrosoftGraphClient(req.microsoftAuth!.accessToken);
    
    // Build query for unread emails only
    const queryParams = new URLSearchParams();
    queryParams.set('$filter', 'isRead eq false');
    queryParams.set('$top', String(Math.min(Number(limit), 100)));
    queryParams.set('$orderby', 'receivedDateTime desc');
    queryParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance,conversationId,webLink');
    
    // Get unread messages from Microsoft Graph
    const endpoint = folder === 'inbox' ? '/me/messages' : `/me/mailFolders/${folder}/messages`;
    const response = await graphClient.get(`${endpoint}?${queryParams.toString()}`);
    
    const unreadEmails = response.data.value.map((message: any) => ({
      id: message.id,
      subject: message.subject || '(No Subject)',
      from: {
        name: message.from?.emailAddress?.name || 'Unknown Sender',
        address: message.from?.emailAddress?.address || 'unknown@email.com'
      },
      receivedAt: message.receivedDateTime,
      preview: message.bodyPreview?.substring(0, 200) + (message.bodyPreview?.length > 200 ? '...' : ''),
      isRead: message.isRead,
      hasAttachments: message.hasAttachments,
      importance: message.importance,
      conversationId: message.conversationId,
      webLink: message.webLink // Link to open in Outlook
    }));
    
    logger.info('Unread emails retrieved successfully', {
      userId: req.user?.id,
      email: req.microsoftAuth?.email,
      count: unreadEmails.length
    });
    
    ResponseHandler.success(res, {
      unreadEmails,
      count: unreadEmails.length,
      folder,
      userEmail: req.microsoftAuth!.email,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get unread emails', {
      userId: req.user?.id,
      email: req.microsoftAuth?.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestId: req.requestId
    });
    
    if (error instanceof Error && error.message.includes('401')) {
      ResponseHandler.authError(res, 'Microsoft authentication expired. Please reconnect your account.');
    } else {
      ResponseHandler.error(res, 'Failed to retrieve unread emails', 500);
    }
  }
});

// 获取单条邮件详情
router.get('/messages/:messageId', authenticate, requireMicrosoftAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Create Microsoft Graph client
    const graphClient = createMicrosoftGraphClient(req.microsoftAuth!.accessToken);
    
    // Get full message details
    const response = await graphClient.get(`/me/messages/${messageId}`);
    const message = response.data;
    
    const messageDetails = {
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
    
    ResponseHandler.success(res, messageDetails);
  } catch (error) {
    logger.error('Failed to get message details', {
      userId: req.user?.id,
      messageId: req.params.messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });
    
    ResponseHandler.error(res, 'Failed to retrieve message details', 500);
  }
});

// 标记邮件为已读/未读
router.patch('/messages/:messageId/read', authenticate, requireMicrosoftAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { isRead = true } = req.body;
    
    // Create Microsoft Graph client
    const graphClient = createMicrosoftGraphClient(req.microsoftAuth!.accessToken);
    
    // Update message read status
    await graphClient.patch(`/me/messages/${messageId}`, {
      isRead: Boolean(isRead)
    });
    
    logger.info('Message read status updated', {
      userId: req.user?.id,
      messageId,
      isRead: Boolean(isRead)
    });
    
    ResponseHandler.success(res, {
      messageId,
      isRead: Boolean(isRead),
      updated: true
    });
  } catch (error) {
    logger.error('Failed to update message read status', {
      userId: req.user?.id,
      messageId: req.params.messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });
    
    ResponseHandler.error(res, 'Failed to update message read status', 500);
  }
});

export default router;