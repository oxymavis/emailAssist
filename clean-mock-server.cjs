const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// 中间件
app.use(cors());
app.use(express.json());

// Mock数据
const mockEmails = [
  {
    id: 'email-1',
    subject: '项目进度更新 - Q4计划',
    from: { name: '张三', email: 'zhangsan@company.com' },
    to: [{ name: '李四', email: 'lisi@company.com' }],
    content: '关于Q4项目计划的更新...',
    receivedAt: '2024-01-15T09:30:00Z',
    isRead: false,
    category: 'work',
    priority: 'high',
    sentiment: 'neutral',
    urgency: 0.8,
    hasAttachments: true
  },
  {
    id: 'email-2',
    subject: '会议安排 - 下周一早上9点',
    from: { name: '王五', email: 'wangwu@company.com' },
    to: [{ name: '李四', email: 'lisi@company.com' }],
    content: '下周一早上9点会议室A开会...',
    receivedAt: '2024-01-15T10:15:00Z',
    isRead: true,
    category: 'meeting',
    priority: 'medium',
    sentiment: 'positive',
    urgency: 0.6,
    hasAttachments: false
  }
];

const mockStats = {
  totalEmails: 2456,
  unreadEmails: 23,
  pendingAnalysis: 5,
  ruleMatches: 18,
  emailTrends: [
    { date: '2024-01-01', received: 45, processed: 43 },
    { date: '2024-01-02', received: 52, processed: 50 },
    { date: '2024-01-03', received: 38, processed: 38 }
  ],
  sentimentDistribution: {
    positive: 35,
    neutral: 45,
    negative: 20
  }
};

// API路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/emails', (req, res) => {
  res.json({
    success: true,
    data: {
      items: mockEmails,
      total: mockEmails.length,
      page: 1,
      limit: 20
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
  const emailId = req.params.id;
  res.json({
    success: true,
    data: {
      id: emailId,
      emailId: emailId,
      sentiment: 'neutral',
      urgency: 0.7,
      category: 'work',
      keywords: ['项目', '计划', '更新'],
      summary: '这是一封关于项目进度的邮件',
      suggestedActions: ['回复', '标记重要'],
      analyzedAt: new Date().toISOString()
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Emails API: http://localhost:${PORT}/api/emails`);
  console.log(`📈 Stats API: http://localhost:${PORT}/api/stats/dashboard`);
});