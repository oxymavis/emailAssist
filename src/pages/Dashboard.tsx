import React, { useEffect, useState, useMemo } from 'react';
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
  Switch,
  FormControlLabel,
  Fab,
  Tooltip,
  Badge,
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
  Edit as EditIcon,
  Dashboard as DashboardIcon,
  GridView as GridViewIcon,
  Settings as SettingsIcon,
  GetApp as ExportIcon,
  Fullscreen as FullscreenIcon,
  WifiOutlined,
  WifiOffOutlined,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonCard } from '@/components/common/Loading';
import { 
  useDashboardStats, 
  useEmails, 
  useNotifications, 
  useDashboardState, 
  useChartData 
} from '@/store';
import realApiService from '@/services/realApi';
import AdvancedChartMockDataService from '@/services/advancedChartMockData';
import { sentimentColors } from '@/themes';

// 引入高级仪表板组件
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import DrillDownDialog from '@/components/dashboard/DrillDownDialog';
import DataExportDialog from '@/components/dashboard/DataExportDialog';
import useRealtimeData from '@/hooks/useRealtimeData';

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
          <RechartsTooltip />
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
          <RechartsTooltip />
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
          <RechartsTooltip />
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
  const { dashboardState, setEditMode } = useDashboardState();
  const {
    setEmailVolumeData,
    setSentimentData,
    setCategoryData,
    setPriorityHeatmapData,
    setResponseTimeData,
    setTopSendersData,
  } = useChartData();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(true);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);

  // 实时数据连接
  const { isConnected, isConnecting, connectionAttempts } = useRealtimeData({
    enabled: isAdvancedMode,
  });

  // 初始化数据
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (isAdvancedMode) {
          // 加载高级图表数据
          const advancedData = AdvancedChartMockDataService.generateDashboardData({
            days: 30,
            includeRealtime: true,
          });
          
          // 设置图表数据
          setEmailVolumeData(advancedData.emailVolumeData);
          setSentimentData(advancedData.sentimentData);
          setCategoryData(advancedData.categoryData);
          setPriorityHeatmapData(advancedData.priorityHeatmapData);
          setResponseTimeData(advancedData.responseTimeData);
          setTopSendersData(advancedData.topSendersData);
        }
        
        // 获取真实数据
        try {
          const [emailsData, statsData] = await Promise.all([
            realApiService.email.getEmails({ limit: 30 }),
            realApiService.stats.getDashboardStats()
          ]);

          setEmails(emailsData.emails || []);
          setStats(statsData || {});
        } catch (apiError) {
          console.warn('API调用失败，使用模拟数据:', apiError);
          // Fallback to mock data if API fails
          const { mockDataService } = await import('@/services/mockData');
          const mockEmails = mockDataService.getEmails(30);
          const mockStats = mockDataService.getDashboardStats();

          setEmails(mockEmails);
          setStats(mockStats);
        }
        
        // 添加欢迎通知
        addNotification({
          type: 'success',
          title: isAdvancedMode ? t('dashboard.advancedModeEnabled') : t('dashboard.welcomeMessage'),
          message: isAdvancedMode ? t('dashboard.advancedFeaturesLoaded') : t('common.dataLoaded'),
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
  }, [isAdvancedMode]); // Only depend on isAdvancedMode, other setters are stable

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      try {
        const statsData = await realApiService.stats.getDashboardStats();
        setStats({
          ...statsData,
          lastSyncTime: new Date().toISOString(),
        });
      } catch (apiError) {
        console.warn('API刷新失败，使用模拟数据:', apiError);
        const { mockDataService } = await import('@/services/mockData');
        const mockStats = mockDataService.getDashboardStats();
        setStats({
          ...mockStats,
          lastSyncTime: new Date().toISOString(),
        });
      }
      
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

  // 处理数据钻取
  const handleDataDrillDown = (data: any, title: string) => {
    setDrillDownData({ ...data, title });
    setDrillDownOpen(true);
  };

  // 处理数据导出
  const handleDataExport = (widgetId?: string, widgetTitle?: string) => {
    setSelectedWidget({ id: widgetId, title: widgetTitle });
    setExportDialogOpen(true);
  };

  // 切换编辑模式
  const handleToggleEditMode = () => {
    setEditMode(!dashboardState.isEditMode);
    addNotification({
      type: 'info',
      title: dashboardState.isEditMode ? t('dashboard.editModeOff') : t('dashboard.editModeOn'),
      message: dashboardState.isEditMode ? t('dashboard.editModeOffDesc') : t('dashboard.editModeOnDesc'),
    });
  };

  // 切换高级模式
  const handleToggleAdvancedMode = () => {
    setIsAdvancedMode(!isAdvancedMode);
    addNotification({
      type: 'info',
      title: !isAdvancedMode ? t('dashboard.advancedModeEnabled') : t('dashboard.basicModeEnabled'),
      message: !isAdvancedMode ? t('dashboard.advancedModeDesc') : t('dashboard.basicModeDesc'),
    });
  };

  // 生成图表数据
  const sentimentData = [
    { name: t('common.positive'), value: 132, color: sentimentColors.positive },
    { name: t('common.neutral'), value: 89, color: sentimentColors.neutral },
    { name: t('common.negative'), value: 13, color: sentimentColors.negative },
  ];

  // 生成图表数据 - 暂时使用基础数据，未来可从API获取
  const trendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => ({
      name: format(new Date(Date.now() - i * 24 * 60 * 60 * 1000), 'MM/dd'),
      emails: Math.floor(Math.random() * 50) + 10,
      analyzed: Math.floor(Math.random() * 30) + 5
    })).reverse();
  }, []);

  const categoryData = useMemo(() => {
    return [
      { name: t('mockData.categories.work'), count: 45, percentage: 25 },
      { name: t('mockData.categories.meeting'), count: 32, percentage: 18 },
      { name: t('mockData.categories.project'), count: 28, percentage: 16 },
      { name: t('mockData.categories.customer'), count: 24, percentage: 14 },
      { name: t('mockData.categories.system'), count: 20, percentage: 11 },
      { name: t('mockData.categories.marketing'), count: 28, percentage: 16 }
    ];
  }, [t]);

  return (
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h4" fontWeight="bold">
              {isAdvancedMode ? t('dashboard.advancedTitle') : t('dashboard.title')}
            </Typography>
            <Chip 
              icon={isAdvancedMode ? <DashboardIcon /> : <GridViewIcon />}
              label={isAdvancedMode ? t('dashboard.advancedMode') : t('dashboard.basicMode')}
              color={isAdvancedMode ? 'primary' : 'default'}
              variant="outlined"
            />
            {isAdvancedMode && (
              <Badge 
                color={isConnected ? 'success' : 'error'}
                variant="dot"
                title={isConnected ? t('dashboard.realtimeConnected') : t('dashboard.realtimeDisconnected')}
              >
                {isConnected ? <WifiOutlined color="success" /> : <WifiOffOutlined color="disabled" />}
              </Badge>
            )}
          </Box>
          <Typography variant="body1" color="text.secondary">
            {isAdvancedMode ? t('dashboard.advancedWelcome') : t('dashboard.welcomeMessage')}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <FormControlLabel
            control={
              <Switch
                checked={isAdvancedMode}
                onChange={handleToggleAdvancedMode}
                color="primary"
              />
            }
            label={t('dashboard.advancedMode')}
          />
          
          {isAdvancedMode && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={handleToggleEditMode}
                color={dashboardState.isEditMode ? 'secondary' : 'primary'}
              >
                {dashboardState.isEditMode ? t('dashboard.exitEdit') : t('dashboard.editLayout')}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<ExportIcon />}
                onClick={() => handleDataExport()}
              >
                {t('dashboard.export')}
              </Button>
            </>
          )}
          
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
            size={isAdvancedMode ? 'small' : 'medium'}
          >
            {refreshing ? t('dashboard.syncing') : t('dashboard.syncData')}
          </Button>
          
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 高级模式筛选器 */}
      {isAdvancedMode && (
        <Box sx={{ mb: 3 }}>
          <DashboardFilters
            onFiltersChange={(filters) => {
              console.log('Filters changed:', filters);
              // 这里可以重新加载数据
            }}
            onTimeRangeChange={(timeRange) => {
              console.log('Time range changed:', timeRange);
              // 这里可以基于时间范围重新加载数据
            }}
          />
        </Box>
      )}

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

        {/* 主要内容区域 */}
        {isAdvancedMode ? (
          <>
            {/* 高级仪表板网格 */}
            <DashboardGrid
              onWidgetClick={(widget) => {
                console.log('Widget clicked:', widget);
                // 可以打开组件设置对话框
              }}
              onLayoutChange={(layouts) => {
                console.log('Layout changed:', layouts);
              }}
            />
          </>
        ) : (
          <>
            {/* 传统图表和邮件列表 */}
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
          </>
        )}

        {/* 同步状态 */}
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.default' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.lastSyncTime')}: {format(new Date(stats.lastSyncTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
              </Typography>
              {isAdvancedMode && isConnecting && (
                <Chip
                  label={`${t('dashboard.reconnecting')} (${connectionAttempts})`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={isAdvancedMode && isConnected ? t('dashboard.realtimeActive') : t('dashboard.connectedToGraph')}
                color={isAdvancedMode && isConnected ? 'primary' : 'success'}
                variant="outlined"
                size="small"
              />
              {isAdvancedMode && (
                <Chip
                  label={`${dashboardState.widgets.length} ${t('dashboard.widgets')}`}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Box>
        </Paper>
      </LoadingState>

      {/* 数据钻取对话框 */}
      <DrillDownDialog
        open={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        initialData={drillDownData}
        title={drillDownData?.title}
      />

      {/* 数据导出对话框 */}
      <DataExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        widgetId={selectedWidget?.id}
        widgetTitle={selectedWidget?.title}
      />

      {/* 高级模式浮动操作按钮 */}
      {isAdvancedMode && !dashboardState.isEditMode && (
        <Box sx={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1300 }}>
          <Tooltip title={t('dashboard.quickActions')}>
            <Fab 
              color="secondary" 
              size="small"
              onClick={() => handleDataExport()}
              sx={{ mr: 1 }}
            >
              <ExportIcon />
            </Fab>
          </Tooltip>
          <Tooltip title={t('dashboard.fullscreenMode')}>
            <Fab 
              color="default" 
              size="small"
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen();
                }
              }}
            >
              <FullscreenIcon />
            </Fab>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;