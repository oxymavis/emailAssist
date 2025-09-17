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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Avatar,
  Badge
} from '@mui/material';
import {
  Dashboard,
  Email,
  Analytics,
  FilterList,
  Report,
  Settings,
  Menu as MenuIcon,
  Refresh,
  Microsoft,
  CheckCircle,
  Error as ErrorIcon,
  AccountCircle,
  OutboxOutlined
} from '@mui/icons-material';

// 创建主题
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#00b4d8',
    },
  },
});

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

// API配置 - 使用真实后端
const API_BASE_URL = 'http://localhost:3001/api';

interface RealEmail {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  conversationId?: string;
  webLink?: string;
}

interface AuthStatus {
  isConnected: boolean;
  email?: string;
  lastSync?: string;
}

// 真实API服务
const outlookApiService = {
  // 获取Microsoft认证状态
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/microsoft/status?userId=temp-user-shelia`);
      if (!response.ok) throw new Error('Failed to check auth status');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Auth status check failed:', error);
      return { isConnected: false };
    }
  },

  // 获取Microsoft认证URL
  async getAuthUrl(): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/microsoft?userId=temp-user-shelia`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const result = await response.json();
      return result.data.authUrl;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      throw error;
    }
  },

  // 获取真实邮件列表
  async fetchRealEmails(): Promise<RealEmail[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/email/unread`, {
        headers: {
          'Authorization': 'Bearer your-jwt-token', // 在实际应用中需要真实的JWT token
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('AUTHENTICATION_REQUIRED');
        }
        throw new Error('Failed to fetch emails');
      }

      const result = await response.json();
      return result.data.unreadEmails;
    } catch (error) {
      console.error('Failed to fetch real emails:', error);
      throw error;
    }
  },

  // 获取邮件账户信息
  async getEmailAccounts(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/email/accounts`, {
        headers: {
          'Authorization': 'Bearer your-jwt-token',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch accounts');
      const result = await response.json();
      return result.data.accounts;
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      return [];
    }
  },

  // 获取仪表板统计
  async fetchDashboardStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/stats/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // 返回默认统计数据
      return {
        totalEmails: 0,
        unreadEmails: 0,
        pendingAnalysis: 0,
        ruleMatches: 0
      };
    }
  }
};

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [emails, setEmails] = useState<RealEmail[]>([]);
  const [stats, setStats] = useState({ totalEmails: 0, unreadEmails: 0, pendingAnalysis: 0, ruleMatches: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isConnected: false });
  const [authDialog, setAuthDialog] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 初始化检查认证状态
  useEffect(() => {
    checkAuthStatus();
    loadDashboardStats();
  }, []);

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      const status = await outlookApiService.getAuthStatus();
      setAuthStatus(status);

      if (status.isConnected) {
        // 如果已连接，获取邮件和账户信息
        await loadEmails();
        await loadAccounts();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  };

  // 加载邮件
  const loadEmails = async () => {
    if (!authStatus.isConnected) return;

    setLoading(true);
    setError('');
    try {
      const realEmails = await outlookApiService.fetchRealEmails();
      setEmails(realEmails);
    } catch (error: any) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        setError('需要重新认证Outlook账户');
        setAuthStatus({ isConnected: false });
      } else {
        setError('获取邮件失败: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 加载账户信息
  const loadAccounts = async () => {
    try {
      const accountData = await outlookApiService.getEmailAccounts();
      setAccounts(accountData);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  // 加载仪表板统计
  const loadDashboardStats = async () => {
    try {
      const statsData = await outlookApiService.fetchDashboardStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  // 启动Outlook认证
  const startOutlookAuth = async () => {
    try {
      const authUrl = await outlookApiService.getAuthUrl();
      // 在新窗口中打开认证页面
      window.open(authUrl, 'outlook-auth', 'width=600,height=600,scrollbars=yes,resizable=yes');
      setAuthDialog(false);

      // 监听认证完成事件
      const authCheckInterval = setInterval(async () => {
        const status = await outlookApiService.getAuthStatus();
        if (status.isConnected) {
          clearInterval(authCheckInterval);
          setAuthStatus(status);
          await loadEmails();
          await loadAccounts();
        }
      }, 2000);

      // 10分钟后停止检查
      setTimeout(() => clearInterval(authCheckInterval), 600000);
    } catch (error) {
      console.error('Failed to start auth:', error);
      setError('启动认证失败');
    }
  };

  // 刷新数据
  const refreshData = async () => {
    if (authStatus.isConnected) {
      await loadEmails();
      await loadDashboardStats();
    } else {
      await checkAuthStatus();
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 格式化邮件时间
  const formatEmailTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else {
      return '刚刚';
    }
  };

  // 获取重要性颜色
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'error';
      case 'normal': return 'primary';
      case 'low': return 'default';
      default: return 'primary';
    }
  };

  // 渲染仪表板内容
  const renderDashboard = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          📊 智能邮件仪表板
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6" color="primary">
            {formatTime(currentTime)}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={refreshData}
            disabled={loading}
          >
            刷新
          </Button>
        </Box>
      </Box>

      {/* 认证状态卡片 */}
      <Card sx={{ mb: 3, bgcolor: authStatus.isConnected ? '#e8f5e8' : '#fff3e0' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: authStatus.isConnected ? '#4caf50' : '#ff9800' }}>
              {authStatus.isConnected ? <CheckCircle /> : <Microsoft />}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6">
                Outlook 连接状态
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {authStatus.isConnected
                  ? `已连接: ${authStatus.email || 'shelia.sun@item.com'}`
                  : '未连接到Outlook邮箱'
                }
              </Typography>
              {authStatus.lastSync && (
                <Typography variant="caption" color="text.secondary">
                  最后同步: {formatEmailTime(authStatus.lastSync)}
                </Typography>
              )}
            </Box>
            {!authStatus.isConnected && (
              <Button
                variant="contained"
                startIcon={<Microsoft />}
                onClick={() => setAuthDialog(true)}
                color="primary"
              >
                连接Outlook
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                总邮件数
              </Typography>
              <Typography variant="h4">
                {stats.totalEmails}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                未读邮件
              </Typography>
              <Typography variant="h4" color="error">
                {authStatus.isConnected ? emails.length : stats.unreadEmails}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                待分析
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.pendingAnalysis}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                规则匹配
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.ruleMatches}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 邮件预览 */}
      {authStatus.isConnected && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📧 最新未读邮件 (来自 shelia.sun@item.com)
            </Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            ) : emails.length > 0 ? (
              <List>
                {emails.slice(0, 5).map((email) => (
                  <ListItem key={email.id} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1">
                            {email.subject}
                          </Typography>
                          <Chip
                            label={getImportanceColor(email.importance)}
                            size="small"
                            color={getImportanceColor(email.importance) as any}
                          />
                          {email.hasAttachments && (
                            <Chip label="附件" size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            来自: {email.from.name} ({email.from.address})
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {email.preview}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatEmailTime(email.receivedAt)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                🎉 太棒了！你的收件箱很干净，没有未读邮件。
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {!authStatus.isConnected && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          请先连接你的Outlook账户以查看真实邮件数据
        </Alert>
      )}
    </Box>
  );

  // 渲染邮件列表
  const renderEmails = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          📧 邮件列表
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadEmails}
          disabled={loading || !authStatus.isConnected}
        >
          刷新邮件
        </Button>
      </Box>

      {!authStatus.isConnected ? (
        <Alert severity="warning">
          请先在设置页面连接你的Outlook账户
        </Alert>
      ) : loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Card>
          <CardContent>
            {emails.length > 0 ? (
              <List>
                {emails.map((email) => (
                  <ListItem key={email.id} divider>
                    <ListItemIcon>
                      <Badge badgeContent={email.hasAttachments ? '📎' : null}>
                        <Email color={email.isRead ? 'disabled' : 'primary'} />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}
                          >
                            {email.subject}
                          </Typography>
                          <Chip
                            label={email.importance}
                            size="small"
                            color={getImportanceColor(email.importance) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            来自: {email.from.name} &lt;{email.from.address}&gt;
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {email.preview}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                            <Typography variant="caption" color="text.secondary">
                              {formatEmailTime(email.receivedAt)}
                            </Typography>
                            {email.webLink && (
                              <Link
                                href={email.webLink}
                                target="_blank"
                                rel="noopener"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                在Outlook中打开
                              </Link>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                🎉 没有未读邮件！
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );

  // 渲染设置页面
  const renderSettings = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        ⚙️ 设置
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📧 邮件账户连接
          </Typography>

          {/* Outlook连接状态 */}
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: authStatus.isConnected ? '#4caf50' : '#ccc' }}>
              <Microsoft />
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle1">
                Microsoft Outlook
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {authStatus.isConnected
                  ? `已连接: ${authStatus.email || 'shelia.sun@item.com'}`
                  : '未连接'
                }
              </Typography>
            </Box>
            <Button
              variant={authStatus.isConnected ? "outlined" : "contained"}
              color={authStatus.isConnected ? "error" : "primary"}
              onClick={() => authStatus.isConnected ? checkAuthStatus() : setAuthDialog(true)}
            >
              {authStatus.isConnected ? '断开连接' : '连接账户'}
            </Button>
          </Box>

          {/* 账户列表 */}
          {accounts.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                已连接账户:
              </Typography>
              {accounts.map((account) => (
                <Box key={account.id} display="flex" alignItems="center" gap={2} p={1} bgcolor="#f5f5f5" borderRadius={1}>
                  <AccountCircle color="primary" />
                  <Box flex={1}>
                    <Typography variant="body2">{account.email}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      状态: {account.status} | 最后同步: {formatEmailTime(account.lastSync)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  // 渲染其他页面的占位内容
  const renderPlaceholder = (title: string, icon: string) => (
    <Box>
      <Typography variant="h4" gutterBottom>
        {icon} {title}
      </Typography>
      <Alert severity="info">
        {title}功能正在开发中，敬请期待！
      </Alert>
    </Box>
  );

  // 根据当前视图渲染内容
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return renderDashboard();
      case 'emails':
        return renderEmails();
      case 'settings':
        return renderSettings();
      case 'analysis':
        return renderPlaceholder('智能分析', '🧠');
      case 'filters':
        return renderPlaceholder('过滤规则', '🔍');
      case 'workflows':
        return renderPlaceholder('工作流', '⚙️');
      case 'reports':
        return renderPlaceholder('报告', '📊');
      default:
        return renderDashboard();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {/* 侧边栏 */}
        <Drawer
          variant="permanent"
          sx={{
            width: 240,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 240,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              📧 Email Assist
            </Typography>
          </Toolbar>
          <Box sx={{ overflow: 'auto' }}>
            <MuiList>
              {menuItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={currentView === item.id}
                  onClick={() => setCurrentView(item.id)}
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

        {/* 主内容区 */}
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Toolbar />
          {renderContent()}
        </Box>
      </Box>

      {/* 认证对话框 */}
      <Dialog open={authDialog} onClose={() => setAuthDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Microsoft color="primary" />
            连接Microsoft Outlook
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            为了获取你的真实邮件数据，需要连接到你的Microsoft Outlook账户。
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            目标账户: <strong>shelia.sun@item.com</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            点击"开始认证"将在新窗口中打开Microsoft登录页面。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialog(false)}>
            取消
          </Button>
          <Button
            onClick={startOutlookAuth}
            variant="contained"
            startIcon={<Microsoft />}
          >
            开始认证
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;