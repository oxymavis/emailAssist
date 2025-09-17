/**
 * Report Scheduler Component
 * 报告调度管理组件 - 自动生成报告和分发
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Avatar,
  Switch,
  FormControlLabel,
  Alert,
  Stack,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  Schedule,
  PlayArrow,
  Pause,
  Stop,
  Edit,
  Delete,
  Visibility,
  Email,
  Person,
  Group,
  AccessTime,
  Event,
  Notifications,
  Send,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  History,
  Settings,
  Refresh,
} from '@mui/icons-material';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  templateId: string;
  templateName: string;
  isActive: boolean;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  scheduleTime: string; // HH:mm format
  scheduleDate?: Date; // for 'once' type
  dayOfWeek?: number; // for 'weekly' (0-6, 0=Sunday)
  dayOfMonth?: number; // for 'monthly' (1-31)
  timezone: string;
  recipients: ScheduleRecipient[];
  deliveryOptions: {
    formats: string[]; // ['pdf', 'excel', 'html']
    emailSubject: string;
    emailBody: string;
    attachments: boolean;
    compressed: boolean;
  };
  filters: {
    dateRange: string;
    categories: string[];
    conditions: ScheduleCondition[];
  };
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'error' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  executionHistory: ScheduleExecution[];
}

interface ScheduleRecipient {
  id: string;
  type: 'user' | 'group' | 'external';
  name: string;
  email: string;
  isActive: boolean;
}

interface ScheduleCondition {
  field: string;
  operator: string;
  value: any;
}

interface ScheduleExecution {
  id: string;
  scheduleId: string;
  executedAt: Date;
  status: 'success' | 'failed' | 'partial';
  generatedReports: number;
  sentEmails: number;
  errors: string[];
  duration: number; // in seconds
}

interface ReportSchedulerProps {
  schedules: ReportSchedule[];
  templates: { id: string; name: string; }[];
  onScheduleCreate: (schedule: Partial<ReportSchedule>) => void;
  onScheduleUpdate: (id: string, schedule: Partial<ReportSchedule>) => void;
  onScheduleDelete: (id: string) => void;
  onScheduleExecute: (id: string) => Promise<void>;
}

const ReportScheduler: React.FC<ReportSchedulerProps> = ({
  schedules,
  templates,
  onScheduleCreate,
  onScheduleUpdate,
  onScheduleDelete,
  onScheduleExecute,
}) => {
  const { t } = useTranslation();

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    schedule: ReportSchedule | null;
    isNew: boolean;
  }>({
    open: false,
    schedule: null,
    isNew: false,
  });

  const [historyDialog, setHistoryDialog] = useState<{
    open: boolean;
    schedule: ReportSchedule | null;
  }>({
    open: false,
    schedule: null,
  });

  const [executing, setExecuting] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ReportSchedule>>({
    name: '',
    description: '',
    templateId: '',
    frequency: 'weekly',
    scheduleTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recipients: [],
    deliveryOptions: {
      formats: ['pdf'],
      emailSubject: '{reportName} - {date}',
      emailBody: '请查收附件中的报告。\n\n此邮件由系统自动发送。',
      attachments: true,
      compressed: false,
    },
    filters: {
      dateRange: 'last7days',
      categories: [],
      conditions: [],
    },
    status: 'active',
  });

  // 频率选项
  const frequencyOptions = [
    { value: 'once', label: t('reports.scheduler.frequencies.once') },
    { value: 'daily', label: t('reports.scheduler.frequencies.daily') },
    { value: 'weekly', label: t('reports.scheduler.frequencies.weekly') },
    { value: 'monthly', label: t('reports.scheduler.frequencies.monthly') },
    { value: 'quarterly', label: t('reports.scheduler.frequencies.quarterly') },
    { value: 'yearly', label: t('reports.scheduler.frequencies.yearly') },
  ];

  // 计算下次运行时间
  const calculateNextRun = (schedule: Partial<ReportSchedule>): Date => {
    const now = new Date();
    const [hours, minutes] = (schedule.scheduleTime || '09:00').split(':').map(Number);

    switch (schedule.frequency) {
      case 'once':
        return schedule.scheduleDate || now;
      case 'daily':
        const tomorrow = addDays(now, 1);
        tomorrow.setHours(hours, minutes, 0, 0);
        return tomorrow;
      case 'weekly':
        const nextWeek = addWeeks(now, 1);
        nextWeek.setHours(hours, minutes, 0, 0);
        if (schedule.dayOfWeek !== undefined) {
          const diff = schedule.dayOfWeek - nextWeek.getDay();
          nextWeek.setDate(nextWeek.getDate() + diff);
        }
        return nextWeek;
      case 'monthly':
        const nextMonth = addMonths(now, 1);
        nextMonth.setHours(hours, minutes, 0, 0);
        if (schedule.dayOfMonth) {
          nextMonth.setDate(Math.min(schedule.dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
        }
        return nextMonth;
      default:
        return addDays(now, 1);
    }
  };

  const handleCreateSchedule = () => {
    setFormData({
      name: '',
      description: '',
      templateId: templates[0]?.id || '',
      frequency: 'weekly',
      scheduleTime: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      recipients: [],
      deliveryOptions: {
        formats: ['pdf'],
        emailSubject: '{reportName} - {date}',
        emailBody: '请查收附件中的报告。\n\n此邮件由系统自动发送。',
        attachments: true,
        compressed: false,
      },
      filters: {
        dateRange: 'last7days',
        categories: [],
        conditions: [],
      },
      status: 'active',
    });
    setEditDialog({ open: true, schedule: null, isNew: true });
  };

  const handleEditSchedule = (schedule: ReportSchedule) => {
    setFormData(schedule);
    setEditDialog({ open: true, schedule, isNew: false });
  };

  const handleSaveSchedule = () => {
    if (!formData.name?.trim()) {
      toast.error(t('reports.scheduler.pleaseEnterName'));
      return;
    }

    if (!formData.templateId) {
      toast.error(t('reports.scheduler.pleaseSelectTemplate'));
      return;
    }

    const scheduleData: Partial<ReportSchedule> = {
      ...formData,
      templateName: templates.find(t => t.id === formData.templateId)?.name || '',
      nextRun: calculateNextRun(formData),
      createdBy: 'Current User',
      updatedAt: new Date(),
      ...(editDialog.isNew && {
        createdAt: new Date(),
        executionHistory: [],
      }),
    };

    if (editDialog.isNew) {
      onScheduleCreate(scheduleData);
      toast.success(t('reports.scheduler.scheduleCreated'));
    } else {
      onScheduleUpdate(editDialog.schedule!.id, scheduleData);
      toast.success(t('reports.scheduler.scheduleUpdated'));
    }

    setEditDialog({ open: false, schedule: null, isNew: false });
  };

  const handleToggleActive = (schedule: ReportSchedule) => {
    onScheduleUpdate(schedule.id, {
      isActive: !schedule.isActive,
      status: !schedule.isActive ? 'active' : 'paused',
    });
    toast.success(
      schedule.isActive
        ? t('reports.scheduler.schedulePaused')
        : t('reports.scheduler.scheduleActivated')
    );
  };

  const handleExecuteNow = async (schedule: ReportSchedule) => {
    setExecuting(schedule.id);
    try {
      await onScheduleExecute(schedule.id);
      toast.success(t('reports.scheduler.executeSuccess'));
    } catch (error) {
      toast.error(t('reports.scheduler.executeError'));
    } finally {
      setExecuting(null);
    }
  };

  const handleDeleteSchedule = (schedule: ReportSchedule) => {
    if (window.confirm(t('reports.scheduler.confirmDelete'))) {
      onScheduleDelete(schedule.id);
      toast.success(t('reports.scheduler.scheduleDeleted'));
    }
  };

  const addRecipient = (type: 'user' | 'group' | 'external') => {
    const newRecipient: ScheduleRecipient = {
      id: `recipient-${Date.now()}`,
      type,
      name: '',
      email: '',
      isActive: true,
    };
    setFormData(prev => ({
      ...prev,
      recipients: [...(prev.recipients || []), newRecipient],
    }));
  };

  const updateRecipient = (id: string, updates: Partial<ScheduleRecipient>) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients?.map(r =>
        r.id === id ? { ...r, ...updates } : r
      ) || [],
    }));
  };

  const removeRecipient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients?.filter(r => r.id !== id) || [],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'error': return 'error';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle />;
      case 'paused': return <Pause />;
      case 'error': return <Error />;
      case 'completed': return <CheckCircle />;
      default: return <Schedule />;
    }
  };

  const renderScheduleList = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {t('reports.scheduler.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateSchedule}
          >
            {t('reports.scheduler.createNew')}
          </Button>
        </Box>

        <List>
          {schedules.map((schedule, index) => (
            <React.Fragment key={schedule.id}>
              <ListItem>
                <ListItemIcon>
                  <Avatar
                    sx={{
                      bgcolor: schedule.isActive ? 'success.main' : 'grey.500',
                    }}
                  >
                    {getStatusIcon(schedule.status)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">
                        {schedule.name}
                      </Typography>
                      <Chip
                        label={schedule.status}
                        size="small"
                        color={getStatusColor(schedule.status) as any}
                      />
                      <Chip
                        label={schedule.frequency}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.scheduler.template')}: {schedule.templateName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.scheduler.recipients')}: {schedule.recipients.length}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} mt={1}>
                        {schedule.nextRun && (
                          <Typography variant="caption" color="text.secondary">
                            {t('reports.scheduler.nextRun')}: {format(schedule.nextRun, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                          </Typography>
                        )}
                        {schedule.lastRun && (
                          <Typography variant="caption" color="text.secondary">
                            | {t('reports.scheduler.lastRun')}: {format(schedule.lastRun, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title={schedule.isActive ? t('common.pause') : t('common.activate')}>
                      <IconButton
                        size="small"
                        color={schedule.isActive ? 'warning' : 'success'}
                        onClick={() => handleToggleActive(schedule)}
                      >
                        {schedule.isActive ? <Pause /> : <PlayArrow />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('reports.scheduler.executeNow')}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleExecuteNow(schedule)}
                        disabled={executing === schedule.id}
                      >
                        {executing === schedule.id ? <LinearProgress /> : <PlayArrow />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('reports.scheduler.viewHistory')}>
                      <IconButton
                        size="small"
                        onClick={() => setHistoryDialog({ open: true, schedule })}
                      >
                        <History />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit')}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSchedule(schedule)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
              {index < schedules.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {schedules.length === 0 && (
          <Alert severity="info">
            {t('reports.scheduler.noSchedules')}
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const renderEditDialog = () => (
    <Dialog
      open={editDialog.open}
      onClose={() => setEditDialog({ open: false, schedule: null, isNew: false })}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        {editDialog.isNew ? t('reports.scheduler.createSchedule') : t('reports.scheduler.editSchedule')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {/* 基本信息 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('reports.scheduler.scheduleName')}
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('reports.scheduler.template')}</InputLabel>
                <Select
                  value={formData.templateId || ''}
                  label={t('reports.scheduler.template')}
                  onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('reports.scheduler.description')}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>

            {/* 调度设置 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('reports.scheduler.scheduleSettings')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('reports.scheduler.frequency')}</InputLabel>
                <Select
                  value={formData.frequency || 'weekly'}
                  label={t('reports.scheduler.frequency')}
                  onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as any }))}
                >
                  {frequencyOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="time"
                label={t('reports.scheduler.time')}
                value={formData.scheduleTime || '09:00'}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('reports.scheduler.timezone')}
                value={formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
              />
            </Grid>

            {/* 特殊频率设置 */}
            {formData.frequency === 'once' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label={t('reports.scheduler.scheduleDate')}
                  value={formData.scheduleDate ? format(formData.scheduleDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduleDate: new Date(e.target.value) }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}
            {formData.frequency === 'weekly' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('reports.scheduler.dayOfWeek')}</InputLabel>
                  <Select
                    value={formData.dayOfWeek || 1}
                    label={t('reports.scheduler.dayOfWeek')}
                    onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: e.target.value as number }))}
                  >
                    <MenuItem value={0}>{t('reports.scheduler.days.sunday')}</MenuItem>
                    <MenuItem value={1}>{t('reports.scheduler.days.monday')}</MenuItem>
                    <MenuItem value={2}>{t('reports.scheduler.days.tuesday')}</MenuItem>
                    <MenuItem value={3}>{t('reports.scheduler.days.wednesday')}</MenuItem>
                    <MenuItem value={4}>{t('reports.scheduler.days.thursday')}</MenuItem>
                    <MenuItem value={5}>{t('reports.scheduler.days.friday')}</MenuItem>
                    <MenuItem value={6}>{t('reports.scheduler.days.saturday')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            {formData.frequency === 'monthly' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('reports.scheduler.dayOfMonth')}
                  value={formData.dayOfMonth || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                  inputProps={{ min: 1, max: 31 }}
                />
              </Grid>
            )}

            {/* 收件人设置 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('reports.scheduler.recipients')}
              </Typography>
              <Stack direction="row" spacing={1} mb={2}>
                <Button
                  size="small"
                  startIcon={<Person />}
                  onClick={() => addRecipient('user')}
                >
                  {t('reports.scheduler.addUser')}
                </Button>
                <Button
                  size="small"
                  startIcon={<Group />}
                  onClick={() => addRecipient('group')}
                >
                  {t('reports.scheduler.addGroup')}
                </Button>
                <Button
                  size="small"
                  startIcon={<Email />}
                  onClick={() => addRecipient('external')}
                >
                  {t('reports.scheduler.addExternal')}
                </Button>
              </Stack>

              {formData.recipients?.map((recipient) => (
                <Card key={recipient.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label={t('common.name')}
                          value={recipient.name}
                          onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label={t('common.email')}
                          type="email"
                          value={recipient.email}
                          onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={recipient.isActive}
                              onChange={(e) => updateRecipient(recipient.id, { isActive: e.target.checked })}
                            />
                          }
                          label={t('common.active')}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <IconButton
                          color="error"
                          onClick={() => removeRecipient(recipient.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {(!formData.recipients || formData.recipients.length === 0) && (
                <Alert severity="info">
                  {t('reports.scheduler.noRecipients')}
                </Alert>
              )}
            </Grid>

            {/* 交付选项 */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>{t('reports.scheduler.deliveryOptions')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label={t('reports.scheduler.emailSubject')}
                        value={formData.deliveryOptions?.emailSubject || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          deliveryOptions: {
                            ...prev.deliveryOptions!,
                            emailSubject: e.target.value,
                          },
                        }))}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label={t('reports.scheduler.emailBody')}
                        value={formData.deliveryOptions?.emailBody || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          deliveryOptions: {
                            ...prev.deliveryOptions!,
                            emailBody: e.target.value,
                          },
                        }))}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditDialog({ open: false, schedule: null, isNew: false })}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSaveSchedule}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderHistoryDialog = () => (
    <Dialog
      open={historyDialog.open}
      onClose={() => setHistoryDialog({ open: false, schedule: null })}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {t('reports.scheduler.executionHistory')}: {historyDialog.schedule?.name}
      </DialogTitle>
      <DialogContent>
        {historyDialog.schedule?.executionHistory && historyDialog.schedule.executionHistory.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('reports.scheduler.executionTime')}</TableCell>
                  <TableCell>{t('common.status')}</TableCell>
                  <TableCell>{t('reports.scheduler.reports')}</TableCell>
                  <TableCell>{t('reports.scheduler.emails')}</TableCell>
                  <TableCell>{t('reports.scheduler.duration')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyDialog.schedule.executionHistory
                  .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
                  .slice(0, 10)
                  .map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        {format(execution.executedAt, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={execution.status}
                          size="small"
                          color={
                            execution.status === 'success' ? 'success' :
                            execution.status === 'failed' ? 'error' : 'warning'
                          }
                        />
                      </TableCell>
                      <TableCell>{execution.generatedReports}</TableCell>
                      <TableCell>{execution.sentEmails}</TableCell>
                      <TableCell>{execution.duration}s</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            {t('reports.scheduler.noExecutionHistory')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setHistoryDialog({ open: false, schedule: null })}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {renderScheduleList()}
      {renderEditDialog()}
      {renderHistoryDialog()}
    </>
  );
};

export default ReportScheduler;