// 邮件相关类型定义
export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: 'outlook' | 'gmail' | 'exchange' | 'imap';
  isActive: boolean;
  isPrimary: boolean;
  lastSyncAt?: string;
  settings: {
    server: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
    sound: boolean;
  };
  email: {
    autoMarkAsRead: boolean;
    autoArchive: boolean;
    smartFilters: boolean;
    aiAnalysis: boolean;
  };
  privacy: {
    dataRetention: number;
    analytics: boolean;
    crashReporting: boolean;
  };
  updatedAt: string;
}

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

// 高级图表类型定义
export interface AdvancedChartProps {
  data: any[];
  height?: number;
  interactive?: boolean;
  onDataClick?: (data: any) => void;
  filters?: ChartFilter[];
  timeRange?: TimeRange;
}

export interface ChartFilter {
  field: string;
  value: string | number | string[];
  operator: 'equals' | 'in' | 'range' | 'contains';
}

export interface TimeRange {
  startDate: string;
  endDate: string;
  preset?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

// 邮件量趋势数据
export interface EmailVolumeData {
  date: string;
  total: number;
  received: number;
  sent: number;
  unread: number;
  processed: number;
}

// 情感分析数据
export interface SentimentData {
  sentiment: 'positive' | 'neutral' | 'negative';
  count: number;
  percentage: number;
  trend: number;
  color: string;
}

// 分类分布数据
export interface CategoryData {
  name: string;
  count: number;
  percentage: number;
  color: string;
  subcategories?: CategoryData[];
}

// 优先级热力图数据
export interface PriorityHeatmapData {
  hour: number;
  day: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  count: number;
  intensity: number;
}

// 响应时间数据
export interface ResponseTimeData {
  timeRange: string;
  avgResponse: number;
  medianResponse: number;
  count: number;
  trend: number;
}

// 主要发件人数据
export interface TopSenderData {
  name: string;
  email: string;
  count: number;
  avgResponseTime: number;
  sentimentScore: number;
  urgencyDistribution: Record<string, number>;
}

// 仪表板布局配置
export interface DashboardLayout {
  i: string; // 组件ID
  x: number; // x坐标
  y: number; // y坐标
  w: number; // 宽度
  h: number; // 高度
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'email-volume' | 'sentiment-analysis' | 'category-distribution' | 
        'priority-heatmap' | 'response-time' | 'top-senders' | 'stats-card';
  title: string;
  description: string;
  config: WidgetConfig;
  layout: DashboardLayout;
  isVisible: boolean;
  refreshInterval?: number;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'heatmap' | 'area';
  timeRange?: TimeRange;
  filters?: ChartFilter[];
  colorScheme?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  [key: string]: any;
}

// 仪表板状态管理
export interface DashboardState {
  layouts: DashboardLayout[];
  widgets: DashboardWidget[];
  selectedWidget: string | null;
  isEditMode: boolean;
  customLayouts: Record<string, DashboardLayout[]>;
  globalFilters: ChartFilter[];
  refreshInterval: number;
  lastUpdate: string;
}

// 数据钻取配置
export interface DrillDownConfig {
  enabled: boolean;
  levels: DrillDownLevel[];
  currentLevel: number;
  breadcrumbs: string[];
}

export interface DrillDownLevel {
  field: string;
  label: string;
  chartType?: string;
  filters?: ChartFilter[];
}

// WebSocket 实时数据类型
export interface RealtimeUpdate {
  type: 'email-received' | 'analysis-complete' | 'stats-update';
  timestamp: string;
  data: any;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  isConnected: boolean;
}

// 导出数据类型
export interface ExportConfig {
  format: 'csv' | 'xlsx' | 'pdf' | 'png' | 'svg';
  filename?: string;
  dateRange?: TimeRange;
  includeCharts?: boolean;
  includeSummary?: boolean;
}

// 用户认证相关类型
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tenantId?: string;
  roles: string[];
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  timezone: string;
  emailSyncEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  error: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface MicrosoftAuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: any;
}