import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  useTheme,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import {
  ViewModule as HeatmapIcon,
  GridOn as GridIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Palette as ColorIcon,
} from '@mui/icons-material';
import { scaleLinear } from 'd3-scale';

import { PriorityHeatmapData, AdvancedChartProps } from '@/types';

interface PriorityHeatmapProps extends AdvancedChartProps {
  data: PriorityHeatmapData[];
  showLabels?: boolean;
  showLegend?: boolean;
  colorScheme?: 'default' | 'priority' | 'intensity';
}

export const PriorityHeatmap: React.FC<PriorityHeatmapProps> = ({
  data,
  height = 350,
  interactive = true,
  onDataClick,
  showLabels = true,
  showLegend = true,
  colorScheme = 'intensity',
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedColorScheme, setSelectedColorScheme] = useState(colorScheme);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{hour: number, day: string} | null>(null);

  // 小时和星期天配置
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = days.map(day => t(`common.${day}`));

  // 颜色方案配置
  const colorSchemes = {
    default: {
      low: theme.palette.success.light,
      medium: theme.palette.warning.light,
      high: theme.palette.error.light,
      critical: theme.palette.error.dark,
    },
    priority: {
      low: '#4CAF50',
      normal: '#2196F3',
      high: '#FF9800',
      critical: '#F44336',
    },
    intensity: {
      low: theme.palette.grey[200],
      medium: theme.palette.primary.light,
      high: theme.palette.primary.main,
      critical: theme.palette.primary.dark,
    },
  };

  // 创建强度颜色映射
  const intensityColorScale = useMemo(() => {
    const maxIntensity = Math.max(...data.map(d => d.intensity));
    return scaleLinear<string>()
      .domain([0, maxIntensity])
      .range([theme.palette.grey[100], theme.palette.primary.dark]);
  }, [data, theme]);

  // 获取单元格数据
  const getCellData = (hour: number, day: string) => {
    return data.find(d => d.hour === hour && d.day === day);
  };

  // 获取单元格颜色
  const getCellColor = (cellData: PriorityHeatmapData | undefined) => {
    if (!cellData) return theme.palette.grey[50];
    
    if (selectedColorScheme === 'intensity') {
      return intensityColorScale(cellData.intensity);
    }
    
    const scheme = colorSchemes[selectedColorScheme];
    return scheme[cellData.priority as keyof typeof scheme] || theme.palette.grey[200];
  };

  // 获取单元格文本颜色
  const getTextColor = (cellData: PriorityHeatmapData | undefined) => {
    if (!cellData || cellData.intensity < 0.3) return theme.palette.text.primary;
    return theme.palette.common.white;
  };

  // 处理单元格点击
  const handleCellClick = (hour: number, day: string, cellData: PriorityHeatmapData | undefined) => {
    if (!interactive || !cellData) return;
    
    setSelectedCell({hour, day});
    if (onDataClick) {
      onDataClick({
        ...cellData,
        chartType: 'priority-heatmap',
        hour,
        day,
      });
    }
  };

  // 格式化时间
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  // 渲染图例
  const renderLegend = () => {
    if (!showLegend) return null;

    if (selectedColorScheme === 'intensity') {
      const legendSteps = 5;
      const maxIntensity = Math.max(...data.map(d => d.intensity));
      const steps = Array.from({ length: legendSteps }, (_, i) => {
        const value = (maxIntensity * i) / (legendSteps - 1);
        return { value, color: intensityColorScale(value) };
      });

      return (
        <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ mr: 1 }}>
            {t('dashboard.low')}
          </Typography>
          {steps.map((step, index) => (
            <Box
              key={index}
              sx={{
                width: 20,
                height: 12,
                backgroundColor: step.color,
                mr: index < steps.length - 1 ? 0 : 1,
              }}
            />
          ))}
          <Typography variant="caption" sx={{ ml: 1 }}>
            {t('dashboard.high')}
          </Typography>
        </Box>
      );
    }

    const scheme = colorSchemes[selectedColorScheme];
    return (
      <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {Object.entries(scheme).map(([priority, color]) => (
          <Box key={priority} display="flex" alignItems="center" sx={{ mr: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: color,
                mr: 0.5,
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">
              {t(`common.${priority}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('dashboard.priorityHeatmap')}
          </Typography>
          
          {interactive && (
            <Box display="flex" alignItems="center" gap={1}>
              {/* 颜色方案切换 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSelectedColorScheme('intensity')}
                  variant={selectedColorScheme === 'intensity' ? 'contained' : 'outlined'}
                >
                  <HeatmapIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedColorScheme('priority')}
                  variant={selectedColorScheme === 'priority' ? 'contained' : 'outlined'}
                >
                  <ColorIcon fontSize="small" />
                </Button>
              </ButtonGroup>

              {/* 控制开关 */}
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                }
                label={
                  <Box display="flex" alignItems="center">
                    <GridIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="caption">
                      {t('dashboard.grid')}
                    </Typography>
                  </Box>
                }
              />

              {/* 工具按钮 */}
              <Tooltip title={t('common.fullscreen')}>
                <IconButton size="small">
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('common.download')}>
                <IconButton size="small">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {renderLegend()}
      </CardContent>
      
      <Box sx={{ flex: 1, px: 2, pb: 2, overflow: 'auto' }}>
        <Grid container spacing={0} sx={{ minWidth: 600 }}>
          {/* 时间标签行 */}
          <Grid item xs={1} />
          {hours.filter((_, index) => index % 2 === 0).map((hour) => (
            <Grid item xs={1} key={`hour-${hour}`}>
              <Box
                sx={{
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                }}
              >
                {formatHour(hour)}
              </Box>
            </Grid>
          ))}

          {/* 热力图主体 */}
          {days.map((day, dayIndex) => (
            <React.Fragment key={day}>
              {/* 星期标签 */}
              <Grid item xs={1}>
                <Box
                  sx={{
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 1,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    fontWeight: 'medium',
                  }}
                >
                  {dayLabels[dayIndex]}
                </Box>
              </Grid>

              {/* 小时单元格 */}
              {hours.map((hour) => {
                const cellData = getCellData(hour, day);
                const isSelected = selectedCell?.hour === hour && selectedCell?.day === day;
                
                return (
                  <Grid item xs={0.458} key={`${day}-${hour}`}>
                    <Box
                      sx={{
                        height: 24,
                        backgroundColor: getCellColor(cellData),
                        border: showGrid 
                          ? `1px solid ${theme.palette.divider}`
                          : `1px solid ${getCellColor(cellData)}`,
                        borderRadius: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: interactive && cellData ? 'pointer' : 'default',
                        fontSize: '0.65rem',
                        fontWeight: 'medium',
                        color: getTextColor(cellData),
                        position: 'relative',
                        transition: 'all 0.2s',
                        '&:hover': interactive && cellData ? {
                          transform: 'scale(1.1)',
                          zIndex: 1,
                          boxShadow: theme.shadows[4],
                        } : {},
                        outline: isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
                        outlineOffset: isSelected ? 1 : 0,
                      }}
                      onClick={() => handleCellClick(hour, day, cellData)}
                      title={cellData ? 
                        `${t('common.time')}: ${formatHour(hour)}\n${t('common.day')}: ${dayLabels[dayIndex]}\n${t('common.count')}: ${cellData.count}\n${t('common.priority')}: ${t(`common.${cellData.priority}`)}`
                        : undefined
                      }
                    >
                      {showLabels && cellData && cellData.count > 0 ? cellData.count : ''}
                    </Box>
                  </Grid>
                );
              })}
            </React.Fragment>
          ))}
        </Grid>

        {/* 选中单元格详情 */}
        {selectedCell && interactive && (
          <Card sx={{ mt: 2, p: 2, backgroundColor: theme.palette.action.hover }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('dashboard.selectedTimeSlot')}
            </Typography>
            {(() => {
              const cellData = getCellData(selectedCell.hour, selectedCell.day);
              if (!cellData) return null;
              
              return (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('common.time')}: {formatHour(selectedCell.hour)} - {dayLabels[days.indexOf(selectedCell.day)]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('common.count')}: <strong>{cellData.count}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('common.priority')}: <strong>{t(`common.${cellData.priority}`)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.intensity')}: <strong>{(cellData.intensity * 100).toFixed(1)}%</strong>
                  </Typography>
                </Box>
              );
            })()}
          </Card>
        )}
      </Box>
    </Card>
  );
};

export default PriorityHeatmap;