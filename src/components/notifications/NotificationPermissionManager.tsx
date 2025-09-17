import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Collapse,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Computer as DesktopIcon,
  PhoneAndroid as MobileIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import useNotifications from '@/hooks/useNotifications';

interface PermissionStatus {
  notifications: NotificationPermission;
  serviceWorker: boolean;
  webPush: boolean;
  background: boolean;
}

interface BrowserSupport {
  notifications: boolean;
  serviceWorker: boolean;
  webPush: boolean;
  permissions: boolean;
}

const NotificationPermissionManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    notifications: 'default',
    serviceWorker: false,
    webPush: false,
    background: false,
  });

  const [browserSupport, setBrowserSupport] = useState<BrowserSupport>({
    notifications: false,
    serviceWorker: false,
    webPush: false,
    permissions: false,
  });

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [permissionSettings, setPermissionSettings] = useState({
    notifications: true,
    sound: true,
    vibration: true,
    badge: true,
    persistent: false,
  });

  const {
    requestNotificationPermission,
    sendTestNotification,
    playNotificationSound,
  } = useNotifications();

  // 检查浏览器支持
  useEffect(() => {
    const checkBrowserSupport = () => {
      setBrowserSupport({
        notifications: 'Notification' in window,
        serviceWorker: 'serviceWorker' in navigator,
        webPush: 'PushManager' in window,
        permissions: 'permissions' in navigator,
      });
    };

    checkBrowserSupport();
  }, []);

  // 检查权限状态
  useEffect(() => {
    const checkPermissionStatus = async () => {
      const status: PermissionStatus = {
        notifications: 'Notification' in window ? Notification.permission : 'denied',
        serviceWorker: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
        webPush: false,
        background: false,
      };

      // 检查Push权限
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          status.webPush = !!subscription;
        } catch (error) {
          console.warn('Failed to check push subscription:', error);
        }
      }

      // 检查后台权限
      if ('permissions' in navigator) {
        try {
          const backgroundSyncStatus = await navigator.permissions.query({ name: 'background-sync' as any });
          status.background = backgroundSyncStatus.state === 'granted';
        } catch (error) {
          // background-sync可能不被支持
        }
      }

      setPermissionStatus(status);
    };

    checkPermissionStatus();

    // 监听权限变化
    const handlePermissionChange = () => {
      checkPermissionStatus();
    };

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then(permission => {
        permission.addEventListener('change', handlePermissionChange);
      });
    }

    return () => {
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' }).then(permission => {
          permission.removeEventListener('change', handlePermissionChange);
        });
      }
    };
  }, []);

  // 请求通知权限
  const handleRequestNotificationPermission = async () => {
    const permission = await requestNotificationPermission();
    setPermissionStatus(prev => ({ ...prev, notifications: permission }));

    if (permission === 'granted') {
      setActiveStep(1);
    }
  };

  // 设置Service Worker
  const handleSetupServiceWorker = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        setPermissionStatus(prev => ({ ...prev, serviceWorker: true }));
        setActiveStep(2);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  // 设置Push订阅
  const handleSetupWebPush = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;

        // 这里应该使用真实的VAPID公钥
        const vapidPublicKey = 'BExample-VAPID-Public-Key';

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });

        // 发送订阅信息到服务器
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify(subscription),
        });

        setPermissionStatus(prev => ({ ...prev, webPush: true }));
        setActiveStep(3);
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  };

  // 完成设置
  const handleCompleteSetup = () => {
    setSetupDialogOpen(false);
    setActiveStep(0);
    sendTestNotification();
  };

  // 重置权限
  const handleResetPermissions = () => {
    // 注意：无法通过JavaScript撤销权限，用户需要在浏览器设置中手动重置
    alert(t('notifications.resetPermissionsInstructions'));
  };

  // 获取权限状态颜色
  const getPermissionStatusColor = (status: string) => {
    switch (status) {
      case 'granted':
        return 'success';
      case 'denied':
        return 'error';
      case 'default':
        return 'warning';
      default:
        return 'default';
    }
  };

  // 获取权限状态图标
  const getPermissionStatusIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckIcon color="success" />;
      case 'denied':
        return <ErrorIcon color="error" />;
      case 'default':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon />;
    }
  };

  // 渲染设置向导
  const renderSetupWizard = () => (
    <Dialog
      open={setupDialogOpen}
      onClose={() => setSetupDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('notifications.setupWizard')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>{t('notifications.requestPermission')}</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                {t('notifications.requestPermissionDesc')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleRequestNotificationPermission}
                  disabled={permissionStatus.notifications === 'granted'}
                >
                  {permissionStatus.notifications === 'granted'
                    ? t('notifications.permissionGranted')
                    : t('notifications.requestPermission')
                  }
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{t('notifications.setupServiceWorker')}</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                {t('notifications.setupServiceWorkerDesc')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSetupServiceWorker}
                  disabled={!browserSupport.serviceWorker || permissionStatus.serviceWorker}
                >
                  {permissionStatus.serviceWorker
                    ? t('notifications.serviceWorkerActive')
                    : t('notifications.setupServiceWorker')
                  }
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{t('notifications.setupWebPush')}</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                {t('notifications.setupWebPushDesc')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSetupWebPush}
                  disabled={!browserSupport.webPush || permissionStatus.webPush}
                >
                  {permissionStatus.webPush
                    ? t('notifications.webPushActive')
                    : t('notifications.setupWebPush')
                  }
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{t('notifications.testNotifications')}</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                {t('notifications.testNotificationsDesc')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleCompleteSetup}
                >
                  {t('notifications.sendTestNotification')}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSetupDialogOpen(false)}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">
            {t('notifications.permissionManager')}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
            >
              {t('notifications.refresh')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => setSetupDialogOpen(true)}
            >
              {t('notifications.setup')}
            </Button>
          </Box>
        </Box>

        {/* 浏览器支持状态 */}
        <Alert
          severity={Object.values(browserSupport).every(Boolean) ? 'success' : 'warning'}
          sx={{ mb: 2 }}
        >
          <AlertTitle>{t('notifications.browserSupport')}</AlertTitle>
          {Object.values(browserSupport).every(Boolean)
            ? t('notifications.fullySupportedBrowser')
            : t('notifications.limitedSupportBrowser')
          }
        </Alert>

        {/* 权限状态列表 */}
        <List>
          <ListItem>
            <ListItemIcon>
              <NotificationsIcon />
            </ListItemIcon>
            <ListItemText
              primary={t('notifications.basicNotifications')}
              secondary={t('notifications.basicNotificationsDesc')}
            />
            <ListItemSecondaryAction>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={t(`notifications.permission.${permissionStatus.notifications}`)}
                  color={getPermissionStatusColor(permissionStatus.notifications) as any}
                  size="small"
                />
                {getPermissionStatusIcon(permissionStatus.notifications)}
              </Box>
            </ListItemSecondaryAction>
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <DesktopIcon />
            </ListItemIcon>
            <ListItemText
              primary={t('notifications.serviceWorker')}
              secondary={t('notifications.serviceWorkerDesc')}
            />
            <ListItemSecondaryAction>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={permissionStatus.serviceWorker ? t('common.active') : t('common.inactive')}
                  color={permissionStatus.serviceWorker ? 'success' : 'default'}
                  size="small"
                />
                {permissionStatus.serviceWorker ? <CheckIcon color="success" /> : <ErrorIcon color="disabled" />}
              </Box>
            </ListItemSecondaryAction>
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <MobileIcon />
            </ListItemIcon>
            <ListItemText
              primary={t('notifications.webPush')}
              secondary={t('notifications.webPushDesc')}
            />
            <ListItemSecondaryAction>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={permissionStatus.webPush ? t('common.active') : t('common.inactive')}
                  color={permissionStatus.webPush ? 'success' : 'default'}
                  size="small"
                />
                {permissionStatus.webPush ? <CheckIcon color="success" /> : <ErrorIcon color="disabled" />}
              </Box>
            </ListItemSecondaryAction>
          </ListItem>
        </List>

        {/* 高级设置 */}
        <Box sx={{ mt: 2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2">
              {t('notifications.advancedSettings')}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={expanded}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={permissionSettings.sound}
                    onChange={(e) => setPermissionSettings(prev => ({ ...prev, sound: e.target.checked }))}
                  />
                }
                label={t('notifications.enableSound')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={permissionSettings.vibration}
                    onChange={(e) => setPermissionSettings(prev => ({ ...prev, vibration: e.target.checked }))}
                  />
                }
                label={t('notifications.enableVibration')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={permissionSettings.badge}
                    onChange={(e) => setPermissionSettings(prev => ({ ...prev, badge: e.target.checked }))}
                  />
                }
                label={t('notifications.enableBadge')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={permissionSettings.persistent}
                    onChange={(e) => setPermissionSettings(prev => ({ ...prev, persistent: e.target.checked }))}
                  />
                }
                label={t('notifications.persistentNotifications')}
              />

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={sendTestNotification}
                  disabled={permissionStatus.notifications !== 'granted'}
                >
                  {t('notifications.testNotification')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={playNotificationSound}
                >
                  {t('notifications.testSound')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={handleResetPermissions}
                >
                  {t('notifications.resetPermissions')}
                </Button>
              </Box>
            </Paper>
          </Collapse>
        </Box>

        {renderSetupWizard()}
      </CardContent>
    </Card>
  );
};

export default NotificationPermissionManager;