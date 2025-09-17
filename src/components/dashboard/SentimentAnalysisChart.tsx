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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  FullscreenOutlined,
  DownloadOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined,
  SentimentSatisfiedOutlined,
  SentimentNeutralOutlined,
  SentimentDissatisfiedOutlined,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { SentimentData, WidgetConfig } from '@/types';

interface SentimentAnalysisChartProps {
  data: SentimentData[];
  config?: WidgetConfig;
  onDataClick?: (data: any) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  height?: number;
}

const SentimentAnalysisChart: React.FC<SentimentAnalysisChartProps> = ({
  data,
  config = {
    chartType: 'donut',
    showLegend: true,
    showDetails: true,
    showTrends: true,
  },
  onDataClick,
  onExport,
  onFullscreen,
  height = 300,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 图表类型状态
  const [viewMode, setViewMode] = React.useState<'donut' | 'pie' | 'bar'>(
    (config.chartType as 'donut' | 'pie' | 'bar') || 'donut'
  );

  // 格式化数据
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      name: t(`sentiment.${item.sentiment}`),
      label: `${t(`sentiment.${item.sentiment}`)} (${item.percentage}%)`,
      value: item.count,
    }));
  }, [data, t]);

  // 计算情感指标
  const sentimentMetrics = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    const positive = data.find(item => item.sentiment === 'positive')?.count || 0;
    const negative = data.find(item => item.sentiment === 'negative')?.count || 0;
    const neutral = data.find(item => item.sentiment === 'neutral')?.count || 0;
    
    const positiveRate = total > 0 ? (positive / total) * 100 : 0;
    const negativeRate = total > 0 ? (negative / total) * 100 : 0;
    const neutralRate = total > 0 ? (neutral / total) * 100 : 0;
    
    // 计算情感趋势（基于前一周数据对比）
    const positiveTrend = data.find(item => item.sentiment === 'positive')?.trend || 0;
    const negativeTrend = data.find(item => item.sentiment === 'negative')?.trend || 0;
    
    return {
      total,
      positiveRate: Math.round(positiveRate * 100) / 100,
      negativeRate: Math.round(negativeRate * 100) / 100,
      neutralRate: Math.round(neutralRate * 100) / 100,
      positiveTrend,
      negativeTrend,
      dominantSentiment: positive > negative && positive > neutral ? 'positive' 
        : negative > positive && negative > neutral ? 'negative' : 'neutral',
    };
  }, [data]);

  // 获取情感图标
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <SentimentSatisfiedOutlined sx={{ color: theme.palette.success.main }} />;
      case 'negative':
        return <SentimentDissatisfiedOutlined sx={{ color: theme.palette.error.main }} />;
      default:
        return <SentimentNeutralOutlined sx={{ color: theme.palette.warning.main }} />;
    }
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
              {getSentimentIcon(data.sentiment)}
              <Typography variant="subtitle2" sx={{ ml: 1 }}>
                {data.name}
              </Typography>
            </Box>
            <Typography variant="body2" gutterBottom>
              {t('dashboard.emailCount')}: <strong>{data.value}</strong>
            </Typography>
            <Typography variant="body2" gutterBottom>
              {t('dashboard.percentage')}: <strong>{data.percentage}%</strong>
            </Typography>
            {data.trend !== undefined && (
              <Box display="flex" alignItems="center">
                {data.trend >= 0 ? (
                  <TrendingUpOutlined fontSize="small" sx={{ color: 'success.main', mr: 0.5 }} />
                ) : (
                  <TrendingDownOutlined fontSize="small" sx={{ color: 'error.main', mr: 0.5 }} />
                )}
                <Typography variant="caption" 
                  sx={{ color: data.trend >= 0 ? 'success.main' : 'error.main' }}>
                  {data.trend >= 0 ? '+' : ''}{data.trend}% {t('dashboard.weeklyChange')}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  // 处理数据点击
  const handleDataClick = (data: any, index: number) => {
    if (onDataClick) {
      onDataClick({ ...data, index });
    }
  };

  // 渲染图表
  const renderChart = () => {
    if (viewMode === 'bar') {
      return (
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value" 
            onClick={handleDataClick}
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    return (
      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percentage }) => `${name} ${percentage}%`}
          outerRadius={viewMode === 'donut' ? 80 : 90}
          innerRadius={viewMode === 'donut' ? 40 : 0}
          fill="#8884d8"
          dataKey="value"
          onClick={handleDataClick}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color} 
              stroke={theme.palette.background.paper}
              strokeWidth={2}
            />
          ))}
        </Pie>
        <RechartsTooltip content={<CustomTooltip />} />
        {config.showLegend && <Legend />}
      </PieChart>
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* 头部控制区 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {t('dashboard.sentimentAnalysis')}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                icon={getSentimentIcon(sentimentMetrics.dominantSentiment)}
                label={`${t('dashboard.dominant')}: ${t(`sentiment.${sentimentMetrics.dominantSentiment}`)}`}
                size="small"
                variant="outlined"
                color={
                  sentimentMetrics.dominantSentiment === 'positive' ? 'success' :
                  sentimentMetrics.dominantSentiment === 'negative' ? 'error' : 'warning'
                }
              />
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'donut' | 'pie' | 'bar')}
                variant="outlined"
              >
                <MenuItem value="donut">{t('dashboard.donutChart')}</MenuItem>
                <MenuItem value="pie">{t('dashboard.pieChart')}</MenuItem>
                <MenuItem value="bar">{t('dashboard.barChart')}</MenuItem>
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

        <Box display="flex" height="calc(100% - 80px)">
          {/* 图表区域 */}
          <Box sx={{ flex: 1, minHeight: height }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </Box>

          {/* 详细信息侧边栏 */}
          {config.showDetails && (
            <Box sx={{ width: 200, ml: 2, borderLeft: 1, borderColor: 'divider', pl: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {t('dashboard.detailedBreakdown')}
              </Typography>
              
              <List dense>
                {data.map((item, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {getSentimentIcon(item.sentiment)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="body2" fontWeight="500">
                            {t(`sentiment.${item.sentiment}`)}
                          </Typography>
                          <Typography variant="h6" color="primary.main" fontWeight="bold">
                            {item.count}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.percentage}%
                          </Typography>
                          {config.showTrends && item.trend !== undefined && (
                            <Box display="flex" alignItems="center" sx={{ mt: 0.5 }}>
                              {item.trend >= 0 ? (
                                <TrendingUpOutlined fontSize="small" sx={{ color: 'success.main' }} />
                              ) : (
                                <TrendingDownOutlined fontSize="small" sx={{ color: 'error.main' }} />
                              )}
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  ml: 0.5, 
                                  color: item.trend >= 0 ? 'success.main' : 'error.main' 
                                }}
                              >
                                {item.trend >= 0 ? '+' : ''}{item.trend}%
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              
              {/* 总体统计 */}
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  {t('dashboard.overallSentiment')}
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {sentimentMetrics.total.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.totalAnalyzed')}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default SentimentAnalysisChart;