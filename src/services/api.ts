import axios from 'axios';
import { Email, EmailAnalysis, FilterRule, Report, Workflow, ApiResponse, PaginatedResponse, DashboardStats } from '@/types';

// API基础配置
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 添加认证token
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 邮件API
export const emailApi = {
  // 获取邮件列表
  getEmails: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    unreadOnly?: boolean;
  }): Promise<PaginatedResponse<Email>> => {
    return apiClient.get('/emails', { params });
  },

  // 获取单个邮件
  getEmail: async (id: string): Promise<ApiResponse<Email>> => {
    return apiClient.get(`/emails/${id}`);
  },

  // 标记邮件为已读
  markAsRead: async (id: string): Promise<ApiResponse> => {
    return apiClient.patch(`/emails/${id}/read`);
  },

  // 批量操作邮件
  bulkOperation: async (operation: {
    action: 'read' | 'unread' | 'delete' | 'archive';
    emailIds: string[];
  }): Promise<ApiResponse> => {
    return apiClient.post('/emails/bulk', operation);
  },

  // 同步邮件
  syncEmails: async (): Promise<ApiResponse<{ syncedCount: number }>> => {
    return apiClient.post('/emails/sync');
  },
};

// AI分析API
export const analysisApi = {
  // 分析单个邮件
  analyzeEmail: async (emailId: string): Promise<ApiResponse<EmailAnalysis>> => {
    return apiClient.post(`/analysis/email/${emailId}`);
  },

  // 批量分析邮件
  batchAnalyze: async (emailIds: string[]): Promise<ApiResponse<EmailAnalysis[]>> => {
    return apiClient.post('/analysis/batch', { emailIds });
  },

  // 获取分析结果
  getAnalysis: async (emailId: string): Promise<ApiResponse<EmailAnalysis>> => {
    return apiClient.get(`/analysis/email/${emailId}`);
  },

  // 重新分析邮件
  reAnalyzeEmail: async (emailId: string): Promise<ApiResponse<EmailAnalysis>> => {
    return apiClient.post(`/analysis/email/${emailId}/reanalyze`);
  },
};

// 过滤规则API
export const filterApi = {
  // 获取过滤规则列表
  getFilterRules: async (): Promise<ApiResponse<FilterRule[]>> => {
    return apiClient.get('/filters');
  },

  // 创建过滤规则
  createFilterRule: async (rule: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<FilterRule>> => {
    return apiClient.post('/filters', rule);
  },

  // 更新过滤规则
  updateFilterRule: async (id: string, updates: Partial<FilterRule>): Promise<ApiResponse<FilterRule>> => {
    return apiClient.patch(`/filters/${id}`, updates);
  },

  // 删除过滤规则
  deleteFilterRule: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/filters/${id}`);
  },

  // 测试过滤规则
  testFilterRule: async (rule: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ matchedEmails: Email[] }>> => {
    return apiClient.post('/filters/test', rule);
  },

  // 应用过滤规则
  applyFilterRule: async (id: string): Promise<ApiResponse<{ processedCount: number }>> => {
    return apiClient.post(`/filters/${id}/apply`);
  },
};

// 报告API
export const reportApi = {
  // 获取报告列表
  getReports: async (): Promise<ApiResponse<Report[]>> => {
    return apiClient.get('/reports');
  },

  // 生成报告
  generateReport: async (config: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<Report>> => {
    return apiClient.post('/reports/generate', config);
  },

  // 获取单个报告
  getReport: async (id: string): Promise<ApiResponse<Report>> => {
    return apiClient.get(`/reports/${id}`);
  },

  // 删除报告
  deleteReport: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/reports/${id}`);
  },

  // 导出报告
  exportReport: async (id: string, format: 'pdf' | 'excel'): Promise<Blob> => {
    const response = await apiClient.get(`/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },
};

// 工作流API
export const workflowApi = {
  // 获取工作流列表
  getWorkflows: async (): Promise<ApiResponse<Workflow[]>> => {
    return apiClient.get('/workflows');
  },

  // 创建工作流
  createWorkflow: async (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Workflow>> => {
    return apiClient.post('/workflows', workflow);
  },

  // 更新工作流
  updateWorkflow: async (id: string, updates: Partial<Workflow>): Promise<ApiResponse<Workflow>> => {
    return apiClient.patch(`/workflows/${id}`, updates);
  },

  // 删除工作流
  deleteWorkflow: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/workflows/${id}`);
  },

  // 测试工作流连接
  testWorkflowConnection: async (config: Workflow['configuration']): Promise<ApiResponse<{ connected: boolean; message: string }>> => {
    return apiClient.post('/workflows/test-connection', config);
  },

  // 执行工作流
  executeWorkflow: async (id: string, emailId: string): Promise<ApiResponse<{ success: boolean; output: any }>> => {
    return apiClient.post(`/workflows/${id}/execute`, { emailId });
  },
};

// 统计API
export const statsApi = {
  // 获取仪表板统计数据
  getDashboardStats: async (): Promise<ApiResponse<DashboardStats>> => {
    return apiClient.get('/stats/dashboard');
  },

  // 获取趋势数据
  getTrendData: async (period: 'week' | 'month' | 'quarter'): Promise<ApiResponse<any[]>> => {
    return apiClient.get('/stats/trends', { params: { period } });
  },

  // 获取分类统计
  getCategoryStats: async (): Promise<ApiResponse<any[]>> => {
    return apiClient.get('/stats/categories');
  },

  // 获取情感分析统计
  getSentimentStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/stats/sentiment');
  },

  // 获取响应时间统计
  getResponseTimeStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/stats/response-time');
  },
};

// Microsoft Graph API集成
export const graphApi = {
  // 获取认证URL
  getAuthUrl: async (): Promise<ApiResponse<{ authUrl: string }>> => {
    return apiClient.get('/graph/auth-url');
  },

  // 处理认证回调
  handleAuthCallback: async (code: string): Promise<ApiResponse<{ success: boolean; user: any }>> => {
    return apiClient.post('/graph/auth-callback', { code });
  },

  // 获取用户信息
  getUserInfo: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/graph/user');
  },

  // 断开连接
  disconnect: async (): Promise<ApiResponse> => {
    return apiClient.post('/graph/disconnect');
  },

  // 手动同步
  manualSync: async (): Promise<ApiResponse<{ syncedCount: number }>> => {
    return apiClient.post('/graph/sync');
  },
};

// 设置API
export const settingsApi = {
  // 获取用户设置
  getSettings: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/settings');
  },

  // 更新用户设置
  updateSettings: async (settings: any): Promise<ApiResponse<any>> => {
    return apiClient.patch('/settings', settings);
  },

  // 重置设置
  resetSettings: async (): Promise<ApiResponse> => {
    return apiClient.post('/settings/reset');
  },
};

export default {
  emailApi,
  analysisApi,
  filterApi,
  reportApi,
  workflowApi,
  statsApi,
  graphApi,
  settingsApi,
};