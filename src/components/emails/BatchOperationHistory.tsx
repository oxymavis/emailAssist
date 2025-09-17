/**
 * Batch Operation History Component
 * 批量操作历史记录和撤销组件
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Button,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Alert,
  Snackbar,
  LinearProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  History,
  Undo,
  Delete,
  Archive,
  Star,
  Label,
  Category,
  Forward,
  Schedule,
  Psychology,
  Check,
  Error,
  Warning,
  Info,
  Visibility,
  Clear,
  Refresh,
  Download,
  AccessTime,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface BatchOperationRecord {
  id: string;
  type: string;
  action: string;
  timestamp: Date;
  affectedCount: number;
  status: 'completed' | 'failed' | 'partially-failed' | 'undone';
  undoable: boolean;
  undoDeadline?: Date;
  details: {
    originalValues?: any[];
    parameters?: any;
    errors?: string[];
  };
  user: string;
}

interface BatchOperationHistoryProps {
  operations: BatchOperationRecord[];
  onUndo: (operationId: string) => Promise<void>;
  onClearHistory: () => void;
  maxHistoryItems?: number;
}

const BatchOperationHistory: React.FC<BatchOperationHistoryProps> = ({
  operations,
  onUndo,
  onClearHistory,
  maxHistoryItems = 50,
}) => {
  const { t } = useTranslation();

  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    operation: BatchOperationRecord | null;
  }>({
    open: false,
    operation: null,
  });

  const [undoInProgress, setUndoInProgress] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // 自动清理过期的历史记录
  useEffect(() => {
    const cleanup = setInterval(() => {
      // 在这里可以添加自动清理过期记录的逻辑
    }, 60000); // 每分钟检查一次

    return () => clearInterval(cleanup);
  }, []);

  const getOperationIcon = (action: string) => {
    switch (action) {
      case 'delete': return <Delete />;
      case 'archive': return <Archive />;
      case 'star':
      case 'unstar': return <Star />;
      case 'label': return <Label />;
      case 'category': return <Category />;
      case 'forward': return <Forward />;
      case 'schedule': return <Schedule />;
      case 'analyze': return <Psychology />;
      case 'export': return <Download />;
      default: return <Info />;
    }
  };

  const getOperationColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'partially-failed': return 'warning';
      case 'undone': return 'info';
      default: return 'default';
    }
  };

  const getActionName = (action: string) => {
    const actionNames: Record<string, string> = {
      'delete': t('emails.batch.delete'),
      'archive': t('emails.batch.archive'),
      'star': t('emails.batch.star'),
      'unstar': t('emails.batch.unstar'),
      'mark-read': t('emails.batch.markRead'),
      'mark-unread': t('emails.batch.markUnread'),
      'label': t('emails.batch.label'),
      'category': t('emails.batch.category'),
      'forward': t('emails.batch.forward'),
      'schedule': t('emails.batch.schedule'),
      'analyze': t('emails.batch.analyze'),
      'export': t('emails.batch.export'),
    };
    return actionNames[action] || action;
  };

  const canUndo = (operation: BatchOperationRecord): boolean => {
    if (!operation.undoable || operation.status !== 'completed') {
      return false;
    }

    if (operation.undoDeadline) {
      return new Date() < operation.undoDeadline;
    }

    // 默认24小时内可以撤销
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return operation.timestamp > oneDayAgo;
  };

  const handleUndo = async (operation: BatchOperationRecord) => {
    setUndoInProgress(operation.id);

    try {
      await onUndo(operation.id);
      setSnackbar({
        open: true,
        message: t('emails.history.undoSuccess'),
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('emails.history.undoFailed'),
        severity: 'error',
      });
    } finally {
      setUndoInProgress(null);
    }
  };

  const renderOperationTimeline = () => (
    <Timeline>
      {operations.slice(0, maxHistoryItems).map((operation, index) => (
        <TimelineItem key={operation.id}>
          <TimelineSeparator>
            <TimelineDot
              color={getOperationColor(operation.status) as any}
              variant={operation.status === 'completed' ? 'filled' : 'outlined'}
            >
              {getOperationIcon(operation.action)}
            </TimelineDot>
            {index < operations.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Card
              variant="outlined"
              sx={{
                mb: 1,
                opacity: operation.status === 'undone' ? 0.6 : 1,
              }}
            >
              <CardContent sx={{ py: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box>
                    <Typography variant="subtitle2">
                      {getActionName(operation.action)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(operation.timestamp, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      {' · '}{operation.user}
                    </Typography>
                    <Box mt={1}>
                      <Chip
                        label={`${operation.affectedCount} ${t('emails.history.emailsAffected')}`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={operation.status}
                        size="small"
                        color={getOperationColor(operation.status) as any}
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {canUndo(operation) && (
                      <Tooltip title={t('emails.history.undoOperation')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleUndo(operation)}
                          disabled={undoInProgress === operation.id}
                        >
                          {undoInProgress === operation.id ? (
                            <div style={{ width: 20, height: 20 }}>
                              <LinearProgress size={20} />
                            </div>
                          ) : (
                            <Undo />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('emails.history.viewDetails')}>
                      <IconButton
                        size="small"
                        onClick={() => setDetailsDialog({ open: true, operation })}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );

  const renderOperationDetails = () => {
    const operation = detailsDialog.operation;
    if (!operation) return null;

    return (
      <Dialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, operation: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {getOperationIcon(operation.action)}
            {t('emails.history.operationDetails')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('emails.history.basicInfo')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('emails.history.operation')}
                    secondary={getActionName(operation.action)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('emails.history.timestamp')}
                    secondary={format(operation.timestamp, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('emails.history.affectedEmails')}
                    secondary={operation.affectedCount}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('emails.history.status')}
                    secondary={
                      <Chip
                        label={operation.status}
                        size="small"
                        color={getOperationColor(operation.status) as any}
                        variant="outlined"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('emails.history.executor')}
                    secondary={operation.user}
                  />
                </ListItem>
              </List>
            </Box>

            {operation.details.parameters && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('emails.history.parameters')}
                </Typography>
                <Alert severity="info">
                  <pre>{JSON.stringify(operation.details.parameters, null, 2)}</pre>
                </Alert>
              </Box>
            )}

            {operation.details.errors && operation.details.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('emails.history.errors')}
                </Typography>
                <List dense>
                  {operation.details.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Error color="error" />
                      </ListItemIcon>
                      <ListItemText primary={error} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {canUndo(operation) && (
              <Alert severity="warning">
                {t('emails.history.undoAvailable')}
                {operation.undoDeadline && (
                  <Typography variant="caption" display="block">
                    {t('emails.history.undoDeadline')}: {format(operation.undoDeadline, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </Typography>
                )}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDetailsDialog({ open: false, operation: null })}
          >
            {t('common.close')}
          </Button>
          {canUndo(operation) && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<Undo />}
              onClick={() => {
                setDetailsDialog({ open: false, operation: null });
                handleUndo(operation);
              }}
            >
              {t('emails.history.undoOperation')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <History />
              <Typography variant="h6">
                {t('emails.history.title')}
              </Typography>
              <Chip
                label={`${operations.length} ${t('emails.history.operations')}`}
                size="small"
                variant="outlined"
              />
            </Box>
            <Box>
              <Button
                size="small"
                startIcon={<Refresh />}
                sx={{ mr: 1 }}
              >
                {t('common.refresh')}
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<Clear />}
                onClick={onClearHistory}
                disabled={operations.length === 0}
              >
                {t('emails.history.clearHistory')}
              </Button>
            </Box>
          </Box>

          {operations.length === 0 ? (
            <Alert severity="info">
              {t('emails.history.noOperations')}
            </Alert>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {renderOperationTimeline()}
            </Box>
          )}

          <Box mt={2} display="flex" alignItems="center" gap={1}>
            <AccessTime fontSize="small" color="disabled" />
            <Typography variant="caption" color="text.secondary">
              {t('emails.history.autoCleanup')}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {renderOperationDetails()}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </>
  );
};

export default BatchOperationHistory;