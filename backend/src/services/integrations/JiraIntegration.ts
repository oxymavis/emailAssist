/**
 * Jira Integration Service
 * Handles integration with Atlassian Jira
 */

import axios, { AxiosInstance } from 'axios';
import logger from '@/utils/logger';
import { EmailMessage } from '@/types';

export interface JiraConfig {
  host: string; // e.g., 'your-domain.atlassian.net'
  email: string;
  apiToken: string;
  projectKey: string;
  defaultIssueType?: string;
  defaultPriority?: string;
}

export interface JiraIssue {
  id?: string;
  key?: string;
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description: any; // Atlassian Document Format (ADF)
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      accountId: string;
    };
    reporter?: {
      accountId: string;
    };
    labels?: string[];
    components?: Array<{ name: string }>;
    duedate?: string;
    customfield?: Record<string, any>;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export class JiraIntegration {
  private apiClient: AxiosInstance;
  private config: JiraConfig;
  
  constructor(config: JiraConfig) {
    this.config = config;
    
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    this.apiClient = axios.create({
      baseURL: `https://${config.host}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    // Add interceptors
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('Jira API request', { 
          method: config.method,
          url: config.url 
        });
        return config;
      },
      (error) => {
        logger.error('Jira API request error', error);
        return Promise.reject(error);
      }
    );
    
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('Jira API response', { 
          status: response.status 
        });
        return response;
      },
      (error) => {
        logger.error('Jira API error', { 
          status: error.response?.status,
          message: error.response?.data?.errorMessages 
        });
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Test Jira connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/myself');
      logger.info('Jira connection successful', { 
        user: response.data.displayName 
      });
      return true;
    } catch (error) {
      logger.error('Jira connection failed', error);
      return false;
    }
  }
  
  /**
   * Get all projects
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response = await this.apiClient.get('/project');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Jira projects', error);
      throw error;
    }
  }
  
  /**
   * Get project issue types
   */
  async getProjectIssueTypes(projectKey?: string): Promise<any[]> {
    try {
      const key = projectKey || this.config.projectKey;
      const response = await this.apiClient.get(`/project/${key}/statuses`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get project issue types', error);
      throw error;
    }
  }
  
  /**
   * Create issue from email
   */
  async createIssueFromEmail(
    email: EmailMessage,
    options: {
      issueType?: string;
      priority?: string;
      assignee?: string;
      labels?: string[];
      components?: string[];
      dueDate?: Date;
      customFields?: Record<string, any>;
    } = {}
  ): Promise<JiraIssue> {
    try {
      const issue: JiraIssue = {
        fields: {
          project: {
            key: this.config.projectKey
          },
          summary: this.truncateSummary(email.subject || 'Email Issue'),
          description: this.formatEmailToADF(email),
          issuetype: {
            name: options.issueType || this.config.defaultIssueType || 'Task'
          }
        }
      };
      
      // Add optional fields
      if (options.priority || this.config.defaultPriority) {
        issue.fields.priority = {
          name: options.priority || this.config.defaultPriority || 'Medium'
        };
      }
      
      if (options.assignee) {
        issue.fields.assignee = {
          accountId: options.assignee
        };
      }
      
      if (options.labels && options.labels.length > 0) {
        issue.fields.labels = options.labels;
      }
      
      if (options.components && options.components.length > 0) {
        issue.fields.components = options.components.map(c => ({ name: c }));
      }
      
      if (options.dueDate) {
        issue.fields.duedate = options.dueDate.toISOString().split('T')[0];
      }
      
      // Add custom fields
      if (options.customFields) {
        Object.entries(options.customFields).forEach(([key, value]) => {
          issue.fields[key] = value;
        });
      }
      
      // Create the issue
      const response = await this.apiClient.post('/issue', issue);
      
      logger.info('Jira issue created from email', { 
        issueKey: response.data.key,
        emailId: email.id 
      });
      
      // Add email as attachment if possible
      if (response.data.id) {
        await this.addEmailAsComment(response.data.id, email);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Failed to create Jira issue from email', { 
        emailId: email.id,
        error 
      });
      throw error;
    }
  }
  
  /**
   * Create multiple issues from emails (batch)
   */
  async createIssuesFromEmails(
    emails: EmailMessage[],
    options?: any
  ): Promise<JiraIssue[]> {
    const issues: JiraIssue[] = [];
    
    for (const email of emails) {
      try {
        const issue = await this.createIssueFromEmail(email, options);
        issues.push(issue);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error('Failed to create issue for email', { 
          emailId: email.id,
          error 
        });
      }
    }
    
    logger.info('Batch issue creation completed', { 
      total: emails.length,
      successful: issues.length 
    });
    
    return issues;
  }
  
  /**
   * Update issue
   */
  async updateIssue(issueIdOrKey: string, updates: Partial<JiraIssue['fields']>): Promise<void> {
    try {
      await this.apiClient.put(`/issue/${issueIdOrKey}`, { fields: updates });
      
      logger.info('Jira issue updated', { issueIdOrKey });
    } catch (error) {
      logger.error('Failed to update Jira issue', { issueIdOrKey, error });
      throw error;
    }
  }
  
  /**
   * Add comment to issue
   */
  async addComment(issueIdOrKey: string, comment: string): Promise<void> {
    try {
      const body = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: comment
                }
              ]
            }
          ]
        }
      };
      
      await this.apiClient.post(`/issue/${issueIdOrKey}/comment`, body);
      
      logger.info('Comment added to Jira issue', { issueIdOrKey });
    } catch (error) {
      logger.error('Failed to add comment to Jira issue', { issueIdOrKey, error });
      throw error;
    }
  }
  
  /**
   * Add email content as comment
   */
  async addEmailAsComment(issueIdOrKey: string, email: EmailMessage): Promise<void> {
    try {
      const comment = this.formatEmailForComment(email);
      await this.addComment(issueIdOrKey, comment);
    } catch (error) {
      logger.error('Failed to add email as comment', { 
        issueIdOrKey,
        emailId: email.id,
        error 
      });
    }
  }
  
  /**
   * Get issue transitions
   */
  async getTransitions(issueIdOrKey: string): Promise<JiraTransition[]> {
    try {
      const response = await this.apiClient.get(`/issue/${issueIdOrKey}/transitions`);
      return response.data.transitions;
    } catch (error) {
      logger.error('Failed to get issue transitions', { issueIdOrKey, error });
      throw error;
    }
  }
  
  /**
   * Transition issue
   */
  async transitionIssue(issueIdOrKey: string, transitionId: string): Promise<void> {
    try {
      await this.apiClient.post(`/issue/${issueIdOrKey}/transitions`, {
        transition: { id: transitionId }
      });
      
      logger.info('Jira issue transitioned', { issueIdOrKey, transitionId });
    } catch (error) {
      logger.error('Failed to transition Jira issue', { issueIdOrKey, error });
      throw error;
    }
  }
  
  /**
   * Search issues
   */
  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    try {
      const response = await this.apiClient.post('/search', {
        jql,
        maxResults,
        fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated']
      });
      
      return response.data.issues;
    } catch (error) {
      logger.error('Failed to search Jira issues', { jql, error });
      throw error;
    }
  }
  
  /**
   * Get issue by email ID
   */
  async getIssueByEmailId(emailId: string): Promise<JiraIssue | null> {
    try {
      const jql = `text ~ "Email ID: ${emailId}" AND project = ${this.config.projectKey}`;
      const issues = await this.searchIssues(jql, 1);
      
      return issues.length > 0 ? issues[0] : null;
    } catch (error) {
      logger.error('Failed to get issue by email ID', { emailId, error });
      return null;
    }
  }
  
  /**
   * Create webhook
   */
  async createWebhook(
    name: string,
    url: string,
    events: string[] = ['jira:issue_created', 'jira:issue_updated']
  ): Promise<string> {
    try {
      const response = await this.apiClient.post('/webhook', {
        name,
        url,
        events,
        filters: {
          'issue-related-events-section': `project = ${this.config.projectKey}`
        }
      });
      
      logger.info('Jira webhook created', { 
        webhookId: response.data.id,
        name 
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create Jira webhook', error);
      throw error;
    }
  }
  
  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/webhook/${webhookId}`);
      
      logger.info('Jira webhook deleted', { webhookId });
    } catch (error) {
      logger.error('Failed to delete Jira webhook', { webhookId, error });
      throw error;
    }
  }
  
  /**
   * Get users assignable to project
   */
  async getAssignableUsers(projectKey?: string): Promise<JiraUser[]> {
    try {
      const key = projectKey || this.config.projectKey;
      const response = await this.apiClient.get('/user/assignable/search', {
        params: { project: key }
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get assignable users', error);
      throw error;
    }
  }
  
  /**
   * Format email to Atlassian Document Format (ADF)
   */
  private formatEmailToADF(email: EmailMessage): any {
    const content: any[] = [];
    
    // Add email metadata
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Email Details' }]
    });
    
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'From: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: email.from?.email || 'Unknown' }
      ]
    });
    
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Date: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: email.receivedAt?.toLocaleString() || 'Unknown' }
      ]
    });
    
    if (email.to && email.to.length > 0) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'To: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: email.to.map(r => r.email).join(', ') }
        ]
      });
    }
    
    // Add separator
    content.push({ type: 'rule' });
    
    // Add email body
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Email Content' }]
    });
    
    // Split body into paragraphs
    const bodyParagraphs = (email.body || 'No content').split('\n\n');
    bodyParagraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }]
        });
      }
    });
    
    // Add email ID for reference
    content.push({ type: 'rule' });
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Email ID: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: email.id, marks: [{ type: 'code' }] }
      ]
    });
    
    return {
      type: 'doc',
      version: 1,
      content
    };
  }
  
  /**
   * Format email for comment
   */
  private formatEmailForComment(email: EmailMessage): string {
    const lines: string[] = [];
    
    lines.push('📧 **Email Reference**');
    lines.push(`From: ${email.from?.email || 'Unknown'}`);
    lines.push(`Date: ${email.receivedAt?.toLocaleString() || 'Unknown'}`);
    lines.push(`Subject: ${email.subject || 'No subject'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(email.body || 'No content');
    lines.push('');
    lines.push(`Email ID: ${email.id}`);
    
    return lines.join('\n');
  }
  
  /**
   * Truncate summary to Jira's limit
   */
  private truncateSummary(summary: string, maxLength = 255): string {
    if (summary.length <= maxLength) {
      return summary;
    }
    
    return summary.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Sync email status with Jira issue
   */
  async syncEmailStatus(
    emailId: string,
    status: 'read' | 'unread' | 'archived' | 'deleted'
  ): Promise<void> {
    try {
      const issue = await this.getIssueByEmailId(emailId);
      
      if (!issue || !issue.key) {
        logger.warn('No Jira issue found for email', { emailId });
        return;
      }
      
      // Get available transitions
      const transitions = await this.getTransitions(issue.key);
      
      // Map email status to Jira transition
      let targetTransition: JiraTransition | undefined;
      
      switch (status) {
        case 'archived':
        case 'deleted':
          targetTransition = transitions.find(t => 
            t.name.toLowerCase().includes('done') || 
            t.name.toLowerCase().includes('closed')
          );
          break;
        
        case 'read':
          targetTransition = transitions.find(t => 
            t.name.toLowerCase().includes('progress') || 
            t.name.toLowerCase().includes('review')
          );
          break;
      }
      
      if (targetTransition) {
        await this.transitionIssue(issue.key, targetTransition.id);
        await this.addComment(issue.key, `Email status changed to: ${status}`);
      }
      
      logger.info('Email status synced with Jira', { emailId, status, issueKey: issue.key });
    } catch (error) {
      logger.error('Failed to sync email status with Jira', { 
        emailId,
        status,
        error 
      });
    }
  }
}