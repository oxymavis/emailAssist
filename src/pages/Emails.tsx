/**
 * Email List Page Component
 * Displays email list with search, filtering, and batch operations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
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
  Menu,
  MenuItem,
  Button,
  Stack,
  Toolbar,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Card,
  CardContent,
  Grid,
  Divider,
  Badge,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Delete,
  Archive,
  Star,
  StarBorder,
  Reply,
  Forward,
  Flag,
  Schedule,
  Person,
  Email as EmailIcon,
  Psychology,
  Priority,
  Category,
  Refresh,
  Download,
  Check,
  Clear,
  Visibility,
  VisibilityOff,
  Label,
} from '@mui/icons-material';
import { useAppStore } from '@/store';
import { toast } from 'react-toastify';

interface EmailItem {
  id: string;
  subject: string;
  from: {
    name: string;
    email: string;
    avatar?: string;
  };
  preview: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  analysis?: any;
}

const Emails: React.FC = () => {
  const navigate = useNavigate();

  // 状态管理
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // 过滤器状态
  const [filters, setFilters] = useState({
    isRead: 'all', // 'all', 'read', 'unread'
    importance: 'all', // 'all', 'low', 'medium', 'high', 'critical'
    sentiment: 'all', // 'all', 'positive', 'negative', 'neutral'
    hasAttachments: 'all', // 'all', 'with', 'without'
    category: 'all',
    dateRange: 'all', // 'all', 'today', 'week', 'month'
  });

  // 批量操作对话框
  const [batchActionDialog, setBatchActionDialog] = useState<{
    open: boolean;
    action: string;
    title: string;
  }>({
    open: false,
    action: '',
    title: '',
  });

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockEmails: EmailItem[] = [
        {
          id: '1',
          subject: '系统故障紧急处理 - 生产环境数据库连接异常',
          from: {
            name: 'John Smith',
            email: 'john.smith@company.com',
            avatar: '',
          },
          preview: '我们的生产环境出现了严重的数据库连接问题，影响了多个核心服务...',
          receivedAt: '2024-01-15T10:30:00Z',
          isRead: false,
          isStarred: false,
          hasAttachments: true,
          importance: 'critical',
          labels: ['urgent', 'production', 'database'],
          category: 'technical-support',
          sentiment: 'negative',
        },
        {
          id: '2',
          subject: '项目进度更新 - Q1 里程碑完成报告',
          from: {
            name: 'Sarah Johnson',
            email: 'sarah.johnson@company.com',
          },
          preview: '很高兴向大家汇报，我们的Q1项目里程碑已经成功完成...',
          receivedAt: '2024-01-15T09:15:00Z',
          isRead: true,
          isStarred: true,
          hasAttachments: false,
          importance: 'medium',
          labels: ['project', 'milestone'],
          category: 'project-management',
          sentiment: 'positive',
        },
        {
          id: '3',
          subject: '客户反馈收集 - 新功能使用体验调研',
          from: {
            name: 'Mike Chen',
            email: 'mike.chen@company.com',
          },
          preview: '我们需要收集用户对新功能的使用反馈，请协助完成用户调研...',
          receivedAt: '2024-01-15T08:45:00Z',
          isRead: false,
          isStarred: false,
          hasAttachments: false,
          importance: 'medium',
          labels: ['customer', 'feedback'],
          category: 'customer-service',
          sentiment: 'neutral',
        },
      ];

      // 模拟异步加载
      setTimeout(() => {
        setEmails(mockEmails);
        setLoading(false);
      }, 1000);

    } catch (error) {
      console.error('加载邮件失败:', error);
      toast.error('加载邮件失败');
      setLoading(false);
    }
  };

  // 过滤和搜索邮件
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          email.subject.toLowerCase().includes(searchLower) ||
          email.from.name.toLowerCase().includes(searchLower) ||
          email.from.email.toLowerCase().includes(searchLower) ||
          email.preview.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // 已读状态过滤
      if (filters.isRead !== 'all') {
        if (filters.isRead === 'read' && !email.isRead) return false;
        if (filters.isRead === 'unread' && email.isRead) return false;
      }

      // 重要性过滤
      if (filters.importance !== 'all' && email.importance !== filters.importance) {
        return false;
      }

      // 情感过滤
      if (filters.sentiment !== 'all' && email.sentiment !== filters.sentiment) {
        return false;
      }

      // 附件过滤
      if (filters.hasAttachments !== 'all') {
        if (filters.hasAttachments === 'with' && !email.hasAttachments) return false;
        if (filters.hasAttachments === 'without' && email.hasAttachments) return false;
      }

      // 分类过滤
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

  // 处理单个邮件操作
  const handleEmailAction = (action: string, email: EmailItem) => {
    switch (action) {
      case 'view':
        navigate(`/email/${email.id}`);
        break;
      case 'star':
        setEmails(prev => prev.map(e =>
          e.id === email.id ? { ...e, isStarred: !e.isStarred } : e
        ));
        toast.success(email.isStarred ? '已取消收藏' : '已收藏');
        break;
      case 'read':
        setEmails(prev => prev.map(e =>
          e.id === email.id ? { ...e, isRead: !e.isRead } : e
        ));
        toast.success(email.isRead ? '标记为未读' : '标记为已读');
        break;
      case 'archive':
        toast.info('归档功能开发中');
        break;
      case 'delete':
        setEmails(prev => prev.filter(e => e.id !== email.id));
        toast.success('邮件已删除');
        break;
      default:
        console.log('Email action:', action, email);
    }
  };

  // 处理批量操作
  const handleBatchAction = (action: string) => {
    const actionNames = {
      read: '标记为已读',
      unread: '标记为未读',
      star: '收藏',
      unstar: '取消收藏',
      archive: '归档',
      delete: '删除',
    };

    setBatchActionDialog({
      open: true,
      action,
      title: `${actionNames[action as keyof typeof actionNames]} (${selectedEmails.length}封邮件)`,
    });
  };

  // 执行批量操作
  const executeBatchAction = () => {
    const { action } = batchActionDialog;

    switch (action) {
      case 'read':
        setEmails(prev => prev.map(e =>
          selectedEmails.includes(e.id) ? { ...e, isRead: true } : e
        ));
        toast.success(`${selectedEmails.length}封邮件已标记为已读`);
        break;
      case 'unread':
        setEmails(prev => prev.map(e =>
          selectedEmails.includes(e.id) ? { ...e, isRead: false } : e
        ));
        toast.success(`${selectedEmails.length}封邮件已标记为未读`);
        break;
      case 'star':
        setEmails(prev => prev.map(e =>
          selectedEmails.includes(e.id) ? { ...e, isStarred: true } : e
        ));
        toast.success(`${selectedEmails.length}封邮件已收藏`);
        break;
      case 'unstar':
        setEmails(prev => prev.map(e =>
          selectedEmails.includes(e.id) ? { ...e, isStarred: false } : e
        ));
        toast.success(`${selectedEmails.length}封邮件已取消收藏`);
        break;
      case 'archive':
        toast.info('归档功能开发中');
        break;
      case 'delete':
        setEmails(prev => prev.filter(e => !selectedEmails.includes(e.id)));
        toast.success(`${selectedEmails.length}封邮件已删除`);
        break;
    }

    setSelectedEmails([]);
    setBatchActionDialog({ open: false, action: '', title: '' });
  };

  // 获取重要性颜色
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // 获取情感颜色
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'info';
      default: return 'default';
    }
  };

  const renderFilterMenu = () => (
    <Menu
      anchorEl={filterAnchorEl}
      open={Boolean(filterAnchorEl)}
      onClose={() => setFilterAnchorEl(null)}
    >
      <Box sx={{ p: 2, minWidth: 300 }}>
        <Typography variant="h6" gutterBottom>
          邮件过滤
        </Typography>

        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>阅读状态</InputLabel>
            <Select
              value={filters.isRead}
              onChange={(e) => setFilters(prev => ({ ...prev, isRead: e.target.value }))}
              label="阅读状态"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="unread">未读</MenuItem>
              <MenuItem value="read">已读</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>重要性</InputLabel>
            <Select
              value={filters.importance}
              onChange={(e) => setFilters(prev => ({ ...prev, importance: e.target.value }))}
              label="重要性"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="critical">紧急</MenuItem>
              <MenuItem value="high">重要</MenuItem>
              <MenuItem value="medium">普通</MenuItem>
              <MenuItem value="low">较低</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>情感倾向</InputLabel>
            <Select
              value={filters.sentiment}
              onChange={(e) => setFilters(prev => ({ ...prev, sentiment: e.target.value }))}
              label="情感倾向"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="positive">积极</MenuItem>
              <MenuItem value="neutral">中性</MenuItem>
              <MenuItem value="negative">消极</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>附件</InputLabel>
            <Select
              value={filters.hasAttachments}
              onChange={(e) => setFilters(prev => ({ ...prev, hasAttachments: e.target.value }))}
              label="附件"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="with">有附件</MenuItem>
              <MenuItem value="without">无附件</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
          <Button
            size="small"
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
            重置
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => setFilterAnchorEl(null)}
          >
            应用
          </Button>
        </Stack>
      </Box>
    </Menu>
  );

  if (loading) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          邮件列表
        </Typography>
        <Alert severity="info">
          正在加载邮件...
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        邮件列表
      </Typography>

      {/* 顶部工具栏 */}
      <Paper elevation={1} sx={{ mb: 3 }}>
        <Toolbar>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
            <TextField
              size="small"
              placeholder="搜索邮件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />

            <Button
              startIcon={<FilterList />}
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            >
              过滤器
            </Button>

            <Button
              startIcon={<Refresh />}
              onClick={loadEmails}
            >
              刷新
            </Button>
          </Stack>

          {selectedEmails.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<Check />}
                onClick={() => handleBatchAction('read')}
              >
                标记已读
              </Button>
              <Button
                size="small"
                startIcon={<Star />}
                onClick={() => handleBatchAction('star')}
              >
                收藏
              </Button>
              <Button
                size="small"
                startIcon={<Archive />}
                onClick={() => handleBatchAction('archive')}
              >
                归档
              </Button>
              <Button
                size="small"
                startIcon={<Delete />}
                color="error"
                onClick={() => handleBatchAction('delete')}
              >
                删除
              </Button>
            </Stack>
          )}
        </Toolbar>
      </Paper>

      {/* 统计信息 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <EmailIcon color="primary" />
                <Box>
                  <Typography variant="h4">{emails.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    总邮件数
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Badge
                  badgeContent={emails.filter(e => !e.isRead).length}
                  color="error"
                >
                  <Visibility color="primary" />
                </Badge>
                <Box>
                  <Typography variant="h4">
                    {emails.filter(e => !e.isRead).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    未读邮件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Flag color="error" />
                <Box>
                  <Typography variant="h4">
                    {emails.filter(e => e.importance === 'critical' || e.importance === 'high').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    重要邮件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Star color="warning" />
                <Box>
                  <Typography variant="h4">
                    {emails.filter(e => e.isStarred).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    收藏邮件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 邮件列表 */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedEmails.length > 0 &&
                      selectedEmails.length < paginatedEmails.length
                    }
                    checked={
                      paginatedEmails.length > 0 &&
                      selectedEmails.length === paginatedEmails.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>发件人</TableCell>
                <TableCell>主题</TableCell>
                <TableCell>预览</TableCell>
                <TableCell>接收时间</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEmails.map((email) => (
                <TableRow
                  key={email.id}
                  hover
                  selected={selectedEmails.includes(email.id)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: email.isRead ? 'inherit' : 'action.hover',
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedEmails.includes(email.id)}
                      onChange={() => handleSelectEmail(email.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar
                        src={email.from.avatar}
                        sx={{ width: 32, height: 32 }}
                      >
                        {email.from.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {email.from.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {email.from.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell onClick={() => handleEmailAction('view', email)}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {email.hasAttachments && (
                        <Tooltip title="有附件">
                          <IconButton size="small">
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Typography
                        variant="body2"
                        fontWeight={email.isRead ? 'normal' : 'bold'}
                        noWrap
                        sx={{ maxWidth: 300 }}
                      >
                        {email.subject}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell onClick={() => handleEmailAction('view', email)}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 200 }}
                    >
                      {email.preview}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(email.receivedAt).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          size="small"
                          label={email.importance}
                          color={getImportanceColor(email.importance)}
                        />
                        <Chip
                          size="small"
                          label={email.sentiment}
                          color={getSentimentColor(email.sentiment)}
                          variant="outlined"
                        />
                      </Stack>
                      {email.labels.length > 0 && (
                        <Stack direction="row" spacing={0.5}>
                          {email.labels.slice(0, 2).map((label, index) => (
                            <Chip
                              key={index}
                              size="small"
                              label={label}
                              variant="outlined"
                              sx={{ fontSize: '10px', height: '20px' }}
                            />
                          ))}
                          {email.labels.length > 2 && (
                            <Typography variant="caption" color="text.secondary">
                              +{email.labels.length - 2}
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={email.isStarred ? '取消收藏' : '收藏'}>
                        <IconButton
                          size="small"
                          onClick={() => handleEmailAction('star', email)}
                        >
                          {email.isStarred ? (
                            <Star sx={{ color: 'warning.main' }} />
                          ) : (
                            <StarBorder />
                          )}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={email.isRead ? '标记未读' : '标记已读'}>
                        <IconButton
                          size="small"
                          onClick={() => handleEmailAction('read', email)}
                        >
                          {email.isRead ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => handleEmailAction('view', email)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="更多操作">
                        <IconButton
                          size="small"
                          onClick={(e) => setMoreAnchorEl(e.currentTarget)}
                        >
                          <MoreVert />
                        </IconButton>
                      </Tooltip>
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
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="每页显示:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / ${count !== -1 ? count : `超过 ${to}`}`
          }
        />
      </Paper>

      {/* 过滤器菜单 */}
      {renderFilterMenu()}

      {/* 批量操作确认对话框 */}
      <Dialog
        open={batchActionDialog.open}
        onClose={() => setBatchActionDialog({ open: false, action: '', title: '' })}
      >
        <DialogTitle>
          {batchActionDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            您确定要执行此操作吗？此操作将应用到所选的 {selectedEmails.length} 封邮件。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBatchActionDialog({ open: false, action: '', title: '' })}
          >
            取消
          </Button>
          <Button
            onClick={executeBatchAction}
            variant="contained"
            color={batchActionDialog.action === 'delete' ? 'error' : 'primary'}
          >
            确认
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Emails;