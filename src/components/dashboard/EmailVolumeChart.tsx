import React, { useMemo } from 'react';
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
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  FullscreenOutlined,
  FilterListOutlined,
  TrendingUpOutlined,
  DownloadOutlined,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Area,
  AreaChart,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { EmailVolumeData, WidgetConfig, TimeRange } from '@/types';

interface EmailVolumeChartProps {
  data: EmailVolumeData[];
  config?: WidgetConfig;
  timeRange?: TimeRange;
  onDataClick?: (data: any) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  height?: number;
}

const EmailVolumeChart: React.FC<EmailVolumeChartProps> = ({
  data,
  config = {
    chartType: 'line',
    showLegend: true,
    showGrid: true,
    animate: true,
  },
  timeRange,
  onDataClick,
  onExport,
  onFullscreen,
  height = 300,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 图表类型状态
  const [chartType, setChartType] = React.useState<'line' | 'area'>(
    (config.chartType as 'line' | 'area') || 'line'
  );

  // 格式化数据
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MM/dd', { locale: zhCN }),
      fullDate: item.date,
    }));
  }, [data]);

  // 计算趋势指标
  const trendMetrics = useMemo(() => {
    if (data.length < 2) return { trend: 0, total: 0, avgPerDay: 0 };
    
    const recent = data.slice(-7);
    const previous = data.slice(-14, -7);
    
    const recentTotal = recent.reduce((sum, item) => sum + item.total, 0);
    const previousTotal = previous.reduce((sum, item) => sum + item.total, 0);
    
    const trend = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0;
    const total = data.reduce((sum, item) => sum + item.total, 0);
    const avgPerDay = total / data.length;
    
    return {
      trend: Math.round(trend * 100) / 100,
      total,
      avgPerDay: Math.round(avgPerDay),
    };
  }, [data]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {format(new Date(data.fullDate), 'yyyy年MM月dd日', { locale: zhCN })}
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
                <Typography variant="body2" sx={{ mr: 2 }}>
                  {t(`dashboard.${entry.dataKey}`)}:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {entry.value}
                </Typography>
              </Box>
            ))}
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

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
      onClick: handleDataClick,
    };

    const commonElements = (
      <>
        {config.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
        />
        <RechartsTooltip content={<CustomTooltip />} />
        {config.showLegend && <Legend />}
      </>
    );

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          {commonElements}
          <Area
            type="monotone"
            dataKey="total"
            stackId="1"
            stroke={theme.palette.primary.main}
            fill={theme.palette.primary.main}
            fillOpacity={0.3}
            name={t('dashboard.totalEmails')}
          />
          <Area
            type="monotone"
            dataKey="processed"
            stackId="1"
            stroke={theme.palette.success.main}
            fill={theme.palette.success.main}
            fillOpacity={0.3}
            name={t('dashboard.processed')}
          />
          <Area
            type="monotone"
            dataKey="unread"
            stackId="1"
            stroke={theme.palette.warning.main}
            fill={theme.palette.warning.main}
            fillOpacity={0.3}
            name={t('dashboard.unread')}
          />
          <Brush
            dataKey="date"
            height={30}
            stroke={theme.palette.primary.main}
          />
        </AreaChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        {commonElements}
        <Line
          type="monotone"
          dataKey="total"
          stroke={theme.palette.primary.main}
          strokeWidth={3}
          dot={{ r: 4, fill: theme.palette.primary.main }}
          activeDot={{ r: 6 }}
          name={t('dashboard.totalEmails')}
        />
        <Line
          type="monotone"
          dataKey="received"
          stroke={theme.palette.info.main}
          strokeWidth={2}
          strokeDasharray="5 5"
          name={t('dashboard.received')}
        />
        <Line
          type="monotone"
          dataKey="processed"
          stroke={theme.palette.success.main}
          strokeWidth={2}
          name={t('dashboard.processed')}
        />
        <Line
          type="monotone"
          dataKey="unread"
          stroke={theme.palette.warning.main}
          strokeWidth={2}
          name={t('dashboard.unread')}
        />
        <Brush
          dataKey="date"
          height={30}
          stroke={theme.palette.primary.main}
        />
      </LineChart>
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('dashboard.emailVolumeAnalysis')}
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Box display="flex" alignItems="center">
                <TrendingUpOutlined 
                  fontSize="small" 
                  sx={{ 
                    color: trendMetrics.trend >= 0 ? 'success.main' : 'error.main',
                    transform: trendMetrics.trend >= 0 ? 'none' : 'rotate(180deg)',
                    mr: 0.5,
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: trendMetrics.trend >= 0 ? 'success.main' : 'error.main',
                    fontWeight: 500,
                  }}
                >
                  {trendMetrics.trend >= 0 ? '+' : ''}{trendMetrics.trend}%
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.weeklyTrend')}
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'line' | 'area')}
                variant="outlined"
              >
                <MenuItem value="line">{t('dashboard.lineChart')}</MenuItem>
                <MenuItem value="area">{t('dashboard.areaChart')}</MenuItem>
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

        {/* 快速统计 */}
        <Box display="flex" gap={3} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" color="primary.main" fontWeight="bold">
              {trendMetrics.total.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.totalEmails')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="success.main" fontWeight="bold">
              {trendMetrics.avgPerDay.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.avgPerDay')}
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

export default EmailVolumeChart;