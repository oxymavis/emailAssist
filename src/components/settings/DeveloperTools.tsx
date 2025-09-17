import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Key as KeyIcon,
  Webhook as WebhookIcon,
  Api as ApiIcon,
  BugReport as BugReportIcon,
  Terminal as TerminalIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  enabled: boolean;
  expiresAt?: Date;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
}

interface DebugLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

interface SystemMetric {
  name: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'critical';
}

const DeveloperTools: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);
  const [selectedWebhook, setSelectedWebhookEndpoint] = useState<WebhookEndpoint | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk-prod-1234567890abcdef',
      permissions: ['read:emails', 'write:analysis', 'read:reports'],
      createdAt: new Date('2024-01-15T10:30:00'),
      lastUsed: new Date('2024-03-10T14:25:00'),
      enabled: true,
      expiresAt: new Date('2024-12-31T23:59:59')
    },
    {
      id: '2',
      name: 'Development API Key',
      key: 'sk-dev-abcdef1234567890',
      permissions: ['read:emails', 'read:analysis'],
      createdAt: new Date('2024-02-01T09:15:00'),
      lastUsed: new Date('2024-03-08T11:45:00'),
      enabled: true
    },
    {
      id: '3',
      name: 'Testing API Key',
      key: 'sk-test-0987654321fedcba',
      permissions: ['read:emails'],
      createdAt: new Date('2024-02-15T16:20:00'),
      enabled: false
    }
  ]);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    {
      id: '1',
      name: 'Email Analysis Webhook',
      url: 'https://api.example.com/webhooks/analysis',
      events: ['email.analyzed', 'analysis.completed'],
      secret: 'whsec_1234567890abcdef',
      enabled: true,
      lastTriggered: new Date('2024-03-10T15:30:00'),
      successCount: 1247,
      failureCount: 23
    },
    {
      id: '2',
      name: 'Report Generation Webhook',
      url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      events: ['report.generated', 'report.failed'],
      secret: 'whsec_abcdef1234567890',
      enabled: true,
      lastTriggered: new Date('2024-03-09T09:15:00'),
      successCount: 89,
      failureCount: 2
    }
  ]);

  const [debugLogs] = useState<DebugLog[]>([
    {
      id: '1',
      timestamp: new Date('2024-03-10T16:45:23'),
      level: 'error',
      category: 'API',
      message: 'Rate limit exceeded for API key sk-prod-****',
      data: { endpoint: '/api/v1/analysis', attempts: 101 }
    },
    {
      id: '2',
      timestamp: new Date('2024-03-10T16:44:15'),
      level: 'warn',
      category: 'Webhook',
      message: 'Webhook delivery failed, retrying...',
      data: { webhook_id: '1', attempt: 2 }
    },
    {
      id: '3',
      timestamp: new Date('2024-03-10T16:43:08'),
      level: 'info',
      category: 'Analysis',
      message: 'Email analysis completed successfully',
      data: { email_id: 'email_123', processing_time: '2.3s' }
    },
    {
      id: '4',
      timestamp: new Date('2024-03-10T16:42:45'),
      level: 'debug',
      category: 'Cache',
      message: 'Cache hit for analysis request',
      data: { cache_key: 'analysis_456', ttl: 3600 }
    }
  ]);

  const [systemMetrics] = useState<SystemMetric[]>([
    { name: 'API Requests/min', value: 47, status: 'good' },
    { name: 'Active Connections', value: 23, status: 'good' },
    { name: 'Memory Usage', value: 68, unit: '%', status: 'warning' },
    { name: 'CPU Usage', value: 34, unit: '%', status: 'good' },
    { name: 'Queue Size', value: 12, status: 'good' },
    { name: 'Error Rate', value: 0.2, unit: '%', status: 'good' }
  ]);

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const maskSecret = (secret: string, show: boolean) => {
    if (show) return secret;
    return secret.substring(0, 8) + '****' + secret.substring(secret.length - 4);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleTestWebhook = (webhook: WebhookEndpoint) => {
    console.log('Testing webhook:', webhook.name);
    // Test webhook logic
  };

  const renderAPIKeysTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">API Keys Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedApiKey(null);
            setApiKeyDialog(true);
          }}
        >
          Create API Key
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Key</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {apiKey.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created: {apiKey.createdAt.toLocaleDateString()}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontFamily="monospace">
                      {maskSecret(apiKey.key, showSecrets[apiKey.id] || false)}
                    </Typography>
                    <Tooltip title={showSecrets[apiKey.id] ? 'Hide' : 'Show'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleSecretVisibility(apiKey.id)}
                      >
                        {showSecrets[apiKey.id] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy">
                      <IconButton
                        size="small"
                        onClick={() => copyToClipboard(apiKey.key)}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {apiKey.permissions.map((permission) => (
                      <Chip
                        key={permission}
                        label={permission}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {apiKey.lastUsed ? apiKey.lastUsed.toLocaleDateString() : 'Never'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={apiKey.enabled ? 'Active' : 'Disabled'}
                    size="small"
                    color={apiKey.enabled ? 'success' : 'default'}
                  />
                  {apiKey.expiresAt && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Expires: {apiKey.expiresAt.toLocaleDateString()}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedApiKey(apiKey);
                        setApiKeyDialog(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderWebhooksTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Webhook Endpoints</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedWebhookEndpoint(null);
            setWebhookDialog(true);
          }}
        >
          Add Webhook
        </Button>
      </Box>

      <Grid container spacing={3}>
        {webhooks.map((webhook) => (
          <Grid item xs={12} key={webhook.id}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="h6">{webhook.name}</Typography>
                      <Chip
                        label={webhook.enabled ? 'Active' : 'Disabled'}
                        size="small"
                        color={webhook.enabled ? 'success' : 'default'}
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      fontFamily="monospace"
                      gutterBottom
                    >
                      {webhook.url}
                    </Typography>

                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                      {webhook.events.map((event) => (
                        <Chip
                          key={event}
                          label={event}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">
                          Success Rate
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {Math.round((webhook.successCount / (webhook.successCount + webhook.failureCount)) * 100)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">
                          Total Calls
                        </Typography>
                        <Typography variant="h6">
                          {webhook.successCount + webhook.failureCount}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">
                          Last Triggered
                        </Typography>
                        <Typography variant="body2">
                          {webhook.lastTriggered ? webhook.lastTriggered.toLocaleDateString() : 'Never'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box display="flex" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => handleTestWebhook(webhook)}
                          >
                            Test
                          </Button>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedWebhookEndpoint(webhook);
                              setWebhookDialog(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                  <Switch
                    checked={webhook.enabled}
                    onChange={(e) => {
                      const updatedWebhooks = webhooks.map(w =>
                        w.id === webhook.id ? { ...w, enabled: e.target.checked } : w
                      );
                      setWebhooks(updatedWebhooks);
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderDebugConsoleTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Debug Console</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => console.log('Refreshing logs...')}
        >
          Refresh
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Live System Metrics
          </Typography>
          <Grid container spacing={2}>
            {systemMetrics.map((metric, index) => (
              <Grid item xs={6} sm={4} md={2} key={index}>
                <Box textAlign="center">
                  <Typography
                    variant="h6"
                    color={
                      metric.status === 'good' ? 'success.main' :
                      metric.status === 'warning' ? 'warning.main' : 'error.main'
                    }
                  >
                    {metric.value}{metric.unit}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metric.name}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Paper sx={{ height: 400, overflow: 'auto', p: 1, backgroundColor: '#1e1e1e' }}>
        {debugLogs.map((log) => (
          <Box
            key={log.id}
            display="flex"
            gap={1}
            py={0.5}
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color:
                log.level === 'error' ? '#ff6b6b' :
                log.level === 'warn' ? '#ffa726' :
                log.level === 'info' ? '#42a5f5' : '#9e9e9e'
            }}
          >
            <Typography
              component="span"
              sx={{ color: '#9e9e9e', minWidth: 180 }}
            >
              {log.timestamp.toISOString()}
            </Typography>
            <Typography
              component="span"
              sx={{
                minWidth: 60,
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              {log.level}
            </Typography>
            <Typography
              component="span"
              sx={{ minWidth: 80, color: '#81c784' }}
            >
              [{log.category}]
            </Typography>
            <Typography component="span" sx={{ flex: 1 }}>
              {log.message}
              {log.data && (
                <Typography
                  component="span"
                  sx={{ color: '#ffb74d', ml: 1 }}
                >
                  {JSON.stringify(log.data)}
                </Typography>
              )}
            </Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );

  const renderSystemInfoTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        System Information
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Application Info
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Version"
                    secondary="1.0.0-beta.3"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Build Date"
                    secondary="2024-03-10T10:30:00Z"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Environment"
                    secondary="Production"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Database Version"
                    secondary="PostgreSQL 15.2"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Cache Engine"
                    secondary="Redis 7.0.8"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Runtime Environment
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Node.js Version"
                    secondary="18.17.0"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="React Version"
                    secondary="18.2.0"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="TypeScript Version"
                    secondary="5.0.4"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Memory Usage"
                    secondary="342 MB / 512 MB"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Uptime"
                    secondary="15 days, 6 hours"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Feature Flags & Configuration
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox defaultChecked />}
                    label="Advanced Analytics"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox defaultChecked />}
                    label="Real-time Notifications"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Beta Features"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox defaultChecked />}
                    label="Debug Mode"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox defaultChecked />}
                    label="Performance Monitoring"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Experimental APIs"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <CodeIcon fontSize="large" color="primary" />
        <Typography variant="h5">Developer Tools</Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        These tools are intended for developers and system administrators.
        Use caution when modifying API keys and webhook configurations.
      </Alert>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<KeyIcon />}
            label="API Keys"
            iconPosition="start"
          />
          <Tab
            icon={<WebhookIcon />}
            label="Webhooks"
            iconPosition="start"
          />
          <Tab
            icon={<BugReportIcon />}
            label="Debug Console"
            iconPosition="start"
          />
          <Tab
            icon={<SettingsIcon />}
            label="System Info"
            iconPosition="start"
          />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && renderAPIKeysTab()}
          {activeTab === 1 && renderWebhooksTab()}
          {activeTab === 2 && renderDebugConsoleTab()}
          {activeTab === 3 && renderSystemInfoTab()}
        </Box>
      </Paper>

      {/* API Key Dialog */}
      <Dialog
        open={apiKeyDialog}
        onClose={() => setApiKeyDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedApiKey ? 'Edit API Key' : 'Create API Key'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Name"
                fullWidth
                defaultValue={selectedApiKey?.name}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>
              <Grid container spacing={1}>
                {['read:emails', 'write:emails', 'read:analysis', 'write:analysis', 'read:reports', 'write:reports', 'admin'].map((permission) => (
                  <Grid item key={permission}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          defaultChecked={selectedApiKey?.permissions.includes(permission)}
                        />
                      }
                      label={permission}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Expires At"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                defaultValue={selectedApiKey?.expiresAt?.toISOString().slice(0, 16)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained">
            {selectedApiKey ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Webhook Dialog */}
      <Dialog
        open={webhookDialog}
        onClose={() => setWebhookDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedWebhook ? 'Edit Webhook' : 'Add Webhook'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Name"
                fullWidth
                defaultValue={selectedWebhook?.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="URL"
                fullWidth
                defaultValue={selectedWebhook?.url}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Events
              </Typography>
              <Grid container spacing={1}>
                {['email.received', 'email.analyzed', 'analysis.completed', 'report.generated', 'report.failed', 'user.login', 'system.error'].map((event) => (
                  <Grid item key={event}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          defaultChecked={selectedWebhook?.events.includes(event)}
                        />
                      }
                      label={event}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWebhookDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained">
            {selectedWebhook ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeveloperTools;