import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  CloudSync as SyncIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  BugReport as DebugIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  progress: number;
  currentStep: number;
  totalSteps: number;
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  steps: WorkflowStep[];
  metadata: {
    triggeredBy: string;
    executionMode: 'auto' | 'manual' | 'scheduled';
    retryCount: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      network: number;
    };
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'transform' | 'validate' | 'api_call' | 'condition' | 'loop';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  errorMessage?: string;
  logs: string[];
}

interface QueueMetrics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  throughputPerHour: number;
  errorRate: number;
}

const WorkflowExecutionEngine: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // 执行状态
  const [isEngineRunning, setIsEngineRunning] = useState(true);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([
    {
      id: '1',
      workflowId: 'wf_001',
      workflowName: 'Trello Card Creation',
      status: 'completed',
      priority: 'high',
      startTime: new Date('2024-03-14T10:30:00'),
      endTime: new Date('2024-03-14T10:30:05'),
      duration: 5000,
      progress: 100,
      currentStep: 3,
      totalSteps: 3,
      inputData: {
        emailId: 'email_123',
        subject: 'Project deadline approaching',
        sender: { name: 'John Doe', email: 'john@example.com' },
        priority: 'high',
      },
      outputData: {
        cardId: 'card_456',
        cardUrl: 'https://trello.com/c/abc123',
        success: true,
      },
      steps: [
        {
          id: 'step_1',
          name: 'Data Validation',
          type: 'validate',
          status: 'completed',
          startTime: new Date('2024-03-14T10:30:00'),
          endTime: new Date('2024-03-14T10:30:01'),
          duration: 1000,
          logs: ['Validating input data...', 'All required fields present', 'Validation successful'],
        },
        {
          id: 'step_2',
          name: 'Data Transformation',
          type: 'transform',
          status: 'completed',
          startTime: new Date('2024-03-14T10:30:01'),
          endTime: new Date('2024-03-14T10:30:03'),
          duration: 2000,
          logs: ['Applying field mapping...', 'Transforming priority values', 'Formatting description'],
        },
        {
          id: 'step_3',
          name: 'Trello API Call',
          type: 'api_call',
          status: 'completed',
          startTime: new Date('2024-03-14T10:30:03'),
          endTime: new Date('2024-03-14T10:30:05'),
          duration: 2000,
          logs: ['Sending request to Trello API...', 'Card created successfully', 'Response received'],
        },
      ],
      metadata: {
        triggeredBy: 'email_received',
        executionMode: 'auto',
        retryCount: 0,
        resourceUsage: {
          cpu: 25,
          memory: 128,
          network: 45,
        },
      },
    },
    {
      id: '2',
      workflowId: 'wf_002',
      workflowName: 'Jira Issue Creation',
      status: 'running',
      priority: 'normal',
      startTime: new Date('2024-03-14T10:32:00'),
      duration: 8000,
      progress: 60,
      currentStep: 2,
      totalSteps: 4,
      inputData: {
        emailId: 'email_124',
        subject: 'Bug report: Login not working',
        sender: { name: 'Customer Support', email: 'support@customer.com' },
        priority: 'normal',
      },
      steps: [
        {
          id: 'step_1',
          name: 'Input Processing',
          type: 'transform',
          status: 'completed',
          startTime: new Date('2024-03-14T10:32:00'),
          endTime: new Date('2024-03-14T10:32:02'),
          duration: 2000,
          logs: ['Processing email content...', 'Extracting key information', 'Data prepared'],
        },
        {
          id: 'step_2',
          name: 'Priority Assessment',
          type: 'condition',
          status: 'running',
          startTime: new Date('2024-03-14T10:32:02'),
          logs: ['Analyzing email sentiment...', 'Checking priority keywords...'],
        },
        {
          id: 'step_3',
          name: 'Issue Creation',
          type: 'api_call',
          status: 'pending',
          logs: [],
        },
        {
          id: 'step_4',
          name: 'Notification',
          type: 'api_call',
          status: 'pending',
          logs: [],
        },
      ],
      metadata: {
        triggeredBy: 'email_received',
        executionMode: 'auto',
        retryCount: 1,
        resourceUsage: {
          cpu: 40,
          memory: 256,
          network: 30,
        },
      },
    },
    {
      id: '3',
      workflowId: 'wf_003',
      workflowName: 'Slack Alert',
      status: 'failed',
      priority: 'critical',
      startTime: new Date('2024-03-14T10:25:00'),
      endTime: new Date('2024-03-14T10:25:10'),
      duration: 10000,
      progress: 75,
      currentStep: 3,
      totalSteps: 3,
      inputData: {
        emailId: 'email_125',
        subject: 'CRITICAL: Server outage detected',
        priority: 'critical',
      },
      errorMessage: 'Slack webhook URL not accessible',
      steps: [
        {
          id: 'step_1',
          name: 'Message Formatting',
          type: 'transform',
          status: 'completed',
          duration: 1000,
          logs: ['Formatting Slack message...', 'Adding emoji and formatting', 'Message prepared'],
        },
        {
          id: 'step_2',
          name: 'Rate Limit Check',
          type: 'condition',
          status: 'completed',
          duration: 2000,
          logs: ['Checking rate limits...', 'Rate limit OK', 'Proceeding with send'],
        },
        {
          id: 'step_3',
          name: 'Send to Slack',
          type: 'api_call',
          status: 'failed',
          duration: 7000,
          errorMessage: 'Connection timeout: Slack webhook URL not accessible',
          logs: ['Sending to Slack webhook...', 'Connection timeout after 5s', 'Retrying...', 'Failed after 3 attempts'],
        },
      ],
      metadata: {
        triggeredBy: 'priority_alert',
        executionMode: 'auto',
        retryCount: 3,
      },
    },
  ]);

  // 队列指标
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics>({
    totalTasks: 247,
    pendingTasks: 5,
    runningTasks: 2,
    completedTasks: 235,
    failedTasks: 5,
    averageExecutionTime: 6500,
    throughputPerHour: 45,
    errorRate: 2.0,
  });

  // 对话框状态
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [debugDialogOpen, setDebugDialogOpen] = useState(false);

  // 模拟实时更新
  useEffect(() => {
    const interval = setInterval(() => {
      setExecutions(prev => prev.map(execution => {
        if (execution.status === 'running') {
          const newProgress = Math.min(execution.progress + Math.random() * 10, 100);
          const newCurrentStep = Math.min(
            Math.floor((newProgress / 100) * execution.totalSteps) + 1,
            execution.totalSteps
          );

          if (newProgress >= 100) {
            return {
              ...execution,
              status: Math.random() > 0.8 ? 'failed' : 'completed',
              progress: 100,
              currentStep: execution.totalSteps,
              endTime: new Date(),
              duration: Date.now() - execution.startTime.getTime(),
            };
          }

          return {
            ...execution,
            progress: newProgress,
            currentStep: newCurrentStep,
            duration: Date.now() - execution.startTime.getTime(),
          };
        }
        return execution;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 处理引擎启停
  const handleEngineToggle = () => {
    setIsEngineRunning(!isEngineRunning);
  };

  // 处理执行停止
  const handleStopExecution = (executionId: string) => {
    setExecutions(prev => prev.map(execution =>
      execution.id === executionId && execution.status === 'running'
        ? { ...execution, status: 'cancelled', endTime: new Date() }
        : execution
    ));
  };

  // 处理执行重试
  const handleRetryExecution = (executionId: string) => {
    setExecutions(prev => prev.map(execution => {
      if (execution.id === executionId && (execution.status === 'failed' || execution.status === 'cancelled')) {
        return {
          ...execution,
          status: 'pending',
          progress: 0,
          currentStep: 0,
          endTime: undefined,
          duration: undefined,
          errorMessage: undefined,
          metadata: {
            ...execution.metadata,
            retryCount: execution.metadata.retryCount + 1,
          },
        };
      }
      return execution;
    }));

    // 模拟重新开始执行
    setTimeout(() => {
      setExecutions(prev => prev.map(execution =>
        execution.id === executionId && execution.status === 'pending'
          ? { ...execution, status: 'running', startTime: new Date() }
          : execution
      ));
    }, 1000);
  };

  // 渲染执行列表
  const renderExecutionList = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">
            {t('workflows.activeExecutions')}
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={isEngineRunning}
                  onChange={handleEngineToggle}
                  color="primary"
                />
              }
              label={isEngineRunning ? t('workflows.engineRunning') : t('workflows.engineStopped')}
            />
            <IconButton onClick={() => {/* 刷新列表 */}}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {!isEngineRunning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('workflows.engineStoppedWarning')}
          </Alert>
        )}

        <List>
          {executions.slice(0, 10).map((execution) => (
            <ListItem key={execution.id} divider>
              <ListItemIcon>
                {execution.status === 'completed' && <CheckIcon color="success" />}
                {execution.status === 'running' && <SyncIcon color="primary" />}
                {execution.status === 'failed' && <ErrorIcon color="error" />}
                {execution.status === 'cancelled' && <StopIcon color="action" />}
                {execution.status === 'pending' && <ScheduleIcon color="action" />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2">
                      {execution.workflowName}
                    </Typography>
                    <Chip
                      label={t(`workflows.priority.${execution.priority}`)}
                      size="small"
                      color={
                        execution.priority === 'critical' ? 'error' :
                        execution.priority === 'high' ? 'warning' :
                        execution.priority === 'normal' ? 'primary' : 'default'
                      }
                      variant="outlined"
                    />
                    <Chip
                      label={t(`workflows.status.${execution.status}`)}
                      size="small"
                      color={
                        execution.status === 'completed' ? 'success' :
                        execution.status === 'running' ? 'primary' :
                        execution.status === 'failed' ? 'error' : 'default'
                      }
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {execution.inputData?.subject || t('workflows.noSubject')}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(execution.startTime, 'HH:mm:ss', { locale: zhCN })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('workflows.step', { current: execution.currentStep, total: execution.totalSteps })}
                      </Typography>
                      {execution.duration && (
                        <Typography variant="caption" color="text.secondary">
                          {(execution.duration / 1000).toFixed(1)}s
                        </Typography>
                      )}
                      {execution.metadata.retryCount > 0 && (
                        <Typography variant="caption" color="warning.main">
                          {t('workflows.retried', { count: execution.metadata.retryCount })}
                        </Typography>
                      )}
                    </Box>
                    {execution.status === 'running' && (
                      <LinearProgress
                        variant="determinate"
                        value={execution.progress}
                        sx={{ mt: 1, mb: 1 }}
                      />
                    )}
                    {execution.errorMessage && (
                      <Typography variant="caption" color="error.main" display="block">
                        {execution.errorMessage}
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box display="flex" gap={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedExecution(execution);
                      setDetailsDialogOpen(true);
                    }}
                  >
                    <VisibilityIcon />
                  </IconButton>
                  {execution.status === 'running' && (
                    <IconButton
                      size="small"
                      onClick={() => handleStopExecution(execution.id)}
                    >
                      <StopIcon />
                    </IconButton>
                  )}
                  {(execution.status === 'failed' || execution.status === 'cancelled') && (
                    <IconButton
                      size="small"
                      onClick={() => handleRetryExecution(execution.id)}
                    >
                      <RefreshIcon />
                    </IconButton>
                  )}
                  {execution.status === 'failed' && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedExecution(execution);
                        setDebugDialogOpen(true);
                      }}
                    >
                      <DebugIcon />
                    </IconButton>
                  )}
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  // 渲染队列监控
  const renderQueueMonitoring = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6">
              {queueMetrics.pendingTasks}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('workflows.pendingTasks')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <SyncIcon color="primary" />
            <Typography variant="h6">
              {queueMetrics.runningTasks}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('workflows.runningTasks')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <SpeedIcon color="success" />
            <Typography variant="h6">
              {queueMetrics.throughputPerHour}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('workflows.throughputPerHour')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <ErrorIcon color="error" />
            <Typography variant="h6">
              {queueMetrics.errorRate}%
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('workflows.errorRate')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('workflows.executionStats')}
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary={t('workflows.totalExecutions')}
                secondary={queueMetrics.totalTasks}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={t('workflows.averageExecutionTime')}
                secondary={`${(queueMetrics.averageExecutionTime / 1000).toFixed(1)}s`}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={t('workflows.successRate')}
                secondary={`${((queueMetrics.completedTasks / queueMetrics.totalTasks) * 100).toFixed(1)}%`}
              />
            </ListItem>
          </List>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('workflows.resourceUsage')}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">CPU</Typography>
              <Typography variant="body2">45%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={45} sx={{ mt: 0.5 }} />
          </Box>
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">Memory</Typography>
              <Typography variant="body2">62%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={62} sx={{ mt: 0.5 }} />
          </Box>
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">Network</Typography>
              <Typography variant="body2">28%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={28} sx={{ mt: 0.5 }} />
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );

  // 渲染执行详情对话框
  const renderExecutionDetailsDialog = () => (
    <Dialog
      open={detailsDialogOpen}
      onClose={() => setDetailsDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {t('workflows.executionDetails')}: {selectedExecution?.workflowName}
      </DialogTitle>
      <DialogContent>
        {selectedExecution && (
          <Box>
            {/* 执行步骤 */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              {t('workflows.executionSteps')}
            </Typography>
            <Stepper orientation="vertical">
              {selectedExecution.steps.map((step, index) => (
                <Step key={step.id} active={step.status !== 'pending'} completed={step.status === 'completed'}>
                  <StepLabel error={step.status === 'failed'}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {step.name}
                      <Chip
                        label={t(`workflows.stepStatus.${step.status}`)}
                        size="small"
                        color={
                          step.status === 'completed' ? 'success' :
                          step.status === 'running' ? 'primary' :
                          step.status === 'failed' ? 'error' : 'default'
                        }
                      />
                      {step.duration && (
                        <Typography variant="caption" color="text.secondary">
                          {(step.duration / 1000).toFixed(1)}s
                        </Typography>
                      )}
                    </Box>
                  </StepLabel>
                  <StepContent>
                    {step.logs.length > 0 && (
                      <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
                        {step.logs.map((log, logIndex) => (
                          <Typography key={logIndex} variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                            {log}
                          </Typography>
                        ))}
                      </Paper>
                    )}
                    {step.errorMessage && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {step.errorMessage}
                      </Alert>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDetailsDialogOpen(false)}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('workflows.executionEngine')}
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label={t('workflows.activeExecutions')} />
        <Tab label={t('workflows.queueMonitoring')} />
        <Tab label={t('workflows.performance')} />
      </Tabs>

      <Box role="tabpanel" hidden={activeTab !== 0}>
        {activeTab === 0 && renderExecutionList()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && renderQueueMonitoring()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 2}>
        {activeTab === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflows.performanceAnalytics')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflows.performanceDescription')}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {renderExecutionDetailsDialog()}
    </Box>
  );
};

export default WorkflowExecutionEngine;