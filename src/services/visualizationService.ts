import { EventEmitter } from 'events';

export interface ChartConfig {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'area' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'funnel';
  dataSource: string;
  xAxis?: string;
  yAxis?: string[];
  groupBy?: string;
  filters?: Record<string, any>;
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
  timeRange?: {
    start: Date;
    end: Date;
    granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  styling?: {
    colors?: string[];
    theme?: 'light' | 'dark';
    width?: number;
    height?: number;
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
  };
  interactions?: {
    zoom?: boolean;
    pan?: boolean;
    brush?: boolean;
    click?: boolean;
    hover?: boolean;
  };
  realTime?: {
    enabled: boolean;
    interval: number;
    maxDataPoints: number;
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  gridConfig: {
    cols: number;
    rows: number;
    gap: number;
  };
  widgets: DashboardWidget[];
  filters?: GlobalFilter[];
  theme?: 'light' | 'dark';
  autoRefresh?: {
    enabled: boolean;
    interval: number;
  };
  sharing?: {
    public: boolean;
    allowEdit: boolean;
    allowCopy: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  chartId: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  title?: string;
  config?: {
    showHeader?: boolean;
    allowResize?: boolean;
    allowMove?: boolean;
    refreshInterval?: number;
  };
}

export interface GlobalFilter {
  id: string;
  name: string;
  type: 'date' | 'select' | 'multiselect' | 'text' | 'number';
  field: string;
  value: any;
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
  required?: boolean;
}

export interface VisualizationData {
  id: string;
  chartId: string;
  data: any[];
  metadata: {
    totalRecords: number;
    lastUpdated: Date;
    queryTime: number;
    cached: boolean;
  };
  schema: {
    [field: string]: {
      type: 'string' | 'number' | 'date' | 'boolean';
      format?: string;
      nullable?: boolean;
    };
  };
}

export interface DrillDownConfig {
  enabled: boolean;
  levels: Array<{
    field: string;
    chartType?: ChartConfig['type'];
    title?: string;
  }>;
  maxDepth: number;
}

export interface ExportOptions {
  format: 'png' | 'pdf' | 'svg' | 'excel' | 'csv' | 'json';
  resolution?: 'low' | 'medium' | 'high';
  includeData?: boolean;
  includeFilters?: boolean;
  watermark?: boolean;
}

export interface VisualizationTemplate {
  id: string;
  name: string;
  category: 'email' | 'performance' | 'user' | 'business' | 'custom';
  description: string;
  thumbnail?: string;
  charts: ChartConfig[];
  layout: Omit<DashboardLayout, 'id' | 'widgets'>;
  defaultFilters?: GlobalFilter[];
  tags: string[];
}

class VisualizationService extends EventEmitter {
  private charts: Map<string, ChartConfig> = new Map();
  private dashboards: Map<string, DashboardLayout> = new Map();
  private dataCache: Map<string, VisualizationData> = new Map();
  private templates: Map<string, VisualizationTemplate> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeTemplates();
  }

  // 图表管理
  async createChart(config: Omit<ChartConfig, 'id'>): Promise<ChartConfig> {
    const id = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chart: ChartConfig = { ...config, id };

    this.charts.set(id, chart);
    this.emit('chartCreated', chart);

    return chart;
  }

  async updateChart(id: string, updates: Partial<ChartConfig>): Promise<ChartConfig | null> {
    const chart = this.charts.get(id);
    if (!chart) return null;

    const updatedChart = { ...chart, ...updates };
    this.charts.set(id, updatedChart);
    this.emit('chartUpdated', updatedChart);

    return updatedChart;
  }

  async deleteChart(id: string): Promise<boolean> {
    const deleted = this.charts.delete(id);
    if (deleted) {
      this.clearDataCache(id);
      this.emit('chartDeleted', id);
    }
    return deleted;
  }

  getChart(id: string): ChartConfig | null {
    return this.charts.get(id) || null;
  }

  getAllCharts(): ChartConfig[] {
    return Array.from(this.charts.values());
  }

  // 仪表板管理
  async createDashboard(layout: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardLayout> {
    const id = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const dashboard: DashboardLayout = {
      ...layout,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.dashboards.set(id, dashboard);
    this.setupDashboardAutoRefresh(dashboard);
    this.emit('dashboardCreated', dashboard);

    return dashboard;
  }

  async updateDashboard(id: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout | null> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return null;

    const updatedDashboard = {
      ...dashboard,
      ...updates,
      updatedAt: new Date()
    };

    this.dashboards.set(id, updatedDashboard);
    this.setupDashboardAutoRefresh(updatedDashboard);
    this.emit('dashboardUpdated', updatedDashboard);

    return updatedDashboard;
  }

  async deleteDashboard(id: string): Promise<boolean> {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      this.clearRefreshTimer(id);
      this.emit('dashboardDeleted', id);
    }
    return deleted;
  }

  getDashboard(id: string): DashboardLayout | null {
    return this.dashboards.get(id) || null;
  }

  getAllDashboards(): DashboardLayout[] {
    return Array.from(this.dashboards.values());
  }

  // 数据获取和缓存
  async getChartData(chartId: string, forceRefresh = false): Promise<VisualizationData> {
    const chart = this.getChart(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const cacheKey = this.generateCacheKey(chart);

    if (!forceRefresh && this.dataCache.has(cacheKey)) {
      const cached = this.dataCache.get(cacheKey)!;
      // 检查缓存是否过期（5分钟）
      const cacheAge = Date.now() - cached.metadata.lastUpdated.getTime();
      if (cacheAge < 5 * 60 * 1000) {
        return cached;
      }
    }

    const startTime = Date.now();
    const data = await this.fetchChartData(chart);
    const queryTime = Date.now() - startTime;

    const visualizationData: VisualizationData = {
      id: `data_${chartId}_${Date.now()}`,
      chartId,
      data,
      metadata: {
        totalRecords: data.length,
        lastUpdated: new Date(),
        queryTime,
        cached: false
      },
      schema: this.inferSchema(data)
    };

    this.dataCache.set(cacheKey, visualizationData);
    this.emit('dataUpdated', visualizationData);

    return visualizationData;
  }

  // 实时数据更新
  async enableRealTimeUpdates(chartId: string): Promise<void> {
    const chart = this.getChart(chartId);
    if (!chart?.realTime?.enabled) return;

    const timer = setInterval(async () => {
      try {
        await this.getChartData(chartId, true);
      } catch (error) {
        console.error(`Real-time update failed for chart ${chartId}:`, error);
      }
    }, chart.realTime.interval);

    this.refreshTimers.set(chartId, timer);
  }

  async disableRealTimeUpdates(chartId: string): Promise<void> {
    this.clearRefreshTimer(chartId);
  }

  // 数据导出
  async exportChart(chartId: string, options: ExportOptions): Promise<Blob> {
    const chart = this.getChart(chartId);
    const data = await this.getChartData(chartId);

    if (!chart) throw new Error(`Chart ${chartId} not found`);

    switch (options.format) {
      case 'csv':
        return this.exportToCSV(data.data);
      case 'excel':
        return this.exportToExcel(data.data, chart.title);
      case 'json':
        return this.exportToJSON({ chart, data: data.data });
      case 'png':
      case 'pdf':
      case 'svg':
        return this.exportToImage(chartId, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  async exportDashboard(dashboardId: string, options: ExportOptions): Promise<Blob> {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) throw new Error(`Dashboard ${dashboardId} not found`);

    const dashboardData = {
      dashboard,
      charts: {},
      data: {}
    };

    for (const widget of dashboard.widgets) {
      const chart = this.getChart(widget.chartId);
      const data = await this.getChartData(widget.chartId);
      dashboardData.charts[widget.chartId] = chart;
      dashboardData.data[widget.chartId] = data.data;
    }

    switch (options.format) {
      case 'json':
        return this.exportToJSON(dashboardData);
      case 'pdf':
        return this.exportDashboardToPDF(dashboardId, options);
      default:
        throw new Error(`Unsupported dashboard export format: ${options.format}`);
    }
  }

  // 钻取分析
  async drillDown(chartId: string, dataPoint: any, level: number): Promise<ChartConfig> {
    const chart = this.getChart(chartId);
    if (!chart) throw new Error(`Chart ${chartId} not found`);

    // 基于数据点创建新的图表配置
    const drillDownChart: Omit<ChartConfig, 'id'> = {
      ...chart,
      title: `${chart.title} - 钻取分析 (级别 ${level + 1})`,
      filters: {
        ...chart.filters,
        // 添加基于数据点的过滤条件
        ...this.createDrillDownFilters(dataPoint, level)
      }
    };

    return this.createChart(drillDownChart);
  }

  // 模板管理
  getTemplates(category?: string): VisualizationTemplate[] {
    const templates = Array.from(this.templates.values());
    return category ? templates.filter(t => t.category === category) : templates;
  }

  async createFromTemplate(templateId: string, customData?: any): Promise<DashboardLayout> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // 创建图表
    const chartMapping = new Map<string, string>();
    for (const chartTemplate of template.charts) {
      const chart = await this.createChart({
        ...chartTemplate,
        ...customData?.chartOverrides?.[chartTemplate.id]
      });
      chartMapping.set(chartTemplate.id, chart.id);
    }

    // 创建仪表板
    const dashboard = await this.createDashboard({
      ...template.layout,
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      widgets: template.layout.widgets?.map(widget => ({
        ...widget,
        chartId: chartMapping.get(widget.chartId) || widget.chartId
      })) || []
    });

    return dashboard;
  }

  // 协作功能
  async shareDashboard(dashboardId: string, settings: { public: boolean; allowEdit: boolean; allowCopy: boolean }): Promise<string> {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) throw new Error(`Dashboard ${dashboardId} not found`);

    await this.updateDashboard(dashboardId, {
      sharing: settings
    });

    // 生成分享链接
    return `${window.location.origin}/shared/dashboard/${dashboardId}`;
  }

  // 私有方法
  private generateCacheKey(chart: ChartConfig): string {
    return `${chart.id}_${JSON.stringify(chart.filters)}_${chart.timeRange?.start}_${chart.timeRange?.end}`;
  }

  private async fetchChartData(chart: ChartConfig): Promise<any[]> {
    // 模拟数据获取
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    // 根据图表类型生成模拟数据
    return this.generateMockData(chart);
  }

  private generateMockData(chart: ChartConfig): any[] {
    const count = Math.floor(Math.random() * 100) + 20;
    const data = [];

    for (let i = 0; i < count; i++) {
      const item: any = {};

      if (chart.xAxis) {
        item[chart.xAxis] = chart.type === 'line' || chart.type === 'area'
          ? new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000).toISOString()
          : `Category ${i + 1}`;
      }

      if (chart.yAxis) {
        chart.yAxis.forEach((axis, index) => {
          item[axis] = Math.floor(Math.random() * 1000) + index * 100;
        });
      }

      if (chart.groupBy) {
        item[chart.groupBy] = ['Group A', 'Group B', 'Group C'][Math.floor(Math.random() * 3)];
      }

      data.push(item);
    }

    return data;
  }

  private inferSchema(data: any[]): VisualizationData['schema'] {
    if (data.length === 0) return {};

    const schema: VisualizationData['schema'] = {};
    const sample = data[0];

    for (const [key, value] of Object.entries(sample)) {
      if (typeof value === 'number') {
        schema[key] = { type: 'number' };
      } else if (typeof value === 'boolean') {
        schema[key] = { type: 'boolean' };
      } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(value))) {
        schema[key] = { type: 'date' };
      } else {
        schema[key] = { type: 'string' };
      }
    }

    return schema;
  }

  private setupDashboardAutoRefresh(dashboard: DashboardLayout): void {
    this.clearRefreshTimer(dashboard.id);

    if (dashboard.autoRefresh?.enabled) {
      const timer = setInterval(async () => {
        for (const widget of dashboard.widgets) {
          try {
            await this.getChartData(widget.chartId, true);
          } catch (error) {
            console.error(`Auto-refresh failed for chart ${widget.chartId}:`, error);
          }
        }
      }, dashboard.autoRefresh.interval);

      this.refreshTimers.set(dashboard.id, timer);
    }
  }

  private clearRefreshTimer(id: string): void {
    const timer = this.refreshTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(id);
    }
  }

  private clearDataCache(chartId?: string): void {
    if (chartId) {
      for (const [key, data] of this.dataCache.entries()) {
        if (data.chartId === chartId) {
          this.dataCache.delete(key);
        }
      }
    } else {
      this.dataCache.clear();
    }
  }

  private createDrillDownFilters(dataPoint: any, level: number): Record<string, any> {
    // 根据数据点和级别创建钻取过滤条件
    return {
      drillDownLevel: level,
      drillDownContext: dataPoint
    };
  }

  private async exportToCSV(data: any[]): Promise<Blob> {
    if (data.length === 0) return new Blob([''], { type: 'text/csv' });

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(value =>
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  }

  private async exportToExcel(data: any[], sheetName: string): Promise<Blob> {
    // 这里应该使用实际的Excel导出库，如 xlsx
    const csv = await this.exportToCSV(data);
    return csv; // 简化实现
  }

  private async exportToJSON(data: any): Promise<Blob> {
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  private async exportToImage(chartId: string, options: ExportOptions): Promise<Blob> {
    // 这里应该使用Canvas API或第三方库来生成图像
    // 简化实现返回空的Blob
    return new Blob([], { type: `image/${options.format}` });
  }

  private async exportDashboardToPDF(dashboardId: string, options: ExportOptions): Promise<Blob> {
    // 这里应该使用PDF生成库，如 jsPDF
    // 简化实现返回空的Blob
    return new Blob([], { type: 'application/pdf' });
  }

  private initializeTemplates(): void {
    // 初始化内置模板
    const emailAnalyticsTemplate: VisualizationTemplate = {
      id: 'email_analytics',
      name: '邮件分析仪表板',
      category: 'email',
      description: '全面的邮件统计和分析模板',
      charts: [
        {
          id: 'email_volume',
          title: '邮件量趋势',
          type: 'line',
          dataSource: 'emails',
          xAxis: 'date',
          yAxis: ['count'],
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
            granularity: 'day'
          }
        },
        {
          id: 'email_categories',
          title: '邮件分类分布',
          type: 'pie',
          dataSource: 'emails',
          groupBy: 'category',
          aggregation: 'count'
        }
      ],
      layout: {
        name: '邮件分析仪表板',
        gridConfig: { cols: 12, rows: 12, gap: 16 },
        widgets: [
          {
            id: 'widget1',
            chartId: 'email_volume',
            position: { x: 0, y: 0, w: 8, h: 6 }
          },
          {
            id: 'widget2',
            chartId: 'email_categories',
            position: { x: 8, y: 0, w: 4, h: 6 }
          }
        ]
      },
      tags: ['email', 'analytics', 'dashboard']
    };

    this.templates.set(emailAnalyticsTemplate.id, emailAnalyticsTemplate);
  }
}

export const visualizationService = new VisualizationService();