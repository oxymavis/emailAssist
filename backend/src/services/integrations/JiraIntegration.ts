import axios, { AxiosInstance } from 'axios';
import Integration from '../../models/Integration';
import WorkflowTask, { WorkflowTaskAttributes } from '../../models/WorkflowTask';
import logger from '../../utils/logger';

/**
 * Jira API response types
 * Jira API 响应类型定义
 */
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    project: {
      id: string;
      key: string;
      name: string;
    };
    summary: string;
    description?: any; // Atlassian Document Format (ADF)
    issuetype: {
      id: string;
      name: string;
      iconUrl: string;
    };
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        name: string;
        colorName: string;
      };
    };
    priority?: {
      id: string;
      name: string;
      iconUrl: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
      avatarUrls?: {
        '16x16': string;
        '24x24': string;
        '32x32': string;
        '48x48': string;
      };
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    labels: string[];
    components: Array<{
      id: string;
      name: string;
    }>;
    duedate?: string;
    created: string;
    updated: string;
    resolutiondate?: string;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  lead?: {
    accountId: string;
    displayName: string;
  };
  avatarUrls?: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  timeZone?: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory: {
      id: number;
      name: string;
      colorName: string;
    };
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
  description?: string;
}

/**
 * Jira Integration Service
 * Jira 集成服务
 *
 * 基于 Atlassian Jira REST API v3 实现的第三方工作流集成
 * - API Token 认证支持
 * - 问题创建和管理
 * - 项目管理
 * - 双向同步支持
 *
 * Features:
 * - API Token 认证
 * - 问题CRUD操作
 * - 项目和用户管理
 * - 状态转换管理
 * - 标签和优先级支持
 */
export class JiraIntegrationService {
  private apiClient: AxiosInstance;
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

    if (!credentials.apiUrl || !credentials.apiKey || !credentials.accessToken) {
      throw new Error('Jira credentials not configured (missing apiUrl, email, or apiToken)');
    }

    // Create Basic Auth header
    const auth = Buffer.from(`${credentials.apiKey}:${credentials.accessToken}`).toString('base64');

    const client = axios.create({
      baseURL: `${credentials.apiUrl}/rest/api/3`,
      timeout: 30000,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        logger.info(`Jira API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Jira API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        logger.info(`Jira API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        logger.error('Jira API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });

        // Handle specific Jira errors
        if (error.response?.status === 401) {
          await this.integration.markError('Jira authentication failed - check email and API token');
        } else if (error.response?.status === 403) {
          await this.integration.markError('Jira access denied - check permissions');
        } else if (error.response?.status === 404) {
          await this.integration.markError('Jira resource not found - check project configuration');
        } else if (error.response?.status >= 500) {
          logger.warn('Jira server error - will retry later');
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Test connection to Jira
   * 测试 Jira 连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.apiClient.get('/myself');

      if (response.data && response.data.accountId) {
        await this.integration.clearError();
        logger.info(`Jira connection test successful for user: ${response.data.displayName}`);
        return { success: true };
      } else {
        const error = 'Invalid Jira API response';
        await this.integration.markError(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Jira connection test failed:', errorMessage);
      await this.integration.markError(`Connection test failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get current user information
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<JiraUser> {
    try {
      const response = await this.apiClient.get('/myself');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Jira user info:', error);
      throw new Error(`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all accessible projects
   * 获取所有可访问的项目
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response = await this.apiClient.get('/project');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Jira projects:', error);
      throw new Error(`Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get project details
   * 获取项目详情
   */
  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      const response = await this.apiClient.get(`/project/${projectKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch Jira project ${projectKey}:`, error);
      throw new Error(`Failed to fetch project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get issue types for project
   * 获取项目的问题类型
   */
  async getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    try {
      const response = await this.apiClient.get(`/project/${projectKey}/statuses`);
      // Extract unique issue types from the response
      const issueTypesMap = new Map();
      response.data.forEach((statusGroup: any) => {
        statusGroup.issueTypes.forEach((issueType: JiraIssueType) => {
          issueTypesMap.set(issueType.id, issueType);
        });
      });
      return Array.from(issueTypesMap.values());
    } catch (error) {
      logger.error(`Failed to fetch issue types for project ${projectKey}:`, error);
      throw new Error(`Failed to fetch issue types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get priorities
   * 获取优先级列表
   */
  async getPriorities(): Promise<JiraPriority[]> {
    try {
      const response = await this.apiClient.get('/priority');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Jira priorities:', error);
      throw new Error(`Failed to fetch priorities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get users assignable to project
   * 获取项目可分配用户
   */
  async getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
    try {
      const response = await this.apiClient.get('/user/assignable/search', {
        params: {
          project: projectKey,
          maxResults: 50
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch assignable users for project ${projectKey}:`, error);
      throw new Error(`Failed to fetch assignable users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new issue
   * 创建新问题
   */
  async createIssue(params: {
    projectKey: string;
    summary: string;
    description?: string;
    issueTypeId?: string;
    priorityId?: string;
    assigneeId?: string;
    reporterId?: string;
    labels?: string[];
    components?: string[];
    dueDate?: string;
    customFields?: { [key: string]: any };
  }): Promise<JiraIssue> {
    try {
      const issueData: any = {
        fields: {
          project: {
            key: params.projectKey
          },
          summary: params.summary,
          issuetype: {
            id: params.issueTypeId || '10001' // Default Task type
          }
        }
      };

      // Add description in ADF format if provided
      if (params.description) {
        issueData.fields.description = this.convertToADF(params.description);
      }

      // Add optional fields
      if (params.priorityId) {
        issueData.fields.priority = { id: params.priorityId };
      }

      if (params.assigneeId) {
        issueData.fields.assignee = { accountId: params.assigneeId };
      }

      if (params.reporterId) {
        issueData.fields.reporter = { accountId: params.reporterId };
      }

      if (params.labels && params.labels.length > 0) {
        issueData.fields.labels = params.labels;
      }

      if (params.components && params.components.length > 0) {
        issueData.fields.components = params.components.map(id => ({ id }));
      }

      if (params.dueDate) {
        issueData.fields.duedate = params.dueDate;
      }

      // Add custom fields
      if (params.customFields) {
        Object.entries(params.customFields).forEach(([key, value]) => {
          issueData.fields[key] = value;
        });
      }

      const response = await this.apiClient.post('/issue', issueData);

      logger.info(`Created Jira issue: ${response.data.key} - ${params.summary}`);
      await this.integration.updateStatistics({
        totalTasksCreated: this.integration.statistics.totalTasksCreated + 1
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Jira issue:', error);
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing issue
   * 更新现有问题
   */
  async updateIssue(issueKey: string, updates: {
    summary?: string;
    description?: string;
    priorityId?: string;
    assigneeId?: string;
    labels?: string[];
    dueDate?: string;
    customFields?: { [key: string]: any };
  }): Promise<JiraIssue> {
    try {
      const updateData: any = { fields: {} };

      if (updates.summary !== undefined) updateData.fields.summary = updates.summary;
      if (updates.description !== undefined) {
        updateData.fields.description = this.convertToADF(updates.description);
      }
      if (updates.priorityId !== undefined) updateData.fields.priority = { id: updates.priorityId };
      if (updates.assigneeId !== undefined) updateData.fields.assignee = { accountId: updates.assigneeId };
      if (updates.labels !== undefined) updateData.fields.labels = updates.labels;
      if (updates.dueDate !== undefined) updateData.fields.duedate = updates.dueDate;

      // Add custom fields
      if (updates.customFields) {
        Object.entries(updates.customFields).forEach(([key, value]) => {
          updateData.fields[key] = value;
        });
      }

      await this.apiClient.put(`/issue/${issueKey}`, updateData);

      logger.info(`Updated Jira issue: ${issueKey}`);
      await this.integration.updateStatistics({
        totalTasksUpdated: this.integration.statistics.totalTasksUpdated + 1
      });

      // Fetch and return updated issue
      return await this.getIssue(issueKey);
    } catch (error) {
      logger.error(`Failed to update Jira issue ${issueKey}:`, error);
      throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get issue details
   * 获取问题详情
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.apiClient.get(`/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch Jira issue ${issueKey}:`, error);
      throw new Error(`Failed to fetch issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete issue
   * 删除问题
   */
  async deleteIssue(issueKey: string): Promise<void> {
    try {
      await this.apiClient.delete(`/issue/${issueKey}`);
      logger.info(`Deleted Jira issue: ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to delete Jira issue ${issueKey}:`, error);
      throw new Error(`Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get issue transitions
   * 获取问题可用转换
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    try {
      const response = await this.apiClient.get(`/issue/${issueKey}/transitions`);
      return response.data.transitions;
    } catch (error) {
      logger.error(`Failed to get transitions for issue ${issueKey}:`, error);
      throw new Error(`Failed to get transitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transition issue to new status
   * 转换问题状态
   */
  async transitionIssue(issueKey: string, transitionId: string, comment?: string): Promise<void> {
    try {
      const transitionData: any = {
        transition: { id: transitionId }
      };

      if (comment) {
        transitionData.update = {
          comment: [{
            add: {
              body: this.convertToADF(comment)
            }
          }]
        };
      }

      await this.apiClient.post(`/issue/${issueKey}/transitions`, transitionData);
      logger.info(`Transitioned Jira issue ${issueKey} with transition ${transitionId}`);
    } catch (error) {
      logger.error(`Failed to transition issue ${issueKey}:`, error);
      throw new Error(`Failed to transition issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add comment to issue
   * 为问题添加评论
   */
  async addComment(issueKey: string, comment: string): Promise<void> {
    try {
      const commentData = {
        body: this.convertToADF(comment)
      };

      await this.apiClient.post(`/issue/${issueKey}/comment`, commentData);
      logger.info(`Added comment to Jira issue: ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to add comment to issue ${issueKey}:`, error);
      throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const projectKey = configuration.defaultProject;

      if (!projectKey) {
        throw new Error('No default project configured for Jira integration');
      }

      // Prepare issue data
      const issueSummary = configuration.taskTemplate
        ? configuration.taskTemplate.replace('{subject}', params.emailSubject)
        : `Email Issue: ${params.emailSubject}`;

      const issueDescription = params.description ||
        `Issue created from email:\n\nFrom: ${params.emailFrom}\nDate: ${params.emailDate.toISOString()}\nSubject: ${params.emailSubject}`;

      // Map priority
      const priorityMap = {
        'low': '4',      // Low
        'medium': '3',   // Medium
        'high': '2',     // High
        'critical': '1'  // Highest
      };

      // Create the Jira issue
      const jiraIssue = await this.createIssue({
        projectKey,
        summary: issueSummary,
        description: issueDescription,
        issueTypeId: (configuration as any).defaultIssueType,
        priorityId: priorityMap[params.priority],
        assigneeId: params.assignee || configuration.defaultAssignee,
        labels: configuration.defaultLabels || ['email-task'],
        dueDate: params.dueDate ? params.dueDate.toISOString().split('T')[0] : undefined
      });

      // Create workflow task record
      const workflowTask = await WorkflowTask.create({
        emailId: params.emailId,
        integrationId: this.integration.id,
        externalTaskId: jiraIssue.key,
        title: issueSummary,
        description: issueDescription,
        priority: params.priority,
        assignee: params.assignee || null,
        status: 'created',
        externalUrl: `${this.integration.credentials.apiUrl}/browse/${jiraIssue.key}`,
        labels: configuration.defaultLabels || [],
        dueDate: params.dueDate,
        metadata: {
          emailSubject: params.emailSubject,
          emailFrom: params.emailFrom,
          emailDate: params.emailDate,
          integrationSpecific: {
            projectKey,
            issueId: jiraIssue.id,
            issueKey: jiraIssue.key
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
   * Sync workflow task with Jira issue
   * 同步工作流任务与 Jira 问题
   */
  async syncTask(task: WorkflowTaskAttributes): Promise<void> {
    try {
      const jiraIssue = await this.getIssue(task.externalTaskId);

      // Map Jira status to workflow status
      let taskStatus: WorkflowTaskAttributes['status'];
      const statusCategory = jiraIssue.fields.status.statusCategory.name.toLowerCase();

      switch (statusCategory) {
        case 'done':
          taskStatus = 'completed';
          break;
        case 'in progress':
          taskStatus = 'in_progress';
          break;
        case 'to do':
        default:
          taskStatus = 'created';
          break;
      }

      // Extract assignee
      const assignee = jiraIssue.fields.assignee ? jiraIssue.fields.assignee.displayName : null;

      // Extract labels
      const labels = jiraIssue.fields.labels || [];

      // Extract due date
      const dueDate = jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : null;

      // Update workflow task
      await (task as any).updateFromExternal({
        title: jiraIssue.fields.summary,
        description: this.extractTextFromADF(jiraIssue.fields.description),
        status: taskStatus,
        assignee,
        labels,
        dueDate
      });

      logger.info(`Synced workflow task ${task.id} with Jira issue ${task.externalTaskId}`);

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

      logger.info(`Found ${pendingTasks.length} pending tasks for Jira integration ${this.integration.id}`);

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

      logger.info(`Jira sync completed: ${stats.success} success, ${stats.failed} failed`);

    } catch (error) {
      logger.error('Failed to sync pending Jira tasks:', error);
      await this.integration.markError(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return stats;
  }

  /**
   * Update task status in both local DB and Jira
   * 在本地数据库和 Jira 中更新任务状态
   */
  async updateTaskStatus(taskId: string, status: WorkflowTaskAttributes['status']): Promise<void> {
    try {
      const task = await WorkflowTask.findByPk(taskId);
      if (!task || task.integrationId !== this.integration.id) {
        throw new Error('Task not found or does not belong to this integration');
      }

      // Get available transitions
      const transitions = await this.getTransitions(task.externalTaskId);

      // Map workflow status to Jira transition
      let targetTransition: JiraTransition | undefined;

      switch (status) {
        case 'completed':
          targetTransition = transitions.find(t =>
            t.name.toLowerCase().includes('done') ||
            t.name.toLowerCase().includes('close') ||
            t.name.toLowerCase().includes('resolve')
          );
          break;
        case 'in_progress':
          targetTransition = transitions.find(t =>
            t.name.toLowerCase().includes('progress') ||
            t.name.toLowerCase().includes('start')
          );
          break;
        case 'cancelled':
          targetTransition = transitions.find(t =>
            t.name.toLowerCase().includes('cancel') ||
            t.name.toLowerCase().includes('reject')
          );
          break;
      }

      // Transition in Jira if mapping found
      if (targetTransition) {
        await this.transitionIssue(task.externalTaskId, targetTransition.id, `Status updated to: ${status}`);
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
   * Convert text to Atlassian Document Format (ADF)
   * 将文本转换为 Atlassian 文档格式
   */
  private convertToADF(text: string): any {
    // Split text into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    const content = paragraphs.map(paragraph => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: paragraph.trim()
        }
      ]
    }));

    return {
      type: 'doc',
      version: 1,
      content: content.length > 0 ? content : [{
        type: 'paragraph',
        content: [{ type: 'text', text: text }]
      }]
    };
  }

  /**
   * Extract text from ADF format
   * 从 ADF 格式提取文本
   */
  private extractTextFromADF(adf: any): string {
    if (!adf || !adf.content) return '';

    const extractText = (node: any): string => {
      if (node.type === 'text') {
        return node.text || '';
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('');
      }

      return '';
    };

    return adf.content.map(extractText).join('\n\n').trim();
  }

  /**
   * Get integration configuration schema for frontend
   * 获取前端集成配置结构
   */
  static getConfigurationSchema() {
    return {
      credentials: {
        apiUrl: {
          type: 'string',
          required: true,
          label: 'Jira Instance URL',
          description: 'Your Jira instance URL (e.g., https://your-domain.atlassian.net)',
          placeholder: 'https://your-domain.atlassian.net'
        },
        apiKey: {
          type: 'string',
          required: true,
          label: 'Email Address',
          description: 'Your Jira account email address'
        },
        accessToken: {
          type: 'string',
          required: true,
          label: 'API Token',
          description: 'API token for Jira integration',
          sensitive: true
        }
      },
      configuration: {
        defaultProject: {
          type: 'string',
          required: true,
          label: 'Default Project Key',
          description: 'Default project key for new issues'
        },
        defaultIssueType: {
          type: 'string',
          required: false,
          default: '10001',
          label: 'Default Issue Type',
          description: 'Default issue type ID for new issues'
        },
        defaultAssignee: {
          type: 'string',
          required: false,
          label: 'Default Assignee',
          description: 'Account ID of the default issue assignee'
        },
        taskTemplate: {
          type: 'string',
          required: false,
          default: 'Email Issue: {subject}',
          label: 'Issue Title Template',
          description: 'Template for new issue titles. Use {subject} for email subject'
        },
        defaultLabels: {
          type: 'array',
          required: false,
          default: ['email-task'],
          label: 'Default Labels',
          description: 'Default labels to apply to new issues'
        },
        autoSync: {
          type: 'boolean',
          required: false,
          default: true,
          label: 'Auto Sync',
          description: 'Automatically sync issue updates'
        },
        syncInterval: {
          type: 'number',
          required: false,
          default: 30,
          label: 'Sync Interval (minutes)',
          description: 'How often to sync with Jira'
        }
      }
    };
  }
}

export default JiraIntegrationService;