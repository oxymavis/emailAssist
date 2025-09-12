import { Request, Response } from 'express';
import { AuthRequest, EmailSearchQuery } from '../types';
import { EmailServiceFactory } from '../services/email/EmailServiceFactory';
import { DatabaseService } from '../services/database/DatabaseService';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { validationResult } from 'express-validator';

/**
 * 邮件消息控制器
 * 处理邮件的获取、发送、搜索和管理
 */
export class EmailMessagesController {
  private emailServiceFactory: EmailServiceFactory;
  private databaseService: DatabaseService;

  constructor() {
    this.emailServiceFactory = EmailServiceFactory.getInstance();
    this.databaseService = DatabaseService.getInstance();
  }

  /**
   * 获取邮件列表
   */
  public getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId } = req.params;
      const {
        folder,
        limit = 50,
        offset = 0,
        orderBy = 'date',
        orderDirection = 'desc',
        query,
        from,
        to,
        subject,
        hasAttachment,
        isRead,
        importance,
        startDate,
        endDate,
        labels
      } = req.query;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId as string);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      // 构建搜索查询
      const searchQuery: EmailSearchQuery = {
        folder: folder as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        orderBy: orderBy as 'date' | 'subject' | 'from' | 'importance',
        orderDirection: orderDirection as 'asc' | 'desc',
        query: query as string,
        from: from as string,
        to: to as string,
        subject: subject as string,
        hasAttachment: hasAttachment ? hasAttachment === 'true' : undefined,
        isRead: isRead ? isRead === 'true' : undefined,
        importance: importance as 'low' | 'normal' | 'high',
        dateRange: startDate && endDate ? {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        } : undefined,
        labels: labels ? (labels as string).split(',') : undefined
      };

      // 先尝试从数据库获取缓存的邮件
      const cachedMessages = await this.databaseService.getEmailMessages(
        account.id,
        searchQuery
      );

      // 如果需要实时数据或缓存不足，从邮件服务获取
      let messages = cachedMessages;
      if (cachedMessages.length < searchQuery.limit!) {
        try {
          const emailService = await this.emailServiceFactory.createEmailService(
            account.provider,
            account.id,
            account.connectionConfig
          );

          const freshMessages = await emailService.getMessages(searchQuery);
          
          // 更新数据库缓存
          for (const message of freshMessages) {
            await this.databaseService.saveOrUpdateEmailMessage(message);
          }

          messages = freshMessages;
        } catch (error) {
          logger.warn(`Failed to fetch fresh messages from ${account.provider}:`, error);
          // 继续使用缓存的消息
        }
      }

      // 分页信息
      const total = await this.databaseService.getEmailMessageCount(account.id, searchQuery);
      const pagination = {
        page: Math.floor(searchQuery.offset! / searchQuery.limit!) + 1,
        limit: searchQuery.limit!,
        total,
        hasNext: searchQuery.offset! + searchQuery.limit! < total
      };

      res.json(createSuccessResponse(messages, { pagination }));
    } catch (error) {
      logger.error('Failed to get messages:', error);
      res.status(500).json(createErrorResponse('MESSAGES_FETCH_FAILED', 'Failed to fetch messages'));
    }
  };

  /**
   * 获取单条邮件详情
   */
  public getMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId, messageId } = req.params;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      // 先尝试从数据库获取
      let message = await this.databaseService.getEmailMessage(messageId);

      // 如果数据库中没有或需要最新数据，从邮件服务获取
      if (!message || req.query.refresh === 'true') {
        try {
          const emailService = await this.emailServiceFactory.createEmailService(
            account.provider,
            account.id,
            account.connectionConfig
          );

          message = await emailService.getMessage(messageId);
          
          // 更新数据库缓存
          await this.databaseService.saveOrUpdateEmailMessage(message);
        } catch (error) {
          logger.error(`Failed to fetch message ${messageId} from ${account.provider}:`, error);
          if (!message) {
            res.status(404).json(createErrorResponse('MESSAGE_NOT_FOUND', 'Email message not found'));
            return;
          }
        }
      }

      res.json(createSuccessResponse(message));
    } catch (error) {
      logger.error('Failed to get message:', error);
      res.status(500).json(createErrorResponse('MESSAGE_FETCH_FAILED', 'Failed to fetch message'));
    }
  };

  /**
   * 发送邮件
   */
  public sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId } = req.params;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const sendRequest = {
        to: req.body.to,
        cc: req.body.cc,
        bcc: req.body.bcc,
        subject: req.body.subject,
        body: {
          text: req.body.body?.text,
          html: req.body.body?.html
        },
        attachments: req.body.attachments,
        importance: req.body.importance,
        replyTo: req.body.replyTo,
        headers: req.body.headers
      };

      const result = await emailService.sendMessage(sendRequest);

      if (result.success) {
        // 记录发送日志
        await this.databaseService.logEmailAction(account.id, 'send', {
          recipients: sendRequest.to.length + (sendRequest.cc?.length || 0) + (sendRequest.bcc?.length || 0),
          subject: sendRequest.subject,
          hasAttachments: sendRequest.attachments && sendRequest.attachments.length > 0
        });

        res.json(createSuccessResponse({
          sent: true,
          messageId: result.data?.messageId,
          message: 'Email sent successfully'
        }));
      } else {
        res.status(400).json(createErrorResponse(
          result.error!.code,
          result.error!.message,
          result.error!.details
        ));
      }
    } catch (error) {
      logger.error('Failed to send message:', error);
      res.status(500).json(createErrorResponse('MESSAGE_SEND_FAILED', 'Failed to send message'));
    }
  };

  /**
   * 标记邮件为已读/未读
   */
  public markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId, messageId } = req.params;
      const { isRead } = req.body;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const result = await emailService.markAsRead(messageId, isRead);

      if (result.success) {
        // 更新本地缓存
        await this.databaseService.updateEmailMessage(messageId, { isRead });

        res.json(createSuccessResponse({
          updated: true,
          messageId,
          isRead,
          message: `Message marked as ${isRead ? 'read' : 'unread'}`
        }));
      } else {
        res.status(400).json(createErrorResponse(
          result.error!.code,
          result.error!.message,
          result.error!.details
        ));
      }
    } catch (error) {
      logger.error('Failed to mark message as read:', error);
      res.status(500).json(createErrorResponse('MARK_READ_FAILED', 'Failed to mark message as read'));
    }
  };

  /**
   * 删除邮件
   */
  public deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId, messageId } = req.params;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const result = await emailService.deleteMessage(messageId);

      if (result.success) {
        // 在本地数据库中标记为已删除
        await this.databaseService.markEmailMessageDeleted(messageId);

        res.json(createSuccessResponse({
          deleted: true,
          messageId,
          message: 'Message deleted successfully'
        }));
      } else {
        res.status(400).json(createErrorResponse(
          result.error!.code,
          result.error!.message,
          result.error!.details
        ));
      }
    } catch (error) {
      logger.error('Failed to delete message:', error);
      res.status(500).json(createErrorResponse('MESSAGE_DELETE_FAILED', 'Failed to delete message'));
    }
  };

  /**
   * 移动邮件到指定文件夹
   */
  public moveMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId, messageId } = req.params;
      const { folderId } = req.body;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const result = await emailService.moveMessage(messageId, folderId);

      if (result.success) {
        // 更新本地缓存中的文件夹信息
        await this.databaseService.updateEmailMessage(messageId, { 
          folders: [folderId]
        });

        res.json(createSuccessResponse({
          moved: true,
          messageId,
          folderId,
          message: 'Message moved successfully'
        }));
      } else {
        res.status(400).json(createErrorResponse(
          result.error!.code,
          result.error!.message,
          result.error!.details
        ));
      }
    } catch (error) {
      logger.error('Failed to move message:', error);
      res.status(500).json(createErrorResponse('MESSAGE_MOVE_FAILED', 'Failed to move message'));
    }
  };

  /**
   * 批量操作邮件
   */
  public batchOperation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId } = req.params;
      const { operation, messageIds, ...operationParams } = req.body;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const messageId of messageIds) {
        try {
          let result;
          
          switch (operation) {
            case 'markAsRead':
              result = await emailService.markAsRead(messageId, operationParams.isRead);
              if (result.success) {
                await this.databaseService.updateEmailMessage(messageId, { 
                  isRead: operationParams.isRead 
                });
              }
              break;
              
            case 'delete':
              result = await emailService.deleteMessage(messageId);
              if (result.success) {
                await this.databaseService.markEmailMessageDeleted(messageId);
              }
              break;
              
            case 'move':
              result = await emailService.moveMessage(messageId, operationParams.folderId);
              if (result.success) {
                await this.databaseService.updateEmailMessage(messageId, { 
                  folders: [operationParams.folderId] 
                });
              }
              break;
              
            default:
              throw new Error(`Unsupported batch operation: ${operation}`);
          }

          if (result.success) {
            successCount++;
            results.push({
              messageId,
              success: true
            });
          } else {
            errorCount++;
            results.push({
              messageId,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          errorCount++;
          results.push({
            messageId,
            success: false,
            error: {
              code: 'OPERATION_FAILED',
              message: error.message
            }
          });
        }
      }

      res.json(createSuccessResponse({
        operation,
        totalCount: messageIds.length,
        successCount,
        errorCount,
        results
      }));
    } catch (error) {
      logger.error('Failed to perform batch operation:', error);
      res.status(500).json(createErrorResponse('BATCH_OPERATION_FAILED', 'Failed to perform batch operation'));
    }
  };

  /**
   * 搜索邮件
   */
  public searchMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId } = req.params;
      const { query, ...searchParams } = req.body;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      // 构建搜索查询
      const searchQuery: EmailSearchQuery = {
        query,
        ...searchParams,
        limit: searchParams.limit || 50,
        offset: searchParams.offset || 0
      };

      // 首先在本地数据库中搜索
      const localResults = await this.databaseService.searchEmailMessages(account.id, searchQuery);

      // 如果需要更全面的搜索，从邮件服务搜索
      let remoteResults = [];
      if (searchQuery.query || localResults.length === 0) {
        try {
          const emailService = await this.emailServiceFactory.createEmailService(
            account.provider,
            account.id,
            account.connectionConfig
          );

          remoteResults = await emailService.getMessages(searchQuery);
          
          // 更新本地缓存
          for (const message of remoteResults) {
            await this.databaseService.saveOrUpdateEmailMessage(message);
          }
        } catch (error) {
          logger.warn(`Failed to search messages remotely from ${account.provider}:`, error);
        }
      }

      // 合并和去重结果
      const allResults = [...localResults, ...remoteResults];
      const uniqueResults = allResults.filter((message, index, self) => 
        index === self.findIndex(m => m.id === message.id)
      );

      // 应用排序和分页
      const sortedResults = uniqueResults.sort((a, b) => {
        switch (searchQuery.orderBy) {
          case 'date':
            const aTime = a.receivedAt.getTime();
            const bTime = b.receivedAt.getTime();
            return searchQuery.orderDirection === 'asc' ? aTime - bTime : bTime - aTime;
          case 'subject':
            return searchQuery.orderDirection === 'asc' 
              ? a.subject.localeCompare(b.subject)
              : b.subject.localeCompare(a.subject);
          default:
            return 0;
        }
      });

      const paginatedResults = sortedResults.slice(
        searchQuery.offset,
        searchQuery.offset! + searchQuery.limit!
      );

      res.json(createSuccessResponse(paginatedResults, {
        searchQuery,
        totalFound: uniqueResults.length,
        pagination: {
          page: Math.floor(searchQuery.offset! / searchQuery.limit!) + 1,
          limit: searchQuery.limit!,
          total: uniqueResults.length,
          hasNext: searchQuery.offset! + searchQuery.limit! < uniqueResults.length
        }
      }));
    } catch (error) {
      logger.error('Failed to search messages:', error);
      res.status(500).json(createErrorResponse('SEARCH_FAILED', 'Failed to search messages'));
    }
  };

  /**
   * 获取文件夹列表
   */
  public getFolders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const { accountId } = req.params;

      // 验证账户权限
      const account = await this.databaseService.getEmailAccount(accountId);
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const emailService = await this.emailServiceFactory.createEmailService(
        account.provider,
        account.id,
        account.connectionConfig
      );

      const folders = await emailService.getFolders();

      // 更新账户的文件夹结构
      const folderStructure = {
        ...account.folderStructure,
        custom: folders
          .filter(folder => folder.type === 'custom')
          .map(folder => folder.id)
      };

      await this.databaseService.updateEmailAccount(accountId, { folderStructure });

      res.json(createSuccessResponse(folders));
    } catch (error) {
      logger.error('Failed to get folders:', error);
      res.status(500).json(createErrorResponse('FOLDERS_FETCH_FAILED', 'Failed to fetch folders'));
    }
  };
}