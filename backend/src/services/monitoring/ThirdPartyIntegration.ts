/**
 * Third Party Monitoring Integration Service
 * 第三方监控系统集成服务，支持Prometheus、Grafana、ELK Stack、OpenTelemetry等主流监控工具
 */

import EventEmitter from 'events';
import axios, { AxiosInstance } from 'axios';
import { Redis } from 'ioredis';
import logger from '@/utils/logger';

// Prometheus集成
export interface PrometheusConfig {
  enabled: boolean;
  pushgatewayUrl: string;
  jobName: string;
  instance: string;
  labels: Record<string, string>;
  authentication?: {
    type: 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp?: number;
  labels?: Record<string, string>;
}

// Grafana集成
export interface GrafanaConfig {
  enabled: boolean;
  url: string;
  apiKey: string;
  organizationId?: number;
  defaultDashboardId?: string;
}

export interface GrafanaDashboard {
  id?: number;
  title: string;
  tags: string[];
  panels: GrafanaPanel[];
  templating?: {
    list: GrafanaTemplate[];
  };
}

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  targets: GrafanaTarget[];
  gridPos: { h: number; w: number; x: number; y: number };
}

export interface GrafanaTarget {
  expr: string;
  refId: string;
  legendFormat?: string;
}

export interface GrafanaTemplate {
  name: string;
  type: string;
  query: string;
  refresh: number;
}

// ElasticSearch/ELK Stack集成
export interface ElasticsearchConfig {
  enabled: boolean;
  nodes: string[];
  username?: string;
  password?: string;
  indices: {
    metrics: string;
    logs: string;
    alerts: string;
  };
  mappings?: Record<string, any>;
}

// OpenTelemetry集成
export interface OpenTelemetryConfig {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  headers?: Record<string, string>;
  compression?: 'gzip' | 'none';
}

export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
}

// Datadog集成
export interface DatadogConfig {
  enabled: boolean;
  apiKey: string;
  appKey: string;
  site?: string; // us1, us3, us5, eu1, ap1
  prefix?: string;
}

// New Relic集成
export interface NewRelicConfig {
  enabled: boolean;
  licenseKey: string;
  appName: string;
  region?: 'US' | 'EU';
}

export class ThirdPartyIntegration extends EventEmitter {
  private redis: Redis;
  private prometheusConfig?: PrometheusConfig;
  private grafanaConfig?: GrafanaConfig;
  private elasticsearchConfig?: ElasticsearchConfig;
  private openTelemetryConfig?: OpenTelemetryConfig;
  private datadogConfig?: DatadogConfig;
  private newRelicConfig?: NewRelicConfig;

  // HTTP客户端实例
  private prometheusClient?: AxiosInstance;
  private grafanaClient?: AxiosInstance;
  private elasticsearchClient?: AxiosInstance;
  private datadogClient?: AxiosInstance;
  private newRelicClient?: AxiosInstance;

  // 指标缓存
  private metricsBuffer: Map<string, PrometheusMetric[]> = new Map();
  private bufferFlushInterval?: NodeJS.Timeout;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * 初始化第三方集成
   */
  async initialize(config: {
    prometheus?: PrometheusConfig;
    grafana?: GrafanaConfig;
    elasticsearch?: ElasticsearchConfig;
    openTelemetry?: OpenTelemetryConfig;
    datadog?: DatadogConfig;
    newRelic?: NewRelicConfig;
  }): Promise<void> {
    try {
      logger.info('Initializing third-party monitoring integrations...');

      // 配置各个集成
      if (config.prometheus?.enabled) {
        await this.initializePrometheus(config.prometheus);
      }

      if (config.grafana?.enabled) {
        await this.initializeGrafana(config.grafana);
      }

      if (config.elasticsearch?.enabled) {
        await this.initializeElasticsearch(config.elasticsearch);
      }

      if (config.openTelemetry?.enabled) {
        await this.initializeOpenTelemetry(config.openTelemetry);
      }

      if (config.datadog?.enabled) {
        await this.initializeDatadog(config.datadog);
      }

      if (config.newRelic?.enabled) {
        await this.initializeNewRelic(config.newRelic);
      }

      // 启动指标缓冲区刷新
      this.startMetricsBuffering();

      logger.info('Third-party monitoring integrations initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize third-party integrations', error);
      throw error;
    }
  }

  // ==================== Prometheus 集成 ====================

  /**
   * 初始化Prometheus集成
   */
  private async initializePrometheus(config: PrometheusConfig): Promise<void> {
    this.prometheusConfig = config;
    
    this.prometheusClient = axios.create({
      baseURL: config.pushgatewayUrl,
      timeout: 10000
    });

    // 配置认证
    if (config.authentication) {
      if (config.authentication.type === 'basic') {
        this.prometheusClient.defaults.auth = {
          username: config.authentication.username!,
          password: config.authentication.password!
        };
      } else if (config.authentication.type === 'bearer') {
        this.prometheusClient.defaults.headers['Authorization'] = 
          `Bearer ${config.authentication.token}`;
      }
    }

    logger.info('Prometheus integration initialized', { 
      pushgatewayUrl: config.pushgatewayUrl,
      jobName: config.jobName 
    });
  }

  /**
   * 推送指标到Prometheus
   */
  async pushToPrometheus(metrics: PrometheusMetric[]): Promise<void> {
    if (!this.prometheusConfig?.enabled || !this.prometheusClient) {
      return;
    }

    try {
      const metricsText = this.formatPrometheusMetrics(metrics);
      const url = `/metrics/job/${this.prometheusConfig.jobName}/instance/${this.prometheusConfig.instance}`;

      await this.prometheusClient.post(url, metricsText, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      logger.debug('Metrics pushed to Prometheus', { count: metrics.length });

    } catch (error) {
      logger.error('Failed to push metrics to Prometheus', error);
    }
  }

  /**
   * 格式化Prometheus指标
   */
  private formatPrometheusMetrics(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      // 添加HELP和TYPE注释
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // 构建标签字符串
      const labelParts: string[] = [];
      
      // 添加配置的默认标签
      if (this.prometheusConfig?.labels) {
        for (const [key, value] of Object.entries(this.prometheusConfig.labels)) {
          labelParts.push(`${key}="${value}"`);
        }
      }

      // 添加指标的标签
      if (metric.labels) {
        for (const [key, value] of Object.entries(metric.labels)) {
          labelParts.push(`${key}="${value}"`);
        }
      }

      const labelsStr = labelParts.length > 0 ? `{${labelParts.join(',')}}` : '';
      const timestamp = metric.timestamp || Date.now();
      
      lines.push(`${metric.name}${labelsStr} ${metric.value} ${timestamp}`);
    }

    return lines.join('\n') + '\n';
  }

  // ==================== Grafana 集成 ====================

  /**
   * 初始化Grafana集成
   */
  private async initializeGrafana(config: GrafanaConfig): Promise<void> {
    this.grafanaConfig = config;

    this.grafanaClient = axios.create({
      baseURL: config.url,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // 测试连接
    try {
      await this.grafanaClient.get('/api/org');
      logger.info('Grafana integration initialized', { url: config.url });
    } catch (error) {
      logger.error('Failed to connect to Grafana', error);
      throw error;
    }
  }

  /**
   * 创建或更新Grafana仪表板
   */
  async createOrUpdateGrafanaDashboard(dashboard: GrafanaDashboard): Promise<number> {
    if (!this.grafanaConfig?.enabled || !this.grafanaClient) {
      throw new Error('Grafana integration not enabled');
    }

    try {
      const dashboardPayload = {
        dashboard: {
          ...dashboard,
          id: dashboard.id || null
        },
        overwrite: true,
        message: dashboard.id ? 'Updated by Email Assist monitoring' : 'Created by Email Assist monitoring'
      };

      const response = await this.grafanaClient.post('/api/dashboards/db', dashboardPayload);
      
      logger.info('Grafana dashboard created/updated', { 
        title: dashboard.title,
        id: response.data.id 
      });

      return response.data.id;

    } catch (error) {
      logger.error('Failed to create/update Grafana dashboard', error);
      throw error;
    }
  }

  /**
   * 创建默认监控仪表板
   */
  async createDefaultMonitoringDashboard(): Promise<number> {
    const dashboard: GrafanaDashboard = {
      title: 'Email Assist - System Monitoring',
      tags: ['email-assist', 'monitoring', 'system'],
      panels: [
        {
          id: 1,
          title: 'CPU Usage',
          type: 'graph',
          gridPos: { h: 8, w: 12, x: 0, y: 0 },
          targets: [{
            expr: 'cpu_usage_percent{job="email-assist"}',
            refId: 'A',
            legendFormat: 'CPU Usage %'
          }]
        },
        {
          id: 2,
          title: 'Memory Usage',
          type: 'graph',
          gridPos: { h: 8, w: 12, x: 12, y: 0 },
          targets: [{
            expr: 'memory_usage_percent{job="email-assist"}',
            refId: 'B',
            legendFormat: 'Memory Usage %'
          }]
        },
        {
          id: 3,
          title: 'HTTP Requests',
          type: 'graph',
          gridPos: { h: 8, w: 12, x: 0, y: 8 },
          targets: [{
            expr: 'rate(http_requests_total{job="email-assist"}[5m])',
            refId: 'C',
            legendFormat: 'Requests/sec'
          }]
        },
        {
          id: 4,
          title: 'Response Time',
          type: 'graph',
          gridPos: { h: 8, w: 12, x: 12, y: 8 },
          targets: [{
            expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="email-assist"}[5m]))',
            refId: 'D',
            legendFormat: '95th percentile'
          }]
        }
      ]
    };

    return await this.createOrUpdateGrafanaDashboard(dashboard);
  }

  // ==================== Elasticsearch 集成 ====================

  /**
   * 初始化Elasticsearch集成
   */
  private async initializeElasticsearch(config: ElasticsearchConfig): Promise<void> {
    this.elasticsearchConfig = config;

    const baseURL = config.nodes[0];
    
    this.elasticsearchClient = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 配置认证
    if (config.username && config.password) {
      this.elasticsearchClient.defaults.auth = {
        username: config.username,
        password: config.password
      };
    }

    // 测试连接并创建索引
    try {
      await this.elasticsearchClient.get('/');
      await this.createElasticsearchIndices();
      
      logger.info('Elasticsearch integration initialized', { 
        nodes: config.nodes,
        indices: config.indices 
      });

    } catch (error) {
      logger.error('Failed to initialize Elasticsearch', error);
      throw error;
    }
  }

  /**
   * 创建Elasticsearch索引
   */
  private async createElasticsearchIndices(): Promise<void> {
    if (!this.elasticsearchConfig || !this.elasticsearchClient) return;

    const indices = this.elasticsearchConfig.indices;

    // 指标索引
    await this.createElasticsearchIndex(indices.metrics, {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          metric_name: { type: 'keyword' },
          metric_value: { type: 'double' },
          labels: { type: 'object' },
          category: { type: 'keyword' },
          source: { type: 'keyword' }
        }
      }
    });

    // 日志索引
    await this.createElasticsearchIndex(indices.logs, {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          source: { type: 'keyword' },
          metadata: { type: 'object' }
        }
      }
    });

    // 告警索引
    await this.createElasticsearchIndex(indices.alerts, {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          alert_id: { type: 'keyword' },
          title: { type: 'text' },
          level: { type: 'keyword' },
          category: { type: 'keyword' },
          status: { type: 'keyword' },
          resolved_at: { type: 'date' }
        }
      }
    });
  }

  /**
   * 创建单个Elasticsearch索引
   */
  private async createElasticsearchIndex(indexName: string, settings: any): Promise<void> {
    try {
      // 检查索引是否已存在
      const exists = await this.elasticsearchClient!.head(`/${indexName}`);
      if (exists.status === 200) {
        return;
      }

      await this.elasticsearchClient!.put(`/${indexName}`, settings);
      logger.info('Elasticsearch index created', { indexName });

    } catch (error) {
      if (error.response?.status !== 400) { // 400表示索引已存在
        logger.error('Failed to create Elasticsearch index', error, { indexName });
      }
    }
  }

  /**
   * 发送数据到Elasticsearch
   */
  async sendToElasticsearch(indexName: string, documents: any[]): Promise<void> {
    if (!this.elasticsearchConfig?.enabled || !this.elasticsearchClient) {
      return;
    }

    try {
      // 构建批量操作
      const body = documents.flatMap(doc => [
        { index: { _index: indexName } },
        doc
      ]);

      await this.elasticsearchClient.post('/_bulk', body.map(JSON.stringify).join('\n') + '\n', {
        headers: {
          'Content-Type': 'application/x-ndjson'
        }
      });

      logger.debug('Documents sent to Elasticsearch', { 
        index: indexName,
        count: documents.length 
      });

    } catch (error) {
      logger.error('Failed to send data to Elasticsearch', error);
    }
  }

  // ==================== OpenTelemetry 集成 ====================

  /**
   * 初始化OpenTelemetry集成
   */
  private async initializeOpenTelemetry(config: OpenTelemetryConfig): Promise<void> {
    this.openTelemetryConfig = config;

    // 这里可以集成OpenTelemetry SDK
    // 由于复杂性，这里提供基础框架

    logger.info('OpenTelemetry integration initialized', { 
      endpoint: config.endpoint,
      serviceName: config.serviceName 
    });
  }

  /**
   * 发送跟踪数据到OpenTelemetry
   */
  async sendTraceToOpenTelemetry(spans: OTelSpan[]): Promise<void> {
    if (!this.openTelemetryConfig?.enabled) {
      return;
    }

    try {
      // 实现OpenTelemetry协议的数据发送
      const payload = {
        resourceSpans: [{
          resource: {
            attributes: [{
              key: 'service.name',
              value: { stringValue: this.openTelemetryConfig.serviceName }
            }]
          },
          instrumentationLibrarySpans: [{
            instrumentationLibrary: {
              name: 'email-assist-monitoring',
              version: this.openTelemetryConfig.serviceVersion
            },
            spans: spans.map(span => ({
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId,
              name: span.operationName,
              startTimeUnixNano: span.startTime * 1000000,
              endTimeUnixNano: span.endTime ? span.endTime * 1000000 : undefined,
              attributes: Object.entries(span.tags).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) }
              })),
              events: span.logs.map(log => ({
                timeUnixNano: log.timestamp * 1000000,
                attributes: Object.entries(log.fields).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) }
                }))
              }))
            }))
          }]
        }]
      };

      await axios.post(
        `${this.openTelemetryConfig.endpoint}/v1/traces`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...this.openTelemetryConfig.headers
          }
        }
      );

      logger.debug('Traces sent to OpenTelemetry', { count: spans.length });

    } catch (error) {
      logger.error('Failed to send traces to OpenTelemetry', error);
    }
  }

  // ==================== Datadog 集成 ====================

  /**
   * 初始化Datadog集成
   */
  private async initializeDatadog(config: DatadogConfig): Promise<void> {
    this.datadogConfig = config;
    
    const baseURL = `https://api.${config.site || 'datadoghq.com'}`;
    
    this.datadogClient = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey,
        'Content-Type': 'application/json'
      }
    });

    logger.info('Datadog integration initialized', { site: config.site });
  }

  /**
   * 发送指标到Datadog
   */
  async sendToDatadog(metrics: Array<{
    metric: string;
    points: Array<[number, number]>;
    tags?: string[];
    host?: string;
    type?: 'gauge' | 'count' | 'rate';
  }>): Promise<void> {
    if (!this.datadogConfig?.enabled || !this.datadogClient) {
      return;
    }

    try {
      const payload = {
        series: metrics.map(metric => ({
          metric: this.datadogConfig!.prefix ? 
            `${this.datadogConfig!.prefix}.${metric.metric}` : 
            metric.metric,
          points: metric.points,
          tags: metric.tags,
          host: metric.host,
          type: metric.type || 'gauge'
        }))
      };

      await this.datadogClient.post('/api/v1/series', payload);

      logger.debug('Metrics sent to Datadog', { count: metrics.length });

    } catch (error) {
      logger.error('Failed to send metrics to Datadog', error);
    }
  }

  // ==================== New Relic 集成 ====================

  /**
   * 初始化New Relic集成
   */
  private async initializeNewRelic(config: NewRelicConfig): Promise<void> {
    this.newRelicConfig = config;
    
    const baseURL = config.region === 'EU' ? 
      'https://insights-collector.eu01.nr-data.net' : 
      'https://insights-collector.newrelic.com';
    
    this.newRelicClient = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Api-Key': config.licenseKey,
        'Content-Type': 'application/json'
      }
    });

    logger.info('New Relic integration initialized', { 
      appName: config.appName,
      region: config.region 
    });
  }

  /**
   * 发送事件到New Relic
   */
  async sendToNewRelic(events: any[]): Promise<void> {
    if (!this.newRelicConfig?.enabled || !this.newRelicClient) {
      return;
    }

    try {
      const payload = events.map(event => ({
        eventType: 'EmailAssistMetric',
        appName: this.newRelicConfig!.appName,
        timestamp: Date.now(),
        ...event
      }));

      await this.newRelicClient.post('/v1/accounts/events', payload);

      logger.debug('Events sent to New Relic', { count: events.length });

    } catch (error) {
      logger.error('Failed to send events to New Relic', error);
    }
  }

  // ==================== 指标缓冲和批量发送 ====================

  /**
   * 启动指标缓冲
   */
  private startMetricsBuffering(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, 60000); // 每分钟刷新一次
  }

  /**
   * 添加指标到缓冲区
   */
  addMetricToBuffer(source: string, metric: PrometheusMetric): void {
    if (!this.metricsBuffer.has(source)) {
      this.metricsBuffer.set(source, []);
    }
    this.metricsBuffer.get(source)!.push(metric);
  }

  /**
   * 刷新指标缓冲区
   */
  private async flushMetricsBuffer(): Promise<void> {
    for (const [source, metrics] of this.metricsBuffer.entries()) {
      if (metrics.length === 0) continue;

      try {
        // 发送到各个集成的监控系统
        await Promise.all([
          this.pushToPrometheus(metrics),
          this.sendToElasticsearch(
            this.elasticsearchConfig?.indices.metrics || 'email-assist-metrics',
            metrics.map(m => ({
              timestamp: new Date(m.timestamp || Date.now()),
              metric_name: m.name,
              metric_value: m.value,
              labels: m.labels,
              source
            }))
          ),
          this.sendToDatadog(
            metrics.map(m => ({
              metric: m.name,
              points: [[Math.floor((m.timestamp || Date.now()) / 1000), m.value]],
              tags: m.labels ? Object.entries(m.labels).map(([k, v]) => `${k}:${v}`) : undefined
            }))
          )
        ]);

        // 清空缓冲区
        this.metricsBuffer.set(source, []);

      } catch (error) {
        logger.error('Failed to flush metrics buffer', error, { source, count: metrics.length });
      }
    }
  }

  /**
   * 停止第三方集成
   */
  async shutdown(): Promise<void> {
    try {
      // 刷新剩余的缓冲指标
      await this.flushMetricsBuffer();

      // 停止定时器
      if (this.bufferFlushInterval) {
        clearInterval(this.bufferFlushInterval);
        this.bufferFlushInterval = undefined;
      }

      logger.info('Third-party integrations shutdown completed');

    } catch (error) {
      logger.error('Error during third-party integrations shutdown', error);
    }
  }

  /**
   * 获取集成状态
   */
  getIntegrationStatus(): {
    prometheus: boolean;
    grafana: boolean;
    elasticsearch: boolean;
    openTelemetry: boolean;
    datadog: boolean;
    newRelic: boolean;
  } {
    return {
      prometheus: this.prometheusConfig?.enabled || false,
      grafana: this.grafanaConfig?.enabled || false,
      elasticsearch: this.elasticsearchConfig?.enabled || false,
      openTelemetry: this.openTelemetryConfig?.enabled || false,
      datadog: this.datadogConfig?.enabled || false,
      newRelic: this.newRelicConfig?.enabled || false
    };
  }

  /**
   * 健康检查
   */
  async performHealthCheck(): Promise<{
    [key: string]: { status: 'healthy' | 'unhealthy'; message?: string };
  }> {
    const results: any = {};

    // Prometheus健康检查
    if (this.prometheusConfig?.enabled && this.prometheusClient) {
      try {
        await this.prometheusClient.get('/');
        results.prometheus = { status: 'healthy' };
      } catch (error) {
        results.prometheus = { status: 'unhealthy', message: error.message };
      }
    }

    // Grafana健康检查
    if (this.grafanaConfig?.enabled && this.grafanaClient) {
      try {
        await this.grafanaClient.get('/api/health');
        results.grafana = { status: 'healthy' };
      } catch (error) {
        results.grafana = { status: 'unhealthy', message: error.message };
      }
    }

    // Elasticsearch健康检查
    if (this.elasticsearchConfig?.enabled && this.elasticsearchClient) {
      try {
        const response = await this.elasticsearchClient.get('/_cluster/health');
        results.elasticsearch = { 
          status: response.data.status === 'red' ? 'unhealthy' : 'healthy',
          message: `Cluster status: ${response.data.status}`
        };
      } catch (error) {
        results.elasticsearch = { status: 'unhealthy', message: error.message };
      }
    }

    return results;
  }
}

export default ThirdPartyIntegration;