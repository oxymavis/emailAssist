import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  useTheme,
  Chip,
} from '@mui/material';
import {
  FullscreenOutlined,
  DownloadOutlined,
  TimelineOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ComposedChart,
  Line,
  LineChart,
  Bar,
  BarChart,
} from 'recharts';

import { ResponseTimeData, WidgetConfig } from '@/types';

interface ResponseTimeChartProps {
  data: ResponseTimeData[];
  config?: WidgetConfig;
  onDataClick?: (data: any) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  height?: number;
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  data,
  config = {
    chartType: 'area',
    showTrends: true,
    showBenchmark: true,
    benchmarkValue: 2, // 2小时基准
  },
  onDataClick,
  onExport,
  onFullscreen,
  height = 300,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 图表类型状态
  const [chartType, setChartType] = React.useState<'area' | 'line' | 'bar' | 'composed'>(
    (config.chartType as 'area' | 'line' | 'bar' | 'composed') || 'area'
  );

  // 基准值
  const benchmarkValue = config.benchmarkValue || 2;

  // 格式化数据
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      index,
      avgResponseHours: Math.round(item.avgResponse * 100) / 100,
      medianResponseHours: Math.round(item.medianResponse * 100) / 100,
      benchmarkValue,
      performance: item.avgResponse <= benchmarkValue ? 'good' : 
                  item.avgResponse <= benchmarkValue * 1.5 ? 'warning' : 'critical',
    }));
  }, [data, benchmarkValue]);

  // 计算响应时间指标
  const metrics = useMemo(() => {
    if (data.length === 0) {
      return {
        avgResponseTime: 0,
        medianResponseTime: 0,
        trend: 0,
        onTimeRate: 0,
        totalEmails: 0,
        bestTime: 0,
        worstTime: 0,
      };
    }

    const totalEmails = data.reduce((sum, item) => sum + item.count, 0);
    const avgResponseTime = data.reduce((sum, item) => sum + item.avgResponse * item.count, 0) / totalEmails;
    const medianResponseTime = data.reduce((sum, item) => sum + item.medianResponse * item.count, 0) / totalEmails;
    
    // 计算趋势（最近3个点vs之前3个点）
    const recentData = data.slice(-3);
    const previousData = data.slice(-6, -3);
    
    const recentAvg = recentData.reduce((sum, item) => sum + item.avgResponse, 0) / recentData.length;
    const previousAvg = previousData.length > 0 
      ? previousData.reduce((sum, item) => sum + item.avgResponse, 0) / previousData.length 
      : recentAvg;
    
    const trend = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
    
    // 按时完成率（在基准时间内）
    const onTimeCount = data.reduce((sum, item) => 
      sum + (item.avgResponse <= benchmarkValue ? item.count : 0), 0);
    const onTimeRate = totalEmails > 0 ? (onTimeCount / totalEmails) * 100 : 0;
    
    // 最佳和最差响应时间
    const responseeTimes = data.map(item => item.avgResponse);
    const bestTime = Math.min(...responseeTimes);
    const worstTime = Math.max(...responseeTimes);

    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      medianResponseTime: Math.round(medianResponseTime * 100) / 100,
      trend: Math.round(trend * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      totalEmails,
      bestTime,
      worstTime,
    };
  }, [data, benchmarkValue]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {label}
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.avgResponseTime')}:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {data.avgResponseHours}小时
              </Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.medianResponseTime')}:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {data.medianResponseHours}小时
              </Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.emailCount')}:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {data.count}
              </Typography>
            </Box>
            {data.trend !== undefined && (
              <Box display="flex" alignItems="center">
                {data.trend >= 0 ? (
                  <TrendingUpOutlined fontSize="small" sx={{ color: 'error.main', mr: 0.5 }} />
                ) : (
                  <TrendingDownOutlined fontSize="small" sx={{ color: 'success.main', mr: 0.5 }} />
                )}
                <Typography 
                  variant="caption" 
                  sx={{ color: data.trend >= 0 ? 'error.main' : 'success.main' }}
                >
                  {data.trend >= 0 ? '+' : ''}{data.trend}% 
                  {data.trend >= 0 ? t('dashboard.slower') : t('dashboard.faster')}
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={
                  data.performance === 'good' ? t('dashboard.onTime') :
                  data.performance === 'warning' ? t('dashboard.delayed') :
                  t('dashboard.critical')
                }
                color={
                  data.performance === 'good' ? 'success' :
                  data.performance === 'warning' ? 'warning' : 'error'
                }
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  // 处理数据点击
  const handleDataClick = (data: any) => {
    if (onDataClick) {
      onDataClick(data);
    }
  };

  // 渲染图表
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      onClick: handleDataClick,
    };

    const commonElements = (
      <>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis 
          dataKey="timeRange" 
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
          label={{ value: t('dashboard.hours'), angle: -90, position: 'insideLeft' }}
        />
        <RechartsTooltip content={<CustomTooltip />} />
        {config.showBenchmark && (
          <ReferenceLine 
            y={benchmarkValue} 
            stroke={theme.palette.warning.main}
            strokeDasharray="8 8"
            label={{
              value: `${t('dashboard.benchmark')}: ${benchmarkValue}h`,
              position: 'topLeft',
            }}
          />
        )}
      </>
    );

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="avgResponseHours"
              stroke={theme.palette.primary.main}
              fill={theme.palette.primary.main}
              fillOpacity={0.3}
              strokeWidth={2}
              name={t('dashboard.avgResponseTime')}
            />
            <Area
              type="monotone"
              dataKey="medianResponseHours"
              stroke={theme.palette.secondary.main}
              fill={theme.palette.secondary.main}
              fillOpacity={0.2}
              strokeWidth={2}
              name={t('dashboard.medianResponseTime')}
            />
          </AreaChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="avgResponseHours"
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              dot={{ r: 4, fill: theme.palette.primary.main }}
              activeDot={{ r: 6 }}
              name={t('dashboard.avgResponseTime')}
            />
            <Line
              type="monotone"
              dataKey="medianResponseHours"
              stroke={theme.palette.secondary.main}
              strokeWidth={2}
              strokeDasharray="5 5"
              name={t('dashboard.medianResponseTime')}
            />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar 
              dataKey="avgResponseHours" 
              name={t('dashboard.avgResponseTime')}
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry.performance === 'good' ? theme.palette.success.main :
                    entry.performance === 'warning' ? theme.palette.warning.main :
                    theme.palette.error.main
                  }
                />
              ))}
            </Bar>
          </BarChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="avgResponseHours"
              fill={theme.palette.primary.main}
              fillOpacity={0.2}
              stroke="none"
              name={t('dashboard.avgResponseTime')}
            />
            <Line
              type="monotone"
              dataKey="medianResponseHours"
              stroke={theme.palette.secondary.main}
              strokeWidth={2}
              name={t('dashboard.medianResponseTime')}
            />
            <Bar 
              dataKey="count" 
              fill={theme.palette.info.main}
              fillOpacity={0.6}
              yAxisId="right"
              name={t('dashboard.emailCount')}
            />
          </ComposedChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('dashboard.responseTimeAnalysis')}
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Box display="flex" alignItems="center">
                <TimelineOutlined fontSize="small" color="primary" sx={{ mr: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.avgTime')}: {metrics.avgResponseTime}h
                </Typography>
              </Box>
              <Box display="flex" alignItems="center">
                {metrics.trend >= 0 ? (
                  <TrendingUpOutlined 
                    fontSize="small" 
                    sx={{ color: 'error.main', mr: 0.5 }}
                  />
                ) : (
                  <TrendingDownOutlined 
                    fontSize="small" 
                    sx={{ color: 'success.main', mr: 0.5 }}
                  />
                )}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: metrics.trend >= 0 ? 'error.main' : 'success.main',
                    fontWeight: 500,
                  }}
                >
                  {metrics.trend >= 0 ? '+' : ''}{metrics.trend}%
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as typeof chartType)}
                variant="outlined"
              >
                <MenuItem value="area">{t('dashboard.areaChart')}</MenuItem>
                <MenuItem value="line">{t('dashboard.lineChart')}</MenuItem>
                <MenuItem value="bar">{t('dashboard.barChart')}</MenuItem>
                <MenuItem value="composed">{t('dashboard.composedChart')}</MenuItem>
              </Select>
            </FormControl>
            
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

        {/* 快速指标 */}
        <Box display="flex" gap={3} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" color="primary.main" fontWeight="bold">
              {metrics.avgResponseTime}h
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.avgResponse')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="secondary.main" fontWeight="bold">
              {metrics.medianResponseTime}h
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.medianResponse')}
            </Typography>
          </Box>
          <Box>
            <Typography 
              variant="h6" 
              color={metrics.onTimeRate >= 80 ? 'success.main' : 'warning.main'} 
              fontWeight="bold"
            >
              {metrics.onTimeRate}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.onTimeRate')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="info.main" fontWeight="bold">
              {metrics.totalEmails.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.totalProcessed')}
            </Typography>
          </Box>
        </Box>

        {/* 图表区域 */}
        <Box sx={{ height: height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ResponseTimeChart;