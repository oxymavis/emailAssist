import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Drawer,
  List as MuiList,
  ListItemIcon,
  ListItemButton,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Dashboard,
  Email,
  Analytics,
  FilterList,
  Report,
  Settings,
  Menu as MenuIcon,
  Refresh
} from '@mui/icons-material';

// 创建简单主题
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

// 模拟邮件数据
const mockEmails = [
  {
    id: '1',
    subject: '项目进度更新 - Q4计划',
    from: { name: '张三', email: 'zhangsan@company.com' },
    content: '关于Q4项目计划的更新，需要您的确认。附件包含详细的时间表和资源分配计划，请查收。',
    receivedAt: '2024-01-15T09:30:00Z',
    isRead: false,
    priority: 'high',
    sentiment: 'neutral',
    urgency: 0.8,
    category: '工作',
    hasAttachments: true,
    size: '2.3MB'
  },
  {
    id: '2',
    subject: '会议安排 - 下周一早上9点',
    from: { name: '王五', email: 'wangwu@company.com' },
    content: '下周一早上9点会议室A开会，请准时参加。会议主题：产品功能评审与优化方案讨论。',
    receivedAt: '2024-01-15T10:15:00Z',
    isRead: true,
    priority: 'medium',
    sentiment: 'positive',
    urgency: 0.6,
    category: '会议',
    hasAttachments: false,
    size: '1.2KB'
  },
  {
    id: '3',
    subject: '客户反馈 - 产品改进建议',
    from: { name: '李四', email: 'lisi@client.com' },
    content: '客户对我们的产品提出了一些改进建议，特别是在用户界面和性能优化方面。请查看详细反馈。',
    receivedAt: '2024-01-15T11:00:00Z',
    isRead: false,
    priority: 'high',
    sentiment: 'positive',
    urgency: 0.9,
    category: '客户',
    hasAttachments: true,
    size: '4.1MB'
  },
  {
    id: '4',
    subject: '系统维护通知 - 本周末服务器升级',
    from: { name: '系统管理员', email: 'admin@company.com' },
    content: '本周末（1月20-21日）将进行服务器升级维护，期间服务可能短暂中断，请提前做好准备。',
    receivedAt: '2024-01-15T14:20:00Z',
    isRead: true,
    priority: 'medium',
    sentiment: 'neutral',
    urgency: 0.4,
    category: '通知',
    hasAttachments: false,
    size: '856B'
  },
  {
    id: '5',
    subject: '团队建设活动邀请 - 下月户外拓展',
    from: { name: '人事部', email: 'hr@company.com' },
    content: '为增强团队凝聚力，公司将于下月举办户外拓展活动，请查看详细安排并确认参与。',
    receivedAt: '2024-01-15T16:45:00Z',
    isRead: false,
    priority: 'low',
    sentiment: 'positive',
    urgency: 0.2,
    category: '活动',
    hasAttachments: true,
    size: '1.8MB'
  }
];

// 模拟统计数据
const mockStats = {
  totalEmails: 2456,
  unreadEmails: 23,
  pendingAnalysis: 5,
  ruleMatches: 18
};

// 侧边栏菜单项
const menuItems = [
  { text: '仪表板', icon: <Dashboard />, id: 'dashboard' },
  { text: '邮件列表', icon: <Email />, id: 'emails' },
  { text: '智能分析', icon: <Analytics />, id: 'analysis' },
  { text: '过滤规则', icon: <FilterList />, id: 'filters' },
  { text: '工作流', icon: <Settings />, id: 'workflows' },
  { text: '报告', icon: <Report />, id: 'reports' },
  { text: '设置', icon: <Settings />, id: 'settings' },
];

// API配置
const API_BASE_URL = 'http://localhost:3002/api';

// API服务
const apiService = {
  async fetchEmails() {
    try {
      const response = await fetch(`${API_BASE_URL}/emails`);
      if (!response.ok) throw new Error('Failed to fetch emails');
      const result = await response.json();
      return result.data.items; // 返回邮件数组
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  async fetchDashboardStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/stats/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      const result = await response.json();
      return result.data; // 返回统计数据对象
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
};

const EmailAssistApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // API数据状态
  const [emails, setEmails] = useState(mockEmails);
  const [stats, setStats] = useState(mockStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRealData, setUseRealData] = useState(false);

  // 实时时间更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 获取真实数据
  const fetchRealData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [emailsData, statsData] = await Promise.all([
        apiService.fetchEmails(),
        apiService.fetchDashboardStats()
      ]);

      // 为API数据添加缺失的字段
      const enrichedEmails = emailsData.map((email: any) => ({
        ...email,
        size: email.size || Math.random() > 0.5 ? `${(Math.random() * 5 + 0.5).toFixed(1)}MB` : `${Math.floor(Math.random() * 999 + 1)}KB`,
        category: email.category || '工作',
      }));

      setEmails(enrichedEmails);
      setStats(statsData);
      setUseRealData(true);
    } catch (err) {
      setError('无法连接到后端服务，使用模拟数据');
      setUseRealData(false);
    } finally {
      setLoading(false);
    }
  };

  // 切换到模拟数据
  const useMockData = () => {
    setEmails(mockEmails);
    setStats(mockStats);
    setUseRealData(false);
    setError(null);
  };

  // 渲染仪表板页面
  const renderDashboard = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">
          📊 Email Assist 仪表板
        </Typography>

        <Box display="flex" gap={2} alignItems="center">
          {error && (
            <Alert severity="warning" sx={{ minWidth: 200 }}>
              {error}
            </Alert>
          )}

          <Box display="flex" gap={1}>
            <Button
              variant={useRealData ? "contained" : "outlined"}
              color="primary"
              startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
              onClick={fetchRealData}
              disabled={loading}
            >
              {loading ? '获取中...' : '真实数据'}
            </Button>

            <Button
              variant={!useRealData ? "contained" : "outlined"}
              color="secondary"
              onClick={useMockData}
              disabled={loading}
            >
              模拟数据
            </Button>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                📧 总邮件数
              </Typography>
              <Typography variant="h4">
                {stats.totalEmails}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                数据源: {useRealData ? '真实API' : '模拟数据'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error">
                🔔 未读邮件
              </Typography>
              <Typography variant="h4">
                {stats.unreadEmails}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                待处理邮件
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                ⏳ 待分析
              </Typography>
              <Typography variant="h4">
                {stats.pendingAnalysis}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                AI分析队列
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                🎯 规则匹配
              </Typography>
              <Typography variant="h4">
                {stats.ruleMatches}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                自动化处理
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 数据状态信息 */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📡 系统状态
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Chip
                label={`数据源: ${useRealData ? '真实API' : '模拟数据'}`}
                color={useRealData ? 'success' : 'default'}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Chip
                label={`API状态: ${error ? '离线' : '在线'}`}
                color={error ? 'error' : 'success'}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Chip
                label={`邮件总数: ${emails.length}`}
                color="info"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Chip
                label={`未读: ${emails.filter(e => !e.isRead).length}`}
                color="warning"
                variant="outlined"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );

  // 渲染邮件列表页面
  const renderEmails = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">
          📧 邮件列表
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Chip
            label={`数据源: ${useRealData ? '真实API' : '模拟数据'}`}
            color={useRealData ? 'success' : 'default'}
            size="small"
          />
          <Chip label={`总计: ${emails.length}封`} color="primary" />
          <Chip label={`未读: ${emails.filter(e => !e.isRead).length}封`} color="error" />

          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={fetchRealData}
            disabled={loading}
          >
            刷新
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" sx={{ mb: 2 }}>
          <CircularProgress />
        </Box>
      )}

      <List>
        {emails.map((email) => (
          <Card key={email.id} sx={{
            mb: 2,
            bgcolor: email.isRead ? 'background.paper' : 'action.hover',
            border: email.priority === 'high' ? '2px solid' : '1px solid',
            borderColor: email.priority === 'high' ? 'error.main' : 'divider'
          }}>
            <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2 }}>
              {/* 邮件头部信息 */}
              <Box display="flex" justifyContent="space-between" width="100%" alignItems="flex-start">
                <Box sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Typography variant="h6" sx={{
                      fontWeight: email.isRead ? 400 : 700,
                      color: email.isRead ? 'text.primary' : 'primary.main'
                    }}>
                      {email.subject}
                    </Typography>
                    {!email.isRead && <Chip label="新" size="small" color="secondary" />}
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    📤 {email.from.name} ({email.from.email})
                  </Typography>

                  <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.5 }}>
                    {email.content}
                  </Typography>
                </Box>

                <Box sx={{ ml: 2, minWidth: 120, textAlign: 'right' }}>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(email.receivedAt).toLocaleString('zh-CN')}
                  </Typography>
                  <Typography variant="caption" display="block" color="textSecondary">
                    大小: {email.size}
                  </Typography>
                </Box>
              </Box>

              {/* 邮件标签和分析信息 */}
              <Box display="flex" gap={1} flexWrap="wrap" width="100%">
                <Chip
                  label={`优先级: ${email.priority}`}
                  size="small"
                  color={email.priority === 'high' ? 'error' :
                         email.priority === 'medium' ? 'warning' : 'default'}
                />
                <Chip
                  label={`类别: ${email.category}`}
                  size="small"
                  color="info"
                />
                <Chip
                  label={`情感: ${email.sentiment}`}
                  size="small"
                  color={email.sentiment === 'positive' ? 'success' :
                         email.sentiment === 'negative' ? 'error' : 'default'}
                />
                <Chip
                  label={`紧急度: ${Math.round(email.urgency * 100)}%`}
                  size="small"
                  variant="outlined"
                />
                {email.hasAttachments && (
                  <Chip
                    label="📎 有附件"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>

              {/* AI 分析摘要 */}
              <Box sx={{
                mt: 2,
                p: 1.5,
                bgcolor: 'action.selected',
                borderRadius: 1,
                width: '100%'
              }}>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                  🤖 AI分析摘要:
                </Typography>
                <Typography variant="body2">
                  这封邮件{email.sentiment === 'positive' ? '表达了积极的态度' :
                          email.sentiment === 'negative' ? '可能包含负面情绪' : '语调中性'}，
                  属于{email.category}类邮件，紧急度为{Math.round(email.urgency * 100)}%
                  {email.priority === 'high' ? '，建议优先处理' : ''}。
                  {email.hasAttachments ? ' 邮件包含附件，请注意查看。' : ''}
                </Typography>
              </Box>
            </ListItem>
          </Card>
        ))}
      </List>

      {/* 邮件操作工具栏 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 批量操作
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Chip label="🔴 标记为已读" clickable color="primary" />
            <Chip label="⭐ 添加星标" clickable color="warning" />
            <Chip label="📁 移动到文件夹" clickable color="info" />
            <Chip label="🗑️ 删除选中" clickable color="error" />
            <Chip label="🏷️ 批量标记" clickable color="success" />
          </Box>
        </CardContent>
      </Card>
    </Container>
  );

  // 渲染智能分析页面
  const renderAnalysis = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        🔍 智能分析
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 情感分析统计
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="积极情感: 45%" color="success" />
                <Chip label="中性情感: 38%" color="default" />
                <Chip label="消极情感: 17%" color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚡ 紧急度分布
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="高紧急: 12%" color="error" />
                <Chip label="中紧急: 34%" color="warning" />
                <Chip label="低紧急: 54%" color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🎯 AI 分析结果
          </Typography>
          <List>
            {mockEmails.map((email) => (
              <Card key={email.id} sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={email.subject}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          AI分析: 这封邮件{email.sentiment === 'positive' ? '表达了积极的态度' :
                                  email.sentiment === 'negative' ? '可能包含负面情绪' : '语调中性'},
                          紧急度为 {Math.round(email.urgency * 100)}%
                        </Typography>
                        <Box display="flex" gap={1} sx={{ mt: 1 }}>
                          <Chip
                            label={`情感: ${email.sentiment}`}
                            size="small"
                            color={email.sentiment === 'positive' ? 'success' :
                                   email.sentiment === 'negative' ? 'error' : 'default'}
                          />
                          <Chip
                            label={`优先级: ${email.priority}`}
                            size="small"
                            color={email.priority === 'high' ? 'error' :
                                   email.priority === 'medium' ? 'warning' : 'info'}
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              </Card>
            ))}
          </List>
        </CardContent>
      </Card>
    </Container>
  );

  // 渲染过滤规则页面
  const renderFilters = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        🎯 过滤规则
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ➕ 创建新规则
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  规则名称: 高优先级邮件
                </Typography>
                <Typography variant="body2">
                  条件: 包含关键词 "紧急", "重要", "ASAP"
                </Typography>
                <Typography variant="body2">
                  动作: 标记为高优先级并发送通知
                </Typography>
                <Chip label="规则状态: 活跃" color="success" size="small" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 现有规则列表
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="客户支持邮件"
                    secondary="自动分类至支持文件夹"
                  />
                  <Chip label="活跃" color="success" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="营销邮件过滤"
                    secondary="自动移至推广文件夹"
                  />
                  <Chip label="活跃" color="success" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="团队协作邮件"
                    secondary="标记为团队类别"
                  />
                  <Chip label="暂停" color="default" size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  // 渲染报告页面
  const renderReports = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        📊 报告
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                📈 本周邮件量
              </Typography>
              <Typography variant="h4">
                +23%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                相比上周增长
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                ⚡ 平均响应时间
              </Typography>
              <Typography variant="h4">
                2.3h
              </Typography>
              <Typography variant="body2" color="textSecondary">
                比目标快30分钟
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                🎯 规则命中率
              </Typography>
              <Typography variant="h4">
                87%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                过滤规则有效性
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                🤖 AI准确率
              </Typography>
              <Typography variant="h4">
                94%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                情感分析准确度
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 详细报告
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="每日邮件处理报告"
                secondary="今日处理了45封邮件，其中23封为高优先级"
              />
              <Chip label="今日" color="primary" size="small" />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="周度效率分析"
                secondary="本周平均响应时间缩短15%，客户满意度提升"
              />
              <Chip label="本周" color="success" size="small" />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="月度趋势报告"
                secondary="邮件量同比增长35%，AI分析准确率稳定在94%以上"
              />
              <Chip label="本月" color="info" size="small" />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Container>
  );

  // 渲染工作流页面
  const renderWorkflows = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        🔄 工作流管理
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                🎯 Trello 集成
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                自动创建卡片至Trello看板
              </Typography>
              <Chip label="已连接" color="success" size="small" />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                🔗 Jira 集成
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                自动创建任务至Jira项目
              </Typography>
              <Chip label="未连接" color="default" size="small" />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                📝 Asana 集成
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                自动创建任务至Asana项目
              </Typography>
              <Chip label="配置中" color="warning" size="small" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🚀 活跃工作流
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="高优先级邮件 → Trello卡片"
                secondary="当邮件被标记为高优先级时，自动在Trello中创建卡片"
              />
              <Box>
                <Chip label="已启用" color="success" size="small" sx={{ mr: 1 }} />
                <Chip label="本周触发: 23次" color="info" size="small" />
              </Box>
            </ListItem>
            <ListItem>
              <ListItemText
                primary="客户询问 → 支持工单"
                secondary="客户邮件自动创建支持工单并分配给对应团队"
              />
              <Box>
                <Chip label="已启用" color="success" size="small" sx={{ mr: 1 }} />
                <Chip label="本周触发: 15次" color="info" size="small" />
              </Box>
            </ListItem>
            <ListItem>
              <ListItemText
                primary="项目邮件 → Jira任务"
                secondary="项目相关邮件自动创建Jira任务并通知团队"
              />
              <Box>
                <Chip label="已暂停" color="default" size="small" sx={{ mr: 1 }} />
                <Chip label="待配置Jira" color="warning" size="small" />
              </Box>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ➕ 创建新工作流
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                <strong>触发条件:</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 邮件包含特定关键词
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 发件人来源特定域名
              </Typography>
              <Typography variant="body2">
                • 邮件被标记特定标签
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                <strong>执行动作:</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 创建Trello/Jira/Asana任务
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 发送团队通知
              </Typography>
              <Typography variant="body2">
                • 自动回复邮件
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                <strong>集成状态:</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label="✅ Trello API 已连接" color="success" size="small" />
                <Chip label="❌ Jira API 未配置" color="error" size="small" />
                <Chip label="⚠️ Asana API 配置中" color="warning" size="small" />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );

  // 渲染设置页面
  const renderSettings = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        ⚙️ 设置
      </Typography>

      <Grid container spacing={3}>
        {/* 邮件账户连接 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📧 连接你的真实邮件账户
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                当前显示的是模拟数据。要查看你的真实邮件，请连接你的邮件账户。
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary">
                      📮 Gmail
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      连接Google邮箱
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => alert('Gmail集成正在开发中...')}
                      fullWidth
                    >
                      连接 Gmail
                    </Button>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="info.main">
                      📫 Outlook
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      连接Microsoft邮箱
                    </Typography>
                    <Button
                      variant="contained"
                      color="info"
                      onClick={() => alert('Outlook集成正在开发中...')}
                      fullWidth
                    >
                      连接 Outlook
                    </Button>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="secondary.main">
                      📪 IMAP
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      通用IMAP协议
                    </Typography>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => alert('IMAP集成正在开发中...')}
                      fullWidth
                    >
                      配置 IMAP
                    </Button>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔔 通知设置
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="高优先级邮件通知" />
                  <Chip label="开启" color="success" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="每日摘要报告" />
                  <Chip label="开启" color="success" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="规则匹配提醒" />
                  <Chip label="关闭" color="default" size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🎨 界面设置
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="深色主题" />
                  <Chip label="关闭" color="default" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="紧凑视图" />
                  <Chip label="开启" color="success" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="语言设置" />
                  <Chip label="中文" color="primary" size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔐 邮箱连接状态
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="warning.main">
                    邮箱连接状态: ❌ 未连接真实邮箱
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="info.main">
                    当前数据源: {useRealData ? 'Mock API' : '本地模拟数据'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    数据加密: ✅ 启用
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    最后同步: 从未同步真实邮件
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 开发说明 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🛠️ 开发说明
              </Typography>
              <Typography variant="body2" paragraph>
                要连接真实邮件，需要完成以下配置：
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="1. Gmail API配置"
                    secondary="需要在Google Cloud Console配置OAuth 2.0客户端ID"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="2. Microsoft Graph API配置"
                    secondary="需要在Azure App注册中配置应用权限"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="3. IMAP服务器配置"
                    secondary="需要邮件服务器地址、端口和认证信息"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  // 根据当前页面渲染内容
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard();
      case 'emails':
        return renderEmails();
      case 'analysis':
        return renderAnalysis();
      case 'filters':
        return renderFilters();
      case 'workflows':
        return renderWorkflows();
      case 'reports':
        return renderReports();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {/* 顶部导航栏 */}
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              📧 Email Assist - 智能邮件管理系统
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2">
                🕒 {currentTime.toLocaleTimeString('zh-CN')}
              </Typography>
              <Typography variant="body2">
                v2.0 - 正常运行中 ✅
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        {/* 侧边栏 */}
        <Drawer
          variant="permanent"
          sx={{
            width: 240,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: 240,
              boxSizing: 'border-box',
              top: 64 // 避开顶部导航栏
            },
          }}
        >
          <Box sx={{ overflow: 'auto', mt: 1 }}>
            <MuiList>
              {menuItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={currentPage === item.id}
                  onClick={() => setCurrentPage(item.id)}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ))}
            </MuiList>
          </Box>
        </Drawer>

        {/* 主内容区域 */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            p: 3,
            mt: 8, // 为顶部导航栏留出空间
          }}
        >
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default EmailAssistApp;