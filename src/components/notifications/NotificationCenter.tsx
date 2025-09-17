import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Badge,
  IconButton,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Button,
  Divider,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Email as EmailIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  MarkEmailRead as MarkReadIcon,
  Schedule as ScheduleIcon,
  Priority as PriorityIcon,
  Person as PersonIcon,
  Computer as SystemIcon,
  Hub as WorkflowIcon,
  Group as TeamIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'email' | 'system' | 'workflow' | 'team' | 'security';
  category: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  source?: string;
  actionUrl?: string;
  metadata?: {
    emailId?: string;
    workflowId?: string;
    userId?: string;
    count?: number;
  };
  expiry?: Date;
}

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  autoMarkRead: boolean;
  maxVisible: number;
  categories: {
    email: boolean;
    system: boolean;
    workflow: boolean;
    team: boolean;
    security: boolean;
  };
}

const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 通知状态
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'email',
      category: 'info',
      title: t('notifications.newEmail'),
      message: '来自 John Doe: Project deadline approaching',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      read: false,
      priority: 'high',
      source: 'john@example.com',
      metadata: { emailId: 'email_123' },
    },
    {
      id: '2',
      type: 'system',
      category: 'success',
      title: t('notifications.analysisComplete'),
      message: '25封邮件的AI分析已完成',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      read: false,
      priority: 'normal',
      source: 'AI Analysis Engine',
    },
    {
      id: '3',
      type: 'workflow',
      category: 'error',
      title: t('notifications.workflowError'),
      message: 'Trello集成执行失败: API限制',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      read: true,
      priority: 'high',
      source: 'Trello Integration',
      metadata: { workflowId: 'wf_001' },
    },
    {
      id: '4',
      type: 'security',
      category: 'warning',
      title: t('notifications.securityAlert'),
      message: '检测到来自新IP地址的登录尝试',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: true,
      priority: 'critical',
      source: 'Security Monitor',
    },
    {
      id: '5',
      type: 'team',
      category: 'info',
      title: t('notifications.teamUpdate'),
      message: '新团队成员 Sarah Smith 已加入项目',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      read: true,
      priority: 'normal',
      source: 'Team Management',
      metadata: { userId: 'user_456' },
    },
  ]);

  // 通知设置
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    sound: true,
    desktop: true,
    autoMarkRead: false,
    maxVisible: 50,
    categories: {
      email: true,
      system: true,
      workflow: true,
      team: true,
      security: true,
    },
  });

  // 计算未读通知数量
  const unreadCount = notifications.filter(n => !n.read && settings.categories[n.type]).length;

  // 模拟实时通知
  useEffect(() => {
    if (!settings.enabled) return;

    const interval = setInterval(() => {
      // 随机生成新通知
      if (Math.random() > 0.7) {
        const newNotification = generateRandomNotification();
        setNotifications(prev => [newNotification, ...prev.slice(0, settings.maxVisible - 1)]);

        // 播放通知声音
        if (settings.sound && audioRef.current) {
          audioRef.current.play().catch(() => {
            // 忽略自动播放错误
          });
        }

        // 显示桌面通知
        if (settings.desktop && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          });
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [settings]);

  // 请求桌面通知权限
  useEffect(() => {
    if (settings.desktop && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings.desktop]);

  // 生成随机通知
  const generateRandomNotification = (): Notification => {
    const types: Notification['type'][] = ['email', 'system', 'workflow', 'team', 'security'];
    const categories: Notification['category'][] = ['info', 'success', 'warning', 'error'];
    const priorities: Notification['priority'][] = ['low', 'normal', 'high', 'critical'];

    const type = types[Math.floor(Math.random() * types.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    const templates = {
      email: [
        '新邮件: {{sender}}',
        '高优先级邮件来自 {{sender}}',
        '紧急邮件需要处理',
      ],
      system: [
        'AI分析已完成',
        '系统备份完成',
        '数据同步更新',
      ],
      workflow: [
        '工作流执行成功',
        'Trello卡片已创建',
        'Jira问题单已更新',
      ],
      team: [
        '新团队成员加入',
        '团队协作更新',
        '权限变更通知',
      ],
      security: [
        '安全警报',
        '登录异常检测',
        '权限变更通知',
      ],
    };

    const template = templates[type][Math.floor(Math.random() * templates[type].length)];
    const title = template.replace('{{sender}}', 'User ' + Math.floor(Math.random() * 100));

    return {
      id: Date.now().toString(),
      type,
      category,
      title,
      message: `${title} - ${format(new Date(), 'HH:mm:ss')}`,
      timestamp: new Date(),
      read: false,
      priority,
      source: `${type} service`,
    };
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.read) {
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, read: true } : n
      ));
    }

    // 处理跳转
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    } else if (notification.metadata?.emailId) {
      // 跳转到邮件详情
      console.log('Navigate to email:', notification.metadata.emailId);
    } else if (notification.metadata?.workflowId) {
      // 跳转到工作流详情
      console.log('Navigate to workflow:', notification.metadata.workflowId);
    }
  };

  // 标记所有为已读
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // 清除所有通知
  const handleClearAll = () => {
    setNotifications([]);
  };

  // 删除单个通知
  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // 获取通知图标
  const getNotificationIcon = (notification: Notification) => {
    const iconProps = {
      fontSize: 'small' as const,
      color: notification.read ? 'action' : 'primary'
    };

    switch (notification.type) {
      case 'email':
        return <EmailIcon {...iconProps} />;
      case 'system':
        return <SystemIcon {...iconProps} />;
      case 'workflow':
        return <WorkflowIcon {...iconProps} />;
      case 'team':
        return <TeamIcon {...iconProps} />;
      case 'security':
        return <ErrorIcon {...iconProps} color="error" />;
      default:
        return <InfoIcon {...iconProps} />;
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'primary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  // 渲染通知列表
  const filteredNotifications = notifications.filter(n => settings.categories[n.type]);

  return (
    <>
      {/* 通知铃铛按钮 */}
      <IconButton
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={t('notifications.title')}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {settings.enabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
        </Badge>
      </IconButton>

      {/* 通知面板 */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 600 }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {t('notifications.title')}
            </Typography>
            <Box display="flex" gap={1}>
              <IconButton
                size="small"
                onClick={() => setSettingsOpen(true)}
                title={t('common.settings')}
              >
                <SettingsIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                title={t('notifications.markAllRead')}
              >
                <MarkReadIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                title={t('notifications.clearAll')}
              >
                <ClearIcon />
              </IconButton>
            </Box>
          </Box>

          {unreadCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('notifications.unreadCount', { count: unreadCount })}
            </Typography>
          )}
        </Box>

        {!settings.enabled && (
          <Alert severity="info" sx={{ m: 2 }}>
            {t('notifications.disabled')}
          </Alert>
        )}

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredNotifications.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={t('notifications.noNotifications')}
                secondary={t('notifications.noNotificationsDesc')}
              />
            </ListItem>
          ) : (
            filteredNotifications.map((notification) => (
              <ListItem
                key={notification.id}
                button
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  bgcolor: notification.read ? 'transparent' : 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: notification.read ? 'grey.300' : 'primary.main' }}>
                    {getNotificationIcon(notification)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: notification.read ? 'normal' : 'bold',
                          flexGrow: 1
                        }}
                      >
                        {notification.title}
                      </Typography>
                      <Chip
                        label={t(`priority.${notification.priority}`)}
                        size="small"
                        color={getPriorityColor(notification.priority) as any}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {notification.message}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                            locale: zhCN
                          })}
                        </Typography>
                        {notification.source && (
                          <Typography variant="caption" color="text.secondary">
                            {notification.source}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notification.id);
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>

        {filteredNotifications.length > 0 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button fullWidth size="small" variant="outlined">
              {t('notifications.viewAll')}
            </Button>
          </Box>
        )}
      </Popover>

      {/* 设置对话框 */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('notifications.settings')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label={t('notifications.enableNotifications')}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.sound}
                  onChange={(e) => setSettings(prev => ({ ...prev, sound: e.target.checked }))}
                  disabled={!settings.enabled}
                />
              }
              label={t('notifications.enableSound')}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.desktop}
                  onChange={(e) => setSettings(prev => ({ ...prev, desktop: e.target.checked }))}
                  disabled={!settings.enabled}
                />
              }
              label={t('notifications.enableDesktop')}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoMarkRead}
                  onChange={(e) => setSettings(prev => ({ ...prev, autoMarkRead: e.target.checked }))}
                  disabled={!settings.enabled}
                />
              }
              label={t('notifications.autoMarkRead')}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              {t('notifications.categories')}
            </Typography>

            {Object.entries(settings.categories).map(([key, value]) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={value}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      categories: { ...prev.categories, [key]: e.target.checked }
                    }))}
                    disabled={!settings.enabled}
                  />
                }
                label={t(`notifications.type.${key}`)}
              />
            ))}

            <Box sx={{ mt: 2 }}>
              <TextField
                label={t('notifications.maxVisible')}
                type="number"
                value={settings.maxVisible}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  maxVisible: Math.max(1, Math.min(100, parseInt(e.target.value) || 50))
                }))}
                inputProps={{ min: 1, max: 100 }}
                size="small"
                fullWidth
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 音频元素 */}
      <audio ref={audioRef} preload="auto">
        <source src="/notification-sound.mp3" type="audio/mpeg" />
        <source src="/notification-sound.ogg" type="audio/ogg" />
      </audio>
    </>
  );
};

export default NotificationCenter;