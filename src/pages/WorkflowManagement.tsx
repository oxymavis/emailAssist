/**
 * Workflow Management Page
 * P1 Feature - Comprehensive workflow and integration management
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Badge,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Settings,
  IntegrationInstructions as Integration,
  Timeline,
  Assessment,
  Notifications,
  Group,
  CheckCircle,
  Error,
  Warning,
  Schedule,
  TrendingUp,
  ExpandMore,
  Visibility,
  Share,
  Download,
  Upload,
  Link as LinkIcon,
  Refresh
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Import our custom components
import { AdvancedMetricsChart } from '../components/charts/AdvancedMetricsChart';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  platform: 'trello' | 'jira' | 'internal';
  conditions: {
    priority?: string;
    sender?: string;
    subject?: string;
    keywords?: string[];
  };
  actions: {
    createTask: boolean;
    assignTo?: string;
    addLabels?: string[];
    setDueDate?: boolean;
  };
  stats: {
    executions: number;
    successRate: number;
    lastExecuted?: Date;
  };
}

interface Integration {
  id: string;
  name: string;
  type: 'trello' | 'jira' | 'slack' | 'teams';
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  config: Record<string, any>;
  stats: {
    totalActions: number;
    successRate: number;
    errors: number;
  };
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`workflow-tabpanel-${index}`}
      aria-labelledby={`workflow-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

export const WorkflowManagement: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRuleDialog, setNewRuleDialog] = useState(false);

  // Sample data initialization
  useEffect(() => {
    const sampleRules: WorkflowRule[] = [
      {
        id: '1',
        name: 'Urgent Email to Trello',
        description: 'Automatically create Trello cards for urgent emails',
        enabled: true,
        platform: 'trello',
        conditions: {
          priority: 'high',
          keywords: ['urgent', 'critical', 'asap']
        },
        actions: {
          createTask: true,
          assignTo: 'john@company.com',
          addLabels: ['urgent', 'email'],
          setDueDate: true
        },
        stats: {
          executions: 147,
          successRate: 94.2,
          lastExecuted: new Date()
        }
      },
      {
        id: '2',
        name: 'Bug Reports to Jira',
        description: 'Create Jira issues for bug reports from customers',
        enabled: true,
        platform: 'jira',
        conditions: {
          sender: 'support',
          keywords: ['bug', 'error', 'issue', 'problem']
        },
        actions: {
          createTask: true,
          assignTo: 'dev-team',
          addLabels: ['bug', 'customer-reported']
        },
        stats: {
          executions: 89,
          successRate: 97.8,
          lastExecuted: new Date(Date.now() - 2 * 60 * 60 * 1000)
        }
      },
      {
        id: '3',
        name: 'Project Updates Internal',
        description: 'Track project update emails internally',
        enabled: false,
        platform: 'internal',
        conditions: {
          subject: 'project update',
          keywords: ['milestone', 'deadline', 'progress']
        },
        actions: {
          createTask: true,
          assignTo: 'project-manager'
        },
        stats: {
          executions: 23,
          successRate: 100,
          lastExecuted: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    ];

    const sampleIntegrations: Integration[] = [
      {
        id: '1',
        name: 'Company Trello',
        type: 'trello',
        status: 'connected',
        lastSync: new Date(),
        config: { boardId: 'abc123', apiKey: 'hidden' },
        stats: { totalActions: 234, successRate: 94.2, errors: 14 }
      },
      {
        id: '2',
        name: 'Development Jira',
        type: 'jira',
        status: 'connected',
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        config: { projectKey: 'DEV', host: 'company.atlassian.net' },
        stats: { totalActions: 156, successRate: 97.8, errors: 3 }
      },
      {
        id: '3',
        name: 'Team Slack',
        type: 'slack',
        status: 'error',
        lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
        config: { webhookUrl: 'hidden', channel: '#email-alerts' },
        stats: { totalActions: 45, successRate: 88.9, errors: 5 }
      }
    ];

    setTimeout(() => {
      setWorkflowRules(sampleRules);
      setIntegrations(sampleIntegrations);
      setLoading(false);
    }, 1000);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRuleToggle = (ruleId: string) => {
    setWorkflowRules(rules =>
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const handleRuleEdit = (rule: WorkflowRule) => {
    setSelectedRule(rule);
    setDialogOpen(true);
  };

  const handleRuleDelete = (ruleId: string) => {
    setWorkflowRules(rules => rules.filter(rule => rule.id !== ruleId));
  };

  const handleCreateRule = () => {
    setSelectedRule(null);
    setNewRuleDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'error':
        return 'error';
      case 'disconnected':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'disconnected':
        return <Warning color="warning" />;
      default:
        return <Schedule />;
    }
  };

  const renderWorkflowRules = () => (
    <Box>
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h6">Workflow Rules</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateRule}
        >
          Create Rule
        </Button>
      </Box>

      <Grid container spacing={3}>
        {workflowRules.map((rule) => (
          <Grid item xs={12} md={6} lg={4} key={rule.id}>
            <Card
              elevation={2}
              sx={{
                height: '100%',
                border: rule.enabled ? `2px solid ${theme.palette.success.main}20` : undefined
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="between" alignItems="start" mb={2}>
                  <Typography variant="h6" component="div">
                    {rule.name}
                  </Typography>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => handleRuleToggle(rule.id)}
                    color="primary"
                  />
                </Box>

                <Typography variant="body2" color="textSecondary" mb={2}>
                  {rule.description}
                </Typography>

                <Box mb={2}>
                  <Chip
                    label={rule.platform}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  {rule.conditions.keywords && (
                    <Chip
                      label={`${rule.conditions.keywords.length} keywords`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                <Box mb={2}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Executions: {rule.stats.executions}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Success Rate: {rule.stats.successRate}%
                  </Typography>
                  {rule.stats.lastExecuted && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      Last: {rule.stats.lastExecuted.toLocaleString()}
                    </Typography>
                  )}
                </Box>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => handleRuleEdit(rule)}
                >
                  View
                </Button>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => handleRuleEdit(rule)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={<Delete />}
                  onClick={() => handleRuleDelete(rule.id)}
                  color="error"
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderIntegrations = () => (
    <Box>
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h6">Integrations</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          Add Integration
        </Button>
      </Box>

      <Grid container spacing={3}>
        {integrations.map((integration) => (
          <Grid item xs={12} md={6} key={integration.id}>
            <Card elevation={2}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  {getStatusIcon(integration.status)}
                  <Typography variant="h6" component="div" sx={{ ml: 1, mr: 2 }}>
                    {integration.name}
                  </Typography>
                  <Chip
                    label={integration.status}
                    color={getStatusColor(integration.status)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="textSecondary" mb={2}>
                  Type: {integration.type.toUpperCase()}
                </Typography>

                <Box mb={2}>
                  <Typography variant="body2">
                    Total Actions: {integration.stats.totalActions}
                  </Typography>
                  <Typography variant="body2">
                    Success Rate: {integration.stats.successRate}%
                  </Typography>
                  <Typography variant="body2" color="error">
                    Errors: {integration.stats.errors}
                  </Typography>
                </Box>

                {integration.lastSync && (
                  <Typography variant="caption" color="textSecondary">
                    Last Sync: {integration.lastSync.toLocaleString()}
                  </Typography>
                )}
              </CardContent>

              <CardActions>
                <Button size="small" startIcon={<Settings />}>
                  Configure
                </Button>
                <Button size="small" startIcon={<Assessment />}>
                  Analytics
                </Button>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  disabled={integration.status === 'error'}
                >
                  Test
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderAnalytics = () => {
    const chartConfig = {
      type: 'line' as const,
      title: 'Workflow Execution Trends',
      description: 'Number of workflow executions over time',
      dataSource: 'workflows',
      metrics: ['executions', 'success_rate'],
      timeRange: '7d' as const,
      aggregation: 'sum' as const,
      customization: {
        showTrend: true,
        showComparison: true
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Workflow Analytics
        </Typography>

        <Grid container spacing={3}>
          {/* Key Metrics */}
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {workflowRules.reduce((sum, rule) => sum + rule.stats.executions, 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Executions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {(workflowRules.reduce((sum, rule) => sum + rule.stats.successRate, 0) / workflowRules.length).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Average Success Rate
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {workflowRules.filter(rule => rule.enabled).length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Active Rules
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {integrations.filter(i => i.status === 'connected').length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Connected Integrations
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Charts */}
          <Grid item xs={12} lg={8}>
            <AdvancedMetricsChart
              config={chartConfig}
              height={400}
              realTime={true}
              onRefresh={() => console.log('Refreshing chart data')}
              onExport={() => console.log('Exporting chart data')}
            />
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper elevation={1} sx={{ p: 2, height: 400, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List dense>
                {[
                  { text: 'Urgent email created Trello card', time: '2 min ago', type: 'success' },
                  { text: 'Bug report assigned to dev team', time: '15 min ago', type: 'info' },
                  { text: 'Slack integration failed', time: '1 hour ago', type: 'error' },
                  { text: 'Project update workflow executed', time: '2 hours ago', type: 'success' },
                  { text: 'New workflow rule created', time: '1 day ago', type: 'info' }
                ].map((activity, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {activity.type === 'success' && <CheckCircle color="success" fontSize="small" />}
                        {activity.type === 'error' && <Error color="error" fontSize="small" />}
                        {activity.type === 'info' && <Schedule color="info" fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.text}
                        secondary={activity.time}
                      />
                    </ListItem>
                    {index < 4 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Workflow Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              General Settings
            </Typography>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Enable automatic workflow execution"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Send notifications for workflow failures"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={<Switch />}
              label="Log all workflow activities"
              sx={{ mb: 2, display: 'block' }}
            />

            <TextField
              fullWidth
              label="Max concurrent executions"
              type="number"
              defaultValue={5}
              size="small"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Execution timeout (minutes)"
              type="number"
              defaultValue={10}
              size="small"
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Notification Settings
            </Typography>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Email notifications"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={<Switch />}
              label="Slack notifications"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="In-app notifications"
              sx={{ mb: 2, display: 'block' }}
            />

            <TextField
              fullWidth
              label="Notification email"
              type="email"
              defaultValue="admin@company.com"
              size="small"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Slack webhook URL"
              placeholder="https://hooks.slack.com/..."
              size="small"
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Workflow Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your email workflows and third-party integrations
        </Typography>
      </Box>

      <Paper elevation={1}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Workflows" icon={<Timeline />} iconPosition="start" />
          <Tab label="Integrations" icon={<Integration />} iconPosition="start" />
          <Tab label="Analytics" icon={<Assessment />} iconPosition="start" />
          <Tab label="Settings" icon={<Settings />} iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {renderWorkflowRules()}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderIntegrations()}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {renderAnalytics()}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {renderSettings()}
        </TabPanel>
      </Paper>

      {/* Floating Action Button */}
      <SpeedDial
        ariaLabel="Workflow actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<Add />}
          tooltipTitle="New Workflow"
          onClick={handleCreateRule}
        />
        <SpeedDialAction
          icon={<Integration />}
          tooltipTitle="Add Integration"
          onClick={() => setDialogOpen(true)}
        />
        <SpeedDialAction
          icon={<Download />}
          tooltipTitle="Export Config"
        />
        <SpeedDialAction
          icon={<Upload />}
          tooltipTitle="Import Config"
        />
      </SpeedDial>
    </Container>
  );
};

export default WorkflowManagement;