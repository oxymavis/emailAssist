-- Filter Rules Tables Migration
-- 创建智能过滤规则引擎相关的数据表

-- 1. 过滤规则主表
CREATE TABLE IF NOT EXISTS filter_rules (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  logic_operator VARCHAR(3) DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. 规则条件表
CREATE TABLE IF NOT EXISTS filter_rule_conditions (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL,
  field VARCHAR(100) NOT NULL, -- 字段名：subject, sender, content, priority, etc.
  operator VARCHAR(20) NOT NULL, -- 操作符：equals, contains, startsWith, endsWith, regex, gt, lt, etc.
  value TEXT NOT NULL, -- 匹配值
  value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'date')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 外键约束
  FOREIGN KEY (rule_id) REFERENCES filter_rules(id) ON DELETE CASCADE
);

-- 3. 规则动作表
CREATE TABLE IF NOT EXISTS filter_rule_actions (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 动作类型：tag, move_to_folder, forward, create_task, send_notification, etc.
  parameters JSONB DEFAULT '{}', -- 动作参数（JSON格式）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 外键约束
  FOREIGN KEY (rule_id) REFERENCES filter_rules(id) ON DELETE CASCADE
);

-- 4. 规则执行日志表
CREATE TABLE IF NOT EXISTS rule_execution_logs (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email_message_id VARCHAR(255), -- 邮件消息ID（来自Microsoft Graph API）
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  actions_executed JSONB DEFAULT '[]', -- 已执行的动作列表
  error_message TEXT, -- 错误信息（如果执行失败）
  execution_duration_ms INTEGER, -- 执行耗时（毫秒）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 外键约束
  FOREIGN KEY (rule_id) REFERENCES filter_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引以提升查询性能
-- 过滤规则索引
CREATE INDEX IF NOT EXISTS idx_filter_rules_user_id ON filter_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_rules_active ON filter_rules(user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_filter_rules_priority ON filter_rules(user_id, priority) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_filter_rules_created_at ON filter_rules(created_at);

-- 规则条件索引
CREATE INDEX IF NOT EXISTS idx_filter_rule_conditions_rule_id ON filter_rule_conditions(rule_id);
CREATE INDEX IF NOT EXISTS idx_filter_rule_conditions_field ON filter_rule_conditions(field);

-- 规则动作索引
CREATE INDEX IF NOT EXISTS idx_filter_rule_actions_rule_id ON filter_rule_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_filter_rule_actions_type ON filter_rule_actions(type);

-- 执行日志索引
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_rule_id ON rule_execution_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_user_id ON rule_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_execution_time ON rule_execution_logs(execution_time);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_status ON rule_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_email_message ON rule_execution_logs(email_message_id);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_user_rule ON rule_execution_logs(user_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_user_time ON rule_execution_logs(user_id, execution_time);
CREATE INDEX IF NOT EXISTS idx_rule_execution_logs_rule_status ON rule_execution_logs(rule_id, status);

-- 触发器：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 filter_rules 表创建触发器
CREATE TRIGGER update_filter_rules_updated_at
  BEFORE UPDATE ON filter_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建用于获取规则统计的视图
CREATE OR REPLACE VIEW filter_rules_stats AS
SELECT 
  fr.id,
  fr.user_id,
  fr.name,
  fr.is_active,
  fr.priority,
  COUNT(DISTINCT frc.id) as conditions_count,
  COUNT(DISTINCT fra.id) as actions_count,
  COUNT(rel.id) as total_executions,
  COUNT(rel.id) FILTER (WHERE rel.status = 'success') as successful_executions,
  COUNT(rel.id) FILTER (WHERE rel.status = 'error') as failed_executions,
  MAX(rel.execution_time) as last_execution_time
FROM filter_rules fr
LEFT JOIN filter_rule_conditions frc ON fr.id = frc.rule_id
LEFT JOIN filter_rule_actions fra ON fr.id = fra.rule_id
LEFT JOIN rule_execution_logs rel ON fr.id = rel.rule_id
WHERE fr.deleted_at IS NULL
GROUP BY fr.id, fr.user_id, fr.name, fr.is_active, fr.priority;

-- 插入一些默认的规则模板数据（可选）
-- 注意：这些模板仅用于演示，实际使用时会根据用户需求创建

-- 创建一个存储规则模板的表
CREATE TABLE IF NOT EXISTS filter_rule_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 分类：productivity, security, organization, etc.
  template_data JSONB NOT NULL, -- 规则模板的完整配置
  is_system BOOLEAN DEFAULT false, -- 是否为系统模板
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入一些系统规则模板
INSERT INTO filter_rule_templates (id, name, description, category, template_data, is_system) VALUES
(
  gen_random_uuid(),
  '高优先级邮件标记',
  '自动标记来自重要联系人或包含紧急关键词的邮件',
  'productivity',
  '{
    "name": "高优先级邮件标记",
    "logicOperator": "OR",
    "conditions": [
      {"field": "sender", "operator": "in", "value": "", "valueType": "string"},
      {"field": "subject", "operator": "contains", "value": "紧急", "valueType": "string"},
      {"field": "subject", "operator": "contains", "value": "urgent", "valueType": "string"}
    ],
    "actions": [
      {"type": "add_tag", "parameters": {"tags": ["高优先级", "重要"]}}
    ]
  }'::jsonb,
  true
),
(
  gen_random_uuid(),
  '垃圾邮件自动归档',
  '自动将疑似垃圾邮件移动到垃圾箱并标记',
  'security',
  '{
    "name": "垃圾邮件自动归档",
    "logicOperator": "OR", 
    "conditions": [
      {"field": "subject", "operator": "contains", "value": "中奖", "valueType": "string"},
      {"field": "subject", "operator": "contains", "value": "免费", "valueType": "string"},
      {"field": "content", "operator": "contains", "value": "点击链接", "valueType": "string"}
    ],
    "actions": [
      {"type": "move_to_folder", "parameters": {"folderId": "junkemail"}},
      {"type": "add_tag", "parameters": {"tags": ["垃圾邮件"]}}
    ]
  }'::jsonb,
  true
),
(
  gen_random_uuid(),
  '会议邀请自动处理',
  '自动处理会议邀请邮件，创建任务提醒',
  'productivity',
  '{
    "name": "会议邀请自动处理",
    "logicOperator": "AND",
    "conditions": [
      {"field": "subject", "operator": "contains", "value": "会议", "valueType": "string"},
      {"field": "content", "operator": "contains", "value": "邀请", "valueType": "string"}
    ],
    "actions": [
      {"type": "add_tag", "parameters": {"tags": ["会议", "日程"]}},
      {"type": "create_task", "parameters": {"title": "查看会议邀请", "priority": "normal"}}
    ]
  }'::jsonb,
  true
);

-- 创建规则模板索引
CREATE INDEX IF NOT EXISTS idx_filter_rule_templates_category ON filter_rule_templates(category);
CREATE INDEX IF NOT EXISTS idx_filter_rule_templates_system ON filter_rule_templates(is_system);

-- 为规则模板表创建更新触发器
CREATE TRIGGER update_filter_rule_templates_updated_at
  BEFORE UPDATE ON filter_rule_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 添加一些约束检查
ALTER TABLE filter_rules ADD CONSTRAINT check_priority_positive CHECK (priority > 0);
ALTER TABLE filter_rule_conditions ADD CONSTRAINT check_field_not_empty CHECK (length(trim(field)) > 0);
ALTER TABLE filter_rule_conditions ADD CONSTRAINT check_operator_not_empty CHECK (length(trim(operator)) > 0);
ALTER TABLE filter_rule_actions ADD CONSTRAINT check_type_not_empty CHECK (length(trim(type)) > 0);

COMMENT ON TABLE filter_rules IS '过滤规则主表 - 存储用户创建的邮件过滤规则';
COMMENT ON TABLE filter_rule_conditions IS '规则条件表 - 存储规则的匹配条件';
COMMENT ON TABLE filter_rule_actions IS '规则动作表 - 存储规则触发时执行的动作';
COMMENT ON TABLE rule_execution_logs IS '规则执行日志表 - 记录规则执行历史和结果';
COMMENT ON TABLE filter_rule_templates IS '规则模板表 - 存储预定义的规则模板';

COMMENT ON COLUMN filter_rules.logic_operator IS '条件逻辑运算符：AND（所有条件都满足）或 OR（任一条件满足）';
COMMENT ON COLUMN filter_rule_conditions.field IS '匹配字段：subject(主题)、sender(发件人)、content(内容)等';
COMMENT ON COLUMN filter_rule_conditions.operator IS '匹配操作符：equals(等于)、contains(包含)、regex(正则)等';
COMMENT ON COLUMN filter_rule_actions.type IS '动作类型：tag(标签)、move_to_folder(移动)、forward(转发)等';
COMMENT ON COLUMN rule_execution_logs.status IS '执行状态：success(成功)、error(失败)、skipped(跳过)';