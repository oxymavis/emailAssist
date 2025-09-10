import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Email as EmailIcon,
  MarkEmailUnread as UnreadIcon,
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  Psychology as PsychologyIcon,
  PriorityHigh as PriorityIcon,
  AutoAwesome as AutoAwesomeIcon,
  Sync as SyncIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonCard } from '@/components/common/Loading';
import { useDashboardStats, useEmails, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { sentimentColors } from '@/themes';

// 统计卡片组件
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color, 
  trend 
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 3 }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
              <TrendingUpIcon 
                fontSize="small" 
                sx={{ 
                  color: trend.isPositive ? 'success.main' : 'error.main',
                  transform: trend.isPositive ? 'none' : 'rotate(180deg)',
                  mr: 0.5
                }}
              />
              <Typography 
                variant="caption" 
                sx={{ 
                  color: trend.isPositive ? 'success.main' : 'error.main',
                  fontWeight: 500
                }}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

// 最近邮件列表组件
interface RecentEmailsProps {
  emails: any[];
  onEmailClick: (email: any) => void;
}

const RecentEmails: React.FC<RecentEmailsProps> = ({ emails, onEmailClick }) => {
  const { t } = useTranslation();
  
  return (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 0 }}>
      <Box sx={{ p: 3, pb: 1 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {t('dashboard.recentActivity')}
        </Typography>
      </Box>
      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {emails.slice(0, 8).map((email, index) => (
          <React.Fragment key={email.id}>
            <ListItem 
              button 
              onClick={() => onEmailClick(email)}
              sx={{ px: 3 }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: email.isRead ? 'grey.300' : 'primary.main' }}>
                  {email.isRead ? <EmailIcon /> : <UnreadIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" noWrap>
                    {email.subject}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {t('common.from')}: {email.sender.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(email.receivedDateTime), 'MM-dd HH:mm', { locale: zhCN })}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Chip
                  label={email.importance}
                  size="small"
                  color={email.importance === 'high' ? 'error' : email.importance === 'normal' ? 'primary' : 'default'}
                  variant="outlined"
                />
              </ListItemSecondaryAction>
            </ListItem>
            {index < emails.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </CardContent>
  </Card>
  );
};

// 图表组件
const SentimentChart: React.FC<{ data: any[] }> = ({ data }) => {
  const { t } = useTranslation();
  
  return (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        {t('dashboard.sentimentDistribution')}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
  );
};

const TrendChart: React.FC<{ data: any[] }> = ({ data }) => {
  const { t } = useTranslation();
  
  return (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        {t('dashboard.emailAnalysisOverview')}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="emails" stroke="#2196F3" name={t('dashboard.emailVolume')} />
          <Line type="monotone" dataKey="processed" stroke="#4CAF50" name={t('common.processed')} />
          <Line type="monotone" dataKey="urgent" stroke="#F44336" name={t('common.urgent')} />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
  );
};

  const CategoryChart: React.FC<{ data: any[] }> = ({ data }) => {
    const { t } = useTranslation();
    
    return (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
{t('reports.categoriesStatistics')}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#FF9800" />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
  );
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { stats, setStats } = useDashboardStats();
  const { emails, setEmails, selectEmail } = useEmails();
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 初始化数据
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 获取模拟数据
        const mockEmails = mockDataService.getEmails(30);
        const mockStats = mockDataService.getDashboardStats();
        
        setEmails(mockEmails);
        setStats(mockStats);
        
        // 添加欢迎通知
        addNotification({
          type: 'info',
          title: t('dashboard.welcomeMessage'),
          message: t('common.dataLoaded'),
        });
      } catch (error) {
        console.error('Dashboard initialization failed:', error);
        addNotification({
          type: 'error',
          title: t('dashboard.loadError'),
          message: t('common.loadingError'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [setEmails, setStats, addNotification]);

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockStats = mockDataService.getDashboardStats();
      setStats({
        ...mockStats,
        lastSyncTime: new Date().toISOString(),
      });
      
      addNotification({
        type: 'success',
        title: t('dashboard.refreshSuccess'),
        message: t('common.refreshSuccess'),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: t('dashboard.refreshError'),
        message: t('common.refreshError'),
      });
    } finally {
      setRefreshing(false);
    }
  };

  // 处理邮件点击
  const handleEmailClick = (email: any) => {
    selectEmail(email);
    addNotification({
      type: 'info',
      title: t('common.emailSelected'),
      message: `${t('common.selected')}: "${email.subject}"`,
    });
  };

  // 生成图表数据
  const sentimentData = [
    { name: t('common.positive'), value: 132, color: sentimentColors.positive },
    { name: t('common.neutral'), value: 89, color: sentimentColors.neutral },
    { name: t('common.negative'), value: 13, color: sentimentColors.negative },
  ];

  const trendData = mockDataService.getTrendData(7);
  const categoryData = mockDataService.getCategoryStats().slice(0, 6);

  return (
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.welcomeMessage')}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
{refreshing ? t('dashboard.syncing') : t('dashboard.syncData')}
          </Button>
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <LoadingState 
        loading={loading} 
        skeleton={
          <Grid container spacing={3}>
            {Array.from({ length: 4 }, (_, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <SkeletonCard />
              </Grid>
            ))}
          </Grid>
        }
      >
        {/* 统计卡片 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title={t('dashboard.emailsProcessed')}
              value={stats.totalEmails.toLocaleString()}
              subtitle={t('dashboard.emailVolume')}
              icon={<EmailIcon />}
              color={theme.palette.primary.main}
              trend={{ value: 12, isPositive: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title={t('common.unread')}
              value={stats.unreadEmails}
              subtitle={t('common.pending')}
              icon={<UnreadIcon />}
              color={theme.palette.warning.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title={t('dashboard.todaysStats')}
              value={stats.processedToday}
              subtitle={t('common.completed')}
              icon={<PsychologyIcon />}
              color={theme.palette.success.main}
              trend={{ value: 8, isPositive: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title={t('dashboard.avgResponseTime')}
              value={`${stats.avgResponseTime}h`}
              subtitle={t('dashboard.responseRate')}
              icon={<TimerIcon />}
              color={theme.palette.info.main}
              trend={{ value: 15, isPositive: false }}
            />
          </Grid>
        </Grid>

        {/* 快速指标 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <PsychologyIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
{t('dashboard.aiAnalysisScore')}
                </Typography>
                <Typography variant="h3" color="primary.main" fontWeight="bold">
                  {stats.sentimentScore}/10
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
{t('dashboard.positiveEmailTrend')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <PriorityIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
{t('dashboard.urgentEmails')}
                </Typography>
                <Typography variant="h3" color="error.main" fontWeight="bold">
                  {stats.urgentEmails}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
{t('dashboard.priorityEmailsDesc')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <AutoAwesomeIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
{t('dashboard.automationSavings')}
                </Typography>
                <Typography variant="h3" color="success.main" fontWeight="bold">
                  {stats.automationSavings}h
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
{t('dashboard.timeSavedToday')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 图表和邮件列表 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TrendChart data={trendData} />
              </Grid>
              <Grid item xs={12} md={6}>
                <SentimentChart data={sentimentData} />
              </Grid>
              <Grid item xs={12} md={6}>
                <CategoryChart data={categoryData} />
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} md={4}>
            <RecentEmails emails={emails} onEmailClick={handleEmailClick} />
          </Grid>
        </Grid>

        {/* 同步状态 */}
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.default' }}>
          <Box display="flex" alignItems="center" justifyContent="between">
            <Typography variant="body2" color="text.secondary">
{t('dashboard.lastSyncTime')}: {format(new Date(stats.lastSyncTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
            </Typography>
            <Chip
              label={t('dashboard.connectedToGraph')}
              color="success"
              variant="outlined"
              size="small"
              sx={{ ml: 'auto' }}
            />
          </Box>
        </Paper>
      </LoadingState>
    </Box>
  );
};

export default Dashboard;