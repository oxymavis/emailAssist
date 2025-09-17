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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  FilterList as FilterIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

interface FilterRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  priority: number;
}

interface FilterCondition {
  field: 'sender' | 'subject' | 'content' | 'importance';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  value: string;
}

interface FilterAction {
  type: 'move' | 'label' | 'forward' | 'delete' | 'markAsRead';
  value?: string;
}

const FiltersPage: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);

  // 模拟过滤规则数据
  const [filterRules, setFilterRules] = useState<FilterRule[]>([
    {
      id: '1',
      name: '重要邮件自动标记',
      description: '包含"紧急"或"重要"关键词的邮件自动标记为高优先级',
      isActive: true,
      conditions: [
        { field: 'subject', operator: 'contains', value: '紧急' },
        { field: 'content', operator: 'contains', value: '重要' },
      ],
      actions: [
        { type: 'label', value: '重要' },
        { type: 'markAsRead' },
      ],
      priority: 1,
    },
    {
      id: '2',
      name: '会议邮件分类',
      description: '自动识别并分类会议相关邮件',
      isActive: true,
      conditions: [
        { field: 'subject', operator: 'contains', value: '会议' },
        { field: 'content', operator: 'contains', value: '议程' },
      ],
      actions: [
        { type: 'label', value: '会议' },
        { type: 'move', value: '会议文件夹' },
      ],
      priority: 2,
    },
    {
      id: '3',
      name: '垃圾邮件过滤',
      description: '自动删除垃圾邮件和推广邮件',
      isActive: true,
      conditions: [
        { field: 'sender', operator: 'contains', value: 'noreply' },
        { field: 'subject', operator: 'contains', value: '推广' },
      ],
      actions: [
        { type: 'delete' },
      ],
      priority: 3,
    },
    {
      id: '4',
      name: '客户邮件转发',
      description: '来自重要客户的邮件自动转发给团队',
      isActive: false,
      conditions: [
        { field: 'sender', operator: 'contains', value: '@importantclient.com' },
      ],
      actions: [
        { type: 'forward', value: 'team@company.com' },
        { type: 'label', value: '客户' },
      ],
      priority: 4,
    },
  ]);

  const [newRule, setNewRule] = useState<Partial<FilterRule>>({
    name: '',
    description: '',
    isActive: true,
    conditions: [{ field: 'subject', operator: 'contains', value: '' }],
    actions: [{ type: 'label', value: '' }],
    priority: filterRules.length + 1,
  });

  const handleToggleRule = (ruleId: string) => {
    setFilterRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
      )
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const handleSaveRule = () => {
    if (editingRule) {
      setFilterRules(prev =>
        prev.map(rule => rule.id === editingRule.id ? editingRule : rule)
      );
    } else {
      const rule: FilterRule = {
        ...newRule as FilterRule,
        id: Date.now().toString(),
      };
      setFilterRules(prev => [...prev, rule]);
    }
    setOpen(false);
    setEditingRule(null);
    setNewRule({
      name: '',
      description: '',
      isActive: true,
      conditions: [{ field: 'subject', operator: 'contains', value: '' }],
      actions: [{ type: 'label', value: '' }],
      priority: filterRules.length + 1,
    });
  };

  const getConditionLabel = (condition: FilterCondition) => {
    const fieldLabels = {
      sender: '发件人',
      subject: '主题',
      content: '内容',
      importance: '重要性',
    };
    const operatorLabels = {
      contains: '包含',
      equals: '等于',
      startsWith: '开始于',
      endsWith: '结束于',
    };
    return `${fieldLabels[condition.field]} ${operatorLabels[condition.operator]} "${condition.value}"`;
  };

  const getActionLabel = (action: FilterAction) => {
    const actionLabels = {
      move: '移动到',
      label: '添加标签',
      forward: '转发到',
      delete: '删除',
      markAsRead: '标记为已读',
    };
    return action.value ? `${actionLabels[action.type]} "${action.value}"` : actionLabels[action.type];
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          🔍 过滤规则
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          创建规则
        </Button>
      </Box>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {filterRules.length}
              </Typography>
              <Typography color="textSecondary">
                总规则数
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {filterRules.filter(r => r.isActive).length}
              </Typography>
              <Typography color="textSecondary">
                活跃规则
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                856
              </Typography>
              <Typography color="textSecondary">
                本月处理邮件
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                92%
              </Typography>
              <Typography color="textSecondary">
                准确率
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 过滤规则列表 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 过滤规则列表
          </Typography>

          <List>
            {filterRules.map((rule, index) => (
              <React.Fragment key={rule.id}>
                <ListItem>
                  <Box sx={{ width: '100%' }}>
                    {/* 规则标题行 */}
                    <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {rule.name}
                        </Typography>
                        <Chip
                          label={rule.isActive ? '启用' : '禁用'}
                          color={rule.isActive ? 'success' : 'default'}
                          size="small"
                        />
                        <Chip
                          label={`优先级 ${rule.priority}`}
                          variant="outlined"
                          size="small"
                        />
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={rule.isActive}
                              onChange={() => handleToggleRule(rule.id)}
                              size="small"
                            />
                          }
                          label=""
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingRule(rule);
                            setOpen(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* 规则描述 */}
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {rule.description}
                    </Typography>

                    {/* 条件和动作 */}
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          🎯 触发条件:
                        </Typography>
                        {rule.conditions.map((condition, idx) => (
                          <Chip
                            key={idx}
                            label={getConditionLabel(condition)}
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          ⚡ 执行动作:
                        </Typography>
                        {rule.actions.map((action, idx) => (
                          <Chip
                            key={idx}
                            label={getActionLabel(action)}
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>
                    </Grid>
                  </Box>
                </ListItem>
                {index < filterRules.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* 创建/编辑规则对话框 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRule ? '编辑过滤规则' : '创建新的过滤规则'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="规则名称"
                  value={editingRule?.name || newRule.name}
                  onChange={(e) => {
                    if (editingRule) {
                      setEditingRule({ ...editingRule, name: e.target.value });
                    } else {
                      setNewRule({ ...newRule, name: e.target.value });
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="规则描述"
                  multiline
                  rows={2}
                  value={editingRule?.description || newRule.description}
                  onChange={(e) => {
                    if (editingRule) {
                      setEditingRule({ ...editingRule, description: e.target.value });
                    } else {
                      setNewRule({ ...newRule, description: e.target.value });
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  触发条件
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>字段</InputLabel>
                        <Select value="subject" label="字段">
                          <MenuItem value="sender">发件人</MenuItem>
                          <MenuItem value="subject">主题</MenuItem>
                          <MenuItem value="content">内容</MenuItem>
                          <MenuItem value="importance">重要性</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>条件</InputLabel>
                        <Select value="contains" label="条件">
                          <MenuItem value="contains">包含</MenuItem>
                          <MenuItem value="equals">等于</MenuItem>
                          <MenuItem value="startsWith">开始于</MenuItem>
                          <MenuItem value="endsWith">结束于</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="值"
                        placeholder="输入匹配值"
                      />
                    </Grid>
                    <Grid item xs={2}>
                      <Button variant="outlined" size="small">
                        添加条件
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  执行动作
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>动作类型</InputLabel>
                        <Select value="label" label="动作类型">
                          <MenuItem value="move">移动到文件夹</MenuItem>
                          <MenuItem value="label">添加标签</MenuItem>
                          <MenuItem value="forward">转发邮件</MenuItem>
                          <MenuItem value="delete">删除邮件</MenuItem>
                          <MenuItem value="markAsRead">标记为已读</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="动作值"
                        placeholder="输入动作参数"
                      />
                    </Grid>
                    <Grid item xs={2}>
                      <Button variant="outlined" size="small">
                        添加动作
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} startIcon={<CancelIcon />}>
            取消
          </Button>
          <Button onClick={handleSaveRule} variant="contained" startIcon={<SaveIcon />}>
            保存规则
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FiltersPage;