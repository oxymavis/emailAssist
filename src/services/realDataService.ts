import axios from 'axios';

// 真实API服务配置
const REAL_API_BASE_URL = 'http://localhost:3001/api';

// 创建专用的axios实例
const realApiClient = axios.create({
  baseURL: REAL_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
realApiClient.interceptors.request.use(
  (config) => {
    console.log(`Making API request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
realApiClient.interceptors.response.use(
  (response) => {
    console.log(`API response from: ${response.config.url}`, response.data);
    return response.data;
  },
  (error) => {
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// ===== 真实数据服务 =====
export class RealDataService {
  // 健康检查
  static async healthCheck() {
    try {
      const response = await axios.get('http://localhost:3001/health');
      console.log('API Health Check:', response.data);
      return response.data;
    } catch (error) {
      console.error('API Health Check failed:', error);
      throw new Error('API服务不可用');
    }
  }

  // ===== 仪表板数据 =====
  static async getDashboardStats() {
    try {
      return await realApiClient.get('/stats/dashboard');
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      // 返回备用数据
      return {
        totalEmails: 0,
        unreadEmails: 0,
        todayEmails: 0,
        importantEmails: 0,
        processedEmails: 0,
        efficiency: 0,
        avgResponseTime: 0,
        aiAccuracy: 0
      };
    }
  }

  static async getRecentEmails() {
    try {
      return await realApiClient.get('/emails');
    } catch (error) {
      console.error('Failed to get recent emails:', error);
      return [];
    }
  }

  static async getEmailVolume() {
    try {
      return await realApiClient.get('/dashboard/email-volume');
    } catch (error) {
      console.error('Failed to get email volume:', error);
      return [];
    }
  }

  // ===== 分析数据 =====
  static async getSentimentData() {
    try {
      return await realApiClient.get('/analysis/sentiment');
    } catch (error) {
      console.error('Failed to get sentiment data:', error);
      return [];
    }
  }

  static async getCategories() {
    try {
      return await realApiClient.get('/analysis/categories');
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [];
    }
  }

  static async getAISuggestions() {
    try {
      return await realApiClient.get('/analysis/ai-suggestions');
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      return [];
    }
  }

  // ===== 邮件数据 =====
  static async getEmails(folder = 'inbox', page = 1, limit = 20) {
    try {
      return await realApiClient.get('/emails', {
        params: { folder, page, limit }
      });
    } catch (error) {
      console.error('Failed to get emails:', error);
      return {
        emails: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false
      };
    }
  }

  // ===== 过滤规则数据 =====
  static async getFilters() {
    try {
      return await realApiClient.get('/filters');
    } catch (error) {
      console.error('Failed to get filters:', error);
      return [];
    }
  }

  static async createFilter(filter: any) {
    try {
      return await realApiClient.post('/filters', filter);
    } catch (error) {
      console.error('Failed to create filter:', error);
      throw error;
    }
  }

  static async updateFilter(id: string, filter: any) {
    try {
      return await realApiClient.put(`/filters/${id}`, filter);
    } catch (error) {
      console.error('Failed to update filter:', error);
      throw error;
    }
  }

  static async deleteFilter(id: string) {
    try {
      return await realApiClient.delete(`/filters/${id}`);
    } catch (error) {
      console.error('Failed to delete filter:', error);
      throw error;
    }
  }

  // ===== 报告数据 =====
  static async getEmailVolumeReport() {
    try {
      return await realApiClient.get('/reports/email-volume');
    } catch (error) {
      console.error('Failed to get email volume report:', error);
      return [];
    }
  }

  static async getEfficiencyReport() {
    try {
      return await realApiClient.get('/reports/efficiency');
    } catch (error) {
      console.error('Failed to get efficiency report:', error);
      return [];
    }
  }

  // ===== 工作流数据 =====
  static async getWorkflows() {
    try {
      return await realApiClient.get('/workflows');
    } catch (error) {
      console.error('Failed to get workflows:', error);
      return [];
    }
  }

  static async createWorkflow(workflow: any) {
    try {
      return await realApiClient.post('/workflows', workflow);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      throw error;
    }
  }

  static async updateWorkflow(id: string, workflow: any) {
    try {
      return await realApiClient.put(`/workflows/${id}`, workflow);
    } catch (error) {
      console.error('Failed to update workflow:', error);
      throw error;
    }
  }

  static async deleteWorkflow(id: string) {
    try {
      return await realApiClient.delete(`/workflows/${id}`);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      throw error;
    }
  }

  // ===== 设置数据 =====
  static async getUserSettings() {
    try {
      return await realApiClient.get('/settings/user');
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return {};
    }
  }

  static async updateUserSettings(settings: any) {
    try {
      return await realApiClient.put('/settings/user', settings);
    } catch (error) {
      console.error('Failed to update user settings:', error);
      throw error;
    }
  }

  static async getEmailAccounts() {
    try {
      return await realApiClient.get('/settings/accounts');
    } catch (error) {
      console.error('Failed to get email accounts:', error);
      return [];
    }
  }
}

// 测试API连接
export const testApiConnection = async () => {
  try {
    const health = await RealDataService.healthCheck();
    console.log('✅ API连接测试成功:', health);
    return true;
  } catch (error) {
    console.error('❌ API连接测试失败:', error);
    return false;
  }
};

export default RealDataService;