import { Email, EmailAnalysis, FilterRule, Report, Workflow, DashboardStats, UserSettings } from '@/types';
import { subDays, subHours, format } from 'date-fns';
import i18n from '@/i18n';

// 获取国际化文本的辅助函数
const t = (key: string) => i18n.t(key);

// 模拟邮件数据生成器
const generateMockEmails = (count: number = 50): Email[] => {
  const senders = [
    { name: t('mockData.senders.zhangsan'), email: 'zhangsan@company.com' },
    { name: t('mockData.senders.lisi'), email: 'lisi@client.com' },
    { name: t('mockData.senders.wangwu'), email: 'wangwu@partner.com' },
    { name: t('mockData.senders.zhaoliu'), email: 'zhaoliu@vendor.com' },
    { name: t('mockData.senders.johnSmith'), email: 'john.smith@global.com' },
    { name: t('mockData.senders.sarahJohnson'), email: 'sarah.j@tech.com' },
    { name: t('mockData.senders.marketingTeam'), email: 'marketing@company.com' },
    { name: t('mockData.senders.supportTeam'), email: 'support@service.com' },
  ];

  const subjects = [
    t('mockData.subjects.projectUpdate'),
    t('mockData.subjects.meetingInvitation'),
    t('mockData.subjects.urgentMaintenance'),
    t('mockData.subjects.quarterlyReport'),
    t('mockData.subjects.customerFeedback'),
    t('mockData.subjects.systemUpgrade'),
    t('mockData.subjects.partnerMeeting'),
    t('mockData.subjects.featureRequirements'),
    t('mockData.subjects.bugFixUpdate'),
    t('mockData.subjects.marketingCampaign'),
    t('mockData.subjects.weeklySync'),
    t('mockData.subjects.contractReview'),
    t('mockData.subjects.securityUpdate'),
    t('mockData.subjects.performanceReport'),
    t('mockData.subjects.satisfactionSurvey'),
  ];

  const categories = [
    t('mockData.categories.work'),
    t('mockData.categories.meeting'),
    t('mockData.categories.project'),
    t('mockData.categories.customer'),
    t('mockData.categories.system'),
    t('mockData.categories.marketing'),
    t('mockData.categories.support'),
    t('mockData.categories.urgent')
  ];
  const importanceLevels: ('low' | 'normal' | 'high')[] = ['low', 'normal', 'high'];

  return Array.from({ length: count }, (_, index) => {
    const sender = senders[Math.floor(Math.random() * senders.length)];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const receivedTime = subHours(new Date(), Math.floor(Math.random() * 168)); // 过去一周内

    return {
      id: `email-${index + 1}`,
      subject,
      sender,
      recipient: { name: t('mockData.recipient.me'), email: 'me@company.com' },
      content: t('mockData.emailContent', { subject, senderName: sender.name }),
      receivedDateTime: receivedTime.toISOString(),
      isRead: Math.random() > 0.3,
      importance: importanceLevels[Math.floor(Math.random() * importanceLevels.length)],
      hasAttachments: Math.random() > 0.7,
      categories: [categories[Math.floor(Math.random() * categories.length)]],
      conversationId: `conversation-${Math.floor(index / 3) + 1}`,
    };
  });
};

// 模拟AI分析结果生成器
const generateMockAnalysis = (emailId: string): EmailAnalysis => {
  const sentiments: ('positive' | 'neutral' | 'negative')[] = ['positive', 'neutral', 'negative'];
  const urgencies: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
  const categories = [
    t('mockData.analysisCategories.workTask'),
    t('mockData.analysisCategories.meetingArrangement'),
    t('mockData.analysisCategories.technicalSupport'),
    t('mockData.analysisCategories.projectManagement'),
    t('mockData.analysisCategories.customerService'),
    t('mockData.analysisCategories.systemNotification'),
    t('mockData.analysisCategories.marketingActivity')
  ];
  const topics = [
    t('mockData.analysisTopics.projectProgress'),
    t('mockData.analysisTopics.meetingTime'),
    t('mockData.analysisTopics.technicalIssue'),
    t('mockData.analysisTopics.customerFeedback'),
    t('mockData.analysisTopics.systemUpdate'),
    t('mockData.analysisTopics.teamCollaboration'),
    t('mockData.analysisTopics.businessDevelopment')
  ];

  return {
    id: `analysis-${emailId}`,
    emailId,
    sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    urgency: urgencies[Math.floor(Math.random() * urgencies.length)],
    category: categories[Math.floor(Math.random() * categories.length)],
    keyTopics: topics.slice(0, Math.floor(Math.random() * 3) + 1),
    summary: t('mockData.analysisSummary'),
    actionRequired: Math.random() > 0.5,
    suggestedResponse: Math.random() > 0.6 ? t('mockData.suggestedResponse') : undefined,
    confidence: Math.random() * 0.4 + 0.6, // 0.6 - 1.0
    processedAt: new Date().toISOString(),
  };
};

// 模拟过滤规则
export const mockFilterRules: FilterRule[] = [
  {
    id: 'filter-1',
    name: t('mockData.filterRules.urgentEmail.name'),
    description: t('mockData.filterRules.urgentEmail.description'),
    conditions: [
      {
        field: 'subject',
        operator: 'contains',
        value: t('mockData.filterRules.urgentEmail.keyword'),
      },
    ],
    actions: [
      {
        type: 'markAsImportant',
      },
      {
        type: 'label',
        value: t('mockData.filterRules.urgentEmail.label'),
      },
    ],
    isActive: true,
    createdAt: subDays(new Date(), 7).toISOString(),
    updatedAt: subDays(new Date(), 1).toISOString(),
    priority: 1,
  },
  {
    id: 'filter-2',
    name: t('mockData.filterRules.meetingEmail.name'),
    description: t('mockData.filterRules.meetingEmail.description'),
    conditions: [
      {
        field: 'subject',
        operator: 'contains',
        value: t('mockData.filterRules.meetingEmail.keyword1'),
        logicalOperator: 'OR',
      },
      {
        field: 'content',
        operator: 'contains',
        value: 'meeting',
      },
    ],
    actions: [
      {
        type: 'move',
        value: t('mockData.filterRules.meetingEmail.folder'),
      },
      {
        type: 'label',
        value: t('mockData.filterRules.meetingEmail.label'),
      },
    ],
    isActive: true,
    createdAt: subDays(new Date(), 14).toISOString(),
    updatedAt: subDays(new Date(), 3).toISOString(),
    priority: 2,
  },
  {
    id: 'filter-3',
    name: t('mockData.filterRules.systemEmail.name'),
    description: t('mockData.filterRules.systemEmail.description'),
    conditions: [
      {
        field: 'sender',
        operator: 'contains',
        value: 'noreply',
        logicalOperator: 'OR',
      },
      {
        field: 'sender',
        operator: 'contains',
        value: 'system',
      },
    ],
    actions: [
      {
        type: 'markAsRead',
      },
      {
        type: 'label',
        value: t('mockData.filterRules.systemEmail.label'),
      },
    ],
    isActive: false,
    createdAt: subDays(new Date(), 21).toISOString(),
    updatedAt: subDays(new Date(), 5).toISOString(),
    priority: 3,
  },
];

// 模拟工作流配置
export const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: t('mockData.workflows.trelloTask.name'),
    description: t('mockData.workflows.trelloTask.description'),
    type: 'trello',
    configuration: {
      apiKey: 'mock-trello-api-key',
      boardId: 'mock-board-id',
      mappings: {
        urgency: {
          critical: 'urgent',
          high: 'important',
          medium: 'normal',
          low: 'backlog',
        },
        category: {
          [t('mockData.analysisCategories.workTask')]: 'work',
          [t('mockData.analysisCategories.customerService')]: 'customer',
          [t('mockData.analysisCategories.technicalSupport')]: 'tech',
        },
      },
      template: t('mockData.workflows.trelloTask.template'),
    },
    isActive: true,
    createdAt: subDays(new Date(), 10).toISOString(),
    updatedAt: subDays(new Date(), 2).toISOString(),
  },
  {
    id: 'workflow-2',
    name: t('mockData.workflows.jiraIssue.name'),
    description: t('mockData.workflows.jiraIssue.description'),
    type: 'jira',
    configuration: {
      projectKey: 'SUPPORT',
      mappings: {
        urgency: {
          critical: 'Highest',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        },
        category: {
          [t('mockData.analysisCategories.technicalSupport')]: 'Bug',
          [t('mockData.analysisCategories.systemNotification')]: 'Task',
          [t('mockData.analysisCategories.projectManagement')]: 'Story',
        },
      },
      template: t('mockData.workflows.jiraIssue.template'),
    },
    isActive: true,
    createdAt: subDays(new Date(), 15).toISOString(),
    updatedAt: subDays(new Date(), 1).toISOString(),
  },
];

// 模拟统计数据
export const mockDashboardStats: DashboardStats = {
  totalEmails: 1247,
  unreadEmails: 23,
  processedToday: 156,
  avgResponseTime: 2.5,
  sentimentScore: 7.3,
  urgentEmails: 8,
  automationSavings: 3.2,
  lastSyncTime: new Date().toISOString(),
};

// 模拟报告数据
export const mockReports: Report[] = [
  {
    id: 'report-1',
    title: t('mockData.reports.weeklyReport.title'),
    type: 'weekly',
    generatedAt: new Date().toISOString(),
    period: {
      startDate: subDays(new Date(), 7).toISOString(),
      endDate: new Date().toISOString(),
    },
    data: {
      totalEmails: 234,
      processedEmails: 201,
      sentimentAnalysis: {
        positive: 132,
        neutral: 89,
        negative: 13,
      },
      urgencyDistribution: {
        low: 156,
        medium: 67,
        high: 23,
        critical: 5,
      },
      topCategories: [
        { name: t('mockData.analysisCategories.workTask'), count: 89, percentage: 38.0 },
        { name: t('mockData.analysisCategories.meetingArrangement'), count: 56, percentage: 23.9 },
        { name: t('mockData.analysisCategories.customerService'), count: 34, percentage: 14.5 },
        { name: t('mockData.analysisCategories.technicalSupport'), count: 23, percentage: 9.8 },
        { name: t('mockData.analysisCategories.systemNotification'), count: 18, percentage: 7.7 },
      ],
      responseTime: {
        average: 2.3,
        median: 1.8,
      },
      trends: Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'),
        count: Math.floor(Math.random() * 40) + 20,
      })),
    },
    status: 'completed',
  },
  {
    id: 'report-2',
    title: t('mockData.reports.monthlyReport.title'),
    type: 'monthly',
    generatedAt: subHours(new Date(), 2).toISOString(),
    period: {
      startDate: subDays(new Date(), 30).toISOString(),
      endDate: new Date().toISOString(),
    },
    data: {
      totalEmails: 1089,
      processedEmails: 967,
      sentimentAnalysis: {
        positive: 612,
        neutral: 398,
        negative: 79,
      },
      urgencyDistribution: {
        low: 734,
        medium: 267,
        high: 78,
        critical: 10,
      },
      topCategories: [
        { name: t('mockData.analysisCategories.workTask'), count: 423, percentage: 38.8 },
        { name: t('mockData.analysisCategories.customerService'), count: 234, percentage: 21.5 },
        { name: t('mockData.analysisCategories.meetingArrangement'), count: 198, percentage: 18.2 },
        { name: t('mockData.analysisCategories.technicalSupport'), count: 145, percentage: 13.3 },
        { name: t('mockData.analysisCategories.marketingActivity'), count: 89, percentage: 8.2 },
      ],
      responseTime: {
        average: 2.7,
        median: 2.1,
      },
      trends: Array.from({ length: 30 }, (_, i) => ({
        date: format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'),
        count: Math.floor(Math.random() * 50) + 15,
      })),
    },
    status: 'completed',
  },
];

// 模拟用户设置
export const mockUserSettings: UserSettings = {
  notifications: {
    email: true,
    push: true,
    frequency: 'hourly',
  },
  analysis: {
    autoAnalyze: true,
    analysisTypes: ['sentiment', 'urgency', 'category', 'summary'],
    confidenceThreshold: 0.8,
  },
  display: {
    theme: 'light',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
  },
  integration: {
    microsoftGraph: {
      isConnected: true,
      tenantId: 'mock-tenant-id',
      lastSync: subHours(new Date(), 1).toISOString(),
    },
    trello: {
      isConnected: true,
      apiKey: 'mock-trello-key',
    },
    jira: {
      isConnected: false,
    },
  },
};

// 导出模拟数据服务
export const mockDataService = {
  // 生成邮件数据
  getEmails: (count = 50) => generateMockEmails(count),
  
  // 生成单个邮件分析
  getEmailAnalysis: (emailId: string) => generateMockAnalysis(emailId),
  
  // 批量生成分析数据
  getBatchAnalysis: (emailIds: string[]) => 
    emailIds.map(id => generateMockAnalysis(id)),
  
  // 获取过滤规则
  getFilterRules: () => mockFilterRules,
  
  // 获取工作流
  getWorkflows: () => mockWorkflows,
  
  // 获取统计数据
  getDashboardStats: () => mockDashboardStats,
  
  // 获取报告
  getReports: () => mockReports,
  
  // 获取用户设置
  getUserSettings: () => mockUserSettings,
  
  // 生成趋势数据
  getTrendData: (days = 7) => 
    Array.from({ length: days }, (_, i) => ({
      date: format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd'),
      emails: Math.floor(Math.random() * 50) + 10,
      processed: Math.floor(Math.random() * 45) + 5,
      urgent: Math.floor(Math.random() * 10),
    })),
  
  // 生成分类统计
  getCategoryStats: () => [
    { name: t('mockData.analysisCategories.workTask'), value: 423, color: '#2196F3' },
    { name: t('mockData.analysisCategories.customerService'), value: 234, color: '#FF9800' },
    { name: t('mockData.analysisCategories.meetingArrangement'), value: 198, color: '#4CAF50' },
    { name: t('mockData.analysisCategories.technicalSupport'), value: 145, color: '#F44336' },
    { name: t('mockData.analysisCategories.marketingActivity'), value: 89, color: '#9C27B0' },
    { name: t('mockData.analysisCategories.systemNotification'), value: 67, color: '#607D8B' },
  ],
};