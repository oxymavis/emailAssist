import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  CloudSync as CloudSyncIcon,
  Security as SecurityIcon,
  Api as ApiIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EmailServerConfig {
  type: 'IMAP' | 'POP3' | 'Exchange';
  host: string;
  port: number;
  security: 'SSL' | 'TLS' | 'STARTTLS' | 'None';
  username: string;
  password: string;
  enabled: boolean;
}

interface APILimitConfig {
  id: string;
  name: string;
  endpoint: string;
  rateLimit: number;
  ratePeriod: string;
  enabled: boolean;
}

interface CacheConfig {
  emailCacheTTL: number;
  analysisCacheTTL: number;
  reportCacheTTL: number;
  maxCacheSize: number;
  compressionEnabled: boolean;
  autoCleanup: boolean;
}

interface PerformanceConfig {
  batchSize: number;
  maxConcurrentJobs: number;
  queueMaxSize: number;
  retryAttempts: number;
  timeoutSeconds: number;
  enableProfiling: boolean;
}

const AdvancedSystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [emailServers, setEmailServers] = useState<EmailServerConfig[]>([
    {
      type: 'IMAP',
      host: 'imap.gmail.com',
      port: 993,
      security: 'SSL',
      username: 'user@gmail.com',
      password: '••••••••',
      enabled: true
    },
    {
      type: 'Exchange',
      host: 'outlook.office365.com',
      port: 993,
      security: 'TLS',
      username: 'user@company.com',
      password: '••••••••',
      enabled: false
    }
  ]);

  const [apiLimits, setApiLimits] = useState<APILimitConfig[]>([
    {
      id: '1',
      name: 'Email Analysis API',
      endpoint: '/api/v1/analysis',
      rateLimit: 100,
      ratePeriod: 'minute',
      enabled: true
    },
    {
      id: '2',
      name: 'Report Generation API',
      endpoint: '/api/v1/reports',
      rateLimit: 50,
      ratePeriod: 'minute',
      enabled: true
    },
    {
      id: '3',
      name: 'Bulk Operations API',
      endpoint: '/api/v1/bulk',
      rateLimit: 20,
      ratePeriod: 'minute',
      enabled: true
    }
  ]);

  const [cacheConfig, setCacheConfig] = useState<CacheConfig>({
    emailCacheTTL: 3600, // 1 hour
    analysisCacheTTL: 7200, // 2 hours
    reportCacheTTL: 1800, // 30 minutes
    maxCacheSize: 1024, // 1GB in MB
    compressionEnabled: true,
    autoCleanup: true
  });

  const [performanceConfig, setPerformanceConfig] = useState<PerformanceConfig>({
    batchSize: 100,
    maxConcurrentJobs: 5,
    queueMaxSize: 1000,
    retryAttempts: 3,
    timeoutSeconds: 30,
    enableProfiling: false
  });

  const [editServerDialog, setEditServerDialog] = useState(false);
  const [editApiDialog, setEditApiDialog] = useState(false);
  const [selectedServer, setSelectedServer] = useState<EmailServerConfig | null>(null);
  const [selectedApiLimit, setSelectedApiLimit] = useState<APILimitConfig | null>(null);

  const handleEditServer = (server: EmailServerConfig) => {
    setSelectedServer(server);
    setEditServerDialog(true);
  };

  const handleEditApiLimit = (apiLimit: APILimitConfig) => {
    setSelectedApiLimit(apiLimit);
    setEditApiDialog(true);
  };

  const handleSaveServerConfig = () => {
    // Save server configuration logic
    setEditServerDialog(false);
  };

  const handleSaveApiConfig = () => {
    // Save API configuration logic
    setEditApiDialog(false);
  };

  const handleTestConnection = (server: EmailServerConfig) => {
    // Test email server connection
    console.log('Testing connection to:', server.host);
  };

  const getCacheUsagePercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100);
  };

  const renderEmailServerConfig = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CloudSyncIcon color="primary" />
          <Typography variant="h6">Email Server Configuration</Typography>
        </Box>

        <Grid container spacing={2}>
          {emailServers.map((server, index) => (
            <Grid item xs={12} key={index}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {server.type} - {server.host}
                        </Typography>
                        <Chip
                          label={server.enabled ? 'Active' : 'Inactive'}
                          size="small"
                          color={server.enabled ? 'success' : 'default'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {server.username} • Port {server.port} • {server.security}
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleTestConnection(server)}
                        >
                          Test Connection
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditServer(server)}
                        >
                          Edit
                        </Button>
                      </Box>
                    </Box>
                    <Switch
                      checked={server.enabled}
                      onChange={(e) => {
                        const updatedServers = [...emailServers];
                        updatedServers[index].enabled = e.target.checked;
                        setEmailServers(updatedServers);
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedServer(null);
                setEditServerDialog(true);
              }}
            >
              Add Email Server
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAPILimitsConfig = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <ApiIcon color="primary" />
          <Typography variant="h6">API Rate Limits</Typography>
        </Box>

        <List>
          {apiLimits.map((apiLimit, index) => (
            <React.Fragment key={apiLimit.id}>
              <ListItem>
                <ListItemText
                  primary={apiLimit.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {apiLimit.endpoint}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {apiLimit.rateLimit} requests per {apiLimit.ratePeriod}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={apiLimit.enabled ? 'Enabled' : 'Disabled'}
                      size="small"
                      color={apiLimit.enabled ? 'success' : 'default'}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleEditApiLimit(apiLimit)}
                    >
                      <EditIcon />
                    </IconButton>
                    <Switch
                      checked={apiLimit.enabled}
                      onChange={(e) => {
                        const updatedLimits = [...apiLimits];
                        updatedLimits[index].enabled = e.target.checked;
                        setApiLimits(updatedLimits);
                      }}
                    />
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
              {index < apiLimits.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedApiLimit(null);
            setEditApiDialog(true);
          }}
          sx={{ mt: 2 }}
        >
          Add API Limit
        </Button>
      </CardContent>
    </Card>
  );

  const renderCacheConfig = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Cache Configuration</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Cache TTL Settings (seconds)
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Email Cache TTL"
                type="number"
                value={cacheConfig.emailCacheTTL}
                onChange={(e) => setCacheConfig({
                  ...cacheConfig,
                  emailCacheTTL: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
              <TextField
                label="Analysis Cache TTL"
                type="number"
                value={cacheConfig.analysisCacheTTL}
                onChange={(e) => setCacheConfig({
                  ...cacheConfig,
                  analysisCacheTTL: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
              <TextField
                label="Report Cache TTL"
                type="number"
                value={cacheConfig.reportCacheTTL}
                onChange={(e) => setCacheConfig({
                  ...cacheConfig,
                  reportCacheTTL: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Cache Management
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Max Cache Size: {cacheConfig.maxCacheSize} MB
                </Typography>
                <Slider
                  value={cacheConfig.maxCacheSize}
                  onChange={(_, value) => setCacheConfig({
                    ...cacheConfig,
                    maxCacheSize: value as number
                  })}
                  min={128}
                  max={4096}
                  step={128}
                  marks={[
                    { value: 128, label: '128MB' },
                    { value: 1024, label: '1GB' },
                    { value: 4096, label: '4GB' }
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={cacheConfig.compressionEnabled}
                    onChange={(e) => setCacheConfig({
                      ...cacheConfig,
                      compressionEnabled: e.target.checked
                    })}
                  />
                }
                label="Enable Compression"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={cacheConfig.autoCleanup}
                    onChange={(e) => setCacheConfig({
                      ...cacheConfig,
                      autoCleanup: e.target.checked
                    })}
                  />
                }
                label="Auto Cleanup"
              />
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info">
              Current cache usage: 45% (461 MB / 1024 MB). Next cleanup in 2 hours.
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderPerformanceConfig = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SpeedIcon color="primary" />
          <Typography variant="h6">Performance Settings</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Processing Configuration
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Batch Size"
                type="number"
                value={performanceConfig.batchSize}
                onChange={(e) => setPerformanceConfig({
                  ...performanceConfig,
                  batchSize: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
                helperText="Number of items processed in each batch"
              />
              <TextField
                label="Max Concurrent Jobs"
                type="number"
                value={performanceConfig.maxConcurrentJobs}
                onChange={(e) => setPerformanceConfig({
                  ...performanceConfig,
                  maxConcurrentJobs: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
              <TextField
                label="Queue Max Size"
                type="number"
                value={performanceConfig.queueMaxSize}
                onChange={(e) => setPerformanceConfig({
                  ...performanceConfig,
                  queueMaxSize: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Reliability Settings
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Retry Attempts"
                type="number"
                value={performanceConfig.retryAttempts}
                onChange={(e) => setPerformanceConfig({
                  ...performanceConfig,
                  retryAttempts: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={performanceConfig.timeoutSeconds}
                onChange={(e) => setPerformanceConfig({
                  ...performanceConfig,
                  timeoutSeconds: parseInt(e.target.value) || 0
                })}
                size="small"
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={performanceConfig.enableProfiling}
                    onChange={(e) => setPerformanceConfig({
                      ...performanceConfig,
                      enableProfiling: e.target.checked
                    })}
                  />
                }
                label="Enable Performance Profiling"
              />
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <SettingsIcon fontSize="large" color="primary" />
        <Typography variant="h5">Advanced System Settings</Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        These are advanced system settings. Changes may affect system performance and stability.
        Please ensure you understand the implications before making modifications.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Email Server Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderEmailServerConfig()}
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">API Rate Limits</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderAPILimitsConfig()}
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Cache Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderCacheConfig()}
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Performance Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderPerformanceConfig()}
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button variant="outlined" startIcon={<RestoreIcon />}>
              Reset to Defaults
            </Button>
            <Button variant="contained" startIcon={<SaveIcon />}>
              Save Configuration
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Email Server Edit Dialog */}
      <Dialog
        open={editServerDialog}
        onClose={() => setEditServerDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedServer ? 'Edit Email Server' : 'Add Email Server'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Server Type</InputLabel>
                <Select
                  value={selectedServer?.type || 'IMAP'}
                  label="Server Type"
                >
                  <MenuItem value="IMAP">IMAP</MenuItem>
                  <MenuItem value="POP3">POP3</MenuItem>
                  <MenuItem value="Exchange">Exchange</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Host"
                fullWidth
                defaultValue={selectedServer?.host}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Port"
                type="number"
                fullWidth
                defaultValue={selectedServer?.port}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Security</InputLabel>
                <Select
                  value={selectedServer?.security || 'SSL'}
                  label="Security"
                >
                  <MenuItem value="SSL">SSL</MenuItem>
                  <MenuItem value="TLS">TLS</MenuItem>
                  <MenuItem value="STARTTLS">STARTTLS</MenuItem>
                  <MenuItem value="None">None</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Username"
                fullWidth
                defaultValue={selectedServer?.username}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Password"
                type="password"
                fullWidth
                defaultValue={selectedServer?.password}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditServerDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveServerConfig}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Limit Edit Dialog */}
      <Dialog
        open={editApiDialog}
        onClose={() => setEditApiDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedApiLimit ? 'Edit API Limit' : 'Add API Limit'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="API Name"
                fullWidth
                defaultValue={selectedApiLimit?.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Endpoint"
                fullWidth
                defaultValue={selectedApiLimit?.endpoint}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Rate Limit"
                type="number"
                fullWidth
                defaultValue={selectedApiLimit?.rateLimit}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Period</InputLabel>
                <Select
                  value={selectedApiLimit?.ratePeriod || 'minute'}
                  label="Period"
                >
                  <MenuItem value="second">Second</MenuItem>
                  <MenuItem value="minute">Minute</MenuItem>
                  <MenuItem value="hour">Hour</MenuItem>
                  <MenuItem value="day">Day</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditApiDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveApiConfig}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedSystemSettings;