import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Email, EmailAnalysis, FilterRule, Report, Workflow, UserSettings, DashboardStats, Notification } from '@/types';

// 应用状态接口
interface AppState {
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
}

// 默认设置
const defaultSettings: UserSettings = {
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

// 创建store
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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