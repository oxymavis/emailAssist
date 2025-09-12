# Email Assist 监控系统完整指南

## 概览

Email Assist 监控系统是一个全面的智能监控解决方案，提供业务指标监控、系统资源监控、应用性能监控(APM)、安全审计、智能告警等功能，并支持与主流第三方监控工具的集成。

## 系统架构

### 监控组件架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   业务指标监控   │    │   系统资源监控   │    │    APM监控      │
│ BusinessMetrics │    │ SystemResource  │    │   APMService    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   安全审计监控   │    │   智能告警系统   │    │   第三方集成    │
│ SecurityAudit   │    │  AlertingSystem │    │ThirdPartyInteg. │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │   配置管理系统   │
                    │  ConfigManager  │
                    └─────────────────┘
```

### 数据流架构

```
数据采集 → 数据处理 → 数据存储 → 告警检测 → 通知发送
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
监控指标   规则引擎   Redis缓存   告警规则   多渠道通知
系统事件   数据聚合   PostgreSQL  阈值检查   邮件/Slack
用户行为   异常检测   时序存储   智能分析   Webhook
```

## 功能模块详解

### 1. 业务指标监控 (Business Metrics)

**监控范围**：
- 邮件处理量统计（接收、发送、分析）
- 用户活跃度指标（登录、操作频次）
- AI分析准确率和效果评估
- 规则引擎执行效果监控
- 报告生成成功率和耗时

**核心指标**：
```typescript
interface EmailMetrics {
  processed: number;        // 已处理邮件数量
  received: number;         // 接收邮件数量
  sent: number;            // 发送邮件数量
  analyzed: number;        // AI分析邮件数量
  avgProcessingTime: number; // 平均处理时间(ms)
  errorRate: number;       // 错误率(%)
}

interface UserActivityMetrics {
  activeUsers: number;      // 活跃用户数
  totalLogins: number;      // 总登录次数
  avgSessionDuration: number; // 平均会话时长(分钟)
  totalOperations: number;  // 总操作次数
}
```

**使用方式**：
```typescript
import BusinessMetricsService from '@/services/monitoring/BusinessMetricsService';

const businessMetrics = new BusinessMetricsService(redis);
await businessMetrics.startMonitoring(60000); // 1分钟间隔

// 获取当前业务状态
const status = businessMetrics.getCurrentBusinessStatus();
console.log(`业务状态：${status.status}`);
console.log(`摘要：${status.summary}`);
```

### 2. 系统资源监控 (System Resource Monitor)

**监控范围**：
- CPU、内存、磁盘使用率
- 网络I/O和带宽监控
- 进程和线程状态监控
- 垃圾回收和内存泄漏检测

**核心指标**：
```typescript
interface CPUMetrics {
  usage: number;           // CPU使用率 (%)
  loadAverage: number[];   // 负载平均值 [1min, 5min, 15min]
  cores: number;           // CPU核心数
  temperature?: number;    // CPU温度 (°C)
}

interface MemoryMetrics {
  total: number;          // 总内存 (bytes)
  used: number;           // 已用内存 (bytes)
  usage: number;          // 使用率 (%)
  available: number;      // 可用内存 (bytes)
}
```

**使用方式**：
```typescript
import SystemResourceMonitor from '@/services/monitoring/SystemResourceMonitor';

const systemMonitor = new SystemResourceMonitor(redis);
await systemMonitor.startMonitoring(30000); // 30秒间隔

// 监听系统指标事件
systemMonitor.on('systemMetrics', (metrics) => {
  console.log(`CPU使用率：${metrics.cpu.usage}%`);
  console.log(`内存使用率：${metrics.memory.usage}%`);
});
```

### 3. 应用性能监控 (APM)

**监控范围**：
- HTTP请求响应时间分析
- API端点性能监控
- 数据库查询性能分析
- 第三方服务调用监控
- 错误率和异常追踪

**核心功能**：
```typescript
interface HttpRequestMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;          // 响应时间 (ms)
  timestamp: Date;
}

interface DatabaseQueryMetrics {
  queryId: string;
  query: string;
  duration: number;          // 查询时间 (ms)
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  rowsAffected?: number;
}
```

**Express中间件集成**：
```typescript
import APMService from '@/services/monitoring/APMService';

const apmService = new APMService(redis);
app.use(apmService.httpMiddleware());

// 记录数据库查询
apmService.recordDatabaseMetrics({
  queryId: 'query_123',
  query: 'SELECT * FROM users WHERE id = $1',
  duration: 45,
  timestamp: new Date(),
  database: 'main',
  operation: 'SELECT'
});
```

### 4. 安全审计监控 (Security Audit)

**监控范围**：
- 身份验证失败次数
- 可疑登录行为检测
- API调用频率异常监控
- 数据访问权限审计
- 敏感操作日志记录

**核心功能**：
```typescript
interface AuthenticationEvent {
  type: 'login' | 'logout' | 'login_failed';
  userId?: string;
  ip: string;
  userAgent: string;
  riskScore: number;  // 风险评分 0-100
}

interface SecurityAnomaly {
  type: 'suspicious_login' | 'brute_force_attack' | 'privilege_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  indicators: string[];
}
```

**使用方式**：
```typescript
import SecurityAuditService from '@/services/monitoring/SecurityAuditService';

const securityAudit = new SecurityAuditService(redis);
await securityAudit.startMonitoring();

// 记录认证事件
await securityAudit.recordAuthenticationEvent(
  'login',
  'user123',
  'john@example.com',
  req,
  { success: true, sessionId: 'session_456' }
);

// 记录敏感操作
await securityAudit.recordSensitiveOperation(
  'data_export',
  'user123',
  'export_user_data',
  'users_table',
  req,
  { affectedRecords: 1000 }
);
```

### 5. 智能告警系统 (Intelligent Alerting)

**核心功能**：
- 多渠道告警通知（邮件、Slack、Webhook、短信）
- 智能告警聚合和去重
- 告警级别分类和升级机制
- 告警规则动态配置
- 告警历史和趋势分析

**告警配置**：
```typescript
interface Alert {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  category: 'system' | 'business' | 'security' | 'performance';
  source: string;
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'silenced';
}

interface AlertRule {
  name: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  escalationRules: EscalationRule[];
  cooldownPeriod: number;   // 冷却期(秒)
}
```

**使用示例**：
```typescript
import IntelligentAlertingSystem from '@/services/monitoring/IntelligentAlertingSystem';

const alertingSystem = new IntelligentAlertingSystem(redis);
await alertingSystem.startAlerting();

// 创建告警
const alert = await alertingSystem.createAlert({
  title: 'CPU使用率过高',
  message: 'CPU使用率达到95%，需要立即处理',
  level: 'critical',
  category: 'system',
  source: 'system_monitor',
  metadata: { cpuUsage: 95 }
});

// 确认告警
await alertingSystem.acknowledgeAlert(alert.id, 'admin_user', '正在处理中');
```

## API接口文档

### 监控概览接口

#### GET /api/monitoring/dashboard
获取监控仪表板概览数据

**响应示例**：
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "overallStatus": "healthy",
    "business": {
      "status": "healthy",
      "summary": "业务运行正常：已处理1250封邮件，45个活跃用户，AI分析准确率92.5%",
      "metrics": {
        "emailsProcessed": 1250,
        "activeUsers": 45,
        "aiAnalysisAccuracy": 92.5
      }
    },
    "system": {
      "status": "warning",
      "summary": "系统资源正常：CPU使用率65%，内存使用率78%，磁盘使用率45%",
      "metrics": {
        "cpuUsage": 65,
        "memoryUsage": 78,
        "diskUsage": 45
      }
    },
    "alerts": {
      "total": 12,
      "active": 3,
      "critical": 1,
      "warning": 2,
      "acknowledged": 5,
      "escalated": 0
    }
  }
}
```

### 实时监控接口

#### GET /api/monitoring/realtime/:category
获取实时监控数据

**参数**：
- `category`: 监控类别 (business|system|application|security|performance)

**响应示例**：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "metrics": {
      "cpu": {
        "usage": 65,
        "loadAverage": [1.2, 1.5, 1.8],
        "cores": 8
      },
      "memory": {
        "total": 16777216000,
        "used": 13107200000,
        "usage": 78
      }
    },
    "summary": "系统资源正常"
  }
}
```

### 告警管理接口

#### GET /api/monitoring/alerts
获取告警列表

**查询参数**：
- `status`: 告警状态过滤
- `level`: 告警级别过滤
- `category`: 告警类别过滤
- `limit`: 每页数量 (默认50)
- `offset`: 偏移量 (默认0)

#### POST /api/monitoring/alerts
创建自定义告警

**请求体**：
```json
{
  "title": "自定义告警标题",
  "message": "告警详细描述",
  "level": "warning",
  "category": "system",
  "metadata": {
    "customField": "value"
  },
  "tags": ["custom", "manual"]
}
```

#### PATCH /api/monitoring/alerts/:alertId/acknowledge
确认告警

#### PATCH /api/monitoring/alerts/:alertId/resolve
解决告警

#### PATCH /api/monitoring/alerts/:alertId/silence
抑制告警

## 配置指南

### 环境变量配置

```bash
# 监控系统配置
MONITORING_ENABLED=true
MONITORING_INTERVAL=30000
MONITORING_RETENTION_DAYS=30

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=email_assist
DB_USER=postgres
DB_PASSWORD=

# 邮件通知配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=alerts@yourapp.com

# Slack通知配置
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# 第三方集成配置
PROMETHEUS_PUSHGATEWAY_URL=http://localhost:9091
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your-grafana-api-key

ELASTICSEARCH_NODES=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=password

DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
```

### 数据库表结构

监控系统需要以下数据库表：

```sql
-- 监控配置表
CREATE TABLE monitoring_configs (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  data_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  default_value TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- 阈值配置表
CREATE TABLE monitoring_thresholds (
  id VARCHAR(255) PRIMARY KEY,
  metric VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  warning NUMERIC NOT NULL,
  critical NUMERIC NOT NULL,
  unit VARCHAR(20),
  comparison VARCHAR(10) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 通知配置表
CREATE TABLE monitoring_notifications (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB NOT NULL,
  rate_limit JSONB,
  retry_config JSONB,
  test_endpoint VARCHAR(500),
  health_check JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 监控规则表
CREATE TABLE monitoring_rules (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  schedule JSONB,
  cooldown JSONB,
  tags JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 告警表
CREATE TABLE alerts (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  level VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  alert_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  acknowledged_at TIMESTAMP
);

-- 安全事件表
CREATE TABLE security_auth_events (
  id VARCHAR(255) PRIMARY KEY,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  risk_score INTEGER
);

CREATE TABLE security_access_events (
  id VARCHAR(255) PRIMARY KEY,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  risk_score INTEGER
);

CREATE TABLE security_operation_events (
  id VARCHAR(255) PRIMARY KEY,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  risk_score INTEGER
);

CREATE TABLE security_anomalies (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  description TEXT NOT NULL,
  indicators JSONB,
  related_events JSONB,
  details JSONB,
  investigated BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX idx_security_events_timestamp ON security_auth_events(timestamp);
CREATE INDEX idx_security_events_user ON security_auth_events(user_id);
CREATE INDEX idx_security_anomalies_severity ON security_anomalies(severity);
```

### 监控服务初始化

在应用启动时初始化监控服务：

```typescript
// src/app.ts
import MonitoringController from '@/controllers/MonitoringController';
import redis from '@/config/redis';

const monitoringController = new MonitoringController(redis);

// 应用启动时初始化监控服务
async function initializeMonitoring() {
  try {
    await monitoringController.initializeMonitoringServices();
    logger.info('Monitoring services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize monitoring services', error);
    process.exit(1);
  }
}

// 优雅关闭时停止监控服务
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down monitoring services...');
  monitoringController.stopMonitoringServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down monitoring services...');
  monitoringController.stopMonitoringServices();
  process.exit(0);
});
```

### 第三方集成配置

#### Prometheus + Grafana

```typescript
// 配置Prometheus集成
const thirdPartyIntegration = new ThirdPartyIntegration(redis);

await thirdPartyIntegration.initialize({
  prometheus: {
    enabled: true,
    pushgatewayUrl: process.env.PROMETHEUS_PUSHGATEWAY_URL!,
    jobName: 'email-assist',
    instance: 'email-assist-backend',
    labels: {
      service: 'email-assist',
      environment: process.env.NODE_ENV || 'development'
    }
  },
  grafana: {
    enabled: true,
    url: process.env.GRAFANA_URL!,
    apiKey: process.env.GRAFANA_API_KEY!
  }
});

// 创建默认监控仪表板
await thirdPartyIntegration.createDefaultMonitoringDashboard();
```

#### ELK Stack集成

```typescript
await thirdPartyIntegration.initialize({
  elasticsearch: {
    enabled: true,
    nodes: [process.env.ELASTICSEARCH_NODES!],
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indices: {
      metrics: 'email-assist-metrics',
      logs: 'email-assist-logs',
      alerts: 'email-assist-alerts'
    }
  }
});
```

## 最佳实践

### 1. 监控指标设计原则

**选择合适的指标**：
- **业务指标**：直接反映业务价值的指标（如邮件处理成功率）
- **系统指标**：反映系统健康状况的指标（如CPU、内存使用率）
- **用户体验指标**：反映用户感受的指标（如响应时间、错误率）

**指标命名规范**：
```
<服务名>_<指标类型>_<单位>
例如：
- email_assist_emails_processed_total
- email_assist_response_time_seconds
- email_assist_error_rate_percent
```

### 2. 告警策略设计

**告警级别定义**：
- **Info**: 信息性告警，不需要立即处理
- **Warning**: 警告级别，需要关注但不紧急
- **Critical**: 严重级别，需要立即处理

**告警阈值设置**：
```typescript
const thresholds = {
  // 系统资源
  cpu_usage: { warning: 70, critical: 90 },
  memory_usage: { warning: 80, critical: 95 },
  disk_usage: { warning: 80, critical: 95 },
  
  // 应用性能
  response_time: { warning: 2000, critical: 5000 }, // ms
  error_rate: { warning: 5, critical: 10 }, // %
  
  // 业务指标
  email_error_rate: { warning: 2, critical: 5 }, // %
  ai_accuracy: { warning: 80, critical: 70 }, // %
};
```

### 3. 数据保留策略

**分层存储策略**：
```typescript
const retentionPolicy = {
  realtime: {
    duration: '1 day',
    resolution: '1 minute'
  },
  shortTerm: {
    duration: '7 days', 
    resolution: '5 minutes'
  },
  mediumTerm: {
    duration: '30 days',
    resolution: '1 hour'
  },
  longTerm: {
    duration: '1 year',
    resolution: '1 day'
  }
};
```

### 4. 性能优化建议

**监控数据采集优化**：
- 使用异步处理避免阻塞主线程
- 实现数据采集的批量处理
- 合理设置采集频率，避免过度监控

**内存和存储优化**：
- 定期清理过期的监控数据
- 使用数据压缩减少存储空间
- 实现指标数据的聚合和降采样

**网络优化**：
- 批量发送监控数据到外部系统
- 使用连接池管理外部API连接
- 实现重试机制处理网络故障

### 5. 安全考虑

**敏感数据保护**：
- 不在监控日志中记录敏感信息（密码、令牌等）
- 对监控数据进行适当的脱敏处理
- 实施监控数据的访问控制

**监控系统安全**：
- 为监控API实施身份验证和授权
- 使用HTTPS保护监控数据传输
- 定期更新监控系统的依赖包

### 6. 故障排除指南

**常见问题及解决方案**：

1. **监控数据丢失**
   - 检查Redis连接状态
   - 确认数据库连接和表结构
   - 查看监控服务日志错误

2. **告警不及时**
   - 检查告警规则配置
   - 确认通知渠道配置正确
   - 查看告警处理队列状态

3. **性能问题**
   - 优化监控数据采集频率
   - 检查数据库查询性能
   - 清理过期的监控数据

4. **第三方集成失败**
   - 验证API密钥和访问权限
   - 检查网络连接和防火墙设置
   - 查看第三方服务状态页面

### 7. 监控仪表板设计

**仪表板层次结构**：
```
总体概览 (Executive Dashboard)
    ├── 业务指标概览
    ├── 系统健康状态
    └── 关键告警摘要

运维监控 (Operations Dashboard)  
    ├── 系统资源详情
    ├── 应用性能详情
    └── 错误和异常详情

业务分析 (Business Dashboard)
    ├── 用户活跃度分析
    ├── 邮件处理效率
    └── AI分析效果
```

**图表选择建议**：
- 时间序列数据：使用折线图
- 百分比数据：使用饼图或环形图
- 分类数据：使用柱状图
- 状态指示：使用仪表盘或状态灯

## 维护和运维

### 日常维护任务

1. **每日检查**：
   - 查看告警摘要和处理情况
   - 检查监控系统健康状态
   - 验证关键监控指标正常

2. **每周维护**：
   - 清理过期的监控数据
   - 检查监控系统性能
   - 更新告警规则和阈值

3. **每月维护**：
   - 生成监控系统报告
   - 评估监控系统效果
   - 规划监控系统改进

### 容量规划

**存储容量估算**：
```
每日指标数据量 = 指标数量 × 采集频率 × 数据大小
例如：1000个指标 × 120次/小时 × 100字节 ≈ 288MB/天
```

**性能容量规划**：
- 监控请求QPS规划
- 数据库连接池大小
- Redis内存容量规划
- 告警通知频率限制

### 监控系统监控

**元监控指标**：
- 监控系统自身的可用性
- 数据采集成功率
- 告警发送成功率
- 监控系统响应时间

这个全面的监控系统为 Email Assist 提供了企业级的可观测性，确保系统的稳定性、性能和安全性。通过合理的配置和使用，可以及时发现并解决系统问题，提升整体服务质量。