/**
 * Advanced Metrics Chart Component
 * P1 Feature - Enhanced data visualization
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline,
  Refresh,
  Download,
  Fullscreen,
  Info
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  ScatterChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
  Sankey
} from 'recharts';
import { useTheme } from '@mui/material/styles';

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'pie' | 'scatter' | 'radar' | 'treemap' | 'sankey' | 'heatmap';
  title: string;
  description?: string;
  dataSource: string;
  metrics: string[];
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d' | '90d';
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  filters?: Record<string, any>;
  customization?: {
    colors?: string[];
    showTrend?: boolean;
    showComparison?: boolean;
    showForecast?: boolean;
  };
}

export interface AdvancedMetricsProps {
  config: ChartConfig;
  data?: MetricDataPoint[];
  loading?: boolean;
  error?: string;
  onConfigChange?: (config: ChartConfig) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  height?: number;
  realTime?: boolean;
}

const CHART_COLORS = [
  '#2196f3', '#ff9800', '#4caf50', '#f44336', '#9c27b0',
  '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
];

const METRIC_CARDS_DATA = [
  { label: 'Total Emails', value: '1,234', change: '+12%', trend: 'up', color: '#2196f3' },
  { label: 'Urgent Emails', value: '89', change: '+5%', trend: 'up', color: '#ff9800' },
  { label: 'Response Time', value: '2.3h', change: '-15%', trend: 'down', color: '#4caf50' },
  { label: 'Team Efficiency', value: '94%', change: '+3%', trend: 'up', color: '#9c27b0' }
];

export const AdvancedMetricsChart: React.FC<AdvancedMetricsProps> = ({
  config,
  data = [],
  loading = false,
  error,
  onConfigChange,
  onRefresh,
  onExport,
  height = 400,
  realTime = false
}) => {
  const theme = useTheme();
  const [viewType, setViewType] = useState<'chart' | 'table' | 'cards'>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);

  // Generate sample data if none provided
  const chartData = useMemo(() => {
    if (data.length > 0) return data;

    // Generate sample data based on chart type and time range
    return generateSampleData(config.type, config.timeRange);
  }, [data, config.type, config.timeRange]);

  const processedData = useMemo(() => {
    return processChartData(chartData, config);
  }, [chartData, config]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (realTime && !loading) {
      interval = setInterval(() => {
        onRefresh?.();
      }, 30000); // Refresh every 30 seconds for real-time data
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTime, loading, onRefresh]);

  const handleChartTypeChange = (newType: ChartConfig['type']) => {
    const newConfig = { ...config, type: newType };
    onConfigChange?.(newConfig);
  };

  const handleTimeRangeChange = (newRange: ChartConfig['timeRange']) => {
    const newConfig = { ...config, timeRange: newRange };
    onConfigChange?.(newConfig);
  };

  const renderChart = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height={height}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      );
    }

    const chartProps = {
      data: processedData,
      margin: { top: 20, right: 30, left: 20, bottom: 60 }
    };

    switch (config.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="timestamp"
                stroke={theme.palette.text.secondary}
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {config.metrics.map((metric, index) => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={animationEnabled ? 1500 : 0}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} />
              <YAxis stroke={theme.palette.text.secondary} />
              <RechartsTooltip />
              <Legend />
              {config.metrics.map((metric, index) => (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stackId="1"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.3}
                  animationDuration={animationEnabled ? 1500 : 0}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} />
              <YAxis stroke={theme.palette.text.secondary} />
              <RechartsTooltip />
              <Legend />
              {config.metrics.map((metric, index) => (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  animationDuration={animationEnabled ? 1500 : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={Math.min(height * 0.3, 120)}
                fill="#8884d8"
                dataKey="value"
                animationDuration={animationEnabled ? 1500 : 0}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="x" type="number" stroke={theme.palette.text.secondary} />
              <YAxis dataKey="y" type="number" stroke={theme.palette.text.secondary} />
              <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                name="Data Points"
                data={processedData}
                fill={CHART_COLORS[0]}
                animationDuration={animationEnabled ? 1500 : 0}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={processedData}>
              <PolarGrid stroke={theme.palette.divider} />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis />
              <Radar
                name="Metrics"
                dataKey="value"
                stroke={CHART_COLORS[0]}
                fill={CHART_COLORS[0]}
                fillOpacity={0.3}
                animationDuration={animationEnabled ? 1500 : 0}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography variant="body2" color="textSecondary">
              Chart type not supported: {config.type}
            </Typography>
          </Box>
        );
    }
  };

  const renderMetricCards = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {METRIC_CARDS_DATA.map((metric, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${metric.color}15 0%, ${metric.color}05 100%)`,
              border: `1px solid ${metric.color}30`
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="between" alignItems="start">
                <Box flex={1}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {metric.label}
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                    {metric.value}
                  </Typography>
                  <Box display="flex" alignItems="center">
                    {metric.trend === 'up' ? (
                      <TrendingUp sx={{ color: '#4caf50', mr: 0.5, fontSize: '1rem' }} />
                    ) : (
                      <TrendingDown sx={{ color: '#f44336', mr: 0.5, fontSize: '1rem' }} />
                    )}
                    <Typography
                      variant="caption"
                      sx={{
                        color: metric.trend === 'up' ? '#4caf50' : '#f44336',
                        fontWeight: 600
                      }}
                    >
                      {metric.change}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: `${metric.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ShowChart sx={{ color: metric.color, fontSize: '1.2rem' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderDataTable = () => (
    <Box sx={{ overflow: 'auto', maxHeight: height }}>
      <Typography variant="h6" gutterBottom>
        Data Table
      </Typography>
      {/* Implementation would include a data table component */}
      <Typography variant="body2" color="textSecondary">
        Data table view - Implementation pending
      </Typography>
    </Box>
  );

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        height: isFullscreen ? '100vh' : 'auto',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto'
      }}
    >
      {/* Header */}
      <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" component="div" gutterBottom>
            {config.title}
            {realTime && (
              <Chip
                label="Live"
                size="small"
                color="success"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          {config.description && (
            <Typography variant="body2" color="textSecondary">
              {config.description}
            </Typography>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          {/* View Type Toggle */}
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(_, newView) => newView && setViewType(newView)}
            size="small"
          >
            <ToggleButton value="cards">
              <Tooltip title="Metric Cards">
                <BarChartIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="chart">
              <Tooltip title="Chart View">
                <ShowChart fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <PieChartIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Action Buttons */}
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} size="small" disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export">
            <IconButton onClick={onExport} size="small">
              <Download />
            </IconButton>
          </Tooltip>

          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton
              onClick={() => setIsFullscreen(!isFullscreen)}
              size="small"
            >
              <Fullscreen />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Controls */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        {/* Chart Type Selector */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Chart Type</InputLabel>
          <Select
            value={config.type}
            label="Chart Type"
            onChange={(e) => handleChartTypeChange(e.target.value as ChartConfig['type'])}
          >
            <MenuItem value="line">Line Chart</MenuItem>
            <MenuItem value="area">Area Chart</MenuItem>
            <MenuItem value="bar">Bar Chart</MenuItem>
            <MenuItem value="pie">Pie Chart</MenuItem>
            <MenuItem value="scatter">Scatter Plot</MenuItem>
            <MenuItem value="radar">Radar Chart</MenuItem>
          </Select>
        </FormControl>

        {/* Time Range Selector */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={config.timeRange}
            label="Time Range"
            onChange={(e) => handleTimeRangeChange(e.target.value as ChartConfig['timeRange'])}
          >
            <MenuItem value="1h">Last Hour</MenuItem>
            <MenuItem value="6h">Last 6 Hours</MenuItem>
            <MenuItem value="24h">Last 24 Hours</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
          </Select>
        </FormControl>

        {/* Metrics Selector */}
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">Metrics:</Typography>
          {config.metrics.map((metric, index) => (
            <Chip
              key={metric}
              label={metric}
              size="small"
              sx={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20` }}
            />
          ))}
        </Box>
      </Box>

      {/* Content */}
      {viewType === 'cards' && renderMetricCards()}
      {viewType === 'chart' && renderChart()}
      {viewType === 'table' && renderDataTable()}

      {/* Footer with data info */}
      <Box
        display="flex"
        justifyContent="between"
        alignItems="center"
        mt={2}
        pt={1}
        borderTop={1}
        borderColor="divider"
      >
        <Typography variant="caption" color="textSecondary">
          Data points: {chartData.length} | Last updated: {new Date().toLocaleTimeString()}
        </Typography>
        <Tooltip title="Chart Information">
          <IconButton size="small">
            <Info fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

// Helper functions
function generateSampleData(chartType: ChartConfig['type'], timeRange: ChartConfig['timeRange']): MetricDataPoint[] {
  const dataPoints: MetricDataPoint[] = [];
  const now = new Date();
  let intervals: number;
  let stepSize: number;

  // Determine intervals and step size based on time range
  switch (timeRange) {
    case '1h':
      intervals = 12;
      stepSize = 5 * 60 * 1000; // 5 minutes
      break;
    case '6h':
      intervals = 24;
      stepSize = 15 * 60 * 1000; // 15 minutes
      break;
    case '24h':
      intervals = 24;
      stepSize = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      intervals = 14;
      stepSize = 12 * 60 * 60 * 1000; // 12 hours
      break;
    case '30d':
      intervals = 30;
      stepSize = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '90d':
      intervals = 30;
      stepSize = 3 * 24 * 60 * 60 * 1000; // 3 days
      break;
    default:
      intervals = 24;
      stepSize = 60 * 60 * 1000;
  }

  for (let i = 0; i < intervals; i++) {
    const timestamp = new Date(now.getTime() - (intervals - i - 1) * stepSize);
    dataPoints.push({
      timestamp: timestamp.toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
      label: timestamp.toLocaleDateString(),
      category: 'sample'
    });
  }

  return dataPoints;
}

function processChartData(data: MetricDataPoint[], config: ChartConfig): any[] {
  // Process data based on chart type and configuration
  switch (config.type) {
    case 'pie':
      // Group data by category for pie chart
      const grouped = data.reduce((acc, item) => {
        const category = item.category || 'Other';
        acc[category] = (acc[category] || 0) + item.value;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([name, value]) => ({ name, value }));

    case 'scatter':
      return data.map((item, index) => ({
        x: index,
        y: item.value,
        name: item.label
      }));

    case 'radar':
      const radarSubjects = ['Performance', 'Efficiency', 'Quality', 'Speed', 'Accuracy'];
      return radarSubjects.map(subject => ({
        subject,
        value: Math.floor(Math.random() * 100) + 50
      }));

    default:
      // For line, area, bar charts, format with timestamp
      return data.map(item => ({
        timestamp: new Date(item.timestamp).toLocaleDateString(),
        [config.metrics[0] || 'value']: item.value,
        ...item.metadata
      }));
  }
}

export default AdvancedMetricsChart;