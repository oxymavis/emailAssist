import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Badge,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Button,
  Chip,
  Divider,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Task as TaskIcon,
  Sync as SyncIcon,
  Rule as RuleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';

// WebSocket event types
interface WebSocketEvents {
  'email:new': {
    emailId: string;
    subject: string;
    from: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    receivedAt: string;
  };

  'email:analyzed': {
    emailId: string;
    analysisId: string;
    sentiment: string;
    priority: string;
    confidence: number;
  };

  'task:created': {
    taskId: string;
    emailId: string;
    integrationId: string;
    title: string;
    priority: string;
    externalUrl?: string;
  };

  'task:updated': {
    taskId: string;
    status: string;
    assignee?: string;
    dueDate?: string;
  };

  'task:completed': {
    taskId: string;
    completedAt: string;
    integrationName: string;
  };

  'rule:matched': {
    ruleId: string;
    ruleName: string;
    emailId: string;
    actions: string[];
  };

  'sync:started': {
    accountId: string;
    type: 'email' | 'integration';
    name: string;
  };

  'sync:progress': {
    accountId: string;
    progress: number;
    current: number;
    total: number;
    status: string;
  };

  'sync:completed': {
    accountId: string;
    success: boolean;
    processed: number;
    errors: number;
    duration: number;
  };

  'system:notification': {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    autoClose?: boolean;
    duration?: number;
  };

  'system:stats_update': {
    totalEmails: number;
    unreadEmails: number;
    activeTasks: number;
    pendingAnalysis: number;
  };
}

interface Notification {
  id: string;
  type: keyof WebSocketEvents;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface RealtimeNotificationsProps {
  userId?: string;
  onStatsUpdate?: (stats: WebSocketEvents['system:stats_update']) => void;
}

const RealtimeNotifications: React.FC<RealtimeNotificationsProps> = ({
  userId,
  onStatsUpdate
}) => {
  const { t } = useTranslation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [currentSnackbar, setCurrentSnackbar] = useState<Notification | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_WS_URL || 'http://localhost:3001', {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, [userId]);

  // Subscribe to events
  useEffect(() => {
    if (!socket || !connected) return;

    // Subscribe to all notification channels
    socket.emit('subscribe:emails');
    socket.emit('subscribe:tasks');
    socket.emit('subscribe:sync');

    // Handle ping/pong for connection health
    const pingInterval = setInterval(() => {
      socket.emit('ping');
    }, 30000);

    socket.on('pong', (data) => {
      console.log('Received pong:', data);
    });

    return () => {
      clearInterval(pingInterval);
      socket.emit('unsubscribe:emails');
      socket.emit('unsubscribe:tasks');
      socket.emit('unsubscribe:sync');
    };
  }, [socket, connected]);

  // Create notification handler
  const createNotification = useCallback((
    type: keyof WebSocketEvents,
    title: string,
    message: string,
    data?: any,
    priority: Notification['priority'] = 'normal'
  ) => {
    const notification: Notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      data,
      priority
    };

    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep only latest 50

    // Show snackbar for high priority notifications
    if (priority === 'high' || priority === 'urgent') {
      setCurrentSnackbar(notification);
      setSnackbarOpen(true);
    }

    return notification;
  }, []);

  // Event handlers
  useEffect(() => {
    if (!socket) return;

    // Email events
    socket.on('email:new', (data: WebSocketEvents['email:new']) => {
      createNotification(
        'email:new',
        t('notifications.emailReceived'),
        t('notifications.emailReceivedFrom', { from: data.from }),
        data,
        data.priority === 'critical' ? 'urgent' : 'normal'
      );
    });

    socket.on('email:analyzed', (data: WebSocketEvents['email:analyzed']) => {
      createNotification(
        'email:analyzed',
        t('notifications.analysisCompleted'),
        t('notifications.analysisCompletedDetails', { sentiment: data.sentiment }),
        data,
        'low'
      );
    });

    // Task events
    socket.on('task:created', (data: WebSocketEvents['task:created']) => {
      createNotification(
        'task:created',
        t('notifications.taskCreated'),
        t('notifications.taskCreatedDetails', { title: data.title }),
        data,
        'normal'
      );
    });

    socket.on('task:completed', (data: WebSocketEvents['task:completed']) => {
      createNotification(
        'task:completed',
        t('notifications.taskCompleted'),
        t('notifications.taskCompletedDetails', { integration: data.integrationName }),
        data,
        'normal'
      );
    });

    // Rule events
    socket.on('rule:matched', (data: WebSocketEvents['rule:matched']) => {
      createNotification(
        'rule:matched',
        t('notifications.ruleMatched'),
        t('notifications.ruleMatchedDetails', { rule: data.ruleName }),
        data,
        'low'
      );
    });

    // Sync events
    socket.on('sync:started', (data: WebSocketEvents['sync:started']) => {
      createNotification(
        'sync:started',
        t('notifications.syncStarted'),
        t('notifications.syncStartedDetails', { name: data.name }),
        data,
        'low'
      );
    });

    socket.on('sync:completed', (data: WebSocketEvents['sync:completed']) => {
      const priority = data.success ? 'normal' : 'high';
      createNotification(
        'sync:completed',
        data.success ? t('notifications.syncCompleted') : t('notifications.syncFailed'),
        t('notifications.syncCompletedDetails', {
          processed: data.processed,
          errors: data.errors
        }),
        data,
        priority
      );
    });

    // System events
    socket.on('system:notification', (data: WebSocketEvents['system:notification']) => {
      const priorityMap: { [key: string]: Notification['priority'] } = {
        info: 'low',
        success: 'normal',
        warning: 'high',
        error: 'urgent'
      };

      createNotification(
        'system:notification',
        data.title,
        data.message,
        data,
        priorityMap[data.type] || 'normal'
      );
    });

    socket.on('system:stats_update', (data: WebSocketEvents['system:stats_update']) => {
      if (onStatsUpdate) {
        onStatsUpdate(data);
      }
    });

    return () => {
      socket.off('email:new');
      socket.off('email:analyzed');
      socket.off('task:created');
      socket.off('task:completed');
      socket.off('rule:matched');
      socket.off('sync:started');
      socket.off('sync:completed');
      socket.off('system:notification');
      socket.off('system:stats_update');
    };
  }, [socket, createNotification, onStatsUpdate, t]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: keyof WebSocketEvents) => {
    switch (type) {
      case 'email:new':
      case 'email:analyzed':
        return <EmailIcon color="primary" />;
      case 'task:created':
      case 'task:updated':
      case 'task:completed':
        return <TaskIcon color="secondary" />;
      case 'sync:started':
      case 'sync:progress':
      case 'sync:completed':
        return <SyncIcon color="action" />;
      case 'rule:matched':
        return <RuleIcon color="info" />;
      case 'system:notification':
        return <InfoIcon color="inherit" />;
      default:
        return <InfoIcon color="inherit" />;
    }
  };

  const getNotificationColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Notification Bell */}
      <Tooltip title={connected ? t('notifications.connected') : t('notifications.disconnected')}>
        <IconButton
          color="inherit"
          onClick={() => setDrawerOpen(true)}
          sx={{
            color: connected ? 'inherit' : 'text.disabled'
          }}
        >
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notifications Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: 400 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {t('notifications.title')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                size="small"
                label={connected ? t('notifications.connected') : t('notifications.disconnected')}
                color={connected ? 'success' : 'error'}
                sx={{ mr: 1 }}
              />
              <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {unreadCount > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button size="small" onClick={markAllAsRead}>
                {t('notifications.markAllRead')}
              </Button>
              <Button size="small" onClick={clearAll}>
                {t('notifications.clearAll')}
              </Button>
            </Box>
          )}

          <Divider sx={{ mb: 2 }} />

          <List sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary={t('notifications.noNotifications')}
                  secondary={t('notifications.noNotificationsDesc')}
                />
              </ListItem>
            ) : (
              notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    bgcolor: notification.read ? 'transparent' : 'action.hover',
                    borderRadius: 1,
                    mb: 1,
                    opacity: notification.read ? 0.7 : 1
                  }}
                  onClick={() => markAsRead(notification.id)}
                >
                  <Avatar sx={{ mr: 2, bgcolor: 'transparent' }}>
                    {getNotificationIcon(notification.type)}
                  </Avatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2">
                          {notification.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={notification.priority}
                          color={getNotificationColor(notification.priority) as any}
                          sx={{ minWidth: 'auto' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {notification.timestamp.toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  {!notification.read && (
                    <ListItemSecondaryAction>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'primary.main'
                        }}
                      />
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Drawer>

      {/* Snackbar for High Priority Notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={currentSnackbar?.data?.autoClose !== false ? (currentSnackbar?.data?.duration || 6000) : null}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={currentSnackbar?.data?.type || 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          <Typography variant="subtitle2">
            {currentSnackbar?.title}
          </Typography>
          <Typography variant="body2">
            {currentSnackbar?.message}
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default RealtimeNotifications;