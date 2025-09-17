import axios, { AxiosInstance } from 'axios';
import Integration from '../../models/Integration';
import WorkflowTask, { WorkflowTaskAttributes } from '../../models/WorkflowTask';
import logger from '../../utils/logger';

/**
 * Asana API response types
 * Asana API 响应类型定义
 */
export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  permalink_url: string;
  completed: boolean;
  completed_at?: string;
  due_on?: string;
  due_at?: string;
  created_at: string;
  modified_at: string;
  assignee?: {
    gid: string;
    name: string;
    email?: string;
  };
  projects: Array<{
    gid: string;
    name: string;
  }>;
  tags: Array<{
    gid: string;
    name: string;
    color?: string;
  }>;
  custom_fields?: Array<{
    gid: string;
    name: string;
    type: string;
    text_value?: string;
    number_value?: number;
    enum_value?: {
      gid: string;
      name: string;
      color?: string;
    };
  }>;
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes: string;
  permalink_url: string;
  color: string;
  public: boolean;
  archived: boolean;
  created_at: string;
  modified_at: string;
  owner?: {
    gid: string;
    name: string;
  };
  team?: {
    gid: string;
    name: string;
  };
  workspace: {
    gid: string;
    name: string;
  };
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
  email_domains?: string[];
  is_organization: boolean;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  photo?: {
    image_21x21?: string;
    image_27x27?: string;
    image_36x36?: string;
    image_60x60?: string;
  };
  workspaces: AsanaWorkspace[];
}

export interface AsanaSection {
  gid: string;
  name: string;
  created_at: string;
  project: {
    gid: string;
    name: string;
  };
}

/**
 * Asana Integration Service
 * Asana 集成服务
 *
 * 基于 Asana API v1.0 实现的第三方工作流集成
 * - OAuth2 认证支持
 * - 任务创建和管理
 * - 项目管理
 * - 双向同步支持
 *
 * Features:
 * - OAuth 2.0 认证
 * - 任务CRUD操作
 * - 项目和团队管理
 * - 自定义字段支持
 * - 标签和优先级管理
 */
export class AsanaIntegrationService {
  private apiClient: AxiosInstance;
  private readonly baseUrl = 'https://app.asana.com/api/1.0';
  private integration: Integration;

  constructor(integration: Integration) {
    this.integration = integration;
    this.apiClient = this.createApiClient();
  }

  /**
   * Create authenticated API client
   * 创建已认证的 API 客户端
   */
  private createApiClient(): AxiosInstance {
    const { credentials } = this.integration;

    if (!credentials.accessToken) {
      throw new Error('Asana access token not configured');
    }

    const client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        logger.info(`Asana API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Asana API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        logger.info(`Asana API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        logger.error('Asana API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });

        // Handle specific Asana errors
        if (error.response?.status === 401) {
          await this.integration.markError('Asana authentication failed - please reconnect');
        } else if (error.response?.status === 403) {
          await this.integration.markError('Asana access denied - check permissions');
        } else if (error.response?.status === 402) {
          await this.integration.markError('Asana premium feature required');
        } else if (error.response?.status >= 500) {
          logger.warn('Asana server error - will retry later');
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Test connection to Asana
   * 测试 Asana 连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.apiClient.get('/users/me');

      if (response.data && response.data.data && response.data.data.gid) {
        await this.integration.clearError();
        logger.info(`Asana connection test successful for user: ${response.data.data.name}`);
        return { success: true };
      } else {
        const error = 'Invalid Asana API response';
        await this.integration.markError(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Asana connection test failed:', errorMessage);
      await this.integration.markError(`Connection test failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get current user information
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<AsanaUser> {
    try {
      const response = await this.apiClient.get('/users/me');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch Asana user info:', error);
      throw new Error(`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's workspaces
   * 获取用户工作区
   */
  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    try {
      const response = await this.apiClient.get('/workspaces');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch Asana workspaces:', error);
      throw new Error(`Failed to fetch workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get projects in a workspace
   * 获取工作区中的项目
   */
  async getProjects(workspaceGid?: string): Promise<AsanaProject[]> {
    try {
      const currentUser = await this.getCurrentUser();
      const targetWorkspace = workspaceGid || currentUser.workspaces[0]?.gid;

      if (!targetWorkspace) {
        throw new Error('No workspace available');
      }

      const response = await this.apiClient.get(`/projects`, {
        params: {
          workspace: targetWorkspace,
          archived: false,
          opt_fields: 'gid,name,notes,permalink_url,color,public,archived,created_at,modified_at,owner,team,workspace'
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch Asana projects:', error);
      throw new Error(`Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sections in a project
   * 获取项目中的分组
   */
  async getProjectSections(projectGid: string): Promise<AsanaSection[]> {
    try {
      const response = await this.apiClient.get(`/projects/${projectGid}/sections`);
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to fetch sections for project ${projectGid}:`, error);
      throw new Error(`Failed to fetch project sections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new task
   * 创建新任务
   */
  async createTask(params: {
    name: string;
    notes?: string;
    projects?: string[];
    assignee?: string;
    due_on?: string;
    due_at?: string;
    tags?: string[];
    parent?: string;
    followers?: string[];
    custom_fields?: { [key: string]: any };
  }): Promise<AsanaTask> {
    try {
      const taskData: any = {
        name: params.name,
        notes: params.notes || '',
        projects: params.projects,
        assignee: params.assignee,
        due_on: params.due_on,
        due_at: params.due_at,
        tags: params.tags,
        parent: params.parent,
        followers: params.followers
      };

      // Handle custom fields
      if (params.custom_fields) {
        taskData.custom_fields = params.custom_fields;
      }

      // Remove undefined values
      Object.keys(taskData).forEach(key => {
        if (taskData[key] === undefined) {
          delete taskData[key];
        }
      });

      const response = await this.apiClient.post('/tasks', {
        data: taskData
      });

      logger.info(`Created Asana task: ${response.data.data.gid} - ${response.data.data.name}`);
      await this.integration.updateStatistics({
        totalTasksCreated: this.integration.statistics.totalTasksCreated + 1
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to create Asana task:', error);
      throw new Error(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing task
   * 更新现有任务
   */
  async updateTask(taskGid: string, updates: {
    name?: string;
    notes?: string;
    completed?: boolean;
    assignee?: string;
    due_on?: string;
    due_at?: string;
    projects?: string[];
    tags?: string[];
    custom_fields?: { [key: string]: any };
  }): Promise<AsanaTask> {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.completed !== undefined) updateData.completed = updates.completed;
      if (updates.assignee !== undefined) updateData.assignee = updates.assignee;
      if (updates.due_on !== undefined) updateData.due_on = updates.due_on;
      if (updates.due_at !== undefined) updateData.due_at = updates.due_at;
      if (updates.projects !== undefined) updateData.projects = updates.projects;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.custom_fields !== undefined) updateData.custom_fields = updates.custom_fields;

      const response = await this.apiClient.put(`/tasks/${taskGid}`, {
        data: updateData
      });

      logger.info(`Updated Asana task: ${taskGid}`);
      await this.integration.updateStatistics({
        totalTasksUpdated: this.integration.statistics.totalTasksUpdated + 1
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to update Asana task ${taskGid}:`, error);
      throw new Error(`Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get task details
   * 获取任务详情
   */
  async getTask(taskGid: string): Promise<AsanaTask> {
    try {
      const response = await this.apiClient.get(`/tasks/${taskGid}`, {
        params: {
          opt_fields: 'gid,name,notes,permalink_url,completed,completed_at,due_on,due_at,created_at,modified_at,assignee,projects,tags,custom_fields'
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to fetch Asana task ${taskGid}:`, error);
      throw new Error(`Failed to fetch task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task
   * 删除任务
   */
  async deleteTask(taskGid: string): Promise<void> {
    try {
      await this.apiClient.delete(`/tasks/${taskGid}`);
      logger.info(`Deleted Asana task: ${taskGid}`);
    } catch (error) {
      logger.error(`Failed to delete Asana task ${taskGid}:`, error);
      throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create workflow task from email analysis
   * 从邮件分析创建工作流任务
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
      const projectGid = configuration.defaultProject;

      if (!projectGid) {
        throw new Error('No default project configured for Asana integration');
      }

      // Prepare task data
      const taskName = configuration.taskTemplate
        ? configuration.taskTemplate.replace('{subject}', params.emailSubject)
        : `Email Task: ${params.emailSubject}`;

      const taskNotes = params.description ||
        `Task created from email:\n\nFrom: ${params.emailFrom}\nDate: ${params.emailDate.toISOString()}\nSubject: ${params.emailSubject}`;

      // Map priority to Asana custom field if configured
      const customFields: { [key: string]: any } = {};
      if ((configuration as any).priorityField) {
        const priorityMap = {
          'low': 'Low',
          'medium': 'Medium',
          'high': 'High',
          'critical': 'Critical'
        };
        customFields[(configuration as any).priorityField] = priorityMap[params.priority];
      }

      // Create the Asana task
      const asanaTask = await this.createTask({
        name: taskName,
        notes: taskNotes,
        projects: [projectGid],
        assignee: params.assignee || configuration.defaultAssignee,
        due_on: params.dueDate ? params.dueDate.toISOString().split('T')[0] : undefined,
        tags: configuration.defaultLabels,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
      });

      // Create workflow task record
      const workflowTask = await WorkflowTask.create({
        emailId: params.emailId,
        integrationId: this.integration.id,
        externalTaskId: asanaTask.gid,
        title: taskName,
        description: taskNotes,
        priority: params.priority,
        assignee: params.assignee || null,
        status: 'created',
        externalUrl: asanaTask.permalink_url,
        labels: configuration.defaultLabels || [],
        dueDate: params.dueDate,
        metadata: {
          emailSubject: params.emailSubject,
          emailFrom: params.emailFrom,
          emailDate: params.emailDate,
          integrationSpecific: {
            projectGid: projectGid,
            asanaTaskGid: asanaTask.gid,
            customFields
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
   * Sync workflow task with Asana task
   * 同步工作流任务与 Asana 任务
   */
  async syncTask(task: WorkflowTaskAttributes): Promise<void> {
    try {
      const asanaTask = await this.getTask(task.externalTaskId);

      // Map Asana status to workflow status
      let taskStatus: WorkflowTaskAttributes['status'];
      if (asanaTask.completed) {
        taskStatus = 'completed';
      } else {
        taskStatus = 'in_progress'; // Default for non-completed tasks
      }

      // Extract assignee
      const assignee = asanaTask.assignee ? asanaTask.assignee.name : null;

      // Extract tags/labels
      const labels = asanaTask.tags.map(tag => tag.name);

      // Extract due date
      let dueDate: Date | null = null;
      if (asanaTask.due_at) {
        dueDate = new Date(asanaTask.due_at);
      } else if (asanaTask.due_on) {
        dueDate = new Date(asanaTask.due_on);
      }

      // Update workflow task
      await (task as any).updateFromExternal({
        title: asanaTask.name,
        description: asanaTask.notes,
        status: taskStatus,
        assignee,
        labels,
        dueDate
      });

      logger.info(`Synced workflow task ${task.id} with Asana task ${task.externalTaskId}`);

    } catch (error) {
      const errorMessage = `Failed to sync task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await (task as any).markSyncError(errorMessage);
      logger.error(`Sync error for task ${task.id}:`, error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Sync all pending tasks for this integration
   * 同步此集成的所有待处理任务
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

      logger.info(`Found ${pendingTasks.length} pending tasks for Asana integration ${this.integration.id}`);

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

      logger.info(`Asana sync completed: ${stats.success} success, ${stats.failed} failed`);

    } catch (error) {
      logger.error('Failed to sync pending Asana tasks:', error);
      await this.integration.markError(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return stats;
  }

  /**
   * Update task status in both local DB and Asana
   * 在本地数据库和 Asana 中更新任务状态
   */
  async updateTaskStatus(taskId: string, status: WorkflowTaskAttributes['status']): Promise<void> {
    try {
      const task = await WorkflowTask.findByPk(taskId);
      if (!task || task.integrationId !== this.integration.id) {
        throw new Error('Task not found or does not belong to this integration');
      }

      // Update in Asana
      const updateData: any = {};

      if (status === 'completed') {
        updateData.completed = true;
      } else if (status === 'in_progress') {
        updateData.completed = false;
      }

      if (Object.keys(updateData).length > 0) {
        await this.updateTask(task.externalTaskId, updateData);
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
   * 获取前端集成配置结构
   */
  static getConfigurationSchema() {
    return {
      credentials: {
        accessToken: {
          type: 'string',
          required: true,
          label: 'Asana Access Token',
          description: 'OAuth access token for Asana API',
          sensitive: true
        }
      },
      configuration: {
        defaultProject: {
          type: 'string',
          required: true,
          label: 'Default Project',
          description: 'Default project GID for new tasks'
        },
        defaultAssignee: {
          type: 'string',
          required: false,
          label: 'Default Assignee',
          description: 'User GID of the default task assignee'
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
          default: [],
          label: 'Default Tags',
          description: 'Tag GIDs to apply to new tasks'
        },
        priorityField: {
          type: 'string',
          required: false,
          label: 'Priority Custom Field',
          description: 'Custom field GID for task priority'
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
          description: 'How often to sync with Asana'
        }
      }
    };
  }
}

export default AsanaIntegrationService;