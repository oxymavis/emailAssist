/**
 * Real API Service
 * Connects frontend to actual backend endpoints
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { io, Socket } from 'socket.io-client';
import { 
  Email, 
  EmailAccount, 
  FilterRule, 
  Report, 
  Workflow,
  DashboardStats,
  EmailAnalysis 
} from '@/types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Token management
let authToken: string | null = localStorage.getItem('authToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

// WebSocket instance
let socket: Socket | null = null;

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const response = await refreshAuthToken();
        if (response) {
          originalRequest.headers.Authorization = `Bearer ${authToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Refresh authentication token
 */
async function refreshAuthToken(): Promise<any> {
  if (!refreshToken) return null;
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken
    });
    
    const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
    
    authToken = accessToken;
    refreshToken = newRefreshToken;
    
    localStorage.setItem('authToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return response.data;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Initialize WebSocket connection
 */
export function initializeWebSocket(onNotification?: (notification: any) => void): void {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(WS_URL, {
    auth: {
      token: authToken
    },
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
    console.log('WebSocket connected');
    
    // Subscribe to user channels
    socket?.emit('subscribe', ['user_notifications', 'email_updates']);
  });
  
  socket.on('notification', (notification) => {
    console.log('Notification received:', notification);
    if (onNotification) {
      onNotification(notification);
    }
  });
  
  socket.on('email_received', (email) => {
    console.log('New email received:', email);
    // Update store or trigger refresh
  });
  
  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
  });
  
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Authentication APIs
export const authAPI = {
  /**
   * Login with Microsoft
   */
  async loginWithMicrosoft(): Promise<string> {
    const response = await apiClient.get('/auth/microsoft');
    return response.data.data.authUrl;
  },
  
  /**
   * Handle Microsoft callback
   */
  async handleMicrosoftCallback(code: string, state?: string): Promise<any> {
    const response = await apiClient.post('/auth/microsoft', { code, state });
    
    const { user, tokens } = response.data.data;
    
    // Store tokens
    authToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    localStorage.setItem('authToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    
    // Initialize WebSocket
    initializeWebSocket();
    
    return user;
  },
  
  /**
   * Get current user profile
   */
  async getProfile(): Promise<any> {
    const response = await apiClient.get('/auth/profile');
    return response.data.data;
  },
  
  /**
   * Update user profile
   */
  async updateProfile(data: any): Promise<any> {
    const response = await apiClient.put('/auth/profile', data);
    return response.data.data;
  },
  
  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      authToken = null;
      refreshToken = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      disconnectWebSocket();
      window.location.href = '/login';
    }
  }
};

// Email APIs
export const emailAPI = {
  /**
   * Get emails
   */
  async getEmails(params?: {
    page?: number;
    limit?: number;
    folder?: string;
    search?: string;
    unread?: boolean;
  }): Promise<{ emails: Email[]; total: number }> {
    const response = await apiClient.get('/emails', { params });
    return response.data.data;
  },
  
  /**
   * Get email by ID
   */
  async getEmail(id: string): Promise<Email> {
    const response = await apiClient.get(`/emails/${id}`);
    return response.data.data;
  },
  
  /**
   * Mark email as read
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/emails/${id}/read`);
    
    // Notify via WebSocket
    if (socket) {
      socket.emit('mark_email_read', { emailId: id });
    }
  },
  
  /**
   * Mark email as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await apiClient.patch(`/emails/${id}/unread`);
  },
  
  /**
   * Delete email
   */
  async deleteEmail(id: string): Promise<void> {
    await apiClient.delete(`/emails/${id}`);
  },
  
  /**
   * Move email to folder
   */
  async moveToFolder(id: string, folder: string): Promise<void> {
    await apiClient.patch(`/emails/${id}/move`, { folder });
  },
  
  /**
   * Sync emails
   */
  async syncEmails(accountId?: string): Promise<any> {
    const response = await apiClient.post('/emails/sync', { accountId });
    
    // Notify via WebSocket
    if (socket) {
      socket.emit('request_sync', { accountId });
    }
    
    return response.data.data;
  }
};

// Email Analysis APIs
export const analysisAPI = {
  /**
   * Analyze email
   */
  async analyzeEmail(emailId: string): Promise<EmailAnalysis> {
    const response = await apiClient.post(`/analysis/email/${emailId}`);
    return response.data.data;
  },
  
  /**
   * Batch analyze emails
   */
  async batchAnalyze(emailIds: string[]): Promise<EmailAnalysis[]> {
    const response = await apiClient.post('/analysis/batch', { emailIds });
    return response.data.data;
  },
  
  /**
   * Get analysis by email ID
   */
  async getAnalysis(emailId: string): Promise<EmailAnalysis> {
    const response = await apiClient.get(`/analysis/email/${emailId}`);
    return response.data.data;
  }
};

// Filter Rules APIs
export const filterAPI = {
  /**
   * Get filter rules
   */
  async getFilterRules(): Promise<FilterRule[]> {
    const response = await apiClient.get('/filters');
    return response.data.data;
  },
  
  /**
   * Create filter rule
   */
  async createFilterRule(rule: Partial<FilterRule>): Promise<FilterRule> {
    const response = await apiClient.post('/filters', rule);
    return response.data.data;
  },
  
  /**
   * Update filter rule
   */
  async updateFilterRule(id: string, updates: Partial<FilterRule>): Promise<FilterRule> {
    const response = await apiClient.put(`/filters/${id}`, updates);
    return response.data.data;
  },
  
  /**
   * Delete filter rule
   */
  async deleteFilterRule(id: string): Promise<void> {
    await apiClient.delete(`/filters/${id}`);
  },
  
  /**
   * Execute filter rule
   */
  async executeFilter(id: string): Promise<any> {
    const response = await apiClient.post(`/filters/${id}/execute`);
    
    // Notify via WebSocket
    if (socket) {
      socket.emit('filter_execute', { filterId: id });
    }
    
    return response.data.data;
  },
  
  /**
   * Get smart filter suggestions
   */
  async getSmartSuggestions(): Promise<FilterRule[]> {
    const response = await apiClient.get('/filters/suggestions');
    return response.data.data;
  }
};

// Reports APIs
export const reportAPI = {
  /**
   * Get reports
   */
  async getReports(): Promise<Report[]> {
    const response = await apiClient.get('/reports');
    return response.data.data;
  },
  
  /**
   * Generate report
   */
  async generateReport(config: {
    type: string;
    format: string;
    dateRange?: { start: Date; end: Date };
    includeSections?: any;
  }): Promise<Report> {
    const response = await apiClient.post('/reports/generate', config);
    return response.data.data;
  },
  
  /**
   * Schedule report
   */
  async scheduleReport(config: any): Promise<string> {
    const response = await apiClient.post('/reports/schedule', config);
    return response.data.data.scheduleId;
  },
  
  /**
   * Download report
   */
  async downloadReport(id: string): Promise<Blob> {
    const response = await apiClient.get(`/reports/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },
  
  /**
   * Delete report
   */
  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/reports/${id}`);
  }
};

// Workflow APIs
export const workflowAPI = {
  /**
   * Get workflows
   */
  async getWorkflows(): Promise<Workflow[]> {
    const response = await apiClient.get('/workflows');
    return response.data.data;
  },
  
  /**
   * Create workflow
   */
  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.post('/workflows', workflow);
    return response.data.data;
  },
  
  /**
   * Update workflow
   */
  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.put(`/workflows/${id}`, updates);
    return response.data.data;
  },
  
  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    await apiClient.delete(`/workflows/${id}`);
  },
  
  /**
   * Test workflow
   */
  async testWorkflow(id: string): Promise<any> {
    const response = await apiClient.post(`/workflows/${id}/test`);
    return response.data.data;
  }
};

// Integration APIs
export const integrationAPI = {
  /**
   * Connect Trello
   */
  async connectTrello(config: {
    apiKey: string;
    apiToken: string;
    boardId?: string;
  }): Promise<any> {
    const response = await apiClient.post('/integrations/trello/connect', config);
    return response.data.data;
  },
  
  /**
   * Connect Jira
   */
  async connectJira(config: {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
  }): Promise<any> {
    const response = await apiClient.post('/integrations/jira/connect', config);
    return response.data.data;
  },
  
  /**
   * Create Trello card from email
   */
  async createTrelloCard(emailId: string, listId?: string): Promise<any> {
    const response = await apiClient.post('/integrations/trello/card', {
      emailId,
      listId
    });
    return response.data.data;
  },
  
  /**
   * Create Jira issue from email
   */
  async createJiraIssue(emailId: string, options?: any): Promise<any> {
    const response = await apiClient.post('/integrations/jira/issue', {
      emailId,
      ...options
    });
    return response.data.data;
  }
};

// Dashboard/Statistics APIs
export const statsAPI = {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/stats/dashboard');
    return response.data.data;
  },
  
  /**
   * Get email trends
   */
  async getEmailTrends(period: 'day' | 'week' | 'month'): Promise<any> {
    const response = await apiClient.get('/stats/trends', {
      params: { period }
    });
    return response.data.data;
  },
  
  /**
   * Get category distribution
   */
  async getCategoryDistribution(): Promise<any> {
    const response = await apiClient.get('/stats/categories');
    return response.data.data;
  }
};

// Email Account APIs
export const accountAPI = {
  /**
   * Get email accounts
   */
  async getAccounts(): Promise<EmailAccount[]> {
    const response = await apiClient.get('/accounts');
    return response.data.data;
  },
  
  /**
   * Add email account
   */
  async addAccount(provider: 'microsoft' | 'gmail'): Promise<string> {
    const response = await apiClient.post('/accounts/add', { provider });
    return response.data.data.authUrl;
  },
  
  /**
   * Remove email account
   */
  async removeAccount(id: string): Promise<void> {
    await apiClient.delete(`/accounts/${id}`);
  },
  
  /**
   * Set primary account
   */
  async setPrimaryAccount(id: string): Promise<void> {
    await apiClient.patch(`/accounts/${id}/primary`);
  }
};

// Export all APIs
export default {
  auth: authAPI,
  email: emailAPI,
  analysis: analysisAPI,
  filter: filterAPI,
  report: reportAPI,
  workflow: workflowAPI,
  integration: integrationAPI,
  stats: statsAPI,
  account: accountAPI,
  initializeWebSocket,
  disconnectWebSocket
};