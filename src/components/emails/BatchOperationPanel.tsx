/**
 * Enhanced Email Batch Operation Panel Component
 * 增强的邮件批量操作面板组件
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Delete,
  Archive,
  Star,
  StarBorder,
  Label,
  Schedule,
  Forward,
  Reply,
  Flag,
  MarkEmailRead,
  MarkEmailUnread,
  Category,
  Psychology,
  Download,
  Share,
  FilterList,
  ExpandMore,
  Close,
  Check,
  Warning,
  Info,
  AutoAwesome,
  Refresh,
  PlayArrow,
  Pause,
  Settings,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface BatchOperationPanelProps {
  selectedCount: number;
  totalCount: number;
  onClose: () => void;
  onExecuteAction: (action: BatchAction) => Promise<void>;
  availableLabels: string[];
  availableCategories: string[];
}

interface BatchAction {
  type: 'mark-read' | 'mark-unread' | 'star' | 'unstar' | 'archive' | 'delete' | 'label' | 'category' | 'forward' | 'analyze' | 'export' | 'schedule';
  params?: {
    labelName?: string;
    categoryName?: string;
    scheduleTime?: Date;
    forwardTo?: string[];
    exportFormat?: 'pdf' | 'csv' | 'excel';
  };
}

const BatchOperationPanel: React.FC<BatchOperationPanelProps> = ({
  selectedCount,
  totalCount,
  onClose,
  onExecuteAction,
  availableLabels,
  availableCategories,
}) => {
  const { t } = useTranslation();

  // 对话框状态
  const [advancedDialog, setAdvancedDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: BatchAction | null;
    title: string;
    content: string;
  }>({
    open: false,
    action: null,
    title: '',
    content: '',
  });

  // 操作参数
  const [labelAction, setLabelAction] = useState({
    operation: 'add', // 'add', 'remove', 'replace'
    labelName: '',
  });
  const [categoryAction, setCategoryAction] = useState('');
  const [forwardEmails, setForwardEmails] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [autoAnalyze, setAutoAnalyze] = useState(true);

  // 执行状态
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);

  // 快速操作按钮
  const quickActions = [
    {
      type: 'mark-read',
      icon: <MarkEmailRead />,
      label: t('emails.batch.markRead'),
      color: 'primary' as const,
    },
    {
      type: 'mark-unread',
      icon: <MarkEmailUnread />,
      label: t('emails.batch.markUnread'),
      color: 'secondary' as const,
    },
    {
      type: 'star',
      icon: <Star />,
      label: t('emails.batch.star'),
      color: 'warning' as const,
    },
    {
      type: 'archive',
      icon: <Archive />,
      label: t('emails.batch.archive'),
      color: 'info' as const,
    },
    {
      type: 'delete',
      icon: <Delete />,
      label: t('emails.batch.delete'),
      color: 'error' as const,
    },
  ];

  // 高级操作列表
  const advancedActions = [
    {
      type: 'label',
      icon: <Label />,
      title: t('emails.batch.labelManagement'),
      description: t('emails.batch.labelDescription'),
    },
    {
      type: 'category',
      icon: <Category />,
      title: t('emails.batch.categoryAssignment'),
      description: t('emails.batch.categoryDescription'),
    },
    {
      type: 'analyze',
      icon: <Psychology />,
      title: t('emails.batch.aiAnalysis'),
      description: t('emails.batch.analysisDescription'),
    },
    {
      type: 'forward',
      icon: <Forward />,
      title: t('emails.batch.forwardEmails'),
      description: t('emails.batch.forwardDescription'),
    },
    {
      type: 'schedule',
      icon: <Schedule />,
      title: t('emails.batch.scheduleAction'),
      description: t('emails.batch.scheduleDescription'),
    },
    {
      type: 'export',
      icon: <Download />,
      title: t('emails.batch.exportEmails'),
      description: t('emails.batch.exportDescription'),
    },
  ];

  const handleQuickAction = (actionType: string) => {
    const action: BatchAction = { type: actionType as any };

    if (actionType === 'delete') {
      setConfirmDialog({
        open: true,
        action,
        title: t('emails.batch.confirmDelete'),
        content: t('emails.batch.confirmDeleteContent', { count: selectedCount }),
      });
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: BatchAction) => {
    setExecuting(true);
    setExecutionProgress(0);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      await onExecuteAction(action);

      clearInterval(progressInterval);
      setExecutionProgress(100);

      setTimeout(() => {
        setExecuting(false);
        setExecutionProgress(0);
        onClose();
      }, 500);

    } catch (error) {
      setExecuting(false);
      setExecutionProgress(0);
      console.error('Batch operation failed:', error);
    }
  };

  const handleAdvancedAction = (actionType: string) => {
    let action: BatchAction;

    switch (actionType) {
      case 'label':
        if (!labelAction.labelName) {
          alert(t('emails.batch.pleaseSelectLabel'));
          return;
        }
        action = {
          type: 'label',
          params: { labelName: labelAction.labelName },
        };
        break;

      case 'category':
        if (!categoryAction) {
          alert(t('emails.batch.pleaseSelectCategory'));
          return;
        }
        action = {
          type: 'category',
          params: { categoryName: categoryAction },
        };
        break;

      case 'forward':
        if (!forwardEmails.trim()) {
          alert(t('emails.batch.pleaseEnterEmails'));
          return;
        }
        const emails = forwardEmails.split(',').map(email => email.trim()).filter(Boolean);
        action = {
          type: 'forward',
          params: { forwardTo: emails },
        };
        break;

      case 'schedule':
        if (!scheduleTime) {
          alert(t('emails.batch.pleaseSelectTime'));
          return;
        }
        action = {
          type: 'schedule',
          params: { scheduleTime: new Date(scheduleTime) },
        };
        break;

      case 'export':
        action = {
          type: 'export',
          params: { exportFormat },
        };
        break;

      case 'analyze':
        action = { type: 'analyze' };
        break;

      default:
        return;
    }

    setAdvancedDialog(false);
    executeAction(action);
  };

  return (
    <>
      <Card
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          minWidth: 600,
          maxWidth: 800,
          boxShadow: 6,
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6" color="primary">
                {t('emails.batch.selectedEmails', { count: selectedCount })}
              </Typography>
              <Chip
                label={`${selectedCount} / ${totalCount}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>

          {executing && (
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('emails.batch.processing')}
              </Typography>
              <LinearProgress variant="determinate" value={executionProgress} />
            </Box>
          )}

          {/* 快速操作按钮 */}
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              {t('emails.batch.quickActions')}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {quickActions.map((action) => (
                <Button
                  key={action.type}
                  startIcon={action.icon}
                  variant="outlined"
                  color={action.color}
                  size="small"
                  onClick={() => handleQuickAction(action.type)}
                  disabled={executing}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Box>

          {/* 高级操作按钮 */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button
              startIcon={<Settings />}
              variant="contained"
              color="primary"
              onClick={() => setAdvancedDialog(true)}
              disabled={executing}
            >
              {t('emails.batch.advancedOperations')}
            </Button>

            <Box display="flex" gap={1}>
              <Button
                startIcon={<Psychology />}
                variant="outlined"
                size="small"
                onClick={() => handleAdvancedAction('analyze')}
                disabled={executing}
              >
                {t('emails.batch.aiAnalysis')}
              </Button>
              <Button
                startIcon={<Download />}
                variant="outlined"
                size="small"
                onClick={() => setAdvancedDialog(true)}
                disabled={executing}
              >
                {t('emails.batch.export')}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 高级操作对话框 */}
      <Dialog
        open={advancedDialog}
        onClose={() => setAdvancedDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Settings />
            {t('emails.batch.advancedOperations')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* 标签管理 */}
            <Grid item xs={12} md={6}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Label />
                    <Typography>{t('emails.batch.labelManagement')}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>{t('emails.batch.labelOperation')}</InputLabel>
                      <Select
                        value={labelAction.operation}
                        onChange={(e) => setLabelAction(prev => ({ ...prev, operation: e.target.value }))}
                      >
                        <MenuItem value="add">{t('emails.batch.addLabel')}</MenuItem>
                        <MenuItem value="remove">{t('emails.batch.removeLabel')}</MenuItem>
                        <MenuItem value="replace">{t('emails.batch.replaceLabel')}</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel>{t('emails.batch.selectLabel')}</InputLabel>
                      <Select
                        value={labelAction.labelName}
                        onChange={(e) => setLabelAction(prev => ({ ...prev, labelName: e.target.value }))}
                      >
                        {availableLabels.map((label) => (
                          <MenuItem key={label} value={label}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={() => handleAdvancedAction('label')}
                      fullWidth
                    >
                      {t('emails.batch.applyLabel')}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* 分类管理 */}
            <Grid item xs={12} md={6}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Category />
                    <Typography>{t('emails.batch.categoryAssignment')}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>{t('emails.batch.selectCategory')}</InputLabel>
                      <Select
                        value={categoryAction}
                        onChange={(e) => setCategoryAction(e.target.value)}
                      >
                        {availableCategories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={() => handleAdvancedAction('category')}
                      fullWidth
                    >
                      {t('emails.batch.applyCategory')}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* 转发邮件 */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Forward />
                    <Typography>{t('emails.batch.forwardEmails')}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label={t('emails.batch.recipientEmails')}
                      placeholder="user1@example.com, user2@example.com"
                      value={forwardEmails}
                      onChange={(e) => setForwardEmails(e.target.value)}
                      helperText={t('emails.batch.separateWithCommas')}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleAdvancedAction('forward')}
                      fullWidth
                    >
                      {t('emails.batch.forwardSelected')}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* 导出功能 */}
            <Grid item xs={12} md={6}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Download />
                    <Typography>{t('emails.batch.exportEmails')}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>{t('emails.batch.exportFormat')}</InputLabel>
                      <Select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as any)}
                      >
                        <MenuItem value="pdf">PDF</MenuItem>
                        <MenuItem value="csv">CSV</MenuItem>
                        <MenuItem value="excel">Excel</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoAnalyze}
                          onChange={(e) => setAutoAnalyze(e.target.checked)}
                        />
                      }
                      label={t('emails.batch.includeAnalysis')}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleAdvancedAction('export')}
                      fullWidth
                    >
                      {t('emails.batch.exportSelected')}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* 定时操作 */}
            <Grid item xs={12} md={6}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Schedule />
                    <Typography>{t('emails.batch.scheduleAction')}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label={t('emails.batch.scheduleTime')}
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleAdvancedAction('schedule')}
                      fullWidth
                    >
                      {t('emails.batch.scheduleSelected')}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedDialog(false)}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 确认对话框 */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null, title: '', content: '' })}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning color="warning" />
            {confirmDialog.title}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, action: null, title: '', content: '' })}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (confirmDialog.action) {
                executeAction(confirmDialog.action);
              }
              setConfirmDialog({ open: false, action: null, title: '', content: '' });
            }}
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BatchOperationPanel;