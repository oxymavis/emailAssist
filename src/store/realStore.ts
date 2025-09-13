/**
 * Real Store using Zustand
 * Manages application state with real backend integration
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import realAPI from '@/services/realApi';
import { 
  Email, 
  EmailAccount, 
  FilterRule, 
  Report, 
  Workflow,
  DashboardStats,
  EmailAnalysis,
  User,
  Settings 
} from '@/types';

interface RealStore {
  // User & Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Emails
  emails: Email[];
  selectedEmail: Email | null;
  emailsLoading: boolean;
  totalEmails: number;
  unreadCount: number;
  
  // Email Accounts
  emailAccounts: EmailAccount[];
  primaryAccount: EmailAccount | null;
  
  // Analysis
  analyses: Map<string, EmailAnalysis>;
  analysisLoading: boolean;
  
  // Filter Rules
  filterRules: FilterRule[];
  activeFilters: string[];
  
  // Reports
  reports: Report[];
  generatingReport: boolean;
  
  // Workflows
  workflows: Workflow[];
  
  // Dashboard Stats
  dashboardStats: DashboardStats | null;
  statsLoading: boolean;
  
  // Notifications
  notifications: any[];
  unreadNotifications: number;
  
  // Settings
  settings: Settings;
  
  // Actions
  actions: {
    // Auth
    login: () => Promise<string>;
    handleAuthCallback: (code: string, state?: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: Partial<User>) => Promise<void>;
    
    // Emails
    fetchEmails: (params?: any) => Promise<void>;
    fetchEmail: (id: string) => Promise<void>;
    markEmailAsRead: (id: string) => Promise<void>;
    markEmailAsUnread: (id: string) => Promise<void>;
    deleteEmail: (id: string) => Promise<void>;
    moveEmail: (id: string, folder: string) => Promise<void>;
    syncEmails: (accountId?: string) => Promise<void>;
    selectEmail: (email: Email | null) => void;
    
    // Analysis
    analyzeEmail: (emailId: string) => Promise<void>;
    batchAnalyzeEmails: (emailIds: string[]) => Promise<void>;
    
    // Filter Rules
    fetchFilterRules: () => Promise<void>;
    createFilterRule: (rule: Partial<FilterRule>) => Promise<void>;
    updateFilterRule: (id: string, updates: Partial<FilterRule>) => Promise<void>;
    deleteFilterRule: (id: string) => Promise<void>;
    executeFilter: (id: string) => Promise<void>;
    fetchSmartSuggestions: () => Promise<void>;
    
    // Reports
    fetchReports: () => Promise<void>;
    generateReport: (config: any) => Promise<void>;
    scheduleReport: (config: any) => Promise<void>;
    downloadReport: (id: string) => Promise<void>;
    deleteReport: (id: string) => Promise<void>;
    
    // Workflows
    fetchWorkflows: () => Promise<void>;
    createWorkflow: (workflow: Partial<Workflow>) => Promise<void>;
    updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
    deleteWorkflow: (id: string) => Promise<void>;
    testWorkflow: (id: string) => Promise<void>;
    
    // Email Accounts
    fetchAccounts: () => Promise<void>;
    addAccount: (provider: 'microsoft' | 'gmail') => Promise<string>;
    removeAccount: (id: string) => Promise<void>;
    setPrimaryAccount: (id: string) => Promise<void>;
    
    // Dashboard
    fetchDashboardStats: () => Promise<void>;
    fetchEmailTrends: (period: 'day' | 'week' | 'month') => Promise<any>;
    
    // Integrations
    connectTrello: (config: any) => Promise<void>;
    connectJira: (config: any) => Promise<void>;
    createTrelloCard: (emailId: string, listId?: string) => Promise<void>;
    createJiraIssue: (emailId: string, options?: any) => Promise<void>;
    
    // Notifications
    addNotification: (notification: any) => void;
    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;
    
    // Settings
    updateSettings: (settings: Partial<Settings>) => Promise<void>;
    
    // WebSocket
    initializeWebSocket: () => void;
    disconnectWebSocket: () => void;
  };
}

const useRealStore = create<RealStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        emails: [],
        selectedEmail: null,
        emailsLoading: false,
        totalEmails: 0,
        unreadCount: 0,
        emailAccounts: [],
        primaryAccount: null,
        analyses: new Map(),
        analysisLoading: false,
        filterRules: [],
        activeFilters: [],
        reports: [],
        generatingReport: false,
        workflows: [],
        dashboardStats: null,
        statsLoading: false,
        notifications: [],
        unreadNotifications: 0,
        settings: {
          language: 'zh-CN',
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            frequency: 'immediate'
          }
        } as Settings,
        
        actions: {
          // Auth Actions
          login: async () => {
            const authUrl = await realAPI.auth.loginWithMicrosoft();
            return authUrl;
          },
          
          handleAuthCallback: async (code, state) => {
            set((state) => { state.isLoading = true; });
            try {
              const user = await realAPI.auth.handleMicrosoftCallback(code, state);
              set((state) => {
                state.user = user;
                state.isAuthenticated = true;
              });
              
              // Initialize WebSocket
              get().actions.initializeWebSocket();
              
              // Fetch initial data
              await Promise.all([
                get().actions.fetchEmails(),
                get().actions.fetchAccounts(),
                get().actions.fetchDashboardStats()
              ]);
            } finally {
              set((state) => { state.isLoading = false; });
            }
          },
          
          logout: async () => {
            await realAPI.auth.logout();
            set((state) => {
              state.user = null;
              state.isAuthenticated = false;
              state.emails = [];
              state.emailAccounts = [];
            });
          },
          
          fetchProfile: async () => {
            const profile = await realAPI.auth.getProfile();
            set((state) => { state.user = profile; });
          },
          
          updateProfile: async (data) => {
            const updated = await realAPI.auth.updateProfile(data);
            set((state) => { state.user = updated; });
          },
          
          // Email Actions
          fetchEmails: async (params) => {
            set((state) => { state.emailsLoading = true; });
            try {
              const { emails, total } = await realAPI.email.getEmails(params);
              set((state) => {
                state.emails = emails;
                state.totalEmails = total;
                state.unreadCount = emails.filter(e => !e.isRead).length;
              });
            } finally {
              set((state) => { state.emailsLoading = false; });
            }
          },
          
          fetchEmail: async (id) => {
            const email = await realAPI.email.getEmail(id);
            set((state) => {
              const index = state.emails.findIndex(e => e.id === id);
              if (index >= 0) {
                state.emails[index] = email;
              }
              state.selectedEmail = email;
            });
          },
          
          markEmailAsRead: async (id) => {
            await realAPI.email.markAsRead(id);
            set((state) => {
              const email = state.emails.find(e => e.id === id);
              if (email) {
                email.isRead = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
            });
          },
          
          markEmailAsUnread: async (id) => {
            await realAPI.email.markAsUnread(id);
            set((state) => {
              const email = state.emails.find(e => e.id === id);
              if (email) {
                email.isRead = false;
                state.unreadCount += 1;
              }
            });
          },
          
          deleteEmail: async (id) => {
            await realAPI.email.deleteEmail(id);
            set((state) => {
              state.emails = state.emails.filter(e => e.id !== id);
              if (state.selectedEmail?.id === id) {
                state.selectedEmail = null;
              }
            });
          },
          
          moveEmail: async (id, folder) => {
            await realAPI.email.moveToFolder(id, folder);
            set((state) => {
              const email = state.emails.find(e => e.id === id);
              if (email) {
                email.folder = folder;
              }
            });
          },
          
          syncEmails: async (accountId) => {
            const result = await realAPI.email.syncEmails(accountId);
            // Refresh emails after sync
            await get().actions.fetchEmails();
            return result;
          },
          
          selectEmail: (email) => {
            set((state) => { state.selectedEmail = email; });
          },
          
          // Analysis Actions
          analyzeEmail: async (emailId) => {
            set((state) => { state.analysisLoading = true; });
            try {
              const analysis = await realAPI.analysis.analyzeEmail(emailId);
              set((state) => {
                state.analyses.set(emailId, analysis);
              });
            } finally {
              set((state) => { state.analysisLoading = false; });
            }
          },
          
          batchAnalyzeEmails: async (emailIds) => {
            set((state) => { state.analysisLoading = true; });
            try {
              const analyses = await realAPI.analysis.batchAnalyze(emailIds);
              set((state) => {
                analyses.forEach(analysis => {
                  state.analyses.set(analysis.emailId, analysis);
                });
              });
            } finally {
              set((state) => { state.analysisLoading = false; });
            }
          },
          
          // Filter Rule Actions
          fetchFilterRules: async () => {
            const rules = await realAPI.filter.getFilterRules();
            set((state) => { state.filterRules = rules; });
          },
          
          createFilterRule: async (rule) => {
            const newRule = await realAPI.filter.createFilterRule(rule);
            set((state) => {
              state.filterRules.push(newRule);
            });
          },
          
          updateFilterRule: async (id, updates) => {
            const updated = await realAPI.filter.updateFilterRule(id, updates);
            set((state) => {
              const index = state.filterRules.findIndex(r => r.id === id);
              if (index >= 0) {
                state.filterRules[index] = updated;
              }
            });
          },
          
          deleteFilterRule: async (id) => {
            await realAPI.filter.deleteFilterRule(id);
            set((state) => {
              state.filterRules = state.filterRules.filter(r => r.id !== id);
            });
          },
          
          executeFilter: async (id) => {
            await realAPI.filter.executeFilter(id);
            // Refresh emails after filter execution
            await get().actions.fetchEmails();
          },
          
          fetchSmartSuggestions: async () => {
            const suggestions = await realAPI.filter.getSmartSuggestions();
            // Handle suggestions (e.g., show in UI)
          },
          
          // Report Actions
          fetchReports: async () => {
            const reports = await realAPI.report.getReports();
            set((state) => { state.reports = reports; });
          },
          
          generateReport: async (config) => {
            set((state) => { state.generatingReport = true; });
            try {
              const report = await realAPI.report.generateReport(config);
              set((state) => {
                state.reports.push(report);
              });
            } finally {
              set((state) => { state.generatingReport = false; });
            }
          },
          
          scheduleReport: async (config) => {
            await realAPI.report.scheduleReport(config);
            await get().actions.fetchReports();
          },
          
          downloadReport: async (id) => {
            const blob = await realAPI.report.downloadReport(id);
            // Trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${id}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
          },
          
          deleteReport: async (id) => {
            await realAPI.report.deleteReport(id);
            set((state) => {
              state.reports = state.reports.filter(r => r.id !== id);
            });
          },
          
          // Workflow Actions
          fetchWorkflows: async () => {
            const workflows = await realAPI.workflow.getWorkflows();
            set((state) => { state.workflows = workflows; });
          },
          
          createWorkflow: async (workflow) => {
            const newWorkflow = await realAPI.workflow.createWorkflow(workflow);
            set((state) => {
              state.workflows.push(newWorkflow);
            });
          },
          
          updateWorkflow: async (id, updates) => {
            const updated = await realAPI.workflow.updateWorkflow(id, updates);
            set((state) => {
              const index = state.workflows.findIndex(w => w.id === id);
              if (index >= 0) {
                state.workflows[index] = updated;
              }
            });
          },
          
          deleteWorkflow: async (id) => {
            await realAPI.workflow.deleteWorkflow(id);
            set((state) => {
              state.workflows = state.workflows.filter(w => w.id !== id);
            });
          },
          
          testWorkflow: async (id) => {
            await realAPI.workflow.testWorkflow(id);
          },
          
          // Account Actions
          fetchAccounts: async () => {
            const accounts = await realAPI.account.getAccounts();
            set((state) => {
              state.emailAccounts = accounts;
              state.primaryAccount = accounts.find(a => a.isPrimary) || null;
            });
          },
          
          addAccount: async (provider) => {
            const authUrl = await realAPI.account.addAccount(provider);
            return authUrl;
          },
          
          removeAccount: async (id) => {
            await realAPI.account.removeAccount(id);
            set((state) => {
              state.emailAccounts = state.emailAccounts.filter(a => a.id !== id);
            });
          },
          
          setPrimaryAccount: async (id) => {
            await realAPI.account.setPrimaryAccount(id);
            set((state) => {
              state.emailAccounts.forEach(account => {
                account.isPrimary = account.id === id;
              });
              state.primaryAccount = state.emailAccounts.find(a => a.id === id) || null;
            });
          },
          
          // Dashboard Actions
          fetchDashboardStats: async () => {
            set((state) => { state.statsLoading = true; });
            try {
              const stats = await realAPI.stats.getDashboardStats();
              set((state) => { state.dashboardStats = stats; });
            } finally {
              set((state) => { state.statsLoading = false; });
            }
          },
          
          fetchEmailTrends: async (period) => {
            return await realAPI.stats.getEmailTrends(period);
          },
          
          // Integration Actions
          connectTrello: async (config) => {
            await realAPI.integration.connectTrello(config);
          },
          
          connectJira: async (config) => {
            await realAPI.integration.connectJira(config);
          },
          
          createTrelloCard: async (emailId, listId) => {
            await realAPI.integration.createTrelloCard(emailId, listId);
          },
          
          createJiraIssue: async (emailId, options) => {
            await realAPI.integration.createJiraIssue(emailId, options);
          },
          
          // Notification Actions
          addNotification: (notification) => {
            set((state) => {
              state.notifications.unshift(notification);
              state.unreadNotifications += 1;
            });
          },
          
          markNotificationAsRead: (id) => {
            set((state) => {
              const notification = state.notifications.find(n => n.id === id);
              if (notification && !notification.isRead) {
                notification.isRead = true;
                state.unreadNotifications = Math.max(0, state.unreadNotifications - 1);
              }
            });
          },
          
          clearNotifications: () => {
            set((state) => {
              state.notifications = [];
              state.unreadNotifications = 0;
            });
          },
          
          // Settings Actions
          updateSettings: async (settings) => {
            // Save to backend
            await realAPI.auth.updateProfile({ settings });
            
            set((state) => {
              state.settings = { ...state.settings, ...settings };
            });
          },
          
          // WebSocket Actions
          initializeWebSocket: () => {
            realAPI.initializeWebSocket((notification) => {
              get().actions.addNotification(notification);
            });
          },
          
          disconnectWebSocket: () => {
            realAPI.disconnectWebSocket();
          }
        }
      })),
      {
        name: 'email-assist-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          settings: state.settings
        })
      }
    )
  )
);

// Selector hooks
export const useUser = () => useRealStore((state) => state.user);
export const useIsAuthenticated = () => useRealStore((state) => state.isAuthenticated);
export const useEmails = () => useRealStore((state) => state.emails);
export const useSelectedEmail = () => useRealStore((state) => state.selectedEmail);
export const useFilterRules = () => useRealStore((state) => state.filterRules);
export const useReports = () => useRealStore((state) => state.reports);
export const useWorkflows = () => useRealStore((state) => state.workflows);
export const useDashboardStats = () => useRealStore((state) => state.dashboardStats);
export const useNotifications = () => useRealStore((state) => state.notifications);
export const useSettings = () => useRealStore((state) => state.settings);
export const useActions = () => useRealStore((state) => state.actions);

export default useRealStore;