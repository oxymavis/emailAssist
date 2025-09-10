# Email Assist - 后端开发任务清单

## 项目概述

Email Assist 是一款智能邮件监控分析Web应用，本文档定义了完整的后端开发任务、API设计和数据模型规范。

### 技术栈确认

```json
{
  "backend": {
    "runtime": "Node.js 18+",
    "framework": "Express.js + TypeScript",
    "database": "PostgreSQL + JSON字段",
    "cache": "Redis",
    "fileStorage": "MinIO/AWS S3",
    "authentication": "JWT + OAuth2",
    "apiFormat": "JSON (RESTful)",
    "deployment": "Vercel Functions + Supabase"
  },
  "integrations": {
    "emailAPI": "Microsoft Graph API",
    "aiService": "OpenAI API / Azure Cognitive Services",
    "projectTools": ["Asana API", "Jira API", "Trello API"],
    "monitoring": "Sentry + DataDog"
  }
}
```

## Phase 1: 基础架构和认证系统 (Week 1-2)

### 1.1 用户认证和授权

**数据模型 - Users**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "avatar": "string|null",
  "role": "admin|user|readonly",
  "microsoftTokens": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresAt": "timestamp"
  },
  "settings": {
    "language": "zh-CN|en-US",
    "theme": "light|dark|auto",
    "notifications": {
      "email": "boolean",
      "push": "boolean",
      "frequency": "immediate|hourly|daily"
    },
    "analysis": {
      "autoAnalyze": "boolean",
      "confidenceThreshold": "number"
    }
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**API接口清单**
```
POST   /api/auth/microsoft        # Microsoft OAuth认证
POST   /api/auth/refresh          # Token刷新
GET    /api/auth/profile          # 用户信息获取
PUT    /api/auth/profile          # 用户信息更新
POST   /api/auth/logout           # 用户退出
GET    /api/auth/status           # 认证状态检查
DELETE /api/auth/account          # 账户删除
```

### 1.2 邮箱连接服务

**数据模型 - EmailAccounts**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "provider": "microsoft|gmail|exchange",
  "email": "string",
  "displayName": "string",
  "isConnected": "boolean",
  "lastSyncAt": "timestamp|null",
  "syncStatus": "idle|syncing|error",
  "errorMessage": "string|null",
  "folderStructure": {
    "inbox": "string",
    "sent": "string",
    "drafts": "string",
    "custom": ["string"]
  },
  "syncSettings": {
    "autoSync": "boolean",
    "syncInterval": "number",
    "syncScope": "recent|all"
  },
  "createdAt": "timestamp"
}
```

**API接口清单**
```
POST   /api/email/connect         # 邮箱连接授权
GET    /api/email/accounts        # 已连接账户列表
PUT    /api/email/accounts/:id    # 账户设置更新
DELETE /api/email/accounts/:id    # 断开邮箱连接
POST   /api/email/sync/start      # 手动同步启动
GET    /api/email/sync/status     # 同步状态查询
```

## Phase 2: AI分析核心功能 (Week 3-4)

### 2.1 邮件数据模型

**数据模型 - EmailMessages**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "messageId": "string",
  "threadId": "string",
  "subject": "string",
  "from": {
    "name": "string",
    "email": "string"
  },
  "to": ["object"],
  "cc": ["object"],
  "receivedAt": "timestamp",
  "bodyText": "string",
  "bodyHtml": "string",
  "hasAttachments": "boolean",
  "isRead": "boolean",
  "importance": "high|normal|low",
  "categories": ["string"],
  "folderPath": "string",
  "rawData": "json",
  "createdAt": "timestamp"
}
```

**数据模型 - EmailAnalysis**
```json
{
  "id": "uuid",
  "emailId": "uuid",
  "analysisVersion": "string",
  "sentiment": {
    "label": "positive|negative|neutral",
    "confidence": "number",
    "emotions": {
      "joy": "number",
      "anger": "number",
      "fear": "number",
      "sadness": "number"
    }
  },
  "priority": {
    "level": "critical|high|medium|low",
    "confidence": "number",
    "reasons": ["string"]
  },
  "category": {
    "primary": "string",
    "secondary": "string",
    "confidence": "number"
  },
  "keywords": ["string"],
  "entities": [
    {
      "type": "person|organization|location|datetime",
      "value": "string",
      "confidence": "number"
    }
  ],
  "summary": "string",
  "suggestedActions": [
    {
      "type": "reply|forward|create_task|escalate",
      "description": "string",
      "priority": "number"
    }
  ],
  "processingTime": "number",
  "analyzedAt": "timestamp"
}
```

### 2.2 AI分析API

**API接口清单**
```
GET    /api/emails                # 邮件列表（支持分页、过滤）
GET    /api/emails/:id            # 邮件详情
POST   /api/emails/:id/analyze    # 单邮件AI分析
POST   /api/emails/batch-analyze  # 批量邮件分析
GET    /api/emails/:id/analysis   # 获取分析结果
POST   /api/emails/:id/reanalyze  # 重新分析
```

**前端Material Design卡片数据格式**
```json
{
  "emailCard": {
    "id": "uuid",
    "subject": "string",
    "sender": {
      "name": "string",
      "avatar": "string|null"
    },
    "receivedAt": "timestamp",
    "priority": {
      "level": "critical|high|medium|low",
      "color": "#D32F2F|#FF6D00|#1976D2|#4CAF50"
    },
    "sentiment": {
      "emoji": "😊|😐|😞",
      "label": "string",
      "confidence": "number"
    },
    "aiInsights": {
      "summary": "string",
      "keywords": ["string"],
      "suggestedAction": "string"
    },
    "status": {
      "isRead": "boolean",
      "isStarred": "boolean",
      "hasAttachments": "boolean"
    }
  }
}
```

## Phase 3: 智能规则和报告系统 (Week 5-6)

### 3.1 过滤规则引擎

**数据模型 - FilterRules**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string",
  "description": "string",
  "isActive": "boolean",
  "priority": "number",
  "conditions": {
    "logic": "AND|OR",
    "rules": [
      {
        "field": "from|subject|body|priority|sentiment",
        "operator": "contains|equals|startsWith|greaterThan",
        "value": "any",
        "caseSensitive": "boolean"
      }
    ]
  },
  "actions": [
    {
      "type": "tag|move|forward|createTask|notify",
      "parameters": "json"
    }
  ],
  "statistics": {
    "matchCount": "number",
    "lastMatched": "timestamp|null",
    "successRate": "number"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**数据模型 - RuleExecutionLogs**
```json
{
  "id": "uuid",
  "ruleId": "uuid",
  "emailId": "uuid",
  "executedAt": "timestamp",
  "matched": "boolean",
  "actionsExecuted": ["string"],
  "executionTime": "number",
  "errorMessage": "string|null"
}
```

**API接口清单**
```
GET    /api/rules                 # 规则列表
POST   /api/rules                 # 创建规则
GET    /api/rules/:id             # 规则详情
PUT    /api/rules/:id             # 更新规则
DELETE /api/rules/:id             # 删除规则
POST   /api/rules/:id/toggle      # 启用/禁用规则
POST   /api/rules/test            # 测试规则
POST   /api/rules/batch-apply     # 批量应用规则
GET    /api/rules/:id/logs        # 规则执行日志
GET    /api/rules/statistics      # 规则统计信息
```

### 3.2 报告生成服务

**数据模型 - Reports**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "title": "string",
  "type": "daily|weekly|monthly|custom",
  "template": "summary|detailed|analytics",
  "period": {
    "startDate": "date",
    "endDate": "date",
    "timezone": "string"
  },
  "filters": {
    "accounts": ["uuid"],
    "categories": ["string"],
    "priorities": ["string"]
  },
  "data": {
    "emailStats": {
      "total": "number",
      "unread": "number",
      "processed": "number"
    },
    "priorityDistribution": [
      {
        "level": "string",
        "count": "number",
        "percentage": "number"
      }
    ],
    "sentimentAnalysis": {
      "positive": "number",
      "negative": "number",
      "neutral": "number"
    },
    "topKeywords": ["string"],
    "responseTime": {
      "average": "number",
      "median": "number"
    }
  },
  "status": "generating|completed|failed",
  "fileUrl": "string|null",
  "format": "pdf|excel|json",
  "schedule": {
    "enabled": "boolean",
    "frequency": "daily|weekly|monthly",
    "time": "string",
    "recipients": ["string"]
  },
  "generatedAt": "timestamp",
  "createdAt": "timestamp"
}
```

**API接口清单**
```
GET    /api/reports               # 报告列表
POST   /api/reports/generate      # 生成报告
GET    /api/reports/:id           # 报告详情
DELETE /api/reports/:id           # 删除报告
GET    /api/reports/:id/download  # 下载报告
POST   /api/reports/schedule      # 定时报告配置
GET    /api/reports/templates     # 报告模板列表
POST   /api/reports/preview       # 报告预览
```

## Phase 4: 工作流集成和实时通信 (Week 7-8)

### 4.1 工作流集成

**数据模型 - Integrations**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "asana|jira|trello",
  "name": "string",
  "isConnected": "boolean",
  "credentials": {
    "apiKey": "string|null",
    "accessToken": "string|null",
    "refreshToken": "string|null",
    "expiresAt": "timestamp|null"
  },
  "configuration": {
    "defaultProject": "string|null",
    "defaultAssignee": "string|null",
    "taskTemplate": "string"
  },
  "lastSyncAt": "timestamp|null",
  "createdAt": "timestamp"
}
```

**数据模型 - WorkflowTasks**
```json
{
  "id": "uuid",
  "emailId": "uuid",
  "integrationId": "uuid",
  "externalTaskId": "string",
  "title": "string",
  "description": "string",
  "priority": "string",
  "assignee": "string|null",
  "status": "created|in_progress|completed|failed",
  "externalUrl": "string|null",
  "createdAt": "timestamp",
  "completedAt": "timestamp|null"
}
```

**API接口清单**
```
GET    /api/integrations          # 集成列表
POST   /api/integrations/connect  # 连接第三方工具
DELETE /api/integrations/:id      # 断开集成
POST   /api/workflows/create-task # 创建任务
GET    /api/workflows/tasks       # 任务列表
PUT    /api/workflows/tasks/:id   # 更新任务状态
```

### 4.2 实时通知系统

**WebSocket事件规范**
```json
{
  "events": {
    "email_received": {
      "data": {
        "emailId": "uuid",
        "subject": "string",
        "priority": "string",
        "sender": "object"
      }
    },
    "analysis_completed": {
      "data": {
        "emailId": "uuid",
        "analysisId": "uuid",
        "priority": "string",
        "sentiment": "string"
      }
    },
    "rule_matched": {
      "data": {
        "ruleId": "uuid",
        "emailId": "uuid",
        "actions": ["string"]
      }
    },
    "sync_status": {
      "data": {
        "accountId": "uuid",
        "status": "string",
        "progress": "number"
      }
    }
  }
}
```

**API接口清单**
```
POST   /api/notifications/subscribe    # 订阅通知
GET    /api/notifications              # 通知列表
PUT    /api/notifications/:id/read     # 标记已读
DELETE /api/notifications/:id          # 删除通知
POST   /api/notifications/settings     # 通知设置
GET    /api/notifications/unread-count # 未读数量
```

## Phase 5: 性能优化和部署 (Week 9-10)

### 5.1 API响应格式标准

**成功响应格式**
```json
{
  "success": true,
  "data": "any",
  "meta": {
    "timestamp": "string",
    "version": "string",
    "requestId": "string"
  },
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "hasNext": "boolean"
  }
}
```

**错误响应格式**
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": "any|null"
  },
  "meta": {
    "timestamp": "string",
    "requestId": "string"
  }
}
```

### 5.2 Material Design 组件数据适配

**统计卡片数据格式**
```json
{
  "statsCard": {
    "title": "string",
    "value": "number|string",
    "unit": "string|null",
    "trend": {
      "direction": "up|down|stable",
      "percentage": "number",
      "color": "success|warning|error"
    },
    "icon": "string",
    "color": "primary|secondary|success|warning|error"
  }
}
```

**图表数据格式**
```json
{
  "lineChart": {
    "labels": ["string"],
    "datasets": [
      {
        "label": "string",
        "data": ["number"],
        "borderColor": "string",
        "backgroundColor": "string"
      }
    ]
  },
  "pieChart": {
    "labels": ["string"],
    "data": ["number"],
    "backgroundColor": ["string"],
    "total": "number"
  }
}
```

### 5.3 性能优化配置

**缓存策略**
```json
{
  "redis": {
    "userSessions": "24h",
    "emailData": "1h",
    "analysisResults": "7d",
    "apiResponses": "15m"
  },
  "postgresql": {
    "indexes": [
      "emails(userId, receivedAt)",
      "analysis(emailId)",
      "rules(userId, isActive)",
      "reports(userId, createdAt)"
    ]
  }
}
```

## 开发优先级说明

### P0 必须实现 (Week 1-6)
- ✅ 用户认证和授权系统
- ✅ Outlook邮箱连接和同步
- ✅ AI邮件内容分析
- ✅ 智能过滤规则引擎
- ✅ 自动报告生成

### P1 重要功能 (Week 7-8)
- 🔄 工作流集成（Asana/Jira/Trello）
- 🔄 实时通知推送系统
- 🔄 团队协作和权限管理

### P2 增强功能 (后续版本)
- 📋 多邮箱提供商支持
- 📋 高级数据分析和预测
- 📋 API开放平台

## 质量保证和测试

### 单元测试覆盖率目标
- **API端点**: 90%+
- **业务逻辑**: 95%+
- **数据模型**: 100%
- **集成服务**: 80%+

### 性能指标要求
- **API响应时间**: <500ms (95th percentile)
- **AI分析时间**: <3秒
- **并发用户支持**: 1000+
- **系统可用性**: 99.5%

### 安全要求
- **数据传输**: HTTPS + TLS 1.3
- **数据存储**: AES-256加密
- **API认证**: JWT + OAuth2
- **数据脱敏**: PII数据保护

## 部署和运维

### 环境配置
```json
{
  "development": {
    "database": "PostgreSQL local",
    "cache": "Redis local",
    "ai": "OpenAI API key"
  },
  "staging": {
    "database": "Supabase staging",
    "cache": "Redis Cloud",
    "deployment": "Vercel preview"
  },
  "production": {
    "database": "Supabase production",
    "cache": "Redis Cloud",
    "deployment": "Vercel production",
    "monitoring": "Sentry + DataDog"
  }
}
```

### 监控指标
- **业务指标**: 活跃用户、邮件处理量、AI分析准确率
- **技术指标**: 响应时间、错误率、系统资源使用率
- **安全指标**: 异常访问、认证失败、数据泄露风险

---

**文档版本**: v1.0  
**创建日期**: 2025年9月10日  
**负责团队**: 后端开发团队  
**审核状态**: 待实施