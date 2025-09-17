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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Tooltip,
  Stack,
  Divider,
  TextField,
  InputAdornment,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  OutboxOutlined,
  ExpandMore,
  SmartToy,
  TrendingUp,
  Psychology,
  Category,
  Speed,
  Search,
  Clear
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
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
  },
});

// 侧边栏菜单项
const menuItems = [
  { text: '仪表板', icon: <Dashboard />, id: 'dashboard' },
  { text: '邮件列表', icon: <Email />, id: 'emails' },
  { text: 'AI分析', icon: <SmartToy />, id: 'ai-analysis' },
  { text: '过滤规则', icon: <FilterList />, id: 'filters' },
  { text: '工作流', icon: <Settings />, id: 'workflows' },
  { text: '报告', icon: <Report />, id: 'reports' },
  { text: '设置', icon: <Settings />, id: 'settings' },
];

// API配置 - 使用AI增强后端
const API_BASE_URL = 'http://localhost:3001/api';

interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  keywords: string[];
  summary: string;
  actionRequired: boolean;
  suggestedActions: string[];
  confidence: number;
  analyzedAt: string;
  model?: string;
}

interface EnhancedEmail {
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
  aiAnalysis?: AIAnalysis;
  hasAiAnalysis?: boolean;
}

interface AuthStatus {
  isConnected: boolean;
  email?: string;
  lastSync?: string;
}

interface DashboardStats {
  totalEmails: number;
  unreadEmails: number;
  pendingAnalysis: number;
  ruleMatches: number;
  aiAnalysisEnabled: boolean;
  cacheSize?: number;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

// AI增强API服务
const aiOutlookService = {
  // 获取认证状态
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

  // 开始Microsoft认证
  async startAuth(): Promise<{ authUrl: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/microsoft?userId=temp-user-shelia`);
      if (!response.ok) throw new Error('Failed to initiate auth');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Auth initiation failed:', error);
      throw error;
    }
  },

  // 获取带AI分析的邮件 (支持分页和搜索)
  async getUnreadEmails(page: number = 1, pageSize: number = 20, search: string = ''): Promise<{
    unreadEmails: EnhancedEmail[],
    count: number,
    userEmail: string,
    lastSync: string,
    aiAnalysisEnabled: boolean,
    pagination: PaginationInfo
  }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: search.trim()
      });

      const response = await fetch(`${API_BASE_URL}/email/unread?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error('Failed to fetch emails');
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Email fetch failed:', error);
      throw error;
    }
  },

  // 获取特定邮件的详细分析
  async getEmailAnalysis(emailId: string): Promise<AIAnalysis> {
    try {
      const response = await fetch(`${API_BASE_URL}/email/analyze/${emailId}`);
      if (!response.ok) throw new Error('Failed to get email analysis');
      const result = await response.json();
      return result.data.analysis;
    } catch (error) {
      console.error('Email analysis failed:', error);
      throw error;
    }
  },

  // 获取仪表板统计
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/stats/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Stats fetch failed:', error);
      return {
        totalEmails: 0,
        unreadEmails: 0,
        pendingAnalysis: 0,
        ruleMatches: 0,
        aiAnalysisEnabled: false
      };
    }
  }
};

// AI分析结果显示组件
const AIAnalysisDisplay: React.FC<{ analysis: AIAnalysis }> = ({ analysis }) => {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      default: return 'default';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  return (
    <Card sx={{ mt: 1, mb: 1, bgcolor: 'rgba(25, 118, 210, 0.04)' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" mb={1}>
          <SmartToy color="primary" sx={{ mr: 1 }} />
          <Typography variant="subtitle2" color="primary">
            AI 智能分析
          </Typography>
          <Chip
            label={`置信度: ${(analysis.confidence * 100).toFixed(0)}%`}
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Grid container spacing={1} mb={2}>
          <Grid item xs={6}>
            <Chip
              icon={<Psychology />}
              label={`情感: ${analysis.sentiment}`}
              color={getSentimentColor(analysis.sentiment)}
              size="small"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={6}>
            <Chip
              icon={<Speed />}
              label={`紧急度: ${analysis.urgency}`}
              color={getUrgencyColor(analysis.urgency)}
              size="small"
              variant="outlined"
            />
          </Grid>
        </Grid>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            📝 智能摘要:
          </Typography>
          <Typography variant="body2" sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: 1 }}>
            {analysis.summary}
          </Typography>
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            🏷️ 分类:
            <Chip label={analysis.category} size="small" sx={{ ml: 1 }} />
          </Typography>
        </Box>

        {analysis.keywords.length > 0 && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              🔑 关键词:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5}>
              {analysis.keywords.map((keyword, index) => (
                <Chip
                  key={index}
                  label={keyword}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}

        {analysis.actionRequired && analysis.suggestedActions.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              💡 建议操作:
            </Typography>
            <List dense sx={{ py: 0 }}>
              {analysis.suggestedActions.map((action, index) => (
                <ListItem key={index} sx={{ py: 0, px: 1 }}>
                  <ListItemText
                    primary={`• ${action}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          分析时间: {new Date(analysis.analyzedAt).toLocaleString()}
          {analysis.model && ` • 模型: ${analysis.model}`}
        </Typography>
      </CardContent>
    </Card>
  );
};

// 邮件列表项组件
const EmailListItem: React.FC<{ email: EnhancedEmail, onAnalyze?: (id: string) => void }> = ({
  email,
  onAnalyze
}) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance.toLowerCase()) {
      case 'high': return 'error';
      case 'normal': return 'default';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getUrgencyIcon = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return '🚨';
      case 'high': return '⚡';
      case 'medium': return '📍';
      default: return '📝';
    }
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      sx={{
        mb: 1,
        boxShadow: 1,
        '&:before': { display: 'none' }
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ width: '100%' }}>
          <Grid container alignItems="center" spacing={1}>
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ width: 32, height: 32, mr: 1, fontSize: '0.75rem' }}>
                  {email.from.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}
                  >
                    {email.from.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {email.from.address}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box textAlign="right">
                <Box display="flex" alignItems="center" justifyContent="flex-end" mb={0.5}>
                  {email.aiAnalysis && (
                    <Tooltip title={`AI分析: ${email.aiAnalysis.urgency}紧急度`}>
                      <span style={{ marginRight: 4 }}>
                        {getUrgencyIcon(email.aiAnalysis.urgency)}
                      </span>
                    </Tooltip>
                  )}
                  {email.hasAttachments && (
                    <Chip label="📎" size="small" sx={{ mr: 0.5, minWidth: 'auto', height: 20 }} />
                  )}
                  {email.importance === 'high' && (
                    <Chip
                      label="重要"
                      color={getImportanceColor(email.importance)}
                      size="small"
                      sx={{ mr: 0.5, height: 20 }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(email.receivedAt)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}>
                  {email.subject}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {email.preview}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />

        {email.hasAiAnalysis && email.aiAnalysis ? (
          <AIAnalysisDisplay analysis={email.aiAnalysis} />
        ) : (
          <Card sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SmartToy sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                AI分析暂未完成
              </Typography>
              {onAnalyze && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SmartToy />}
                  onClick={() => onAnalyze(email.id)}
                >
                  启动分析
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Box mt={2} display="flex" gap={1}>
          <Button
            size="small"
            variant="outlined"
            href={email.webLink}
            target="_blank"
            rel="noopener"
          >
            在Outlook中查看
          </Button>
          <Button size="small" variant="text">
            标记已读
          </Button>
          <Button size="small" variant="text">
            归档
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

const EmailAssistAI: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isConnected: false });
  const [emails, setEmails] = useState<EnhancedEmail[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmails: 0,
    unreadEmails: 0,
    pendingAnalysis: 0,
    ruleMatches: 0,
    aiAnalysisEnabled: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authDialog, setAuthDialog] = useState(false);

  // 分页和搜索状态
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    hasMore: false,
    hasPrevious: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      const status = await aiOutlookService.getAuthStatus();
      setAuthStatus(status);
      return status;
    } catch (error) {
      console.error('Auth check failed:', error);
      setError('认证状态检查失败');
      return { isConnected: false };
    }
  };

  // 获取邮件和统计数据
  const fetchData = async (page: number = 1, pageSize: number = 20, search: string = '') => {
    setLoading(true);
    setError(null);

    try {
      const authStatus = await checkAuthStatus();

      if (authStatus.isConnected) {
        // 并行获取邮件和统计数据
        const [emailData, statsData] = await Promise.all([
          aiOutlookService.getUnreadEmails(page, pageSize, search),
          aiOutlookService.getDashboardStats()
        ]);

        setEmails(emailData.unreadEmails);
        setStats(statsData);
        if (emailData.pagination) {
          setPagination(emailData.pagination);
        }

        console.log(`✅ 获取到 ${emailData.unreadEmails.length} 封邮件，总计: ${emailData.pagination?.totalCount || 0}，AI分析: ${statsData.aiAnalysisEnabled ? '已启用' : '未启用'}`);
      } else {
        setEmails([]);
        setStats({
          totalEmails: 0,
          unreadEmails: 0,
          pendingAnalysis: 0,
          ruleMatches: 0,
          aiAnalysisEnabled: false
        });
        setPagination({
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false
        });
      }
    } catch (error: any) {
      console.error('Data fetch failed:', error);
      if (error.message === 'Authentication required') {
        setError('请重新进行Outlook认证');
        setAuthStatus({ isConnected: false });
      } else {
        setError(`数据获取失败: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 启动Microsoft认证
  const handleAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const { authUrl } = await aiOutlookService.startAuth();

      // 打开认证窗口
      window.open(authUrl, '_blank', 'width=600,height=600,scrollbars=yes,resizable=yes');

      setAuthDialog(false);

      // 监听认证成功
      const checkInterval = setInterval(async () => {
        const status = await checkAuthStatus();
        if (status.isConnected) {
          clearInterval(checkInterval);
          await fetchData();
        }
      }, 3000);

      // 清理定时器
      setTimeout(() => clearInterval(checkInterval), 60000);

    } catch (error: any) {
      console.error('认证启动失败:', error);
      setError(`认证启动失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 启动特定邮件分析
  const handleAnalyzeEmail = async (emailId: string) => {
    try {
      setLoading(true);
      const analysis = await aiOutlookService.getEmailAnalysis(emailId);

      // 更新邮件列表中的分析结果
      setEmails(prevEmails =>
        prevEmails.map(email =>
          email.id === emailId
            ? { ...email, aiAnalysis: analysis, hasAiAnalysis: true }
            : email
        )
      );

    } catch (error: any) {
      console.error('邮件分析失败:', error);
      setError(`邮件分析失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    fetchData(page, pagination.pageSize, searchQuery);
  };

  // 处理页面大小变化
  const handlePageSizeChange = (event: any) => {
    const newPageSize = parseInt(event.target.value);
    fetchData(1, newPageSize, searchQuery);
  };

  // 处理搜索
  const handleSearch = () => {
    const trimmedQuery = searchInputValue.trim();
    setSearchQuery(trimmedQuery);
    fetchData(1, pagination.pageSize, trimmedQuery);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchInputValue('');
    setSearchQuery('');
    fetchData(1, pagination.pageSize, '');
  };

  // 监听回车键搜索
  const handleSearchKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  // 页面初始化
  useEffect(() => {
    fetchData();

    // 设置定时刷新
    const interval = setInterval(() => {
      fetchData(pagination.currentPage, pagination.pageSize, searchQuery);
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, []);

  // 渲染仪表板
  const renderDashboard = () => (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          AI智能邮件助手 - 仪表板
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          基于DeepSeek AI的智能邮件分析系统
        </Typography>
      </Box>

      {/* 认证状态卡片 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <Microsoft sx={{ fontSize: 40, color: authStatus.isConnected ? 'green' : 'grey' }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h6">
                Outlook 连接状态
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {authStatus.isConnected
                  ? `已连接: ${authStatus.email} • 最后同步: ${authStatus.lastSync ? new Date(authStatus.lastSync).toLocaleString() : '未知'}`
                  : '未连接 - 需要进行Microsoft认证'
                }
              </Typography>
            </Grid>
            <Grid item>
              {authStatus.isConnected ? (
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchData}
                  disabled={loading}
                >
                  刷新数据
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Microsoft />}
                  onClick={() => setAuthDialog(true)}
                  disabled={loading}
                >
                  连接Outlook
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Email sx={{ mr: 2, color: 'primary.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="h6">
                    总邮件数
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalEmails}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <OutboxOutlined sx={{ mr: 2, color: 'warning.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="h6">
                    收件箱邮件
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalEmails}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <SmartToy sx={{ mr: 2, color: stats.aiAnalysisEnabled ? 'success.main' : 'grey.500' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="h6">
                    AI分析状态
                  </Typography>
                  <Typography variant="h6" color={stats.aiAnalysisEnabled ? 'success.main' : 'text.secondary'}>
                    {stats.aiAnalysisEnabled ? '已启用' : '未启用'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp sx={{ mr: 2, color: 'info.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="h6">
                    分析缓存
                  </Typography>
                  <Typography variant="h4">
                    {stats.cacheSize || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 最近邮件预览 */}
      {authStatus.isConnected && emails.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              收件箱最新AI分析邮件 (前5封)
            </Typography>
            {emails.slice(0, 5).map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onAnalyze={handleAnalyzeEmail}
              />
            ))}
            {emails.length > 5 && (
              <Box textAlign="center" mt={2}>
                <Button
                  variant="text"
                  onClick={() => setCurrentPage('emails')}
                >
                  查看全部 {emails.length} 封邮件
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );

  // 渲染邮件列表
  const renderEmails = () => (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          收件箱邮件 - AI智能分析
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          收件箱中共 {pagination.totalCount} 封邮件 (包括已读和未读)
        </Typography>
      </Box>

      {/* 搜索和控制栏 */}
      {authStatus.isConnected && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="搜索邮件主题、发件人或内容..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: searchInputValue && (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={handleClearSearch}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        <Clear />
                      </Button>
                    </InputAdornment>
                  )
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>每页显示</InputLabel>
                <Select
                  value={pagination.pageSize}
                  label="每页显示"
                  onChange={handlePageSizeChange}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSearch}
                startIcon={<Search />}
                disabled={loading}
              >
                搜索
              </Button>
            </Grid>
          </Grid>

          {/* 搜索结果提示 */}
          {searchQuery && (
            <Box sx={{ mt: 2, p: 1, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="body2" color="white">
                搜索关键词: "{searchQuery}" • 找到 {pagination.totalCount} 个结果
                <Button
                  size="small"
                  color="inherit"
                  onClick={handleClearSearch}
                  sx={{ ml: 1, color: 'white' }}
                >
                  清除搜索
                </Button>
              </Typography>
            </Box>
          )}
        </Card>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {authStatus.isConnected ? (
        emails.length > 0 ? (
          <Box>
            {/* 邮件列表 */}
            {emails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onAnalyze={handleAnalyzeEmail}
              />
            ))}

            {/* 分页控件 */}
            {pagination.totalPages > 1 && (
              <Card sx={{ mt: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center" justifyContent="center">
                  <Grid item xs={12} md={6}>
                    <Box display="flex" justifyContent="center">
                      <Pagination
                        count={pagination.totalPages}
                        page={pagination.currentPage}
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                        size="large"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      第 {pagination.currentPage} 页，共 {pagination.totalPages} 页 •
                      显示第 {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} 项，
                      总共 {pagination.totalCount} 项
                    </Typography>
                  </Grid>
                </Grid>
              </Card>
            )}
          </Box>
        ) : searchQuery ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Search sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                没有找到匹配的邮件
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                搜索关键词: "{searchQuery}"
              </Typography>
              <Button
                variant="outlined"
                onClick={handleClearSearch}
                sx={{ mt: 2 }}
              >
                清除搜索条件
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                太棒了！收件箱很干净
              </Typography>
              <Typography variant="body2" color="text.secondary">
                您已经处理完所有邮件了
              </Typography>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Microsoft sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              请先连接Outlook
            </Typography>
            <Button
              variant="contained"
              startIcon={<Microsoft />}
              onClick={() => setAuthDialog(true)}
              sx={{ mt: 2 }}
            >
              连接Outlook
            </Button>
          </CardContent>
        </Card>
      )}
    </Container>
  );

  // 渲染AI分析页面
  const renderAIAnalysis = () => (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          AI 智能分析中心
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          基于DeepSeek AI的邮件智能分析
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                分析统计
              </Typography>

              {stats.aiAnalysisEnabled ? (
                <Box>
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      情感分布
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={75}
                      sx={{ height: 8, borderRadius: 4, mb: 1 }}
                    />
                    <Typography variant="caption">
                      积极: 75% • 中性: 20% • 消极: 5%
                    </Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      紧急度分布
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={60}
                      color="warning"
                      sx={{ height: 8, borderRadius: 4, mb: 1 }}
                    />
                    <Typography variant="caption">
                      高: 10% • 中: 50% • 低: 40%
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    热门关键词
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {['会议', '项目', '报告', '审批', '通知'].map((keyword) => (
                      <Chip key={keyword} label={keyword} size="small" />
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Alert severity="warning">
                  AI分析功能未启用，请检查配置
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                AI 功能状态
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    {stats.aiAnalysisEnabled ? <CheckCircle color="success" /> : <ErrorIcon color="error" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="DeepSeek AI"
                    secondary={stats.aiAnalysisEnabled ? '运行正常' : '未配置'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Psychology color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="情感分析"
                    secondary="自动检测邮件情感倾向"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Speed color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="紧急度评估"
                    secondary="智能判断邮件重要程度"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Category color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary="自动分类"
                    secondary="按内容自动分类邮件"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  // 渲染主要内容
  const renderMainContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard();
      case 'emails':
        return renderEmails();
      case 'ai-analysis':
        return renderAIAnalysis();
      default:
        return (
          <Container>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6">
                  {menuItems.find(item => item.id === currentPage)?.text || '功能开发中'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  该功能正在开发中，敬请期待...
                </Typography>
              </CardContent>
            </Card>
          </Container>
        );
    }
  };

  // 侧边栏内容
  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Email Assist AI
        </Typography>
      </Toolbar>
      <MuiList>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={currentPage === item.id}
            onClick={() => {
              setCurrentPage(item.id);
              setDrawerOpen(false);
            }}
          >
            <ListItemIcon>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        ))}
      </MuiList>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* 顶部应用栏 */}
      <AppBar position="fixed">
        <Toolbar>
          <Button
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </Button>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Email Assist AI - {menuItems.find(item => item.id === currentPage)?.text}
          </Typography>

          {/* 状态指示器 */}
          <Box display="flex" alignItems="center" gap={2}>
            {stats.aiAnalysisEnabled && (
              <Chip
                icon={<SmartToy />}
                label="AI已启用"
                color="success"
                size="small"
                variant="outlined"
              />
            )}
            <Badge
              color={authStatus.isConnected ? 'success' : 'error'}
              variant="dot"
            >
              <AccountCircle />
            </Badge>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 侧边栏 */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 280
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* 主内容区域 */}
      <Box component="main" sx={{ p: 3, mt: 8 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderMainContent()}
      </Box>

      {/* Microsoft认证对话框 */}
      <Dialog open={authDialog} onClose={() => setAuthDialog(false)}>
        <DialogTitle>连接Microsoft Outlook</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Microsoft sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              点击下方按钮开始Microsoft认证流程
            </Typography>
            <Typography variant="body2" color="text.secondary">
              将在新窗口中打开Microsoft登录页面
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleAuth}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Microsoft />}
          >
            开始认证
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default EmailAssistAI;