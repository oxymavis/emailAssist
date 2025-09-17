-- ============================================================
-- Migration: Create Integrations and Workflow Tasks Tables
-- Version: 1.0
-- Phase: 4 - P1 Workflow Integration
-- Created: 2025-09-16
-- Description: Creates tables for third-party integrations and workflow task management
-- ============================================================

BEGIN;

-- ================================
-- 第三方工具集成表 (Integrations)
-- ================================

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('asana', 'jira', 'trello')),
    name VARCHAR(255) NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT false,

    -- 认证凭证信息 (加密存储)
    credentials JSONB NOT NULL DEFAULT '{}',

    -- 集成配置
    configuration JSONB NOT NULL DEFAULT '{}',

    -- 状态和错误处理
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
    error_message TEXT,

    -- 统计信息
    statistics JSONB NOT NULL DEFAULT '{
        "totalTasksCreated": 0,
        "totalTasksUpdated": 0,
        "lastActivity": null,
        "syncErrors": 0
    }',

    -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 外键约束
    CONSTRAINT fk_integrations_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 业务约束
    CONSTRAINT unique_user_integration_type
        UNIQUE (user_id, type)
);

-- ================================
-- 工作流任务表 (Workflow Tasks)
-- ================================

CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL,
    integration_id UUID NOT NULL,
    external_task_id VARCHAR(255) NOT NULL,

    -- 任务基本信息
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assignee VARCHAR(255),

    -- 任务状态
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- 外部链接和标签
    external_url VARCHAR(1000),
    labels TEXT[] DEFAULT '{}',
    due_date TIMESTAMP WITH TIME ZONE,

    -- 元数据和同步信息
    metadata JSONB NOT NULL DEFAULT '{}',
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error_message TEXT,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 外键约束
    CONSTRAINT fk_workflow_tasks_email
        FOREIGN KEY (email_id) REFERENCES email_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_tasks_integration
        FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,

    -- 业务约束
    CONSTRAINT unique_integration_external_task
        UNIQUE (integration_id, external_task_id)
);

-- ================================
-- 索引优化
-- ================================

-- Integrations表索引
CREATE INDEX IF NOT EXISTS idx_integrations_user_type ON integrations(user_id, type);
CREATE INDEX IF NOT EXISTS idx_integrations_user_connected ON integrations(user_id, is_connected);
CREATE INDEX IF NOT EXISTS idx_integrations_type_status ON integrations(type, status);
CREATE INDEX IF NOT EXISTS idx_integrations_last_sync ON integrations(last_sync_at DESC) WHERE last_sync_at IS NOT NULL;

-- Workflow Tasks表索引
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_email ON workflow_tasks(email_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration ON workflow_tasks(integration_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_priority ON workflow_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_sync_status ON workflow_tasks(sync_status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assignee ON workflow_tasks(assignee) WHERE assignee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_due_date ON workflow_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_created_at ON workflow_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_completed_at ON workflow_tasks(completed_at) WHERE completed_at IS NOT NULL;

-- 复合索引用于常见查询模式
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration_status ON workflow_tasks(integration_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration_sync ON workflow_tasks(integration_id, sync_status);

-- ================================
-- 触发器和函数
-- ================================

-- 更新时间触发器函数 (如果不存在)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表创建更新时间触发器
CREATE TRIGGER trigger_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workflow_tasks_updated_at
    BEFORE UPDATE ON workflow_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 工作流任务状态更新触发器
CREATE OR REPLACE FUNCTION handle_workflow_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动设置完成时间
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at = NULL;
    END IF;

    -- 状态变更时标记为待同步
    IF NEW.status != OLD.status THEN
        NEW.sync_status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_workflow_task_status_change
    BEFORE UPDATE OF status ON workflow_tasks
    FOR EACH ROW EXECUTE FUNCTION handle_workflow_task_status_change();

-- ================================
-- 初始化数据验证函数
-- ================================

-- 验证集成凭证格式
CREATE OR REPLACE FUNCTION validate_integration_credentials(integration_type TEXT, credentials JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    CASE integration_type
        WHEN 'trello' THEN
            RETURN credentials ? 'apiKey' AND credentials ? 'accessToken';
        WHEN 'jira' THEN
            RETURN credentials ? 'apiUrl' AND (credentials ? 'accessToken' OR credentials ? 'apiKey');
        WHEN 'asana' THEN
            RETURN credentials ? 'accessToken';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ language 'plpgsql';

-- 添加凭证验证约束
ALTER TABLE integrations ADD CONSTRAINT check_credentials_format
    CHECK (validate_integration_credentials(type, credentials));

-- ================================
-- 权限设置
-- ================================

-- 确保必要的权限 (在实际部署时根据需要调整)
GRANT SELECT, INSERT, UPDATE, DELETE ON integrations TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_tasks TO postgres;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ================================
-- 版本记录
-- ================================

-- 记录迁移版本
INSERT INTO schema_migrations (version, description, applied_at) VALUES
('005', 'Create integrations and workflow_tasks tables for P1 workflow integration', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ================================
-- 迁移后验证
-- ================================

-- 验证表是否正确创建
DO $$
DECLARE
    integrations_count INTEGER;
    workflow_tasks_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO integrations_count FROM information_schema.tables WHERE table_name = 'integrations';
    SELECT COUNT(*) INTO workflow_tasks_count FROM information_schema.tables WHERE table_name = 'workflow_tasks';

    IF integrations_count = 0 THEN
        RAISE EXCEPTION 'Integrations table was not created successfully';
    END IF;

    IF workflow_tasks_count = 0 THEN
        RAISE EXCEPTION 'Workflow_tasks table was not created successfully';
    END IF;

    RAISE NOTICE 'Migration 005 completed successfully: integrations and workflow_tasks tables created';
END
$$;