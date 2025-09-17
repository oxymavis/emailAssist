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
  Divider,
  Badge,
  useTheme
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
  Settings as SettingsIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

import { LoadingState, SkeletonCard } from '@/components/common/Loading';
import { useSettings, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { UserSettings } from '@/types';
import { useTranslation } from 'react-i18next';

// Import new setting components
import AdvancedSystemSettings from '@/components/settings/AdvancedSystemSettings';
import DataManagement from '@/components/settings/DataManagement';
import DeveloperTools from '@/components/settings/DeveloperTools';

// Connection status component
interface ConnectionStatusProps {
  name: string;
  icon: React.ReactNode;
  isConnected: boolean;
  lastSync?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  name,
  icon,
  isConnected,
  lastSync,
  onConnect,
  onDisconnect,
  onSync,
}) => {
  const { t } = useTranslation();

  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" justifyContent="between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            {icon}
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isConnected ? (
                  <>
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={t('settings.connected')}
                      size="small"
                      color="success"
                    />
                    {lastSync && (
                      <Typography variant="caption" display="block">
                        {t('settings.lastSync')}: {lastSync}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Chip label={t('settings.disconnected')} size="small" color="default" />
                )}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            {isConnected ? (
              <>
                {onSync && (
                  <Button size="small" onClick={onSync} startIcon={<RefreshIcon />}>
                    {t('settings.sync')}
                  </Button>
                )}
                <Button size="small" color="error" onClick={onDisconnect}>
                  {t('settings.disconnect')}
                </Button>
              </>
            ) : (
              <Button size="small" variant="contained" onClick={onConnect}>
                {t('settings.connect')}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const EnhancedSettings: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const { settings, updateSettings, loading } = useSettings();
  const { addNotification } = useNotifications();

  const [currentTab, setCurrentTab] = useState(0);
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Enhanced tabs configuration with new advanced features
  const tabs = [
    { label: t('settings.notifications'), icon: <NotificationsIcon /> },
    { label: t('settings.analysis'), icon: <PsychologyIcon /> },
    { label: t('settings.appearance'), icon: <PaletteIcon /> },
    { label: t('settings.integrations'), icon: <LinkIcon /> },
    { label: t('settings.security'), icon: <SecurityIcon /> },
    { label: t('settings.backup'), icon: <BackupIcon /> },
    { label: 'System Config', icon: <SettingsIcon /> },
    { label: 'Data Management', icon: <StorageIcon /> },
    { label: 'Developer Tools', icon: <CodeIcon /> },
    { label: t('settings.about'), icon: <HelpIcon /> },
  ];

  // Initialize settings
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
  }, []);

  // Track changes
  useEffect(() => {
    const hasChangesNow = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(hasChangesNow);
  }, [localSettings, settings]);

  const handleSaveSettings = async () => {
    try {
      updateSettings(localSettings);
      addNotification({
        type: 'success',
        title: t('settings.saveSuccess'),
        message: t('settings.saveSuccessMessage'),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: t('common.error'),
        message: 'Failed to save settings',
      });
    }
  };

  const handleResetSettings = async () => {
    try {
      const defaultSettings = mockDataService.getUserSettings();
      setLocalSettings(defaultSettings);
      updateSettings(defaultSettings);
      setResetDialogOpen(false);
      addNotification({
        type: 'success',
        title: t('settings.resetSuccess'),
        message: t('settings.resetSuccessMessage'),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: t('common.error'),
        message: 'Failed to reset settings',
      });
    }
  };

  const handleConnect = (service: string) => {
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

  const renderNotificationsTab = () => (
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
  );

  const renderIntegrationsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.integrations')}
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ConnectionStatus
            name="Microsoft Graph"
            icon={<Avatar src="/logos/microsoft.svg" sx={{ width: 32, height: 32 }} />}
            isConnected={localSettings.integration.microsoftGraph?.isConnected || false}
            lastSync={localSettings.integration.microsoftGraph?.lastSync}
            onConnect={() => handleConnect('Microsoft Graph')}
            onDisconnect={() => handleDisconnect('Microsoft Graph')}
            onSync={() => handleSync('Microsoft Graph')}
          />
        </Grid>
        <Grid item xs={12}>
          <ConnectionStatus
            name="Trello"
            icon={<Avatar src="/logos/trello.svg" sx={{ width: 32, height: 32 }} />}
            isConnected={localSettings.integration.trello?.isConnected || false}
            onConnect={() => handleConnect('Trello')}
            onDisconnect={() => handleDisconnect('Trello')}
          />
        </Grid>
        <Grid item xs={12}>
          <ConnectionStatus
            name="Jira"
            icon={<Avatar src="/logos/jira.svg" sx={{ width: 32, height: 32 }} />}
            isConnected={localSettings.integration.jira?.isConnected || false}
            onConnect={() => handleConnect('Jira')}
            onDisconnect={() => handleDisconnect('Jira')}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderAboutTab = () => (
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
                  <Typography variant="body2">2024-03-10</Typography>
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
  );

  return (
    <Box>
      {/* Page header */}
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
          <Badge badgeContent={hasChanges ? '!' : 0} color="warning">
            <Button
              variant="contained"
              onClick={handleSaveSettings}
              disabled={!hasChanges}
            >
              {t('settings.saveSettings')}
            </Button>
          </Badge>
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
          {/* Left side navigation */}
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
                    sx={{
                      justifyContent: 'flex-start',
                      minHeight: 48,
                      '&.Mui-selected': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main
                      }
                    }}
                  />
                ))}
              </Tabs>
            </Paper>
          </Grid>

          {/* Right side content */}
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 3, minHeight: 600 }}>
              {/* Original settings tabs */}
              {currentTab === 0 && renderNotificationsTab()}
              {currentTab === 3 && renderIntegrationsTab()}
              {currentTab === 9 && renderAboutTab()}

              {/* New advanced settings tabs */}
              {currentTab === 6 && <AdvancedSystemSettings />}
              {currentTab === 7 && <DataManagement />}
              {currentTab === 8 && <DeveloperTools />}

              {/* Placeholder for other existing tabs */}
              {[1, 2, 4, 5].includes(currentTab) && (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height={400}>
                  <InfoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Feature Coming Soon
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    This settings section is currently under development.<br />
                    Stay tuned for updates!
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Reset confirmation dialog */}
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

export default EnhancedSettings;