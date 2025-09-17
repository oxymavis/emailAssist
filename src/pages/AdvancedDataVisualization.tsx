import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Drawer,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Menu,
  MenuList,
  ListItemIcon,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Dashboard as DashboardIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PieChart as PieChartIcon,
  Scatter as ScatterIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  FilterList as FilterIcon,
  ViewModule as LayoutIcon,
  Palette as ThemeIcon,
  Code as CodeIcon,
  CloudDownload as ExportIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts';
import { Responsive, WidthProvider } from 'react-grid-layout';

import {
  visualizationService,
  ChartConfig,
  DashboardLayout,
  DashboardWidget,
  VisualizationData,
  ExportOptions,
  VisualizationTemplate,
  GlobalFilter,
} from '../services/visualizationService';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ height: '100%' }}>
    {value === index && children}
  </div>
);

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff0000', '#00ffff', '#ff00ff', '#ffff00', '#800080'
];

const AdvancedDataVisualization: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [dashboards, setDashboards] = useState<DashboardLayout[]>([]);
  const [templates, setTemplates] = useState<VisualizationTemplate[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartConfig | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardLayout | null>(null);
  const [chartData, setChartData] = useState<Map<string, VisualizationData>>(new Map());

  // 对话框状态
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 图表编辑状态
  const [editingChart, setEditingChart] = useState<Partial<ChartConfig>>({
    title: '',
    type: 'line',
    dataSource: 'emails',
    xAxis: 'date',
    yAxis: ['count'],
    styling: {
      colors: CHART_COLORS,
      theme: 'light',
      width: 400,
      height: 300,
      showLegend: true,
      showGrid: true,
      showTooltip: true,
    },
    interactions: {
      zoom: true,
      pan: true,
      hover: true,
    },
  });

  // 仪表板编辑状态
  const [editingDashboard, setEditingDashboard] = useState<Partial<DashboardLayout>>({
    name: '',
    description: '',
    gridConfig: { cols: 12, rows: 12, gap: 16 },
    widgets: [],
    theme: 'light',
  });

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [chartsData, dashboardsData, templatesData] = await Promise.all([
        Promise.resolve(visualizationService.getAllCharts()),
        Promise.resolve(visualizationService.getAllDashboards()),
        Promise.resolve(visualizationService.getTemplates()),
      ]);

      setCharts(chartsData);
      setDashboards(dashboardsData);
      setTemplates(templatesData);

      // 加载图表数据
      for (const chart of chartsData) {
        loadChartData(chart.id);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = useCallback(async (chartId: string) => {
    setDataLoading(prev => new Set(prev).add(chartId));
    try {
      const data = await visualizationService.getChartData(chartId);
      setChartData(prev => new Map(prev).set(chartId, data));
    } catch (error) {
      console.error(`Failed to load data for chart ${chartId}:`, error);
    } finally {
      setDataLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(chartId);
        return newSet;
      });
    }
  }, []);

  // 图表管理
  const handleCreateChart = async () => {
    try {
      const chart = await visualizationService.createChart(editingChart as Omit<ChartConfig, 'id'>);
      setCharts(prev => [...prev, chart]);
      loadChartData(chart.id);
      setChartDialogOpen(false);
      resetEditingChart();
    } catch (error) {
      console.error('Failed to create chart:', error);
    }
  };

  const handleUpdateChart = async () => {
    if (!selectedChart) return;

    try {
      const updated = await visualizationService.updateChart(selectedChart.id, editingChart);
      if (updated) {
        setCharts(prev => prev.map(c => c.id === updated.id ? updated : c));
        loadChartData(updated.id);
      }
      setChartDialogOpen(false);
      resetEditingChart();
    } catch (error) {
      console.error('Failed to update chart:', error);
    }
  };

  const handleDeleteChart = async (chartId: string) => {
    try {
      await visualizationService.deleteChart(chartId);
      setCharts(prev => prev.filter(c => c.id !== chartId));
      setChartData(prev => {
        const newMap = new Map(prev);
        newMap.delete(chartId);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to delete chart:', error);
    }
  };

  const resetEditingChart = () => {
    setEditingChart({
      title: '',
      type: 'line',
      dataSource: 'emails',
      xAxis: 'date',
      yAxis: ['count'],
      styling: {
        colors: CHART_COLORS,
        theme: 'light',
        width: 400,
        height: 300,
        showLegend: true,
        showGrid: true,
        showTooltip: true,
      },
      interactions: {
        zoom: true,
        pan: true,
        hover: true,
      },
    });
    setSelectedChart(null);
  };

  // 仪表板管理
  const handleCreateDashboard = async () => {
    try {
      const dashboard = await visualizationService.createDashboard(editingDashboard as Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>);
      setDashboards(prev => [...prev, dashboard]);
      setDashboardDialogOpen(false);
      resetEditingDashboard();
    } catch (error) {
      console.error('Failed to create dashboard:', error);
    }
  };

  const handleUpdateDashboard = async () => {
    if (!selectedDashboard) return;

    try {
      const updated = await visualizationService.updateDashboard(selectedDashboard.id, editingDashboard);
      if (updated) {
        setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      }
      setDashboardDialogOpen(false);
      resetEditingDashboard();
    } catch (error) {
      console.error('Failed to update dashboard:', error);
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      await visualizationService.deleteDashboard(dashboardId);
      setDashboards(prev => prev.filter(d => d.id !== dashboardId));
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
    }
  };

  const resetEditingDashboard = () => {
    setEditingDashboard({
      name: '',
      description: '',
      gridConfig: { cols: 12, rows: 12, gap: 16 },
      widgets: [],
      theme: 'light',
    });
    setSelectedDashboard(null);
  };

  // 模板处理
  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      const dashboard = await visualizationService.createFromTemplate(templateId);
      setDashboards(prev => [...prev, dashboard]);

      // 重新加载图表列表
      const newCharts = visualizationService.getAllCharts();
      setCharts(newCharts);

      // 加载新图表的数据
      for (const widget of dashboard.widgets) {
        loadChartData(widget.chartId);
      }
    } catch (error) {
      console.error('Failed to create dashboard from template:', error);
    }
  };

  // 导出功能
  const handleExport = async (type: 'chart' | 'dashboard', id: string, options: ExportOptions) => {
    try {
      const blob = type === 'chart'
        ? await visualizationService.exportChart(id, options)
        : await visualizationService.exportDashboard(id, options);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${id}.${options.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  // 渲染图表
  const renderChart = (chart: ChartConfig, data?: VisualizationData) => {
    if (!data?.data) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height={200}>
          <CircularProgress />
        </Box>
      );
    }

    const chartData = data.data;
    const { styling = {} } = chart;

    const commonProps = {
      width: styling.width || 400,
      height: styling.height || 300,
      data: chartData,
    };

    switch (chart.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={styling.height || 300}>
            <LineChart data={chartData}>
              {styling.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={chart.xAxis} />
              <YAxis />
              {styling.showTooltip && <RechartsTooltip />}
              {styling.showLegend && <Legend />}
              {chart.yAxis?.map((axis, index) => (
                <Line
                  key={axis}
                  type="monotone"
                  dataKey={axis}
                  stroke={styling.colors?.[index] || CHART_COLORS[index]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={styling.height || 300}>
            <BarChart data={chartData}>
              {styling.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={chart.xAxis} />
              <YAxis />
              {styling.showTooltip && <RechartsTooltip />}
              {styling.showLegend && <Legend />}
              {chart.yAxis?.map((axis, index) => (
                <Bar
                  key={axis}
                  dataKey={axis}
                  fill={styling.colors?.[index] || CHART_COLORS[index]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={styling.height || 300}>
            <AreaChart data={chartData}>
              {styling.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={chart.xAxis} />
              <YAxis />
              {styling.showTooltip && <RechartsTooltip />}
              {styling.showLegend && <Legend />}
              {chart.yAxis?.map((axis, index) => (
                <Area
                  key={axis}
                  type="monotone"
                  dataKey={axis}
                  stackId="1"
                  stroke={styling.colors?.[index] || CHART_COLORS[index]}
                  fill={styling.colors?.[index] || CHART_COLORS[index]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={styling.height || 300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey={chart.yAxis?.[0] || 'value'}
                nameKey={chart.xAxis || 'name'}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={styling.colors?.[index % (styling.colors?.length || CHART_COLORS.length)] || CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              {styling.showTooltip && <RechartsTooltip />}
              {styling.showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={styling.height || 300}>
            <ScatterChart data={chartData}>
              {styling.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={chart.xAxis} />
              <YAxis dataKey={chart.yAxis?.[0]} />
              {styling.showTooltip && <RechartsTooltip />}
              {styling.showLegend && <Legend />}
              <Scatter
                dataKey={chart.yAxis?.[0]}
                fill={styling.colors?.[0] || CHART_COLORS[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return <Typography>不支持的图表类型: {chart.type}</Typography>;
    }
  };

  // 图表设计器标签页
  const renderChartDesigner = () => (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">图表设计器</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetEditingChart();
            setChartDialogOpen(true);
          }}
        >
          创建图表
        </Button>
      </Box>

      <Grid container spacing={3}>
        {charts.map((chart) => (
          <Grid item xs={12} sm={6} md={4} key={chart.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" noWrap>
                    {chart.title}
                  </Typography>
                  <Box>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedChart(chart);
                          setEditingChart(chart);
                          setChartDialogOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteChart(chart.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="导出">
                      <IconButton
                        size="small"
                        onClick={() => handleExport('chart', chart.id, { format: 'png' })}
                      >
                        <ExportIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Box mb={2}>
                  <Chip
                    label={chart.type}
                    size="small"
                    color="primary"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={chart.dataSource}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>

                <Box height={200}>
                  {renderChart(chart, chartData.get(chart.id))}
                </Box>

                <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {chartData.get(chart.id)?.metadata.lastUpdated?.toLocaleString() || '未加载'}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => loadChartData(chart.id)}
                    disabled={dataLoading.has(chart.id)}
                  >
                    {dataLoading.has(chart.id) ? <CircularProgress size={16} /> : <RefreshIcon />}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // 仪表板构建器标签页
  const renderDashboardBuilder = () => (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">仪表板构建器</Typography>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => {
            resetEditingDashboard();
            setDashboardDialogOpen(true);
          }}
        >
          创建仪表板
        </Button>
      </Box>

      <Grid container spacing={3}>
        {dashboards.map((dashboard) => (
          <Grid item xs={12} sm={6} md={4} key={dashboard.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" noWrap>
                    {dashboard.name}
                  </Typography>
                  <Box>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedDashboard(dashboard);
                          setEditingDashboard(dashboard);
                          setDashboardDialogOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteDashboard(dashboard.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="分享">
                      <IconButton
                        size="small"
                        onClick={() => visualizationService.shareDashboard(dashboard.id, { public: true, allowEdit: false, allowCopy: true })}
                      >
                        <ShareIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {dashboard.description && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {dashboard.description}
                  </Typography>
                )}

                <Box mb={2}>
                  <Chip
                    label={`${dashboard.widgets.length} 个组件`}
                    size="small"
                    color="primary"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={dashboard.theme}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  创建时间: {dashboard.createdAt.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // 模板库标签页
  const renderTemplateLibrary = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" mb={3}>模板库</Typography>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" mb={1}>
                  {template.name}
                </Typography>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  {template.description}
                </Typography>

                <Box mb={2}>
                  <Chip
                    label={template.category}
                    size="small"
                    color="primary"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  {template.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleCreateFromTemplate(template.id)}
                >
                  使用模板
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="图表设计器" icon={<BarChartIcon />} />
          <Tab label="仪表板构建器" icon={<DashboardIcon />} />
          <Tab label="模板库" icon={<LayoutIcon />} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={activeTab} index={0}>
          {renderChartDesigner()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderDashboardBuilder()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderTemplateLibrary()}
        </TabPanel>
      </Box>

      {/* 图表编辑对话框 */}
      <Dialog
        open={chartDialogOpen}
        onClose={() => setChartDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedChart ? '编辑图表' : '创建图表'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="图表标题"
                value={editingChart.title}
                onChange={(e) => setEditingChart(prev => ({ ...prev, title: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>图表类型</InputLabel>
                <Select
                  value={editingChart.type}
                  onChange={(e) => setEditingChart(prev => ({ ...prev, type: e.target.value as ChartConfig['type'] }))}
                >
                  <MenuItem value="line">线性图</MenuItem>
                  <MenuItem value="bar">柱状图</MenuItem>
                  <MenuItem value="area">面积图</MenuItem>
                  <MenuItem value="pie">饼图</MenuItem>
                  <MenuItem value="scatter">散点图</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>数据源</InputLabel>
                <Select
                  value={editingChart.dataSource}
                  onChange={(e) => setEditingChart(prev => ({ ...prev, dataSource: e.target.value }))}
                >
                  <MenuItem value="emails">邮件数据</MenuItem>
                  <MenuItem value="analytics">分析数据</MenuItem>
                  <MenuItem value="performance">性能数据</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChartDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={selectedChart ? handleUpdateChart : handleCreateChart}
          >
            {selectedChart ? '更新' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 仪表板编辑对话框 */}
      <Dialog
        open={dashboardDialogOpen}
        onClose={() => setDashboardDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedDashboard ? '编辑仪表板' : '创建仪表板'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="仪表板名称"
                value={editingDashboard.name}
                onChange={(e) => setEditingDashboard(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="描述"
                multiline
                rows={3}
                value={editingDashboard.description}
                onChange={(e) => setEditingDashboard(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>主题</InputLabel>
                <Select
                  value={editingDashboard.theme}
                  onChange={(e) => setEditingDashboard(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))}
                >
                  <MenuItem value="light">浅色</MenuItem>
                  <MenuItem value="dark">深色</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDashboardDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={selectedDashboard ? handleUpdateDashboard : handleCreateDashboard}
          >
            {selectedDashboard ? '更新' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          justifyContent="center"
          alignItems="center"
          bgcolor="rgba(255, 255, 255, 0.8)"
          zIndex={9999}
        >
          <CircularProgress size={60} />
        </Box>
      )}
    </Box>
  );
};

export default AdvancedDataVisualization;