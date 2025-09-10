import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Slider,
  Tab,
  Tabs,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Avatar,
  Paper,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Psychology as PsychologyIcon,
  Palette as PaletteIcon,
  Link as LinkIcon,
  Security as SecurityIcon,
  Backup as BackupIcon,
  Help as HelpIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { LoadingState, SkeletonCard } from '@/components/common/Loading';
import { useSettings, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { UserSettings } from '@/types';
import { useTranslation } from 'react-i18next';

// 连接状态组件
interface ConnectionStatusProps {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  name,
  icon,
  connected,
  lastSync,
  onConnect,
  onDisconnect,
  onSync,
}) => {
  const { t } = useTranslation();
  return (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: connected ? 'success.main' : 'grey.400' }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h6">{name}</Typography>
            <Chip
              label={connected ? t('settings.connected') : t('settings.disconnected')}
              size="small"
              color={connected ? 'success' : 'default'}
              variant="outlined"
            />
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          {connected && onSync && (
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={onSync}>
              {t('settings.sync')}
            </Button>
          )}
          <Button
            size="small"
            variant={connected ? 'outlined' : 'contained'}
            color={connected ? 'error' : 'primary'}
            onClick={connected ? onDisconnect : onConnect}
          >
            {connected ? t('settings.disconnect') : t('settings.connect')}
          </Button>
        </Box>
      </Box>
      {connected && lastSync && (
        <Typography variant="body2" color="text.secondary">
          {t('settings.lastSync')}: {new Date(lastSync).toLocaleString()}
        </Typography>
      )}
    </CardContent>
  </Card>
  );
};

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { addNotification } = useNotifications();
  // const appTheme = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // 标签页配置
  const tabs = [
    { label: t('settings.notifications'), icon: <NotificationsIcon /> },
    { label: t('settings.analysis'), icon: <PsychologyIcon /> },
    { label: t('settings.appearance'), icon: <PaletteIcon /> },
    { label: t('settings.integrations'), icon: <LinkIcon /> },
    { label: t('settings.security'), icon: <SecurityIcon /> },
    { label: t('settings.backup'), icon: <BackupIcon /> },
    { label: t('settings.about'), icon: <HelpIcon /> },
  ];

  // 初始化
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockSettings = mockDataService.getUserSettings();
        setLocalSettings(mockSettings);
        updateSettings(mockSettings);
      } catch (error) {
        addNotification({
          type: 'error',
          title: t('settings.loadError'),
          message: t('settings.loadErrorMessage'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeSettings();
  }, [updateSettings, addNotification]);

  // 监听设置变化
  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  // 保存设置
  const handleSaveSettings = () => {
    updateSettings(localSettings);
    setHasChanges(false);
    addNotification({
      type: 'success',
      title: t('settings.saveSuccess'),
      message: t('settings.saveSuccessMessage'),
    });
  };

  // 重置设置
  const handleResetSettings = () => {
    const defaultSettings = mockDataService.getUserSettings();
    setLocalSettings(defaultSettings);
    updateSettings(defaultSettings);
    setResetDialogOpen(false);
    setHasChanges(false);
    addNotification({
      type: 'info',
      title: t('settings.resetSuccess'),
      message: t('settings.resetSuccessMessage'),
    });
  };

  // 处理连接操作
  const handleConnect = (service: string) => {
    // 模拟连接过程
    addNotification({
      type: 'info',
      title: t('settings.connecting'),
      message: t('settings.connectingMessage', { service }),
    });

    setTimeout(() => {
      const newIntegration = { ...localSettings.integration };
      if (service === 'Microsoft Graph') {
        newIntegration.microsoftGraph = {
          isConnected: true,
          tenantId: 'mock-tenant-id',
          lastSync: new Date().toISOString(),
        };
      } else if (service === 'Trello') {
        newIntegration.trello = {
          isConnected: true,
          apiKey: 'mock-api-key',
        };
      } else if (service === 'Jira') {
        newIntegration.jira = {
          isConnected: true,
          serverUrl: 'https://example.atlassian.net',
          username: 'user@example.com',
        };
      }

      setLocalSettings({
        ...localSettings,
        integration: newIntegration,
      });

      addNotification({
        type: 'success',
        title: t('settings.connectSuccess'),
        message: t('settings.connectSuccessMessage', { service }),
      });
    }, 1500);
  };

  const handleDisconnect = (service: string) => {
    const newIntegration = { ...localSettings.integration };
    if (service === 'Microsoft Graph') {
      newIntegration.microsoftGraph = { isConnected: false };
    } else if (service === 'Trello') {
      newIntegration.trello = { isConnected: false };
    } else if (service === 'Jira') {
      newIntegration.jira = { isConnected: false };
    }

    setLocalSettings({
      ...localSettings,
      integration: newIntegration,
    });

    addNotification({
      type: 'warning',
      title: t('settings.disconnected'),
      message: t('settings.disconnectMessage', { service }),
    });
  };

  const handleSync = (service: string) => {
    addNotification({
      type: 'info',
      title: t('settings.syncStarted'),
      message: t('settings.syncStartedMessage', { service }),
    });

    setTimeout(() => {
      if (service === 'Microsoft Graph') {
        const newIntegration = { ...localSettings.integration };
        newIntegration.microsoftGraph = {
          ...newIntegration.microsoftGraph,
          lastSync: new Date().toISOString(),
        };
        setLocalSettings({
          ...localSettings,
          integration: newIntegration,
        });
      }

      addNotification({
        type: 'success',
        title: t('settings.syncCompleted'),
        message: t('settings.syncCompletedMessage', { service }),
      });
    }, 2000);
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {t('settings.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('settings.subtitle')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => setResetDialogOpen(true)}
          >
{t('settings.resetSettings')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={!hasChanges}
          >
{t('settings.saveSettings')}
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
{t('settings.unsavedChangesWarning')}
        </Alert>
      )}

      <LoadingState
        loading={loading}
        skeleton={
          <Grid container spacing={3}>
            {Array.from({ length: 6 }, (_, i) => (
              <Grid item xs={12} md={6} key={i}>
                <SkeletonCard />
              </Grid>
            ))}
          </Grid>
        }
      >
        <Grid container spacing={3}>
          {/* 左侧导航 */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 1 }}>
              <Tabs
                orientation="vertical"
                value={currentTab}
                onChange={(_, value) => setCurrentTab(value)}
                sx={{ borderRight: 1, borderColor: 'divider' }}
              >
                {tabs.map((tab, index) => (
                  <Tab
                    key={index}
                    label={tab.label}
                    icon={tab.icon}
                    iconPosition="start"
                    sx={{ justifyContent: 'flex-start', minHeight: 48 }}
                  />
                ))}
              </Tabs>
            </Paper>
          </Grid>

          {/* 右侧内容 */}
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 3 }}>
              {/* 通知设置 */}
              {currentTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.notifications')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.notificationMethods')}
                          </Typography>
                          <Stack spacing={2}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={localSettings.notifications.email}
                                  onChange={(e) =>
                                    setLocalSettings({
                                      ...localSettings,
                                      notifications: {
                                        ...localSettings.notifications,
                                        email: e.target.checked,
                                      },
                                    })
                                  }
                                />
                              }
                              label={t('settings.emailNotifications')}
                            />
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={localSettings.notifications.push}
                                  onChange={(e) =>
                                    setLocalSettings({
                                      ...localSettings,
                                      notifications: {
                                        ...localSettings.notifications,
                                        push: e.target.checked,
                                      },
                                    })
                                  }
                                />
                              }
                              label={t('settings.pushNotifications')}
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.notificationFrequency')}
                          </Typography>
                          <FormControl fullWidth>
                            <InputLabel>{t('settings.frequencySettings')}</InputLabel>
                            <Select
                              value={localSettings.notifications.frequency}
                              label={t('settings.frequencySettings')}
                              onChange={(e) =>
                                setLocalSettings({
                                  ...localSettings,
                                  notifications: {
                                    ...localSettings.notifications,
                                    frequency: e.target.value as any,
                                  },
                                })
                              }
                            >
                              <MenuItem value="immediate">{t('settings.immediateNotification')}</MenuItem>
                              <MenuItem value="hourly">{t('settings.hourlyDigest')}</MenuItem>
                              <MenuItem value="daily">{t('settings.dailyDigest')}</MenuItem>
                            </Select>
                          </FormControl>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* AI分析设置 */}
              {currentTab === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.analysis')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.autoAnalysis')}
                          </Typography>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={localSettings.analysis.autoAnalyze}
                                onChange={(e) =>
                                  setLocalSettings({
                                    ...localSettings,
                                    analysis: {
                                      ...localSettings.analysis,
                                      autoAnalyze: e.target.checked,
                                    },
                                  })
                                }
                              />
                            }
                            label={t('settings.enableAutoAnalysis')}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.confidenceThreshold')}
                          </Typography>
                          <Box sx={{ px: 2 }}>
                            <Slider
                              value={localSettings.analysis.confidenceThreshold * 100}
                              onChange={(_, value) =>
                                setLocalSettings({
                                  ...localSettings,
                                  analysis: {
                                    ...localSettings.analysis,
                                    confidenceThreshold: (value as number) / 100,
                                  },
                                })
                              }
                              step={5}
                              marks
                              min={50}
                              max={100}
                              valueLabelDisplay="on"
                              valueLabelFormat={(value) => `${value}%`}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('settings.confidenceThresholdDesc')}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* 显示设置 */}
              {currentTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.appearance')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.themeMode')}
                          </Typography>
                          <FormControl fullWidth>
                            <InputLabel>{t('settings.theme')}</InputLabel>
                            <Select
                              value={localSettings.display.theme}
                              label={t('settings.theme')}
                              onChange={(e) =>
                                setLocalSettings({
                                  ...localSettings,
                                  display: {
                                    ...localSettings.display,
                                    theme: e.target.value as any,
                                  },
                                })
                              }
                            >
                              <MenuItem value="light">{t('settings.lightMode')}</MenuItem>
                              <MenuItem value="dark">{t('settings.darkMode')}</MenuItem>
                              <MenuItem value="auto">{t('settings.systemMode')}</MenuItem>
                            </Select>
                          </FormControl>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.language')}
                          </Typography>
                          <FormControl fullWidth>
                            <InputLabel>{t('settings.language')}</InputLabel>
                            <Select
                              value={localSettings.display.language}
                              label={t('settings.language')}
                              onChange={(e) =>
                                setLocalSettings({
                                  ...localSettings,
                                  display: {
                                    ...localSettings.display,
                                    language: e.target.value as any,
                                  },
                                })
                              }
                            >
                              <MenuItem value="zh-CN">{t('settings.simplifiedChinese')}</MenuItem>
                              <MenuItem value="en-US">English</MenuItem>
                            </Select>
                          </FormControl>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.timezoneSettings')}
                          </Typography>
                          <FormControl fullWidth>
                            <InputLabel>{t('settings.timezone')}</InputLabel>
                            <Select
                              value={localSettings.display.timezone}
                              label={t('settings.timezone')}
                              onChange={(e) =>
                                setLocalSettings({
                                  ...localSettings,
                                  display: {
                                    ...localSettings.display,
                                    timezone: e.target.value,
                                  },
                                })
                              }
                            >
                              <MenuItem value="Asia/Shanghai">Asia/Shanghai (UTC+8)</MenuItem>
                              <MenuItem value="America/New_York">America/New_York (UTC-5)</MenuItem>
                              <MenuItem value="Europe/London">Europe/London (UTC+0)</MenuItem>
                            </Select>
                          </FormControl>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* 集成连接 */}
              {currentTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.integrations')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <ConnectionStatus
                        name="Microsoft Graph"
                        icon={<InfoIcon />}
                        connected={localSettings.integration.microsoftGraph.isConnected}
                        lastSync={localSettings.integration.microsoftGraph.lastSync}
                        onConnect={() => handleConnect('Microsoft Graph')}
                        onDisconnect={() => handleDisconnect('Microsoft Graph')}
                        onSync={() => handleSync('Microsoft Graph')}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <ConnectionStatus
                        name="Trello"
                        icon={<LinkIcon />}
                        connected={localSettings.integration.trello.isConnected}
                        onConnect={() => handleConnect('Trello')}
                        onDisconnect={() => handleDisconnect('Trello')}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <ConnectionStatus
                        name="Jira"
                        icon={<LinkIcon />}
                        connected={localSettings.integration.jira.isConnected}
                        onConnect={() => handleConnect('Jira')}
                        onDisconnect={() => handleDisconnect('Jira')}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* 安全隐私 */}
              {currentTab === 4 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.security')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.dataPrivacy')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {t('settings.privacyDescription')}
                          </Typography>
                          <Stack spacing={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <CheckCircleIcon color="success" fontSize="small" />
                              <Typography variant="body2">{t('settings.endToEndEncryption')}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <CheckCircleIcon color="success" fontSize="small" />
                              <Typography variant="body2">{t('settings.localDataProcessing')}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <CheckCircleIcon color="success" fontSize="small" />
                              <Typography variant="body2">{t('settings.gdprCompliant')}</Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.accountSecurity')}
                          </Typography>
                          <Stack spacing={2}>
                            <Button variant="outlined" fullWidth>
                              {t('settings.changePassword')}
                            </Button>
                            <Button variant="outlined" fullWidth>
                              {t('settings.enableTwoFactor')}
                            </Button>
                            <Button variant="outlined" color="error" fullWidth>
                              {t('settings.downloadPersonalData')}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* 数据备份 */}
              {currentTab === 5 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.backup')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.autoBackup')}
                          </Typography>
                          <Alert severity="info" sx={{ mb: 2 }}>
                            {t('settings.backupDescription')}
                          </Alert>
                          <Stack spacing={2}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">{t('settings.lastBackupTime')}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {new Date().toLocaleString()}
                              </Typography>
                            </Box>
                            <Button variant="outlined" startIcon={<BackupIcon />}>
                              {t('settings.manualBackup')}
                            </Button>
                            <Button variant="outlined" startIcon={<RefreshIcon />}>
                              {t('settings.restoreFromBackup')}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* 关于帮助 */}
              {currentTab === 6 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('settings.about')}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.versionInfo')}
                          </Typography>
                          <Stack spacing={1}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('settings.appVersion')}</Typography>
                              <Typography variant="body2" fontWeight="bold">v1.0.0</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('settings.buildTime')}</Typography>
                              <Typography variant="body2">2024-01-20</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">{t('settings.systemStatus')}</Typography>
                              <Chip label={t('settings.normal')} size="small" color="success" />
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.getHelp')}
                          </Typography>
                          <Stack spacing={2}>
                            <Button variant="outlined" fullWidth>
                              {t('settings.userManual')}
                            </Button>
                            <Button variant="outlined" fullWidth>
                              {t('settings.contactSupport')}
                            </Button>
                            <Button variant="outlined" fullWidth>
                              {t('settings.feedback')}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {t('settings.acknowledgments')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('settings.acknowledgmentsDesc')}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* 重置确认对话框 */}
        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
          <DialogTitle>{t('settings.confirmReset')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('settings.confirmResetMessage')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>{t('actions.cancel')}</Button>
            <Button color="error" variant="contained" onClick={handleResetSettings}>
              {t('actions.reset')}
            </Button>
          </DialogActions>
        </Dialog>
      </LoadingState>
    </Box>
  );
};

export default Settings;