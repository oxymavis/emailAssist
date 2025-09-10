import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Switch,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  DragIndicator as DragIndicatorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { LoadingState, SkeletonTable } from '@/components/common/Loading';
import { useFilterRules, useNotifications } from '@/store';
import { mockDataService } from '@/services/mockData';
import { FilterRule, FilterCondition, FilterAction } from '@/types';

// 过滤条件组件
interface ConditionEditorProps {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  showLogicalOperator?: boolean;
}

const ConditionEditor: React.FC<ConditionEditorProps> = ({
  condition,
  onChange,
  onRemove,
  showLogicalOperator = false,
}) => {
  const { t } = useTranslation();
  
  const fieldOptions = [
    { value: 'sender', label: t('filters.fields.sender') },
    { value: 'subject', label: t('filters.fields.subject') },
    { value: 'content', label: t('filters.fields.content') },
    { value: 'importance', label: t('filters.fields.importance') },
    { value: 'hasAttachments', label: t('filters.fields.hasAttachments') },
  ];

  const operatorOptions = [
    { value: 'equals', label: t('filters.operators.equals') },
    { value: 'contains', label: t('filters.operators.contains') },
    { value: 'startsWith', label: t('filters.operators.startsWith') },
    { value: 'endsWith', label: t('filters.operators.endsWith') },
    { value: 'matches', label: t('filters.operators.matches') },
  ];

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        {showLogicalOperator && (
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('filters.logicalOperator')}</InputLabel>
              <Select
                value={condition.logicalOperator || 'AND'}
                label={t('filters.logicalOperator')}
                onChange={(e) => onChange({ ...condition, logicalOperator: e.target.value as 'AND' | 'OR' })}
              >
                <MenuItem value="AND">AND</MenuItem>
                <MenuItem value="OR">OR</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )}
        
        <Grid item xs={12} md={showLogicalOperator ? 3 : 4}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('filters.field')}</InputLabel>
            <Select
              value={condition.field}
              label={t('filters.field')}
              onChange={(e) => onChange({ ...condition, field: e.target.value as FilterCondition['field'] })}
            >
              {fieldOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={showLogicalOperator ? 3 : 3}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('filters.operator')}</InputLabel>
            <Select
              value={condition.operator}
              label={t('filters.operator')}
              onChange={(e) => onChange({ ...condition, operator: e.target.value as FilterCondition['operator'] })}
            >
              {operatorOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={showLogicalOperator ? 3 : 4}>
          <TextField
            fullWidth
            size="small"
            label={t('filters.value')}
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder={t('filters.valuePlaceholder')}
          />
        </Grid>

        <Grid item xs={12} md={1}>
          <IconButton onClick={onRemove} color="error" size="small">
            <DeleteIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Card>
  );
};

// 动作编辑组件
interface ActionEditorProps {
  action: FilterAction;
  onChange: (action: FilterAction) => void;
  onRemove: () => void;
}

const ActionEditor: React.FC<ActionEditorProps> = ({ action, onChange, onRemove }) => {
  const { t } = useTranslation();
  
  const actionOptions = [
    { value: 'move', label: t('filters.actions.move'), hasValue: true },
    { value: 'label', label: t('filters.actions.label'), hasValue: true },
    { value: 'forward', label: t('filters.actions.forward'), hasValue: true },
    { value: 'delete', label: t('filters.actions.delete'), hasValue: false },
    { value: 'markAsRead', label: t('filters.actions.markAsRead'), hasValue: false },
    { value: 'markAsImportant', label: t('filters.actions.markAsImportant'), hasValue: false },
  ];

  const selectedAction = actionOptions.find(opt => opt.value === action.type);

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={5}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('filters.actionType')}</InputLabel>
            <Select
              value={action.type}
              label={t('filters.actionType')}
              onChange={(e) => onChange({ ...action, type: e.target.value as FilterAction['type'] })}
            >
              {actionOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label={t('filters.parameter')}
            value={action.value || ''}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
            disabled={!selectedAction?.hasValue}
            placeholder={selectedAction?.hasValue ? t('filters.parameterPlaceholder') : t('filters.noParameterNeeded')}
          />
        </Grid>

        <Grid item xs={12} md={1}>
          <IconButton onClick={onRemove} color="error" size="small">
            <DeleteIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Card>
  );
};

// 规则编辑对话框
interface RuleEditorDialogProps {
  open: boolean;
  onClose: () => void;
  rule: FilterRule | null;
  onSave: (rule: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const RuleEditorDialog: React.FC<RuleEditorDialogProps> = ({
  open,
  onClose,
  rule,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    conditions: FilterCondition[];
    actions: FilterAction[];
    isActive: boolean;
    priority: number;
  }>({
    name: '',
    description: '',
    conditions: [{ field: 'subject', operator: 'contains', value: '' }],
    actions: [{ type: 'label', value: '' }],
    isActive: true,
    priority: 1,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description,
        conditions: rule.conditions,
        actions: rule.actions,
        isActive: rule.isActive,
        priority: rule.priority,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        conditions: [{ field: 'subject', operator: 'contains', value: '' }],
        actions: [{ type: 'label', value: '' }],
        isActive: true,
        priority: 1,
      });
    }
    setErrors({});
  }, [rule, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('filters.validation.nameRequired');
    }

    if (formData.conditions.length === 0) {
      newErrors.conditions = t('filters.validation.conditionsRequired');
    }

    if (formData.actions.length === 0) {
      newErrors.actions = t('filters.validation.actionsRequired');
    }

    formData.conditions.forEach((condition, index) => {
      if (!condition.value.trim()) {
        newErrors[`condition-${index}`] = t('filters.validation.conditionValueRequired');
      }
    });

    formData.actions.forEach((action, index) => {
      const actionOptions = [
        { value: 'move', hasValue: true },
        { value: 'label', hasValue: true },
        { value: 'forward', hasValue: true },
        { value: 'delete', hasValue: false },
        { value: 'markAsRead', hasValue: false },
        { value: 'markAsImportant', hasValue: false },
      ];
      
      const actionDef = actionOptions.find(opt => opt.value === action.type);
      if (actionDef?.hasValue && !action.value?.trim()) {
        newErrors[`action-${index}`] = t('filters.validation.actionValueRequired');
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: 'subject', operator: 'contains', value: '' }],
    });
  };

  const updateCondition = (index: number, condition: FilterCondition) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = condition;
    setFormData({ ...formData, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    if (formData.conditions.length > 1) {
      const newConditions = formData.conditions.filter((_, i) => i !== index);
      setFormData({ ...formData, conditions: newConditions });
    }
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'label', value: '' }],
    });
  };

  const updateAction = (index: number, action: FilterAction) => {
    const newActions = [...formData.actions];
    newActions[index] = action;
    setFormData({ ...formData, actions: newActions });
  };

  const removeAction = (index: number) => {
    if (formData.actions.length > 1) {
      const newActions = formData.actions.filter((_, i) => i !== index);
      setFormData({ ...formData, actions: newActions });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {rule ? t('filters.editRule') : t('filters.createRule')}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label={t('filters.ruleName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!errors.name}
                helperText={errors.name}
                placeholder={t('filters.ruleNamePlaceholder')}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label={t('filters.priority')}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1, max: 100 }}
                helperText={t('filters.priorityHelper')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('filters.ruleDescription')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('filters.ruleDescriptionPlaceholder')}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{t('filters.conditions')}</Typography>
            <Button startIcon={<AddIcon />} onClick={addCondition}>
              {t('filters.addCondition')}
            </Button>
          </Box>
          {errors.conditions && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.conditions}
            </Alert>
          )}
          {formData.conditions.map((condition, index) => (
            <ConditionEditor
              key={index}
              condition={condition}
              onChange={(newCondition) => updateCondition(index, newCondition)}
              onRemove={() => removeCondition(index)}
              showLogicalOperator={index > 0}
            />
          ))}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{t('filters.actions')}</Typography>
            <Button startIcon={<AddIcon />} onClick={addAction}>
              {t('filters.addAction')}
            </Button>
          </Box>
          {errors.actions && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.actions}
            </Alert>
          )}
          {formData.actions.map((action, index) => (
            <ActionEditor
              key={index}
              action={action}
              onChange={(newAction) => updateAction(index, newAction)}
              onRemove={() => removeAction(index)}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button variant="contained" onClick={handleSave}>
          {t('filters.saveRule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Filters: React.FC = () => {
  const { t } = useTranslation();
  const { filterRules, setFilterRules, addFilterRule, updateFilterRule, deleteFilterRule } = useFilterRules();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<FilterRule | null>(null);

  // 初始化数据
  useEffect(() => {
    const initializeFilters = async () => {
      try {
        setLoading(true);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockRules = mockDataService.getFilterRules();
        setFilterRules(mockRules);
        
        addNotification({
          type: 'success',
          title: t('filters.rulesLoaded'),
          message: t('filters.rulesLoadedMessage', { count: mockRules.length }),
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: t('common.error'),
          message: t('filters.loadError'),
        });
      } finally {
        setLoading(false);
      }
    };

    initializeFilters();
  }, [setFilterRules, addNotification]);

  // 创建新规则
  const handleCreateRule = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  // 编辑规则
  const handleEditRule = (rule: FilterRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  // 保存规则
  const handleSaveRule = (ruleData: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    
    if (editingRule) {
      // 更新现有规则
      updateFilterRule(editingRule.id, {
        ...ruleData,
        updatedAt: now,
      });
      addNotification({
        type: 'success',
        title: t('filters.ruleUpdated'),
        message: t('filters.ruleUpdatedMessage', { name: ruleData.name }),
      });
    } else {
      // 创建新规则
      const newRule: FilterRule = {
        ...ruleData,
        id: `rule-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      addFilterRule(newRule);
      addNotification({
        type: 'success',
        title: t('filters.ruleCreated'),
        message: t('filters.ruleCreatedMessage', { name: ruleData.name }),
      });
    }
  };

  // 切换规则状态
  const handleToggleRule = (rule: FilterRule) => {
    updateFilterRule(rule.id, { isActive: !rule.isActive });
    addNotification({
      type: 'info',
      title: rule.isActive ? t('filters.ruleDisabled') : t('filters.ruleEnabled'),
      message: t('filters.ruleStatusMessage', { name: rule.name, status: rule.isActive ? t('filters.disabled') : t('filters.enabled') }),
    });
  };

  // 删除规则
  const handleDeleteRule = (rule: FilterRule) => {
    deleteFilterRule(rule.id);
    setDeleteConfirmOpen(null);
    addNotification({
      type: 'success',
      title: t('filters.ruleDeleted'),
      message: t('filters.ruleDeletedMessage', { name: rule.name }),
    });
  };

  // 测试规则
  const handleTestRule = (rule: FilterRule) => {
    // 模拟测试结果
    const matchedCount = Math.floor(Math.random() * 10) + 1;
    addNotification({
      type: 'info',
      title: t('filters.testCompleted'),
      message: t('filters.testResult', { name: rule.name, count: matchedCount }),
    });
  };

  const activeRulesCount = filterRules.filter(rule => rule.isActive).length;

  return (
    <Box>
      {/* 页面标题和操作 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {t('filters.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('filters.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRule}
        >
          {t('filters.createRule')}
        </Button>
      </Box>

      <LoadingState
        loading={loading}
        skeleton={<SkeletonTable rows={5} />}
      >
        {/* 统计信息 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <FilterListIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {filterRules.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('filters.totalRules')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {activeRulesCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('filters.activeRules')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  {filterRules.length - activeRulesCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('filters.inactiveRules')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PlayArrowIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  247
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('filters.todayProcessed')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 规则列表 */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell>{t('filters.ruleName')}</TableCell>
                    <TableCell>{t('common.description')}</TableCell>
                    <TableCell>{t('filters.priority')}</TableCell>
                    <TableCell>{t('common.createdTime')}</TableCell>
                    <TableCell align="center">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filterRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          {t('filters.noRules')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filterRules.map((rule) => (
                      <TableRow key={rule.id} hover>
                        <TableCell>
                          <Switch
                            checked={rule.isActive}
                            onChange={() => handleToggleRule(rule)}
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <DragIndicatorIcon color="disabled" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight="bold">
                              {rule.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {rule.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t('filters.priorityValue', { priority: rule.priority })}
                            size="small"
                            color={rule.priority <= 3 ? 'error' : rule.priority <= 6 ? 'warning' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(rule.createdAt), 'yyyy-MM-dd', { locale: zhCN })}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title={t('filters.testRule')}>
                              <IconButton
                                size="small"
                                onClick={() => handleTestRule(rule)}
                                color="info"
                              >
                                <PlayArrowIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('filters.viewDetails')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEditRule(rule)}
                                color="primary"
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('actions.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEditRule(rule)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('actions.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => setDeleteConfirmOpen(rule)}
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
          </CardContent>
        </Card>

        {/* 规则详情展示（折叠面板） */}
        {filterRules.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('filters.ruleDetails')}
              </Typography>
              {filterRules.slice(0, 3).map((rule) => (
                <Accordion key={rule.id}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      <Chip
                        label={rule.isActive ? t('filters.enabled') : t('filters.disabled')}
                        size="small"
                        color={rule.isActive ? 'success' : 'default'}
                      />
                      <Typography variant="subtitle1" fontWeight="bold">
                        {rule.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                        {t('filters.conditionsAndActions', { conditions: rule.conditions.length, actions: rule.actions.length })}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('filters.conditions')}
                        </Typography>
                        {rule.conditions.map((condition, index) => (
                          <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="body2">
                              {index > 0 && `${condition.logicalOperator || 'AND'} `}
                              <strong>{condition.field}</strong> {condition.operator} "{condition.value}"
                            </Typography>
                          </Box>
                        ))}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('filters.actions')}
                        </Typography>
                        {rule.actions.map((action, index) => (
                          <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="body2">
                              <strong>{action.type}</strong>
                              {action.value && ` → "${action.value}"`}
                            </Typography>
                          </Box>
                        ))}
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 规则编辑对话框 */}
        <RuleEditorDialog
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          rule={editingRule}
          onSave={handleSaveRule}
        />

        {/* 删除确认对话框 */}
        <Dialog
          open={Boolean(deleteConfirmOpen)}
          onClose={() => setDeleteConfirmOpen(null)}
        >
          <DialogTitle>{t('filters.confirmDelete')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('filters.confirmDeleteMessage', { name: deleteConfirmOpen?.name })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(null)}>{t('actions.cancel')}</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => deleteConfirmOpen && handleDeleteRule(deleteConfirmOpen)}
            >
              {t('actions.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </LoadingState>
    </Box>
  );
};

export default Filters;