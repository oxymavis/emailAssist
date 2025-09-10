// 邮件相关类型定义
export interface Email {
  id: string;
  subject: string;
  sender: {
    name: string;
    email: string;
  };
  recipient: {
    name: string;
    email: string;
  };
  content: string;
  receivedDateTime: string;
  isRead: boolean;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;
  categories: string[];
  conversationId: string;
}

// AI分析结果类型
export interface EmailAnalysis {
  id: string;
  emailId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  keyTopics: string[];
  summary: string;
  actionRequired: boolean;
  suggestedResponse?: string;
  confidence: number;
  processedAt: string;
}

// 过滤规则类型
export interface FilterRule {
  id: string;
  name: string;
  description: string;
  conditions: FilterCondition[];
  actions: FilterAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  priority: number;
}

export interface FilterCondition {
  field: 'sender' | 'subject' | 'content' | 'importance' | 'hasAttachments';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches';
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

export interface FilterAction {
  type: 'move' | 'label' | 'forward' | 'delete' | 'markAsRead' | 'markAsImportant';
  value?: string;
}

// 报告类型
export interface Report {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  data: ReportData;
  status: 'generating' | 'completed' | 'failed';
}

export interface ReportData {
  totalEmails: number;
  processedEmails: number;
  sentimentAnalysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
  urgencyDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  topCategories: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  responseTime: {
    average: number;
    median: number;
  };
  trends: Array<{
    date: string;
    count: number;
  }>;
}

// 工作流类型
export interface Workflow {
  id: string;
  name: string;
  description: string;
  type: 'trello' | 'jira' | 'custom';
  configuration: WorkflowConfiguration;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowConfiguration {
  apiKey?: string;
  boardId?: string;
  projectKey?: string;
  mappings: {
    urgency: Record<string, string>;
    category: Record<string, string>;
  };
  template: string;
}

// 工作流输出类型
export interface WorkflowOutput {
  id: string;
  workflowId: string;
  emailId: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
  error?: string;
}

// 用户设置类型
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'hourly' | 'daily';
  };
  analysis: {
    autoAnalyze: boolean;
    analysisTypes: string[];
    confidenceThreshold: number;
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh-CN' | 'en-US';
    timezone: string;
  };
  integration: {
    microsoftGraph: {
      isConnected: boolean;
      tenantId?: string;
      lastSync?: string;
    };
    trello: {
      isConnected: boolean;
      apiKey?: string;
    };
    jira: {
      isConnected: boolean;
      serverUrl?: string;
      username?: string;
    };
  };
}

// 统计数据类型
export interface DashboardStats {
  totalEmails: number;
  unreadEmails: number;
  processedToday: number;
  avgResponseTime: number;
  sentimentScore: number;
  urgentEmails: number;
  automationSavings: number;
  lastSyncTime: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页类型
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// 图表数据类型
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

// 通知类型
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  isRead?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// 主题类型
export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}