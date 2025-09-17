import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  AvatarGroup,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Tab,
  Tabs,
  Badge,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Chat as ChatIcon,
  VideoCall as VideoCallIcon,
  Share as ShareIcon,
  Comment as CommentIcon,
  ThumbUp as ThumbUpIcon,
  AttachFile as AttachFileIcon,
  Send as SendIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  More as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Notifications as NotificationIcon,
  Group as GroupIcon,
  Star as StarIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';

interface CollaborationItem {
  id: string;
  type: 'discussion' | 'task' | 'file' | 'meeting' | 'decision';
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'completed' | 'archived';
  participants: string[];
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  comments: Comment[];
}

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  parentId?: string;
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`collaboration-tabpanel-${index}`}
    aria-labelledby={`collaboration-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const TeamCollaboration: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [items, setItems] = useState<CollaborationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CollaborationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [newItemDialog, setNewItemDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CollaborationItem | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [newItem, setNewItem] = useState({
    type: 'discussion' as const,
    title: '',
    content: '',
    priority: 'medium' as const,
    tags: [] as string[],
  });

  const [newComment, setNewComment] = useState('');

  // 模拟数据生成
  const generateMockData = (): CollaborationItem[] => [
    {
      id: '1',
      type: 'discussion',
      title: '新功能开发讨论',
      content: '我们需要讨论下一版本的新功能开发计划，包括用户体验优化和性能提升。',
      author: { id: '1', name: '张三', avatar: '' },
      createdAt: new Date('2024-12-10'),
      updatedAt: new Date('2024-12-15'),
      teamId: 'team-1',
      tags: ['开发', '规划', '用户体验'],
      priority: 'high',
      status: 'active',
      participants: ['1', '2', '3'],
      attachments: [],
      reactions: [
        { emoji: '👍', count: 5, users: ['1', '2', '3', '4', '5'] },
        { emoji: '💡', count: 2, users: ['6', '7'] },
      ],
      comments: [
        {
          id: 'c1',
          content: '我觉得应该优先考虑移动端的用户体验',
          author: { id: '2', name: '李四', avatar: '' },
          createdAt: new Date('2024-12-12'),
          reactions: [{ emoji: '👍', count: 3, users: ['1', '3', '4'] }],
        },
      ],
    },
    {
      id: '2',
      type: 'task',
      title: 'API文档更新',
      content: '需要更新所有新增接口的API文档，确保开发团队能够正确使用。',
      author: { id: '2', name: '李四', avatar: '' },
      createdAt: new Date('2024-12-08'),
      updatedAt: new Date('2024-12-14'),
      teamId: 'team-1',
      tags: ['文档', 'API', '开发'],
      priority: 'medium',
      status: 'active',
      participants: ['2', '4'],
      attachments: [
        {
          id: 'a1',
          name: 'API_Documentation_v2.1.pdf',
          type: 'application/pdf',
          size: 2048576,
          url: '/files/api-doc.pdf',
        },
      ],
      reactions: [{ emoji: '✅', count: 1, users: ['4'] }],
      comments: [],
    },
    {
      id: '3',
      type: 'meeting',
      title: '周例会 - 项目进度同步',
      content: '每周例会，同步项目进度和讨论遇到的问题。',
      author: { id: '1', name: '张三', avatar: '' },
      createdAt: new Date('2024-12-09'),
      updatedAt: new Date('2024-12-13'),
      teamId: 'team-1',
      tags: ['会议', '进度', '同步'],
      priority: 'medium',
      status: 'completed',
      participants: ['1', '2', '3', '4', '5'],
      attachments: [],
      reactions: [],
      comments: [
        {
          id: 'c2',
          content: '会议记录已更新到共享文档',
          author: { id: '3', name: '王五', avatar: '' },
          createdAt: new Date('2024-12-13'),
          reactions: [],
        },
      ],
    },
  ];

  useEffect(() => {
    setLoading(true);
    // 模拟API调用
    setTimeout(() => {
      const mockData = generateMockData();
      setItems(mockData);
      setFilteredItems(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  // 搜索和过滤
  useEffect(() => {
    let filtered = items;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, filterType]);

  const handleCreateItem = () => {
    const newCollaborationItem: CollaborationItem = {
      id: Date.now().toString(),
      ...newItem,
      author: { id: 'current-user', name: '当前用户', avatar: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
      teamId: 'team-1',
      status: 'active',
      participants: ['current-user'],
      attachments: [],
      reactions: [],
      comments: [],
    };

    setItems(prev => [newCollaborationItem, ...prev]);
    setNewItemDialog(false);
    setNewItem({
      type: 'discussion',
      title: '',
      content: '',
      priority: 'medium',
      tags: [],
    });
  };

  const handleAddComment = (itemId: string) => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      content: newComment,
      author: { id: 'current-user', name: '当前用户', avatar: '' },
      createdAt: new Date(),
      reactions: [],
    };

    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, comments: [...item.comments, comment] }
        : item
    ));

    setNewComment('');
  };

  const handleReaction = (itemId: string, emoji: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      const existingReaction = item.reactions.find(r => r.emoji === emoji);
      if (existingReaction) {
        if (existingReaction.users.includes('current-user')) {
          // 移除反应
          return {
            ...item,
            reactions: item.reactions.map(r =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: Math.max(0, r.count - 1),
                    users: r.users.filter(u => u !== 'current-user'),
                  }
                : r
            ).filter(r => r.count > 0),
          };
        } else {
          // 添加反应
          return {
            ...item,
            reactions: item.reactions.map(r =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.count + 1,
                    users: [...r.users, 'current-user'],
                  }
                : r
            ),
          };
        }
      } else {
        // 新反应
        return {
          ...item,
          reactions: [
            ...item.reactions,
            { emoji, count: 1, users: ['current-user'] },
          ],
        };
      }
    }));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'discussion':
        return <ChatIcon />;
      case 'task':
        return <AssignmentIcon />;
      case 'file':
        return <AttachFileIcon />;
      case 'meeting':
        return <VideoCallIcon />;
      case 'decision':
        return <FlagIcon />;
      default:
        return <ChatIcon />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discussion':
        return 'primary';
      case 'task':
        return 'success';
      case 'file':
        return 'info';
      case 'meeting':
        return 'warning';
      case 'decision':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const renderCollaborationItem = (item: CollaborationItem) => (
    <Card key={item.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar src={item.author.avatar}>
              {item.author.name.charAt(0)}
            </Avatar>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  icon={getTypeIcon(item.type)}
                  label={t(`collaboration.type.${item.type}`)}
                  color={getTypeColor(item.type) as any}
                  size="small"
                />
                <Chip
                  label={t(`collaboration.priority.${item.priority}`)}
                  color={getPriorityColor(item.priority) as any}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Typography variant="h6" gutterBottom>
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.author.name} • {item.createdAt.toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              setAnchorEl(e.currentTarget);
              setSelectedItem(item);
            }}
          >
            <MoreIcon />
          </IconButton>
        </Box>

        <Typography variant="body1" sx={{ mb: 2 }}>
          {item.content}
        </Typography>

        {/* 标签 */}
        {item.tags.length > 0 && (
          <Box display="flex" gap={1} mb={2}>
            {item.tags.map((tag, index) => (
              <Chip key={index} label={tag} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        {/* 附件 */}
        {item.attachments.length > 0 && (
          <Box mb={2}>
            {item.attachments.map((attachment) => (
              <Chip
                key={attachment.id}
                icon={<AttachFileIcon />}
                label={attachment.name}
                variant="outlined"
                clickable
                sx={{ mr: 1 }}
              />
            ))}
          </Box>
        )}

        {/* 参与者 */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24 } }}>
              {item.participants.map((participantId) => (
                <Avatar key={participantId} sx={{ width: 24, height: 24 }}>
                  {participantId}
                </Avatar>
              ))}
            </AvatarGroup>
            <Typography variant="caption" color="text.secondary">
              {item.participants.length} {t('collaboration.participants')}
            </Typography>
          </Box>
        </Box>

        {/* 反应和评论 */}
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            {item.reactions.map((reaction) => (
              <Chip
                key={reaction.emoji}
                label={`${reaction.emoji} ${reaction.count}`}
                size="small"
                variant="outlined"
                clickable
                onClick={() => handleReaction(item.id, reaction.emoji)}
              />
            ))}
            <Button
              size="small"
              startIcon={<ThumbUpIcon />}
              onClick={() => handleReaction(item.id, '👍')}
            >
              {t('collaboration.react')}
            </Button>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Button
              size="small"
              startIcon={<CommentIcon />}
              onClick={() => setSelectedItem(item)}
            >
              {item.comments.length} {t('collaboration.comments')}
            </Button>
            <Button size="small" startIcon={<ShareIcon />}>
              {t('collaboration.share')}
            </Button>
          </Box>
        </Box>

        {/* 评论区域 */}
        {item.comments.length > 0 && (
          <Box mt={2} pt={2} borderTop={1} borderColor="divider">
            {item.comments.map((comment) => (
              <Box key={comment.id} display="flex" gap={2} mb={2}>
                <Avatar src={comment.author.avatar} sx={{ width: 32, height: 32 }}>
                  {comment.author.name.charAt(0)}
                </Avatar>
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="subtitle2">
                      {comment.author.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {comment.createdAt.toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" mb={1}>
                    {comment.content}
                  </Typography>
                  {comment.reactions.length > 0 && (
                    <Box display="flex" gap={1}>
                      {comment.reactions.map((reaction) => (
                        <Chip
                          key={reaction.emoji}
                          label={`${reaction.emoji} ${reaction.count}`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* 新评论输入 */}
        <Box mt={2} pt={2} borderTop={1} borderColor="divider">
          <TextField
            fullWidth
            placeholder={t('collaboration.addComment')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            multiline
            rows={2}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => handleAddComment(item.id)}
                    disabled={!newComment.trim()}
                  >
                    <SendIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {t('collaboration.teamCollaboration')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<ChatIcon />}
          onClick={() => setNewItemDialog(true)}
        >
          {t('collaboration.newItem')}
        </Button>
      </Box>

      {/* 搜索和过滤 */}
      <Box display="flex" gap={2} mb={3}>
        <TextField
          placeholder={t('collaboration.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>{t('collaboration.filterByType')}</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            startAdornment={<FilterIcon sx={{ mr: 1 }} />}
          >
            <MenuItem value="all">{t('collaboration.allTypes')}</MenuItem>
            <MenuItem value="discussion">{t('collaboration.type.discussion')}</MenuItem>
            <MenuItem value="task">{t('collaboration.type.task')}</MenuItem>
            <MenuItem value="file">{t('collaboration.type.file')}</MenuItem>
            <MenuItem value="meeting">{t('collaboration.type.meeting')}</MenuItem>
            <MenuItem value="decision">{t('collaboration.type.decision')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 协作内容列表 */}
      <Box>
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchQuery || filterType !== 'all'
                  ? t('collaboration.noResultsFound')
                  : t('collaboration.noItemsYet')
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchQuery || filterType !== 'all'
                  ? t('collaboration.tryDifferentSearch')
                  : t('collaboration.startCollaborating')
                }
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map(renderCollaborationItem)
        )}
      </Box>

      {/* 创建新项目对话框 */}
      <Dialog open={newItemDialog} onClose={() => setNewItemDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('collaboration.createNewItem')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('collaboration.type.title')}</InputLabel>
            <Select
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value as any })}
            >
              <MenuItem value="discussion">{t('collaboration.type.discussion')}</MenuItem>
              <MenuItem value="task">{t('collaboration.type.task')}</MenuItem>
              <MenuItem value="meeting">{t('collaboration.type.meeting')}</MenuItem>
              <MenuItem value="decision">{t('collaboration.type.decision')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={t('collaboration.title')}
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('collaboration.content')}
            value={newItem.content}
            onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
            multiline
            rows={4}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('collaboration.priority.title')}</InputLabel>
            <Select
              value={newItem.priority}
              onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as any })}
            >
              <MenuItem value="low">{t('collaboration.priority.low')}</MenuItem>
              <MenuItem value="medium">{t('collaboration.priority.medium')}</MenuItem>
              <MenuItem value="high">{t('collaboration.priority.high')}</MenuItem>
              <MenuItem value="urgent">{t('collaboration.priority.urgent')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewItemDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateItem} variant="contained">
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 更多操作菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>
          <EditIcon sx={{ mr: 1 }} />
          {t('common.edit')}
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <StarIcon sx={{ mr: 1 }} />
          {t('collaboration.star')}
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <NotificationIcon sx={{ mr: 1 }} />
          {t('collaboration.subscribe')}
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ShareIcon sx={{ mr: 1 }} />
          {t('collaboration.share')}
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          {t('common.delete')}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TeamCollaboration;