import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Divider,
  useTheme,
  Button,
} from '@mui/material';
import {
  Email as EmailIcon,
  MarkEmailUnread as UnreadIcon,
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  Psychology as PsychologyIcon,
  PriorityHigh as PriorityIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import RealDataService from '@/services/realDataService';

const SimpleDashboard: React.FC = () => {
  const theme = useTheme();

  // 状态管理
  const [statsData, setStatsData] = useState([
    {
      title: '总邮件数',
      value: '1,234',
      change: '+12%',
      icon: <EmailIcon />,
      color: theme.palette.primary.main,
    },
    {
      title: '未读邮件',
      value: '23',
      change: '-5%',
      icon: <UnreadIcon />,
      color: theme.palette.warning.main,
    },
    {
      title: '今日处理',
      value: '89',
      change: '+23%',
      icon: <TrendingUpIcon />,
      color: theme.palette.success.main,
    },
    {
      title: 'AI分析',
      value: '456',
      change: '+8%',
      icon: <PsychologyIcon />,
      color: theme.palette.info.main,
    },
  ]);

  const [sentimentData, setSentimentData] = useState([
    { name: '积极', value: 65, color: '#4caf50' },
    { name: '中性', value: 25, color: '#ff9800' },
    { name: '消极', value: 10, color: '#f44336' },
  ]);

  const [volumeData, setVolumeData] = useState([
    { name: '周一', emails: 120 },
    { name: '周二', emails: 150 },
    { name: '周三', emails: 180 },
    { name: '周四', emails: 140 },
    { name: '周五', emails: 200 },
    { name: '周六', emails: 80 },
    { name: '周日', emails: 60 },
  ]);

  const [recentEmails, setRecentEmails] = useState([
    {
      id: 1,
      sender: 'John Smith',
      subject: '项目进度更新',
      time: '10:30 AM',
      priority: 'high',
      sentiment: 'positive',
    },
    {
      id: 2,
      sender: 'Sarah Chen',
      subject: '会议安排确认',
      time: '09:15 AM',
      priority: 'medium',
      sentiment: 'neutral',
    },
    {
      id: 3,
      sender: 'Mike Johnson',
      subject: '系统维护通知',
      time: '08:45 AM',
      priority: 'low',
      sentiment: 'negative',
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);

  // 加载真实数据
  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    try {
      setLoading(true);

      // 测试API连接
      const health = await RealDataService.healthCheck();
      console.log('✅ API连接成功:', health);
      setApiConnected(true);

      // 获取仪表板统计数据
      const statsResponse = await RealDataService.getDashboardStats();
      console.log('📊 获取统计数据:', statsResponse);

      // 提取数据部分
      const stats = statsResponse.data || statsResponse;

      // 更新统计数据
      setStatsData([
        {
          title: '总邮件数',
          value: stats.totalEmails?.toLocaleString() || '0',
          change: '+12%',
          icon: <EmailIcon />,
          color: theme.palette.primary.main,
        },
        {
          title: '未读邮件',
          value: stats.unreadEmails?.toString() || '0',
          change: '-5%',
          icon: <UnreadIcon />,
          color: theme.palette.warning.main,
        },
        {
          title: '今日处理',
          value: stats.processedToday?.toString() || '0',
          change: '+3%',
          icon: <TrendingUpIcon />,
          color: theme.palette.success.main,
        },
        {
          title: '响应时间',
          value: `${stats.avgResponseTime || 0}h`,
          change: '+8%',
          icon: <PsychologyIcon />,
          color: theme.palette.info.main,
        },
      ]);

      // 获取最近邮件
      const emailsResponse = await RealDataService.getRecentEmails();
      console.log('📧 获取最近邮件:', emailsResponse);

      // 提取邮件数据并转换格式
      const emailsData = emailsResponse.data || emailsResponse;
      if (Array.isArray(emailsData)) {
        const formattedEmails = emailsData.slice(0, 5).map((email) => ({
          id: email.id,
          sender: email.from?.name || '未知发件人',
          subject: email.subject || '无主题',
          time: new Date(email.receivedDateTime).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          priority: email.importance || 'normal',
          sentiment: email.analysis?.sentiment || 'neutral',
        }));
        setRecentEmails(formattedEmails);
      }

      // 获取邮件量数据
      const volume = await RealDataService.getEmailVolume();
      console.log('📈 获取邮件量数据:', volume);
      setVolumeData(volume);

    } catch (error) {
      console.error('❌ 加载真实数据失败:', error);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'neutral': return '😐';
      case 'negative': return '😞';
      default: return '😐';
    }
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            📊 仪表板
          </Typography>
          <Chip
            label={apiConnected ? 'API已连接' : '离线模式'}
            color={apiConnected ? 'success' : 'warning'}
            size="small"
            icon={apiConnected ? <RefreshIcon /> : <NotificationsIcon />}
          />
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            sx={{ mr: 1 }}
            onClick={loadRealData}
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新数据'}
          </Button>
          <IconButton color="primary">
            <NotificationsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {statsData.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div" fontWeight="bold">
                      {stat.value}
                    </Typography>
                    <Chip
                      label={stat.change}
                      size="small"
                      color={stat.change.startsWith('+') ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Avatar sx={{ bgcolor: stat.color, width: 56, height: 56 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 图表区域 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 邮件情感分析 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 情感分析
              </Typography>
              <Box sx={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                {sentimentData.map((item, index) => (
                  <Chip
                    key={index}
                    label={`${item.name} ${item.value}%`}
                    size="small"
                    sx={{ bgcolor: item.color, color: 'white' }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 邮件量趋势 */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 本周邮件量趋势
              </Typography>
              <Box sx={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="emails" fill={theme.palette.primary.main} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 最近邮件 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📧 最近邮件
              </Typography>
              <List>
                {recentEmails.map((email, index) => (
                  <React.Fragment key={email.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getPriorityColor(email.priority) }}>
                          {email.sender.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {email.subject}
                            </Typography>
                            <Chip
                              label={email.priority}
                              size="small"
                              color={email.priority === 'high' ? 'error' : email.priority === 'medium' ? 'warning' : 'success'}
                            />
                          </Box>
                        }
                        secondary={`来自: ${email.sender} • ${email.time}`}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">
                          {getSentimentIcon(email.sentiment)}
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < recentEmails.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* 快速操作 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚡ 快速操作
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesomeIcon />}
                  fullWidth
                >
                  AI智能分析
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PriorityIcon />}
                  fullWidth
                >
                  优先级排序
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TimerIcon />}
                  fullWidth
                >
                  响应时间分析
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  fullWidth
                >
                  批量操作
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimpleDashboard;