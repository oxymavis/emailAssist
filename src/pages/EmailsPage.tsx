import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  TextField,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
  Badge,
  Checkbox,
  Menu,
  MenuItem,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MarkEmailRead as ReadIcon,
  MarkEmailUnread as UnreadIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const EmailsPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // 模拟邮件数据
  const emailsData = {
    inbox: [
      {
        id: '1',
        sender: { name: 'John Smith', email: 'john@example.com', avatar: 'J' },
        subject: '项目进度更新 - Q4计划',
        preview: '关于我们Q4项目的最新进展，需要您的反馈...',
        time: '10:30 AM',
        isRead: false,
        isStarred: true,
        priority: 'high',
        attachments: 2,
        labels: ['工作', '紧急'],
      },
      {
        id: '2',
        sender: { name: 'Sarah Chen', email: 'sarah@company.com', avatar: 'S' },
        subject: '会议安排确认',
        preview: '明天下午2点的团队会议，请确认您的参与...',
        time: '09:15 AM',
        isRead: true,
        isStarred: false,
        priority: 'medium',
        attachments: 0,
        labels: ['会议'],
      },
      {
        id: '3',
        sender: { name: 'Mike Johnson', email: 'mike@tech.com', avatar: 'M' },
        subject: '系统维护通知',
        preview: '本周末将进行系统维护，预计停机时间...',
        time: '08:45 AM',
        isRead: true,
        isStarred: false,
        priority: 'low',
        attachments: 1,
        labels: ['通知'],
      },
      {
        id: '4',
        sender: { name: 'AI Assistant', email: 'ai@emailassist.com', avatar: '🤖' },
        subject: 'AI分析报告 - 本周邮件总结',
        preview: '您本周共收到156封邮件，其中65%为积极情感...',
        time: '07:30 AM',
        isRead: false,
        isStarred: true,
        priority: 'medium',
        attachments: 3,
        labels: ['AI分析', '报告'],
      },
    ],
    sent: [
      {
        id: '5',
        sender: { name: '我', email: 'me@company.com', avatar: 'Me' },
        subject: 'Re: 项目提案审核',
        preview: '感谢您的提案，我已经仔细审阅...',
        time: '昨天',
        isRead: true,
        isStarred: false,
        priority: 'medium',
        attachments: 0,
        labels: ['工作'],
      },
    ],
    drafts: [
      {
        id: '6',
        sender: { name: '草稿', email: '', avatar: '📝' },
        subject: '关于下一季度预算分配',
        preview: '各部门负责人，关于下一季度的预算...',
        time: '草稿',
        isRead: true,
        isStarred: false,
        priority: 'medium',
        attachments: 1,
        labels: ['预算'],
      },
    ],
  };

  const currentEmails = tabValue === 0 ? emailsData.inbox :
                       tabValue === 1 ? emailsData.sent :
                       emailsData.drafts;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmails(prev =>
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAll = () => {
    setSelectedEmails(
      selectedEmails.length === currentEmails.length
        ? []
        : currentEmails.map(email => email.id)
    );
  };

  return (
    <Box>
      {/* 页面标题和操作栏 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          📧 邮件管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            color="primary"
          >
            写邮件
          </Button>
          <IconButton color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 搜索和筛选栏 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="搜索邮件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            筛选
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem>未读邮件</MenuItem>
            <MenuItem>已标星</MenuItem>
            <MenuItem>有附件</MenuItem>
            <MenuItem>高优先级</MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* 邮件列表 */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {/* 标签页 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab
                label={
                  <Badge badgeContent={emailsData.inbox.filter(e => !e.isRead).length} color="error">
                    收件箱
                  </Badge>
                }
              />
              <Tab label="已发送" />
              <Tab
                label={
                  <Badge badgeContent={emailsData.drafts.length} color="info">
                    草稿
                  </Badge>
                }
              />
            </Tabs>
          </Box>

          {/* 批量操作栏 */}
          {selectedEmails.length > 0 && (
            <Box sx={{ p: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography>
                已选择 {selectedEmails.length} 封邮件
              </Typography>
              <Button size="small" startIcon={<ReadIcon />}>标记已读</Button>
              <Button size="small" startIcon={<ArchiveIcon />}>归档</Button>
              <Button size="small" startIcon={<DeleteIcon />} color="error">删除</Button>
            </Box>
          )}

          {/* 邮件列表头部 */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
            <Checkbox
              checked={selectedEmails.length === currentEmails.length && currentEmails.length > 0}
              indeterminate={selectedEmails.length > 0 && selectedEmails.length < currentEmails.length}
              onChange={handleSelectAll}
            />
            <Typography sx={{ ml: 1, fontWeight: 'bold' }}>
              {currentEmails.length} 封邮件
            </Typography>
          </Box>

          {/* 邮件列表内容 */}
          <TabPanel value={tabValue} index={0}>
            <List sx={{ p: 0 }}>
              {emailsData.inbox.map((email, index) => (
                <React.Fragment key={email.id}>
                  <ListItem
                    sx={{
                      bgcolor: email.isRead ? 'inherit' : 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                      cursor: 'pointer',
                    }}
                  >
                    <Checkbox
                      checked={selectedEmails.includes(email.id)}
                      onChange={() => handleSelectEmail(email.id)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getPriorityColor(email.priority) }}>
                        {email.sender.avatar}
                      </Avatar>
                    </ListItemAvatar>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={email.isRead ? 'normal' : 'bold'}
                            sx={{ flexGrow: 1 }}
                          >
                            {email.sender.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {email.time}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={email.isRead ? 'normal' : 'bold'}
                            sx={{ mb: 0.5 }}
                          >
                            {email.subject}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {email.preview}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                            {email.labels.map((label, idx) => (
                              <Chip key={idx} label={label} size="small" variant="outlined" />
                            ))}
                            {email.attachments > 0 && (
                              <Chip
                                label={`📎 ${email.attachments}`}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <IconButton size="small" color={email.isStarred ? 'warning' : 'default'}>
                        {email.isStarred ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                      <IconButton size="small">
                        <MoreIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < emailsData.inbox.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <List sx={{ p: 0 }}>
              {emailsData.sent.map((email) => (
                <ListItem key={email.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                      {email.sender.avatar}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={email.subject}
                    secondary={`发送给: ${email.subject} • ${email.time}`}
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <List sx={{ p: 0 }}>
              {emailsData.drafts.map((email) => (
                <ListItem key={email.id}>
                  <ListItemAvatar>
                    <Avatar>📝</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={email.subject}
                    secondary={`草稿 • ${email.time}`}
                  />
                  <Button variant="outlined" size="small">
                    继续编辑
                  </Button>
                </ListItem>
              ))}
            </List>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EmailsPage;