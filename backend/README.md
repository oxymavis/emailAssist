# Email Assist Backend API

一个智能邮件监控分析系统的后端API，基于Node.js + TypeScript + Express.js构建，集成Microsoft Graph API实现邮件数据访问和AI分析功能。

## 项目概述

Email Assist 是一款企业级邮件智能分析工具，通过Microsoft OAuth2安全认证，连接用户的Outlook邮箱，提供智能邮件分析、优先级识别、情感分析等功能。

### 核心功能

- ✅ **用户认证**：Microsoft OAuth2 + JWT双重认证
- ✅ **邮箱连接**：支持Microsoft Outlook/Exchange邮箱
- ✅ **邮件操作**：读取、搜索、标记邮件状态
- 🔄 **AI分析**：智能邮件内容分析（待实现）
- 🔄 **规则引擎**：自动邮件分类和处理（待实现）
- 🔄 **报告生成**：邮件统计和分析报告（待实现）

### 技术架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  External APIs  │
│   (React/Vue)   │◄──►│  Node.js/Express│◄──►│ Microsoft Graph │
│                 │    │   TypeScript    │    │     OpenAI      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Data Layer    │
                    │ PostgreSQL+Redis│
                    └─────────────────┘
```

## 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Microsoft Azure应用注册

### 安装依赖

```bash
cd backend
npm install
```

### 环境配置

1. 复制环境配置模板：
```bash
cp .env.example .env
```

2. 配置Microsoft Azure应用：
   - 访问 [Azure Portal](https://portal.azure.com)
   - 注册新的应用程序
   - 配置重定向URI：`http://localhost:3001/api/v1/auth/microsoft/callback`
   - 获取Client ID和Client Secret

3. 编辑 `.env` 文件：
```env
# Microsoft OAuth2配置
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# JWT密钥（生产环境请使用强密钥）
JWT_SECRET=your_super_secret_jwt_key_32_chars_minimum
REFRESH_TOKEN_SECRET=your_refresh_token_secret_32_chars_minimum

# 数据库配置
DATABASE_URL=postgresql://postgres:password@localhost:5432/email_assist_dev

# Redis配置
REDIS_URL=redis://localhost:6379
```

### 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产构建
npm run build
npm start
```

服务启动后访问：
- API根路径：http://localhost:3001/api/v1/
- 健康检查：http://localhost:3001/health

## API文档

### 认证接口

#### 获取Microsoft认证URL
```http
GET /api/v1/auth/microsoft
```

#### Microsoft OAuth回调
```http
POST /api/v1/auth/microsoft
Content-Type: application/json

{
  "code": "authorization_code_from_microsoft"
}
```

#### 刷新Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### 获取用户信息
```http
GET /api/v1/auth/profile
Authorization: Bearer your_access_token
```

#### 更新用户信息
```http
PUT /api/v1/auth/profile
Authorization: Bearer your_access_token
Content-Type: application/json

{
  "name": "新用户名",
  "settings": {
    "language": "zh-CN",
    "theme": "dark"
  }
}
```

### 邮件接口

#### 获取邮件列表
```http
GET /api/v1/email/messages?top=50&skip=0&folder=inbox
Authorization: Bearer your_access_token
```

#### 获取特定邮件
```http
GET /api/v1/email/messages/{messageId}
Authorization: Bearer your_access_token
```

#### 搜索邮件
```http
GET /api/v1/email/search?q=search_query&top=50
Authorization: Bearer your_access_token
```

#### 标记邮件已读/未读
```http
PATCH /api/v1/email/messages/{messageId}/read
Authorization: Bearer your_access_token
Content-Type: application/json

{
  "isRead": true
}
```

#### 获取邮件统计
```http
GET /api/v1/email/stats
Authorization: Bearer your_access_token
```

### 响应格式

所有API响应都使用统一格式：

**成功响应：**
```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "meta": {
    "timestamp": "2025-09-10T10:30:00Z",
    "version": "v1",
    "requestId": "uuid"
  },
  "pagination": {  // 分页接口才有
    "page": 1,
    "limit": 50,
    "total": 100,
    "hasNext": true
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细信息（仅开发环境）"
  },
  "meta": {
    "timestamp": "2025-09-10T10:30:00Z",
    "requestId": "uuid"
  }
}
```

## 项目结构

```
backend/
├── src/
│   ├── config/          # 配置文件
│   │   ├── index.ts     # 主配置
│   │   ├── database.ts  # 数据库配置
│   │   └── redis.ts     # Redis配置
│   ├── controllers/     # 控制器
│   │   ├── AuthController.ts
│   │   └── EmailController.ts
│   ├── services/        # 业务逻辑服务
│   │   ├── AuthService.ts
│   │   └── MicrosoftGraphService.ts
│   ├── models/          # 数据模型
│   │   └── User.ts
│   ├── middleware/      # 中间件
│   │   ├── auth.ts      # 认证中间件
│   │   └── index.ts     # 通用中间件
│   ├── routes/          # 路由定义
│   │   ├── auth.ts
│   │   ├── email.ts
│   │   └── index.ts
│   ├── utils/           # 工具函数
│   │   ├── logger.ts    # 日志工具
│   │   ├── errors.ts    # 错误处理
│   │   └── response.ts  # 响应格式化
│   ├── types/           # TypeScript类型定义
│   │   └── index.ts
│   ├── app.ts           # Express应用配置
│   └── server.ts        # 服务启动入口
├── logs/                # 日志文件目录
├── .env                 # 环境变量配置
├── .env.example         # 环境变量模板
├── tsconfig.json        # TypeScript配置
└── package.json         # 项目依赖
```

## 数据库设计

### 用户表 (users)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  role VARCHAR(20) DEFAULT 'user',
  password_hash VARCHAR(255),
  microsoft_tokens JSONB,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 邮箱账户表 (email_accounts)
```sql
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  is_connected BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'idle',
  error_message TEXT,
  folder_structure JSONB DEFAULT '{}',
  sync_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 安全特性

### 认证安全
- Microsoft OAuth2标准认证流程
- JWT Token + Refresh Token双重认证
- 会话管理和自动过期
- 密码BCrypt安全加密

### API安全
- Helmet安全头设置
- CORS跨域保护
- 请求速率限制
- 输入验证和净化
- SQL注入防护

### 数据安全
- 敏感数据加密存储
- Microsoft Token安全刷新
- 请求日志和审计
- 错误信息脱敏

## 开发指南

### 开发环境设置

1. **数据库准备**
```bash
# 安装PostgreSQL
brew install postgresql
brew services start postgresql

# 创建数据库
createdb email_assist_dev
```

2. **Redis准备**
```bash
# 安装Redis
brew install redis
brew services start redis
```

3. **代码开发**
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 代码构建
npm run build
```

### 代码规范

- **TypeScript严格模式**：启用所有严格检查
- **ESLint规范**：遵循标准JavaScript代码规范
- **错误处理**：使用统一的错误处理机制
- **日志记录**：结构化日志，分级别记录
- **测试覆盖**：单元测试覆盖率>90%

### API设计原则

1. **RESTful设计**：遵循REST API设计规范
2. **版本控制**：URL路径包含版本号
3. **状态码规范**：正确使用HTTP状态码
4. **响应格式**：统一的JSON响应格式
5. **错误处理**：详细的错误码和错误信息

## 部署指南

### Docker部署（推荐）

```dockerfile
# Dockerfile示例
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### Vercel部署

```bash
# 安装Vercel CLI
npm i -g vercel

# 部署到Vercel
vercel --prod
```

### 环境变量配置

生产环境必须配置的环境变量：
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `DATABASE_URL`
- `REDIS_URL`

## 监控和运维

### 健康检查
- 数据库连接状态
- Redis连接状态
- 外部API可达性
- 系统资源使用情况

### 日志管理
- 结构化JSON日志
- 分级别日志记录
- 请求追踪和性能监控
- 错误自动告警

### 性能优化
- Redis缓存策略
- 数据库连接池
- API响应时间监控
- 内存使用优化

## 常见问题

### Q: Microsoft认证失败？
A: 检查Azure应用配置，确保重定向URI正确，Client ID和Secret有效。

### Q: 数据库连接失败？
A: 检查PostgreSQL服务状态，数据库URL格式，用户权限。

### Q: Redis连接失败？
A: 检查Redis服务状态，连接URL，网络防火墙设置。

### Q: API请求超时？
A: 检查Microsoft Graph API网络连接，Token是否过期。

## 开发路线图

### Phase 1: 基础功能 ✅
- [x] 用户认证系统
- [x] Microsoft OAuth2集成
- [x] 邮件基础操作
- [x] API接口框架

### Phase 2: AI分析功能 🔄
- [ ] OpenAI API集成
- [ ] 邮件内容分析
- [ ] 情感识别和优先级判断
- [ ] 智能分类和标签

### Phase 3: 高级功能 📋
- [ ] 自动化规则引擎
- [ ] 报告生成系统
- [ ] 工作流集成（Jira/Asana）
- [ ] 实时通知推送

### Phase 4: 企业功能 📋
- [ ] 多租户架构
- [ ] 团队协作功能
- [ ] 高级权限管理
- [ ] 数据分析dashboard

## 贡献指南

1. Fork项目仓库
2. 创建功能分支
3. 提交代码更改
4. 编写测试用例
5. 发起Pull Request

## 许可证

MIT License - 详见LICENSE文件

## 联系方式

- 项目文档：[链接]
- 问题反馈：[GitHub Issues]
- 技术支持：[邮箱]

---

**Email Assist Backend API v1.0**  
构建时间：2025年9月10日  
技术栈：Node.js + TypeScript + Express.js + PostgreSQL + Redis