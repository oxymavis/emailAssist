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
  Grid,
  Chip,
} from '@mui/material';
import {
  ShowChart as LineChartIcon,
  BarChart as BarChartIcon,
  Timeline as AreaChartIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { ResponseTimeData, AdvancedChartProps } from '@/types';

interface ResponseTimeChartProps extends AdvancedChartProps {
  data: ResponseTimeData[];
  chartType?: 'line' | 'area' | 'bar';
  showTrends?: boolean;
  showBenchmark?: boolean;
  benchmarkValue?: number;
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  data,
  chartType = 'line',
  height = 350,
  interactive = true,
  onDataClick,
  showTrends = true,
  showBenchmark = true,
  benchmarkValue = 2, // 2小时基准线
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedChart, setSelectedChart] = useState<'line' | 'area' | 'bar'>(chartType);
  const [selectedDataPoint, setSelectedDataPoint] = useState<ResponseTimeData | null>(null);

  // 计算统计信息
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const avgResponses = data.map(d => d.avgResponse);
    const medianResponses = data.map(d => d.medianResponse);
    const trends = data.map(d => d.trend);

    const overallAvg = avgResponses.reduce((a, b) => a + b, 0) / avgResponses.length;
    const overallMedian = medianResponses.reduce((a, b) => a + b, 0) / medianResponses.length;
    const avgTrend = trends.reduce((a, b) => a + b, 0) / trends.length;
    
    const minResponse = Math.min(...avgResponses);
    const maxResponse = Math.max(...avgResponses);

    return {
      overallAvg,
      overallMedian,
      avgTrend,
      minResponse,
      maxResponse,
    };
  }, [data]);

  // 处理数据点击
  const handleDataClick = (data: any, index: number) => {
    setSelectedDataPoint(data);
    if (interactive && onDataClick) {
      onDataClick({
        ...data,
        chartType: 'response-time',
        index,
      });
    }
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} display="flex" alignItems="center" sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '50%',
                  mr: 1,
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {entry.value.toFixed(1)}h
              </Typography>
            </Box>
          ))}
          <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              {t('common.count')}:
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {data.count.toLocaleString()}
            </Typography>
          </Box>
          {showTrends && (
            <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
              {data.trend > 0 ? (
                <TrendingUpIcon fontSize="small" sx={{ color: 'error.main', mr: 0.5 }} />
              ) : (
                <TrendingDownIcon fontSize="small" sx={{ color: 'success.main', mr: 0.5 }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: data.trend > 0 ? 'error.main' : 'success.main',
                  fontWeight: 500,
                }}
              >
                {data.trend > 0 ? '+' : ''}{data.trend.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Card>
      );
    }
    return null;
  };

  // 渲染图表
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      onClick: handleDataClick,
    };

    switch (selectedChart) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="avgResponseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="medianResponseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeRange" />
            <YAxis label={{ value: t('dashboard.hours'), angle: -90, position: 'insideLeft' }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {showBenchmark && (
              <ReferenceLine 
                y={benchmarkValue} 
                stroke={theme.palette.warning.main}
                strokeDasharray="5 5"
                label={`${t('dashboard.benchmark')}: ${benchmarkValue}h`}
              />
            )}
            <Area
              type="monotone"
              dataKey="avgResponse"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#avgResponseGradient)"
              name={t('dashboard.avgResponseTime')}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="medianResponse"
              stroke={theme.palette.secondary.main}
              fillOpacity={1}
              fill="url(#medianResponseGradient)"
              name={t('dashboard.medianResponseTime')}
              strokeWidth={2}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeRange" />
            <YAxis label={{ value: t('dashboard.hours'), angle: -90, position: 'insideLeft' }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {showBenchmark && (
              <ReferenceLine 
                y={benchmarkValue} 
                stroke={theme.palette.warning.main}
                strokeDasharray="5 5"
                label={`${t('dashboard.benchmark')}: ${benchmarkValue}h`}
              />
            )}
            <Bar
              dataKey="avgResponse"
              fill={theme.palette.primary.main}
              name={t('dashboard.avgResponseTime')}
            />
            <Bar
              dataKey="medianResponse"
              fill={theme.palette.secondary.main}
              name={t('dashboard.medianResponseTime')}
            />
          </BarChart>
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeRange" />
            <YAxis label={{ value: t('dashboard.hours'), angle: -90, position: 'insideLeft' }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {showBenchmark && (
              <ReferenceLine 
                y={benchmarkValue} 
                stroke={theme.palette.warning.main}
                strokeDasharray="5 5"
                label={`${t('dashboard.benchmark')}: ${benchmarkValue}h`}
              />
            )}
            <Line
              type="monotone"
              dataKey="avgResponse"
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              name={t('dashboard.avgResponseTime')}
              dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: theme.palette.primary.main, strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="medianResponse"
              stroke={theme.palette.secondary.main}
              strokeWidth={3}
              name={t('dashboard.medianResponseTime')}
              dot={{ fill: theme.palette.secondary.main, strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: theme.palette.secondary.main, strokeWidth: 2 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('dashboard.responseTimeAnalysis')}
          </Typography>
          
          {interactive && (
            <Box display="flex" alignItems="center" gap={1}>
              {/* 图表类型切换 */}
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setSelectedChart('line')}
                  variant={selectedChart === 'line' ? 'contained' : 'outlined'}
                >
                  <LineChartIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('area')}
                  variant={selectedChart === 'area' ? 'contained' : 'outlined'}
                >
                  <AreaChartIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('bar')}
                  variant={selectedChart === 'bar' ? 'contained' : 'outlined'}
                >
                  <BarChartIcon fontSize="small" />
                </Button>
              </ButtonGroup>

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

        {/* 统计概览 */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="primary" fontWeight="bold">
                  {stats.overallAvg.toFixed(1)}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.avgResponseTime')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="secondary" fontWeight="bold">
                  {stats.overallMedian.toFixed(1)}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.medianResponseTime')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box textAlign="center" display="flex" alignItems="center" justifyContent="center">
                <TimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {stats.minResponse.toFixed(1)}h - {stats.maxResponse.toFixed(1)}h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.range')}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box textAlign="center" display="flex" alignItems="center" justifyContent="center">
                {stats.avgTrend > 0 ? (
                  <TrendingUpIcon fontSize="small" sx={{ mr: 0.5, color: 'error.main' }} />
                ) : (
                  <TrendingDownIcon fontSize="small" sx={{ mr: 0.5, color: 'success.main' }} />
                )}
                <Box>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold"
                    color={stats.avgTrend > 0 ? 'error.main' : 'success.main'}
                  >
                    {stats.avgTrend > 0 ? '+' : ''}{stats.avgTrend.toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.trend')}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
      
      <Box sx={{ flex: 1, px: 2, pb: 2 }}>
        <ResponsiveContainer width="100%" height={height - 150}>
          {renderChart()}
        </ResponsiveContainer>
      </Box>

      {/* 选中数据点详情 */}
      {selectedDataPoint && interactive && (
        <CardContent sx={{ pt: 0, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('dashboard.selectedPeriod')}: {selectedDataPoint.timeRange}
          </Typography>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Chip
              icon={<TimeIcon />}
              label={`${t('dashboard.avgResponseTime')}: ${selectedDataPoint.avgResponse.toFixed(1)}h`}
              color="primary"
              variant="outlined"
              size="small"
            />
            <Chip
              icon={<TimeIcon />}
              label={`${t('dashboard.medianResponseTime')}: ${selectedDataPoint.medianResponse.toFixed(1)}h`}
              color="secondary"
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${t('common.count')}: ${selectedDataPoint.count.toLocaleString()}`}
              variant="outlined"
              size="small"
            />
            {showTrends && (
              <Chip
                icon={selectedDataPoint.trend > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                label={`${t('dashboard.trend')}: ${selectedDataPoint.trend > 0 ? '+' : ''}${selectedDataPoint.trend.toFixed(1)}%`}
                color={selectedDataPoint.trend > 0 ? 'error' : 'success'}
                variant="outlined"
                size="small"
              />
            )}
          </Box>
        </CardContent>
      )}
    </Card>
  );
};

export default ResponseTimeChart;