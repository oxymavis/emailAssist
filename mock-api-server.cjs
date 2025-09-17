/**
 * 简单的Mock API服务器
 * 提供真实格式的API响应来测试前端
 */
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 模拟数据
const mockEmails = [
  {
    id: 'email-1',
    subject: '项目进度更新 - Q4计划',
    from: { name: '张三', email: 'zhangsan@company.com' },
    to: [{ name: '我', email: 'me@company.com' }],
    receivedDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    bodyPreview: '关于Q4项目计划的重要更新...',
    isRead: false,
    hasAttachments: true,
    importance: 'high',
    folder: 'inbox'
  },
  {
    id: 'email-2',
    subject: '会议邀请 - 下周一产品评审',
    from: { name: '李四', email: 'lisi@company.com' },
    to: [{ name: '我', email: 'me@company.com' }],
    receivedDateTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    bodyPreview: '邀请您参加下周一的产品评审会议...',
    isRead: true,
    hasAttachments: false,
    importance: 'normal',
    folder: 'inbox'
  },
  {
    id: 'email-3',
    subject: '紧急：服务器维护通知',
    from: { name: '运维团队', email: 'ops@company.com' },
    to: [{ name: '我', email: 'me@company.com' }],
    receivedDateTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    bodyPreview: '系统将在今晚进行维护升级...',
    isRead: false,
    hasAttachments: false,
    importance: 'critical',
    folder: 'inbox'
  }
];

const mockStats = {
  totalEmails: 1247,
  unreadEmails: 23,
  processedToday: 45,
  avgResponseTime: 2.3,
  sentimentScore: 0.72,
  urgentEmails: 5,
  automationSavings: 3.5,
  lastSyncTime: new Date().toISOString()
};

// API 路由
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/emails', (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);

  res.json({
    success: true,
    data: {
      emails: mockEmails.slice(startIndex, endIndex),
      total: mockEmails.length
    }
  });
});

app.get('/api/stats/dashboard', (req, res) => {
  res.json({
    success: true,
    data: mockStats
  });
});

app.get('/api/analysis/email/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    data: {
      emailId: id,
      sentiment: Math.random() > 0.5 ? 'positive' : 'neutral',
      urgency: Math.random() > 0.7 ? 'high' : 'medium',
      category: '工作任务',
      confidence: 0.85,
      keyTopics: ['项目', '计划', '会议'],
      summary: '这封邮件讨论了项目相关事宜，需要及时关注。',
      actionRequired: Math.random() > 0.5,
      analysisTimestamp: new Date().toISOString()
    }
  });
});

app.get('/api/integrations', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'trello-1',
        name: 'Trello 项目管理',
        type: 'trello',
        status: 'connected',
        lastSync: new Date().toISOString(),
        config: { boardName: '项目任务板' }
      },
      {
        id: 'jira-1',
        name: 'Jira 问题追踪',
        type: 'jira',
        status: 'connected',
        lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        config: { projectKey: 'PROJ' }
      }
    ]
  });
});

app.get('/api/workflows/tasks', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'task-1',
        emailId: 'email-1',
        integrationId: 'trello-1',
        title: '处理项目进度更新',
        status: 'pending',
        priority: 'high',
        createdAt: new Date().toISOString(),
        externalUrl: 'https://trello.com/c/abc123'
      },
      {
        id: 'task-2',
        emailId: 'email-3',
        integrationId: 'jira-1',
        title: '服务器维护问题',
        status: 'in_progress',
        priority: 'critical',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        externalUrl: 'https://company.atlassian.net/browse/PROJ-123'
      }
    ]
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found'
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Mock API Server started successfully!`);
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Emails API: http://localhost:${PORT}/api/emails`);
  console.log(`📊 Stats API: http://localhost:${PORT}/api/stats/dashboard`);
  console.log(`⚡ Ready to serve real API format data!`);
});