import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Button,
  Divider,
  Collapse,
  Grid,
  useTheme,
  SelectChangeEvent,
  Autocomplete,
} from '@mui/material';
import { DatePicker as MUIDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import {
  FilterListOutlined,
  ClearOutlined,
  ExpandMoreOutlined,
  ExpandLessOutlined,
  CalendarTodayOutlined,
  AccessTimeOutlined,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { ChartFilter, TimeRange } from '@/types';
import { useDashboardFilters } from '@/store';

interface DashboardFiltersProps {
  onFiltersChange?: (filters: ChartFilter[]) => void;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  className?: string;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  onFiltersChange,
  onTimeRangeChange,
  className,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { globalFilters, setGlobalFilters } = useDashboardFilters();

  // 状态管理
  const [expanded, setExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    preset: 'month',
  });
  const [filters, setFilters] = useState<ChartFilter[]>(globalFilters);
  const [tempFilter, setTempFilter] = useState<Partial<ChartFilter>>({
    field: '',
    value: '',
    operator: 'equals',
  });

  // 预设时间范围
  const timePresets = [
    { key: 'today', label: t('dashboard.today'), days: 0 },
    { key: 'week', label: t('dashboard.thisWeek'), days: 7 },
    { key: 'month', label: t('dashboard.thisMonth'), days: 30 },
    { key: 'quarter', label: t('dashboard.thisQuarter'), days: 90 },
    { key: 'year', label: t('dashboard.thisYear'), days: 365 },
    { key: 'custom', label: t('dashboard.customRange'), days: -1 },
  ];

  // 可用的筛选字段
  const filterFields = [
    { key: 'sender', label: t('dashboard.sender'), type: 'text' },
    { key: 'category', label: t('dashboard.category'), type: 'select' },
    { key: 'priority', label: t('dashboard.priority'), type: 'select' },
    { key: 'sentiment', label: t('dashboard.sentiment'), type: 'select' },
    { key: 'hasAttachments', label: t('dashboard.hasAttachments'), type: 'boolean' },
    { key: 'isRead', label: t('dashboard.isRead'), type: 'boolean' },
  ];

  // 筛选操作符
  const filterOperators = [
    { key: 'equals', label: t('dashboard.equals') },
    { key: 'contains', label: t('dashboard.contains') },
    { key: 'in', label: t('dashboard.in') },
    { key: 'range', label: t('dashboard.range') },
  ];

  // 分类选项
  const categoryOptions = [
    'Work', 'Personal', 'Marketing', 'Support', 'Newsletter', 'Notification'
  ];

  // 优先级选项
  const priorityOptions = [
    { key: 'low', label: t('priority.low') },
    { key: 'normal', label: t('priority.normal') },
    { key: 'high', label: t('priority.high') },
    { key: 'critical', label: t('priority.critical') },
  ];

  // 情感选项
  const sentimentOptions = [
    { key: 'positive', label: t('sentiment.positive') },
    { key: 'neutral', label: t('sentiment.neutral') },
    { key: 'negative', label: t('sentiment.negative') },
  ];

  // 处理时间范围预设选择
  const handleTimePresetChange = (preset: string) => {
    let newTimeRange: TimeRange;
    const now = new Date();

    switch (preset) {
      case 'today':
        newTimeRange = {
          startDate: format(now, 'yyyy-MM-dd'),
          endDate: format(now, 'yyyy-MM-dd'),
          preset: 'today',
        };
        break;
      case 'week':
        newTimeRange = {
          startDate: format(startOfWeek(now), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(now), 'yyyy-MM-dd'),
          preset: 'week',
        };
        break;
      case 'month':
        newTimeRange = {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
          preset: 'month',
        };
        break;
      case 'quarter':
        newTimeRange = {
          startDate: format(subDays(now, 90), 'yyyy-MM-dd'),
          endDate: format(now, 'yyyy-MM-dd'),
          preset: 'quarter',
        };
        break;
      case 'year':
        newTimeRange = {
          startDate: format(subDays(now, 365), 'yyyy-MM-dd'),
          endDate: format(now, 'yyyy-MM-dd'),
          preset: 'year',
        };
        break;
      default:
        return;
    }

    setTimeRange(newTimeRange);
    if (onTimeRangeChange) {
      onTimeRangeChange(newTimeRange);
    }
  };

  // 处理自定义日期变化
  const handleCustomDateChange = (field: 'startDate' | 'endDate', date: Date | null) => {
    if (!date) return;

    const newTimeRange = {
      ...timeRange,
      [field]: format(date, 'yyyy-MM-dd'),
      preset: 'custom' as const,
    };

    setTimeRange(newTimeRange);
    if (onTimeRangeChange) {
      onTimeRangeChange(newTimeRange);
    }
  };

  // 添加筛选器
  const handleAddFilter = () => {
    if (!tempFilter.field || !tempFilter.value) return;

    const newFilter: ChartFilter = {
      field: tempFilter.field,
      value: tempFilter.value,
      operator: tempFilter.operator || 'equals',
    };

    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    setGlobalFilters(updatedFilters);
    
    // 重置临时筛选器
    setTempFilter({
      field: '',
      value: '',
      operator: 'equals',
    });

    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };

  // 移除筛选器
  const handleRemoveFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    setFilters(updatedFilters);
    setGlobalFilters(updatedFilters);
    
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };

  // 清空所有筛选器
  const handleClearFilters = () => {
    setFilters([]);
    setGlobalFilters([]);
    setTempFilter({
      field: '',
      value: '',
      operator: 'equals',
    });
    
    if (onFiltersChange) {
      onFiltersChange([]);
    }
  };

  // 获取字段选项
  const getFieldOptions = (fieldKey: string) => {
    switch (fieldKey) {
      case 'category':
        return categoryOptions;
      case 'priority':
        return priorityOptions;
      case 'sentiment':
        return sentimentOptions;
      case 'hasAttachments':
      case 'isRead':
        return [
          { key: 'true', label: t('common.yes') },
          { key: 'false', label: t('common.no') },
        ];
      default:
        return [];
    }
  };

  // 渲染筛选值输入
  const renderFilterValueInput = () => {
    const selectedField = filterFields.find(f => f.key === tempFilter.field);
    if (!selectedField) return null;

    const options = getFieldOptions(selectedField.key);

    if (selectedField.type === 'select' && options.length > 0) {
      return (
        <Autocomplete
          size="small"
          options={options}
          getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
          value={options.find(opt => 
            (typeof opt === 'string' ? opt : opt.key) === tempFilter.value
          ) || null}
          onChange={(_, value) => {
            const newValue = typeof value === 'string' ? value : value?.key || '';
            setTempFilter(prev => ({ ...prev, value: newValue }));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('dashboard.filterValue')}
              variant="outlined"
            />
          )}
          sx={{ minWidth: 150 }}
        />
      );
    }

    return (
      <TextField
        size="small"
        label={t('dashboard.filterValue')}
        variant="outlined"
        value={tempFilter.value}
        onChange={(e) => setTempFilter(prev => ({ ...prev, value: e.target.value }))}
        sx={{ minWidth: 150 }}
      />
    );
  };

  // 渲染已应用的筛选器标签
  const renderAppliedFilters = () => {
    return (
      <Box display="flex" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
        {filters.map((filter, index) => {
          const fieldLabel = filterFields.find(f => f.key === filter.field)?.label || filter.field;
          const operatorLabel = filterOperators.find(o => o.key === filter.operator)?.label || filter.operator;
          
          let displayValue = filter.value;
          if (Array.isArray(filter.value)) {
            displayValue = filter.value.join(', ');
          }

          return (
            <Chip
              key={index}
              size="small"
              variant="outlined"
              color="primary"
              label={`${fieldLabel} ${operatorLabel} ${displayValue}`}
              onDelete={() => handleRemoveFilter(index)}
              icon={<FilterListOutlined />}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <Card className={className}>
      <CardContent sx={{ p: 2 }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterListOutlined color="primary" />
            <Typography variant="h6" fontWeight="bold">
              {t('dashboard.filtersAndTimeRange')}
            </Typography>
            <Chip
              size="small"
              label={`${filters.length} ${t('dashboard.filtersApplied')}`}
              color={filters.length > 0 ? 'primary' : 'default'}
              variant="outlined"
            />
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <Button
              size="small"
              startIcon={<ClearOutlined />}
              onClick={handleClearFilters}
              disabled={filters.length === 0}
            >
              {t('dashboard.clearAll')}
            </Button>
            
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <ExpandMoreOutlined />
            </IconButton>
          </Box>
        </Box>

        {/* 时间范围快速选择 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayOutlined fontSize="small" />
            {t('dashboard.timeRange')}
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {timePresets.map((preset) => (
              <Chip
                key={preset.key}
                size="small"
                label={preset.label}
                clickable
                color={timeRange.preset === preset.key ? 'primary' : 'default'}
                variant={timeRange.preset === preset.key ? 'filled' : 'outlined'}
                onClick={() => handleTimePresetChange(preset.key)}
              />
            ))}
          </Box>
        </Box>

        {/* 自定义日期范围 */}
        {timeRange.preset === 'custom' && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
            <Box display="flex" gap={2} sx={{ mb: 2 }}>
              <MUIDatePicker
                label={t('dashboard.startDate')}
                value={new Date(timeRange.startDate)}
                onChange={(date) => handleCustomDateChange('startDate', date)}
                renderInput={(params) => <TextField {...params} size="small" />}
              />
              <MUIDatePicker
                label={t('dashboard.endDate')}
                value={new Date(timeRange.endDate)}
                onChange={(date) => handleCustomDateChange('endDate', date)}
                renderInput={(params) => <TextField {...params} size="small" />}
              />
            </Box>
          </LocalizationProvider>
        )}

        {/* 高级筛选器 */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            {t('dashboard.advancedFilters')}
          </Typography>
          
          {/* 添加筛选器表单 */}
          <Grid container spacing={2} alignItems="end" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('dashboard.field')}</InputLabel>
                <Select
                  value={tempFilter.field || ''}
                  onChange={(e) => setTempFilter(prev => ({ 
                    ...prev, 
                    field: e.target.value,
                    value: '', // 重置值
                  }))}
                  label={t('dashboard.field')}
                >
                  {filterFields.map((field) => (
                    <MenuItem key={field.key} value={field.key}>
                      {field.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('dashboard.operator')}</InputLabel>
                <Select
                  value={tempFilter.operator || 'equals'}
                  onChange={(e) => setTempFilter(prev => ({ 
                    ...prev, 
                    operator: e.target.value as ChartFilter['operator']
                  }))}
                  label={t('dashboard.operator')}
                >
                  {filterOperators.map((op) => (
                    <MenuItem key={op.key} value={op.key}>
                      {op.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              {renderFilterValueInput()}
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <Button
                variant="contained"
                size="small"
                fullWidth
                onClick={handleAddFilter}
                disabled={!tempFilter.field || !tempFilter.value}
              >
                {t('dashboard.addFilter')}
              </Button>
            </Grid>
          </Grid>
        </Collapse>

        {/* 已应用的筛选器 */}
        {filters.length > 0 && renderAppliedFilters()}

        {/* 当前时间范围显示 */}
        <Box 
          display="flex" 
          alignItems="center" 
          gap={1} 
          sx={{ 
            mt: 2, 
            p: 1, 
            bgcolor: 'background.default', 
            borderRadius: 1,
          }}
        >
          <AccessTimeOutlined fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.selectedPeriod')}: 
            {format(new Date(timeRange.startDate), 'yyyy年MM月dd日', { locale: zhCN })} - 
            {format(new Date(timeRange.endDate), 'yyyy年MM月dd日', { locale: zhCN })}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DashboardFilters;