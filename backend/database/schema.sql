-- Email Assist Database Schema
-- PostgreSQL Database Design for Email Management System
-- Version: 1.0.0
-- Created: 2025-09-12

-- ====================================
-- Database Creation
-- ====================================
CREATE DATABASE IF NOT EXISTS email_assist
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    CONNECTION LIMIT = -1;

\c email_assist;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- Users Table
-- ====================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
    is_active BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'zh-CN',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ====================================
-- Microsoft Auth Tokens Table
-- ====================================
CREATE TABLE microsoft_auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    microsoft_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_microsoft_auth_user_id ON microsoft_auth_tokens(user_id);
CREATE INDEX idx_microsoft_auth_expires_at ON microsoft_auth_tokens(expires_at);

-- ====================================
-- Email Accounts Table (多邮箱支持)
-- ====================================
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('microsoft', 'gmail', 'imap', 'exchange')),
    email_address VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_frequency_minutes INTEGER DEFAULT 5,
    connection_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_address)
);

CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_provider ON email_accounts(provider);

-- ====================================
-- Emails Table (邮件主表)
-- ====================================
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(500) UNIQUE NOT NULL, -- Microsoft/Gmail message ID
    conversation_id VARCHAR(500),
    subject TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipients_to TEXT[], -- Array of email addresses
    recipients_cc TEXT[],
    recipients_bcc TEXT[],
    body_text TEXT,
    body_html TEXT,
    importance VARCHAR(20) DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high')),
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    categories TEXT[],
    folder_name VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB -- Store original email data
);

CREATE INDEX idx_emails_account_id ON emails(account_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX idx_emails_sender_email ON emails(sender_email);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_importance ON emails(importance);
CREATE INDEX idx_emails_categories ON emails USING GIN(categories);

-- ====================================
-- Email Attachments Table
-- ====================================
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    file_name VARCHAR(500),
    file_type VARCHAR(100),
    file_size BIGINT,
    content_id VARCHAR(500),
    is_inline BOOLEAN DEFAULT false,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);

-- ====================================
-- Email Analysis Table (AI分析结果)
-- ====================================
CREATE TABLE email_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(100),
    key_topics TEXT[],
    entities JSONB, -- Named entities (people, organizations, locations, etc.)
    summary TEXT,
    action_required BOOLEAN DEFAULT false,
    suggested_response TEXT,
    confidence_score NUMERIC(3,2),
    language VARCHAR(10),
    analysis_version VARCHAR(20),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_id)
);

CREATE INDEX idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX idx_email_analysis_sentiment ON email_analysis(sentiment);
CREATE INDEX idx_email_analysis_urgency ON email_analysis(urgency);
CREATE INDEX idx_email_analysis_category ON email_analysis(category);
CREATE INDEX idx_email_analysis_action_required ON email_analysis(action_required);

-- ====================================
-- Filter Rules Table (过滤规则)
-- ====================================
CREATE TABLE filter_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL, -- Complex conditions in JSON format
    actions JSONB NOT NULL, -- Actions to perform
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_filter_rules_user_id ON filter_rules(user_id);
CREATE INDEX idx_filter_rules_is_active ON filter_rules(is_active);
CREATE INDEX idx_filter_rules_priority ON filter_rules(priority DESC);

-- ====================================
-- Filter Execution Log Table
-- ====================================
CREATE TABLE filter_execution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    matched BOOLEAN DEFAULT false,
    actions_performed JSONB,
    execution_time_ms INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_filter_execution_log_rule_id ON filter_execution_log(rule_id);
CREATE INDEX idx_filter_execution_log_email_id ON filter_execution_log(email_id);
CREATE INDEX idx_filter_execution_log_executed_at ON filter_execution_log(executed_at DESC);

-- ====================================
-- Reports Table (报告)
-- ====================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
    config JSONB NOT NULL, -- Report configuration
    data JSONB, -- Generated report data
    file_url TEXT, -- URL to generated PDF/Excel file
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_scheduled_at ON reports(scheduled_at);

-- ====================================
-- Report Templates Table
-- ====================================
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
    is_system BOOLEAN DEFAULT false, -- System templates vs user templates
    template_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_templates_user_id ON report_templates(user_id);
CREATE INDEX idx_report_templates_is_system ON report_templates(is_system);

-- ====================================
-- Workflows Table (工作流集成)
-- ====================================
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) CHECK (trigger_type IN ('email_received', 'email_sent', 'analysis_complete', 'manual', 'scheduled')),
    trigger_config JSONB,
    integration_type VARCHAR(50) CHECK (integration_type IN ('jira', 'trello', 'asana', 'slack', 'teams', 'webhook')),
    integration_config JSONB,
    is_active BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX idx_workflows_integration_type ON workflows(integration_type);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);

-- ====================================
-- Workflow Execution Log Table
-- ====================================
CREATE TABLE workflow_execution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    status VARCHAR(50) CHECK (status IN ('pending', 'running', 'success', 'failed')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_execution_log_workflow_id ON workflow_execution_log(workflow_id);
CREATE INDEX idx_workflow_execution_log_status ON workflow_execution_log(status);
CREATE INDEX idx_workflow_execution_log_executed_at ON workflow_execution_log(executed_at DESC);

-- ====================================
-- Notifications Table (通知)
-- ====================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('email', 'analysis', 'report', 'workflow', 'system')),
    title VARCHAR(500),
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ====================================
-- Team Members Table (团队协作)
-- ====================================
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}'::jsonb,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ====================================
-- Activity Log Table (活动日志)
-- ====================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- ====================================
-- System Settings Table
-- ====================================
CREATE TABLE system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================
-- Functions and Triggers
-- ====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_microsoft_auth_tokens_updated_at BEFORE UPDATE ON microsoft_auth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filter_rules_updated_at BEFORE UPDATE ON filter_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- Initial Data
-- ====================================

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
    ('ai_analysis_enabled', '{"enabled": true, "provider": "openai", "model": "gpt-4"}', 'AI analysis configuration'),
    ('email_sync_interval', '{"minutes": 5}', 'Default email sync interval'),
    ('max_emails_per_sync', '{"count": 100}', 'Maximum emails to sync per operation'),
    ('report_retention_days', '{"days": 90}', 'Number of days to retain generated reports');

-- ====================================
-- Permissions and Security
-- ====================================

-- Create application user (adjust as needed)
-- CREATE USER email_assist_app WITH PASSWORD 'secure_password';
-- GRANT CONNECT ON DATABASE email_assist TO email_assist_app;
-- GRANT USAGE ON SCHEMA public TO email_assist_app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO email_assist_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO email_assist_app;

-- ====================================
-- Comments
-- ====================================
COMMENT ON DATABASE email_assist IS 'Email Assist - Intelligent Email Management System Database';
COMMENT ON TABLE users IS 'System users and their basic information';
COMMENT ON TABLE microsoft_auth_tokens IS 'Microsoft OAuth tokens for email access';
COMMENT ON TABLE emails IS 'Cached email messages from various providers';
COMMENT ON TABLE email_analysis IS 'AI analysis results for emails';
COMMENT ON TABLE filter_rules IS 'User-defined email filtering rules';
COMMENT ON TABLE reports IS 'Generated and scheduled reports';
COMMENT ON TABLE workflows IS 'Integration workflows with third-party services';
COMMENT ON TABLE notifications IS 'User notifications and alerts';