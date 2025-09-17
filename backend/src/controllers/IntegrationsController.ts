import { Request, Response } from 'express';
import Integration from '../models/Integration';
import WorkflowTask from '../models/WorkflowTask';
import { TrelloIntegrationService } from '../services/integrations/TrelloIntegration';
import { JiraIntegrationService } from '../services/integrations/JiraIntegration';
import { AsanaIntegrationService } from '../services/integrations/AsanaIntegration';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Integrations Controller
 * 第三方工具集成控制器
 *
 * 处理与第三方工具（Asana、Jira、Trello）的集成管理
 * - 连接/断开集成
 * - 测试连接
 * - 获取集成配置
 * - 更新集成设置
 */

export class IntegrationsController {
  /**
   * Get all integrations for current user
   * GET /api/integrations
   */
  static async getIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const integrations = await Integration.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });

      const integrationsData = integrations.map(integration => integration.getDisplayConfig());

      res.json(successResponse({
        integrations: integrationsData,
        total: integrations.length
      }));

    } catch (error) {
      logger.error('Failed to fetch integrations:', error);
      res.status(500).json(errorResponse('Failed to fetch integrations'));
    }
  }

  /**
   * Get single integration details
   * GET /api/integrations/:id
   */
  static async getIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const integration = await Integration.findOne({
        where: { id, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      // Get recent tasks for this integration
      const recentTasks = await WorkflowTask.findAll({
        where: { integrationId: id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      const integrationData = {
        ...integration.getDisplayConfig(),
        recentTasks: recentTasks.map(task => task.getSummary())
      };

      res.json(successResponse(integrationData));

    } catch (error) {
      logger.error('Failed to fetch integration:', error);
      res.status(500).json(errorResponse('Failed to fetch integration'));
    }
  }

  /**
   * Connect to third-party service
   * POST /api/integrations/connect
   */
  static async connectIntegration(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const { type, name, credentials, configuration } = req.body;

      // Validate required fields
      if (!type || !name || !credentials) {
        res.status(400).json(errorResponse('Missing required fields: type, name, credentials'));
        return;
      }

      // Check if integration already exists for this user and type
      const existingIntegration = await Integration.findOne({
        where: { userId, type }
      });

      if (existingIntegration) {
        res.status(409).json(errorResponse(`${type} integration already exists for this user`));
        return;
      }

      // Create new integration
      const integration = await Integration.create({
        userId,
        type,
        name,
        credentials,
        configuration: configuration || {},
        isConnected: false,
        status: 'active'
      });

      // Test connection
      const testResult = await IntegrationsController.testIntegrationConnection(integration);

      if (testResult.success) {
        integration.isConnected = true;
        await integration.save();
        logger.info(`Successfully connected ${type} integration for user ${userId}`);
      } else {
        await integration.markError(testResult.error || 'Connection test failed');
        logger.warn(`Failed to connect ${type} integration for user ${userId}: ${testResult.error}`);
      }

      res.status(201).json(successResponse({
        integration: integration.getDisplayConfig(),
        connectionTest: testResult
      }));

    } catch (error) {
      logger.error('Failed to connect integration:', error);
      res.status(500).json(errorResponse('Failed to connect integration'));
    }
  }

  /**
   * Update integration configuration
   * PUT /api/integrations/:id
   */
  static async updateIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { name, credentials, configuration } = req.body;

      const integration = await Integration.findOne({
        where: { id, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      // Update fields
      if (name) integration.name = name;
      if (credentials) integration.credentials = { ...integration.credentials, ...credentials };
      if (configuration) integration.configuration = { ...integration.configuration, ...configuration };

      await integration.save();

      // Re-test connection if credentials were updated
      if (credentials) {
        const testResult = await IntegrationsController.testIntegrationConnection(integration);
        if (testResult.success) {
          integration.isConnected = true;
          await integration.clearError();
        } else {
          await integration.markError(testResult.error || 'Connection test failed');
        }
      }

      res.json(successResponse({
        integration: integration.getDisplayConfig(),
        message: 'Integration updated successfully'
      }));

    } catch (error) {
      logger.error('Failed to update integration:', error);
      res.status(500).json(errorResponse('Failed to update integration'));
    }
  }

  /**
   * Delete integration
   * DELETE /api/integrations/:id
   */
  static async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const integration = await Integration.findOne({
        where: { id, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      // Check for active tasks
      const activeTasks = await WorkflowTask.count({
        where: {
          integrationId: id,
          status: ['created', 'in_progress']
        }
      });

      if (activeTasks > 0) {
        res.status(409).json(errorResponse(`Cannot delete integration with ${activeTasks} active tasks`));
        return;
      }

      await integration.destroy();
      logger.info(`Deleted integration ${id} for user ${userId}`);

      res.json(successResponse({
        message: 'Integration deleted successfully'
      }));

    } catch (error) {
      logger.error('Failed to delete integration:', error);
      res.status(500).json(errorResponse('Failed to delete integration'));
    }
  }

  /**
   * Test integration connection
   * POST /api/integrations/:id/test
   */
  static async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const integration = await Integration.findOne({
        where: { id, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      const testResult = await IntegrationsController.testIntegrationConnection(integration);

      if (testResult.success) {
        integration.isConnected = true;
        await integration.clearError();
      } else {
        await integration.markError(testResult.error || 'Connection test failed');
      }

      res.json(successResponse({
        success: testResult.success,
        error: testResult.error,
        message: testResult.success ? 'Connection successful' : 'Connection failed'
      }));

    } catch (error) {
      logger.error('Failed to test integration connection:', error);
      res.status(500).json(errorResponse('Failed to test connection'));
    }
  }

  /**
   * Get integration configuration schema
   * GET /api/integrations/schema/:type
   */
  static async getConfigurationSchema(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;

      let schema;
      switch (type) {
        case 'trello':
          schema = TrelloIntegrationService.getConfigurationSchema();
          break;
        case 'jira':
          schema = JiraIntegrationService.getConfigurationSchema();
          break;
        case 'asana':
          schema = AsanaIntegrationService.getConfigurationSchema();
          break;
        default:
          res.status(400).json(errorResponse('Unsupported integration type'));
          return;
      }

      res.json(successResponse({
        type,
        schema,
        supportedTypes: ['trello', 'jira', 'asana']
      }));

    } catch (error) {
      logger.error('Failed to get configuration schema:', error);
      res.status(500).json(errorResponse('Failed to get configuration schema'));
    }
  }

  /**
   * Sync integration (manual sync trigger)
   * POST /api/integrations/:id/sync
   */
  static async syncIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const integration = await Integration.findOne({
        where: { id, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      if (!integration.isReady()) {
        res.status(400).json(errorResponse('Integration is not ready for sync'));
        return;
      }

      let syncResult;
      try {
        switch (integration.type) {
          case 'trello':
            const trelloService = new TrelloIntegrationService(integration);
            syncResult = await trelloService.syncAllPendingTasks();
            break;
          case 'jira':
            const jiraService = new JiraIntegrationService(integration);
            syncResult = await jiraService.syncAllPendingTasks();
            break;
          case 'asana':
            const asanaService = new AsanaIntegrationService(integration);
            syncResult = await asanaService.syncAllPendingTasks();
            break;
          default:
            res.status(400).json(errorResponse('Unsupported integration type'));
            return;
        }

        res.json(successResponse({
          syncResult,
          message: `Sync completed: ${syncResult.success} successful, ${syncResult.failed} failed`
        }));

      } catch (syncError) {
        await integration.markError(`Sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`);
        res.status(500).json(errorResponse('Sync operation failed'));
      }

    } catch (error) {
      logger.error('Failed to sync integration:', error);
      res.status(500).json(errorResponse('Failed to sync integration'));
    }
  }

  /**
   * Helper method to test integration connection
   * 辅助方法：测试集成连接
   */
  private static async testIntegrationConnection(integration: Integration): Promise<{ success: boolean; error?: string }> {
    try {
      switch (integration.type) {
        case 'trello':
          const trelloService = new TrelloIntegrationService(integration);
          return await trelloService.testConnection();
        case 'jira':
          const jiraService = new JiraIntegrationService(integration);
          return await jiraService.testConnection();
        case 'asana':
          const asanaService = new AsanaIntegrationService(integration);
          return await asanaService.testConnection();
        default:
          return { success: false, error: 'Unsupported integration type' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default IntegrationsController;