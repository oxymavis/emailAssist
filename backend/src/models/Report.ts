/**
 * �J��pn!��I
 * +�J!���I�s{�
 */

// �J�
export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Report type enumeration
export enum ReportType {
  EMAIL_ANALYSIS = 'email_analysis',
  PRODUCTIVITY = 'productivity',
  SECURITY = 'security',
  CUSTOM = 'custom',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  PERFORMANCE = 'performance',
  SUMMARY = 'summary'
}

// �J<
export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json'
}

// ����
export enum ScheduleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused'
}

// Report data interface
export interface Report {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  report_type: ReportType;
  status: ReportStatus;
  format: ReportFormat[];
  parameters: ReportParameters;
  date_range: DateRange;
  file_paths?: string[];
  statistics?: ReportStatistics;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  error_message?: string;
  template_id?: string;
  scheduled_at?: Date;
}

// �J�p
export interface ReportParameters {
  include_charts?: boolean;
  include_attachments?: boolean;
  group_by?: string;
  filters?: Record<string, any>;
  custom_fields?: string[];
  email_filters?: EmailFilter;
}

// ��
export interface DateRange {
  start_date: Date;
  end_date: Date;
  timezone?: string;
}

// �Jߡ�o
export interface ReportStatistics {
  total_emails?: number;
  processing_time_ms?: number;
  generation_time_ms?: number;
  file_size_bytes?: number;
  chart_count?: number;
  processed_emails?: number;
  table_count?: number;
}

// �J!
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  report_type: ReportType;
  is_system: boolean;
  is_active: boolean;
  configuration: TemplateConfiguration;
  default_parameters?: ReportParameters;
  usage_count: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  layout_config?: LayoutConfig;
  chart_configs?: ChartConfig[];
}

// !Mn
export interface TemplateConfiguration {
  default_format: ReportFormat[];
  default_parameters: ReportParameters;
  required_fields: string[];
  optional_fields: string[];
  chart_types: string[];
  export_options: ExportOptions;
  layout_config?: LayoutConfig;
  chart_configs?: ChartConfig[];
}

// ��	y
export interface ExportOptions {
  include_raw_data: boolean;
  include_summary: boolean;
  include_charts: boolean;
  custom_branding?: boolean;
}

// �J���
export interface ReportSchedule {
  id: string;
  user_id: string;
  template_id: string;
  name: string;
  description?: string;
  cron_expression: string;
  timezone: string;
  status: ScheduleStatus;
  parameters: ReportParameters;
  notification_settings: NotificationSettings;
  last_run_at?: Date;
  next_run_at?: Date;
  last_status?: ReportStatus;
  run_count: number;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  next_run?: Date;
  report_id?: string;
  success_count?: number;
  failure_count?: number;
  retention_days?: number;
}

// �n
// NotificationSettings interface is defined later in the file

// ��Jpn��
export interface CreateReportData {
  title: string;
  description?: string;
  report_type: ReportType;
  format: ReportFormat[];
  parameters: ReportParameters;
  date_range: DateRange;
  template_id?: string;
  scheduled_at?: Date;
}

// ���Jpn��
export interface UpdateReportData {
  title?: string;
  description?: string;
  parameters?: ReportParameters;
  date_range?: DateRange;
}

// �J���p
export interface ReportQuery {
  user_id?: string;
  status?: ReportStatus;
  report_type?: ReportType;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  date_from?: Date;
  date_to?: Date;
  template_id?: string;
  search?: string;
}

// �!pn��
// CreateReportTemplateData interface is defined later in the file (this was a duplicate)

// ��!pn��
export interface UpdateReportTemplateData {
  name?: string;
  description?: string;
  category?: string;
  configuration?: Partial<TemplateConfiguration>;
  is_active?: boolean;
}

// !���p
export interface TemplateQuery {
  category?: string;
  report_type?: ReportType;
  is_system?: boolean;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

// ����pn��
// CreateReportScheduleData interface is defined later in the file (this was a duplicate)

// �����pn��
export interface UpdateReportScheduleData {
  name?: string;
  description?: string;
  cron_expression?: string;
  timezone?: string;
  status?: ScheduleStatus;
  parameters?: ReportParameters;
  notification_settings?: NotificationSettings;
}

// ������p
export interface ReportScheduleQuery {
  user_id?: string;
  status?: ScheduleStatus;
  template_id?: string;
  limit?: number;
  offset?: number;
}

// ߡpn��
export interface ReportStatisticsData {
  total_reports: number;
  reports_by_status: Record<ReportStatus, number>;
  reports_by_type: Record<ReportType, number>;
  avg_generation_time: number;
  total_file_size: number;
}

export interface TemplateStatisticsData {
  total_templates: number;
  system_templates: number;
  custom_templates: number;
  most_used_templates: Array<{
    template_id: string;
    name: string;
    usage_count: number;
  }>;
}

export interface ScheduleStatisticsData {
  total_schedules: number;
  active_schedules: number;
  successful_runs: number;
  failed_runs: number;
  next_scheduled_runs: Array<{
    schedule_id: string;
    name: string;
    next_run_at: Date;
  }>;
}

// Missing interfaces needed by controllers and services

export interface ReportTemplateQuery {
  category?: string;
  report_type?: ReportType;
  is_system?: boolean;
  is_active?: boolean;
  created_by?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ReportScheduleQuery {
  user_id?: string;
  status?: ScheduleStatus;
  template_id?: string;
  limit?: number;
  offset?: number;
  is_active?: boolean;
  next_run_before?: Date;
  next_run_after?: Date;
}

export interface NotificationSettings {
  email_enabled?: boolean;
  email_recipients?: string[];
  webhook_enabled?: boolean;
  webhook_url?: string;
  notify_on_success?: boolean;
  notify_on_failure?: boolean;
  retention_days?: number;
  success_notification?: boolean;
  failure_notification?: boolean;
  summary_notification?: boolean;
}

export interface UpdateReportScheduleData {
  name?: string;
  description?: string;
  cron_expression?: string;
  timezone?: string;
  status?: ScheduleStatus;
  parameters?: ReportParameters;
  notification_settings?: NotificationSettings;
  is_active?: boolean;
  retention_days?: number;
}

export interface CreateReportScheduleData {
  template_id?: string;
  report_id?: string;
  name: string;
  description?: string;
  cron_expression: string;
  timezone?: string;
  parameters: ReportParameters;
  notification_settings: NotificationSettings;
  retention_days?: number;
}

export interface CreateReportTemplateData {
  name: string;
  description?: string;
  category: string;
  report_type: ReportType;
  configuration: TemplateConfiguration;
  default_parameters?: ReportParameters;
  layout_config?: LayoutConfig;
  chart_configs?: ChartConfig[];
}

export interface UpdateReportTemplateData {
  name?: string;
  description?: string;
  category?: string;
  configuration?: Partial<TemplateConfiguration>;
  is_active?: boolean;
  default_parameters?: ReportParameters;
  layout_config?: LayoutConfig;
  chart_configs?: ChartConfig[];
}

// Additional interfaces for data types and configurations

export interface ReportData {
  id: string;
  title: string;
  description?: string;
  data: any;
  charts?: ChartConfig[];
  metadata?: Record<string, any>;
  summary?: {
    total_emails: number;
    unread_count: number;
    important_count: number;
    categories: Record<string, number>;
    time_distribution: Record<string, number>;
    sender_stats: Array<{ sender: string; count: number; }>;
    keyword_frequency: Record<string, number>;
  };
  detailed_stats?: {
    hourly_distribution: Record<string, number>;
    daily_distribution: Record<string, number>;
    weekly_distribution: Record<string, number>;
    monthly_distribution: Record<string, number>;
  };
  ai_insights?: {
    trends: string[];
    patterns: string[];
    recommendations: string[];
    sentiment_analysis: Record<string, number>;
  };
  rule_performance?: {
    rules_triggered: Array<{ rule_id: string; count: number; }>;
    accuracy_metrics: Record<string, number>;
    suggestions: string[];
  };
  recommendations?: string[];
}

export interface EmailFilter {
  sender?: string;
  recipient?: string;
  subject?: string;
  date_range?: DateRange;
  has_attachments?: boolean;
  folder?: string;
  category?: string;
}

export interface ChartConfig {
  id?: string;
  name?: string;
  type: string;
  title: string;
  data: any;
  options?: Record<string, any>;
  data_query?: string;
}

export interface LayoutConfig {
  page_size?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  header?: string;
  footer?: string;
  sections?: Array<{
    id: string;
    name?: string;
    title: string;
    type: string;
    content?: any;
    position?: { x: number; y: number; };
    size?: { width: number; height: number; };
    order?: number;
    config?: any;
  }>;
}

export interface TableConfig {
  columns: Array<{
    key: string;
    label: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
  }>;
  data: Record<string, any>[];
  pagination?: {
    page_size: number;
    show_page_numbers: boolean;
  };
}