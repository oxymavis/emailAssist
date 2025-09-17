/**
 * Email Batch Operations Page
 * 邮件批量操作页面 - 集成所有批量操作功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Divider,
  Stack,
  Switch,
  FormControlLabel,
  Badge,
} from '@mui/material';
import {
  Search,
  FilterList,
  Refresh,
  Settings,
  Psychology,
  History,
  Star,
  StarBorder,
  Archive,
  Delete,
  Label,
  Category,
  Person,
  Schedule,
  Visibility,
  GetApp,
  SelectAll,
  ClearAll,
  Analytics,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

// 导入批量操作组件
import BatchOperationPanel from '@/components/emails/BatchOperationPanel';
import SmartBatchSuggestions from '@/components/emails/SmartBatchSuggestions';
import BatchOperationHistory from '@/components/emails/BatchOperationHistory';
import { useEmails, useNotifications } from '@/store';

interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  senderEmail: string;
  preview: string;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  analysis?: any;
}

interface BatchOperation {
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

const EmailBatchOperations: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  // 状态管理
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tabValue, setTabValue] = useState(0);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [operationHistory, setOperationHistory] = useState<BatchOperation[]>([]);

  // 过滤器状态
  const [filters, setFilters] = useState({
    isRead: 'all',
    importance: 'all',
    sentiment: 'all',
    hasAttachments: 'all',
    category: 'all',
    dateRange: 'all',
  });

  // 智能选择模式
  const [smartSelectMode, setSmartSelectMode] = useState(false);
  const [autoSuggestionsEnabled, setAutoSuggestionsEnabled] = useState(true);

  const availableLabels = ['urgent', 'important', 'follow-up', 'archived', 'spam'];
  const availableCategories = ['work', 'personal', 'marketing', 'support', 'newsletter'];

  useEffect(() => {
    loadEmails();
    loadOperationHistory();
  }, []);

  // 监听选中邮件变化，显示/隐藏批量操作面板
  useEffect(() => {
    setShowBatchPanel(selectedEmails.length > 0);
  }, [selectedEmails]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      // 模拟加载大量邮件数据
      const mockEmails: EmailItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `email-${i + 1}`,
        subject: `邮件主题 ${i + 1} - ${['重要通知', '项目更新', '客户反馈', '系统维护', '会议邀请'][i % 5]}`,
        sender: ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Wang', 'Tom Brown'][i % 5],
        senderEmail: ['john@company.com', 'sarah@company.com', 'mike@company.com', 'lisa@company.com', 'tom@company.com'][i % 5],
        preview: `这是邮件 ${i + 1} 的预览内容，包含了一些重要信息...`,
        receivedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isRead: Math.random() > 0.3,
        isStarred: Math.random() > 0.8,
        hasAttachments: Math.random() > 0.7,
        importance: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        labels: Math.random() > 0.5 ? [availableLabels[Math.floor(Math.random() * availableLabels.length)]] : [],
        category: availableCategories[Math.floor(Math.random() * availableCategories.length)],
        sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)] as any,
      }));

      setTimeout(() => {
        setEmails(mockEmails);
        setLoading(false);
      }, 1000);

    } catch (error) {
      toast.error(t('emails.batch.loadError'));
      setLoading(false);
    }
  };

  const loadOperationHistory = async () => {
    // 模拟加载操作历史
    const mockHistory: BatchOperation[] = [
      {
        id: 'op-1',
        type: 'batch',
        action: 'archive',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        affectedCount: 15,
        status: 'completed',
        undoable: true,
        undoDeadline: new Date(Date.now() + 22 * 60 * 60 * 1000),
        details: {
          parameters: { reason: 'bulk cleanup' },
        },
        user: 'Current User',
      },
      {
        id: 'op-2',
        type: 'batch',
        action: 'mark-read',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        affectedCount: 23,
        status: 'completed',
        undoable: true,
        details: {},
        user: 'Current User',
      },
    ];

    setOperationHistory(mockHistory);
  };

  // 过滤和搜索邮件
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          email.subject.toLowerCase().includes(searchLower) ||
          email.sender.toLowerCase().includes(searchLower) ||
          email.senderEmail.toLowerCase().includes(searchLower) ||
          email.preview.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // 其他过滤器逻辑...
      if (filters.isRead !== 'all') {
        if (filters.isRead === 'read' && !email.isRead) return false;
        if (filters.isRead === 'unread' && email.isRead) return false;
      }

      if (filters.importance !== 'all' && email.importance !== filters.importance) {
        return false;
      }

      if (filters.sentiment !== 'all' && email.sentiment !== filters.sentiment) {
        return false;
      }

      if (filters.category !== 'all' && email.category !== filters.category) {
        return false;
      }

      return true;
    });
  }, [emails, searchTerm, filters]);

  // 分页邮件
  const paginatedEmails = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredEmails.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredEmails, page, rowsPerPage]);

  // 处理邮件选择
  const handleSelectEmail = (emailId: string) => {
    setSelectedEmails(prev =>
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedEmails.length === paginatedEmails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(paginatedEmails.map(email => email.id));
    }
  };

  // 智能选择
  const handleSmartSelect = (criteria: string) => {
    let targetEmails: string[] = [];

    switch (criteria) {
      case 'unread':
        targetEmails = paginatedEmails.filter(e => !e.isRead).map(e => e.id);
        break;
      case 'important':
        targetEmails = paginatedEmails.filter(e => e.importance === 'high' || e.importance === 'critical').map(e => e.id);
        break;
      case 'old':
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        targetEmails = paginatedEmails.filter(e => e.receivedAt < oneDayAgo).map(e => e.id);
        break;
      case 'negative':
        targetEmails = paginatedEmails.filter(e => e.sentiment === 'negative').map(e => e.id);
        break;
    }

    setSelectedEmails(targetEmails);
    toast.success(t('emails.batch.smartSelectSuccess', { count: targetEmails.length }));
  };

  // 执行批量操作
  const handleBatchAction = async (action: any) => {
    const affectedEmails = emails.filter(email => selectedEmails.includes(email.id));

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 创建操作记录
      const newOperation: BatchOperation = {
        id: `op-${Date.now()}`,
        type: 'batch',
        action: action.type,
        timestamp: new Date(),
        affectedCount: selectedEmails.length,
        status: 'completed',
        undoable: ['mark-read', 'mark-unread', 'star', 'unstar', 'archive', 'label'].includes(action.type),
        undoDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        details: {
          parameters: action.params,
          originalValues: affectedEmails.map(email => ({
            id: email.id,
            isRead: email.isRead,
            isStarred: email.isStarred,
            labels: [...email.labels],
            category: email.category,
          })),
        },
        user: 'Current User',
      };

      // 更新邮件状态
      setEmails(prev => prev.map(email => {
        if (!selectedEmails.includes(email.id)) return email;

        switch (action.type) {
          case 'mark-read':
            return { ...email, isRead: true };
          case 'mark-unread':
            return { ...email, isRead: false };
          case 'star':
            return { ...email, isStarred: true };
          case 'unstar':
            return { ...email, isStarred: false };
          case 'archive':
            return { ...email, isRead: true }; // 归档时标记为已读
          case 'label':
            if (action.params?.labelName) {
              return { ...email, labels: [...email.labels, action.params.labelName] };
            }
            return email;
          case 'category':
            if (action.params?.categoryName) {
              return { ...email, category: action.params.categoryName };
            }
            return email;
          default:
            return email;
        }
      }));

      // 添加到历史记录
      setOperationHistory(prev => [newOperation, ...prev]);

      // 清空选择
      setSelectedEmails([]);

      addNotification({
        type: 'success',
        title: t('emails.batch.operationSuccess'),
        message: t('emails.batch.operationSuccessMessage', {
          action: action.type,
          count: selectedEmails.length,
        }),
      });

    } catch (error) {
      addNotification({
        type: 'error',
        title: t('emails.batch.operationError'),
        message: t('emails.batch.operationErrorMessage'),
      });
    }
  };

  // 撤销操作
  const handleUndoOperation = async (operationId: string) => {
    const operation = operationHistory.find(op => op.id === operationId);
    if (!operation || !operation.details.originalValues) return;

    try {
      // 恢复邮件原始状态
      setEmails(prev => prev.map(email => {
        const originalValue = operation.details.originalValues?.find((val: any) => val.id === email.id);
        if (originalValue) {
          return {
            ...email,
            isRead: originalValue.isRead,
            isStarred: originalValue.isStarred,
            labels: originalValue.labels,
            category: originalValue.category,
          };
        }
        return email;
      }));

      // 标记操作为已撤销
      setOperationHistory(prev => prev.map(op =>
        op.id === operationId ? { ...op, status: 'undone' as const } : op
      ));

      toast.success(t('emails.batch.undoSuccess'));

    } catch (error) {
      toast.error(t('emails.batch.undoError'));
    }
  };

  // 应用智能建议
  const handleApplySuggestion = async (suggestion: any) => {
    // 根据建议自动选择相关邮件
    let targetEmails: string[] = [];

    switch (suggestion.actionType) {
      case 'batch-process-sender':
        targetEmails = emails
          .filter(e => e.sender === suggestion.actionParams.sender)
          .map(e => e.id);
        break;
      case 'prioritize-important':
        targetEmails = emails
          .filter(e => suggestion.actionParams.importance.includes(e.importance))
          .map(e => e.id);
        break;
      case 'archive-old':
        const cutoffDate = new Date(Date.now() - suggestion.actionParams.daysCutoff * 24 * 60 * 60 * 1000);
        targetEmails = emails
          .filter(e => !e.isRead && e.receivedAt < cutoffDate)
          .map(e => e.id);
        break;
      case 'flag-negative':
        targetEmails = emails
          .filter(e => e.sentiment === 'negative')
          .map(e => e.id);
        break;
    }

    setSelectedEmails(targetEmails);
    toast.success(t('emails.batch.suggestionApplied', { count: targetEmails.length }));
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    toast.info(t('emails.batch.suggestionDismissed'));
  };

  const renderTabContent = () => {
    switch (tabValue) {
      case 0:
        return (
          <>
            {/* 智能建议面板 */}
            {autoSuggestionsEnabled && selectedEmails.length > 0 && (
              <SmartBatchSuggestions
                selectedEmails={emails.filter(e => selectedEmails.includes(e.id))}
                allEmails={emails}
                onApplySuggestion={handleApplySuggestion}
                onDismissSuggestion={handleDismissSuggestion}
              />
            )}

            {/* 邮件列表 */}
            <Paper>
              <Box p={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    {t('emails.batch.emailList')}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={smartSelectMode}
                          onChange={(e) => setSmartSelectMode(e.target.checked)}
                        />
                      }
                      label={t('emails.batch.smartSelect')}
                    />
                    <Button
                      size="small"
                      onClick={() => handleSmartSelect('unread')}
                      disabled={!smartSelectMode}
                    >
                      {t('emails.batch.selectUnread')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleSmartSelect('important')}
                      disabled={!smartSelectMode}
                    >
                      {t('emails.batch.selectImportant')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleSmartSelect('old')}
                      disabled={!smartSelectMode}
                    >
                      {t('emails.batch.selectOld')}
                    </Button>
                  </Box>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedEmails.length === paginatedEmails.length && paginatedEmails.length > 0}
                            indeterminate={selectedEmails.length > 0 && selectedEmails.length < paginatedEmails.length}
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                        <TableCell>{t('emails.batch.sender')}</TableCell>
                        <TableCell>{t('emails.batch.subject')}</TableCell>
                        <TableCell>{t('emails.batch.category')}</TableCell>
                        <TableCell>{t('emails.batch.importance')}</TableCell>
                        <TableCell>{t('emails.batch.sentiment')}</TableCell>
                        <TableCell>{t('emails.batch.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedEmails.map((email) => (
                        <TableRow
                          key={email.id}
                          selected={selectedEmails.includes(email.id)}
                          sx={{ opacity: email.isRead ? 0.7 : 1 }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedEmails.includes(email.id)}
                              onChange={() => handleSelectEmail(email.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {email.sender.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2">
                                  {email.sender}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {email.senderEmail}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight={email.isRead ? 'normal' : 'bold'}>
                                {email.subject}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {email.preview.substring(0, 50)}...
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={email.category} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={email.importance}
                              size="small"
                              color={
                                email.importance === 'critical' ? 'error' :
                                email.importance === 'high' ? 'warning' :
                                email.importance === 'medium' ? 'info' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={email.sentiment}
                              size="small"
                              color={
                                email.sentiment === 'positive' ? 'success' :
                                email.sentiment === 'negative' ? 'error' : 'default'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/email/${email.id}`)}
                              >
                                <Visibility />
                              </IconButton>
                              <IconButton
                                size="small"
                                color={email.isStarred ? 'warning' : 'default'}
                                onClick={() => {
                                  setEmails(prev => prev.map(e =>
                                    e.id === email.id ? { ...e, isStarred: !e.isStarred } : e
                                  ));
                                }}
                              >
                                {email.isStarred ? <Star /> : <StarBorder />}
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredEmails.length}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                />
              </Box>
            </Paper>
          </>
        );

      case 1:
        return (
          <BatchOperationHistory
            operations={operationHistory}
            onUndo={handleUndoOperation}
            onClearHistory={() => setOperationHistory([])}
          />
        );

      case 2:
        return (
          <Paper>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                {t('emails.batch.analytics')}
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {emails.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('emails.batch.totalEmails')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {selectedEmails.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('emails.batch.selectedEmails')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {operationHistory.filter(op => op.status === 'completed').length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('emails.batch.completedOperations')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          {t('emails.batch.title')}
        </Typography>
        <Alert severity="info">
          {t('emails.batch.loading')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        {t('emails.batch.title')}
      </Typography>

      {/* 搜索和过滤栏 */}
      <Paper sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder={t('emails.batch.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>{t('emails.batch.readStatus')}</InputLabel>
                <Select
                  value={filters.isRead}
                  label={t('emails.batch.readStatus')}
                  onChange={(e) => setFilters(prev => ({ ...prev, isRead: e.target.value }))}
                >
                  <MenuItem value="all">{t('common.all')}</MenuItem>
                  <MenuItem value="unread">{t('emails.batch.unread')}</MenuItem>
                  <MenuItem value="read">{t('emails.batch.read')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>{t('emails.batch.importance')}</InputLabel>
                <Select
                  value={filters.importance}
                  label={t('emails.batch.importance')}
                  onChange={(e) => setFilters(prev => ({ ...prev, importance: e.target.value }))}
                >
                  <MenuItem value="all">{t('common.all')}</MenuItem>
                  <MenuItem value="critical">{t('emails.batch.critical')}</MenuItem>
                  <MenuItem value="high">{t('emails.batch.high')}</MenuItem>
                  <MenuItem value="medium">{t('emails.batch.medium')}</MenuItem>
                  <MenuItem value="low">{t('emails.batch.low')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>{t('emails.batch.category')}</InputLabel>
                <Select
                  value={filters.category}
                  label={t('emails.batch.category')}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <MenuItem value="all">{t('common.all')}</MenuItem>
                  {availableCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                  onClick={() => {
                    setFilters({
                      isRead: 'all',
                      importance: 'all',
                      sentiment: 'all',
                      hasAttachments: 'all',
                      category: 'all',
                      dateRange: 'all',
                    });
                  }}
                >
                  {t('common.reset')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadEmails}
                >
                  {t('common.refresh')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* 标签页 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab
            icon={<Badge badgeContent={selectedEmails.length} color="primary"><Analytics /></Badge>}
            label={t('emails.batch.operations')}
          />
          <Tab
            icon={<Badge badgeContent={operationHistory.length} color="secondary"><History /></Badge>}
            label={t('emails.batch.history')}
          />
          <Tab icon={<Analytics />} label={t('emails.batch.analytics')} />
        </Tabs>
      </Paper>

      {/* 标签页内容 */}
      {renderTabContent()}

      {/* 批量操作面板 */}
      {showBatchPanel && (
        <BatchOperationPanel
          selectedCount={selectedEmails.length}
          totalCount={filteredEmails.length}
          onClose={() => {
            setSelectedEmails([]);
            setShowBatchPanel(false);
          }}
          onExecuteAction={handleBatchAction}
          availableLabels={availableLabels}
          availableCategories={availableCategories}
        />
      )}
    </Box>
  );
};

export default EmailBatchOperations;