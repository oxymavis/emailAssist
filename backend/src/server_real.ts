import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Pool } from 'pg';
import config from 'dotenv';
import path from 'path';

// 加载环境变量
import('dotenv').then(dotenv => {
  dotenv.config({ path: path.join(__dirname, '../.env') });
});

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库连接池
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'email_assist',
  user: process.env.DB_USER || 'shelia',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 中间件
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 数据库连接测试
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// ===== 仪表板API =====
app.get('/api/v1/dashboard/stats', async (req, res) => {
  try {
    // 模拟统计数据（后续可以从数据库获取真实数据）
    const stats = {
      totalEmails: 2847,
      unreadEmails: 156,
      todayEmails: 89,
      importantEmails: 23,
      processedEmails: 2691,
      efficiency: 94.5,
      avgResponseTime: 2.3,
      aiAccuracy: 89.2
    };

    res.json(stats);
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

app.get('/api/v1/dashboard/recent-emails', async (req, res) => {
  try {
    // 模拟最近邮件数据
    const recentEmails = [
      {
        id: '1',
        subject: '项目进度更新 - Q4计划',
        sender: 'John Smith',
        senderEmail: 'john@example.com',
        time: '10:30 AM',
        isRead: false,
        priority: 'high',
        sentiment: 'neutral'
      },
      {
        id: '2',
        subject: '会议安排确认',
        sender: 'Sarah Chen',
        senderEmail: 'sarah@company.com',
        time: '09:15 AM',
        isRead: true,
        priority: 'medium',
        sentiment: 'positive'
      },
      {
        id: '3',
        subject: 'AI分析报告 - 本周邮件总结',
        sender: 'AI Assistant',
        senderEmail: 'ai@emailassist.com',
        time: '07:30 AM',
        isRead: false,
        priority: 'medium',
        sentiment: 'neutral'
      }
    ];

    res.json(recentEmails);
  } catch (error) {
    console.error('Failed to get recent emails:', error);
    res.status(500).json({ error: 'Failed to get recent emails' });
  }
});

app.get('/api/v1/dashboard/email-volume', async (req, res) => {
  try {
    const emailVolume = [
      { date: '周一', received: 45, sent: 12, processed: 38 },
      { date: '周二', received: 52, sent: 18, processed: 44 },
      { date: '周三', received: 48, sent: 15, processed: 41 },
      { date: '周四', received: 61, sent: 22, processed: 55 },
      { date: '周五', received: 55, sent: 19, processed: 48 },
      { date: '周六', received: 23, sent: 8, processed: 20 },
      { date: '周日', received: 18, sent: 5, processed: 15 }
    ];

    res.json(emailVolume);
  } catch (error) {
    console.error('Failed to get email volume:', error);
    res.status(500).json({ error: 'Failed to get email volume' });
  }
});

// ===== 分析API =====
app.get('/api/v1/analysis/sentiment', async (req, res) => {
  try {
    const sentimentData = [
      { name: '积极', value: 45, color: '#4caf50' },
      { name: '中性', value: 35, color: '#ff9800' },
      { name: '消极', value: 20, color: '#f44336' }
    ];

    res.json(sentimentData);
  } catch (error) {
    console.error('Failed to get sentiment analysis:', error);
    res.status(500).json({ error: 'Failed to get sentiment analysis' });
  }
});

app.get('/api/v1/analysis/categories', async (req, res) => {
  try {
    const categories = [
      { name: '工作', count: 156, percentage: 42, trend: '+5%' },
      { name: '个人', count: 89, percentage: 24, trend: '+2%' },
      { name: '通知', count: 67, percentage: 18, trend: '-1%' },
      { name: '营销', count: 34, percentage: 9, trend: '-3%' },
      { name: '垃圾邮件', count: 25, percentage: 7, trend: '-2%' }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

app.get('/api/v1/analysis/ai-suggestions', async (req, res) => {
  try {
    const suggestions = [
      {
        id: '1',
        type: 'priority',
        title: '高优先级邮件检测',
        description: '发现3封来自重要客户的邮件，建议优先处理',
        count: 3,
        action: '查看详情'
      },
      {
        id: '2',
        type: 'filter',
        title: '智能过滤建议',
        description: '建议为营销邮件创建自动过滤规则',
        count: 15,
        action: '创建规则'
      },
      {
        id: '3',
        type: 'workflow',
        title: '工作流优化',
        description: '检测到重复性任务，建议创建自动化工作流',
        count: 8,
        action: '设置工作流'
      }
    ];

    res.json(suggestions);
  } catch (error) {
    console.error('Failed to get AI suggestions:', error);
    res.status(500).json({ error: 'Failed to get AI suggestions' });
  }
});

// ===== 邮件API =====
app.get('/api/v1/emails', async (req, res) => {
  try {
    const { folder = 'inbox', page = 1, limit = 20 } = req.query;

    // 模拟邮件数据
    const emails = {
      inbox: [
        {
          id: '1',
          sender: { name: 'John Smith', email: 'john@example.com', avatar: 'J' },
          subject: '项目进度更新 - Q4计划',
          preview: '关于我们Q4项目的最新进展，需要您的反馈...',
          time: '10:30 AM',
          isRead: false,
          isStarred: true,
          priority: 'high',
          attachments: 2,
          labels: ['工作', '紧急']
        },
        {
          id: '2',
          sender: { name: 'Sarah Chen', email: 'sarah@company.com', avatar: 'S' },
          subject: '会议安排确认',
          preview: '明天下午2点的团队会议，请确认您的参与...',
          time: '09:15 AM',
          isRead: true,
          isStarred: false,
          priority: 'medium',
          attachments: 0,
          labels: ['会议']
        }
      ],
      sent: [
        {
          id: '5',
          sender: { name: '我', email: 'me@company.com', avatar: 'Me' },
          subject: 'Re: 项目提案审核',
          preview: '感谢您的提案，我已经仔细审阅...',
          time: '昨天',
          isRead: true,
          isStarred: false,
          priority: 'medium',
          attachments: 0,
          labels: ['工作']
        }
      ],
      drafts: [
        {
          id: '6',
          sender: { name: '草稿', email: '', avatar: '📝' },
          subject: '关于下一季度预算分配',
          preview: '各部门负责人，关于下一季度的预算...',
          time: '草稿',
          isRead: true,
          isStarred: false,
          priority: 'medium',
          attachments: 1,
          labels: ['预算']
        }
      ]
    };

    const folderEmails = emails[folder as keyof typeof emails] || emails.inbox;

    res.json({
      emails: folderEmails,
      total: folderEmails.length,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      hasMore: false
    });
  } catch (error) {
    console.error('Failed to get emails:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// ===== 过滤规则API =====
app.get('/api/v1/filters', async (req, res) => {
  try {
    const filters = [
      {
        id: '1',
        name: '重要邮件自动标记',
        description: '包含"紧急"或"重要"关键词的邮件自动标记为高优先级',
        isActive: true,
        conditions: [
          { field: 'subject', operator: 'contains', value: '紧急' },
          { field: 'content', operator: 'contains', value: '重要' }
        ],
        actions: [
          { type: 'label', value: '重要' },
          { type: 'markAsRead' }
        ],
        priority: 1,
        matchCount: 142,
        successRate: 98.5
      },
      {
        id: '2',
        name: '会议邮件分类',
        description: '自动识别并分类会议相关邮件',
        isActive: true,
        conditions: [
          { field: 'subject', operator: 'contains', value: '会议' },
          { field: 'content', operator: 'contains', value: '议程' }
        ],
        actions: [
          { type: 'label', value: '会议' },
          { type: 'move', value: '会议文件夹' }
        ],
        priority: 2,
        matchCount: 67,
        successRate: 100
      }
    ];

    res.json(filters);
  } catch (error) {
    console.error('Failed to get filters:', error);
    res.status(500).json({ error: 'Failed to get filters' });
  }
});

app.post('/api/v1/filters', async (req, res) => {
  try {
    const { name, description, conditions, actions, priority } = req.body;

    // 这里应该保存到数据库
    const newFilter = {
      id: Date.now().toString(),
      name,
      description,
      conditions,
      actions,
      priority,
      isActive: true,
      matchCount: 0,
      successRate: 0,
      createdAt: new Date().toISOString()
    };

    res.status(201).json(newFilter);
  } catch (error) {
    console.error('Failed to create filter:', error);
    res.status(500).json({ error: 'Failed to create filter' });
  }
});

// ===== 报告API =====
app.get('/api/v1/reports/email-volume', async (req, res) => {
  try {
    const data = [
      { date: '周一', received: 45, sent: 12, processed: 38 },
      { date: '周二', received: 52, sent: 18, processed: 44 },
      { date: '周三', received: 48, sent: 15, processed: 41 },
      { date: '周四', received: 61, sent: 22, processed: 55 },
      { date: '周五', received: 55, sent: 19, processed: 48 },
      { date: '周六', received: 23, sent: 8, processed: 20 },
      { date: '周日', received: 18, sent: 5, processed: 15 }
    ];

    res.json(data);
  } catch (error) {
    console.error('Failed to get email volume report:', error);
    res.status(500).json({ error: 'Failed to get email volume report' });
  }
});

app.get('/api/v1/reports/efficiency', async (req, res) => {
  try {
    const metrics = [
      { metric: '平均响应时间', value: '2.3小时', trend: '+12%' },
      { metric: '处理完成率', value: '94.5%', trend: '+5%' },
      { metric: '过滤准确率', value: '96.8%', trend: '+2%' },
      { metric: '重要邮件识别', value: '89.2%', trend: '+8%' }
    ];

    res.json(metrics);
  } catch (error) {
    console.error('Failed to get efficiency report:', error);
    res.status(500).json({ error: 'Failed to get efficiency report' });
  }
});

// ===== 工作流API =====
app.get('/api/v1/workflows', async (req, res) => {
  try {
    const workflows = [
      {
        id: '1',
        name: '重要邮件通知',
        description: '收到重要邮件时自动发送Slack通知给团队',
        isActive: true,
        trigger: {
          type: 'email_received',
          condition: '重要性 = 高 且 发件人包含 @client.com'
        },
        actions: [
          { type: 'notification', config: { channel: 'slack', message: '收到重要客户邮件' }, enabled: true },
          { type: 'create_task', config: { assignee: '项目经理', priority: '高' }, enabled: true }
        ],
        lastRun: '2小时前',
        status: 'success',
        executions: 142,
        successRate: 98.5
      },
      {
        id: '2',
        name: '每日邮件总结',
        description: '每天下午6点自动生成并发送邮件分析报告',
        isActive: true,
        trigger: {
          type: 'time_based',
          condition: '每天 18:00'
        },
        actions: [
          { type: 'send_email', config: { to: 'team@company.com', template: 'daily_summary' }, enabled: true }
        ],
        lastRun: '昨天',
        status: 'success',
        executions: 67,
        successRate: 100
      }
    ];

    res.json(workflows);
  } catch (error) {
    console.error('Failed to get workflows:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

// ===== 设置API =====
app.get('/api/v1/settings/user', async (req, res) => {
  try {
    const settings = {
      language: 'zh-CN',
      theme: 'auto',
      timezone: 'Asia/Shanghai',
      autoSync: true,
      syncInterval: 15,
      maxEmailsPerSync: 100,
      enableSmartFiltering: true,
      emailNotifications: true,
      pushNotifications: false,
      desktopNotifications: true,
      soundEnabled: true,
      dataRetention: 90,
      anonymizeData: false,
      shareAnalytics: true,
      enableAIAnalysis: true,
      sentimentAnalysis: true,
      autoCategories: true,
      smartSuggestions: true
    };

    res.json(settings);
  } catch (error) {
    console.error('Failed to get user settings:', error);
    res.status(500).json({ error: 'Failed to get user settings' });
  }
});

app.put('/api/v1/settings/user', async (req, res) => {
  try {
    const settings = req.body;

    // 这里应该保存到数据库
    console.log('Updating user settings:', settings);

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to update user settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

app.get('/api/v1/settings/accounts', async (req, res) => {
  try {
    const accounts = [
      {
        id: '1',
        type: 'Microsoft',
        email: 'user@company.com',
        status: 'connected',
        lastSync: '2分钟前'
      },
      {
        id: '2',
        type: 'Gmail',
        email: 'personal@gmail.com',
        status: 'connected',
        lastSync: '10分钟前'
      }
    ];

    res.json(accounts);
  } catch (error) {
    console.error('Failed to get email accounts:', error);
    res.status(500).json({ error: 'Failed to get email accounts' });
  }
});

// 错误处理中间件
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Real API Server started successfully`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await pool.end();
  process.exit(0);
});

export default app;