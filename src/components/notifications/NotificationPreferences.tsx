import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Collapse,
  Grid,
  Paper,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  PhoneAndroid as MobileIcon,
  Schedule as ScheduleIcon,
  VolumeOff as VolumeOffIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Brightness4 as MoonIcon,
  WbSunny as SunIcon,
  FilterList as FilterIcon,
  NotificationsActive as ActiveIcon,
  NotificationsPaused as PausedIcon,
} from '@mui/icons-material';
import { format, addMinutes, isWithinInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'push' | 'mobile';
  name: string;
  enabled: boolean;
  config: {
    email?: string;
    phone?: string;
    priority?: 'all' | 'high' | 'critical';
    frequency?: 'immediate' | 'hourly' | 'daily';
  };
}

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    types: string[];
    priorities: string[];
    keywords: string[];
    senders: string[];
    timeRange?: {
      start: string;
      end: string;
    };
  };
  actions: {
    channels: string[];
    template?: string;
    delay?: number;
  };
}

interface DoNotDisturbProfile {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    type: 'time' | 'calendar';
    startTime: string;
    endTime: string;
    days: number[];
    exceptions: string[];
  };
  allowedTypes: string[];
  emergencyOverride: boolean;
}

interface NotificationHistory {
  id: string;
  type: string;
  title: string;
  content: string;
  channel: string;
  timestamp: Date;
  status: 'sent' | 'failed' | 'pending';
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

const NotificationPreferences: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // 通知渠道状态
  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: '1',
      type: 'email',
      name: 'Primary Email',
      enabled: true,
      config: { email: 'user@example.com', priority: 'all', frequency: 'immediate' },
    },
    {
      id: '2',
      type: 'push',
      name: 'Browser Push',
      enabled: true,
      config: { priority: 'high', frequency: 'immediate' },
    },
    {
      id: '3',
      type: 'mobile',
      name: 'Mobile App',
      enabled: false,
      config: { priority: 'critical', frequency: 'immediate' },
    },
  ]);

  // 通知规则状态
  const [rules, setRules] = useState<NotificationRule[]>([
    {
      id: '1',
      name: 'High Priority Emails',
      enabled: true,
      conditions: {
        types: ['new_email'],
        priorities: ['high', 'critical'],
        keywords: ['urgent', 'important'],
        senders: [],
      },
      actions: {
        channels: ['1', '2'],
        delay: 0,
      },
    },
    {
      id: '2',
      name: 'AI Analysis Complete',
      enabled: true,
      conditions: {
        types: ['analysis_complete'],
        priorities: ['normal'],
        keywords: [],
        senders: [],
      },
      actions: {
        channels: ['1'],
        delay: 300,
      },
    },
  ]);

  // 免打扰配置状态
  const [dndProfiles, setDndProfiles] = useState<DoNotDisturbProfile[]>([
    {
      id: '1',
      name: 'Work Hours',
      enabled: true,
      schedule: {
        type: 'time',
        startTime: '09:00',
        endTime: '18:00',
        days: [1, 2, 3, 4, 5],
        exceptions: [],
      },
      allowedTypes: ['critical'],
      emergencyOverride: true,
    },
    {
      id: '2',
      name: 'Sleep Mode',
      enabled: true,
      schedule: {
        type: 'time',
        startTime: '22:00',
        endTime: '07:00',
        days: [0, 1, 2, 3, 4, 5, 6],
        exceptions: [],
      },
      allowedTypes: [],
      emergencyOverride: true,
    },
  ]);

  // 通知历史状态
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistory[]>([
    {
      id: '1',
      type: 'new_email',
      title: 'New High Priority Email',
      content: 'Urgent: Meeting rescheduled to tomorrow',
      channel: 'email',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: 'sent',
      read: true,
      priority: 'high',
    },
    {
      id: '2',
      type: 'analysis_complete',
      title: 'AI Analysis Complete',
      content: 'Analysis of 25 emails completed',
      channel: 'push',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'sent',
      read: false,
      priority: 'normal',
    },
  ]);

  // 对话框状态
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [dndDialogOpen, setDndDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  const [selectedRule, setSelectedRule] = useState<NotificationRule | null>(null);
  const [selectedDndProfile, setSelectedDndProfile] = useState<DoNotDisturbProfile | null>(null);

  // 通知类型配置
  const notificationTypes = [
    { key: 'new_email', label: t('notifications.newEmail'), icon: <EmailIcon /> },
    { key: 'analysis_complete', label: t('notifications.analysisComplete'), icon: <AnalyticsIcon /> },
    { key: 'security_alert', label: t('notifications.securityAlert'), icon: <SecurityIcon /> },
    { key: 'system_update', label: t('notifications.systemUpdate'), icon: <SettingsIcon /> },
    { key: 'workflow_trigger', label: t('notifications.workflowTrigger'), icon: <FilterIcon /> },
  ];

  // 优先级选项
  const priorityOptions = [
    { key: 'low', label: t('priority.low'), color: 'default' },
    { key: 'normal', label: t('priority.normal'), color: 'primary' },
    { key: 'high', label: t('priority.high'), color: 'warning' },
    { key: 'critical', label: t('priority.critical'), color: 'error' },
  ];

  // 处理渠道切换
  const handleChannelToggle = (channelId: string) => {
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, enabled: !channel.enabled }
        : channel
    ));
  };

  // 处理规则切换
  const handleRuleToggle = (ruleId: string) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId
        ? { ...rule, enabled: !rule.enabled }
        : rule
    ));
  };

  // 处理免打扰切换
  const handleDndToggle = (profileId: string) => {
    setDndProfiles(prev => prev.map(profile =>
      profile.id === profileId
        ? { ...profile, enabled: !profile.enabled }
        : profile
    ));
  };

  // 获取当前活跃的免打扰配置
  const getActiveDndProfile = () => {
    const now = new Date();
    return dndProfiles.find(profile => {
      if (!profile.enabled) return false;

      // 简化的时间检查逻辑
      const currentTime = format(now, 'HH:mm');
      const currentDay = now.getDay();

      return profile.schedule.days.includes(currentDay) &&
             currentTime >= profile.schedule.startTime &&
             currentTime <= profile.schedule.endTime;
    });
  };

  // 渲染通知渠道设置
  const renderChannelSettings = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon />
            {t('notifications.channels')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedChannel(null);
              setChannelDialogOpen(true);
            }}
          >
            {t('notifications.addChannel')}
          </Button>
        </Box>

        <List>
          {channels.map((channel) => (
            <ListItem key={channel.id} divider>
              <ListItemIcon>
                {channel.type === 'email' && <EmailIcon />}
                {channel.type === 'sms' && <SmsIcon />}
                {channel.type === 'push' && <NotificationsIcon />}
                {channel.type === 'mobile' && <MobileIcon />}
              </ListItemIcon>
              <ListItemText
                primary={channel.name}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t(`notifications.type.${channel.type}`)} •
                      {t(`notifications.priority.${channel.config.priority}`)} •
                      {t(`notifications.frequency.${channel.config.frequency}`)}
                    </Typography>
                    {channel.config.email && (
                      <Typography variant="caption" color="text.secondary">
                        {channel.config.email}
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedChannel(channel);
                      setChannelDialogOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <Switch
                    checked={channel.enabled}
                    onChange={() => handleChannelToggle(channel.id)}
                    size="small"
                  />
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  // 渲染通知规则设置
  const renderNotificationRules = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            {t('notifications.rules')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedRule(null);
              setRuleDialogOpen(true);
            }}
          >
            {t('notifications.addRule')}
          </Button>
        </Box>

        <List>
          {rules.map((rule) => (
            <ListItem key={rule.id} divider>
              <ListItemIcon>
                {rule.enabled ? <ActiveIcon color="primary" /> : <PausedIcon color="disabled" />}
              </ListItemIcon>
              <ListItemText
                primary={rule.name}
                secondary={
                  <Box>
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                      {rule.conditions.types.map(type => (
                        <Chip
                          key={type}
                          label={t(`notifications.type.${type}`)}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('notifications.activeChannels', { count: rule.actions.channels.length })}
                      {rule.actions.delay && rule.actions.delay > 0 && (
                        ` • ${t('notifications.delay', { seconds: rule.actions.delay })}`
                      )}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedRule(rule);
                      setRuleDialogOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => handleRuleToggle(rule.id)}
                    size="small"
                  />
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  // 渲染免打扰设置
  const renderDoNotDisturbSettings = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeOffIcon />
            {t('notifications.doNotDisturb')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedDndProfile(null);
              setDndDialogOpen(true);
            }}
          >
            {t('notifications.addProfile')}
          </Button>
        </Box>

        {/* 当前状态指示器 */}
        {(() => {
          const activeProfile = getActiveDndProfile();
          return activeProfile ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <MoonIcon />
                <Typography variant="body2">
                  {t('notifications.currentlyActive', { profile: activeProfile.name })}
                </Typography>
              </Box>
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <SunIcon />
                <Typography variant="body2">
                  {t('notifications.allNotificationsEnabled')}
                </Typography>
              </Box>
            </Alert>
          );
        })()}

        <List>
          {dndProfiles.map((profile) => (
            <ListItem key={profile.id} divider>
              <ListItemIcon>
                <ScheduleIcon color={profile.enabled ? 'primary' : 'disabled'} />
              </ListItemIcon>
              <ListItemText
                primary={profile.name}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {profile.schedule.startTime} - {profile.schedule.endTime}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('notifications.allowedTypes', { count: profile.allowedTypes.length })}
                      {profile.emergencyOverride && ` • ${t('notifications.emergencyOverride')}`}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedDndProfile(profile);
                      setDndDialogOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <Switch
                    checked={profile.enabled}
                    onChange={() => handleDndToggle(profile.id)}
                    size="small"
                  />
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  // 渲染通知历史
  const renderNotificationHistory = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <HistoryIcon />
          {t('notifications.history')}
        </Typography>

        <List>
          {notificationHistory.slice(0, 10).map((notification) => (
            <ListItem key={notification.id} divider>
              <ListItemIcon>
                {notificationTypes.find(type => type.key === notification.type)?.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2">
                      {notification.title}
                    </Typography>
                    <Chip
                      label={t(`priority.${notification.priority}`)}
                      size="small"
                      color={priorityOptions.find(p => p.key === notification.priority)?.color as any}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {notification.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(notification.timestamp, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })} •
                      {t(`notifications.channel.${notification.channel}`)} •
                      {t(`notifications.status.${notification.status}`)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box display="flex" alignItems="center" gap={1}>
                  {!notification.read && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                      }}
                    />
                  )}
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        <Box textAlign="center" sx={{ mt: 2 }}>
          <Button variant="outlined" size="small">
            {t('notifications.viewAll')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // 渲染分析统计
  const renderAnalytics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('notifications.analytics.daily')}
          </Typography>
          {/* 简化的统计图表占位符 */}
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">
              {t('notifications.analytics.chartPlaceholder')}
            </Typography>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('notifications.analytics.channels')}
          </Typography>
          <List dense>
            {channels.map(channel => (
              <ListItem key={channel.id}>
                <ListItemText
                  primary={channel.name}
                  secondary={`${Math.floor(Math.random() * 100)} ${t('notifications.analytics.sent')}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('notifications.preferences')}
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label={t('notifications.channels')} />
        <Tab label={t('notifications.rules')} />
        <Tab label={t('notifications.doNotDisturb')} />
        <Tab label={t('notifications.history')} />
        <Tab label={t('notifications.analytics.title')} />
      </Tabs>

      <Box role="tabpanel" hidden={activeTab !== 0}>
        {activeTab === 0 && renderChannelSettings()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && renderNotificationRules()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 2}>
        {activeTab === 2 && renderDoNotDisturbSettings()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 3}>
        {activeTab === 3 && renderNotificationHistory()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 4}>
        {activeTab === 4 && renderAnalytics()}
      </Box>

      {/* 这里可以添加各种对话框组件 */}
      {/* 为了简化代码，对话框组件的详细实现在此省略 */}
    </Box>
  );
};

export default NotificationPreferences;