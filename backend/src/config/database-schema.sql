-- Email Assist Database Schema
-- Complete schema for the email analysis and management system
-- 包含所有P0和P1功能所需的表结构和索引优化

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. 核心表结构创建
-- =============================================

-- Users table (Enhanced with more fields)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'readonly')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    password_hash VARCHAR(255),
    
    -- OAuth tokens (encrypted storage)
    microsoft_tokens JSONB,
    google_tokens JSONB,
    
    -- User preferences and settings
    settings JSONB DEFAULT '{
        "theme": "light",
        "language": "zh-CN",
        "timezone": "Asia/Shanghai",
        "notifications": {
            "email": true,
            "browser": true,
            "urgent_only": false
        },
        "analysis": {
            "auto_analysis": true,
            "sentiment_threshold": 0.7,
            "priority_threshold": 0.8
        }
    }',
    
    -- Activity tracking
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table (for JWT token management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) NOT NULL,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Accounts table (Enhanced with better sync management)
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('microsoft', 'gmail', 'exchange', 'imap')),
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    is_connected BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    
    -- Enhanced synchronization tracking
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
    sync_progress INTEGER DEFAULT 0, -- 0-100 percentage
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Configuration and structure
    folder_structure JSONB DEFAULT '{}',
    sync_settings JSONB DEFAULT '{
        "sync_interval": 300,
        "folders": ["INBOX", "Sent Items", "Drafts"],
        "max_emails_per_sync": 100,
        "sync_attachments": false,
        "auto_analysis": true
    }',
    
    -- OAuth tokens (should be encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_emails INTEGER DEFAULT 0,
    unread_emails INTEGER DEFAULT 0,
    last_email_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, email)
);

-- Email Folders table (For folder structure management)
CREATE TABLE IF NOT EXISTS email_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    folder_id VARCHAR(255) NOT NULL, -- Provider-specific folder ID
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES email_folders(id) ON DELETE CASCADE,
    folder_type VARCHAR(50) DEFAULT 'custom' CHECK (folder_type IN ('inbox', 'sent', 'drafts', 'trash', 'spam', 'custom')),
    is_system BOOLEAN DEFAULT false,
    email_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(account_id, folder_id)
);

-- Sync Operations tracking table
CREATE TABLE IF NOT EXISTS sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('full_sync', 'incremental_sync', 'folder_sync')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Progress tracking
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    
    -- Configuration and results
    sync_config JSONB DEFAULT '{}',
    error_details TEXT,
    result_summary JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Messages table (Core email data storage)
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES email_folders(id) ON DELETE SET NULL,
    
    -- Provider-specific identifiers
    message_id VARCHAR(512) NOT NULL, -- Provider message ID
    internet_message_id VARCHAR(512), -- Standard Message-ID header
    thread_id VARCHAR(255),
    conversation_id VARCHAR(255),
    
    -- Basic email fields
    subject TEXT NOT NULL DEFAULT '',
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) DEFAULT '',
    recipients JSONB DEFAULT '[]', -- Array of {email, name, type} objects
    cc_recipients JSONB DEFAULT '[]',
    bcc_recipients JSONB DEFAULT '[]',
    
    -- Content
    body_text TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    preview_text TEXT DEFAULT '',
    
    -- Metadata
    importance VARCHAR(10) DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high')),
    sensitivity VARCHAR(20) DEFAULT 'normal' CHECK (sensitivity IN ('normal', 'personal', 'private', 'confidential')),
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Analysis status
    analysis_status VARCHAR(20) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    analysis_updated_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(account_id, message_id)
);

-- Email Analysis Cache table (AI Analysis Results)
CREATE TABLE IF NOT EXISTS email_analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    
    -- Analysis results
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1), -- -1 to 1
    sentiment_label VARCHAR(20) CHECK (sentiment_label IN ('negative', 'neutral', 'positive')),
    priority_score DECIMAL(3,2) CHECK (priority_score >= 0 AND priority_score <= 1), -- 0 to 1
    priority_label VARCHAR(10) CHECK (priority_label IN ('low', 'medium', 'high', 'urgent')),
    
    -- Content analysis
    keywords JSONB DEFAULT '[]', -- Array of extracted keywords
    entities JSONB DEFAULT '[]', -- Array of named entities
    topics JSONB DEFAULT '[]', -- Array of identified topics
    language_detected VARCHAR(10) DEFAULT 'en',
    
    -- Classification
    category VARCHAR(100), -- Auto-detected category
    is_spam BOOLEAN DEFAULT false,
    spam_score DECIMAL(3,2),
    is_promotional BOOLEAN DEFAULT false,
    is_automated BOOLEAN DEFAULT false,
    
    -- Business context
    urgency_indicators JSONB DEFAULT '[]', -- Array of urgency signals found
    action_required BOOLEAN DEFAULT false,
    estimated_response_time INTEGER, -- in minutes
    
    -- Analysis metadata
    model_version VARCHAR(50),
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analysis_duration_ms INTEGER,
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id)
);

-- Filter Rules table (Smart Email Filtering)
CREATE TABLE IF NOT EXISTS filter_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule configuration
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    rule_type VARCHAR(20) DEFAULT 'custom' CHECK (rule_type IN ('system', 'template', 'custom', 'ai_generated')),
    
    -- Conditions (JSON structure for flexible conditions)
    conditions JSONB NOT NULL DEFAULT '{}', -- Complex condition logic
    /*
    Example conditions structure:
    {
        "operator": "AND", // AND, OR
        "rules": [
            {
                "field": "sender_email",
                "operator": "contains",
                "value": "@important-client.com"
            },
            {
                "field": "subject",
                "operator": "contains",
                "value": "urgent"
            }
        ]
    }
    */
    
    -- Actions to take when conditions are met
    actions JSONB NOT NULL DEFAULT '[]', -- Array of actions to execute
    /*
    Example actions structure:
    [
        {
            "type": "add_tag",
            "params": {"tag": "urgent"}
        },
        {
            "type": "move_to_folder",
            "params": {"folder": "High Priority"}
        }
    ]
    */
    
    -- Statistics
    match_count INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMP WITH TIME ZONE,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Filter Rule Executions table (Execution history)
CREATE TABLE IF NOT EXISTS filter_rule_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    
    execution_status VARCHAR(20) NOT NULL CHECK (execution_status IN ('success', 'failed', 'partial')),
    actions_executed JSONB DEFAULT '[]', -- Which actions were executed
    error_details TEXT,
    execution_duration_ms INTEGER,
    
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow Integrations table (Third-party integrations)
CREATE TABLE IF NOT EXISTS workflow_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN ('jira', 'trello', 'asana', 'slack', 'teams', 'webhook')),
    name VARCHAR(255) NOT NULL,
    
    -- Connection configuration
    is_enabled BOOLEAN DEFAULT true,
    connection_config JSONB NOT NULL DEFAULT '{}', -- API keys, URLs, etc.
    
    -- Mapping configuration
    field_mappings JSONB DEFAULT '{}', -- How to map email data to integration fields
    
    -- Statistics
    total_exports INTEGER DEFAULT 0,
    successful_exports INTEGER DEFAULT 0,
    last_export_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, integration_type, name)
);

-- Report Generations table (Generation history)
CREATE TABLE IF NOT EXISTS report_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Generation details
    report_name VARCHAR(255) NOT NULL,
    generation_type VARCHAR(20) NOT NULL CHECK (generation_type IN ('manual', 'scheduled', 'api')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    
    -- Parameters and results
    parameters JSONB DEFAULT '{}', -- Generation parameters
    file_path TEXT, -- Generated file location
    file_size INTEGER, -- File size in bytes
    file_format VARCHAR(10), -- pdf, xlsx, csv, etc.
    
    -- Timing and performance
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    generation_duration_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Templates table
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template configuration
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('daily', 'weekly', 'monthly', 'custom', 'real_time')),
    is_system_template BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    
    -- Report configuration
    data_sources JSONB NOT NULL DEFAULT '[]', -- Which data to include
    filters JSONB DEFAULT '{}', -- Data filtering criteria
    charts JSONB DEFAULT '[]', -- Chart configurations
    
    -- Scheduling
    schedule_enabled BOOLEAN DEFAULT false,
    schedule_config JSONB DEFAULT '{}', -- Cron-like schedule configuration
    
    -- Usage statistics
    usage_count INTEGER DEFAULT 0,
    last_generated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled Reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Schedule configuration
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    schedule_expression VARCHAR(100) NOT NULL, -- Cron expression
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Delivery configuration
    delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'webhook', 'file_export')),
    delivery_config JSONB DEFAULT '{}', -- Recipients, webhook URLs, etc.
    
    -- Execution tracking
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- P1.2 智能通知和提醒系统 表结构
-- =============================================

-- Notification Channels table (通知渠道管理)
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('websocket', 'email', 'webhook', 'sms')),
    is_enabled BOOLEAN DEFAULT true,
    
    -- Channel configuration
    config JSONB NOT NULL DEFAULT '{}',
    /*
    Example config structures:
    - WebSocket: {"socketNamespace": "/notifications"}
    - Email: {"smtpSettings": {"host": "smtp.gmail.com", "port": 587, "secure": true, "auth": {"user": "...", "pass": "..."}}}
    - Webhook: {"webhookUrl": "https://...", "webhookSecret": "...", "webhookHeaders": {...}}
    - SMS: {"smsProvider": "twilio", "smsConfig": {...}}
    */
    
    -- Retry configuration
    retry_config JSONB DEFAULT '{
        "maxAttempts": 3,
        "retryDelay": 60,
        "backoffMultiplier": 2
    }',
    
    -- Statistics
    total_notifications INTEGER DEFAULT 0,
    successful_notifications INTEGER DEFAULT 0,
    failed_notifications INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Templates table (通知模板管理)
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('email_alert', 'priority_email', 'ai_analysis', 'system_alert', 'custom')),
    
    -- Template channels configuration
    channels JSONB NOT NULL DEFAULT '[]',
    /*
    Example channels structure:
    [
        {
            "channelId": "uuid",
            "isEnabled": true,
            "templateContent": {
                "subject": "{{title}}",
                "htmlBody": "...",
                "textBody": "...",
                "title": "{{title}}",
                "message": "{{message}}",
                "icon": "email",
                "payload": {...}
            }
        }
    ]
    */
    
    -- Template variables definition
    variables JSONB DEFAULT '[]',
    /*
    Example variables structure:
    [
        {
            "name": "title",
            "type": "string",
            "description": "Notification title",
            "required": true,
            "defaultValue": "New Notification"
        }
    ]
    */
    
    -- Metadata
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Rules table (智能通知规则)
CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1-10, higher = more priority
    
    -- Trigger configuration
    triggers JSONB NOT NULL DEFAULT '[]',
    /*
    Example triggers structure:
    [
        {
            "type": "email_analysis",
            "conditions": {
                "analysisTypes": ["sentiment", "priority"],
                "sentimentThreshold": -0.5,
                "priorityThreshold": 0.8,
                "categories": ["urgent", "complaint"],
                "additionalFilters": {
                    "senderDomains": ["@important-client.com"],
                    "subjectKeywords": ["urgent", "asap"],
                    "timeRange": {"start": "09:00", "end": "18:00"},
                    "workingDaysOnly": true
                }
            }
        },
        {
            "type": "time_based",
            "conditions": {
                "schedule": {
                    "type": "cron",
                    "expression": "0 9 * * 1-5",
                    "timezone": "Asia/Shanghai"
                }
            }
        }
    ]
    */
    
    -- Action configuration
    actions JSONB NOT NULL DEFAULT '[]',
    /*
    Example actions structure:
    [
        {
            "channelId": "uuid",
            "templateId": "uuid",
            "isEnabled": true,
            "throttling": {
                "maxPerHour": 10,
                "maxPerDay": 50,
                "cooldownMinutes": 30
            }
        }
    ]
    */
    
    -- Statistics
    trigger_count INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Preferences table (用户通知偏好)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Global settings
    global_settings JSONB DEFAULT '{
        "isEnabled": true,
        "quietHours": {
            "start": "22:00",
            "end": "08:00",
            "timezone": "Asia/Shanghai"
        },
        "workingDaysOnly": false,
        "maxNotificationsPerHour": 20
    }',
    
    -- Channel preferences
    channel_preferences JSONB DEFAULT '[]',
    /*
    Example channel_preferences structure:
    [
        {
            "channelId": "uuid",
            "isEnabled": true,
            "priority": 1,
            "settings": {
                "emailNotifications": true,
                "websocketNotifications": true
            }
        }
    ]
    */
    
    -- Category preferences
    category_preferences JSONB DEFAULT '[
        {"category": "email_alert", "isEnabled": true, "minPriority": 1},
        {"category": "priority_email", "isEnabled": true, "minPriority": 3},
        {"category": "ai_analysis", "isEnabled": true, "minPriority": 2},
        {"category": "system_alert", "isEnabled": true, "minPriority": 1},
        {"category": "custom", "isEnabled": true, "minPriority": 1}
    ]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table (通知实例记录)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    
    -- Notification content
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    
    -- Template data and context
    data JSONB DEFAULT '{}', -- Template variables and context data
    
    -- Source metadata
    metadata JSONB DEFAULT '{}',
    /*
    Example metadata structure:
    {
        "sourceType": "email_analysis",
        "sourceId": "email-uuid",
        "triggeredBy": "user-uuid",
        "processingStartedAt": "2024-01-01T...",
        "processingCompletedAt": "2024-01-01T...",
        "retryCount": 0,
        "lastRetryAt": null
    }
    */
    
    -- Delivery tracking
    delivery_results JSONB DEFAULT '[]',
    /*
    Example delivery_results structure:
    [
        {
            "attempt": 1,
            "attemptedAt": "2024-01-01T...",
            "result": "success",
            "errorCode": null,
            "errorMessage": null,
            "responseData": {...}
        }
    ]
    */
    
    -- User interaction
    read_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing timestamps
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Queue table (通知队列管理)
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    queue_name VARCHAR(100) DEFAULT 'default',
    priority INTEGER NOT NULL DEFAULT 5,
    
    -- Queue status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    last_error TEXT,
    error_details JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Analytics table (通知统计分析)
CREATE TABLE IF NOT EXISTS notification_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    
    -- Event tracking
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
    event_data JSONB DEFAULT '{}',
    
    -- Timing metrics
    processing_time_ms INTEGER,
    delivery_time_ms INTEGER,
    
    -- Context
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. 索引优化 (高性能查询关键)
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

-- Notification Channels 表索引
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_is_enabled ON notification_channels(is_enabled);

-- Notification Templates 表索引
CREATE INDEX IF NOT EXISTS idx_notification_templates_category ON notification_templates(category);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_system ON notification_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_notification_templates_created_by ON notification_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_notification_templates_usage_count ON notification_templates(usage_count DESC);

-- Notification Rules 表索引
CREATE INDEX IF NOT EXISTS idx_notification_rules_user_id ON notification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_is_enabled ON notification_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_rules_priority ON notification_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notification_rules_user_enabled ON notification_rules(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_rules_triggers_gin ON notification_rules USING GIN (triggers);

-- Notification Preferences 表索引
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Notifications 表核心索引（高性能关键）
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_rule_id ON notifications(rule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON notifications(template_id);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- Notifications 复合索引（查询优化核心）
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_priority ON notifications(user_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at DESC);

-- Notifications JSON字段索引
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_notifications_data_gin ON notifications USING GIN (data);

-- Notification Queue 表索引
CREATE INDEX IF NOT EXISTS idx_notification_queue_notification_id ON notification_queue(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_next_retry_at ON notification_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled ON notification_queue(status, scheduled_at);

-- Notification Analytics 表索引
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_channel_id ON notification_analytics(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_template_id ON notification_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_rule_id ON notification_analytics(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_event_type ON notification_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_created_at ON notification_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_event ON notification_analytics(user_id, event_type);

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