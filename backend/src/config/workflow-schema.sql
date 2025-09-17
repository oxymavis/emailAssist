-- Workflow Integration Schema for Email Assist
-- 工作流集成数据库架构

-- Create integrations table
-- 创建第三方工具集成表
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('asana', 'jira', 'trello')),
    name VARCHAR(255) NOT NULL,
    is_connected BOOLEAN DEFAULT FALSE,
    credentials JSONB NOT NULL DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
    error_message TEXT,
    statistics JSONB DEFAULT '{
        "totalTasksCreated": 0,
        "totalTasksUpdated": 0,
        "lastActivity": null,
        "syncErrors": 0
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_tasks table
-- 创建工作流任务表
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    external_task_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT DEFAULT '',
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assignee VARCHAR(255),
    status VARCHAR(50) DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled')),
    external_url VARCHAR(1000),
    labels TEXT[] DEFAULT '{}',
    due_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    sync_status VARCHAR(50) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for integrations table
-- 为集成表创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_type
    ON integrations(user_id, type);

CREATE INDEX IF NOT EXISTS idx_integrations_user_connected
    ON integrations(user_id, is_connected);

CREATE INDEX IF NOT EXISTS idx_integrations_type_status
    ON integrations(type, status);

CREATE INDEX IF NOT EXISTS idx_integrations_last_sync
    ON integrations(last_sync_at)
    WHERE last_sync_at IS NOT NULL;

-- Create indexes for workflow_tasks table
-- 为工作流任务表创建索引
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_email_id
    ON workflow_tasks(email_id);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration_id
    ON workflow_tasks(integration_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_tasks_integration_external
    ON workflow_tasks(integration_id, external_task_id);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status
    ON workflow_tasks(status);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_priority
    ON workflow_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_sync_status
    ON workflow_tasks(sync_status);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assignee
    ON workflow_tasks(assignee)
    WHERE assignee IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_due_date
    ON workflow_tasks(due_date)
    WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_created_at
    ON workflow_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_completed_at
    ON workflow_tasks(completed_at)
    WHERE completed_at IS NOT NULL;

-- Create trigger to automatically update updated_at timestamp
-- 创建自动更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
-- 应用更新触发器
CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_tasks_updated_at
    BEFORE UPDATE ON workflow_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample integration types (for documentation)
-- 插入示例集成类型（用于文档）
COMMENT ON TABLE integrations IS '第三方工具集成表，支持 Asana、Jira、Trello 等工具';
COMMENT ON COLUMN integrations.type IS '集成类型: asana, jira, trello';
COMMENT ON COLUMN integrations.credentials IS '认证凭证，包含 API 密钥、访问令牌等';
COMMENT ON COLUMN integrations.configuration IS '集成配置，包含默认项目、分配者、任务模板等';
COMMENT ON COLUMN integrations.statistics IS '统计信息，包含任务创建数、更新数、错误数等';

COMMENT ON TABLE workflow_tasks IS '工作流任务表，跟踪从邮件创建的第三方工具任务';
COMMENT ON COLUMN workflow_tasks.external_task_id IS '第三方工具中的任务ID';
COMMENT ON COLUMN workflow_tasks.metadata IS '任务元数据，包含邮件信息和集成特定数据';
COMMENT ON COLUMN workflow_tasks.sync_status IS '同步状态: pending, synced, error';

-- Grant permissions (adjust user as needed)
-- 授予权限（根据需要调整用户）
-- GRANT SELECT, INSERT, UPDATE, DELETE ON integrations, workflow_tasks TO email_assist_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO email_assist_user;