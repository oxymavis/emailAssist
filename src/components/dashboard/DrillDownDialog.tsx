import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  Breadcrumbs,
  Link,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  useTheme,
  alpha,
  LinearProgress,
} from '@mui/material';
import {
  CloseOutlined,
  ArrowBackOutlined,
  DrillDownOutlined,
  FilterListOutlined,
  TableViewOutlined,
  BarChartOutlined,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { DrillDownConfig, DrillDownLevel, ChartFilter } from '@/types';
import { useDrillDown } from '@/store';

interface DrillDownDialogProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  title?: string;
}

const DrillDownDialog: React.FC<DrillDownDialogProps> = ({
  open,
  onClose,
  initialData,
  title = 'Data Analysis',
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { drillDownConfig, setDrillDownConfig, updateDrillDownConfig } = useDrillDown();

  // 状态管理
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [loading, setLoading] = useState(false);
  const [drillData, setDrillData] = useState<any[]>([]);

  // 钻取层级定义
  const drillLevels: DrillDownLevel[] = [
    {
      field: 'date',
      label: t('dashboard.byDate'),
      chartType: 'bar',
    },
    {
      field: 'sender',
      label: t('dashboard.bySender'),
      chartType: 'pie',
    },
    {
      field: 'category',
      label: t('dashboard.byCategory'),
      chartType: 'bar',
    },
    {
      field: 'priority',
      label: t('dashboard.byPriority'),
      chartType: 'pie',
    },
    {
      field: 'sentiment',
      label: t('dashboard.bySentiment'),
      chartType: 'pie',
    },
  ];

  // 初始化钻取配置
  useEffect(() => {
    if (open && initialData) {
      const config: DrillDownConfig = {
        enabled: true,
        levels: drillLevels,
        currentLevel: 0,
        breadcrumbs: [title],
      };
      setDrillDownConfig(config);
      loadDrillData(0, []);
    }
  }, [open, initialData, title]);

  // 模拟加载钻取数据
  const loadDrillData = async (level: number, filters: ChartFilter[]) => {
    setLoading(true);
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 根据当前层级生成模拟数据
    let mockData: any[] = [];
    const currentLevel = drillLevels[level];
    
    switch (currentLevel.field) {
      case 'date':
        mockData = generateDateData(filters);
        break;
      case 'sender':
        mockData = generateSenderData(filters);
        break;
      case 'category':
        mockData = generateCategoryData(filters);
        break;
      case 'priority':
        mockData = generatePriorityData(filters);
        break;
      case 'sentiment':
        mockData = generateSentimentData(filters);
        break;
    }

    setDrillData(mockData);
    setLoading(false);
  };

  // 生成不同类型的模拟数据
  const generateDateData = (filters: ChartFilter[]) => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        name: date.toLocaleDateString(),
        value: Math.floor(Math.random() * 50) + 10,
        details: {
          processed: Math.floor(Math.random() * 30) + 5,
          pending: Math.floor(Math.random() * 20) + 2,
        },
      };
    }).reverse();
  };

  const generateSenderData = (filters: ChartFilter[]) => {
    const senders = [
      'john@company.com', 'mary@company.com', 'support@service.com',
      'noreply@newsletter.com', 'admin@system.com', 'team@project.com'
    ];
    return senders.map((sender, i) => ({
      name: sender.split('@')[0],
      value: Math.floor(Math.random() * 30) + 5,
      email: sender,
      color: `hsl(${i * 60}, 70%, 50%)`,
      details: {
        avgResponseTime: Math.random() * 4 + 1,
        sentimentScore: Math.random() * 0.6 + 0.2,
      },
    }));
  };

  const generateCategoryData = (filters: ChartFilter[]) => {
    const categories = ['Work', 'Personal', 'Marketing', 'Support', 'Newsletter'];
    return categories.map((category, i) => ({
      name: category,
      value: Math.floor(Math.random() * 40) + 10,
      color: `hsl(${i * 72}, 60%, 50%)`,
      details: {
        urgentCount: Math.floor(Math.random() * 5),
        avgProcessingTime: Math.random() * 2 + 0.5,
      },
    }));
  };

  const generatePriorityData = (filters: ChartFilter[]) => {
    const priorities = [
      { key: 'critical', color: theme.palette.error.main },
      { key: 'high', color: theme.palette.warning.main },
      { key: 'normal', color: theme.palette.info.main },
      { key: 'low', color: theme.palette.success.main },
    ];
    return priorities.map((priority) => ({
      name: t(`priority.${priority.key}`),
      value: Math.floor(Math.random() * 25) + 5,
      color: priority.color,
      key: priority.key,
    }));
  };

  const generateSentimentData = (filters: ChartFilter[]) => {
    return [
      { name: t('sentiment.positive'), value: 45, color: theme.palette.success.main },
      { name: t('sentiment.neutral'), value: 30, color: theme.palette.warning.main },
      { name: t('sentiment.negative'), value: 12, color: theme.palette.error.main },
    ];
  };

  // 处理钻取到下一级
  const handleDrillDown = (item: any) => {
    if (!drillDownConfig || drillDownConfig.currentLevel >= drillLevels.length - 1) return;

    const newLevel = drillDownConfig.currentLevel + 1;
    const newFilter: ChartFilter = {
      field: drillLevels[drillDownConfig.currentLevel].field,
      value: item.name || item.key,
      operator: 'equals',
    };

    const newConfig = {
      ...drillDownConfig,
      currentLevel: newLevel,
      breadcrumbs: [...drillDownConfig.breadcrumbs, item.name || item.key],
    };

    updateDrillDownConfig(newConfig);
    
    // 构建新的筛选条件
    const existingFilters = drillDownConfig.levels[drillDownConfig.currentLevel].filters || [];
    const newFilters = [...existingFilters, newFilter];
    
    loadDrillData(newLevel, newFilters);
  };

  // 处理向上钻取
  const handleDrillUp = (level: number) => {
    if (!drillDownConfig || level < 0) return;

    const newConfig = {
      ...drillDownConfig,
      currentLevel: level,
      breadcrumbs: drillDownConfig.breadcrumbs.slice(0, level + 1),
    };

    updateDrillDownConfig(newConfig);
    loadDrillData(level, []);
  };

  // 处理对话框关闭
  const handleClose = () => {
    setDrillDownConfig(null);
    onClose();
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {data.name}
            </Typography>
            <Typography variant="body2">
              {t('dashboard.value')}: <strong>{data.value}</strong>
            </Typography>
            {data.details && Object.entries(data.details).map(([key, value]) => (
              <Typography key={key} variant="caption" display="block">
                {key}: {typeof value === 'number' ? value.toFixed(2) : value}
              </Typography>
            ))}
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  // 渲染图表
  const renderChart = () => {
    if (!drillDownConfig || drillData.length === 0) return null;

    const currentLevel = drillLevels[drillDownConfig.currentLevel];
    const chartType = currentLevel.chartType;

    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={drillData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name} (${value})`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              onClick={handleDrillDown}
              cursor="pointer"
            >
              {drillData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={drillData} onClick={(data) => data && handleDrillDown(data.activePayload?.[0]?.payload)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar dataKey="value" cursor="pointer">
            {drillData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || theme.palette.primary.main} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // 渲染表格
  const renderTable = () => {
    if (drillData.length === 0) return null;

    return (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('dashboard.name')}</TableCell>
            <TableCell align="right">{t('dashboard.value')}</TableCell>
            <TableCell align="right">{t('dashboard.percentage')}</TableCell>
            <TableCell align="center">{t('dashboard.actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {drillData.map((item, index) => {
            const total = drillData.reduce((sum, d) => sum + d.value, 0);
            const percentage = ((item.value / total) * 100).toFixed(1);
            
            return (
              <TableRow 
                key={index} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleDrillDown(item)}
              >
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {item.color && (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          backgroundColor: item.color,
                          borderRadius: '50%',
                          mr: 1,
                        }}
                      />
                    )}
                    {item.name}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold">
                    {item.value}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ minWidth: 100 }}>
                    <Box display="flex" alignItems="center" justifyContent="flex-end">
                      <Typography variant="caption" sx={{ mr: 1 }}>
                        {percentage}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={parseFloat(percentage)}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDrillDown(item);
                    }}
                    disabled={!drillDownConfig || drillDownConfig.currentLevel >= drillLevels.length - 1}
                  >
                    <DrillDownOutlined fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (!drillDownConfig) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', maxHeight: '80vh' },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {t('dashboard.dataAnalysis')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {drillLevels[drillDownConfig.currentLevel].label}
            </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseOutlined />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* 面包屑导航 */}
        <Box sx={{ mb: 2 }}>
          <Breadcrumbs separator="›">
            {drillDownConfig.breadcrumbs.map((crumb, index) => (
              <Link
                key={index}
                component="button"
                variant="body2"
                onClick={() => handleDrillUp(index)}
                sx={{
                  textDecoration: 'none',
                  color: index === drillDownConfig.currentLevel ? 'primary.main' : 'text.secondary',
                  fontWeight: index === drillDownConfig.currentLevel ? 'bold' : 'normal',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {crumb}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        {/* 控制工具栏 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              icon={<FilterListOutlined />}
              label={`${t('dashboard.level')} ${drillDownConfig.currentLevel + 1}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary">
              {drillData.length} {t('dashboard.items')}
            </Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            <Button
              size="small"
              variant={viewMode === 'chart' ? 'contained' : 'outlined'}
              startIcon={<BarChartOutlined />}
              onClick={() => setViewMode('chart')}
            >
              {t('dashboard.chartView')}
            </Button>
            <Button
              size="small"
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              startIcon={<TableViewOutlined />}
              onClick={() => setViewMode('table')}
            >
              {t('dashboard.tableView')}
            </Button>
          </Box>
        </Box>

        {/* 内容区域 */}
        <Box sx={{ height: 'calc(100% - 120px)', overflow: 'auto' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
              <LinearProgress sx={{ width: '50%' }} />
            </Box>
          ) : (
            <>
              {viewMode === 'chart' ? renderChart() : renderTable()}
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<ArrowBackOutlined />}
          onClick={() => handleDrillUp(drillDownConfig.currentLevel - 1)}
          disabled={drillDownConfig.currentLevel <= 0}
        >
          {t('dashboard.back')}
        </Button>
        <Button onClick={handleClose}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DrillDownDialog;