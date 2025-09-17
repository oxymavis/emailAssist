import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Integration from '../../models/Integration';
import WorkflowTask, { WorkflowTaskAttributes } from '../../models/WorkflowTask';
import logger from '../../utils/logger';

/**
 * Trello API response types
 * Trello API ͔{��I
 */
export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  prefs: {
    permissionLevel: string;
  };
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed: boolean;
  idBoard: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortUrl: string;
  pos: number;
  due: string | null;
  dueComplete: boolean;
  closed: boolean;
  idList: string;
  idBoard: string;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  members: Array<{
    id: string;
    username: string;
    fullName: string;
  }>;
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  email?: string;
}

/**
 * Trello Integration Service
 * Trello �
�
 *
 * Л Trello API ����
 * - ���ޥ�
 * - aG��	������
 * - �h�
 * - �e/
 *
 * Features:
 * - OAuth 1.0 ��
 * - ����:6
 * - y��\/
 * - Webhook /(���e	
 */
export class TrelloIntegrationService {
  private apiClient: AxiosInstance;
  private readonly baseUrl = 'https://api.trello.com/1';
  private integration: Integration;

  constructor(integration: Integration) {
    this.integration = integration;
    this.apiClient = this.createApiClient();
  }

  /**
   * Create authenticated API client
   * ���� API �7�
   */
  private createApiClient(): AxiosInstance {
    const { credentials } = this.integration;

    if (!credentials.apiKey || !credentials.accessToken) {
      throw new Error('Trello credentials not configured');
    }

    const client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      params: {
        key: credentials.apiKey,
        token: credentials.accessToken
      }
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        logger.info(`Trello API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Trello API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        logger.info(`Trello API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        logger.error('Trello API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });

        // Handle specific Trello errors
        if (error.response?.status === 401) {
          await this.integration.markError('Trello authentication failed - please reconnect');
        } else if (error.response?.status === 403) {
          await this.integration.markError('Trello access denied - check permissions');
        } else if (error.response?.status >= 500) {
          logger.warn('Trello server error - will retry later');
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Test connection to Trello
   * K� Trello ޥ
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.apiClient.get('/members/me');

      if (response.data && response.data.id) {
        await this.integration.clearError();
        logger.info(`Trello connection test successful for user: ${response.data.fullName}`);
        return { success: true };
      } else {
        const error = 'Invalid Trello API response';
        await this.integration.markError(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Trello connection test failed:', errorMessage);
      await this.integration.markError(`Connection test failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get user's boards
   * ��(7�h
   */
  async getBoards(): Promise<TrelloBoard[]> {
    try {
      const response = await this.apiClient.get('/members/me/boards');
      return response.data.filter((board: TrelloBoard) => !board.prefs || board.prefs.permissionLevel !== 'private');
    } catch (error) {
      logger.error('Failed to fetch Trello boards:', error);
      throw new Error(`Failed to fetch boards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get board lists
   * ���h
   */
  async getBoardLists(boardId: string): Promise<TrelloList[]> {
    try {
      const response = await this.apiClient.get(`/boards/${boardId}/lists`);
      return response.data.filter((list: TrelloList) => !list.closed);
    } catch (error) {
      logger.error(`Failed to fetch lists for board ${boardId}:`, error);
      throw new Error(`Failed to fetch board lists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get board members
   * ��X
   */
  async getBoardMembers(boardId: string): Promise<TrelloMember[]> {
    try {
      const response = await this.apiClient.get(`/boards/${boardId}/members`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch members for board ${boardId}:`, error);
      throw new Error(`Failed to fetch board members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new card (task)
   * ��aG��	
   */
  async createCard(params: {
    listId: string;
    name: string;
    desc?: string;
    due?: Date | null;
    labels?: string[];
    members?: string[];
    pos?: string | number;
  }): Promise<TrelloCard> {
    try {
      const cardData: any = {
        idList: params.listId,
        name: params.name,
        desc: params.desc || '',
        pos: params.pos || 'bottom'
      };

      if (params.due) {
        cardData.due = params.due.toISOString();
      }

      if (params.labels && params.labels.length > 0) {
        cardData.idLabels = params.labels.join(',');
      }

      if (params.members && params.members.length > 0) {
        cardData.idMembers = params.members.join(',');
      }

      const response = await this.apiClient.post('/cards', cardData);

      logger.info(`Created Trello card: ${response.data.id} - ${response.data.name}`);
      await this.integration.updateStatistics({
        totalTasksCreated: this.integration.statistics.totalTasksCreated + 1
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Trello card:', error);
      throw new Error(`Failed to create card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing card
   * ���	aG
   */
  async updateCard(cardId: string, updates: {
    name?: string;
    desc?: string;
    due?: Date | null;
    dueComplete?: boolean;
    closed?: boolean;
    idList?: string;
    idLabels?: string[];
    idMembers?: string[];
  }): Promise<TrelloCard> {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.desc !== undefined) updateData.desc = updates.desc;
      if (updates.due !== undefined) updateData.due = updates.due ? updates.due.toISOString() : null;
      if (updates.dueComplete !== undefined) updateData.dueComplete = updates.dueComplete;
      if (updates.closed !== undefined) updateData.closed = updates.closed;
      if (updates.idList !== undefined) updateData.idList = updates.idList;
      if (updates.idLabels !== undefined) updateData.idLabels = updates.idLabels.join(',');
      if (updates.idMembers !== undefined) updateData.idMembers = updates.idMembers.join(',');

      const response = await this.apiClient.put(`/cards/${cardId}`, updateData);

      logger.info(`Updated Trello card: ${cardId}`);
      await this.integration.updateStatistics({
        totalTasksUpdated: this.integration.statistics.totalTasksUpdated + 1
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to update Trello card ${cardId}:`, error);
      throw new Error(`Failed to update card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get card details
   * ��aG��
   */
  async getCard(cardId: string): Promise<TrelloCard> {
    try {
      const response = await this.apiClient.get(`/cards/${cardId}`, {
        params: {
          fields: 'all',
          members: 'true',
          labels: 'true'
        }
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch Trello card ${cardId}:`, error);
      throw new Error(`Failed to fetch card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete card
   *  daG
   */
  async deleteCard(cardId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/cards/${cardId}`);
      logger.info(`Deleted Trello card: ${cardId}`);
    } catch (error) {
      logger.error(`Failed to delete Trello card ${cardId}:`, error);
      throw new Error(`Failed to delete card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create workflow task from email analysis
   * ή����\A��
   */
  async createTaskFromEmail(params: {
    emailId: string;
    emailSubject: string;
    emailFrom: string;
    emailDate: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    assignee?: string;
    dueDate?: Date | null;
  }): Promise<WorkflowTaskAttributes> {
    try {
      const { configuration } = this.integration;
      const boardId = configuration.defaultProject || this.integration.credentials.boardId;

      if (!boardId) {
        throw new Error('No default board configured for Trello integration');
      }

      // Get the first list of the board (typically "To Do" or similar)
      const lists = await this.getBoardLists(boardId);
      if (lists.length === 0) {
        throw new Error('No lists found in the configured Trello board');
      }

      const defaultList = lists[0];

      // Prepare card data
      const cardName = configuration.taskTemplate
        ? configuration.taskTemplate.replace('{subject}', params.emailSubject)
        : `Email Task: ${params.emailSubject}`;

      const cardDesc = params.description ||
        `Task created from email:\n\nFrom: ${params.emailFrom}\nDate: ${params.emailDate.toISOString()}\nSubject: ${params.emailSubject}`;

      // Map priority to Trello labels if configured
      const labels = configuration.defaultLabels || [];
      const priorityLabelMap: { [key: string]: string } = {
        'low': '51f641',      // green
        'medium': 'f2d600',   // yellow
        'high': 'ff9f1a',     // orange
        'critical': 'eb5a46'  // red
      };

      // Create the Trello card
      const trelloCard = await this.createCard({
        listId: defaultList.id,
        name: cardName,
        desc: cardDesc,
        due: params.dueDate,
        labels: labels,
        members: params.assignee ? [params.assignee] : []
      });

      // Create workflow task record
      const workflowTask = await WorkflowTask.create({
        emailId: params.emailId,
        integrationId: this.integration.id,
        externalTaskId: trelloCard.id,
        title: cardName,
        description: cardDesc,
        priority: params.priority,
        assignee: params.assignee || null,
        status: 'created',
        externalUrl: trelloCard.url,
        labels: labels,
        dueDate: params.dueDate,
        metadata: {
          emailSubject: params.emailSubject,
          emailFrom: params.emailFrom,
          emailDate: params.emailDate,
          integrationSpecific: {
            boardId: boardId,
            listId: defaultList.id,
            trelloCardId: trelloCard.id
          }
        },
        syncStatus: 'synced',
        lastSyncAt: new Date()
      });

      logger.info(`Created workflow task ${workflowTask.id} from email ${params.emailId}`);
      return workflowTask;

    } catch (error) {
      logger.error('Failed to create task from email:', error);
      throw new Error(`Failed to create task from email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync workflow task with Trello card
   * e�\A�� Trello aG
   */
  async syncTask(task: WorkflowTaskAttributes): Promise<void> {
    try {
      const trelloCard = await this.getCard(task.externalTaskId);

      // Map Trello status to workflow status
      let taskStatus: WorkflowTaskAttributes['status'];
      if (trelloCard.closed) {
        taskStatus = 'completed';
      } else {
        // Check if card is in a "done" list (you might want to configure this)
        taskStatus = 'in_progress'; // Default for non-closed cards
      }

      // Extract assignee
      const assignee = trelloCard.members.length > 0 ? trelloCard.members[0].username : null;

      // Extract labels
      const labels = trelloCard.labels.map(label => label.name);

      // Update workflow task
      await (task as any).updateFromExternal({
        title: trelloCard.name,
        description: trelloCard.desc,
        status: taskStatus,
        assignee,
        labels,
        dueDate: trelloCard.due ? new Date(trelloCard.due) : null
      });

      logger.info(`Synced workflow task ${task.id} with Trello card ${task.externalTaskId}`);

    } catch (error) {
      const errorMessage = `Failed to sync task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await (task as any).markSyncError(errorMessage);
      logger.error(`Sync error for task ${task.id}:`, error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Sync all pending tasks for this integration
   * ed��@	���
   */
  async syncAllPendingTasks(): Promise<{ success: number; failed: number }> {
    const stats = { success: 0, failed: 0 };

    try {
      const pendingTasks = await WorkflowTask.findAll({
        where: {
          integrationId: this.integration.id,
          syncStatus: ['pending', 'error']
        }
      });

      logger.info(`Found ${pendingTasks.length} pending tasks for Trello integration ${this.integration.id}`);

      for (const task of pendingTasks) {
        try {
          await this.syncTask(task);
          stats.success++;
        } catch (error) {
          stats.failed++;
          logger.error(`Failed to sync task ${task.id}:`, error);
        }
      }

      // Update integration sync timestamp
      this.integration.lastSyncAt = new Date();
      await this.integration.save();

      logger.info(`Trello sync completed: ${stats.success} success, ${stats.failed} failed`);

    } catch (error) {
      logger.error('Failed to sync pending Trello tasks:', error);
      await this.integration.markError(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return stats;
  }

  /**
   * Update task status in both local DB and Trello
   * (,0pn�� Trello -�����
   */
  async updateTaskStatus(taskId: string, status: WorkflowTaskAttributes['status']): Promise<void> {
    try {
      const task = await WorkflowTask.findByPk(taskId);
      if (!task || task.integrationId !== this.integration.id) {
        throw new Error('Task not found or does not belong to this integration');
      }

      // Update in Trello
      const updateData: any = {};

      if (status === 'completed') {
        updateData.closed = true;
        updateData.dueComplete = true;
      } else if (status === 'cancelled') {
        updateData.closed = true;
      }

      if (Object.keys(updateData).length > 0) {
        await this.updateCard(task.externalTaskId, updateData);
      }

      // Update local task
      // await task.updateStatus(status, false); // false = not from external

      logger.info(`Updated task status: ${taskId} -> ${status}`);

    } catch (error) {
      logger.error(`Failed to update task status ${taskId}:`, error);
      throw new Error(`Failed to update task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get integration configuration schema for frontend
   * ��M�(��Mn!
   */
  static getConfigurationSchema() {
    return {
      credentials: {
        apiKey: {
          type: 'string',
          required: true,
          label: 'Trello API Key',
          description: 'Get your API key from https://trello.com/app-key'
        },
        accessToken: {
          type: 'string',
          required: true,
          label: 'Access Token',
          description: 'Generate an access token for your Trello account'
        },
        boardId: {
          type: 'string',
          required: false,
          label: 'Default Board ID',
          description: 'ID of the default Trello board for new tasks'
        }
      },
      configuration: {
        defaultProject: {
          type: 'string',
          required: false,
          label: 'Default Board',
          description: 'Default board for new tasks'
        },
        defaultAssignee: {
          type: 'string',
          required: false,
          label: 'Default Assignee',
          description: 'Username of the default task assignee'
        },
        taskTemplate: {
          type: 'string',
          required: false,
          default: 'Email Task: {subject}',
          label: 'Task Title Template',
          description: 'Template for new task titles. Use {subject} for email subject'
        },
        defaultLabels: {
          type: 'array',
          required: false,
          default: ['email-task'],
          label: 'Default Labels',
          description: 'Default labels to apply to new tasks'
        },
        autoSync: {
          type: 'boolean',
          required: false,
          default: true,
          label: 'Auto Sync',
          description: 'Automatically sync task updates'
        },
        syncInterval: {
          type: 'number',
          required: false,
          default: 30,
          label: 'Sync Interval (minutes)',
          description: 'How often to sync with Trello'
        }
      }
    };
  }
}

export default TrelloIntegrationService;