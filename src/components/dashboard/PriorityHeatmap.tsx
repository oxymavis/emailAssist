import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  Chip,
  alpha,
} from '@mui/material';
import {
  FullscreenOutlined,
  DownloadOutlined,
  PriorityHigh,
} from '@mui/icons-material';
import { scaleLinear } from 'd3-scale';

import { PriorityHeatmapData, WidgetConfig } from '@/types';

interface PriorityHeatmapProps {
  data: PriorityHeatmapData[];
  config?: WidgetConfig;
  onDataClick?: (data: any) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  height?: number;
}

const PriorityHeatmap: React.FC<PriorityHeatmapProps> = ({
  data,
  config = {
    colorScheme: 'intensity',
    showLabels: true,
    showLegend: true,
  },
  onDataClick,
  onExport,
  onFullscreen,
  height = 300,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 定义时间和星期数据
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 优先级颜色配置
  const priorityColors = {
    critical: theme.palette.error.main,
    high: theme.palette.warning.main,
    normal: theme.palette.info.main,
    low: theme.palette.grey[400],
  };

  // 处理和格式化数据
  const heatmapData = useMemo(() => {
    // 创建完整的24小时x7天网格
    const grid: { [key: string]: PriorityHeatmapData[] } = {};
    
    // 初始化网格
    days.forEach(day => {
      hours.forEach(hour => {
        const key = `${day}-${hour}`;
        grid[key] = [];
      });
    });

    // 填充实际数据
    data.forEach(item => {
      const key = `${item.day}-${item.hour}`;
      if (grid[key]) {
        grid[key].push(item);
      }
    });

    return grid;
  }, [data]);

  // 计算强度范围用于颜色映射
  const intensityRange = useMemo(() => {
    const intensities = data.map(item => item.intensity);
    return {
      min: Math.min(...intensities, 0),
      max: Math.max(...intensities, 1),
    };
  }, [data]);

  // 创建颜色尺度
  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([intensityRange.min, intensityRange.max])
      .range([alpha(theme.palette.primary.main, 0.1), theme.palette.primary.main]);
  }, [intensityRange, theme.palette.primary.main]);

  // 获取单元格数据
  const getCellData = (day: string, hour: number) => {
    const key = `${day}-${hour}`;
    const cellData = heatmapData[key] || [];
    
    if (cellData.length === 0) {
      return { intensity: 0, count: 0, priority: 'normal' as const };
    }

    // 计算该时间点的总体数据
    const totalCount = cellData.reduce((sum, item) => sum + item.count, 0);
    const avgIntensity = cellData.reduce((sum, item) => sum + item.intensity, 0) / cellData.length;
    
    // 确定主要优先级
    const priorityCount = { critical: 0, high: 0, normal: 0, low: 0 };
    cellData.forEach(item => {
      priorityCount[item.priority] += item.count;
    });
    
    const dominantPriority = Object.entries(priorityCount).reduce((a, b) =>
      priorityCount[a[0] as keyof typeof priorityCount] > priorityCount[b[0] as keyof typeof priorityCount] ? a : b
    )[0] as keyof typeof priorityCount;

    return {
      intensity: avgIntensity,
      count: totalCount,
      priority: dominantPriority,
      breakdown: priorityCount,
    };
  };

  // 处理单元格点击
  const handleCellClick = (day: string, hour: number) => {
    const cellData = getCellData(day, hour);
    if (onDataClick && cellData.count > 0) {
      onDataClick({
        day,
        hour,
        ...cellData,
        rawData: heatmapData[`${day}-${hour}`],
      });
    }
  };

  // 计算总体统计
  const stats = useMemo(() => {
    const totalEmails = data.reduce((sum, item) => sum + item.count, 0);
    const priorityStats = data.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + item.count;
      return acc;
    }, {} as Record<string, number>);

    const peakHour = data.reduce((peak, item) => 
      item.count > peak.count ? item : peak, data[0] || { hour: 9, count: 0 }
    );

    return {
      totalEmails,
      priorityStats,
      peakHour: peakHour.hour,
      peakCount: peakHour.count,
    };
  }, [data]);

  // 渲染热力图单元格
  const renderCell = (day: string, hour: number, dayIndex: number, hourIndex: number) => {
    const cellData = getCellData(day, hour);
    const cellColor = cellData.intensity > 0 
      ? colorScale(cellData.intensity) 
      : alpha(theme.palette.grey[300], 0.3);

    return (
      <Tooltip
        key={`${day}-${hour}`}
        title={
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {day} {hour}:00
            </Typography>
            <Typography variant="body2">
              {t('dashboard.emailCount')}: {cellData.count}
            </Typography>
            <Typography variant="body2">
              {t('dashboard.intensity')}: {cellData.intensity.toFixed(2)}
            </Typography>
            <Typography variant="body2">
              {t('dashboard.priority')}: {t(`priority.${cellData.priority}`)}
            </Typography>
            {cellData.breakdown && (
              <Box sx={{ mt: 1 }}>
                {Object.entries(cellData.breakdown).map(([priority, count]) => (
                  count > 0 && (
                    <Typography key={priority} variant="caption" display="block">
                      {t(`priority.${priority}`)}: {count}
                    </Typography>
                  )
                ))}
              </Box>
            )}
          </Box>
        }
      >
        <Box
          sx={{
            width: 24,
            height: 20,
            backgroundColor: cellColor,
            border: `1px solid ${theme.palette.divider}`,
            cursor: cellData.count > 0 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: cellData.count > 0 ? 'scale(1.1)' : 'none',
              zIndex: 1,
              boxShadow: cellData.count > 0 ? 2 : 0,
            },
          }}
          onClick={() => handleCellClick(day, hour)}
        >
          {config.showLabels && cellData.count > 0 && (
            <Typography
              variant="caption"
              sx={{
                fontSize: '9px',
                fontWeight: 'bold',
                color: cellData.intensity > 0.5 ? 'white' : theme.palette.text.primary,
              }}
            >
              {cellData.count > 99 ? '99+' : cellData.count}
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('dashboard.priorityHeatmap')}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <PriorityHigh fontSize="small" color="primary" />
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.peakTime')}: {stats.peakHour}:00 ({stats.peakCount} {t('dashboard.emails')})
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={t('dashboard.exportData')}>
              <IconButton size="small" onClick={onExport}>
                <DownloadOutlined />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={t('dashboard.fullscreen')}>
              <IconButton size="small" onClick={onFullscreen}>
                <FullscreenOutlined />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 统计信息 */}
        <Box display="flex" gap={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" color="primary.main" fontWeight="bold">
              {stats.totalEmails.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.totalEmails')}
            </Typography>
          </Box>
          {Object.entries(stats.priorityStats).map(([priority, count]) => (
            <Box key={priority}>
              <Typography variant="body2" fontWeight="bold" sx={{ color: priorityColors[priority as keyof typeof priorityColors] }}>
                {count}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`priority.${priority}`)}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* 热力图主体 */}
        <Box sx={{ overflowX: 'auto', height: `${height}px` }}>
          <Box sx={{ minWidth: 600 }}>
            {/* 时间标签 */}
            <Box display="flex" sx={{ mb: 1, ml: '60px' }}>
              {hours.filter(h => h % 2 === 0).map(hour => (
                <Box key={hour} sx={{ width: 48, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {hour}:00
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* 热力图网格 */}
            {days.map((day, dayIndex) => (
              <Box key={day} display="flex" alignItems="center" sx={{ mb: 0.5 }}>
                {/* 星期标签 */}
                <Box sx={{ width: 50, textAlign: 'right', mr: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {day}
                  </Typography>
                </Box>
                
                {/* 时间单元格 */}
                <Box display="flex">
                  {hours.map((hour, hourIndex) => 
                    renderCell(day, hour, dayIndex, hourIndex)
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 图例 */}
        {config.showLegend && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.intensity')}:
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption">{t('dashboard.low')}</Typography>
              <Box display="flex">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(intensity => (
                  <Box
                    key={intensity}
                    sx={{
                      width: 16,
                      height: 12,
                      backgroundColor: colorScale(intensity),
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                ))}
              </Box>
              <Typography variant="caption">{t('dashboard.high')}</Typography>
            </Box>
            
            <Box display="flex" gap={1} sx={{ ml: 2 }}>
              {Object.entries(priorityColors).map(([priority, color]) => (
                <Chip
                  key={priority}
                  size="small"
                  variant="outlined"
                  label={t(`priority.${priority}`)}
                  sx={{ 
                    borderColor: color,
                    color: color,
                    fontSize: '10px',
                    height: 20,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PriorityHeatmap;