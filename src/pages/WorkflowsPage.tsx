import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
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
  Schedule as ScheduleIcon,
  Autorenew as AutoIcon,
  IntegrationInstructions as IntegrationIcon,
  Webhook as WebhookIcon,
} from '@mui/icons-material';

interface Workflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    type: 'email_received' | 'time_based' | 'manual';
    condition: string;
  };
  actions: WorkflowAction[];
  lastRun?: string;
  status: 'success' | 'error' | 'running' | 'paused';
  executions: number;
  successRate: number;
}

interface WorkflowAction {
  type: 'send_email' | 'create_task' | 'update_crm' | 'webhook' | 'notification';
  config: Record<string, any>;
  enabled: boolean;
}

const WorkflowsPage: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  // 模拟工作流数据
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: '1',
      name: '重要邮件通知',
      description: '收到重要邮件时自动发送Slack通知给团队',
      isActive: true,
      trigger: {
        type: 'email_received',
        condition: '重要性 = 高 且 发件人包含 @client.com',
      },
      actions: [
        {
          type: 'notification',
          config: { channel: 'slack', message: '收到重要客户邮件' },
          enabled: true,
        },
        {
          type: 'create_task',
          config: { assignee: '项目经理', priority: '高' },
          enabled: true,
        },
      ],
      lastRun: '2小时前',
      status: 'success',
      executions: 142,
      successRate: 98.5,
    },
    {
      id: '2',
      name: '每日邮件总结',
      description: '每天下午6点自动生成并发送邮件分析报告',
      isActive: true,
      trigger: {
        type: 'time_based',
        condition: '每天 18:00',
      },
      actions: [
        {
          type: 'send_email',
          config: { to: 'team@company.com', template: 'daily_summary' },
          enabled: true,
        },
      ],
      lastRun: '昨天',
      status: 'success',
      executions: 67,
      successRate: 100,
    },
    {
      id: '3',
      name: 'CRM客户更新',
      description: '新客户邮件自动同步到CRM系统',
      isActive: false,
      trigger: {
        type: 'email_received',
        condition: '新发件人 且 不在联系人列表',
      },
      actions: [
        {
          type: 'update_crm',
          config: { system: 'Salesforce', action: 'create_lead' },
          enabled: true,
        },
        {
          type: 'webhook',
          config: { url: 'https://api.crm.com/webhook', method: 'POST' },
          enabled: false,
        },
      ],
      lastRun: '1周前',
      status: 'paused',
      executions: 28,
      successRate: 92.8,
    },
    {
      id: '4',
      name: '项目任务自动创建',
      description: '包含特定关键词的邮件自动在项目管理工具中创建任务',
      isActive: true,
      trigger: {
        type: 'email_received',
        condition: '主题包含 "任务" 或 "TODO" 或 "Action Item"',
      },
      actions: [
        {
          type: 'create_task',
          config: { tool: 'Jira', project: 'EMAIL-TASKS' },
          enabled: true,
        },
      ],
      lastRun: '30分钟前',
      status: 'running',
      executions: 89,
      successRate: 94.3,
    },
  ]);

  const [newWorkflow, setNewWorkflow] = useState<Partial<Workflow>>({
    name: '',
    description: '',
    isActive: true,
    trigger: { type: 'email_received', condition: '' },
    actions: [],
  });

  const handleToggleWorkflow = (workflowId: string) => {
    setWorkflows(prev =>
      prev.map(workflow =>
        workflow.id === workflowId
          ? { ...workflow, isActive: !workflow.isActive }
          : workflow
      )
    );
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    setWorkflows(prev => prev.filter(workflow => workflow.id !== workflowId));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'running':
        return <AutoIcon color="primary" />;
      case 'paused':
        return <PauseIcon color="warning" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      success: '成功',
      error: '错误',
      running: '运行中',
      paused: '已暂停',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getTriggerTypeLabel = (type: string) => {
    const labels = {
      email_received: '邮件触发',
      time_based: '定时触发',
      manual: '手动触发',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getActionTypeLabel = (type: string) => {
    const labels = {
      send_email: '发送邮件',
      create_task: '创建任务',
      update_crm: '更新CRM',
      webhook: 'Webhook',
      notification: '发送通知',
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          ⚡ 工作流管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          创建工作流
        </Button>
      </Box>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {workflows.length}
              </Typography>
              <Typography color="textSecondary">
                总工作流
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {workflows.filter(w => w.isActive).length}
              </Typography>
              <Typography color="textSecondary">
                活跃工作流
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                326
              </Typography>
              <Typography color="textSecondary">
                本月执行次数
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                96.4%
              </Typography>
              <Typography color="textSecondary">
                平均成功率
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 工作流列表 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 工作流列表
          </Typography>

          <List>
            {workflows.map((workflow, index) => (
              <React.Fragment key={workflow.id}>
                <ListItem>
                  <Box sx={{ width: '100%' }}>
                    {/* 工作流标题行 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(workflow.status)}
                          <Typography variant="h6" fontWeight="bold">
                            {workflow.name}
                          </Typography>
                        </Box>
                        <Chip
                          label={getStatusLabel(workflow.status)}
                          color={
                            workflow.status === 'success' ? 'success' :
                            workflow.status === 'error' ? 'error' :
                            workflow.status === 'running' ? 'primary' : 'default'
                          }
                          size="small"
                        />
                        <Chip
                          label={getTriggerTypeLabel(workflow.trigger.type)}
                          variant="outlined"
                          size="small"
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={workflow.isActive}
                              onChange={() => handleToggleWorkflow(workflow.id)}
                              size="small"
                            />
                          }
                          label=""
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingWorkflow(workflow);
                            setOpen(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* 工作流描述 */}
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {workflow.description}
                    </Typography>

                    {/* 触发条件和执行动作 */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          🎯 触发条件:
                        </Typography>
                        <Paper sx={{ p: 1.5, bgcolor: 'background.default' }}>
                          <Typography variant="body2">
                            {workflow.trigger.condition}
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          ⚡ 执行动作:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {workflow.actions.map((action, idx) => (
                            <Chip
                              key={idx}
                              label={getActionTypeLabel(action.type)}
                              color="primary"
                              variant="outlined"
                              size="small"
                              disabled={!action.enabled}
                            />
                          ))}
                        </Box>
                      </Grid>
                    </Grid>

                    {/* 执行统计 */}
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="textSecondary">
                          最后运行: {workflow.lastRun}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="textSecondary">
                          执行次数: {workflow.executions}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="caption" color="textSecondary">
                          成功率: {workflow.successRate}%
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <LinearProgress
                          variant="determinate"
                          value={workflow.successRate}
                          color={workflow.successRate > 95 ? 'success' : workflow.successRate > 80 ? 'warning' : 'error'}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </ListItem>
                {index < workflows.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* 集成服务 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔗 可用集成服务
          </Typography>
          <Grid container spacing={2}>
            {[
              { name: 'Slack', icon: '💬', status: '已连接', color: 'success' },
              { name: 'Microsoft Teams', icon: '👥', status: '已连接', color: 'success' },
              { name: 'Jira', icon: '📋', status: '已连接', color: 'success' },
              { name: 'Trello', icon: '📌', status: '未连接', color: 'default' },
              { name: 'Salesforce', icon: '💼', status: '未连接', color: 'default' },
              { name: 'Webhook', icon: '🔗', status: '可用', color: 'info' },
            ].map((service, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {service.icon}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {service.name}
                    </Typography>
                    <Chip
                      label={service.status}
                      color={service.color as any}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* 创建/编辑工作流对话框 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingWorkflow ? '编辑工作流' : '创建新工作流'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="工作流名称"
                  value={editingWorkflow?.name || newWorkflow.name}
                  onChange={(e) => {
                    if (editingWorkflow) {
                      setEditingWorkflow({ ...editingWorkflow, name: e.target.value });
                    } else {
                      setNewWorkflow({ ...newWorkflow, name: e.target.value });
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="工作流描述"
                  multiline
                  rows={2}
                  value={editingWorkflow?.description || newWorkflow.description}
                  onChange={(e) => {
                    if (editingWorkflow) {
                      setEditingWorkflow({ ...editingWorkflow, description: e.target.value });
                    } else {
                      setNewWorkflow({ ...newWorkflow, description: e.target.value });
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>触发类型</InputLabel>
                  <Select
                    value={editingWorkflow?.trigger.type || newWorkflow.trigger?.type || 'email_received'}
                    label="触发类型"
                  >
                    <MenuItem value="email_received">邮件触发</MenuItem>
                    <MenuItem value="time_based">定时触发</MenuItem>
                    <MenuItem value="manual">手动触发</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="触发条件"
                  placeholder="描述触发的具体条件"
                  value={editingWorkflow?.trigger.condition || newWorkflow.trigger?.condition || ''}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  执行动作
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  sx={{ mb: 2 }}
                >
                  添加动作
                </Button>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="textSecondary">
                    在这里配置工作流的具体执行动作...
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="contained">
            保存工作流
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowsPage;