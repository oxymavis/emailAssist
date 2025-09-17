-- Team Collaboration Schema for Email Assist
-- 团队协作数据库架构

-- Create teams table
-- 创建团队表
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{
        "emailSharing": true,
        "taskSharing": true,
        "integrationSharing": false,
        "reportSharing": true,
        "memberCanInvite": true,
        "requireApproval": false
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create team_members table
-- 创建团队成员表
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Create activity_logs table
-- 创建活动日志表
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('email', 'task', 'integration', 'report', 'team')),
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_resources table
-- 创建共享资源表
CREATE TABLE IF NOT EXISTS shared_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('email', 'task', 'integration', 'report')),
    resource_id UUID NOT NULL,
    shared_by UUID NOT NULL REFERENCES users(id),
    permissions JSONB DEFAULT '[]',
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create team_invitations table
-- 创建团队邀请表
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for teams table
-- 为团队表创建索引
CREATE INDEX IF NOT EXISTS idx_teams_owner_id
    ON teams(owner_id);

CREATE INDEX IF NOT EXISTS idx_teams_is_default
    ON teams(is_default);

-- Create indexes for team_members table
-- 为团队成员表创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_team_user
    ON team_members(team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id
    ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id
    ON team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_team_members_role
    ON team_members(role);

CREATE INDEX IF NOT EXISTS idx_team_members_status
    ON team_members(status);

CREATE INDEX IF NOT EXISTS idx_team_members_last_activity
    ON team_members(last_activity)
    WHERE last_activity IS NOT NULL;

-- Create indexes for activity_logs table
-- 为活动日志表创建索引
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_id
    ON activity_logs(team_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
    ON activity_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp
    ON activity_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_activity_logs_resource
    ON activity_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
    ON activity_logs(action);

-- Create indexes for shared_resources table
-- 为共享资源表创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_resources_team_resource
    ON shared_resources(team_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_shared_resources_team_id
    ON shared_resources(team_id);

CREATE INDEX IF NOT EXISTS idx_shared_resources_shared_by
    ON shared_resources(shared_by);

CREATE INDEX IF NOT EXISTS idx_shared_resources_expires_at
    ON shared_resources(expires_at)
    WHERE expires_at IS NOT NULL;

-- Create indexes for team_invitations table
-- 为团队邀请表创建索引
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id
    ON team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
    ON team_invitations(email);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token
    ON team_invitations(token);

CREATE INDEX IF NOT EXISTS idx_team_invitations_status
    ON team_invitations(status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_expires_at
    ON team_invitations(expires_at);

-- Create trigger to automatically update updated_at timestamp for teams
-- 创建自动更新团队表时间戳的触发器
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update team member last_activity
-- 创建更新团队成员最后活动时间的触发器
CREATE OR REPLACE FUNCTION update_team_member_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE team_members
    SET last_activity = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id AND team_id = NEW.team_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_activity_on_log
    AFTER INSERT ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_team_member_activity();

-- Create function to clean up expired invitations
-- 创建清理过期邀请的函数
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE team_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's effective permissions
-- 创建获取用户有效权限的函数
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_team_id UUID
)
RETURNS JSONB AS $$
DECLARE
    user_role VARCHAR(50);
    permissions JSONB;
BEGIN
    -- Get user's role in the team
    SELECT role INTO user_role
    FROM team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND status = 'active';

    -- Return permissions based on role
    CASE user_role
        WHEN 'owner' THEN
            permissions := '[
                "email:read", "email:write", "email:delete", "email:share",
                "task:read", "task:create", "task:update", "task:delete", "task:assign",
                "integration:read", "integration:manage", "integration:delete",
                "report:read", "report:create", "report:delete",
                "team:read", "team:invite", "team:remove", "team:manage_roles",
                "system:admin", "system:settings"
            ]'::JSONB;
        WHEN 'admin' THEN
            permissions := '[
                "email:read", "email:write", "email:delete", "email:share",
                "task:read", "task:create", "task:update", "task:delete", "task:assign",
                "integration:read", "integration:manage",
                "report:read", "report:create", "report:delete",
                "team:read", "team:invite", "team:remove",
                "system:settings"
            ]'::JSONB;
        WHEN 'manager' THEN
            permissions := '[
                "email:read", "email:write", "email:share",
                "task:read", "task:create", "task:update", "task:assign",
                "integration:read",
                "report:read", "report:create",
                "team:read", "team:invite"
            ]'::JSONB;
        WHEN 'member' THEN
            permissions := '[
                "email:read", "email:write",
                "task:read", "task:create", "task:update",
                "integration:read",
                "report:read",
                "team:read"
            ]'::JSONB;
        WHEN 'viewer' THEN
            permissions := '[
                "email:read",
                "task:read",
                "integration:read",
                "report:read",
                "team:read"
            ]'::JSONB;
        ELSE
            permissions := '[]'::JSONB;
    END CASE;

    RETURN permissions;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has specific permission
-- 创建检查用户是否具有特定权限的函数
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_team_id UUID,
    p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    user_permissions := get_user_permissions(p_user_id, p_team_id);
    RETURN user_permissions ? p_permission;
END;
$$ LANGUAGE plpgsql;

-- Add comments to tables and columns
-- 为表和列添加注释
COMMENT ON TABLE teams IS '团队表，存储团队基本信息和设置';
COMMENT ON COLUMN teams.name IS '团队名称';
COMMENT ON COLUMN teams.description IS '团队描述';
COMMENT ON COLUMN teams.owner_id IS '团队所有者用户ID';
COMMENT ON COLUMN teams.is_default IS '是否为默认团队';
COMMENT ON COLUMN teams.settings IS '团队设置，包含共享配置等';

COMMENT ON TABLE team_members IS '团队成员表，存储成员角色和状态';
COMMENT ON COLUMN team_members.role IS '成员角色: owner, admin, manager, member, viewer';
COMMENT ON COLUMN team_members.status IS '成员状态: active, pending, suspended';
COMMENT ON COLUMN team_members.invited_by IS '邀请人用户ID';
COMMENT ON COLUMN team_members.last_activity IS '最后活动时间';

COMMENT ON TABLE activity_logs IS '活动日志表，记录团队内的操作行为';
COMMENT ON COLUMN activity_logs.action IS '操作类型';
COMMENT ON COLUMN activity_logs.resource_type IS '资源类型: email, task, integration, report, team';
COMMENT ON COLUMN activity_logs.resource_id IS '资源ID';
COMMENT ON COLUMN activity_logs.metadata IS '操作相关的元数据';

COMMENT ON TABLE shared_resources IS '共享资源表，管理团队内资源的共享';
COMMENT ON COLUMN shared_resources.resource_type IS '共享资源类型';
COMMENT ON COLUMN shared_resources.resource_id IS '共享资源ID';
COMMENT ON COLUMN shared_resources.permissions IS '共享权限配置';
COMMENT ON COLUMN shared_resources.expires_at IS '共享过期时间';

COMMENT ON TABLE team_invitations IS '团队邀请表，管理团队邀请流程';
COMMENT ON COLUMN team_invitations.email IS '被邀请人邮箱';
COMMENT ON COLUMN team_invitations.token IS '邀请令牌';
COMMENT ON COLUMN team_invitations.status IS '邀请状态: pending, accepted, declined, expired';
COMMENT ON COLUMN team_invitations.expires_at IS '邀请过期时间';

-- Grant permissions (adjust user as needed)
-- 授予权限（根据需要调整用户）
-- GRANT SELECT, INSERT, UPDATE, DELETE ON teams, team_members, activity_logs, shared_resources, team_invitations TO email_assist_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO email_assist_user;