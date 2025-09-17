-- ===============================================
-- 高级搜索和智能过滤系统数据库架构
-- ===============================================

-- 1. 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text TEXT,
    query_type VARCHAR(20) NOT NULL CHECK (query_type IN ('fulltext', 'semantic', 'advanced', 'filter')),
    search_filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    execution_time INTEGER DEFAULT 0, -- 毫秒
    clicked_results JSONB DEFAULT '[]', -- 用户点击的搜索结果ID数组
    search_session_id VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 搜索历史索引
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_search_history_query_type ON search_history(query_type);
CREATE INDEX IF NOT EXISTS idx_search_history_session_id ON search_history(search_session_id);
CREATE INDEX IF NOT EXISTS idx_search_history_query_text ON search_history USING gin(to_tsvector('simple', query_text));

-- 2. 搜索会话表
CREATE TABLE IF NOT EXISTS search_sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    total_searches INTEGER DEFAULT 0,
    unique_queries INTEGER DEFAULT 0,
    most_searched_terms TEXT[],
    metadata JSONB DEFAULT '{}'
);

-- 搜索会话索引
CREATE INDEX IF NOT EXISTS idx_search_sessions_user_id ON search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_start ON search_sessions(session_start);

-- 3. 搜索过滤器预设表
CREATE TABLE IF NOT EXISTS search_filter_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    filter_config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 过滤器预设索引
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id ON search_filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_is_public ON search_filter_presets(is_public);
CREATE INDEX IF NOT EXISTS idx_filter_presets_usage_count ON search_filter_presets(usage_count);

-- 4. 邮件向量嵌入表（用于语义搜索）
CREATE TABLE IF NOT EXISTS email_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    vector VECTOR(1536) NOT NULL, -- DeepSeek embedding维度
    model VARCHAR(50) DEFAULT 'deepseek-embedding',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id)
);

-- 向量相似度搜索索引
CREATE INDEX IF NOT EXISTS idx_email_embeddings_message_id ON email_embeddings(message_id);
CREATE INDEX IF NOT EXISTS idx_email_embeddings_model ON email_embeddings(model);
-- 向量相似度索引（需要 pgvector 扩展）
CREATE INDEX IF NOT EXISTS idx_email_embeddings_vector ON email_embeddings USING ivfflat (vector vector_cosine_ops);

-- 5. 搜索建议缓存表
CREATE TABLE IF NOT EXISTS search_suggestions_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    suggestions JSONB NOT NULL,
    suggestion_type VARCHAR(20) CHECK (suggestion_type IN ('query', 'filter', 'sender', 'subject', 'keyword')),
    confidence DECIMAL(3,2) DEFAULT 0.5,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    UNIQUE(query_hash, user_id)
);

-- 搜索建议索引
CREATE INDEX IF NOT EXISTS idx_suggestions_cache_query_hash ON search_suggestions_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_suggestions_cache_user_id ON search_suggestions_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_cache_expires_at ON search_suggestions_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_cache_type ON search_suggestions_cache(suggestion_type);

-- 6. 扩展邮件消息表，增加搜索相关字段和索引
-- 为现有 email_messages 表添加搜索优化索引

-- 全文搜索索引（主题和内容）
CREATE INDEX IF NOT EXISTS idx_email_messages_fulltext_search ON email_messages 
USING gin(to_tsvector('simple', COALESCE(subject, '') || ' ' || COALESCE(content_text, '')));

-- 中文全文搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_fulltext_zh ON email_messages 
USING gin(to_tsvector('jieba', COALESCE(subject, '') || ' ' || COALESCE(content_text, '')));

-- 发件人搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_address ON email_messages(sender_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_name ON email_messages(sender_name);

-- 主题搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_subject ON email_messages USING gin(subject gin_trgm_ops);

-- 日期范围搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at);

-- 属性搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_importance ON email_messages(importance);
CREATE INDEX IF NOT EXISTS idx_email_messages_has_attachments ON email_messages(has_attachments);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_draft ON email_messages(is_draft);

-- 文件夹和标签搜索索引
CREATE INDEX IF NOT EXISTS idx_email_messages_folders ON email_messages USING gin(folders);
CREATE INDEX IF NOT EXISTS idx_email_messages_tags ON email_messages USING gin(tags);

-- 组合搜索索引（优化常见搜索组合）
CREATE INDEX IF NOT EXISTS idx_email_messages_compound_search ON email_messages(account_id, received_at DESC, is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_compound_sender ON email_messages(sender_address, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_compound_importance ON email_messages(importance, received_at DESC);

-- 7. 分析结果搜索索引
-- 为 email_analysis_cache 表添加搜索索引

-- 情感分析搜索
CREATE INDEX IF NOT EXISTS idx_analysis_cache_sentiment ON email_analysis_cache(sentiment);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_priority_score ON email_analysis_cache(priority_score);

-- 分类搜索
CREATE INDEX IF NOT EXISTS idx_analysis_cache_category ON email_analysis_cache(category);

-- 关键词搜索
CREATE INDEX IF NOT EXISTS idx_analysis_cache_keywords ON email_analysis_cache USING gin(keywords);

-- 置信度搜索
CREATE INDEX IF NOT EXISTS idx_analysis_cache_confidence ON email_analysis_cache(confidence_score);

-- 8. 搜索性能监控表
CREATE TABLE IF NOT EXISTS search_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    search_type VARCHAR(20) NOT NULL,
    total_searches INTEGER DEFAULT 0,
    avg_execution_time DECIMAL(10,2) DEFAULT 0,
    slow_queries_count INTEGER DEFAULT 0,
    no_result_queries_count INTEGER DEFAULT 0,
    cache_hit_rate DECIMAL(5,2) DEFAULT 0,
    peak_concurrent_searches INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(metric_date, search_type)
);

-- 性能指标索引
CREATE INDEX IF NOT EXISTS idx_perf_metrics_date ON search_performance_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_type ON search_performance_metrics(search_type);

-- 9. 热门搜索词统计表
CREATE TABLE IF NOT EXISTS popular_search_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    success_rate DECIMAL(5,2) DEFAULT 0, -- 成功返回结果的比率
    avg_results_count DECIMAL(8,2) DEFAULT 0,
    last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_range_start DATE NOT NULL DEFAULT CURRENT_DATE,
    date_range_end DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(term, date_range_start)
);

-- 热门搜索词索引
CREATE INDEX IF NOT EXISTS idx_popular_terms_count ON popular_search_terms(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_popular_terms_success_rate ON popular_search_terms(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_popular_terms_date ON popular_search_terms(date_range_start);

-- 10. 搜索质量反馈表
CREATE TABLE IF NOT EXISTS search_quality_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_id VARCHAR(32), -- 对应搜索会话ID
    query_text TEXT,
    search_type VARCHAR(20),
    feedback_type VARCHAR(20) CHECK (feedback_type IN ('helpful', 'not_helpful', 'irrelevant', 'missing_results')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    clicked_results JSONB DEFAULT '[]',
    result_relevance JSONB DEFAULT '{}', -- 结果相关性评分
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 搜索质量反馈索引
CREATE INDEX IF NOT EXISTS idx_search_feedback_user_id ON search_quality_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_search_feedback_search_id ON search_quality_feedback(search_id);
CREATE INDEX IF NOT EXISTS idx_search_feedback_type ON search_quality_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_search_feedback_rating ON search_quality_feedback(rating);

-- ===============================================
-- 视图和函数
-- ===============================================

-- 1. 搜索统计视图
CREATE OR REPLACE VIEW search_analytics_view AS
SELECT 
    DATE_TRUNC('day', created_at) as search_date,
    query_type,
    COUNT(*) as total_searches,
    AVG(execution_time) as avg_execution_time,
    COUNT(CASE WHEN results_count = 0 THEN 1 END) as no_result_searches,
    COUNT(CASE WHEN execution_time > 5000 THEN 1 END) as slow_searches,
    COUNT(DISTINCT user_id) as active_users
FROM search_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), query_type
ORDER BY search_date DESC, query_type;

-- 2. 用户搜索行为分析视图
CREATE OR REPLACE VIEW user_search_behavior_view AS
SELECT 
    user_id,
    COUNT(*) as total_searches,
    COUNT(DISTINCT query_text) as unique_queries,
    AVG(execution_time) as avg_execution_time,
    COUNT(CASE WHEN results_count > 0 THEN 1 END)::FLOAT / COUNT(*) as success_rate,
    STRING_AGG(DISTINCT query_type, ', ') as used_search_types,
    MAX(created_at) as last_search_time
FROM search_history
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id;

-- 3. 搜索建议生成函数
CREATE OR REPLACE FUNCTION generate_search_suggestions(
    input_query TEXT,
    user_id_param UUID DEFAULT NULL,
    limit_param INTEGER DEFAULT 10
)
RETURNS TABLE(
    suggestion TEXT,
    type VARCHAR(20),
    confidence DECIMAL(3,2),
    frequency INTEGER
) AS $$
BEGIN
    -- 基于历史搜索的建议
    RETURN QUERY
    SELECT DISTINCT
        sh.query_text as suggestion,
        'history'::VARCHAR(20) as type,
        CASE 
            WHEN sh.results_count > 0 THEN 0.9
            ELSE 0.5
        END as confidence,
        COUNT(*)::INTEGER as frequency
    FROM search_history sh
    WHERE (user_id_param IS NULL OR sh.user_id = user_id_param)
        AND sh.query_text ILIKE '%' || input_query || '%'
        AND sh.query_text != input_query
        AND sh.results_count > 0
    GROUP BY sh.query_text, sh.results_count
    ORDER BY frequency DESC, confidence DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- 4. 清理过期搜索数据函数
CREATE OR REPLACE FUNCTION cleanup_search_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- 清理过期的搜索建议缓存
    DELETE FROM search_suggestions_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 清理90天前的搜索历史（保留用于分析的聚合数据）
    DELETE FROM search_history 
    WHERE created_at < NOW() - INTERVAL '90 days'
        AND user_id NOT IN (
            SELECT DISTINCT user_id 
            FROM users 
            WHERE role = 'admin'
        );
    
    -- 更新删除计数
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- 清理旧的性能指标（保留1年）
    DELETE FROM search_performance_metrics 
    WHERE metric_date < CURRENT_DATE - INTERVAL '365 days';
    
    -- 清理旧的热门搜索词（保留6个月）
    DELETE FROM popular_search_terms 
    WHERE date_range_end < CURRENT_DATE - INTERVAL '180 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 触发器
-- ===============================================

-- 1. 更新搜索预设的 updated_at 触发器
DROP TRIGGER IF EXISTS update_filter_presets_updated_at ON search_filter_presets;
CREATE TRIGGER update_filter_presets_updated_at
    BEFORE UPDATE ON search_filter_presets
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. 搜索历史统计触发器
CREATE OR REPLACE FUNCTION update_search_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新热门搜索词统计
    INSERT INTO popular_search_terms (term, search_count, success_rate, avg_results_count, last_searched, date_range_start, date_range_end)
    VALUES (
        NEW.query_text,
        1,
        CASE WHEN NEW.results_count > 0 THEN 100.0 ELSE 0.0 END,
        NEW.results_count,
        NEW.created_at,
        DATE(NEW.created_at),
        DATE(NEW.created_at)
    )
    ON CONFLICT (term, date_range_start) DO UPDATE SET
        search_count = popular_search_terms.search_count + 1,
        success_rate = (
            (popular_search_terms.success_rate * popular_search_terms.search_count + 
             CASE WHEN NEW.results_count > 0 THEN 100.0 ELSE 0.0 END) / 
            (popular_search_terms.search_count + 1)
        ),
        avg_results_count = (
            (popular_search_terms.avg_results_count * popular_search_terms.search_count + NEW.results_count) /
            (popular_search_terms.search_count + 1)
        ),
        last_searched = NEW.created_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用搜索统计触发器
DROP TRIGGER IF EXISTS trigger_update_search_statistics ON search_history;
CREATE TRIGGER trigger_update_search_statistics
    AFTER INSERT ON search_history
    FOR EACH ROW
    EXECUTE FUNCTION update_search_statistics();

-- ===============================================
-- 初始化和优化
-- ===============================================

-- 1. 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS vector; -- pgvector 用于向量搜索
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- 三元组搜索
CREATE EXTENSION IF NOT EXISTS btree_gin; -- GIN索引优化

-- 2. 优化搜索配置
-- 设置全文搜索配置
ALTER SYSTEM SET default_text_search_config = 'simple';

-- 优化向量搜索性能
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET effective_cache_size = '1GB';

-- 3. 创建管理员权限的搜索分析函数
CREATE OR REPLACE FUNCTION get_global_search_analytics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    total_searches BIGINT,
    unique_users BIGINT,
    avg_execution_time DECIMAL(10,2),
    search_type_breakdown JSONB,
    top_queries JSONB,
    performance_trends JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_searches,
        COUNT(DISTINCT sh.user_id)::BIGINT as unique_users,
        AVG(sh.execution_time)::DECIMAL(10,2) as avg_execution_time,
        
        -- 搜索类型分布
        (SELECT jsonb_object_agg(query_type, count)
         FROM (
             SELECT query_type, COUNT(*)::INTEGER as count
             FROM search_history
             WHERE DATE(created_at) BETWEEN start_date AND end_date
             GROUP BY query_type
         ) t1) as search_type_breakdown,
        
        -- 热门查询
        (SELECT jsonb_agg(
             jsonb_build_object(
                 'query', query_text,
                 'count', search_count,
                 'success_rate', success_rate
             ) ORDER BY search_count DESC
         )
         FROM (
             SELECT query_text, COUNT(*)::INTEGER as search_count,
                    AVG(CASE WHEN results_count > 0 THEN 1.0 ELSE 0.0 END)::DECIMAL(5,2) as success_rate
             FROM search_history
             WHERE DATE(created_at) BETWEEN start_date AND end_date
                   AND query_text IS NOT NULL
                   AND query_text != ''
             GROUP BY query_text
             ORDER BY search_count DESC
             LIMIT 10
         ) t2) as top_queries,
        
        -- 性能趋势
        (SELECT jsonb_agg(
             jsonb_build_object(
                 'date', search_date,
                 'avg_time', avg_time,
                 'total_searches', daily_count
             ) ORDER BY search_date
         )
         FROM (
             SELECT DATE(created_at) as search_date,
                    AVG(execution_time)::DECIMAL(8,2) as avg_time,
                    COUNT(*)::INTEGER as daily_count
             FROM search_history
             WHERE DATE(created_at) BETWEEN start_date AND end_date
             GROUP BY DATE(created_at)
             ORDER BY search_date
         ) t3) as performance_trends
    
    FROM search_history sh
    WHERE DATE(sh.created_at) BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 定期维护任务（需要在应用层调度）
COMMENT ON FUNCTION cleanup_search_data() IS 'Run this function daily to clean up expired search data';

-- ===============================================
-- 完成消息
-- ===============================================
-- 搜索系统数据库架构创建完成
-- 包含以下功能：
-- 1. 全文搜索索引优化
-- 2. 语义搜索向量存储
-- 3. 搜索历史和会话管理
-- 4. 智能搜索建议系统
-- 5. 搜索性能监控
-- 6. 搜索质量反馈
-- 7. 自动化数据清理
-- 8. 综合搜索分析