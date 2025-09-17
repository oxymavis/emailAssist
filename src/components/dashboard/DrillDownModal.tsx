import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';

import { DrillDownConfig, ChartFilter } from '@/types';
import {
  EmailVolumeChart,
  SentimentAnalysisChart,
  CategoryDistributionChart,
  ResponseTimeChart,
} from '@/components/charts';

interface DrillDownModalProps {
  open: boolean;
  onClose: () => void;
  data: any;
  config: DrillDownConfig;
  onConfigUpdate: (config: DrillDownConfig) => void;
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({
  open,
  onClose,
  data,
  config,
  onConfigUpdate,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [detailView, setDetailView] = useState<'chart' | 'table'>('chart');

  // 当前层级数据
  const currentLevelData = useMemo(() => {
    if (!data || !config.enabled) return [];

    const currentLevel = config.levels[config.currentLevel];
    if (!currentLevel) return data;

    // 根据当前层级的字段过滤数据
    let filteredData = [...data];
    
    // 应用钻取过滤器
    currentLevel.filters?.forEach(filter => {
      filteredData = filteredData.filter(item => {
        const fieldValue = item[filter.field];
        switch (filter.operator) {
          case 'equals':
            return fieldValue === filter.value;
          case 'contains':
            return String(fieldValue).includes(String(filter.value));
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          default:
            return true;
        }
      });
    });

    return filteredData;
  }, [data, config]);

  // 面包屑导航
  const handleBreadcrumbClick = (levelIndex: number) => {
    if (levelIndex < config.currentLevel) {
      const newConfig = {
        ...config,
        currentLevel: levelIndex,
        breadcrumbs: config.breadcrumbs.slice(0, levelIndex + 1),
      };
      onConfigUpdate(newConfig);
    }
  };

  // 返回上一层
  const handleGoBack = () => {
    if (config.currentLevel > 0) {
      const newConfig = {
        ...config,
        currentLevel: config.currentLevel - 1,
        breadcrumbs: config.breadcrumbs.slice(0, -1),
      };
      onConfigUpdate(newConfig);
    }
  };

  // 钻取到下一层
  const handleDrillDown = (item: any) => {
    const nextLevelIndex = config.currentLevel + 1;
    const nextLevel = config.levels[nextLevelIndex];
    
    if (!nextLevel) return;

    const newBreadcrumb = item[nextLevel.field] || item.name || item.label || String(item);
    
    const newConfig = {
      ...config,
      currentLevel: nextLevelIndex,
      breadcrumbs: [...config.breadcrumbs, newBreadcrumb],
    };

    // 添加过滤器到下一层
    if (nextLevel.filters) {
      const newFilter: ChartFilter = {
        field: config.levels[config.currentLevel].field,
        operator: 'equals',
        value: item[config.levels[config.currentLevel].field] || item.name,
      };
      nextLevel.filters.push(newFilter);
    }

    onConfigUpdate(newConfig);
  };

  // 渲染图表
  const renderChart = () => {
    const currentLevel = config.levels[config.currentLevel];
    if (!currentLevel) return null;

    const chartProps = {
      data: currentLevelData,
      interactive: true,
      height: 400,
      onDataClick: (item: any) => {
        if (config.currentLevel < config.levels.length - 1) {
          handleDrillDown(item);
        }
      },
    };

    switch (currentLevel.chartType) {
      case 'email-volume':
        return <EmailVolumeChart {...chartProps} />;
      case 'sentiment-analysis':
        return <SentimentAnalysisChart {...chartProps} />;
      case 'category-distribution':
        return <CategoryDistributionChart {...chartProps} />;
      case 'response-time':
        return <ResponseTimeChart {...chartProps} />;
      default:
        // 默认表格视图
        return renderTable();
    }
  };

  // 渲染表格
  const renderTable = () => {
    if (!currentLevelData.length) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height={200}>
          <Typography color="text.secondary">
            {t('common.noData')}
          </Typography>
        </Box>
      );
    }

    const columns = Object.keys(currentLevelData[0]).filter(key => 
      !['id', 'color', 'index'].includes(key)
    );

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column} sx={{ fontWeight: 'bold' }}>
                  {t(`common.${column}`) || column}
                </TableCell>
              ))}
              {config.currentLevel < config.levels.length - 1 && (
                <TableCell>{t('common.actions')}</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {currentLevelData.slice(0, 100).map((row, index) => (
              <TableRow 
                key={index}
                hover
                sx={{ 
                  cursor: config.currentLevel < config.levels.length - 1 ? 'pointer' : 'default' 
                }}
                onClick={() => {
                  if (config.currentLevel < config.levels.length - 1) {
                    handleDrillDown(row);
                  }
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column}>
                    {typeof row[column] === 'number' ? 
                      row[column].toLocaleString() : 
                      String(row[column] || '-')
                    }
                  </TableCell>
                ))}
                {config.currentLevel < config.levels.length - 1 && (
                  <TableCell>
                    <Button
                      size="small"
                      endIcon={<NavigateNextIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrillDown(row);
                      }}
                    >
                      {t('dashboard.drillDown')}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const currentLevel = config.levels[config.currentLevel];
  const canGoDeeper = config.currentLevel < config.levels.length - 1;
  const canGoBack = config.currentLevel > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            {canGoBack && (
              <Tooltip title={t('common.back')}>
                <IconButton onClick={handleGoBack}>
                  <BackIcon />
                </IconButton>
              </Tooltip>
            )}
            <Box>
              <Typography variant="h6">
                {t('dashboard.drillDownAnalysis')}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                {currentLevel?.label || t('dashboard.detailedView')}
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <Button
              size="small"
              variant={detailView === 'chart' ? 'contained' : 'outlined'}
              onClick={() => setDetailView('chart')}
            >
              {t('common.chart')}
            </Button>
            <Button
              size="small"
              variant={detailView === 'table' ? 'contained' : 'outlined'}
              onClick={() => setDetailView('table')}
            >
              {t('common.table')}
            </Button>
            <Tooltip title={t('common.export')}>
              <IconButton>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.close')}>
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 面包屑导航 */}
        {config.breadcrumbs.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
              {config.breadcrumbs.map((crumb, index) => (
                <Link
                  key={index}
                  component="button"
                  variant="body2"
                  onClick={() => handleBreadcrumbClick(index)}
                  sx={{
                    cursor: index < config.currentLevel ? 'pointer' : 'default',
                    textDecoration: 'none',
                    color: index === config.currentLevel ? 'primary.main' : 'text.primary',
                    '&:hover': {
                      textDecoration: index < config.currentLevel ? 'underline' : 'none',
                    },
                  }}
                >
                  {crumb}
                </Link>
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {/* 当前层级信息 */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.currentLevel')}: <strong>{config.currentLevel + 1}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('common.records')}: <strong>{currentLevelData.length.toLocaleString()}</strong>
                </Typography>
                {canGoDeeper && (
                  <Chip
                    label={t('dashboard.clickToDrillDown')}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
              
              {/* 应用的过滤器 */}
              {currentLevel?.filters && currentLevel.filters.length > 0 && (
                <Box display="flex" alignItems="center" gap={1}>
                  <FilterIcon fontSize="small" color="action" />
                  {currentLevel.filters.map((filter, index) => (
                    <Chip
                      key={index}
                      label={`${filter.field}: ${filter.value}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* 内容区域 */}
        <Box sx={{ height: 'calc(100% - 120px)' }}>
          {detailView === 'chart' ? renderChart() : renderTable()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t('common.close')}
        </Button>
        {canGoBack && (
          <Button onClick={handleGoBack} startIcon={<BackIcon />}>
            {t('common.back')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DrillDownModal;