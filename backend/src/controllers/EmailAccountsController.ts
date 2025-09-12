import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EmailServiceFactory } from '../services/email/EmailServiceFactory';
import { OAuthService } from '../services/auth/OAuthService';
import { EmailSyncService } from '../services/email/EmailSyncService';
import { DatabaseService } from '../services/database/DatabaseService';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { validationResult } from 'express-validator';

/**
 * 邮件账户控制器
 * 处理邮件账户的连接、管理和同步
 */
export class EmailAccountsController {
  private emailServiceFactory: EmailServiceFactory;
  private oauthService: OAuthService;
  private syncService: EmailSyncService;
  private databaseService: DatabaseService;

  constructor() {
    this.emailServiceFactory = EmailServiceFactory.getInstance();
    this.oauthService = OAuthService.getInstance();
    this.syncService = EmailSyncService.getInstance();
    this.databaseService = DatabaseService.getInstance();
  }

  /**
   * 获取支持的邮件提供商列表
   */
  public getProviders = async (req: Request, res: Response): Promise<void> => {
    try {
      const providers = this.emailServiceFactory.getSupportedProviders();
      const oauthProviders = this.oauthService.getSupportedProviders();

      const providersWithAuth = providers.map(provider => ({
        ...provider,
        oauth: oauthProviders.find(oauth => oauth.provider === provider.provider)
      }));

      res.json(createSuccessResponse(providersWithAuth));
    } catch (error) {
      logger.error('Failed to get providers:', error);
      res.status(500).json(createErrorResponse('PROVIDERS_FETCH_FAILED', 'Failed to fetch providers'));
    }
  };

  /**
   * 获取用户的邮件账户列表
   */
  public getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const accounts = await this.databaseService.getUserEmailAccounts(req.user.id);
      
      res.json(createSuccessResponse(accounts));
    } catch (error) {
      logger.error('Failed to get email accounts:', error);
      res.status(500).json(createErrorResponse('ACCOUNTS_FETCH_FAILED', 'Failed to fetch email accounts'));
    }
  };

  /**
   * 获取单个邮件账户详情
   */
  public getAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      // 获取同步状态
      const syncStatus = this.syncService.getAccountSyncStatus(accountId);
      
      const response = {
        ...account,
        syncOperations: syncStatus
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      logger.error('Failed to get email account:', error);
      res.status(500).json(createErrorResponse('ACCOUNT_FETCH_FAILED', 'Failed to fetch email account'));
    }
  };

  /**
   * 开始OAuth授权流程
   */
  public startOAuth = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      const { provider } = req.body;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const result = this.oauthService.generateAuthUrl(provider, req.user.id);
      
      if (!result.success) {
        res.status(400).json(createErrorResponse(result.error!.code, result.error!.message));
        return;
      }

      res.json(createSuccessResponse(result.data));
    } catch (error) {
      logger.error('Failed to start OAuth:', error);
      res.status(500).json(createErrorResponse('OAUTH_START_FAILED', 'Failed to start OAuth authorization'));
    }
  };

  /**
   * 处理OAuth回调
   */
  public handleOAuthCallback = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid callback parameters', errors.array()));
        return;
      }

      const { provider, code, state } = req.body;

      const result = await this.oauthService.handleCallback(provider, code, state);
      
      if (!result.success) {
        res.status(400).json(createErrorResponse(result.error!.code, result.error!.message));
        return;
      }

      const { tokens, userInfo } = result.data!;

      // 创建邮件账户记录
      const accountData = {
        userId: userInfo.id, // 这里应该是当前用户ID，需要从state中获取
        provider,
        email: userInfo.email,
        displayName: userInfo.name,
        isConnected: true,
        connectionConfig: {
          oauth: tokens
        },
        folderStructure: {
          inbox: 'inbox',
          sent: 'sent',
          drafts: 'drafts',
          trash: 'trash',
          custom: []
        },
        syncSettings: {
          autoSync: true,
          syncInterval: 15, // 15分钟
          syncScope: 'recent',
          syncFolders: ['inbox'],
          enableRealtime: true
        }
      };

      const account = await this.databaseService.createEmailAccount(accountData);

      // 设置实时同步
      try {
        await this.syncService.setupRealtimeSync(account);
      } catch (error) {
        logger.warn('Failed to setup realtime sync:', error);
      }

      // 开始初始同步
      try {
        const syncOperationId = await this.syncService.startAccountSync(account, {
          syncType: 'full',
          priority: 'normal'
        });
        
        logger.info(`Started initial sync for account ${account.id}`, { syncOperationId });
      } catch (error) {
        logger.warn('Failed to start initial sync:', error);
      }

      res.json(createSuccessResponse(account));
    } catch (error) {
      logger.error('Failed to handle OAuth callback:', error);
      res.status(500).json(createErrorResponse('OAUTH_CALLBACK_FAILED', 'Failed to handle OAuth callback'));
    }
  };

  /**
   * 连接IMAP/SMTP账户
   */
  public connectImapAccount = async (req: AuthRequest, res: Response): Promise<void> => {
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

      const { email, displayName, imapConfig, smtpConfig } = req.body;

      // 测试连接
      try {
        const emailService = await this.emailServiceFactory.createEmailService('imap', 'test', {
          imap: imapConfig,
          smtp: smtpConfig,
          accountId: 'test'
        });
        
        await emailService.disconnect();
      } catch (error) {
        res.status(400).json(createErrorResponse('CONNECTION_TEST_FAILED', 'Failed to connect to IMAP/SMTP server'));
        return;
      }

      // 创建账户记录
      const accountData = {
        userId: req.user.id,
        provider: 'imap' as const,
        email,
        displayName,
        isConnected: true,
        connectionConfig: {
          imap: imapConfig,
          smtp: smtpConfig
        },
        folderStructure: {
          inbox: 'INBOX',
          sent: 'Sent',
          drafts: 'Drafts',
          trash: 'Trash',
          custom: []
        },
        syncSettings: {
          autoSync: true,
          syncInterval: 30, // IMAP频率稍低
          syncScope: 'recent',
          syncFolders: ['INBOX'],
          enableRealtime: false // IMAP不支持实时通知
        }
      };

      const account = await this.databaseService.createEmailAccount(accountData);

      // 开始初始同步
      try {
        const syncOperationId = await this.syncService.startAccountSync(account, {
          syncType: 'full',
          priority: 'normal'
        });
        
        logger.info(`Started initial sync for IMAP account ${account.id}`, { syncOperationId });
      } catch (error) {
        logger.warn('Failed to start initial sync for IMAP account:', error);
      }

      res.json(createSuccessResponse(account));
    } catch (error) {
      logger.error('Failed to connect IMAP account:', error);
      res.status(500).json(createErrorResponse('IMAP_CONNECTION_FAILED', 'Failed to connect IMAP account'));
    }
  };

  /**
   * 连接Exchange账户
   */
  public connectExchangeAccount = async (req: AuthRequest, res: Response): Promise<void> => {
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

      const { email, displayName, serverUrl, username, password, domain } = req.body;

      // 测试连接
      try {
        const emailService = await this.emailServiceFactory.createEmailService('exchange', 'test', {
          serverUrl,
          username,
          password,
          domain,
          accountId: 'test'
        });
        
        await emailService.disconnect();
      } catch (error) {
        res.status(400).json(createErrorResponse('CONNECTION_TEST_FAILED', 'Failed to connect to Exchange server'));
        return;
      }

      // 创建账户记录
      const accountData = {
        userId: req.user.id,
        provider: 'exchange' as const,
        email,
        displayName,
        isConnected: true,
        connectionConfig: {
          exchange: {
            serverUrl,
            username,
            password,
            domain
          }
        },
        folderStructure: {
          inbox: 'inbox',
          sent: 'sentitems',
          drafts: 'drafts',
          trash: 'deleteditems',
          custom: []
        },
        syncSettings: {
          autoSync: true,
          syncInterval: 15,
          syncScope: 'recent',
          syncFolders: ['inbox'],
          enableRealtime: false
        }
      };

      const account = await this.databaseService.createEmailAccount(accountData);

      // 开始初始同步
      try {
        const syncOperationId = await this.syncService.startAccountSync(account, {
          syncType: 'full',
          priority: 'normal'
        });
        
        logger.info(`Started initial sync for Exchange account ${account.id}`, { syncOperationId });
      } catch (error) {
        logger.warn('Failed to start initial sync for Exchange account:', error);
      }

      res.json(createSuccessResponse(account));
    } catch (error) {
      logger.error('Failed to connect Exchange account:', error);
      res.status(500).json(createErrorResponse('EXCHANGE_CONNECTION_FAILED', 'Failed to connect Exchange account'));
    }
  };

  /**
   * 更新账户设置
   */
  public updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      const { accountId } = req.params;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const updateData = req.body;
      const updatedAccount = await this.databaseService.updateEmailAccount(accountId, updateData);

      // 如果修改了实时同步设置，更新Webhook订阅
      if (updateData.syncSettings?.enableRealtime !== undefined) {
        if (updateData.syncSettings.enableRealtime) {
          await this.syncService.setupRealtimeSync(updatedAccount);
        } else {
          await this.syncService.removeRealtimeSync(accountId);
        }
      }

      res.json(createSuccessResponse(updatedAccount));
    } catch (error) {
      logger.error('Failed to update email account:', error);
      res.status(500).json(createErrorResponse('ACCOUNT_UPDATE_FAILED', 'Failed to update email account'));
    }
  };

  /**
   * 删除账户
   */
  public deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      // 停止所有同步操作
      const activeSyncOperations = this.syncService.getAccountSyncStatus(accountId);
      for (const operation of activeSyncOperations) {
        await this.syncService.stopAccountSync(operation.id);
      }

      // 移除实时同步
      await this.syncService.removeRealtimeSync(accountId);

      // 撤销OAuth令牌（如果适用）
      if (account.connectionConfig.oauth) {
        try {
          await this.oauthService.revokeToken(account.provider, account.connectionConfig.oauth.accessToken);
        } catch (error) {
          logger.warn('Failed to revoke OAuth token:', error);
        }
      }

      // 删除账户记录
      await this.databaseService.deleteEmailAccount(accountId);

      res.json(createSuccessResponse({ deleted: true }));
    } catch (error) {
      logger.error('Failed to delete email account:', error);
      res.status(500).json(createErrorResponse('ACCOUNT_DELETE_FAILED', 'Failed to delete email account'));
    }
  };

  /**
   * 手动触发账户同步
   */
  public triggerSync = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request parameters', errors.array()));
        return;
      }

      const { accountId } = req.params;
      const { syncType = 'incremental', priority = 'normal' } = req.body;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const operationId = await this.syncService.startAccountSync(account, {
        syncType,
        priority
      });

      res.json(createSuccessResponse({ 
        operationId,
        message: 'Sync operation started successfully'
      }));
    } catch (error) {
      logger.error('Failed to trigger sync:', error);
      res.status(500).json(createErrorResponse('SYNC_TRIGGER_FAILED', 'Failed to trigger sync'));
    }
  };

  /**
   * 获取同步状态
   */
  public getSyncStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      const syncOperations = this.syncService.getAccountSyncStatus(accountId);
      const syncStats = this.syncService.getSyncStats();

      res.json(createSuccessResponse({
        account: {
          lastSyncAt: account.lastSyncAt,
          syncStatus: account.syncStatus,
          errorMessage: account.errorMessage
        },
        operations: syncOperations,
        globalStats: syncStats
      }));
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      res.status(500).json(createErrorResponse('SYNC_STATUS_FAILED', 'Failed to get sync status'));
    }
  };

  /**
   * 停止同步操作
   */
  public stopSync = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;
      const { operationId } = req.body;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      await this.syncService.stopAccountSync(operationId);

      res.json(createSuccessResponse({ 
        message: 'Sync operation stopped successfully'
      }));
    } catch (error) {
      logger.error('Failed to stop sync:', error);
      res.status(500).json(createErrorResponse('SYNC_STOP_FAILED', 'Failed to stop sync'));
    }
  };

  /**
   * 测试账户连接
   */
  public testConnection = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;
      
      if (!req.user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const account = await this.databaseService.getEmailAccount(accountId);
      
      if (!account || account.userId !== req.user.id) {
        res.status(404).json(createErrorResponse('ACCOUNT_NOT_FOUND', 'Email account not found'));
        return;
      }

      try {
        const emailService = await this.emailServiceFactory.createEmailService(
          account.provider,
          account.id,
          account.connectionConfig
        );
        
        const isConnected = await emailService.isConnected();
        
        if (isConnected) {
          const userInfo = await emailService.getUserInfo();
          res.json(createSuccessResponse({
            connected: true,
            userInfo
          }));
        } else {
          res.json(createSuccessResponse({
            connected: false,
            message: 'Connection test failed'
          }));
        }
      } catch (error) {
        res.json(createSuccessResponse({
          connected: false,
          error: error.message
        }));
      }
    } catch (error) {
      logger.error('Failed to test connection:', error);
      res.status(500).json(createErrorResponse('CONNECTION_TEST_FAILED', 'Failed to test connection'));
    }
  };
}