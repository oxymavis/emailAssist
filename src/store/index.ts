import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// API基础配置
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';
import {
  Email,
  EmailAnalysis,
  FilterRule,
  Report,
  Workflow,
  UserSettings,
  DashboardStats,
  Notification,
  DashboardState,
  DashboardWidget,
  DashboardLayout,
  ChartFilter,
  TimeRange,
  DrillDownConfig,
  EmailVolumeData,
  SentimentData,
  CategoryData,
  PriorityHeatmapData,
  ResponseTimeData,
  TopSenderData,
  User,
  AuthState,
  AuthTokens
} from '@/types';

// 应用状态接口
interface AppState {
  // 用户认证状态
  auth: AuthState;
  user: User | null;

  // 主题和UI状态
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  loading: boolean;

  // 用户设置
  settings: UserSettings;
  
  // 邮件数据
  emails: Email[];
  selectedEmail: Email | null;
  emailAnalysis: Record<string, EmailAnalysis>;
  
  // 过滤规则
  filterRules: FilterRule[];
  
  // 报告数据
  reports: Report[];
  
  // 工作流
  workflows: Workflow[];
  
  // 仪表板统计
  dashboardStats: DashboardStats;
  
  // 通知
  notifications: Notification[];
  notificationCount: number;
  workflowStats: any;
  teamActivity: any;
  
  // 高级仪表板状态
  dashboardState: DashboardState;
  
  // 高级图表数据
  emailVolumeData: EmailVolumeData[];
  sentimentData: SentimentData[];
  categoryData: CategoryData[];
  priorityHeatmapData: PriorityHeatmapData[];
  responseTimeData: ResponseTimeData[];
  topSendersData: TopSenderData[];
  
  // 数据钻取配置
  drillDownConfig: DrillDownConfig | null;
  
  // 认证相关 Actions
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearAuth: () => void;
  refreshAuthToken: () => Promise<boolean>;
  checkAuthStatus: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  setAuthToken: (token: string | null) => void;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  
  // 设置相关actions
  updateSettings: (settings: Partial<UserSettings>) => void;
  
  // 邮件相关actions
  setEmails: (emails: Email[]) => void;
  addEmail: (email: Email) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  selectEmail: (email: Email | null) => void;
  setEmailAnalysis: (emailId: string, analysis: EmailAnalysis) => void;
  
  // 过滤规则actions
  setFilterRules: (rules: FilterRule[]) => void;
  addFilterRule: (rule: FilterRule) => void;
  updateFilterRule: (id: string, updates: Partial<FilterRule>) => void;
  deleteFilterRule: (id: string) => void;
  
  // 报告actions
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
  
  // 工作流actions
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  
  // 统计数据actions
  setDashboardStats: (stats: DashboardStats) => void;
  
  // 通知actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markNotificationAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setNotificationCount: (count: number) => void;
  updateWorkflowStats: (stats: any) => void;
  updateTeamActivity: (activity: any) => void;
  
  // 高级仪表板actions
  setDashboardState: (state: Partial<DashboardState>) => void;
  updateDashboardLayout: (layouts: DashboardLayout[]) => void;
  addDashboardWidget: (widget: DashboardWidget) => void;
  removeDashboardWidget: (widgetId: string) => void;
  updateDashboardWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  setDashboardEditMode: (editMode: boolean) => void;
  setGlobalFilters: (filters: ChartFilter[]) => void;
  setRefreshInterval: (interval: number) => void;
  
  // 图表数据actions
  setEmailVolumeData: (data: EmailVolumeData[]) => void;
  setSentimentData: (data: SentimentData[]) => void;
  setCategoryData: (data: CategoryData[]) => void;
  setPriorityHeatmapData: (data: PriorityHeatmapData[]) => void;
  setResponseTimeData: (data: ResponseTimeData[]) => void;
  setTopSendersData: (data: TopSenderData[]) => void;
  
  // 数据钻取actions
  setDrillDownConfig: (config: DrillDownConfig | null) => void;
  updateDrillDownConfig: (updates: Partial<DrillDownConfig>) => void;
}

// 默认设置
const defaultSettings: UserSettings = {
  id: 'default',
  userId: 'default',
  timezone: 'Asia/Shanghai',
  email: 'user@example.com',
  language: 'zh-CN',
  notifications: {
    email: true,
    push: true,
    frequency: 'hourly',
  },
  analysis: {
    autoAnalyze: true,
    analysisTypes: ['sentiment', 'urgency', 'category'],
    confidenceThreshold: 0.8,
  },
  display: {
    theme: 'light',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
  },
  integration: {
    microsoftGraph: {
      isConnected: false,
    },
    trello: {
      isConnected: false,
    },
    jira: {
      isConnected: false,
    },
  },
};

// 默认统计数据
const defaultStats: DashboardStats = {
  totalEmails: 0,
  unreadEmails: 0,
  processedToday: 0,
  avgResponseTime: 0,
  sentimentScore: 0,
  urgentEmails: 0,
  automationSavings: 0,
  lastSyncTime: new Date().toISOString(),
};

// 默认仪表板状态
const defaultDashboardState: DashboardState = {
  layouts: [],
  widgets: [],
  selectedWidget: null,
  isEditMode: false,
  customLayouts: {},
  globalFilters: [],
  refreshInterval: 300000, // 5分钟
  lastUpdate: new Date().toISOString(),
};

// 默认组件配置
const createDefaultWidgets = (): DashboardWidget[] => [
  {
    id: 'widget-email-volume',
    type: 'email-volume',
    title: 'Email Volume Analysis',
    description: 'Track email volume trends over time',
    config: {
      chartType: 'line',
      showLegend: true,
      showGrid: true,
      animate: true,
    },
    layout: {
      i: 'widget-email-volume',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      minW: 4,
      minH: 3,
    },
    isVisible: true,
    refreshInterval: 60000,
  },
  {
    id: 'widget-sentiment',
    type: 'sentiment-analysis',
    title: 'Sentiment Analysis',
    description: 'Distribution of email sentiment',
    config: {
      chartType: 'donut',
      showDetails: true,
      showTrends: true,
    },
    layout: {
      i: 'widget-sentiment',
      x: 6,
      y: 0,
      w: 3,
      h: 4,
      minW: 3,
      minH: 3,
    },
    isVisible: true,
    refreshInterval: 120000,
  },
  {
    id: 'widget-categories',
    type: 'category-distribution',
    title: 'Category Distribution',
    description: 'Email categorization statistics',
    config: {
      chartType: 'bar',
      showSubcategories: true,
      maxCategories: 10,
    },
    layout: {
      i: 'widget-categories',
      x: 9,
      y: 0,
      w: 3,
      h: 4,
      minW: 3,
      minH: 3,
    },
    isVisible: true,
    refreshInterval: 180000,
  },
  {
    id: 'widget-heatmap',
    type: 'priority-heatmap',
    title: 'Priority Heatmap',
    description: 'Email priority distribution by time',
    config: {
      colorScheme: ['intensity'],
      showLabels: true,
      showLegend: true,
    },
    layout: {
      i: 'widget-heatmap',
      x: 0,
      y: 4,
      w: 6,
      h: 3,
      minW: 4,
      minH: 2,
    },
    isVisible: true,
    refreshInterval: 300000,
  },
  {
    id: 'widget-response-time',
    type: 'response-time',
    title: 'Response Time Analysis',
    description: 'Email response time trends',
    config: {
      chartType: 'area',
      showTrends: true,
      showBenchmark: true,
      benchmarkValue: 2,
    },
    layout: {
      i: 'widget-response-time',
      x: 6,
      y: 4,
      w: 6,
      h: 4,
      minW: 4,
      minH: 3,
    },
    isVisible: true,
    refreshInterval: 120000,
  },
  {
    id: 'widget-top-senders',
    type: 'top-senders',
    title: 'Top Senders',
    description: 'Most active email senders',
    config: {
      viewMode: 'table',
      maxSenders: 10,
      showDetails: true,
    },
    layout: {
      i: 'widget-top-senders',
      x: 0,
      y: 7,
      w: 12,
      h: 4,
      minW: 6,
      minH: 3,
    },
    isVisible: true,
    refreshInterval: 240000,
  },
];

// 默认认证状态
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
  error: null,
};

// 创建store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 认证初始状态
      auth: defaultAuthState,
      user: null,

      // 初始状态
      theme: 'light',
      sidebarOpen: true,
      loading: false,
      settings: defaultSettings,
      emails: [],
      selectedEmail: null,
      emailAnalysis: {},
      filterRules: [],
      reports: [],
      workflows: [],
      dashboardStats: defaultStats,
      notifications: [],
      notificationCount: 0,
      workflowStats: null,
      teamActivity: null,
      
      // 高级仪表板状态
      dashboardState: {
        ...defaultDashboardState,
        widgets: createDefaultWidgets(),
        layouts: createDefaultWidgets().map(w => w.layout),
      },
      
      // 图表数据初始状态
      emailVolumeData: [],
      sentimentData: [],
      categoryData: [],
      priorityHeatmapData: [],
      responseTimeData: [],
      topSendersData: [],
      drillDownConfig: null,

      // 主题和UI actions
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setLoading: (loading) => set({ loading }),

      // 设置actions
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // 邮件actions
      setEmails: (emails) => set({ emails }),
      addEmail: (email) =>
        set((state) => ({
          emails: [email, ...state.emails],
        })),
      updateEmail: (id, updates) =>
        set((state) => ({
          emails: state.emails.map((email) =>
            email.id === id ? { ...email, ...updates } : email
          ),
        })),
      selectEmail: (email) => set({ selectedEmail: email }),
      setEmailAnalysis: (emailId, analysis) =>
        set((state) => ({
          emailAnalysis: {
            ...state.emailAnalysis,
            [emailId]: analysis,
          },
        })),

      // 过滤规则actions
      setFilterRules: (filterRules) => set({ filterRules }),
      addFilterRule: (rule) =>
        set((state) => ({
          filterRules: [...state.filterRules, rule],
        })),
      updateFilterRule: (id, updates) =>
        set((state) => ({
          filterRules: state.filterRules.map((rule) =>
            rule.id === id ? { ...rule, ...updates } : rule
          ),
        })),
      deleteFilterRule: (id) =>
        set((state) => ({
          filterRules: state.filterRules.filter((rule) => rule.id !== id),
        })),

      // 报告actions
      setReports: (reports) => set({ reports }),
      addReport: (report) =>
        set((state) => ({
          reports: [report, ...state.reports],
        })),

      // 工作流actions
      setWorkflows: (workflows) => set({ workflows }),
      addWorkflow: (workflow) =>
        set((state) => ({
          workflows: [...state.workflows, workflow],
        })),
      updateWorkflow: (id, updates) =>
        set((state) => ({
          workflows: state.workflows.map((workflow) =>
            workflow.id === id ? { ...workflow, ...updates } : workflow
          ),
        })),
      deleteWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((workflow) => workflow.id !== id),
        })),

      // 统计数据actions
      setDashboardStats: (stats) => set({ dashboardStats: stats }),

      // 通知actions
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: `notification-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString(),
              isRead: false,
            },
            ...state.notifications,
          ],
        })),
      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, isRead: true } : notification
          ),
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((notification) => notification.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
      setNotificationCount: (count) => set({ notificationCount: count }),
      updateWorkflowStats: (stats) => set({ workflowStats: stats }),
      updateTeamActivity: (activity) => set({ teamActivity: activity }),

      // 高级仪表板actions
      setDashboardState: (updates) =>
        set((state) => ({
          dashboardState: { ...state.dashboardState, ...updates },
        })),

      updateDashboardLayout: (layouts) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            layouts,
            lastUpdate: new Date().toISOString(),
          },
        })),

      addDashboardWidget: (widget) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            widgets: [...state.dashboardState.widgets, widget],
            layouts: [...state.dashboardState.layouts, widget.layout],
            lastUpdate: new Date().toISOString(),
          },
        })),

      removeDashboardWidget: (widgetId) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            widgets: state.dashboardState.widgets.filter(w => w.id !== widgetId),
            layouts: state.dashboardState.layouts.filter(l => l.i !== widgetId),
            selectedWidget: state.dashboardState.selectedWidget === widgetId 
              ? null 
              : state.dashboardState.selectedWidget,
            lastUpdate: new Date().toISOString(),
          },
        })),

      updateDashboardWidget: (widgetId, updates) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            widgets: state.dashboardState.widgets.map(widget =>
              widget.id === widgetId ? { ...widget, ...updates } : widget
            ),
            lastUpdate: new Date().toISOString(),
          },
        })),

      setDashboardEditMode: (editMode) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            isEditMode: editMode,
            selectedWidget: editMode ? state.dashboardState.selectedWidget : null,
          },
        })),

      setGlobalFilters: (filters) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            globalFilters: filters,
            lastUpdate: new Date().toISOString(),
          },
        })),

      setRefreshInterval: (interval) =>
        set((state) => ({
          dashboardState: {
            ...state.dashboardState,
            refreshInterval: interval,
          },
        })),

      // 图表数据actions
      setEmailVolumeData: (emailVolumeData) => set({ emailVolumeData }),
      setSentimentData: (sentimentData) => set({ sentimentData }),
      setCategoryData: (categoryData) => set({ categoryData }),
      setPriorityHeatmapData: (priorityHeatmapData) => set({ priorityHeatmapData }),
      setResponseTimeData: (responseTimeData) => set({ responseTimeData }),
      setTopSendersData: (topSendersData) => set({ topSendersData }),

      // 数据钻取actions
      setDrillDownConfig: (drillDownConfig) => set({ drillDownConfig }),
      updateDrillDownConfig: (updates) =>
        set((state) => ({
          drillDownConfig: state.drillDownConfig
            ? { ...state.drillDownConfig, ...updates }
            : null,
        })),

      // 认证actions
      login: (user: User, tokens: AuthTokens) => {
        // 保存token到localStorage
        localStorage.setItem('authToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('tokenExpiry', (Date.now() + tokens.expiresIn * 1000).toString());

        set((state) => ({
          auth: {
            ...state.auth,
            isAuthenticated: true,
            isLoading: false,
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiry: Date.now() + tokens.expiresIn * 1000,
            error: null,
          },
        }));
      },

      logout: () => {
        // 清除localStorage中的token
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');

        set((state) => ({
          auth: defaultAuthState,
          // 清除用户相关数据
          emails: [],
          selectedEmail: null,
          emailAnalysis: {},
          reports: [],
          workflows: [],
          dashboardStats: defaultStats,
        }));
      },

      setAuthLoading: (loading: boolean) =>
        set((state) => ({
          auth: { ...state.auth, isLoading: loading },
        })),

      setAuthError: (error: string | null) =>
        set((state) => ({
          auth: { ...state.auth, error, isLoading: false },
        })),

      updateUser: (updates: Partial<User>) =>
        set((state) => ({
          auth: {
            ...state.auth,
            user: state.auth.user ? { ...state.auth.user, ...updates } : null,
          },
        })),

      clearAuth: () =>
        set((state) => ({
          auth: defaultAuthState,
        })),

      refreshAuthToken: async () => {
        const state = get();
        const { refreshToken } = state.auth;

        if (!refreshToken) {
          return false;
        }

        try {
          // 调用refresh token API
          const response = await fetch(`${API_BASE_URL}/auth/microsoft/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const { data } = await response.json();
          const { tokens } = data;

          // 更新token
          localStorage.setItem('authToken', tokens.accessToken);
          localStorage.setItem('tokenExpiry', (Date.now() + tokens.expiresIn * 1000).toString());

          set((prevState) => ({
            auth: {
              ...prevState.auth,
              accessToken: tokens.accessToken,
              tokenExpiry: Date.now() + tokens.expiresIn * 1000,
            },
          }));

          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          // 刷新失败，清除认证状态
          get().logout();
          return false;
        }
      },

      checkAuthStatus: async () => {
        const state = get();
        const token = localStorage.getItem('authToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');

        if (!token || !tokenExpiry) {
          return false;
        }

        const expiryTime = parseInt(tokenExpiry);
        const now = Date.now();

        // 如果token即将过期（提前5分钟刷新）
        if (expiryTime - now < 5 * 60 * 1000) {
          const refreshSuccess = await get().refreshAuthToken();
          if (!refreshSuccess) {
            return false;
          }
        }

        // 如果还没有用户信息，获取用户信息
        if (!state.auth.user && state.auth.isAuthenticated) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/user`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const { data } = await response.json();
              set((prevState) => ({
                auth: {
                  ...prevState.auth,
                  user: data.user,
                  isAuthenticated: true,
                },
              }));
            }
          } catch (error) {
            console.error('Failed to fetch user info:', error);
          }
        }

        return true;
      },

      setUser: (user: User | null) =>
        set((state) => ({
          auth: {
            ...state.auth,
            user,
            isAuthenticated: !!user,
          },
        })),

      setAuthToken: (token: string | null) => {
        if (token) {
          localStorage.setItem('authToken', token);
        } else {
          localStorage.removeItem('authToken');
        }

        set((state) => ({
          auth: {
            ...state.auth,
            accessToken: token,
            isAuthenticated: !!token,
          },
        }));
      },
    }),
    {
      name: 'email-assist-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        settings: state.settings,
        filterRules: state.filterRules,
        workflows: state.workflows,
      }),
    }
  )
);

// 选择器hooks
export const useTheme = () => useAppStore((state) => state.theme);
export const useSidebar = () => useAppStore((state) => ({
  isOpen: state.sidebarOpen,
  toggle: state.toggleSidebar,
}));
export const useLoading = () => useAppStore((state) => ({
  loading: state.loading,
  setLoading: state.setLoading,
}));

export const useSettings = () => useAppStore((state) => ({
  settings: state.settings,
  updateSettings: state.updateSettings,
}));

export const useEmails = () => useAppStore((state) => ({
  emails: state.emails,
  selectedEmail: state.selectedEmail,
  emailAnalysis: state.emailAnalysis,
  setEmails: state.setEmails,
  addEmail: state.addEmail,
  updateEmail: state.updateEmail,
  selectEmail: state.selectEmail,
  setEmailAnalysis: state.setEmailAnalysis,
}));

export const useFilterRules = () => useAppStore((state) => ({
  filterRules: state.filterRules,
  setFilterRules: state.setFilterRules,
  addFilterRule: state.addFilterRule,
  updateFilterRule: state.updateFilterRule,
  deleteFilterRule: state.deleteFilterRule,
}));

export const useReports = () => useAppStore((state) => ({
  reports: state.reports,
  setReports: state.setReports,
  addReport: state.addReport,
}));

export const useWorkflows = () => useAppStore((state) => ({
  workflows: state.workflows,
  setWorkflows: state.setWorkflows,
  addWorkflow: state.addWorkflow,
  updateWorkflow: state.updateWorkflow,
  deleteWorkflow: state.deleteWorkflow,
}));

export const useDashboardStats = () => useAppStore((state) => ({
  stats: state.dashboardStats,
  setStats: state.setDashboardStats,
}));

export const useNotifications = () => useAppStore((state) => ({
  notifications: state.notifications,
  addNotification: state.addNotification,
  markAsRead: state.markNotificationAsRead,
  remove: state.removeNotification,
  clear: state.clearNotifications,
}));

// 高级仪表板hooks
export const useDashboardState = () => useAppStore((state) => ({
  dashboardState: state.dashboardState,
  setDashboardState: state.setDashboardState,
  updateDashboardLayout: state.updateDashboardLayout,
  addWidget: state.addDashboardWidget,
  removeWidget: state.removeDashboardWidget,
  updateWidget: state.updateDashboardWidget,
  setEditMode: state.setDashboardEditMode,
  setGlobalFilters: state.setGlobalFilters,
  setRefreshInterval: state.setRefreshInterval,
}));

export const useDashboardWidgets = () => useAppStore((state) => ({
  widgets: state.dashboardState.widgets,
  layouts: state.dashboardState.layouts,
  selectedWidget: state.dashboardState.selectedWidget,
  isEditMode: state.dashboardState.isEditMode,
  addWidget: state.addDashboardWidget,
  removeWidget: state.removeDashboardWidget,
  updateWidget: state.updateDashboardWidget,
  updateLayout: state.updateDashboardLayout,
}));

export const useDashboardFilters = () => useAppStore((state) => ({
  globalFilters: state.dashboardState.globalFilters,
  refreshInterval: state.dashboardState.refreshInterval,
  setGlobalFilters: state.setGlobalFilters,
  setRefreshInterval: state.setRefreshInterval,
}));

// 图表数据hooks
export const useChartData = () => useAppStore((state) => ({
  emailVolumeData: state.emailVolumeData,
  sentimentData: state.sentimentData,
  categoryData: state.categoryData,
  priorityHeatmapData: state.priorityHeatmapData,
  responseTimeData: state.responseTimeData,
  topSendersData: state.topSendersData,
  setEmailVolumeData: state.setEmailVolumeData,
  setSentimentData: state.setSentimentData,
  setCategoryData: state.setCategoryData,
  setPriorityHeatmapData: state.setPriorityHeatmapData,
  setResponseTimeData: state.setResponseTimeData,
  setTopSendersData: state.setTopSendersData,
}));

export const useDrillDown = () => useAppStore((state) => ({
  drillDownConfig: state.drillDownConfig,
  setDrillDownConfig: state.setDrillDownConfig,
  updateDrillDownConfig: state.updateDrillDownConfig,
}));

// 认证相关hooks
export const useAuth = () => useAppStore((state) => ({
  auth: state.auth,
  login: state.login,
  logout: state.logout,
  setAuthLoading: state.setAuthLoading,
  setAuthError: state.setAuthError,
  updateUser: state.updateUser,
  clearAuth: state.clearAuth,
  refreshAuthToken: state.refreshAuthToken,
  checkAuthStatus: state.checkAuthStatus,
}));

export const useAuthState = () => useAppStore((state) => state.auth);

export const useUser = () => useAppStore((state) => state.auth.user);