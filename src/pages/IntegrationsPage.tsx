import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Integration types and interfaces
interface Integration {
  id: string;
  type: 'trello' | 'jira' | 'asana';
  name: string;
  isConnected: boolean;
  status: 'active' | 'error' | 'disabled';
  statistics: {
    totalTasksCreated: number;
    totalTasksUpdated: number;
    lastActivity: string | null;
    syncErrors: number;
  };
  configuration: {
    defaultProject?: string;
    defaultAssignee?: string;
    taskTemplate?: string;
    autoSync?: boolean;
    syncInterval?: number;
  };
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface WorkflowTask {
  id: string;
  title: string;
  status: 'created' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string | null;
  externalUrl: string | null;
  dueDate: string | null;
  createdAt: string;
  integration: {
    type: string;
    name: string;
  };
}

const IntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [newIntegration, setNewIntegration] = useState({
    type: 'trello' as const,
    name: '',
    credentials: {
      apiKey: '',
      accessToken: '',
      apiUrl: ''
    },
    configuration: {
      defaultProject: '',
      defaultAssignee: '',
      taskTemplate: 'Email Task: {subject}',
      autoSync: true,
      syncInterval: 30
    }
  });

  // Load integrations and tasks
  useEffect(() => {
    loadIntegrations();
    loadTasks();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockIntegrations: Integration[] = [
        {
          id: '1',
          type: 'trello',
          name: 'Marketing Board',
          isConnected: true,
          status: 'active',
          statistics: {
            totalTasksCreated: 45,
            totalTasksUpdated: 12,
            lastActivity: '2024-01-15T10:30:00Z',
            syncErrors: 0
          },
          configuration: {
            defaultProject: 'Marketing Tasks',
            defaultAssignee: 'john@company.com',
            taskTemplate: 'Email: {subject}',
            autoSync: true,
            syncInterval: 30
          },
          lastSyncAt: '2024-01-15T10:30:00Z',
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          type: 'jira',
          name: 'Development Project',
          isConnected: false,
          status: 'error',
          statistics: {
            totalTasksCreated: 0,
            totalTasksUpdated: 0,
            lastActivity: null,
            syncErrors: 3
          },
          configuration: {
            defaultProject: 'DEV-123',
            autoSync: false,
            syncInterval: 60
          },
          lastSyncAt: null,
          errorMessage: 'Authentication failed - please reconnect',
          createdAt: '2024-01-10T00:00:00Z'
        }
      ];
      setIntegrations(mockIntegrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      // Mock data for demonstration
      const mockTasks: WorkflowTask[] = [
        {
          id: '1',
          title: 'Review customer feedback email',
          status: 'in_progress',
          priority: 'high',
          assignee: 'john@company.com',
          externalUrl: 'https://trello.com/c/abc123',
          dueDate: '2024-01-20T00:00:00Z',
          createdAt: '2024-01-15T10:30:00Z',
          integration: {
            type: 'trello',
            name: 'Marketing Board'
          }
        },
        {
          id: '2',
          title: 'Follow up on partnership proposal',
          status: 'completed',
          priority: 'medium',
          assignee: 'sarah@company.com',
          externalUrl: 'https://trello.com/c/def456',
          dueDate: null,
          createdAt: '2024-01-14T15:20:00Z',
          integration: {
            type: 'trello',
            name: 'Marketing Board'
          }
        }
      ];
      setTasks(mockTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleCreateIntegration = async () => {
    try {
      // TODO: Implement API call
      console.log('Creating integration:', newIntegration);
      setDialogOpen(false);
      setNewIntegration({
        type: 'trello',
        name: '',
        credentials: {
          apiKey: '',
          accessToken: '',
          apiUrl: ''
        },
        configuration: {
          defaultProject: '',
          defaultAssignee: '',
          taskTemplate: 'Email Task: {subject}',
          autoSync: true,
          syncInterval: 30
        }
      });
      await loadIntegrations();
    } catch (error) {
      console.error('Failed to create integration:', error);
    }
  };

  const handleTestConnection = async (integration: Integration) => {
    try {
      // TODO: Implement API call
      console.log('Testing connection for:', integration.id);
    } catch (error) {
      console.error('Failed to test connection:', error);
    }
  };

  const handleSyncIntegration = async (integration: Integration) => {
    try {
      // TODO: Implement API call
      console.log('Syncing integration:', integration.id);
    } catch (error) {
      console.error('Failed to sync integration:', error);
    }
  };

  const handleDeleteIntegration = async (integration: Integration) => {
    if (window.confirm(t('integrations.confirmDelete'))) {
      try {
        // TODO: Implement API call
        console.log('Deleting integration:', integration.id);
        await loadIntegrations();
      } catch (error) {
        console.error('Failed to delete integration:', error);
      }
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'trello':
        return '🔷';
      case 'jira':
        return '🔵';
      case 'asana':
        return '🔴';
      default:
        return '⚙️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'error':
        return 'error';
      case 'disabled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#757575';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('integrations.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t('integrations.addIntegration')}
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label={t('integrations.overview')} />
        <Tab label={t('integrations.tasks')} />
      </Tabs>

      {/* Integrations Tab */}
      {tabValue === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {integrations.map((integration) => (
                <Grid item xs={12} md={6} lg={4} key={integration.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ mr: 1 }}>
                          {getIntegrationIcon(integration.type)}
                        </Typography>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                          {integration.name}
                        </Typography>
                        <Chip
                          label={integration.status}
                          color={getStatusColor(integration.status) as any}
                          size="small"
                        />
                      </Box>

                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {integration.type.charAt(0).toUpperCase() + integration.type.slice(1)} Integration
                      </Typography>

                      {integration.errorMessage && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {integration.errorMessage}
                        </Alert>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="body2">
                          Tasks Created: {integration.statistics.totalTasksCreated}
                        </Typography>
                        <Typography variant="body2">
                          Errors: {integration.statistics.syncErrors}
                        </Typography>
                      </Box>

                      {integration.lastSyncAt && (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title={t('integrations.sync')}>
                          <IconButton
                            size="small"
                            onClick={() => handleSyncIntegration(integration)}
                            disabled={!integration.isConnected}
                          >
                            <SyncIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('integrations.settings')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setSettingsDialogOpen(true);
                            }}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('integrations.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteIntegration(integration)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Tasks Tab */}
      {tabValue === 1 && (
        <Box>
          <List>
            {tasks.map((task) => (
              <ListItem key={task.id}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {task.title}
                      </Typography>
                      <Chip
                        label={task.priority}
                        size="small"
                        sx={{ backgroundColor: getPriorityColor(task.priority), color: 'white' }}
                      />
                      <Chip
                        label={task.status}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {task.integration.name} • {task.assignee || 'Unassigned'}
                      </Typography>
                      {task.dueDate && (
                        <Typography variant="body2" color="textSecondary">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {task.externalUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => window.open(task.externalUrl!, '_blank')}
                    >
                      {t('integrations.viewInApp')}
                    </Button>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Add Integration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('integrations.addIntegration')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('integrations.type')}</InputLabel>
                <Select
                  value={newIntegration.type}
                  onChange={(e) => setNewIntegration({
                    ...newIntegration,
                    type: e.target.value as any
                  })}
                >
                  <MenuItem value="trello">Trello</MenuItem>
                  <MenuItem value="jira">Jira</MenuItem>
                  <MenuItem value="asana">Asana</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('integrations.name')}
                value={newIntegration.name}
                onChange={(e) => setNewIntegration({
                  ...newIntegration,
                  name: e.target.value
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('integrations.apiKey')}
                value={newIntegration.credentials.apiKey}
                onChange={(e) => setNewIntegration({
                  ...newIntegration,
                  credentials: {
                    ...newIntegration.credentials,
                    apiKey: e.target.value
                  }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('integrations.accessToken')}
                value={newIntegration.credentials.accessToken}
                onChange={(e) => setNewIntegration({
                  ...newIntegration,
                  credentials: {
                    ...newIntegration.credentials,
                    accessToken: e.target.value
                  }
                })}
              />
            </Grid>
            {newIntegration.type === 'jira' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('integrations.apiUrl')}
                  value={newIntegration.credentials.apiUrl}
                  onChange={(e) => setNewIntegration({
                    ...newIntegration,
                    credentials: {
                      ...newIntegration.credentials,
                      apiUrl: e.target.value
                    }
                  })}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreateIntegration} variant="contained">
            {t('integrations.connect')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('integrations.settings')}</DialogTitle>
        <DialogContent>
          {selectedIntegration && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('integrations.defaultProject')}
                  value={selectedIntegration.configuration.defaultProject || ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('integrations.defaultAssignee')}
                  value={selectedIntegration.configuration.defaultAssignee || ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('integrations.taskTemplate')}
                  value={selectedIntegration.configuration.taskTemplate || ''}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ flexGrow: 1 }}>
                    {t('integrations.autoSync')}
                  </Typography>
                  <Switch
                    checked={selectedIntegration.configuration.autoSync || false}
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('integrations.syncInterval')}
                  type="number"
                  value={selectedIntegration.configuration.syncInterval || 30}
                  InputProps={{ endAdornment: 'minutes' }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationsPage;