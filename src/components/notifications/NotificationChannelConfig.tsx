import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Grid,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Test as TestIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  PhoneAndroid as MobileIcon,
  Notifications as PushIcon,
  Webhook as WebhookIcon,
  Slack as SlackIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'mobile' | 'webhook' | 'slack';
  enabled: boolean;
  config: {
    // Email配置
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;

    // SMS配置
    provider?: string;
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;

    // Push配置
    serverKey?: string;
    vapidKey?: string;

    // Webhook配置
    url?: string;
    method?: string;
    headers?: Record<string, string>;

    // Slack配置
    webhookUrl?: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;

    // 通用配置
    retryAttempts?: number;
    retryDelay?: number;
    timeout?: number;
    rateLimit?: number;
  };
  status: {
    lastTest?: Date;
    lastTestResult?: 'success' | 'failed';
    lastError?: string;
    uptime?: number;
    totalSent?: number;
    totalFailed?: number;
  };
  filters: {
    priorities: string[];
    types: string[];
    timeRestrictions?: {
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };
}

const NotificationChannelConfig: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: '1',
      name: 'Primary Email',
      type: 'email',
      enabled: true,
      config: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: true,
        fromEmail: 'noreply@emailassist.com',
        fromName: 'Email Assist',
        retryAttempts: 3,
        retryDelay: 5000,
        timeout: 30000,
      },
      status: {
        lastTest: new Date('2024-03-14T10:30:00'),
        lastTestResult: 'success',
        uptime: 99.2,
        totalSent: 1847,
        totalFailed: 23,
      },
      filters: {
        priorities: ['high', 'critical'],
        types: ['new_email', 'security_alert'],
      },
    },
    {
      id: '2',
      name: 'SMS Alerts',
      type: 'sms',
      enabled: false,
      config: {
        provider: 'twilio',
        apiKey: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        fromNumber: '+1234567890',
        retryAttempts: 2,
        retryDelay: 3000,
        rateLimit: 10,
      },
      status: {
        lastTest: new Date('2024-03-10T15:45:00'),
        lastTestResult: 'failed',
        lastError: 'Invalid API key',
        totalSent: 45,
        totalFailed: 5,
      },
      filters: {
        priorities: ['critical'],
        types: ['security_alert'],
      },
    },
    {
      id: '3',
      name: 'Browser Push',
      type: 'push',
      enabled: true,
      config: {
        serverKey: 'Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        retryAttempts: 1,
        timeout: 10000,
      },
      status: {
        lastTest: new Date('2024-03-14T09:15:00'),
        lastTestResult: 'success',
        uptime: 97.8,
        totalSent: 892,
        totalFailed: 18,
      },
      filters: {
        priorities: ['normal', 'high', 'critical'],
        types: ['new_email', 'analysis_complete', 'workflow_trigger'],
      },
    },
  ]);

  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // 渠道类型配置
  const channelTypes = [
    { key: 'email', label: t('notifications.channels.email'), icon: <EmailIcon />, color: '#1976d2' },
    { key: 'sms', label: t('notifications.channels.sms'), icon: <SmsIcon />, color: '#388e3c' },
    { key: 'push', label: t('notifications.channels.push'), icon: <PushIcon />, color: '#f57c00' },
    { key: 'mobile', label: t('notifications.channels.mobile'), icon: <MobileIcon />, color: '#7b1fa2' },
    { key: 'webhook', label: t('notifications.channels.webhook'), icon: <WebhookIcon />, color: '#d32f2f' },
    { key: 'slack', label: t('notifications.channels.slack'), icon: <SlackIcon />, color: '#4a154b' },
  ];

  // SMS提供商
  const smsProviders = [
    { key: 'twilio', label: 'Twilio' },
    { key: 'messagebird', label: 'MessageBird' },
    { key: 'nexmo', label: 'Nexmo' },
    { key: 'clickatell', label: 'Clickatell' },
  ];

  // 处理渠道切换
  const handleChannelToggle = (channelId: string) => {
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, enabled: !channel.enabled }
        : channel
    ));
  };

  // 处理渠道删除
  const handleDeleteChannel = (channelId: string) => {
    setChannels(prev => prev.filter(channel => channel.id !== channelId));
  };

  // 处理渠道测试
  const handleTestChannel = async (channel: NotificationChannel) => {
    setSelectedChannel(channel);
    setTestDialogOpen(true);

    // 模拟测试
    setTimeout(() => {
      const success = Math.random() > 0.3;
      setChannels(prev => prev.map(c =>
        c.id === channel.id
          ? {
              ...c,
              status: {
                ...c.status,
                lastTest: new Date(),
                lastTestResult: success ? 'success' : 'failed',
                lastError: success ? undefined : 'Test failed: Connection timeout',
              },
            }
          : c
      ));
    }, 2000);
  };

  // 渲染渠道配置表单
  const renderChannelForm = () => {
    if (!selectedChannel) return null;

    const steps = [
      { label: t('notifications.setup.basic'), content: renderBasicConfig() },
      { label: t('notifications.setup.connection'), content: renderConnectionConfig() },
      { label: t('notifications.setup.filters'), content: renderFiltersConfig() },
      { label: t('notifications.setup.advanced'), content: renderAdvancedConfig() },
    ];

    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editMode ? t('notifications.editChannel') : t('notifications.createChannel')}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  {step.content}
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (index === steps.length - 1) {
                          handleSaveChannel();
                        } else {
                          setActiveStep(index + 1);
                        }
                      }}
                      sx={{ mr: 1 }}
                    >
                      {index === steps.length - 1 ? t('common.save') : t('common.continue')}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={() => setActiveStep(index - 1)}
                    >
                      {t('common.back')}
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // 渲染基本配置
  const renderBasicConfig = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label={t('notifications.channelName')}
          value={selectedChannel?.name || ''}
          onChange={(e) => setSelectedChannel(prev => prev ? { ...prev, name: e.target.value } : null)}
        />
      </Grid>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <InputLabel>{t('notifications.channelType')}</InputLabel>
          <Select
            value={selectedChannel?.type || 'email'}
            onChange={(e) => setSelectedChannel(prev => prev ? { ...prev, type: e.target.value as any } : null)}
            label={t('notifications.channelType')}
          >
            {channelTypes.map((type) => (
              <MenuItem key={type.key} value={type.key}>
                <Box display="flex" alignItems="center" gap={1}>
                  {type.icon}
                  {type.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );

  // 渲染连接配置
  const renderConnectionConfig = () => {
    switch (selectedChannel?.type) {
      case 'email':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.smtp.host')}
                value={selectedChannel.config.smtpHost || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, smtpHost: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.smtp.port')}
                type="number"
                value={selectedChannel.config.smtpPort || 587}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, smtpPort: parseInt(e.target.value) }
                } : null)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedChannel.config.smtpSecure || false}
                    onChange={(e) => setSelectedChannel(prev => prev ? {
                      ...prev,
                      config: { ...prev.config, smtpSecure: e.target.checked }
                    } : null)}
                  />
                }
                label={t('notifications.smtp.secure')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.smtp.user')}
                value={selectedChannel.config.smtpUser || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, smtpUser: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.smtp.password')}
                type="password"
                value={selectedChannel.config.smtpPassword || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, smtpPassword: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.from.email')}
                value={selectedChannel.config.fromEmail || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, fromEmail: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.from.name')}
                value={selectedChannel.config.fromName || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, fromName: e.target.value }
                } : null)}
              />
            </Grid>
          </Grid>
        );

      case 'sms':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('notifications.sms.provider')}</InputLabel>
                <Select
                  value={selectedChannel.config.provider || 'twilio'}
                  onChange={(e) => setSelectedChannel(prev => prev ? {
                    ...prev,
                    config: { ...prev.config, provider: e.target.value }
                  } : null)}
                  label={t('notifications.sms.provider')}
                >
                  {smsProviders.map((provider) => (
                    <MenuItem key={provider.key} value={provider.key}>
                      {provider.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.sms.apiKey')}
                value={selectedChannel.config.apiKey || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, apiKey: e.target.value }
                } : null)}
                InputProps={{
                  startAdornment: <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('notifications.sms.apiSecret')}
                type="password"
                value={selectedChannel.config.apiSecret || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, apiSecret: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('notifications.sms.fromNumber')}
                value={selectedChannel.config.fromNumber || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, fromNumber: e.target.value }
                } : null)}
                helperText={t('notifications.sms.fromNumberHelp')}
              />
            </Grid>
          </Grid>
        );

      case 'webhook':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('notifications.webhook.url')}
                value={selectedChannel.config.url || ''}
                onChange={(e) => setSelectedChannel(prev => prev ? {
                  ...prev,
                  config: { ...prev.config, url: e.target.value }
                } : null)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('notifications.webhook.method')}</InputLabel>
                <Select
                  value={selectedChannel.config.method || 'POST'}
                  onChange={(e) => setSelectedChannel(prev => prev ? {
                    ...prev,
                    config: { ...prev.config, method: e.target.value }
                  } : null)}
                  label={t('notifications.webhook.method')}
                >
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="PATCH">PATCH</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      default:
        return (
          <Alert severity="info">
            {t('notifications.setup.noConfigRequired')}
          </Alert>
        );
    }
  };

  // 渲染过滤器配置
  const renderFiltersConfig = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          {t('notifications.filters.priorities')}
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {['low', 'normal', 'high', 'critical'].map((priority) => (
            <Chip
              key={priority}
              label={t(`priority.${priority}`)}
              clickable
              color={selectedChannel?.filters.priorities.includes(priority) ? 'primary' : 'default'}
              onClick={() => {
                const priorities = selectedChannel?.filters.priorities || [];
                const newPriorities = priorities.includes(priority)
                  ? priorities.filter(p => p !== priority)
                  : [...priorities, priority];
                setSelectedChannel(prev => prev ? {
                  ...prev,
                  filters: { ...prev.filters, priorities: newPriorities }
                } : null);
              }}
            />
          ))}
        </Box>
      </Grid>
    </Grid>
  );

  // 渲染高级配置
  const renderAdvancedConfig = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label={t('notifications.advanced.retryAttempts')}
          type="number"
          value={selectedChannel?.config.retryAttempts || 3}
          onChange={(e) => setSelectedChannel(prev => prev ? {
            ...prev,
            config: { ...prev.config, retryAttempts: parseInt(e.target.value) }
          } : null)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label={t('notifications.advanced.retryDelay')}
          type="number"
          value={selectedChannel?.config.retryDelay || 5000}
          onChange={(e) => setSelectedChannel(prev => prev ? {
            ...prev,
            config: { ...prev.config, retryDelay: parseInt(e.target.value) }
          } : null)}
          helperText={t('notifications.advanced.milliseconds')}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label={t('notifications.advanced.timeout')}
          type="number"
          value={selectedChannel?.config.timeout || 30000}
          onChange={(e) => setSelectedChannel(prev => prev ? {
            ...prev,
            config: { ...prev.config, timeout: parseInt(e.target.value) }
          } : null)}
          helperText={t('notifications.advanced.milliseconds')}
        />
      </Grid>
    </Grid>
  );

  // 处理保存渠道
  const handleSaveChannel = () => {
    if (!selectedChannel) return;

    if (editMode) {
      setChannels(prev => prev.map(channel =>
        channel.id === selectedChannel.id ? selectedChannel : channel
      ));
    } else {
      const newChannel = {
        ...selectedChannel,
        id: Date.now().toString(),
      };
      setChannels(prev => [...prev, newChannel]);
    }

    setDialogOpen(false);
    setSelectedChannel(null);
    setEditMode(false);
    setActiveStep(0);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          {t('notifications.channelConfig')}
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => {
            setSelectedChannel({
              id: '',
              name: '',
              type: 'email',
              enabled: true,
              config: {},
              status: {},
              filters: { priorities: [], types: [] },
            });
            setEditMode(false);
            setDialogOpen(true);
          }}
        >
          {t('notifications.addChannel')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {channels.map((channel) => {
          const channelType = channelTypes.find(t => t.key === channel.type);
          return (
            <Grid item xs={12} md={6} key={channel.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {channelType?.icon}
                      <Typography variant="h6">{channel.name}</Typography>
                      {!channel.enabled && (
                        <Chip label={t('common.disabled')} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Switch
                      checked={channel.enabled}
                      onChange={() => handleChannelToggle(channel.id)}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {channelType?.label}
                  </Typography>

                  {/* 状态指示器 */}
                  <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                    {channel.status.lastTestResult === 'success' ? (
                      <Chip
                        icon={<CheckIcon />}
                        label={t('notifications.status.healthy')}
                        color="success"
                        size="small"
                      />
                    ) : channel.status.lastTestResult === 'failed' ? (
                      <Chip
                        icon={<ErrorIcon />}
                        label={t('notifications.status.error')}
                        color="error"
                        size="small"
                      />
                    ) : (
                      <Chip
                        label={t('notifications.status.untested')}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* 统计信息 */}
                  {channel.status.totalSent !== undefined && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('notifications.stats.sent', { count: channel.status.totalSent })} •
                        {t('notifications.stats.failed', { count: channel.status.totalFailed || 0 })}
                        {channel.status.uptime && ` • ${t('notifications.stats.uptime', { uptime: channel.status.uptime })}%`}
                      </Typography>
                    </Box>
                  )}

                  {/* 错误信息 */}
                  {channel.status.lastError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        {channel.status.lastError}
                      </Typography>
                    </Alert>
                  )}

                  {/* 操作按钮 */}
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      startIcon={<TestIcon />}
                      onClick={() => handleTestChannel(channel)}
                      disabled={!channel.enabled}
                    >
                      {t('notifications.test')}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setEditMode(true);
                        setDialogOpen(true);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={() => handleDeleteChannel(channel.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {renderChannelForm()}
    </Box>
  );
};

export default NotificationChannelConfig;