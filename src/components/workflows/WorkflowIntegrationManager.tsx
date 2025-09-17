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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Tabs,
  Tab,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  CloudSync as SyncIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  Webhook as WebhookIcon,
  Storage as StorageIcon,
  Transform as TransformIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface WorkflowIntegration {
  id: string;
  name: string;
  type: 'trello' | 'jira' | 'asana' | 'notion' | 'slack' | 'teams' | 'webhook' | 'database';
  enabled: boolean;
  status: 'active' | 'inactive' | 'error' | 'pending';
  description: string;
  config: {
    // API配置
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    baseUrl?: string;

    // 项目/空间配置
    boardId?: string;
    projectId?: string;
    channelId?: string;
    databaseId?: string;

    // 触发条件
    triggers: {
      emailReceived: boolean;
      analysisComplete: boolean;
      priorityThreshold: 'low' | 'normal' | 'high' | 'critical';
      sentimentThreshold: 'negative' | 'neutral' | 'positive';
      categories: string[];
      keywords: string[];
    };

    // 数据映射
    fieldMapping: {
      title: string;
      description: string;
      priority: string;
      assignee?: string;
      labels?: string[];
      customFields?: Record<string, string>;
    };

    // 输出格式
    outputFormat: 'card' | 'issue' | 'task' | 'message' | 'record';
    template: string;

    // 高级设置
    batchProcessing: boolean;
    retryAttempts: number;
    retryDelay: number;
    rateLimit: number;
  };
  stats: {
    totalExecutions: number;
    successCount: number;
    errorCount: number;
    lastExecution?: Date;
    lastError?: string;
    averageResponseTime: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ExecutionLog {
  id: string;
  integrationId: string;
  integrationName: string;
  status: 'success' | 'error' | 'pending';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  retryCount: number;
}

const WorkflowIntegrationManager: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // 集成状态
  const [integrations, setIntegrations] = useState<WorkflowIntegration[]>([
    {
      id: '1',
      name: 'Trello Project Board',
      type: 'trello',
      enabled: true,
      status: 'active',
      description: '自动将高优先级邮件创建为Trello卡片',
      config: {
        apiKey: 'trello_api_key_placeholder',
        accessToken: 'trello_token_placeholder',
        boardId: '507f1f77bcf86cd799439011',
        triggers: {
          emailReceived: true,
          analysisComplete: false,
          priorityThreshold: 'high',
          sentimentThreshold: 'neutral',
          categories: ['work', 'project'],
          keywords: ['urgent', 'deadline', 'meeting'],
        },
        fieldMapping: {
          title: '{{subject}}',
          description: 'From: {{sender.name}} ({{sender.email}})\nReceived: {{receivedDateTime}}\n\n{{content}}',
          priority: '{{priority}}',
          labels: ['email', '{{category}}'],
        },
        outputFormat: 'card',
        template: 'default',
        batchProcessing: false,
        retryAttempts: 3,
        retryDelay: 5000,
        rateLimit: 10,
      },
      stats: {
        totalExecutions: 147,
        successCount: 142,
        errorCount: 5,
        lastExecution: new Date('2024-03-14T10:30:00'),
        averageResponseTime: 850,
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-10'),
    },
    {
      id: '2',
      name: 'Jira Issue Tracker',
      type: 'jira',
      enabled: true,
      status: 'active',
      description: '将支持请求邮件转换为Jira问题单',
      config: {
        baseUrl: 'https://company.atlassian.net',
        apiKey: 'jira_api_key_placeholder',
        projectId: 'SUPPORT',
        triggers: {
          emailReceived: true,
          analysisComplete: true,
          priorityThreshold: 'normal',
          sentimentThreshold: 'negative',
          categories: ['support', 'bug'],
          keywords: ['help', 'issue', 'problem'],
        },
        fieldMapping: {
          title: '[EMAIL] {{subject}}',
          description: 'Customer: {{sender.name}} ({{sender.email}})\nReceived: {{receivedDateTime}}\n\nIssue Description:\n{{content}}\n\nAI Analysis:\n- Category: {{category}}\n- Priority: {{priority}}\n- Sentiment: {{sentiment}}',
          priority: '{{priority}}',
          assignee: 'support-team',
        },
        outputFormat: 'issue',
        template: 'support_template',
        batchProcessing: true,
        retryAttempts: 2,
        retryDelay: 3000,
        rateLimit: 5,
      },
      stats: {
        totalExecutions: 89,
        successCount: 86,
        errorCount: 3,
        lastExecution: new Date('2024-03-14T09:45:00'),
        lastError: 'Rate limit exceeded',
        averageResponseTime: 1200,
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-12'),
    },
    {
      id: '3',
      name: 'Slack Notifications',
      type: 'slack',
      enabled: false,
      status: 'inactive',
      description: '向Slack频道发送重要邮件通知',
      config: {
        apiKey: 'slack_webhook_placeholder',
        channelId: '#email-alerts',
        triggers: {
          emailReceived: true,
          analysisComplete: false,
          priorityThreshold: 'critical',
          sentimentThreshold: 'negative',
          categories: ['urgent'],
          keywords: ['emergency', 'critical'],
        },
        fieldMapping: {
          title: '🚨 Critical Email Alert',
          description: '*From:* {{sender.name}}\n*Subject:* {{subject}}\n*Priority:* {{priority}}\n*Sentiment:* {{sentiment}}',
          priority: '{{priority}}',
        },
        outputFormat: 'message',
        template: 'slack_alert',
        batchProcessing: false,
        retryAttempts: 1,
        retryDelay: 1000,
        rateLimit: 20,
      },
      stats: {
        totalExecutions: 23,
        successCount: 23,
        errorCount: 0,
        lastExecution: new Date('2024-03-10T16:20:00'),
        averageResponseTime: 450,
      },
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    },
  ]);

  // 执行日志
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([
    {
      id: '1',
      integrationId: '1',
      integrationName: 'Trello Project Board',
      status: 'success',
      startTime: new Date('2024-03-14T10:30:00'),
      endTime: new Date('2024-03-14T10:30:01'),
      duration: 850,
      inputData: {
        emailId: 'email_123',
        subject: 'Project deadline approaching',
        sender: { name: 'John Doe', email: 'john@example.com' },
        priority: 'high',
      },
      outputData: {
        cardId: 'card_456',
        url: 'https://trello.com/c/abc123',
      },
      retryCount: 0,
    },
    {
      id: '2',
      integrationId: '2',
      integrationName: 'Jira Issue Tracker',
      status: 'error',
      startTime: new Date('2024-03-14T09:45:00'),
      endTime: new Date('2024-03-14T09:45:03'),
      duration: 3000,
      inputData: {
        emailId: 'email_124',
        subject: 'System not working',
        sender: { name: 'Customer Support', email: 'support@customer.com' },
        priority: 'normal',
      },
      errorMessage: 'Rate limit exceeded. Please try again later.',
      retryCount: 2,
    },
  ]);

  // 对话框状态
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<WorkflowIntegration | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  // 集成类型配置
  const integrationTypes = [
    { key: 'trello', label: 'Trello', icon: '📋', color: '#0079bf' },
    { key: 'jira', label: 'Jira', icon: '🎯', color: '#0052cc' },
    { key: 'asana', label: 'Asana', icon: '📌', color: '#f06a6a' },
    { key: 'notion', label: 'Notion', icon: '📝', color: '#000000' },
    { key: 'slack', label: 'Slack', icon: '💬', color: '#4a154b' },
    { key: 'teams', label: 'Microsoft Teams', icon: '👥', color: '#6264a7' },
    { key: 'webhook', label: 'Webhook', icon: '🔗', color: '#28a745' },
    { key: 'database', label: 'Database', icon: '🗄️', color: '#17a2b8' },
  ];

  // 处理集成启用/禁用
  const handleIntegrationToggle = (integrationId: string) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? {
            ...integration,
            enabled: !integration.enabled,
            status: !integration.enabled ? 'active' : 'inactive'
          }
        : integration
    ));
  };

  // 处理集成删除
  const handleDeleteIntegration = (integrationId: string) => {
    setIntegrations(prev => prev.filter(integration => integration.id !== integrationId));
  };

  // 处理集成测试
  const handleTestIntegration = async (integration: WorkflowIntegration) => {
    setSelectedIntegration(integration);
    setTestDialogOpen(true);

    // 模拟测试执行
    const testLog: ExecutionLog = {
      id: Date.now().toString(),
      integrationId: integration.id,
      integrationName: integration.name,
      status: 'pending',
      startTime: new Date(),
      inputData: {
        test: true,
        emailId: 'test_email',
        subject: 'Test Integration',
        sender: { name: 'Test User', email: 'test@example.com' },
        priority: 'normal',
      },
      retryCount: 0,
    };

    setExecutionLogs(prev => [testLog, ...prev]);

    // 模拟异步执行
    setTimeout(() => {
      const success = Math.random() > 0.3;
      const updatedLog: ExecutionLog = {
        ...testLog,
        status: success ? 'success' : 'error',
        endTime: new Date(),
        duration: Math.floor(Math.random() * 2000) + 500,
        outputData: success ? {
          testResult: 'Connection successful',
          id: 'test_' + Date.now(),
        } : undefined,
        errorMessage: success ? undefined : 'Test failed: Invalid credentials',
      };

      setExecutionLogs(prev => prev.map(log =>
        log.id === testLog.id ? updatedLog : log
      ));

      // 更新集成统计
      setIntegrations(prev => prev.map(int =>
        int.id === integration.id
          ? {
              ...int,
              stats: {
                ...int.stats,
                totalExecutions: int.stats.totalExecutions + 1,
                successCount: success ? int.stats.successCount + 1 : int.stats.successCount,
                errorCount: success ? int.stats.errorCount : int.stats.errorCount + 1,
                lastExecution: new Date(),
                lastError: success ? int.stats.lastError : 'Test failed: Invalid credentials',
              }
            }
          : int
      ));
    }, 2000);
  };

  // 渲染集成列表
  const renderIntegrationList = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">
            {t('workflows.integrations')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setSelectedIntegration(null);
              setEditMode(false);
              setIntegrationDialogOpen(true);
            }}
          >
            {t('workflows.createIntegration')}
          </Button>
        </Box>

        <Grid container spacing={3}>
          {integrations.map((integration) => {
            const integType = integrationTypes.find(t => t.key === integration.type);
            return (
              <Grid item xs={12} md={6} lg={4} key={integration.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" fontSize="1.5rem">
                          {integType?.icon}
                        </Typography>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {integration.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {integType?.label}
                          </Typography>
                        </Box>
                      </Box>
                      <Switch
                        checked={integration.enabled}
                        onChange={() => handleIntegrationToggle(integration.id)}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {integration.description}
                    </Typography>

                    {/* 状态指示器 */}
                    <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                      {integration.status === 'active' && (
                        <Chip
                          icon={<CheckIcon />}
                          label={t('common.active')}
                          color="success"
                          size="small"
                        />
                      )}
                      {integration.status === 'inactive' && (
                        <Chip
                          icon={<PauseIcon />}
                          label={t('common.inactive')}
                          color="default"
                          size="small"
                        />
                      )}
                      {integration.status === 'error' && (
                        <Chip
                          icon={<ErrorIcon />}
                          label={t('common.error')}
                          color="error"
                          size="small"
                        />
                      )}
                    </Box>

                    {/* 统计信息 */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('workflows.stats.executions', {
                          total: integration.stats.totalExecutions,
                          success: integration.stats.successCount,
                          errors: integration.stats.errorCount
                        })}
                      </Typography>
                      {integration.stats.lastExecution && (
                        <Typography variant="caption" color="text.secondary">
                          {t('workflows.stats.lastExecution')}: {' '}
                          {format(integration.stats.lastExecution, 'MM-dd HH:mm', { locale: zhCN })}
                        </Typography>
                      )}
                    </Box>

                    {/* 错误信息 */}
                    {integration.stats.lastError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          {integration.stats.lastError}
                        </Typography>
                      </Alert>
                    )}

                    {/* 操作按钮 */}
                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={() => handleTestIntegration(integration)}
                        disabled={!integration.enabled}
                      >
                        {t('workflows.test')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setEditMode(true);
                          setIntegrationDialogOpen(true);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<HistoryIcon />}
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setLogsDialogOpen(true);
                        }}
                      >
                        {t('workflows.logs')}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );

  // 渲染执行日志
  const renderExecutionLogs = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">
            {t('workflows.executionLogs')}
          </Typography>
          <IconButton onClick={() => {/* 刷新日志 */}}>
            <RefreshIcon />
          </IconButton>
        </Box>

        <List>
          {executionLogs.slice(0, 10).map((log) => (
            <ListItem key={log.id} divider>
              <ListItemIcon>
                {log.status === 'success' && <CheckIcon color="success" />}
                {log.status === 'error' && <ErrorIcon color="error" />}
                {log.status === 'pending' && <ScheduleIcon color="primary" />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2">
                      {log.integrationName}
                    </Typography>
                    <Chip
                      label={t(`workflows.status.${log.status}`)}
                      size="small"
                      color={
                        log.status === 'success' ? 'success' :
                        log.status === 'error' ? 'error' : 'primary'
                      }
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {log.inputData?.subject || t('workflows.testExecution')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(log.startTime, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      {log.duration && ` • ${log.duration}ms`}
                      {log.retryCount > 0 && ` • ${t('workflows.retried', { count: log.retryCount })}`}
                    </Typography>
                    {log.errorMessage && (
                      <Typography variant="caption" color="error.main" display="block">
                        {log.errorMessage}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        <Box textAlign="center" sx={{ mt: 2 }}>
          <Button variant="outlined" size="small">
            {t('workflows.viewAllLogs')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // 渲染统计仪表板
  const renderAnalytics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('workflows.analytics.totalIntegrations')}
          </Typography>
          <Typography variant="h3" color="primary.main">
            {integrations.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {integrations.filter(i => i.enabled).length} {t('workflows.analytics.active')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('workflows.analytics.totalExecutions')}
          </Typography>
          <Typography variant="h3" color="success.main">
            {integrations.reduce((sum, i) => sum + i.stats.totalExecutions, 0)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {integrations.reduce((sum, i) => sum + i.stats.successCount, 0)} {t('workflows.analytics.successful')}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('workflows.analytics.errorRate')}
          </Typography>
          <Typography variant="h3" color="error.main">
            {(() => {
              const total = integrations.reduce((sum, i) => sum + i.stats.totalExecutions, 0);
              const errors = integrations.reduce((sum, i) => sum + i.stats.errorCount, 0);
              return total > 0 ? ((errors / total) * 100).toFixed(1) : '0.0';
            })()}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {integrations.reduce((sum, i) => sum + i.stats.errorCount, 0)} {t('workflows.analytics.errors')}
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('workflows.integrationManager')}
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label={t('workflows.integrations')} />
        <Tab label={t('workflows.executionLogs')} />
        <Tab label={t('workflows.analytics.title')} />
      </Tabs>

      <Box role="tabpanel" hidden={activeTab !== 0}>
        {activeTab === 0 && renderIntegrationList()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && renderExecutionLogs()}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 2}>
        {activeTab === 2 && renderAnalytics()}
      </Box>

      {/* 这里可以添加各种对话框组件，为了简化代码暂时省略 */}
    </Box>
  );
};

export default WorkflowIntegrationManager;