# Email Assist Backend - 开发指南

## 开发环境配置详情

### 1. 本地开发环境设置

#### 系统要求
- macOS 12+ / Ubuntu 20+ / Windows 10+
- Node.js 18.0+
- PostgreSQL 12+
- Redis 6+
- Git 2.30+

#### 开发工具推荐
- **IDE**: VS Code + 以下插件
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - GitLens
  - Thunder Client (API测试)
- **数据库工具**: TablePlus / pgAdmin
- **API测试**: Postman / Insomnia
- **Git工具**: SourceTree / GitKraken

### 2. 详细安装步骤

#### macOS开发环境

```bash
# 1. 安装Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装Node.js
brew install node@18
brew link node@18

# 3. 安装PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# 4. 安装Redis
brew install redis
brew services start redis

# 5. 验证安装
node --version    # 应显示 v18.x.x
psql --version    # 应显示 PostgreSQL 14.x
redis-cli ping    # 应返回 PONG
```

#### Ubuntu/Linux开发环境

```bash
# 1. 更新包管理器
sudo apt update && sudo apt upgrade -y

# 2. 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 4. 安装Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 5. 验证安装
node --version
psql --version
redis-cli ping
```

### 3. 数据库初始化

#### PostgreSQL配置

```bash
# 1. 连接到PostgreSQL
sudo -u postgres psql

# 2. 创建数据库和用户
CREATE DATABASE email_assist_dev;
CREATE USER email_assist WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE email_assist_dev TO email_assist;

# 3. 退出psql
\q

# 4. 测试连接
psql -h localhost -U email_assist -d email_assist_dev
```

#### Redis配置

```bash
# 1. 测试Redis连接
redis-cli

# 2. 在Redis CLI中测试
ping
set test "hello"
get test
exit
```

### 4. 项目配置

#### 环境变量配置

```bash
# 1. 复制环境配置
cp .env.example .env

# 2. 编辑配置文件
nano .env
```

**关键配置项说明：**

```env
# 应用配置
NODE_ENV=development           # 开发环境
PORT=3001                     # API服务端口
API_VERSION=v1                # API版本

# 数据库配置
DATABASE_URL=postgresql://email_assist:your_secure_password@localhost:5432/email_assist_dev

# Redis配置
REDIS_URL=redis://localhost:6379

# JWT密钥（开发环境示例，生产环境必须更换）
JWT_SECRET=dev_jwt_secret_key_minimum_32_characters_long_12345
REFRESH_TOKEN_SECRET=dev_refresh_token_secret_minimum_32_characters_long_12345

# Microsoft OAuth2配置（需要在Azure Portal中获取）
MICROSOFT_CLIENT_ID=your_microsoft_app_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_app_client_secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/v1/auth/microsoft/callback

# CORS配置
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# 日志配置
LOG_LEVEL=debug               # 开发环境使用debug级别
```

### 5. Microsoft Azure应用配置

#### 创建Azure应用

1. **访问Azure Portal**
   - 打开 https://portal.azure.com
   - 登录你的Microsoft账户

2. **注册应用程序**
   ```
   Azure Active Directory → App registrations → New registration
   
   应用名称: Email Assist Development
   支持的账户类型: 任何组织目录(任何 Azure AD 目录 - 多租户)中的账户和个人 Microsoft 账户
   重定向URI: Web - http://localhost:3001/api/v1/auth/microsoft/callback
   ```

3. **配置API权限**
   ```
   API permissions → Add a permission → Microsoft Graph → Delegated permissions
   
   需要的权限:
   - openid
   - profile
   - email
   - offline_access
   - Mail.Read
   - Mail.Send
   - User.Read
   ```

4. **创建客户端密码**
   ```
   Certificates & secrets → New client secret
   描述: Email Assist Development Secret
   过期时间: 24个月
   
   复制生成的密码值到 .env 文件的 MICROSOFT_CLIENT_SECRET
   ```

5. **获取应用程序ID**
   ```
   复制 Application (client) ID 到 .env 文件的 MICROSOFT_CLIENT_ID
   ```

### 6. 开发流程

#### 启动开发服务器

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（自动重启）
npm run dev

# 3. 查看日志输出
tail -f logs/$(date +%Y-%m-%d).log
```

#### 常用开发命令

```bash
# 代码构建
npm run build

# 生产环境启动
npm start

# 代码检查
npm run lint

# 运行测试
npm run test

# 清理构建文件
npm run clean

# 监听模式构建
npm run build:watch
```

### 7. API测试

#### 使用curl测试

```bash
# 1. 健康检查
curl http://localhost:3001/health

# 2. 获取API信息
curl http://localhost:3001/api/v1/

# 3. 获取Microsoft认证URL
curl http://localhost:3001/api/v1/auth/microsoft

# 4. 测试认证状态（需要token）
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/v1/auth/status
```

#### Postman集合配置

创建Postman集合包含以下请求：

```json
{
  "info": {
    "name": "Email Assist API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001/api/v1"
    },
    {
      "key": "accessToken",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Get Microsoft Auth URL",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/auth/microsoft"
          }
        },
        {
          "name": "Microsoft Callback",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/microsoft",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"code\": \"authorization_code_here\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            }
          }
        }
      ]
    }
  ]
}
```

### 8. 调试技巧

#### VS Code调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register", "-r", "tsconfig-paths/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "sourceMaps": true,
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

#### 日志调试

```typescript
// 在代码中添加调试日志
import logger from '@/utils/logger';

// 不同级别的日志
logger.debug('详细调试信息', { userId, data });
logger.info('一般信息', { action: 'user_login' });
logger.warn('警告信息', { slowQuery: true });
logger.error('错误信息', { error: error.message });
```

#### 数据库调试

```bash
# 1. 连接到开发数据库
psql -h localhost -U email_assist -d email_assist_dev

# 2. 查看表结构
\dt
\d users
\d email_accounts

# 3. 查看数据
SELECT * FROM users LIMIT 5;
SELECT COUNT(*) FROM users;

# 4. 查看活动连接
SELECT pid, usename, application_name, state 
FROM pg_stat_activity 
WHERE datname = 'email_assist_dev';
```

#### Redis调试

```bash
# 1. 连接到Redis
redis-cli

# 2. 查看所有键
KEYS *

# 3. 查看特定键
GET session:user_id_here

# 4. 查看键类型
TYPE session:user_id_here

# 5. 查看内存使用
INFO memory
```

### 9. 性能监控

#### 应用性能监控

```typescript
// 在代码中添加性能监控
const start = Date.now();
// ... 执行操作
const duration = Date.now() - start;
logger.info('Operation completed', { operation: 'email_fetch', duration });
```

#### 数据库性能监控

```sql
-- 查看慢查询
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 查看表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 10. 常见问题解决

#### 端口占用问题

```bash
# 查找占用端口的进程
lsof -i :3001

# 终止进程
kill -9 PID

# 或者更改端口
export PORT=3002
npm run dev
```

#### 数据库连接问题

```bash
# 检查PostgreSQL状态
brew services list | grep postgresql
# 或
sudo systemctl status postgresql

# 重启PostgreSQL
brew services restart postgresql
# 或
sudo systemctl restart postgresql

# 检查连接
pg_isready -h localhost -p 5432
```

#### Redis连接问题

```bash
# 检查Redis状态
brew services list | grep redis
# 或
sudo systemctl status redis

# 重启Redis
brew services restart redis
# 或
sudo systemctl restart redis

# 测试连接
redis-cli ping
```

#### TypeScript编译问题

```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 清理TypeScript缓存
rm -rf dist
npm run clean
npm run build
```

### 11. 代码提交规范

#### Git工作流

```bash
# 1. 创建功能分支
git checkout -b feature/email-search

# 2. 开发完成后提交
git add .
git commit -m "feat: add email search functionality"

# 3. 推送到远程
git push origin feature/email-search

# 4. 创建Pull Request
```

#### 提交消息规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动

示例:
feat: add email sentiment analysis
fix: resolve Microsoft token refresh issue
docs: update API documentation
refactor: optimize database queries
```

### 12. 部署前检查

#### 本地测试清单

- [ ] 所有API端点正常响应
- [ ] Microsoft OAuth流程完整
- [ ] 数据库连接稳定
- [ ] Redis缓存功能正常
- [ ] 错误处理覆盖完整
- [ ] 日志记录详细
- [ ] 性能指标达标
- [ ] 代码构建成功
- [ ] 环境变量配置正确

#### 生产部署检查

- [ ] 环境变量安全配置
- [ ] Microsoft应用生产配置
- [ ] 数据库备份策略
- [ ] 监控告警配置
- [ ] HTTPS证书配置
- [ ] 负载均衡配置
- [ ] 错误日志收集
- [ ] 性能监控配置

---

**开发指南版本**: v1.0  
**最后更新**: 2025年9月10日  
**维护团队**: Backend Development Team