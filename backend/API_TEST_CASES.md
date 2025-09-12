# Email Assist 后端API测试用例文档

## 概述

本文档详细描述Email Assist系统的后端API测试用例，涵盖所有模块的功能测试、异常处理、性能测试和安全测试。

## 测试环境

- **后端技术栈**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **测试框架**: Python + pytest + requests
- **数据库**: 独立测试数据库
- **认证**: JWT + Microsoft OAuth2

## 测试分类

### 1. 用户认证和授权系统测试

#### 1.1 用户注册功能测试

**测试用例 AUTH-001: 正常用户注册**
- **接口**: `POST /api/auth/register`
- **描述**: 测试用户正常注册流程
- **请求数据**:
  ```json
  {
    "email": "test@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!",
    "name": "Test User"
  }
  ```
- **期望结果**: 
  - HTTP 201
  - 返回用户信息和JWT令牌
  - 用户数据成功保存到数据库

**测试用例 AUTH-002: 重复邮箱注册**
- **接口**: `POST /api/auth/register`
- **描述**: 测试使用已存在邮箱注册
- **请求数据**: 与AUTH-001相同的邮箱
- **期望结果**: HTTP 409，返回"邮箱已存在"错误

**测试用例 AUTH-003: 密码不匹配注册**
- **接口**: `POST /api/auth/register`
- **描述**: 测试密码和确认密码不匹配
- **请求数据**:
  ```json
  {
    "email": "test2@example.com",
    "password": "Password123!",
    "confirmPassword": "DifferentPass123!",
    "name": "Test User"
  }
  ```
- **期望结果**: HTTP 400，返回密码不匹配错误

**测试用例 AUTH-004: 弱密码注册**
- **接口**: `POST /api/auth/register`
- **描述**: 测试使用弱密码注册
- **请求数据**:
  ```json
  {
    "email": "test3@example.com",
    "password": "123",
    "confirmPassword": "123",
    "name": "Test User"
  }
  ```
- **期望结果**: HTTP 400，返回密码强度不足错误

#### 1.2 用户登录功能测试

**测试用例 AUTH-005: 正常登录**
- **接口**: `POST /api/auth/login`
- **描述**: 测试用户正常登录
- **请求数据**:
  ```json
  {
    "email": "test@example.com",
    "password": "Password123!"
  }
  ```
- **期望结果**: HTTP 200，返回JWT令牌和用户信息

**测试用例 AUTH-006: 错误密码登录**
- **接口**: `POST /api/auth/login`
- **描述**: 测试错误密码登录
- **请求数据**:
  ```json
  {
    "email": "test@example.com",
    "password": "wrongpassword"
  }
  ```
- **期望结果**: HTTP 401，返回认证失败错误

**测试用例 AUTH-007: 不存在用户登录**
- **接口**: `POST /api/auth/login`
- **描述**: 测试不存在用户登录
- **请求数据**:
  ```json
  {
    "email": "nonexistent@example.com",
    "password": "Password123!"
  }
  ```
- **期望结果**: HTTP 401，返回用户不存在错误

#### 1.3 JWT令牌管理测试

**测试用例 AUTH-008: 令牌刷新**
- **接口**: `POST /api/auth/refresh`
- **描述**: 测试JWT令牌刷新
- **请求数据**: 携带有效的刷新令牌
- **期望结果**: HTTP 200，返回新的访问令牌

**测试用例 AUTH-009: 无效令牌刷新**
- **接口**: `POST /api/auth/refresh`
- **描述**: 测试无效刷新令牌
- **请求数据**: 携带无效或过期的刷新令牌
- **期望结果**: HTTP 401，返回令牌无效错误

**测试用例 AUTH-010: 令牌验证**
- **接口**: `GET /api/auth/verify`
- **描述**: 测试JWT令牌验证
- **请求头**: `Authorization: Bearer <valid_token>`
- **期望结果**: HTTP 200，返回用户信息

#### 1.4 Microsoft OAuth2测试

**测试用例 AUTH-011: Microsoft授权URL生成**
- **接口**: `GET /api/auth/microsoft`
- **描述**: 测试Microsoft OAuth2授权URL生成
- **期望结果**: HTTP 200，返回有效的Microsoft授权URL

**测试用例 AUTH-012: Microsoft授权回调处理**
- **接口**: `POST /api/auth/microsoft/callback`
- **描述**: 测试Microsoft OAuth2回调处理
- **请求数据**: 包含有效的授权码
- **期望结果**: HTTP 200，返回JWT令牌和用户信息

### 2. 邮件管理API测试

#### 2.1 邮件CRUD操作测试

**测试用例 EMAIL-001: 获取邮件列表**
- **接口**: `GET /api/email/messages`
- **描述**: 测试获取用户邮件列表
- **请求头**: 包含有效JWT令牌
- **期望结果**: HTTP 200，返回邮件列表和分页信息

**测试用例 EMAIL-002: 分页获取邮件**
- **接口**: `GET /api/email/messages?page=2&limit=10`
- **描述**: 测试分页获取邮件
- **期望结果**: HTTP 200，返回第二页的10封邮件

**测试用例 EMAIL-003: 根据ID获取邮件详情**
- **接口**: `GET /api/email/messages/{messageId}`
- **描述**: 测试获取特定邮件详情
- **期望结果**: HTTP 200，返回完整的邮件信息

**测试用例 EMAIL-004: 获取不存在的邮件**
- **接口**: `GET /api/email/messages/nonexistent`
- **描述**: 测试获取不存在的邮件
- **期望结果**: HTTP 404，返回邮件不存在错误

#### 2.2 邮件搜索和过滤测试

**测试用例 EMAIL-005: 关键词搜索邮件**
- **接口**: `GET /api/email/messages?search=urgent`
- **描述**: 测试根据关键词搜索邮件
- **期望结果**: HTTP 200，返回包含"urgent"关键词的邮件

**测试用例 EMAIL-006: 按发件人过滤邮件**
- **接口**: `GET /api/email/messages?from=john@example.com`
- **描述**: 测试按发件人过滤邮件
- **期望结果**: HTTP 200，返回特定发件人的邮件

**测试用例 EMAIL-007: 按日期范围过滤邮件**
- **接口**: `GET /api/email/messages?startDate=2024-01-01&endDate=2024-01-31`
- **描述**: 测试按日期范围过滤邮件
- **期望结果**: HTTP 200，返回指定日期范围内的邮件

**测试用例 EMAIL-008: 多条件组合搜索**
- **接口**: `GET /api/email/messages?search=project&from=manager@company.com&startDate=2024-01-01`
- **描述**: 测试多条件组合搜索
- **期望结果**: HTTP 200，返回满足所有条件的邮件

#### 2.3 邮件标签和分类测试

**测试用例 EMAIL-009: 为邮件添加标签**
- **接口**: `POST /api/email/messages/{messageId}/labels`
- **描述**: 测试为邮件添加标签
- **请求数据**:
  ```json
  {
    "labels": ["important", "work", "urgent"]
  }
  ```
- **期望结果**: HTTP 200，邮件成功添加标签

**测试用例 EMAIL-010: 删除邮件标签**
- **接口**: `DELETE /api/email/messages/{messageId}/labels`
- **描述**: 测试删除邮件标签
- **请求数据**:
  ```json
  {
    "labels": ["urgent"]
  }
  ```
- **期望结果**: HTTP 200，指定标签成功删除

#### 2.4 邮件批量操作测试

**测试用例 EMAIL-011: 批量标记已读**
- **接口**: `POST /api/email/messages/batch/mark-read`
- **描述**: 测试批量标记邮件为已读
- **请求数据**:
  ```json
  {
    "messageIds": ["msg1", "msg2", "msg3"]
  }
  ```
- **期望结果**: HTTP 200，所有指定邮件标记为已读

**测试用例 EMAIL-012: 批量删除邮件**
- **接口**: `DELETE /api/email/messages/batch`
- **描述**: 测试批量删除邮件
- **请求数据**:
  ```json
  {
    "messageIds": ["msg1", "msg2", "msg3"]
  }
  ```
- **期望结果**: HTTP 200，所有指定邮件删除

### 3. AI分析功能API测试

#### 3.1 邮件情感分析测试

**测试用例 ANALYSIS-001: 单封邮件情感分析**
- **接口**: `POST /api/analysis/sentiment`
- **描述**: 测试单封邮件的情感分析
- **请求数据**:
  ```json
  {
    "messageId": "msg123",
    "content": "I am very happy with the service provided."
  }
  ```
- **期望结果**: HTTP 200，返回情感分析结果（positive/negative/neutral）

**测试用例 ANALYSIS-002: 批量邮件情感分析**
- **接口**: `POST /api/analysis/sentiment/batch`
- **描述**: 测试批量邮件情感分析
- **请求数据**:
  ```json
  {
    "messages": [
      {"id": "msg1", "content": "Great job on the project!"},
      {"id": "msg2", "content": "This is terrible service."}
    ]
  }
  ```
- **期望结果**: HTTP 200，返回每封邮件的情感分析结果

#### 3.2 邮件优先级评估测试

**测试用例 ANALYSIS-003: 邮件优先级评估**
- **接口**: `POST /api/analysis/priority`
- **描述**: 测试邮件优先级评估
- **请求数据**:
  ```json
  {
    "messageId": "msg123",
    "subject": "URGENT: Server down",
    "from": "ceo@company.com",
    "content": "The production server is down and needs immediate attention."
  }
  ```
- **期望结果**: HTTP 200，返回优先级评分和分类（high/medium/low）

#### 3.3 邮件内容分类测试

**测试用例 ANALYSIS-004: 邮件内容分类**
- **接口**: `POST /api/analysis/categorize`
- **描述**: 测试邮件内容自动分类
- **请求数据**:
  ```json
  {
    "messageId": "msg123",
    "subject": "Meeting scheduled for next week",
    "content": "Let's schedule a meeting to discuss the project timeline."
  }
  ```
- **期望结果**: HTTP 200，返回邮件分类（meeting/work/personal/spam等）

#### 3.4 关键词提取测试

**测试用例 ANALYSIS-005: 邮件关键词提取**
- **接口**: `POST /api/analysis/keywords`
- **描述**: 测试邮件关键词提取
- **请求数据**:
  ```json
  {
    "messageId": "msg123",
    "content": "The quarterly financial report shows significant growth in revenue and profit margins."
  }
  ```
- **期望结果**: HTTP 200，返回提取的关键词列表

### 4. 过滤规则API测试

#### 4.1 规则CRUD操作测试

**测试用例 RULES-001: 创建过滤规则**
- **接口**: `POST /api/rules`
- **描述**: 测试创建新的邮件过滤规则
- **请求数据**:
  ```json
  {
    "name": "Spam Filter",
    "description": "Filter spam emails",
    "conditions": [
      {
        "field": "subject",
        "operator": "contains",
        "value": "SPAM"
      }
    ],
    "actions": [
      {
        "type": "move_to_folder",
        "target": "spam"
      }
    ],
    "priority": 1,
    "active": true
  }
  ```
- **期望结果**: HTTP 201，返回创建的规则信息

**测试用例 RULES-002: 获取规则列表**
- **接口**: `GET /api/rules`
- **描述**: 测试获取用户的所有过滤规则
- **期望结果**: HTTP 200，返回规则列表

**测试用例 RULES-003: 更新过滤规则**
- **接口**: `PUT /api/rules/{ruleId}`
- **描述**: 测试更新现有过滤规则
- **请求数据**: 更新后的规则信息
- **期望结果**: HTTP 200，返回更新后的规则信息

**测试用例 RULES-004: 删除过滤规则**
- **接口**: `DELETE /api/rules/{ruleId}`
- **描述**: 测试删除过滤规则
- **期望结果**: HTTP 204，规则成功删除

#### 4.2 规则执行引擎测试

**测试用例 RULES-005: 规则匹配测试**
- **接口**: `POST /api/rules/test`
- **描述**: 测试规则是否匹配特定邮件
- **请求数据**:
  ```json
  {
    "ruleId": "rule123",
    "email": {
      "subject": "SPAM: Get rich quick",
      "from": "spam@example.com",
      "content": "Make money fast!"
    }
  }
  ```
- **期望结果**: HTTP 200，返回规则匹配结果

**测试用例 RULES-006: 批量应用规则**
- **接口**: `POST /api/rules/apply`
- **描述**: 测试对多封邮件应用规则
- **请求数据**:
  ```json
  {
    "messageIds": ["msg1", "msg2", "msg3"],
    "ruleId": "rule123"
  }
  ```
- **期望结果**: HTTP 200，返回规则应用结果

#### 4.3 规则性能监控测试

**测试用例 RULES-007: 规则执行性能监控**
- **接口**: `GET /api/rules/{ruleId}/performance`
- **描述**: 测试获取规则执行性能数据
- **期望结果**: HTTP 200，返回规则执行时间、匹配率等性能指标

### 5. 报告生成API测试

#### 5.1 报告模板管理测试

**测试用例 REPORTS-001: 创建报告模板**
- **接口**: `POST /api/reports/templates`
- **描述**: 测试创建新的报告模板
- **请求数据**:
  ```json
  {
    "name": "Weekly Email Summary",
    "description": "Weekly summary of email activities",
    "type": "weekly",
    "sections": [
      "email_count",
      "sentiment_analysis",
      "top_senders"
    ],
    "format": "pdf"
  }
  ```
- **期望结果**: HTTP 201，返回创建的模板信息

**测试用例 REPORTS-002: 获取报告模板列表**
- **接口**: `GET /api/reports/templates`
- **描述**: 测试获取所有报告模板
- **期望结果**: HTTP 200，返回模板列表

#### 5.2 报告生成和导出测试

**测试用例 REPORTS-003: 生成报告**
- **接口**: `POST /api/reports/generate`
- **描述**: 测试生成报告
- **请求数据**:
  ```json
  {
    "templateId": "template123",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-07"
    },
    "filters": {
      "folder": "inbox"
    }
  }
  ```
- **期望结果**: HTTP 200，返回生成的报告数据

**测试用例 REPORTS-004: 导出报告为PDF**
- **接口**: `GET /api/reports/{reportId}/export/pdf`
- **描述**: 测试将报告导出为PDF格式
- **期望结果**: HTTP 200，返回PDF文件

**测试用例 REPORTS-005: 导出报告为Excel**
- **接口**: `GET /api/reports/{reportId}/export/excel`
- **描述**: 测试将报告导出为Excel格式
- **期望结果**: HTTP 200，返回Excel文件

#### 5.3 定时报告任务测试

**测试用例 REPORTS-006: 创建定时报告任务**
- **接口**: `POST /api/reports/schedules`
- **描述**: 测试创建定时报告任务
- **请求数据**:
  ```json
  {
    "name": "Weekly Auto Report",
    "templateId": "template123",
    "schedule": "0 9 * * 1",
    "recipients": ["user@example.com"],
    "active": true
  }
  ```
- **期望结果**: HTTP 201，返回创建的定时任务信息

### 6. 监控和性能API测试

#### 6.1 系统健康检查测试

**测试用例 MONITORING-001: 基础健康检查**
- **接口**: `GET /health`
- **描述**: 测试系统基础健康检查
- **期望结果**: HTTP 200，返回系统状态信息

**测试用例 MONITORING-002: 详细健康检查**
- **接口**: `GET /api/monitoring/health/detailed`
- **描述**: 测试详细健康检查
- **期望结果**: HTTP 200，返回数据库、Redis、AI服务等详细状态

#### 6.2 性能指标监控测试

**测试用例 MONITORING-003: 获取API性能指标**
- **接口**: `GET /api/monitoring/metrics`
- **描述**: 测试获取API性能指标
- **期望结果**: HTTP 200，返回响应时间、吞吐量、错误率等指标

**测试用例 MONITORING-004: 获取数据库性能监控**
- **接口**: `GET /api/monitoring/database`
- **描述**: 测试数据库性能监控
- **期望结果**: HTTP 200，返回连接池状态、查询性能等信息

#### 6.3 缓存管理测试

**测试用例 CACHE-001: 获取缓存状态**
- **接口**: `GET /api/cache/status`
- **描述**: 测试获取Redis缓存状态
- **期望结果**: HTTP 200，返回缓存使用情况

**测试用例 CACHE-002: 清除指定缓存**
- **接口**: `DELETE /api/cache/clear`
- **描述**: 测试清除指定缓存
- **请求数据**:
  ```json
  {
    "pattern": "email:*"
  }
  ```
- **期望结果**: HTTP 200，指定缓存清除成功

### 7. 第三方服务集成测试

#### 7.1 Microsoft Graph API集成测试

**测试用例 GRAPH-001: 获取用户邮箱信息**
- **接口**: `GET /api/email/accounts/microsoft`
- **描述**: 测试通过Microsoft Graph API获取用户邮箱
- **期望结果**: HTTP 200，返回邮箱账户信息

**测试用例 GRAPH-002: 同步Microsoft邮件**
- **接口**: `POST /api/email/sync/microsoft`
- **描述**: 测试同步Microsoft邮件到本地数据库
- **期望结果**: HTTP 200，返回同步结果统计

#### 7.2 Gmail API集成测试

**测试用例 GMAIL-001: Gmail OAuth认证**
- **接口**: `POST /api/auth/gmail/callback`
- **描述**: 测试Gmail OAuth认证回调
- **期望结果**: HTTP 200，认证成功并返回令牌

**测试用例 GMAIL-002: 同步Gmail邮件**
- **接口**: `POST /api/email/sync/gmail`
- **描述**: 测试同步Gmail邮件
- **期望结果**: HTTP 200，返回同步结果

## 性能测试用例

### 1. 负载测试

**测试用例 PERF-001: API并发访问测试**
- **描述**: 测试API在高并发情况下的性能表现
- **测试方法**: 使用100个并发用户同时访问邮件列表API
- **期望结果**: 响应时间 < 2秒，成功率 > 95%

**测试用例 PERF-002: 大量数据处理测试**
- **描述**: 测试处理大量邮件数据的性能
- **测试方法**: 批量分析1000封邮件的情感
- **期望结果**: 处理时间 < 30秒，内存使用 < 1GB

### 2. 压力测试

**测试用例 STRESS-001: 极限并发测试**
- **描述**: 测试系统能承受的最大并发量
- **测试方法**: 逐步增加并发用户数直到系统响应超时
- **期望结果**: 记录最大并发数和系统降级表现

## 安全测试用例

### 1. 认证和授权测试

**测试用例 SEC-001: JWT令牌安全测试**
- **描述**: 测试JWT令牌的安全性
- **测试方法**: 尝试使用伪造、过期、格式错误的令牌访问API
- **期望结果**: 所有非法令牌访问都被拒绝

**测试用例 SEC-002: API访问权限测试**
- **描述**: 测试用户只能访问自己的数据
- **测试方法**: 用户A尝试访问用户B的邮件数据
- **期望结果**: 访问被拒绝，返回权限不足错误

### 2. 输入验证测试

**测试用例 SEC-003: SQL注入防护测试**
- **描述**: 测试系统对SQL注入攻击的防护
- **测试方法**: 在各API接口中注入恶意SQL代码
- **期望结果**: 所有SQL注入尝试都被阻止

**测试用例 SEC-004: XSS防护测试**
- **描述**: 测试跨站脚本攻击防护
- **测试方法**: 在邮件内容中注入JavaScript代码
- **期望结果**: 恶意脚本被过滤或转义

## 测试数据准备

### 1. 测试用户数据
```json
{
  "testUsers": [
    {
      "email": "test1@example.com",
      "password": "TestPass123!",
      "name": "Test User 1"
    },
    {
      "email": "test2@example.com",
      "password": "TestPass123!",
      "name": "Test User 2"
    }
  ]
}
```

### 2. 测试邮件数据
```json
{
  "testEmails": [
    {
      "subject": "Test Email 1",
      "from": "sender1@example.com",
      "content": "This is a test email for positive sentiment analysis.",
      "date": "2024-01-01T10:00:00Z"
    },
    {
      "subject": "URGENT: Server Issue",
      "from": "admin@company.com",
      "content": "The production server is experiencing issues.",
      "date": "2024-01-01T11:00:00Z"
    }
  ]
}
```

## 测试环境配置

### 1. 数据库配置
- 使用独立的测试数据库
- 每次测试前重置数据库状态
- 准备测试种子数据

### 2. 外部服务Mock
- Mock Microsoft Graph API响应
- Mock OpenAI API响应
- Mock SMTP/IMAP服务

### 3. 环境变量
```
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/email_assist_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
MICROSOFT_CLIENT_ID=test-client-id
OPENAI_API_KEY=test-openai-key
```

## 测试执行计划

### 1. 单元测试阶段
- 执行所有API功能测试
- 验证正常流程和异常处理
- 检查数据验证和错误处理

### 2. 集成测试阶段
- 测试不同模块间的集成
- 验证第三方服务集成
- 测试数据库事务完整性

### 3. 性能测试阶段
- 执行负载测试和压力测试
- 监控系统资源使用情况
- 优化性能瓶颈

### 4. 安全测试阶段
- 执行安全漏洞扫描
- 测试认证和授权机制
- 验证数据保护措施

## 测试报告要求

1. **测试覆盖率**: 目标 > 90%
2. **性能基准**: 所有API响应时间 < 2秒
3. **安全合规**: 通过所有安全测试用例
4. **文档完整**: 详细的测试执行报告和缺陷记录

## 持续集成配置

1. **自动化测试**: 每次代码提交后自动执行测试套件
2. **测试报告**: 生成详细的测试报告和覆盖率报告
3. **质量门禁**: 所有测试通过才能合并代码
4. **性能监控**: 持续监控API性能指标变化