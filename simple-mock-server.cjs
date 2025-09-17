// 简单的HTTP服务器，不依赖外部包
const http = require('http');
const url = require('url');

const PORT = 3001;

// Mock数据
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

// 路由处理
function handleRequest(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  try {
    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Mock API Server is running'
      }));
    }
    else if (pathname === '/api/emails') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          emails: mockEmails,
          total: mockEmails.length
        }
      }));
    }
    else if (pathname === '/api/stats/dashboard') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: mockStats
      }));
    }
    else if (pathname.startsWith('/api/analysis/email/')) {
      const emailId = pathname.split('/').pop();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          emailId: emailId,
          sentiment: Math.random() > 0.5 ? 'positive' : 'neutral',
          urgency: Math.random() > 0.7 ? 'high' : 'medium',
          category: '工作任务',
          confidence: 0.85,
          keyTopics: ['项目', '计划', '会议'],
          summary: '这封邮件讨论了项目相关事宜，需要及时关注。',
          actionRequired: Math.random() > 0.5,
          analysisTimestamp: new Date().toISOString()
        }
      }));
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API endpoint not found'
        }
      }));
    }
  } catch (error) {
    console.error('Error handling request:', error);
    res.writeHead(500);
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }));
  }
}

// 创建HTTP服务器
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 Simple Mock API Server started!`);
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Emails API: http://localhost:${PORT}/api/emails`);
  console.log(`📊 Stats API: http://localhost:${PORT}/api/stats/dashboard`);
  console.log(`⚡ Ready to serve real API format data!`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});