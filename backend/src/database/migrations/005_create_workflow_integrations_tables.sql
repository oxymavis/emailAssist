-- ================================
-- Phase 4: 工作流集成数据表创建脚本
-- Version: 1.0
-- Created: 2025-09-16
-- Description: 创建工作流集成相关的数据表（Integrations 和 WorkflowTasks）
-- ================================

BEGIN;

-- ================================
-- 集成表 (Integrations)
-- ================================

-- 第三方工具集成表
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asana', 'jira', 'trello')),
    name VARCHAR(255) NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT false,

    -- 认证凭证 (加密存储)
    credentials JSONB NOT NULL DEFAULT '{}',

    -- 集成配置
    configuration JSONB NOT NULL DEFAULT '{}',

    -- 同步信息
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
    error_message TEXT,

    -- 统计信息
    statistics JSONB NOT NULL DEFAULT '{
        "totalTasksCreated": 0,
        "totalTasksUpdated": 0,
        "lastActivity": null,
        "syncErrors": 0
    }'::jsonb,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 唯一约束：每个用户每种类型只能有一个集成
    UNIQUE(user_id, type)
);

-- 为integrations表添加注释
COMMENT ON TABLE integrations IS '第三方工具集成配置表';
COMMENT ON COLUMN integrations.id IS '集成ID';
COMMENT ON COLUMN integrations.user_id IS '用户ID';
COMMENT ON COLUMN integrations.type IS '集成类型：asana|jira|trello';
COMMENT ON COLUMN integrations.name IS '集成名称';
COMMENT ON COLUMN integrations.is_connected IS '是否已连接';
COMMENT ON COLUMN integrations.credentials IS 'API凭证信息 (加密)';
COMMENT ON COLUMN integrations.configuration IS '集成配置参数';
COMMENT ON COLUMN integrations.last_sync_at IS '最后同步时间';
COMMENT ON COLUMN integrations.status IS '集成状态：active|error|disabled';
COMMENT ON COLUMN integrations.error_message IS '错误消息';
COMMENT ON COLUMN integrations.statistics IS '使用统计信息';

-- ================================
-- 工作流任务表 (WorkflowTasks)
-- ================================

-- 工作流任务跟踪表
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
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- 外部任务信息
    external_url VARCHAR(1000),
    labels TEXT[] DEFAULT '{}',
    due_date TIMESTAMP WITH TIME ZONE,

    -- 任务元数据
    metadata JSONB NOT NULL DEFAULT '{}',

    -- 同步状态
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error_message TEXT,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 外键约束
    FOREIGN KEY (email_id) REFERENCES email_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,

    -- 唯一约束：每个集成中的外部任务ID必须唯一
    UNIQUE(integration_id, external_task_id)
);

-- 为workflow_tasks表添加注释
COMMENT ON TABLE workflow_tasks IS '工作流任务跟踪表';
COMMENT ON COLUMN workflow_tasks.id IS '任务ID';
COMMENT ON COLUMN workflow_tasks.email_id IS '关联邮件ID';
COMMENT ON COLUMN workflow_tasks.integration_id IS '集成ID';
COMMENT ON COLUMN workflow_tasks.external_task_id IS '外部任务ID';
COMMENT ON COLUMN workflow_tasks.title IS '任务标题';
COMMENT ON COLUMN workflow_tasks.description IS '任务描述';
COMMENT ON COLUMN workflow_tasks.priority IS '任务优先级：low|medium|high|critical';
COMMENT ON COLUMN workflow_tasks.assignee IS '任务分配者';
COMMENT ON COLUMN workflow_tasks.status IS '任务状态：created|in_progress|completed|failed|cancelled';
COMMENT ON COLUMN workflow_tasks.external_url IS '外部任务链接';
COMMENT ON COLUMN workflow_tasks.labels IS '任务标签数组';
COMMENT ON COLUMN workflow_tasks.due_date IS '任务到期日期';
COMMENT ON COLUMN workflow_tasks.metadata IS '任务元数据';
COMMENT ON COLUMN workflow_tasks.sync_status IS '同步状态：pending|synced|error';
COMMENT ON COLUMN workflow_tasks.last_sync_at IS '最后同步时间';
COMMENT ON COLUMN workflow_tasks.sync_error_message IS '同步错误消息';
COMMENT ON COLUMN workflow_tasks.completed_at IS '任务完成时间';

-- ================================
-- 索引优化
-- ================================

-- integrations表索引
CREATE INDEX IF NOT EXISTS idx_integrations_user_type ON integrations(user_id, type);
CREATE INDEX IF NOT EXISTS idx_integrations_user_connected ON integrations(user_id, is_connected);
CREATE INDEX IF NOT EXISTS idx_integrations_type_status ON integrations(type, status);
CREATE INDEX IF NOT EXISTS idx_integrations_last_sync ON integrations(last_sync_at)
    WHERE last_sync_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integrations_status_error ON integrations(status)
    WHERE status = 'error';

-- workflow_tasks表索引
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_email ON workflow_tasks(email_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration ON workflow_tasks(integration_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration_external ON workflow_tasks(integration_id, external_task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_priority ON workflow_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_sync_status ON workflow_tasks(sync_status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assignee ON workflow_tasks(assignee)
    WHERE assignee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_due_date ON workflow_tasks(due_date)
    WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_created_at ON workflow_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_completed_at ON workflow_tasks(completed_at)
    WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_pending_sync ON workflow_tasks(sync_status)
    WHERE sync_status IN ('pending', 'error');

-- 复合索引用于常见查询
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_integration_status ON workflow_tasks(integration_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assignee_status ON workflow_tasks(assignee, status)
    WHERE assignee IS NOT NULL;

-- ================================
-- 触发器和约束
-- ================================

-- 更新时间触发器函数 (如果不存在的话)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为integrations表创建更新时间触发器
CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为workflow_tasks表创建更新时间触发器
CREATE TRIGGER update_workflow_tasks_updated_at
    BEFORE UPDATE ON workflow_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- workflow_tasks自动设置completed_at触发器
CREATE OR REPLACE FUNCTION set_workflow_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    -- 当状态变为completed时设置completed_at
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;

    -- 当状态从completed变为其他状态时清空completed_at
    IF NEW.status != 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_workflow_task_completed_at_trigger
    BEFORE UPDATE ON workflow_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_workflow_task_completed_at();

-- ================================
-- 默认数据插入
-- ================================

-- 插入集成类型的参考配置模板
-- 这些可以用作前端显示集成配置选项的参考

-- 注意：实际部署时，这些数据可能需要根据具体环境调整
INSERT INTO integrations (id, user_id, type, name, is_connected, credentials, configuration, status)
VALUES
-- 系统默认集成模板（不属于任何用户，仅作为模板）
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'trello', 'Trello集成模板', false,
'{"apiKey": null, "accessToken": null, "boardId": null}',
'{"defaultProject": null, "defaultAssignee": null, "taskTemplate": "来自邮件: {subject}", "defaultLabels": ["邮件任务"], "defaultPriority": "medium", "autoSync": true, "syncInterval": 30}',
'disabled'),

('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'jira', 'Jira集成模板', false,
'{"apiUrl": null, "accessToken": null, "apiKey": null, "projectId": null}',
'{"defaultProject": null, "defaultAssignee": null, "taskTemplate": "邮件任务: {subject}", "defaultLabels": ["email-task"], "defaultPriority": "Medium", "autoSync": true, "syncInterval": 30}',
'disabled'),

('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'asana', 'Asana集成模板', false,
'{"accessToken": null, "projectId": null}',
'{"defaultProject": null, "defaultAssignee": null, "taskTemplate": "Email Task: {subject}", "defaultLabels": ["email"], "defaultPriority": "medium", "autoSync": true, "syncInterval": 30}',
'disabled')

ON CONFLICT (user_id, type) DO NOTHING;

-- ================================
-- 权限设置
-- ================================

-- 确保相关用户角色有适当的权限
-- 注意：这部分需要根据实际的权限系统进行调整

-- 为integrations表设置行级安全策略 (如果使用RLS)
-- ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY integrations_user_policy ON integrations FOR ALL USING (user_id = current_user_id());

-- 为workflow_tasks表设置行级安全策略 (如果使用RLS)
-- ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY workflow_tasks_user_policy ON workflow_tasks FOR ALL USING (
--     integration_id IN (SELECT id FROM integrations WHERE user_id = current_user_id())
-- );

COMMIT;

-- ================================
-- 验证脚本
-- ================================

-- 验证表是否创建成功
DO $$
BEGIN
    -- 检查integrations表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
        RAISE EXCEPTION 'integrations表创建失败';
    END IF;

    -- 检查workflow_tasks表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_tasks') THEN
        RAISE EXCEPTION 'workflow_tasks表创建失败';
    END IF;

    -- 检查索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_integrations_user_type') THEN
        RAISE EXCEPTION 'integrations索引创建失败';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflow_tasks_integration_external') THEN
        RAISE EXCEPTION 'workflow_tasks索引创建失败';
    END IF;

    RAISE NOTICE '工作流集成表创建成功！';
    RAISE NOTICE '- integrations表已创建';
    RAISE NOTICE '- workflow_tasks表已创建';
    RAISE NOTICE '- 相关索引和触发器已创建';
    RAISE NOTICE '- 默认模板数据已插入';
END;
$$;