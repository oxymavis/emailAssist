import { 
  Email, 
  EmailAnalysis, 
  FilterRule, 
  Report, 
  Workflow, 
  DashboardStats, 
  UserSettings,
  EmailVolumeData,
  SentimentData,
  CategoryData,
  PriorityHeatmapData,
  ResponseTimeData,
  TopSenderData
} from '@/types';
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
  
  // 高级图表数据生成方法
  getEmailVolumeData: (days = 30) => generateEmailVolumeData(days),
  getSentimentAnalysisData: () => generateSentimentAnalysisData(),
  getCategoryDistributionData: () => generateCategoryDistributionData(),
  getPriorityHeatmapData: () => generatePriorityHeatmapData(),
  getResponseTimeData: (days = 14) => generateResponseTimeData(days),
  getTopSendersData: (count = 10) => generateTopSendersData(count),
};

// 生成邮件量趋势数据
const generateEmailVolumeData = (days: number): EmailVolumeData[] => {
  const data: EmailVolumeData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    const baseVolume = Math.floor(Math.random() * 50) + 100; // 100-150 基础量
    const received = baseVolume + Math.floor(Math.random() * 30);
    const sent = Math.floor(received * 0.3) + Math.floor(Math.random() * 20);
    const unread = Math.floor(received * 0.1) + Math.floor(Math.random() * 10);
    const processed = received - unread - Math.floor(Math.random() * 15);

    data.push({
      date: date.toISOString(),
      total: received + sent,
      received,
      sent,
      unread,
      processed: Math.max(0, processed),
    });
  }

  return data;
};

// 生成情感分析数据
const generateSentimentAnalysisData = (): SentimentData[] => {
  const total = Math.floor(Math.random() * 500) + 1000; // 1000-1500 总数
  const positive = Math.floor(total * (0.6 + Math.random() * 0.2)); // 60-80%
  const negative = Math.floor(total * (0.05 + Math.random() * 0.1)); // 5-15%
  const neutral = total - positive - negative;

  return [
    {
      sentiment: 'positive',
      count: positive,
      percentage: (positive / total) * 100,
      trend: Math.random() * 10 - 5, // -5% 到 +5% 趋势
      color: '#4CAF50',
    },
    {
      sentiment: 'neutral',
      count: neutral,
      percentage: (neutral / total) * 100,
      trend: Math.random() * 4 - 2, // -2% 到 +2% 趋势
      color: '#FF9800',
    },
    {
      sentiment: 'negative',
      count: negative,
      percentage: (negative / total) * 100,
      trend: Math.random() * 6 - 3, // -3% 到 +3% 趋势
      color: '#F44336',
    },
  ];
};

// 生成分类分布数据
const generateCategoryDistributionData = (): CategoryData[] => {
  const categories = [
    { name: t('mockData.categories.work'), color: '#2196F3' },
    { name: t('mockData.categories.meeting'), color: '#4CAF50' },
    { name: t('mockData.categories.project'), color: '#FF9800' },
    { name: t('mockData.categories.customer'), color: '#9C27B0' },
    { name: t('mockData.categories.system'), color: '#607D8B' },
    { name: t('mockData.categories.marketing'), color: '#E91E63' },
    { name: t('mockData.categories.support'), color: '#00BCD4' },
    { name: t('mockData.categories.urgent'), color: '#F44336' },
  ];

  const total = Math.floor(Math.random() * 1000) + 2000;
  let remaining = total;

  return categories.map((category, index) => {
    const isLast = index === categories.length - 1;
    const count = isLast 
      ? remaining 
      : Math.floor(remaining * (0.05 + Math.random() * 0.25));
    
    remaining -= count;

    const subcategories = Math.random() > 0.5 ? [
      {
        name: `${category.name} - 子类别 1`,
        count: Math.floor(count * 0.6),
        percentage: 60,
        color: category.color,
      },
      {
        name: `${category.name} - 子类别 2`,
        count: Math.floor(count * 0.4),
        percentage: 40,
        color: category.color,
      },
    ] : undefined;

    return {
      name: category.name,
      count,
      percentage: (count / total) * 100,
      color: category.color,
      subcategories,
    };
  });
};

// 生成优先级热力图数据
const generatePriorityHeatmapData = (): PriorityHeatmapData[] => {
  const data: PriorityHeatmapData[] = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const priorities: ('low' | 'normal' | 'high' | 'critical')[] = ['low', 'normal', 'high', 'critical'];

  days.forEach(day => {
    for (let hour = 0; hour < 24; hour++) {
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const baseCount = hour >= 9 && hour <= 17 ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 5);
      
      data.push({
        hour,
        day,
        priority,
        count: baseCount,
        intensity: Math.min(baseCount / 25, 1), // 标准化强度值
      });
    }
  });

  return data;
};

// 生成响应时间数据
const generateResponseTimeData = (days: number): ResponseTimeData[] => {
  const data: ResponseTimeData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    const avgResponse = 1 + Math.random() * 4; // 1-5小时
    const medianResponse = avgResponse * (0.8 + Math.random() * 0.4); // 中位数通常更低
    const count = Math.floor(Math.random() * 50) + 10;
    const trend = (Math.random() - 0.5) * 20; // -10% 到 +10%

    data.push({
      timeRange: format(date, 'MM-dd'),
      avgResponse: Number(avgResponse.toFixed(1)),
      medianResponse: Number(medianResponse.toFixed(1)),
      count,
      trend: Number(trend.toFixed(1)),
    });
  }

  return data;
};

// 生成主要发件人数据
const generateTopSendersData = (count: number): TopSenderData[] => {
  const senders = [
    { name: t('mockData.senders.zhangsan'), email: 'zhangsan@company.com' },
    { name: t('mockData.senders.lisi'), email: 'lisi@client.com' },
    { name: t('mockData.senders.wangwu'), email: 'wangwu@partner.com' },
    { name: t('mockData.senders.zhaoliu'), email: 'zhaoliu@vendor.com' },
    { name: t('mockData.senders.johnSmith'), email: 'john.smith@global.com' },
    { name: t('mockData.senders.sarahJohnson'), email: 'sarah.j@tech.com' },
    { name: t('mockData.senders.marketingTeam'), email: 'marketing@company.com' },
    { name: t('mockData.senders.supportTeam'), email: 'support@service.com' },
    { name: '李明', email: 'liming@business.com' },
    { name: 'Alex Chen', email: 'alex.chen@international.com' },
    { name: '客户服务部', email: 'service@help.com' },
    { name: 'Michael Brown', email: 'mbrown@partner.org' },
  ];

  return senders.slice(0, count).map((sender, index) => {
    const emailCount = Math.floor(Math.random() * 200) + 50 - (index * 10); // 递减趋势
    const avgResponseTime = 0.5 + Math.random() * 3; // 0.5-3.5小时
    const sentimentScore = 4 + Math.random() * 6; // 4-10分

    return {
      name: sender.name,
      email: sender.email,
      count: emailCount,
      avgResponseTime: Number(avgResponseTime.toFixed(1)),
      sentimentScore: Number(sentimentScore.toFixed(1)),
      urgencyDistribution: {
        low: Math.floor(emailCount * 0.4),
        normal: Math.floor(emailCount * 0.35),
        high: Math.floor(emailCount * 0.2),
        critical: Math.floor(emailCount * 0.05),
      },
    };
  });
};