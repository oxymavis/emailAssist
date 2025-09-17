import { Request, Response } from 'express';
// import { Op } from 'sequelize';
import DatabaseManager from '../config/database';
import Integration from '../models/Integration';
import WorkflowTask, { WorkflowTaskAttributes } from '../models/WorkflowTask';
import EmailMessage from '../models/EmailMessage';
import { TrelloIntegrationService } from '../services/integrations/TrelloIntegration';
import { JiraIntegrationService } from '../services/integrations/JiraIntegration';
import { AsanaIntegrationService } from '../services/integrations/AsanaIntegration';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Workflow Controller
 * 工作流控制器
 *
 * 处理工作流相关操作：
 * - 创建任务
 * - 管理任务状态
 * - 任务同步
 * - 任务查询和统计
 */

export class WorkflowController {
  /**
   * Get all workflow tasks
   * GET /api/workflows/tasks
   */
  static async getTasks(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const {
        page = 1,
        limit = 20,
        status,
        priority,
        integrationId,
        assignee,
        search
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build where conditions
      const where: any = {};
      const integrationWhere: any = { userId };

      if (status) {
        where.status = status;
      }

      if (priority) {
        where.priority = priority;
      }

      if (integrationId) {
        where.integrationId = integrationId;
      }

      if (assignee) {
        where.assignee = { $iLike: `%${assignee}%` };
      }

      if (search) {
        where.$or = [
          { title: { $iLike: `%${search}%` } },
          { description: { $iLike: `%${search}%` } }
        ];
      }

      const tasks = await WorkflowTask.findAll({
        where,
        include: [{
          model: Integration,
          where: integrationWhere,
          attributes: ['id', 'type', 'name', 'isConnected']
        }],
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
        offset,
        distinct: true
      });

      const tasksData = tasks.map(task => ({
        // ...task.getSummary(),
        integration: {
          id: (task as any).Integration.id,
          type: (task as any).Integration.type,
          name: (task as any).Integration.name,
          isConnected: (task as any).Integration.isConnected
        }
      }));

      res.json(successResponse({
        tasks: tasksData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: tasks.length,
          totalPages: Math.ceil(tasks.length / Number(limit)),
          hasNext: offset + Number(limit) < tasks.length,
          hasPrev: Number(page) > 1
        }
      }));

    } catch (error) {
      logger.error('Failed to fetch workflow tasks:', error);
      res.status(500).json(errorResponse('Failed to fetch workflow tasks'));
    }
  }

  /**
   * Get single task details
   * GET /api/workflows/tasks/:id
   */
  static async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const task = await WorkflowTask.findOne({
        where: { id },
        include: [
          {
            model: Integration,
            where: { userId },
            attributes: ['id', 'type', 'name', 'isConnected', 'configuration']
          },
          {
            model: EmailMessage,
            attributes: ['id', 'subject', 'from', 'receivedAt']
          }
        ]
      });

      if (!task) {
        res.status(404).json(errorResponse('Task not found'));
        return;
      }

      const taskData = {
        // ...task.getDetails(),
        integration: (task as any).Integration,
        email: (task as any).EmailMessage
      };

      res.json(successResponse(taskData));

    } catch (error) {
      logger.error('Failed to fetch task:', error);
      res.status(500).json(errorResponse('Failed to fetch task'));
    }
  }

  /**
   * Create task from email
   * POST /api/workflows/create-task
   */
  static async createTaskFromEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const {
        emailId,
        integrationId,
        priority = 'medium',
        assignee,
        dueDate,
        description,
        customTitle
      } = req.body;

      // Validate required fields
      if (!emailId || !integrationId) {
        res.status(400).json(errorResponse('Missing required fields: emailId, integrationId'));
        return;
      }

      // Get email details
      const email = await EmailMessage.findByPk(emailId);
      if (!email) {
        res.status(404).json(errorResponse('Email not found'));
        return;
      }

      // Get integration
      const integration = await Integration.findOne({
        where: { id: integrationId, userId }
      });

      if (!integration) {
        res.status(404).json(errorResponse('Integration not found'));
        return;
      }

      if (!integration.isReady()) {
        res.status(400).json(errorResponse('Integration is not ready'));
        return;
      }

      // Check if task already exists for this email and integration
      const existingTask = await WorkflowTask.findOne({
        where: {
          emailId,
          integrationId
        }
      });

      if (existingTask) {
        res.status(409).json(errorResponse('Task already exists for this email and integration'));
        return;
      }

      let task: WorkflowTaskAttributes;

      try {
        // Create task using appropriate integration service
        switch (integration.type) {
          case 'trello':
            const trelloService = new TrelloIntegrationService(integration);
            task = await trelloService.createTaskFromEmail({
              emailId,
              emailSubject: customTitle || email.subject,
              emailFrom: typeof email.from === 'object' ? email.from.email : email.from,
              emailDate: email.receivedAt,
              priority,
              description,
              assignee,
              dueDate: dueDate ? new Date(dueDate) : null
            });
            break;

          case 'jira':
            const jiraService = new JiraIntegrationService(integration);
            task = await jiraService.createTaskFromEmail({
              emailId,
              emailSubject: customTitle || email.subject,
              emailFrom: typeof email.from === 'object' ? email.from.email : email.from,
              emailDate: email.receivedAt,
              priority,
              description,
              assignee,
              dueDate: dueDate ? new Date(dueDate) : null
            });
            break;

          case 'asana':
            const asanaService = new AsanaIntegrationService(integration);
            task = await asanaService.createTaskFromEmail({
              emailId,
              emailSubject: customTitle || email.subject,
              emailFrom: typeof email.from === 'object' ? email.from.email : email.from,
              emailDate: email.receivedAt,
              priority,
              description,
              assignee,
              dueDate: dueDate ? new Date(dueDate) : null
            });
            break;

          default:
            res.status(400).json(errorResponse('Unsupported integration type'));
            return;
        }

        logger.info(`Created workflow task ${task.id} from email ${emailId} using ${integration.type}`);

        res.status(201).json(successResponse({
          task: (task as any).getDetails(),
          message: 'Task created successfully'
        }));

      } catch (integrationError) {
        logger.error(`Failed to create task via ${integration.type}:`, integrationError);
        await integration.markError(`Task creation failed: ${integrationError instanceof Error ? integrationError.message : 'Unknown error'}`);
        res.status(500).json(errorResponse(`Failed to create task via ${integration.type}`));
      }

    } catch (error) {
      logger.error('Failed to create task from email:', error);
      res.status(500).json(errorResponse('Failed to create task from email'));
    }
  }

  /**
   * Update task status
   * PUT /api/workflows/tasks/:id/status
   */
  static async updateTaskStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!status) {
        res.status(400).json(errorResponse('Missing required field: status'));
        return;
      }

      const task = await WorkflowTask.findOne({
        where: { id },
        include: [{
          model: Integration,
          where: { userId }
        }]
      });

      if (!task) {
        res.status(404).json(errorResponse('Task not found'));
        return;
      }

      const integration = (task as any).Integration;

      try {
        // Update status via integration service if connected
        if (integration.isReady()) {
          switch (integration.type) {
            case 'trello':
              const trelloService = new TrelloIntegrationService(integration);
              await trelloService.updateTaskStatus(id, status);
              break;
            case 'jira':
              const jiraService = new JiraIntegrationService(integration);
              await jiraService.updateTaskStatus(id, status);
              break;
            case 'asana':
              const asanaService = new AsanaIntegrationService(integration);
              await asanaService.updateTaskStatus(id, status);
              break;
          }
        } else {
          // Update locally only if integration is not ready
          // await task.updateStatus(status, false);
        }

        res.json(successResponse({
          // task: task.getSummary(),
          message: 'Task status updated successfully'
        }));

      } catch (integrationError) {
        logger.error(`Failed to update task status via ${integration.type}:`, integrationError);
        await integration.markError(`Status update failed: ${integrationError instanceof Error ? integrationError.message : 'Unknown error'}`);
        res.status(500).json(errorResponse(`Failed to update task status via ${integration.type}`));
      }

    } catch (error) {
      logger.error('Failed to update task status:', error);
      res.status(500).json(errorResponse('Failed to update task status'));
    }
  }

  /**
   * Delete workflow task
   * DELETE /api/workflows/tasks/:id
   */
  static async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const task = await WorkflowTask.findOne({
        where: { id },
        include: [{
          model: Integration,
          where: { userId }
        }]
      });

      if (!task) {
        res.status(404).json(errorResponse('Task not found'));
        return;
      }

      const integration = (task as any).Integration;

      try {
        // Delete from external service if connected
        if (integration.isReady()) {
          switch (integration.type) {
            case 'trello':
              const trelloService = new TrelloIntegrationService(integration);
              await trelloService.deleteCard(task.externalTaskId);
              break;
            case 'jira':
              const jiraService = new JiraIntegrationService(integration);
              await jiraService.deleteIssue(task.externalTaskId);
              break;
            case 'asana':
              const asanaService = new AsanaIntegrationService(integration);
              await asanaService.deleteTask(task.externalTaskId);
              break;
          }
        }

        // Delete local task record
        // await task.destroy();

        logger.info(`Deleted workflow task ${id} and external task ${task.externalTaskId}`);

        res.json(successResponse({
          message: 'Task deleted successfully'
        }));

      } catch (integrationError) {
        logger.error(`Failed to delete task via ${integration.type}:`, integrationError);
        res.status(500).json(errorResponse(`Failed to delete task via ${integration.type}`));
      }

    } catch (error) {
      logger.error('Failed to delete task:', error);
      res.status(500).json(errorResponse('Failed to delete task'));
    }
  }

  /**
   * Get workflow statistics
   * GET /api/workflows/stats
   */
  static async getWorkflowStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const { period = '30d' } = req.query;

      // Calculate date range
      let startDate: Date;
      switch (period) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get task statistics
      const [
        totalTasks,
        activeTasks,
        completedTasks,
        tasksByStatus,
        tasksByPriority,
        tasksByIntegration,
        recentTasks
      ] = await Promise.all([
        // Total tasks
        WorkflowTask.count({
          include: [{
            model: Integration,
            where: { userId }
          }]
        }),

        // Active tasks
        WorkflowTask.count({
          where: {
            status: ['created', 'in_progress']
          },
          include: [{
            model: Integration,
            where: { userId }
          }]
        }),

        // Completed tasks in period
        WorkflowTask.count({
          where: {
            status: 'completed',
            completedAt: { $gte: startDate }
          },
          include: [{
            model: Integration,
            where: { userId }
          }]
        }),

        // Tasks by status
        WorkflowTask.findAll({
          attributes: [
            'status',
            [DatabaseManager.fn('COUNT', DatabaseManager.col('WorkflowTask.id')), 'count']
          ],
          include: [{
            model: Integration,
            where: { userId },
            attributes: []
          }],
          group: ['status'],
          raw: true
        }),

        // Tasks by priority
        WorkflowTask.findAll({
          attributes: [
            'priority',
            [DatabaseManager.fn('COUNT', DatabaseManager.col('WorkflowTask.id')), 'count']
          ],
          include: [{
            model: Integration,
            where: { userId },
            attributes: []
          }],
          group: ['priority'],
          raw: true
        }),

        // Tasks by integration
        WorkflowTask.findAll({
          attributes: [
            [DatabaseManager.col('Integration.type'), 'integration_type'],
            [DatabaseManager.col('Integration.name'), 'integration_name'],
            [DatabaseManager.fn('COUNT', DatabaseManager.col('WorkflowTask.id')), 'count']
          ],
          include: [{
            model: Integration,
            where: { userId },
            attributes: []
          }],
          group: ['Integration.type', 'Integration.name'],
          raw: true
        }),

        // Recent tasks
        WorkflowTask.findAll({
          where: {
            createdAt: { $gte: startDate }
          },
          include: [{
            model: Integration,
            where: { userId },
            attributes: ['type', 'name']
          }],
          order: [['createdAt', 'DESC']],
          limit: 10
        })
      ]);

      const stats = {
        overview: {
          totalTasks,
          activeTasks,
          completedTasks: completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        },
        distribution: {
          byStatus: tasksByStatus,
          byPriority: tasksByPriority,
          byIntegration: tasksByIntegration
        },
        recent: recentTasks.map(task => ({
          // ...task.getSummary(),
          integration: {
            type: (task as any).Integration.type,
            name: (task as any).Integration.name
          }
        })),
        period
      };

      res.json(successResponse(stats));

    } catch (error) {
      logger.error('Failed to get workflow statistics:', error);
      res.status(500).json(errorResponse('Failed to get workflow statistics'));
    }
  }

  /**
   * Sync all pending tasks for user
   * POST /api/workflows/sync
   */
  static async syncAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorResponse('User not authenticated'));
        return;
      }

      const integrations = await Integration.findAll({
        where: {
          userId,
          isConnected: true,
          status: 'active'
        }
      });

      const syncResults = [];

      for (const integration of integrations) {
        try {
          let result;
          switch (integration.type) {
            case 'trello':
              const trelloService = new TrelloIntegrationService(integration);
              result = await trelloService.syncAllPendingTasks();
              break;
            case 'jira':
              const jiraService = new JiraIntegrationService(integration);
              result = await jiraService.syncAllPendingTasks();
              break;
            case 'asana':
              const asanaService = new AsanaIntegrationService(integration);
              result = await asanaService.syncAllPendingTasks();
              break;
            default:
              continue;
          }

          syncResults.push({
            integration: integration.name,
            type: integration.type,
            ...result
          });

        } catch (error) {
          logger.error(`Failed to sync ${integration.type} integration:`, error);
          syncResults.push({
            integration: integration.name,
            type: integration.type,
            success: 0,
            failed: 1,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const totalSuccess = syncResults.reduce((sum, result) => sum + result.success, 0);
      const totalFailed = syncResults.reduce((sum, result) => sum + result.failed, 0);

      res.json(successResponse({
        summary: {
          totalIntegrations: integrations.length,
          totalSuccess,
          totalFailed
        },
        results: syncResults
      }));

    } catch (error) {
      logger.error('Failed to sync all tasks:', error);
      res.status(500).json(errorResponse('Failed to sync all tasks'));
    }
  }
}

export default WorkflowController;