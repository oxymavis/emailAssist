import React, { useState, useMemo } from 'react';
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
  ButtonGroup,
  Button,
  useTheme,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  Fullscreen as FullscreenIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
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
} from 'recharts';

import { EmailVolumeData, ChartFilter, TimeRange, AdvancedChartProps } from '@/types';

interface EmailVolumeChartProps extends AdvancedChartProps {
  data: EmailVolumeData[];
  chartType?: 'line' | 'area' | 'bar';
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
}

export const EmailVolumeChart: React.FC<EmailVolumeChartProps> = ({
  data,
  chartType = 'line',
  height = 350,
  interactive = true,
  onDataClick,
  filters = [],
  timeRange,
  showLegend = true,
  showGrid = true,
  animate = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedChart, setSelectedChart] = useState<'line' | 'area' | 'bar'>(chartType);
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 数据处理和过滤
  const processedData = useMemo(() => {
    let filteredData = [...data];

    // 应用时间范围过滤
    if (timeRange) {
      filteredData = filteredData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(timeRange.startDate) && itemDate <= new Date(timeRange.endDate);
      });
    }

    // 应用其他过滤器
    filters.forEach(filter => {
      // 实现过滤逻辑
    });

    return filteredData.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data, filters, timeRange]);

  // 图表配置
  const chartConfig = {
    colors: {
      total: theme.palette.primary.main,
      received: theme.palette.info.main,
      sent: theme.palette.success.main,
      unread: theme.palette.warning.main,
      processed: theme.palette.secondary.main,
    },
    strokeWidth: 2,
    animationDuration: animate ? 800 : 0,
  };

  // 处理数据点击
  const handleDataClick = (data: any, index: number) => {
    if (interactive && onDataClick) {
      onDataClick({
        ...data,
        chartType: 'email-volume',
        index,
      });
    }
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card sx={{ p: 2, minWidth: 200 }}>
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
                {entry.value.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Card>
      );
    }
    return null;
  };

  // 渲染图表
  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      onClick: handleDataClick,
    };

    switch (selectedChart) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey="total"
              stackId="1"
              stroke={chartConfig.colors.total}
              fill={chartConfig.colors.total}
              fillOpacity={0.6}
              name={t('dashboard.totalEmails')}
              animationDuration={chartConfig.animationDuration}
            />
            <Area
              type="monotone"
              dataKey="received"
              stackId="2"
              stroke={chartConfig.colors.received}
              fill={chartConfig.colors.received}
              fillOpacity={0.6}
              name={t('dashboard.receivedEmails')}
              animationDuration={chartConfig.animationDuration}
            />
            <Area
              type="monotone"
              dataKey="processed"
              stackId="3"
              stroke={chartConfig.colors.processed}
              fill={chartConfig.colors.processed}
              fillOpacity={0.6}
              name={t('dashboard.processedEmails')}
              animationDuration={chartConfig.animationDuration}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Bar
              dataKey="received"
              fill={chartConfig.colors.received}
              name={t('dashboard.receivedEmails')}
              animationDuration={chartConfig.animationDuration}
            />
            <Bar
              dataKey="sent"
              fill={chartConfig.colors.sent}
              name={t('dashboard.sentEmails')}
              animationDuration={chartConfig.animationDuration}
            />
            <Bar
              dataKey="processed"
              fill={chartConfig.colors.processed}
              name={t('dashboard.processedEmails')}
              animationDuration={chartConfig.animationDuration}
            />
          </BarChart>
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey="total"
              stroke={chartConfig.colors.total}
              strokeWidth={chartConfig.strokeWidth}
              name={t('dashboard.totalEmails')}
              animationDuration={chartConfig.animationDuration}
              dot={{ fill: chartConfig.colors.total, strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="received"
              stroke={chartConfig.colors.received}
              strokeWidth={chartConfig.strokeWidth}
              name={t('dashboard.receivedEmails')}
              animationDuration={chartConfig.animationDuration}
              dot={{ fill: chartConfig.colors.received, strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="processed"
              stroke={chartConfig.colors.processed}
              strokeWidth={chartConfig.strokeWidth}
              name={t('dashboard.processedEmails')}
              animationDuration={chartConfig.animationDuration}
              dot={{ fill: chartConfig.colors.processed, strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="unread"
              stroke={chartConfig.colors.unread}
              strokeWidth={chartConfig.strokeWidth}
              name={t('dashboard.unreadEmails')}
              animationDuration={chartConfig.animationDuration}
              dot={{ fill: chartConfig.colors.unread, strokeWidth: 2, r: 4 }}
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
            {t('dashboard.emailVolumeAnalysis')}
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
                  <TimelineIcon fontSize="small" />
                </Button>
                <Button
                  onClick={() => setSelectedChart('bar')}
                  variant={selectedChart === 'bar' ? 'contained' : 'outlined'}
                >
                  <BarChartIcon fontSize="small" />
                </Button>
              </ButtonGroup>

              {/* 指标选择 */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t('dashboard.metric')}</InputLabel>
                <Select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  label={t('dashboard.metric')}
                >
                  <MenuItem value="all">{t('common.all')}</MenuItem>
                  <MenuItem value="received">{t('dashboard.received')}</MenuItem>
                  <MenuItem value="sent">{t('dashboard.sent')}</MenuItem>
                  <MenuItem value="processed">{t('dashboard.processed')}</MenuItem>
                </Select>
              </FormControl>

              {/* 工具按钮 */}
              <Tooltip title={t('common.filter')}>
                <IconButton size="small">
                  <FilterIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('common.fullscreen')}>
                <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)}>
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
      </CardContent>
      
      <Box sx={{ flex: 1, px: 2, pb: 2 }}>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

export default EmailVolumeChart;