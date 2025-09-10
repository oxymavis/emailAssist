import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Tooltip,
  Stack,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Hub as HubIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  ContentCopy as CopyIcon,
  Send as SendIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonTable, SkeletonCard } from '@/components/common/Loading';
import { useWorkflows, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { Workflow, WorkflowOutput } from '@/types';
import { useTranslation } from 'react-i18next';

// 工作流配置对话框
interface WorkflowConfigDialogProps {
  open: boolean;
  onClose: () => void;
  workflow: Workflow | null;
  onSave: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const WorkflowConfigDialog: React.FC<WorkflowConfigDialogProps> = ({
  open,
  onClose,
  workflow,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'trello' as 'trello' | 'jira' | 'custom',
    configuration: {
      apiKey: '',
      boardId: '',
      projectKey: '',
      serverUrl: '',
      username: '',
      mappings: {
        urgency: {
          critical: '',
          high: '',
          medium: '',
          low: '',
        },
        category: {},
      },
      template: '',
    },
    isActive: true,
  });

  useEffect(() => {
    if (workflow) {
      setFormData({
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        configuration: {
          apiKey: workflow.configuration.apiKey || '',
          boardId: workflow.configuration.boardId || '',
          projectKey: workflow.configuration.projectKey || '',
          serverUrl: '',
          username: '',
          mappings: {
            urgency: {
              critical: workflow.configuration.mappings.urgency.critical || '',
              high: workflow.configuration.mappings.urgency.high || '',
              medium: workflow.configuration.mappings.urgency.medium || '',
              low: workflow.configuration.mappings.urgency.low || '',
            },
            category: workflow.configuration.mappings.category || {},
          },
          template: workflow.configuration.template,
        },
        isActive: workflow.isActive,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'trello',
        configuration: {
          apiKey: '',
          boardId: '',
          projectKey: '',
          serverUrl: '',
          username: '',
          mappings: {
            urgency: {
              critical: '',
              high: '',
              medium: '',
              low: '',
            },
            category: {},
          },
          template: '',
        },
        isActive: true,
      });
    }
  }, [workflow, open]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const getConfigFields = () => {
    switch (formData.type) {
      case 'trello':
        return (
          <>
            <TextField
              fullWidth
              label="Trello API Key"
              value={formData.configuration.apiKey}
              onChange={(e) => setFormData({
                ...formData,
                configuration: { ...formData.configuration, apiKey: e.target.value }
              })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Board ID"
              value={formData.configuration.boardId}
              onChange={(e) => setFormData({
                ...formData,
                configuration: { ...formData.configuration, boardId: e.target.value }
              })}
              margin="normal"
            />
          </>
        );
      case 'jira':
        return (
          <>
            <TextField
              fullWidth
              label="Jira Server URL"
              value={formData.configuration.serverUrl}
              onChange={(e) => setFormData({
                ...formData,
                configuration: { ...formData.configuration, serverUrl: e.target.value }
              })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Project Key"
              value={formData.configuration.projectKey}
              onChange={(e) => setFormData({
                ...formData,
                configuration: { ...formData.configuration, projectKey: e.target.value }
              })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Username"
              value={formData.configuration.username}
              onChange={(e) => setFormData({
                ...formData,
                configuration: { ...formData.configuration, username: e.target.value }
              })}
              margin="normal"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {workflow ? t('workflows.editWorkflow') : t('workflows.createWorkflow')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label={t('workflows.workflowName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('workflows.workflowType')}</InputLabel>
                <Select
                  value={formData.type}
                  label={t('workflows.workflowType')}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <MenuItem value="trello">Trello</MenuItem>
                  <MenuItem value="jira">Jira</MenuItem>
                  <MenuItem value="custom">{t('workflows.custom')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('workflows.workflowDescription')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            {t('workflows.connectionConfig')}
          </Typography>
          {getConfigFields()}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            {t('workflows.contentTemplate')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            label={t('workflows.contentTemplate')}
            value={formData.configuration.template}
            onChange={(e) => setFormData({
              ...formData,
              configuration: { ...formData.configuration, template: e.target.value }
            })}
            placeholder={t('workflows.templatePlaceholder')}
            helperText={t('workflows.templateHelperText')}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button variant="outlined" startIcon={<LinkIcon />}>
          {t('workflows.testConnection')}
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {t('actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 工作流输出项组件
interface OutputItemProps {
  output: WorkflowOutput;
  onView: (output: WorkflowOutput) => void;
  onResend: (output: WorkflowOutput) => void;
  onCopy: (output: WorkflowOutput) => void;
}

const OutputItem: React.FC<OutputItemProps> = ({ output, onView, onResend, onCopy }) => {
  const { t } = useTranslation();
  const getStatusIcon = (status: WorkflowOutput['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <ScheduleIcon color="warning" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (status: WorkflowOutput['status']) => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              {getStatusIcon(output.status)}
              <Chip
                label={
                  output.status === 'sent' ? t('workflows.sent') :
                  output.status === 'failed' ? t('workflows.failed') : t('workflows.pending')
                }
                size="small"
                color={getStatusColor(output.status) as any}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                {format(new Date(output.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxHeight: 60, overflow: 'hidden' }}>
              {output.content.length > 150 ? `${output.content.substring(0, 150)}...` : output.content}
            </Typography>
            {output.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {output.error}
              </Alert>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
            <Tooltip title={t('workflows.viewDetails')}>
              <IconButton size="small" onClick={() => onView(output)}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('workflows.copyContent')}>
              <IconButton size="small" onClick={() => onCopy(output)}>
                <CopyIcon />
              </IconButton>
            </Tooltip>
            {output.status === 'failed' && (
              <Tooltip title={t('workflows.resend')}>
                <IconButton size="small" onClick={() => onResend(output)} color="primary">
                  <SendIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

const Workflows: React.FC = () => {
  const { t } = useTranslation();
  const { workflows, setWorkflows, addWorkflow, updateWorkflow, deleteWorkflow } = useWorkflows();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  // 模拟工作流输出数据
  const [outputs] = useState<WorkflowOutput[]>([
    {
      id: 'output-1',
      workflowId: 'workflow-1',
      emailId: 'email-1',
      content: t('workflows.mockOutputs.serverMaintenance'),
      status: 'sent',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      sentAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'output-2',
      workflowId: 'workflow-1',
      emailId: 'email-2',
      content: t('workflows.mockOutputs.meetingInvitation'),
      status: 'failed',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      error: t('workflows.mockOutputs.apiTimeoutError'),
    },
    {
      id: 'output-3',
      workflowId: 'workflow-2',
      emailId: 'email-3',
      content: t('workflows.mockOutputs.customerFeedback'),
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  ]);

  // 初始化数据
  useEffect(() => {
    const initializeWorkflows = async () => {
      try {
        setLoading(true);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockWorkflows = mockDataService.getWorkflows();
        setWorkflows(mockWorkflows);
        
        addNotification({
          type: 'success',
          title: t('workflows.dataLoaded'),
          message: t('workflows.dataLoadedMessage', { count: mockWorkflows.length }),
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: t('workflows.loadError'),
          message: t('workflows.loadErrorMessage'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeWorkflows();
  }, [setWorkflows, addNotification]);

  // 创建新工作流
  const handleCreateWorkflow = () => {
    setEditingWorkflow(null);
    setConfigDialogOpen(true);
  };

  // 编辑工作流
  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setConfigDialogOpen(true);
  };

  // 保存工作流
  const handleSaveWorkflow = (workflowData: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    
    if (editingWorkflow) {
      updateWorkflow(editingWorkflow.id, {
        ...workflowData,
        updatedAt: now,
      });
      addNotification({
        type: 'success',
        title: t('workflows.updateSuccess'),
        message: t('workflows.updateSuccessMessage', { name: workflowData.name }),
      });
    } else {
      const newWorkflow: Workflow = {
        ...workflowData,
        id: `workflow-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      addWorkflow(newWorkflow);
      addNotification({
        type: 'success',
        title: t('workflows.createSuccess'),
        message: t('workflows.createSuccessMessage', { name: workflowData.name }),
      });
    }
  };

  // 切换工作流状态
  const handleToggleWorkflow = (workflow: Workflow) => {
    updateWorkflow(workflow.id, { isActive: !workflow.isActive });
    addNotification({
      type: 'info',
      title: workflow.isActive ? t('workflows.disabled') : t('workflows.enabled'),
      message: t('workflows.statusMessage', { name: workflow.name, status: workflow.isActive ? t('workflows.disabled') : t('workflows.enabled') }),
    });
  };

  // 删除工作流
  const handleDeleteWorkflow = (workflow: Workflow) => {
    deleteWorkflow(workflow.id);
    addNotification({
      type: 'success',
      title: t('workflows.deleteSuccess'),
      message: t('workflows.deleteSuccessMessage', { name: workflow.name }),
    });
  };

  // 处理输出操作
  const handleViewOutput = (_output: WorkflowOutput) => {
    addNotification({
      type: 'info',
      title: t('workflows.viewOutputDetails'),
      message: t('workflows.outputDetailsShown'),
    });
  };

  const handleCopyOutput = (output: WorkflowOutput) => {
    navigator.clipboard.writeText(output.content);
    addNotification({
      type: 'success',
      title: t('workflows.contentCopied'),
      message: t('workflows.contentCopiedMessage'),
    });
  };

  const handleResendOutput = (_output: WorkflowOutput) => {
    addNotification({
      type: 'info',
      title: t('workflows.resending'),
      message: t('workflows.resendingMessage'),
    });
  };

  const activeWorkflows = workflows.filter(w => w.isActive);
  const sentOutputs = outputs.filter(o => o.status === 'sent');
  const failedOutputs = outputs.filter(o => o.status === 'failed');
  const pendingOutputs = outputs.filter(o => o.status === 'pending');

  const tabContent = [
    { label: t('workflows.workflowConfig'), value: 0 },
    { label: t('workflows.outputRecords'), value: 1 },
    { label: t('workflows.statistics'), value: 2 },
  ];

  return (
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
{t('nav.workflows')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
{t('workflows.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateWorkflow}
        >
{t('workflows.createWorkflow')}
        </Button>
      </Box>

      <LoadingState
        loading={loading}
        skeleton={
          <Grid container spacing={3}>
            {Array.from({ length: 3 }, (_, i) => (
              <Grid item xs={12} md={4} key={i}>
                <SkeletonCard />
              </Grid>
            ))}
            <Grid item xs={12}>
              <SkeletonTable rows={5} />
            </Grid>
          </Grid>
        }
      >
        {/* 统计卡片 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <HubIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {workflows.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('workflows.totalWorkflows')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {activeWorkflows.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('workflows.activeWorkflows')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <SendIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  {sentOutputs.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('workflows.successfulSent')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ErrorIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {failedOutputs.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
{t('workflows.sendFailed')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 标签页 */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={(_, value) => setCurrentTab(value)}>
              {tabContent.map((tab) => (
                <Tab key={tab.value} label={tab.label} />
              ))}
            </Tabs>
          </Box>

          <CardContent>
            {/* 工作流配置标签页 */}
            {currentTab === 0 && (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('common.status')}</TableCell>
                      <TableCell>{t('workflows.workflowName')}</TableCell>
                      <TableCell>{t('workflows.type')}</TableCell>
                      <TableCell>{t('workflows.description')}</TableCell>
                      <TableCell>{t('common.createdAt')}</TableCell>
                      <TableCell align="center">{t('workflows.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workflows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
{t('workflows.noWorkflows')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                        workflows.map((workflow) => (
                          <TableRow key={workflow.id} hover>
                            <TableCell>
                              <Switch
                                checked={workflow.isActive}
                                onChange={() => handleToggleWorkflow(workflow)}
                                color="primary"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {workflow.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={workflow.type.toUpperCase()}
                                size="small"
                                color={
                                  workflow.type === 'trello' ? 'primary' :
                                  workflow.type === 'jira' ? 'secondary' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {workflow.description}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {format(new Date(workflow.createdAt), 'yyyy-MM-dd', { locale: zhCN })}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={1} justifyContent="center">
                                <Tooltip title={t('workflows.editWorkflow')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditWorkflow(workflow)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('workflows.configSettings')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditWorkflow(workflow)}
                                    color="primary"
                                  >
                                    <SettingsIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('workflows.deleteWorkflow')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteWorkflow(workflow)}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 输出记录标签页 */}
            {currentTab === 1 && (
              <Box>
                {outputs.length === 0 ? (
                  <Box textAlign="center" py={6}>
                    <HubIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
{t('workflows.noOutputRecords')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
{t('workflows.noOutputRecordsDesc')}
                    </Typography>
                  </Box>
                ) : (
                  outputs.map((output) => (
                    <OutputItem
                      key={output.id}
                      output={output}
                      onView={handleViewOutput}
                      onResend={handleResendOutput}
                      onCopy={handleCopyOutput}
                    />
                  ))
                )}
              </Box>
            )}

            {/* 统计分析标签页 */}
            {currentTab === 2 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
{t('workflows.sendStatusDistribution')}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2">{t('workflows.successfulSent')}</Typography>
                          <Typography variant="body2">{sentOutputs.length}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(sentOutputs.length / outputs.length) * 100}
                          color="success"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2">{t('workflows.sendFailed')}</Typography>
                          <Typography variant="body2">{failedOutputs.length}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(failedOutputs.length / outputs.length) * 100}
                          color="error"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2">{t('workflows.waitingSend')}</Typography>
                          <Typography variant="body2">{pendingOutputs.length}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(pendingOutputs.length / outputs.length) * 100}
                          color="warning"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
{t('workflows.workflowUsage')}
                      </Typography>
                      {workflows.map((workflow) => {
                        const workflowOutputs = outputs.filter(o => o.workflowId === workflow.id);
                        return (
                          <Box key={workflow.id} sx={{ mb: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                              <Typography variant="body2">{workflow.name}</Typography>
                              <Typography variant="body2">{t('workflows.times', { count: workflowOutputs.length })}</Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(workflowOutputs.length / outputs.length) * 100}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                        );
                      })}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>

        {/* 工作流配置对话框 */}
        <WorkflowConfigDialog
          open={configDialogOpen}
          onClose={() => setConfigDialogOpen(false)}
          workflow={editingWorkflow}
          onSave={handleSaveWorkflow}
        />
      </LoadingState>
    </Box>
  );
};

export default Workflows;