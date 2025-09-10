-- ==========================================
-- Email Assist Backend - Phase 4 报告生成系统数据库迁移
-- 版本: 004
-- 创建时间: 2025-09-10
-- 描述: 创建报告生成、模板和调度相关的数据表
-- ==========================================

-- 开始事务
BEGIN;

-- 创建报告状态枚举
CREATE TYPE report_status_enum AS ENUM (
    'pending',
    'generating', 
    'completed',
    'failed',
    'cancelled'
);

-- 创建报告类型枚举
CREATE TYPE report_type_enum AS ENUM (
    'daily',
    'weekly',
    'monthly', 
    'custom',
    'summary',
    'performance'
);

-- 创建报告格式枚举
CREATE TYPE report_format_enum AS ENUM (
    'pdf',
    'excel',
    'json',
    'csv'
);

-- ==========================================
-- 1. 报告主表 (reports)
-- ==========================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    report_type report_type_enum NOT NULL,
    date_range JSONB NOT NULL, -- 存储时间范围 {start_date, end_date, timezone}
    status report_status_enum NOT NULL DEFAULT 'pending',
    format JSONB NOT NULL, -- 存储格式数组 ['pdf', 'excel']
    file_paths JSONB, -- 存储生成的文件路径数组
    file_size BIGINT, -- 文件总大小(字节)
    generated_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    parameters JSONB NOT NULL DEFAULT '{}', -- 报告参数配置
    template_id UUID, -- 可选的模板ID
    error_message TEXT,
    statistics JSONB, -- 报告生成统计信息
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 报告表索引
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_created_at ON reports(created_at);
CREATE INDEX idx_reports_template_id ON reports(template_id);
CREATE INDEX idx_reports_scheduled_at ON reports(scheduled_at);
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at) WHERE deleted_at IS NULL;

-- ==========================================
-- 2. 报告模板表 (report_templates)
-- ==========================================
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    report_type report_type_enum NOT NULL,
    default_parameters JSONB NOT NULL DEFAULT '{}',
    layout_config JSONB NOT NULL, -- 布局配置
    chart_configs JSONB NOT NULL DEFAULT '[]', -- 图表配置数组
    is_system BOOLEAN NOT NULL DEFAULT false, -- 是否为系统预定义模板
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 报告模板表索引
CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_report_templates_type ON report_templates(report_type);
CREATE INDEX idx_report_templates_is_system ON report_templates(is_system);
CREATE INDEX idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX idx_report_templates_usage_count ON report_templates(usage_count DESC);
CREATE INDEX idx_report_templates_deleted_at ON report_templates(deleted_at) WHERE deleted_at IS NULL;

-- ==========================================
-- 3. 报告调度表 (report_schedules)
-- ==========================================
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE, -- 可选，基于现有报告配置
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE, -- 可选，基于模板
    name VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(50) NOT NULL, -- cron表达式
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
    is_active BOOLEAN NOT NULL DEFAULT true,
    next_run TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    notification_settings JSONB NOT NULL DEFAULT '{}', -- 通知配置
    retention_days INTEGER NOT NULL DEFAULT 30, -- 报告保留天数
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- 约束：必须指定report_id或template_id之一
    CONSTRAINT check_schedule_source CHECK (
        (report_id IS NOT NULL AND template_id IS NULL) OR 
        (report_id IS NULL AND template_id IS NOT NULL)
    )
);

-- 报告调度表索引
CREATE INDEX idx_report_schedules_user_id ON report_schedules(user_id);
CREATE INDEX idx_report_schedules_is_active ON report_schedules(is_active);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run);
CREATE INDEX idx_report_schedules_template_id ON report_schedules(template_id);
CREATE INDEX idx_report_schedules_report_id ON report_schedules(report_id);
CREATE INDEX idx_report_schedules_deleted_at ON report_schedules(deleted_at) WHERE deleted_at IS NULL;

-- ==========================================
-- 4. 创建自动更新时间戳的触发器
-- ==========================================
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有表添加更新时间戳触发器
CREATE TRIGGER trigger_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER trigger_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER trigger_report_schedules_updated_at
    BEFORE UPDATE ON report_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- ==========================================
-- 5. 创建视图 - 报告统计视图
-- ==========================================
CREATE OR REPLACE VIEW v_report_statistics AS
SELECT 
    u.id as user_id,
    u.email as user_email,
    COUNT(r.id) as total_reports,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reports,
    COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_reports,
    COUNT(CASE WHEN r.status = 'generating' THEN 1 END) as generating_reports,
    COUNT(CASE WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as reports_last_7_days,
    COUNT(CASE WHEN r.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as reports_last_30_days,
    COALESCE(SUM(r.file_size), 0) as total_file_size,
    COALESCE(AVG((r.statistics->>'generation_time_ms')::integer), 0) as avg_generation_time_ms
FROM users u
LEFT JOIN reports r ON u.id = r.user_id AND r.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email;

-- ==========================================
-- 6. 创建视图 - 模板使用统计视图
-- ==========================================
CREATE OR REPLACE VIEW v_template_usage_statistics AS
SELECT 
    t.id,
    t.name,
    t.category,
    t.report_type,
    t.is_system,
    t.usage_count as direct_usage_count,
    COUNT(r.id) as report_generation_count,
    COUNT(rs.id) as schedule_usage_count,
    t.created_at,
    t.updated_at
FROM report_templates t
LEFT JOIN reports r ON t.id = r.template_id AND r.deleted_at IS NULL
LEFT JOIN report_schedules rs ON t.id = rs.template_id AND rs.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.category, t.report_type, t.is_system, t.usage_count, t.created_at, t.updated_at
ORDER BY (t.usage_count + COUNT(r.id) + COUNT(rs.id)) DESC;

-- ==========================================
-- 7. 创建视图 - 调度任务状态视图
-- ==========================================
CREATE OR REPLACE VIEW v_schedule_status AS
SELECT 
    rs.id,
    rs.user_id,
    rs.name,
    rs.cron_expression,
    rs.is_active,
    rs.next_run,
    rs.last_run,
    rs.success_count,
    rs.failure_count,
    CASE 
        WHEN rs.success_count + rs.failure_count = 0 THEN 0
        ELSE ROUND((rs.success_count::float / (rs.success_count + rs.failure_count)) * 100, 2)
    END as success_rate_percentage,
    CASE 
        WHEN rs.template_id IS NOT NULL THEN t.name
        WHEN rs.report_id IS NOT NULL THEN r.title
        ELSE 'Unknown'
    END as source_name,
    rs.created_at,
    rs.updated_at
FROM report_schedules rs
LEFT JOIN report_templates t ON rs.template_id = t.id
LEFT JOIN reports r ON rs.report_id = r.id
WHERE rs.deleted_at IS NULL;

-- ==========================================
-- 8. 插入系统预定义数据
-- ==========================================

-- 插入系统预定义模板（这些将被ReportTemplateService在代码中管理）
-- 这里只创建数据库结构的占位记录用于维护外键完整性

-- ==========================================
-- 9. 创建性能监控函数
-- ==========================================
CREATE OR REPLACE FUNCTION get_report_system_health()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT
) AS $$
BEGIN
    -- 检查报告生成性能
    RETURN QUERY
    SELECT 
        'active_report_generations'::TEXT,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 10 THEN 'warning' ELSE 'healthy' END::TEXT
    FROM reports 
    WHERE status = 'generating';
    
    -- 检查失败率
    RETURN QUERY
    WITH failure_stats AS (
        SELECT 
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
            COUNT(*) as total
        FROM reports 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
    )
    SELECT 
        'failure_rate_24h'::TEXT,
        CONCAT(ROUND((failed::float / NULLIF(total, 0)) * 100, 2), '%')::TEXT,
        CASE 
            WHEN total = 0 THEN 'healthy'
            WHEN (failed::float / total) > 0.1 THEN 'critical'
            WHEN (failed::float / total) > 0.05 THEN 'warning'
            ELSE 'healthy'
        END::TEXT
    FROM failure_stats;
    
    -- 检查调度任务状态
    RETURN QUERY
    SELECT 
        'active_schedules'::TEXT,
        COUNT(*)::TEXT,
        'healthy'::TEXT
    FROM report_schedules 
    WHERE is_active = true AND deleted_at IS NULL;
    
    -- 检查存储使用情况
    RETURN QUERY
    SELECT 
        'total_storage_mb'::TEXT,
        ROUND(COALESCE(SUM(file_size), 0) / 1024.0 / 1024.0, 2)::TEXT,
        CASE 
            WHEN COALESCE(SUM(file_size), 0) > 10737418240 THEN 'warning' -- > 10GB
            ELSE 'healthy'
        END::TEXT
    FROM reports 
    WHERE file_size IS NOT NULL AND deleted_at IS NULL;
    
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 10. 创建清理过期报告的函数
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_expired_reports(retention_days INTEGER DEFAULT 30)
RETURNS TABLE(
    deleted_count INTEGER,
    freed_space_mb NUMERIC
) AS $$
DECLARE
    total_deleted INTEGER;
    total_space BIGINT;
BEGIN
    -- 计算即将删除的报告占用的空间
    SELECT 
        COUNT(*),
        COALESCE(SUM(file_size), 0)
    INTO total_deleted, total_space
    FROM reports 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status = 'completed'
    AND deleted_at IS NULL;
    
    -- 软删除过期报告
    UPDATE reports 
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status = 'completed'
    AND deleted_at IS NULL;
    
    -- 返回结果
    RETURN QUERY SELECT 
        total_deleted,
        ROUND(total_space / 1024.0 / 1024.0, 2);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 11. 创建报告生成性能统计函数
-- ==========================================
CREATE OR REPLACE FUNCTION get_report_performance_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    date_created DATE,
    total_reports INTEGER,
    completed_reports INTEGER,
    failed_reports INTEGER,
    avg_generation_time_ms NUMERIC,
    success_rate_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(r.created_at) as date_created,
        COUNT(*)::INTEGER as total_reports,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END)::INTEGER as completed_reports,
        COUNT(CASE WHEN r.status = 'failed' THEN 1 END)::INTEGER as failed_reports,
        ROUND(AVG(CASE 
            WHEN r.statistics IS NOT NULL AND r.statistics ? 'generation_time_ms' 
            THEN (r.statistics->>'generation_time_ms')::numeric 
        END), 2) as avg_generation_time_ms,
        ROUND(
            (COUNT(CASE WHEN r.status = 'completed' THEN 1 END)::float / 
             NULLIF(COUNT(*), 0)) * 100, 2
        ) as success_rate_percentage
    FROM reports r
    WHERE r.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND r.deleted_at IS NULL
    GROUP BY DATE(r.created_at)
    ORDER BY date_created DESC;
END;
$$ LANGUAGE plpgsql;

-- 提交事务
COMMIT;

-- ==========================================
-- 迁移完成日志
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Email Assist Phase 4 数据库迁移完成！';
    RAISE NOTICE '版本: 004';
    RAISE NOTICE '创建时间: %', NOW();
    RAISE NOTICE '===========================================';
    RAISE NOTICE '已创建的表:';
    RAISE NOTICE '  - reports (报告主表)';
    RAISE NOTICE '  - report_templates (报告模板表)';
    RAISE NOTICE '  - report_schedules (报告调度表)';
    RAISE NOTICE '已创建的视图:';
    RAISE NOTICE '  - v_report_statistics (报告统计视图)';
    RAISE NOTICE '  - v_template_usage_statistics (模板使用统计视图)';
    RAISE NOTICE '  - v_schedule_status (调度任务状态视图)';
    RAISE NOTICE '已创建的函数:';
    RAISE NOTICE '  - get_report_system_health() (系统健康检查)';
    RAISE NOTICE '  - cleanup_expired_reports() (清理过期报告)';
    RAISE NOTICE '  - get_report_performance_stats() (性能统计)';
    RAISE NOTICE '===========================================';
END $$;