/**
 * Advanced Report Analytics Component
 * 高级报告分析组件 - 交互式数据分析和可视化
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tab,
  Tabs,
  Button,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material';
import {
  Analytics,
  Timeline,
  PieChart,
  BarChart,
  ShowChart,
  TrendingUp,
  TrendingDown,
  FilterList,
  Download,
  Share,
  Refresh,
  Fullscreen,
  Settings,
  Insights,
  Compare,
  Psychology,
  Speed,
  Assessment,
  Warning,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Treemap,
} from 'recharts';
import { format, subDays, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface AnalyticsData {
  timeSeriesData: Array<{
    date: string;
    totalEmails: number;
    processedEmails: number;
    responseTime: number;
    sentimentPositive: number;
    sentimentNegative: number;
    sentimentNeutral: number;
    urgentEmails: number;
    categories: Record<string, number>;
  }>;
  distributionData: {
    sentiment: Array<{ name: string; value: number; color: string }>;
    urgency: Array<{ name: string; value: number; color: string }>;
    categories: Array<{ name: string; value: number; size: number }>;
    senders: Array<{ name: string; count: number; avgResponseTime: number }>;
  };
  insights: Array<{
    id: string;
    type: 'trend' | 'anomaly' | 'recommendation' | 'prediction';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    value: number;
    change: number;
    timestamp: Date;
  }>;
  comparisons: Array<{
    metric: string;
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

interface AdvancedReportAnalyticsProps {
  data: AnalyticsData;
  onDataRefresh: () => void;
  onExportData: (format: string) => void;
  onShareReport: () => void;
}

const AdvancedReportAnalytics: React.FC<AdvancedReportAnalyticsProps> = ({
  data,
  onDataRefresh,
  onExportData,
  onShareReport,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(0);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'composed'>('line');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['totalEmails', 'processedEmails']);
  const [showPredictions, setShowPredictions] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  const [customAnalysisDialog, setCustomAnalysisDialog] = useState(false);
  const [correlationAnalysis, setCorrelationAnalysis] = useState<{
    metric1: string;
    metric2: string;
    result?: {
      correlation: number;
      significance: string;
      interpretation: string;
    };
  }>({
    metric1: 'totalEmails',
    metric2: 'responseTime',
  });

  // 可用指标
  const availableMetrics = [
    { key: 'totalEmails', label: t('analytics.metrics.totalEmails'), color: '#1976d2' },
    { key: 'processedEmails', label: t('analytics.metrics.processedEmails'), color: '#2e7d32' },
    { key: 'responseTime', label: t('analytics.metrics.responseTime'), color: '#ed6c02' },
    { key: 'sentimentPositive', label: t('analytics.metrics.positiveEmails'), color: '#4caf50' },
    { key: 'sentimentNegative', label: t('analytics.metrics.negativeEmails'), color: '#f44336' },
    { key: 'urgentEmails', label: t('analytics.metrics.urgentEmails'), color: '#ff9800' },
  ];

  // 根据时间范围过滤数据
  const filteredTimeSeriesData = useMemo(() => {
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoffDate = subDays(new Date(), daysBack);

    return data.timeSeriesData.filter(item => new Date(item.date) >= cutoffDate);
  }, [data.timeSeriesData, timeRange]);

  // 计算关键洞察
  const keyInsights = useMemo(() => {
    const insights = [];

    // 趋势分析
    if (filteredTimeSeriesData.length >= 2) {
      const recent = filteredTimeSeriesData.slice(-7);
      const previous = filteredTimeSeriesData.slice(-14, -7);

      const recentAvg = recent.reduce((sum, item) => sum + item.totalEmails, 0) / recent.length;
      const previousAvg = previous.reduce((sum, item) => sum + item.totalEmails, 0) / previous.length;
      const trend = ((recentAvg - previousAvg) / previousAvg) * 100;

      if (Math.abs(trend) > 10) {
        insights.push({
          id: 'email-volume-trend',
          type: 'trend' as const,
          severity: Math.abs(trend) > 25 ? 'high' as const : 'medium' as const,
          title: trend > 0 ? t('analytics.insights.emailVolumeIncrease') : t('analytics.insights.emailVolumeDecrease'),
          description: t('analytics.insights.trendDescription', { change: Math.abs(trend).toFixed(1) }),
          value: recentAvg,
          change: trend,
          timestamp: new Date(),
        });
      }
    }

    // 响应时间异常检测
    const responseTimeData = filteredTimeSeriesData.map(item => item.responseTime);
    const avgResponseTime = responseTimeData.reduce((sum, time) => sum + time, 0) / responseTimeData.length;
    const recentResponseTime = responseTimeData.slice(-3).reduce((sum, time) => sum + time, 0) / 3;

    if (recentResponseTime > avgResponseTime * 1.5) {
      insights.push({
        id: 'response-time-anomaly',
        type: 'anomaly' as const,
        severity: 'high' as const,
        title: t('analytics.insights.slowResponseTime'),
        description: t('analytics.insights.responseTimeDescription', {
          current: recentResponseTime.toFixed(1),
          average: avgResponseTime.toFixed(1)
        }),
        value: recentResponseTime,
        change: ((recentResponseTime - avgResponseTime) / avgResponseTime) * 100,
        timestamp: new Date(),
      });
    }

    // 情感分析洞察
    const totalSentiment = data.distributionData.sentiment.reduce((sum, item) => sum + item.value, 0);
    const negativeRatio = (data.distributionData.sentiment.find(item => item.name === 'negative')?.value || 0) / totalSentiment;

    if (negativeRatio > 0.3) {
      insights.push({
        id: 'high-negative-sentiment',
        type: 'recommendation' as const,
        severity: 'high' as const,
        title: t('analytics.insights.highNegativeSentiment'),
        description: t('analytics.insights.sentimentDescription', { percentage: (negativeRatio * 100).toFixed(1) }),
        value: negativeRatio * 100,
        change: 0,
        timestamp: new Date(),
      });
    }

    return insights;
  }, [filteredTimeSeriesData, data.distributionData, t]);

  // 执行相关性分析
  const performCorrelationAnalysis = () => {
    const metric1Data = filteredTimeSeriesData.map(item => item[correlationAnalysis.metric1 as keyof typeof item] as number);
    const metric2Data = filteredTimeSeriesData.map(item => item[correlationAnalysis.metric2 as keyof typeof item] as number);

    // 简单的皮尔森相关系数计算
    const n = metric1Data.length;
    const sum1 = metric1Data.reduce((a, b) => a + b, 0);
    const sum2 = metric2Data.reduce((a, b) => a + b, 0);
    const sum1Sq = metric1Data.reduce((a, b) => a + b * b, 0);
    const sum2Sq = metric2Data.reduce((a, b) => a + b * b, 0);
    const pSum = metric1Data.map((v, i) => v * metric2Data[i]).reduce((a, b) => a + b, 0);

    const correlation = (n * pSum - sum1 * sum2) / Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));

    let significance = '';
    let interpretation = '';

    if (Math.abs(correlation) > 0.8) {
      significance = t('analytics.correlation.veryStrong');
      interpretation = correlation > 0 ? t('analytics.correlation.positiveStrong') : t('analytics.correlation.negativeStrong');
    } else if (Math.abs(correlation) > 0.6) {
      significance = t('analytics.correlation.strong');
      interpretation = correlation > 0 ? t('analytics.correlation.positive') : t('analytics.correlation.negative');
    } else if (Math.abs(correlation) > 0.4) {
      significance = t('analytics.correlation.moderate');
      interpretation = t('analytics.correlation.moderate');
    } else {
      significance = t('analytics.correlation.weak');
      interpretation = t('analytics.correlation.noSignificant');
    }

    setCorrelationAnalysis(prev => ({
      ...prev,
      result: {
        correlation: Number(correlation.toFixed(3)),
        significance,
        interpretation,
      },
    }));
  };

  const renderTimeSeriesChart = () => {
    const ChartComponent = chartType === 'line' ? LineChart :
                          chartType === 'area' ? AreaChart :
                          chartType === 'bar' ? RechartsBarChart : ComposedChart;

    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {t('analytics.timeSeriesAnalysis')}
            </Typography>
            <Stack direction="row" spacing={1}>
              <FormControl size="small">
                <InputLabel>{t('analytics.chartType')}</InputLabel>
                <Select
                  value={chartType}
                  label={t('analytics.chartType')}
                  onChange={(e) => setChartType(e.target.value as any)}
                >
                  <MenuItem value="line">{t('analytics.line')}</MenuItem>
                  <MenuItem value="area">{t('analytics.area')}</MenuItem>
                  <MenuItem value="bar">{t('analytics.bar')}</MenuItem>
                  <MenuItem value="composed">{t('analytics.composed')}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel>{t('analytics.timeRange')}</InputLabel>
                <Select
                  value={timeRange}
                  label={t('analytics.timeRange')}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                >
                  <MenuItem value="7d">{t('analytics.last7Days')}</MenuItem>
                  <MenuItem value="30d">{t('analytics.last30Days')}</MenuItem>
                  <MenuItem value="90d">{t('analytics.last90Days')}</MenuItem>
                  <MenuItem value="1y">{t('analytics.lastYear')}</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={t('analytics.fullscreen')}>
                <IconButton onClick={() => setFullscreenChart('timeseries')}>
                  <Fullscreen />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('analytics.selectMetrics')}:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {availableMetrics.map((metric) => (
                <Chip
                  key={metric.key}
                  label={metric.label}
                  clickable
                  color={selectedMetrics.includes(metric.key) ? 'primary' : 'default'}
                  variant={selectedMetrics.includes(metric.key) ? 'filled' : 'outlined'}
                  onClick={() => {
                    setSelectedMetrics(prev =>
                      prev.includes(metric.key)
                        ? prev.filter(m => m !== metric.key)
                        : [...prev, metric.key]
                    );
                  }}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>

          <ResponsiveContainer width="100%" height={400}>
            <ChartComponent data={filteredTimeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), 'MM-dd')}
              />
              <YAxis />
              <RechartsTooltip
                labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
              />
              <Legend />

              {selectedMetrics.map((metricKey) => {
                const metric = availableMetrics.find(m => m.key === metricKey);
                if (!metric) return null;

                if (chartType === 'line') {
                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      stroke={metric.color}
                      strokeWidth={2}
                      name={metric.label}
                      dot={{ r: 4 }}
                    />
                  );
                } else if (chartType === 'area') {
                  return (
                    <Area
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      stackId="1"
                      stroke={metric.color}
                      fill={metric.color}
                      fillOpacity={0.6}
                      name={metric.label}
                    />
                  );
                } else if (chartType === 'bar') {
                  return (
                    <Bar
                      key={metricKey}
                      dataKey={metricKey}
                      fill={metric.color}
                      name={metric.label}
                    />
                  );
                } else { // composed
                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      stroke={metric.color}
                      strokeWidth={2}
                      name={metric.label}
                    />
                  );
                }
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderDistributionAnalysis = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('analytics.sentimentDistribution')}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={data.distributionData.sentiment}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.distributionData.sentiment.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('analytics.urgencyDistribution')}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={data.distributionData.urgency}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('analytics.categoryTreemap')}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={data.distributionData.categories}
                dataKey="size"
                aspectRatio={4/3}
                stroke="#fff"
                fill="#8884d8"
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderInsightsPanel = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                {t('analytics.aiInsights')}
              </Typography>
              <Button
                startIcon={<Psychology />}
                variant="outlined"
                onClick={() => {
                  // 触发AI洞察重新分析
                  onDataRefresh();
                }}
              >
                {t('analytics.generateInsights')}
              </Button>
            </Box>

            <List>
              {keyInsights.map((insight) => (
                <ListItem key={insight.id}>
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        bgcolor:
                          insight.severity === 'high' ? 'error.main' :
                          insight.severity === 'medium' ? 'warning.main' : 'info.main'
                      }}
                    >
                      {insight.type === 'trend' && <TrendingUp />}
                      {insight.type === 'anomaly' && <Warning />}
                      {insight.type === 'recommendation' && <Insights />}
                      {insight.type === 'prediction' && <Speed />}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={insight.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {insight.description}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                          <Chip
                            label={insight.type}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={insight.severity}
                            size="small"
                            color={
                              insight.severity === 'high' ? 'error' :
                              insight.severity === 'medium' ? 'warning' : 'info'
                            }
                          />
                          {insight.change !== 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {insight.change > 0 ? '+' : ''}{insight.change.toFixed(1)}%
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {keyInsights.length === 0 && (
              <Alert severity="info">
                {t('analytics.noInsights')}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('analytics.performanceComparison')}
            </Typography>
            <Grid container spacing={2}>
              {data.comparisons.map((comparison) => (
                <Grid item xs={12} md={6} lg={3} key={comparison.metric}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {comparison.metric}
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {comparison.current}
                    </Typography>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      {comparison.trend === 'up' && <TrendingUp color="success" />}
                      {comparison.trend === 'down' && <TrendingDown color="error" />}
                      {comparison.trend === 'stable' && <CheckCircle color="info" />}
                      <Typography
                        variant="body2"
                        color={
                          comparison.trend === 'up' ? 'success.main' :
                          comparison.trend === 'down' ? 'error.main' : 'info.main'
                        }
                      >
                        {comparison.change > 0 ? '+' : ''}{comparison.change.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('analytics.previousPeriod')}: {comparison.previous}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderCustomAnalysisDialog = () => (
    <Dialog
      open={customAnalysisDialog}
      onClose={() => setCustomAnalysisDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('analytics.customAnalysis')}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ pt: 2 }}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.correlationAnalysis')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>{t('analytics.metric1')}</InputLabel>
              <Select
                value={correlationAnalysis.metric1}
                label={t('analytics.metric1')}
                onChange={(e) => setCorrelationAnalysis(prev => ({ ...prev, metric1: e.target.value }))}
              >
                {availableMetrics.map((metric) => (
                  <MenuItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>{t('analytics.metric2')}</InputLabel>
              <Select
                value={correlationAnalysis.metric2}
                label={t('analytics.metric2')}
                onChange={(e) => setCorrelationAnalysis(prev => ({ ...prev, metric2: e.target.value }))}
              >
                {availableMetrics.map((metric) => (
                  <MenuItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={performCorrelationAnalysis}
              fullWidth
            >
              {t('analytics.performAnalysis')}
            </Button>
          </Grid>

          {correlationAnalysis.result && (
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  {t('analytics.correlationResults')}
                </Typography>
                <Typography variant="body2">
                  {t('analytics.correlationCoefficient')}: {correlationAnalysis.result.correlation}
                </Typography>
                <Typography variant="body2">
                  {t('analytics.significance')}: {correlationAnalysis.result.significance}
                </Typography>
                <Typography variant="body2">
                  {t('analytics.interpretation')}: {correlationAnalysis.result.interpretation}
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCustomAnalysisDialog(false)}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          {t('analytics.title')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<Analytics />}
            variant="outlined"
            onClick={() => setCustomAnalysisDialog(true)}
          >
            {t('analytics.customAnalysis')}
          </Button>
          <Button
            startIcon={<Download />}
            variant="outlined"
            onClick={() => onExportData('excel')}
          >
            {t('common.export')}
          </Button>
          <Button
            startIcon={<Share />}
            variant="outlined"
            onClick={onShareReport}
          >
            {t('common.share')}
          </Button>
          <Button
            startIcon={<Refresh />}
            variant="contained"
            onClick={onDataRefresh}
          >
            {t('common.refresh')}
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab icon={<Timeline />} label={t('analytics.timeSeries')} />
          <Tab icon={<PieChart />} label={t('analytics.distribution')} />
          <Tab icon={<Psychology />} label={t('analytics.insights')} />
        </Tabs>
      </Paper>

      {activeTab === 0 && renderTimeSeriesChart()}
      {activeTab === 1 && renderDistributionAnalysis()}
      {activeTab === 2 && renderInsightsPanel()}

      {renderCustomAnalysisDialog()}

      {/* 全屏图表对话框 */}
      <Dialog
        open={!!fullscreenChart}
        onClose={() => setFullscreenChart(null)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {t('analytics.fullscreenView')}
            </Typography>
            <IconButton onClick={() => setFullscreenChart(null)}>
              <Fullscreen />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {fullscreenChart === 'timeseries' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredTimeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MM-dd')}
                />
                <YAxis />
                <RechartsTooltip
                  labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
                />
                <Legend />

                {selectedMetrics.map((metricKey) => {
                  const metric = availableMetrics.find(m => m.key === metricKey);
                  if (!metric) return null;

                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      stroke={metric.color}
                      strokeWidth={3}
                      name={metric.label}
                      dot={{ r: 6 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AdvancedReportAnalytics;