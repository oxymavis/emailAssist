import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Avatar,
  Switch,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Divider,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Sync as SyncIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  InfoOutlined as InfoIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface MailboxAccount {
  id: string;
  name: string;
  email: string;
  provider: 'outlook' | 'gmail' | 'exchange' | 'imap';
  status: 'connected' | 'disconnected' | 'syncing' | 'error' | 'expired';
  lastSync: Date | null;
  syncProgress: number;
  emailCount: number;
  avatar?: string;
  settings: {
    syncFrequency: number; // minutes
    syncEmails: boolean;
    syncCalendar: boolean;
    syncContacts: boolean;
    maxEmailAge: number; // days
    enableNotifications: boolean;
  };
  errorMessage?: string;
  syncStats: {
    totalEmails: number;
    newEmails: number;
    lastSyncDuration: number; // seconds
    nextSyncTime: Date | null;
  };
  connectionInfo: {
    server?: string;
    port?: number;
    security?: string;
    connectedAt: Date;
    tokenExpiresAt?: Date;
  };
}

interface SyncOperation {
  id: string;
  accountId: string;
  type: 'full' | 'incremental' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  emailsProcessed: number;
  errors: string[];
}

const MailboxConnectionManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [accounts, setAccounts] = useState<MailboxAccount[]>([]);
  const [syncOperations, setSyncOperations] = useState<SyncOperation[]>([]);
  const [addAccountDialog, setAddAccountDialog] = useState(false);
  const [editAccountDialog, setEditAccountDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MailboxAccount | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Initialize mock data
  useEffect(() => {
    initializeMockData();
  }, []);

  const initializeMockData = () => {
    const mockAccounts: MailboxAccount[] = [
      {
        id: '1',
        name: 'Work Email',
        email: 'john.doe@company.com',
        provider: 'outlook',
        status: 'connected',
        lastSync: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        syncProgress: 100,
        emailCount: 1247,
        avatar: '/avatars/outlook.png',
        settings: {
          syncFrequency: 15,
          syncEmails: true,
          syncCalendar: true,
          syncContacts: false,
          maxEmailAge: 90,
          enableNotifications: true
        },
        syncStats: {
          totalEmails: 1247,
          newEmails: 23,
          lastSyncDuration: 12,
          nextSyncTime: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        },
        connectionInfo: {
          server: 'outlook.office365.com',
          port: 993,
          security: 'TLS',
          connectedAt: new Date('2024-01-15T09:30:00'),
          tokenExpiresAt: new Date('2024-04-15T09:30:00')
        }
      },
      {
        id: '2',
        name: 'Personal Gmail',
        email: 'john.personal@gmail.com',
        provider: 'gmail',
        status: 'syncing',
        lastSync: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        syncProgress: 67,
        emailCount: 892,
        avatar: '/avatars/gmail.png',
        settings: {
          syncFrequency: 30,
          syncEmails: true,
          syncCalendar: false,
          syncContacts: true,
          maxEmailAge: 180,
          enableNotifications: false
        },
        syncStats: {
          totalEmails: 892,
          newEmails: 15,
          lastSyncDuration: 8,
          nextSyncTime: new Date(Date.now() + 25 * 60 * 1000)
        },
        connectionInfo: {
          server: 'imap.gmail.com',
          port: 993,
          security: 'SSL',
          connectedAt: new Date('2024-02-01T14:20:00')
        }
      },
      {
        id: '3',
        name: 'Support Team',
        email: 'support@company.com',
        provider: 'exchange',
        status: 'error',
        lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        syncProgress: 0,
        emailCount: 567,
        errorMessage: 'Authentication failed. Token has expired.',
        settings: {
          syncFrequency: 10,
          syncEmails: true,
          syncCalendar: true,
          syncContacts: true,
          maxEmailAge: 30,
          enableNotifications: true
        },
        syncStats: {
          totalEmails: 567,
          newEmails: 0,
          lastSyncDuration: 0,
          nextSyncTime: null
        },
        connectionInfo: {
          server: 'exchange.company.com',
          port: 993,
          security: 'TLS',
          connectedAt: new Date('2024-01-10T11:15:00'),
          tokenExpiresAt: new Date('2024-03-10T11:15:00')
        }
      }
    ];

    const mockSyncOperations: SyncOperation[] = [
      {
        id: 'sync1',
        accountId: '1',
        type: 'incremental',
        status: 'completed',
        progress: 100,
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        endTime: new Date(Date.now() - 5 * 60 * 1000 + 12 * 1000),
        emailsProcessed: 23,
        errors: []
      },
      {
        id: 'sync2',
        accountId: '2',
        type: 'incremental',
        status: 'running',
        progress: 67,
        startTime: new Date(Date.now() - 2 * 60 * 1000),
        emailsProcessed: 10,
        errors: []
      },
      {
        id: 'sync3',
        accountId: '3',
        type: 'manual',
        status: 'failed',
        progress: 0,
        startTime: new Date(Date.now() - 30 * 60 * 1000),
        endTime: new Date(Date.now() - 28 * 60 * 1000),
        emailsProcessed: 0,
        errors: ['Authentication failed', 'Token expired']
      }
    ];

    setAccounts(mockAccounts);
    setSyncOperations(mockSyncOperations);
  };

  const getStatusIcon = (status: MailboxAccount['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon color="success" />;
      case 'syncing':
        return <SyncIcon color="info" className="rotating" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'expired':
        return <WarningIcon color="warning" />;
      case 'disconnected':
        return <CloudOffIcon color="disabled" />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: MailboxAccount['status']) => {
    switch (status) {
      case 'connected': return 'success';
      case 'syncing': return 'info';
      case 'error': return 'error';
      case 'expired': return 'warning';
      case 'disconnected': return 'default';
      default: return 'default';
    }
  };

  const getProviderIcon = (provider: MailboxAccount['provider']) => {
    const icons = {
      outlook: '📧',
      gmail: '📮',
      exchange: '💼',
      imap: '📨'
    };
    return icons[provider] || '📧';
  };

  const handleSyncAccount = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account || account.status === 'syncing') return;

    // Update account status to syncing
    setAccounts(prev => prev.map(acc =>
      acc.id === accountId
        ? { ...acc, status: 'syncing', syncProgress: 0 }
        : acc
    ));

    // Create new sync operation
    const newSyncOperation: SyncOperation = {
      id: `sync_${Date.now()}`,
      accountId,
      type: 'manual',
      status: 'running',
      progress: 0,
      startTime: new Date(),
      emailsProcessed: 0,
      errors: []
    };

    setSyncOperations(prev => [newSyncOperation, ...prev]);

    // Simulate sync progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // Complete sync
        setAccounts(prev => prev.map(acc =>
          acc.id === accountId
            ? {
                ...acc,
                status: 'connected',
                syncProgress: 100,
                lastSync: new Date(),
                syncStats: {
                  ...acc.syncStats,
                  newEmails: Math.floor(Math.random() * 50),
                  lastSyncDuration: Math.floor(Math.random() * 30) + 5
                }
              }
            : acc
        ));

        setSyncOperations(prev => prev.map(op =>
          op.id === newSyncOperation.id
            ? {
                ...op,
                status: 'completed',
                progress: 100,
                endTime: new Date(),
                emailsProcessed: Math.floor(Math.random() * 50) + 10
              }
            : op
        ));
      } else {
        setAccounts(prev => prev.map(acc =>
          acc.id === accountId
            ? { ...acc, syncProgress: progress }
            : acc
        ));

        setSyncOperations(prev => prev.map(op =>
          op.id === newSyncOperation.id
            ? { ...op, progress }
            : op
        ));
      }
    }, 500);
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    setSyncOperations(prev => prev.filter(op => op.accountId !== accountId));
  };

  const handleToggleAccount = (accountId: string, enabled: boolean) => {
    setAccounts(prev => prev.map(acc =>
      acc.id === accountId
        ? { ...acc, status: enabled ? 'connected' : 'disconnected' }
        : acc
    ));
  };

  const renderAccountCard = (account: MailboxAccount) => (
    <Card key={account.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {getProviderIcon(account.provider)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={500}>
                  {account.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {account.email}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon(account.status)}
                <Chip
                  label={account.status}
                  size="small"
                  color={getStatusColor(account.status)}
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>
            </Box>

            {account.status === 'syncing' && (
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Syncing emails...</Typography>
                  <Typography variant="body2">{Math.round(account.syncProgress)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={account.syncProgress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            )}

            {account.errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {account.errorMessage}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary">
                    {account.emailCount.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Emails
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6" color="success.main">
                    {account.syncStats.newEmails}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    New Emails
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {account.lastSync ? account.lastSync.toLocaleTimeString() : 'Never'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last Sync
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {account.syncStats.nextSyncTime ?
                      new Date(account.syncStats.nextSyncTime.getTime() - Date.now()).getMinutes() + 'm' :
                      'Manual'
                    }
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Next Sync
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          <Box display="flex" flexDirection="column" gap={1}>
            <Switch
              checked={account.status !== 'disconnected'}
              onChange={(e) => handleToggleAccount(account.id, e.target.checked)}
              disabled={account.status === 'syncing'}
            />
            <Tooltip title="Sync Now">
              <IconButton
                onClick={() => handleSyncAccount(account.id)}
                disabled={account.status === 'syncing' || account.status === 'disconnected'}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton
                onClick={() => {
                  setSelectedAccount(account);
                  setEditAccountDialog(true);
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                onClick={() => handleDeleteAccount(account.id)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderSyncHistory = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Sync Operations
        </Typography>
        <List>
          {syncOperations.slice(0, 5).map((operation) => {
            const account = accounts.find(a => a.id === operation.accountId);
            return (
              <ListItem key={operation.id}>
                <ListItemIcon>
                  {operation.status === 'completed' && <CheckCircleIcon color="success" />}
                  {operation.status === 'running' && <CircularProgress size={20} />}
                  {operation.status === 'failed' && <ErrorIcon color="error" />}
                  {operation.status === 'pending' && <ScheduleIcon color="warning" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {account?.name} - {operation.type} sync
                      </Typography>
                      <Chip
                        label={operation.status}
                        size="small"
                        color={
                          operation.status === 'completed' ? 'success' :
                          operation.status === 'running' ? 'info' :
                          operation.status === 'failed' ? 'error' : 'warning'
                        }
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Started: {operation.startTime.toLocaleString()}
                      </Typography>
                      {operation.endTime && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Duration: {((operation.endTime.getTime() - operation.startTime.getTime()) / 1000).toFixed(1)}s
                        </Typography>
                      )}
                      {operation.emailsProcessed > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Emails processed: {operation.emailsProcessed}
                        </Typography>
                      )}
                      {operation.errors.length > 0 && (
                        <Typography variant="caption" color="error.main" display="block">
                          Errors: {operation.errors.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {operation.status === 'running' && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={operation.progress}
                        sx={{ width: 100, height: 4 }}
                      />
                      <Typography variant="caption">
                        {Math.round(operation.progress)}%
                      </Typography>
                    </Box>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );

  const renderAddAccountDialog = () => (
    <Dialog
      open={addAccountDialog}
      onClose={() => setAddAccountDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Add Email Account</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>Choose Email Provider</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                {[
                  { provider: 'outlook', name: 'Microsoft Outlook', icon: '📧' },
                  { provider: 'gmail', name: 'Google Gmail', icon: '📮' },
                  { provider: 'exchange', name: 'Exchange Server', icon: '💼' },
                  { provider: 'imap', name: 'IMAP/SMTP', icon: '📨' }
                ].map((option) => (
                  <Grid item xs={6} key={option.provider}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => setActiveStep(1)}
                    >
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" sx={{ mb: 1 }}>
                          {option.icon}
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {option.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </StepContent>
          </Step>
          <Step>
            <StepLabel>Enter Account Details</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Account Name"
                    fullWidth
                    placeholder="e.g., Work Email"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    placeholder="your.email@company.com"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => setActiveStep(2)}
                    sx={{ mt: 1 }}
                  >
                    Continue with OAuth
                  </Button>
                </Grid>
              </Grid>
            </StepContent>
          </Step>
          <Step>
            <StepLabel>Configure Sync Settings</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Sync Frequency</InputLabel>
                    <Select defaultValue={15} label="Sync Frequency">
                      <MenuItem value={5}>Every 5 minutes</MenuItem>
                      <MenuItem value={15}>Every 15 minutes</MenuItem>
                      <MenuItem value={30}>Every 30 minutes</MenuItem>
                      <MenuItem value={60}>Every hour</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Email Age Limit</InputLabel>
                    <Select defaultValue={90} label="Email Age Limit">
                      <MenuItem value={30}>Last 30 days</MenuItem>
                      <MenuItem value={90}>Last 90 days</MenuItem>
                      <MenuItem value={180}>Last 6 months</MenuItem>
                      <MenuItem value={365}>Last year</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <label>
                      <input type="checkbox" defaultChecked /> Sync Emails
                    </label>
                    <label>
                      <input type="checkbox" /> Sync Calendar
                    </label>
                    <label>
                      <input type="checkbox" /> Sync Contacts
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked /> Enable Notifications
                    </label>
                  </Box>
                </Grid>
              </Grid>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAddAccountDialog(false)}>
          Cancel
        </Button>
        {activeStep === 2 && (
          <Button variant="contained" onClick={() => setAddAccountDialog(false)}>
            Add Account
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Mailbox Connection Manager
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your email accounts and synchronization settings
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddAccountDialog(true)}
        >
          Add Account
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Connected Accounts ({accounts.length})
            </Typography>
            {accounts.map(renderAccountCard)}
          </Box>
        </Grid>

        <Grid item xs={12} lg={4}>
          {renderSyncHistory()}
        </Grid>
      </Grid>

      {renderAddAccountDialog()}

      {/* Account Settings Dialog */}
      <Dialog
        open={editAccountDialog}
        onClose={() => setEditAccountDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Account Settings</DialogTitle>
        <DialogContent>
          {selectedAccount && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Account Name"
                  fullWidth
                  defaultValue={selectedAccount.name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sync Frequency</InputLabel>
                  <Select
                    defaultValue={selectedAccount.settings.syncFrequency}
                    label="Sync Frequency"
                  >
                    <MenuItem value={5}>Every 5 minutes</MenuItem>
                    <MenuItem value={15}>Every 15 minutes</MenuItem>
                    <MenuItem value={30}>Every 30 minutes</MenuItem>
                    <MenuItem value={60}>Every hour</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Email Age Limit</InputLabel>
                  <Select
                    defaultValue={selectedAccount.settings.maxEmailAge}
                    label="Email Age Limit"
                  >
                    <MenuItem value={30}>Last 30 days</MenuItem>
                    <MenuItem value={90}>Last 90 days</MenuItem>
                    <MenuItem value={180}>Last 6 months</MenuItem>
                    <MenuItem value={365}>Last year</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Sync Options
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <label>
                    <input
                      type="checkbox"
                      defaultChecked={selectedAccount.settings.syncEmails}
                    /> Sync Emails
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      defaultChecked={selectedAccount.settings.syncCalendar}
                    /> Sync Calendar
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      defaultChecked={selectedAccount.settings.syncContacts}
                    /> Sync Contacts
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      defaultChecked={selectedAccount.settings.enableNotifications}
                    /> Enable Notifications
                  </label>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Connection Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Server"
                      secondary={selectedAccount.connectionInfo.server}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Port"
                      secondary={selectedAccount.connectionInfo.port}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Security"
                      secondary={selectedAccount.connectionInfo.security}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Connected Since"
                      secondary={selectedAccount.connectionInfo.connectedAt.toLocaleDateString()}
                    />
                  </ListItem>
                  {selectedAccount.connectionInfo.tokenExpiresAt && (
                    <ListItem>
                      <ListItemText
                        primary="Token Expires"
                        secondary={selectedAccount.connectionInfo.tokenExpiresAt.toLocaleDateString()}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAccountDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained">
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .rotating {
            animation: spin 2s linear infinite;
          }
        `}
      </style>
    </Box>
  );
};

export default MailboxConnectionManager;