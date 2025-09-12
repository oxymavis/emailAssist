const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API基础路由
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Email Assist API',
      version: 'v1',
      environment: 'development-test',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/auth',
        email: '/api/email',
        analysis: '/api/analysis',
        rules: '/api/rules',
        stats: '/api/stats',
        health: '/api/health'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'test-request'
    }
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'health-check'
    }
  });
});

// 邮件相关API
app.get('/api/emails', (req, res) => {
  res.json({
    success: true,
    data: {
      emails: [
        {
          id: 'test-email-1',
          subject: 'Test Email 1',
          from: 'sender@example.com',
          to: ['user@example.com'],
          date: new Date().toISOString(),
          body: 'This is a test email for frontend-backend integration',
          isRead: false,
          category: 'inbox'
        },
        {
          id: 'test-email-2',
          subject: 'Test Email 2',
          from: 'another@example.com',
          to: ['user@example.com'],
          date: new Date().toISOString(),
          body: 'Another test email',
          isRead: true,
          category: 'inbox'
        }
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'get-emails'
    }
  });
});

// 获取单个邮件
app.get('/api/emails/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    data: {
      id,
      subject: `Email ${id}`,
      from: 'sender@example.com',
      to: ['user@example.com'],
      date: new Date().toISOString(),
      body: `This is the content of email ${id}`,
      isRead: false,
      category: 'inbox',
      attachments: []
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `get-email-${id}`
    }
  });
});

// 邮件分析API
app.post('/api/analysis/email/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    data: {
      emailId: id,
      analysis: {
        sentiment: 'neutral',
        category: 'general',
        priority: 'normal',
        keywords: ['test', 'email', 'analysis'],
        summary: 'This email contains test content for analysis',
        confidence: 0.85
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `analyze-email-${id}`
    }
  });
});

// 批量分析API
app.post('/api/analysis/batch', (req, res) => {
  const { emailIds } = req.body;
  res.json({
    success: true,
    data: {
      processed: emailIds ? emailIds.length : 0,
      results: emailIds ? emailIds.map(id => ({
        emailId: id,
        analysis: {
          sentiment: 'neutral',
          category: 'general',
          priority: 'normal',
          keywords: ['test'],
          summary: `Analysis for email ${id}`,
          confidence: 0.75
        }
      })) : []
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'batch-analysis'
    }
  });
});

// 过滤规则API
app.get('/api/filters', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'rule-1',
        name: 'Important Emails',
        description: 'Filter for important emails',
        conditions: [],
        actions: [],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ],
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'get-filters'
    }
  });
});

// 报告API
app.get('/api/reports', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'report-1',
        title: 'Weekly Email Report',
        type: 'weekly',
        generatedAt: new Date().toISOString(),
        data: {
          totalEmails: 50,
          unreadEmails: 5,
          categories: {
            important: 10,
            social: 20,
            promotions: 15,
            updates: 5
          }
        }
      }
    ],
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'get-reports'
    }
  });
});

// 统计数据API
app.get('/api/stats/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalEmails: 1250,
      unreadEmails: 45,
      todayEmails: 12,
      importantEmails: 8,
      categories: {
        important: 120,
        social: 340,
        promotions: 280,
        updates: 150,
        spam: 45,
        other: 315
      },
      trends: {
        thisWeek: 85,
        lastWeek: 92,
        change: -7.6
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'dashboard-stats'
    }
  });
});

// 工作流API
app.get('/api/workflows', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'workflow-1',
        name: 'Auto Archive Old Emails',
        description: 'Automatically archive emails older than 30 days',
        isActive: true,
        lastRun: new Date().toISOString(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'get-workflows'
    }
  });
});

// Microsoft Graph API 模拟
app.get('/api/graph/auth-url', (req, res) => {
  res.json({
    success: true,
    data: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test&response_type=code&redirect_uri=http://localhost:3000/auth/callback&scope=https://graph.microsoft.com/Mail.Read'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'get-auth-url'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: '404-request'
    }
  });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'error-request'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📋 API documentation: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
});