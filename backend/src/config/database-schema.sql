-- Email Assist 数据库架构优化 SQL
-- 创建所有必要的表结构和高性能索引

-- =============================================
-- 1. 创建表结构（如果不存在）
-- =============================================

-- Users 表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'readonly')),
  password_hash VARCHAR(255),
  microsoft_tokens JSONB,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Accounts 表
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('microsoft', 'gmail', 'exchange')),
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  is_connected BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  folder_structure JSONB DEFAULT '{}',
  sync_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Email Messages 表
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  thread_id VARCHAR(255),
  subject TEXT NOT NULL,
  from_data JSONB NOT NULL,
  to_data JSONB NOT NULL,
  cc_data JSONB,
  bcc_data JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  importance VARCHAR(10) DEFAULT 'normal' CHECK (importance IN ('high', 'normal', 'low')),
  categories TEXT[] DEFAULT '{}',
  folder_path VARCHAR(500) NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- Email Analysis 表  
CREATE TABLE IF NOT EXISTS email_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  analysis_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  sentiment_data JSONB NOT NULL,
  priority_data JSONB NOT NULL,
  category_data JSONB NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  entities_data JSONB DEFAULT '[]',
  summary TEXT NOT NULL,
  suggested_actions_data JSONB DEFAULT '[]',
  processing_time INTEGER NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email_id)
);

-- Filter Rules 表
CREATE TABLE IF NOT EXISTS filter_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rule Execution Log 表
CREATE TABLE IF NOT EXISTS rule_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
  execution_time INTEGER NOT NULL,
  conditions_matched JSONB,
  actions_executed JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports 表
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  format TEXT[] NOT NULL,
  parameters JSONB DEFAULT '{}',
  date_range JSONB NOT NULL,
  file_paths TEXT[],
  statistics JSONB,
  template_id UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Templates 表
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB NOT NULL,
  default_parameters JSONB DEFAULT '{}',
  layout_config JSONB,
  chart_configs JSONB,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Schedules 表
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  parameters JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_status VARCHAR(20),
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  retention_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. 创建高性能索引
-- =============================================

-- Users 表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Email Accounts 表索引
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_email_accounts_is_connected ON email_accounts(is_connected);
CREATE INDEX IF NOT EXISTS idx_email_accounts_sync_status ON email_accounts(sync_status);

-- Email Messages 表核心索引（高性能关键）
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_importance ON email_messages(importance);
CREATE INDEX IF NOT EXISTS idx_email_messages_folder_path ON email_messages(folder_path);
CREATE INDEX IF NOT EXISTS idx_email_messages_has_attachments ON email_messages(has_attachments);

-- Email Messages 复合索引（查询优化核心）
CREATE INDEX IF NOT EXISTS idx_email_messages_user_received ON email_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_read ON email_messages(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_importance ON email_messages(user_id, importance);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_folder ON email_messages(user_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_account_received ON email_messages(user_id, account_id, received_at DESC);

-- Email Messages 全文搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_subject_gin ON email_messages USING GIN (to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_messages_body_text_gin ON email_messages USING GIN (to_tsvector('english', COALESCE(body_text, '')));

-- Email Messages 分类索引
CREATE INDEX IF NOT EXISTS idx_email_messages_categories_gin ON email_messages USING GIN (categories);

-- Email Analysis 表索引
CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analysis_analyzed_at ON email_analysis(analyzed_at DESC);

-- Email Analysis JSON字段索引（关键性能优化）
CREATE INDEX IF NOT EXISTS idx_email_analysis_priority_gin ON email_analysis USING GIN (priority_data);
CREATE INDEX IF NOT EXISTS idx_email_analysis_sentiment_gin ON email_analysis USING GIN (sentiment_data);
CREATE INDEX IF NOT EXISTS idx_email_analysis_category_gin ON email_analysis USING GIN (category_data);

-- Email Analysis 关键词索引
CREATE INDEX IF NOT EXISTS idx_email_analysis_keywords_gin ON email_analysis USING GIN (keywords);

-- Email Analysis 复合查询索引
CREATE INDEX IF NOT EXISTS idx_email_analysis_priority_level ON email_analysis((priority_data->>'level'));
CREATE INDEX IF NOT EXISTS idx_email_analysis_sentiment_label ON email_analysis((sentiment_data->>'label'));
CREATE INDEX IF NOT EXISTS idx_email_analysis_category_primary ON email_analysis((category_data->>'primary'));

-- Filter Rules 表索引
CREATE INDEX IF NOT EXISTS idx_filter_rules_user_id ON filter_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_rules_is_active ON filter_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_rules_priority ON filter_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_filter_rules_user_active ON filter_rules(user_id, is_active);

-- Rule Execution Log 表索引
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_rule_id ON rule_execution_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_email_id ON rule_execution_log(email_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_executed_at ON rule_execution_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_status ON rule_execution_log(status);

-- Reports 表索引
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_report_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_template_id ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_status ON reports(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_user_type ON reports(user_id, report_type);

-- Report Templates 表索引
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_templates_report_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_active ON report_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_system ON report_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_report_templates_usage_count ON report_templates(usage_count DESC);

-- Report Schedules 表索引
CREATE INDEX IF NOT EXISTS idx_report_schedules_user_id ON report_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_template_id ON report_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_status ON report_schedules(status);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run_at ON report_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_schedules_is_active ON report_schedules(is_active);

-- =============================================
-- 3. 创建触发器函数
-- =============================================

-- 更新 updated_at 字段的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- 4. 创建触发器
-- =============================================

-- Users 表触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Email Messages 表触发器
DROP TRIGGER IF EXISTS update_email_messages_updated_at ON email_messages;
CREATE TRIGGER update_email_messages_updated_at 
  BEFORE UPDATE ON email_messages 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Email Analysis 表触发器
DROP TRIGGER IF EXISTS update_email_analysis_updated_at ON email_analysis;
CREATE TRIGGER update_email_analysis_updated_at 
  BEFORE UPDATE ON email_analysis 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Filter Rules 表触发器
DROP TRIGGER IF EXISTS update_filter_rules_updated_at ON filter_rules;
CREATE TRIGGER update_filter_rules_updated_at 
  BEFORE UPDATE ON filter_rules 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Reports 表触发器
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at 
  BEFORE UPDATE ON reports 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Report Templates 表触发器
DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
CREATE TRIGGER update_report_templates_updated_at 
  BEFORE UPDATE ON report_templates 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Report Schedules 表触发器
DROP TRIGGER IF EXISTS update_report_schedules_updated_at ON report_schedules;
CREATE TRIGGER update_report_schedules_updated_at 
  BEFORE UPDATE ON report_schedules 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================
-- 5. 创建物化视图（用于报告性能优化）
-- =============================================

-- 邮件统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_email_statistics AS
SELECT 
  user_id,
  account_id,
  DATE(received_at) as date,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE is_read = false) as unread_emails,
  COUNT(*) FILTER (WHERE importance = 'high') as high_importance_emails,
  COUNT(*) FILTER (WHERE has_attachments = true) as emails_with_attachments,
  COUNT(DISTINCT (from_data->>'email')) as unique_senders,
  COUNT(DISTINCT folder_path) as unique_folders
FROM email_messages 
GROUP BY user_id, account_id, DATE(received_at);

-- 创建物化视图索引
CREATE INDEX IF NOT EXISTS idx_mv_email_statistics_user_date ON mv_email_statistics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mv_email_statistics_account_date ON mv_email_statistics(account_id, date DESC);

-- AI分析统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_analysis_statistics AS
SELECT 
  em.user_id,
  DATE(ea.analyzed_at) as date,
  COUNT(*) as total_analyses,
  COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'critical') as critical_priority,
  COUNT(*) FILTER (WHERE ea.priority_data->>'level' = 'high') as high_priority,
  COUNT(*) FILTER (WHERE ea.sentiment_data->>'label' = 'positive') as positive_sentiment,
  COUNT(*) FILTER (WHERE ea.sentiment_data->>'label' = 'negative') as negative_sentiment,
  AVG(ea.processing_time) as avg_processing_time
FROM email_analysis ea
JOIN email_messages em ON ea.email_id = em.id
GROUP BY em.user_id, DATE(ea.analyzed_at);

-- 创建AI分析物化视图索引
CREATE INDEX IF NOT EXISTS idx_mv_analysis_statistics_user_date ON mv_analysis_statistics(user_id, date DESC);

-- =============================================
-- 6. 数据库配置优化
-- =============================================

-- 设置数据库参数（需要超级用户权限，这些是建议值）
/*
-- 内存配置
shared_buffers = '256MB';              -- 共享缓冲区
effective_cache_size = '1GB';          -- 有效缓存大小
work_mem = '4MB';                      -- 工作内存

-- 检查点配置
checkpoint_segments = 32;               -- 检查点段数
checkpoint_completion_target = 0.9;    -- 检查点完成目标

-- WAL配置
wal_buffers = '16MB';                  -- WAL缓冲区
wal_level = 'replica';                 -- WAL级别

-- 查询优化器配置
random_page_cost = 1.1;               -- 随机页成本
seq_page_cost = 1.0;                  -- 顺序页成本
cpu_tuple_cost = 0.01;                -- CPU元组成本
cpu_index_tuple_cost = 0.005;         -- CPU索引元组成本
cpu_operator_cost = 0.0025;           -- CPU操作符成本

-- 并发配置
max_connections = 100;                 -- 最大连接数
*/

-- =============================================
-- 结束
-- =============================================