# Email Assist 配置指南

## 📋 必需配置项

在运行系统之前，您需要配置以下服务的API密钥和认证信息：

## 1. 📧 Microsoft Outlook 配置

### 步骤 1: 注册 Azure 应用
1. 访问 [Azure Portal](https://portal.azure.com/)
2. 进入 "Azure Active Directory" → "应用注册"
3. 点击 "新注册"
4. 填写信息：
   - 名称：`Email Assist`
   - 支持的账户类型：选择 "任何组织目录中的账户和个人 Microsoft 账户"
   - 重定向 URI：`http://localhost:3001/api/auth/microsoft/callback`

### 步骤 2: 获取凭据
1. 在应用概述页面获取：
   - **应用程序(客户端) ID** → `YOUR_MICROSOFT_CLIENT_ID`
   - **目录(租户) ID** → `YOUR_MICROSOFT_TENANT_ID`

2. 在 "证书和密码" 中：
   - 点击 "新客户端密码"
   - 添加描述，选择过期时间
   - 复制生成的密码 → `YOUR_MICROSOFT_CLIENT_SECRET`

### 步骤 3: 配置权限
1. 进入 "API 权限"
2. 点击 "添加权限" → "Microsoft Graph"
3. 添加以下权限：
   - `Mail.Read` - 读取用户邮件
   - `Mail.ReadWrite` - 读写用户邮件
   - `Mail.Send` - 发送邮件
   - `User.Read` - 读取用户基本信息
   - `offline_access` - 维持访问权限

## 2. 🤖 OpenAI API 配置

### 获取 API 密钥
1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 登录或注册账户
3. 进入 [API Keys](https://platform.openai.com/api-keys)
4. 点击 "Create new secret key"
5. 复制密钥 → `OPENAI_API_KEY`

### 注意事项
- 需要付费账户才能使用 GPT-4
- 建议设置使用限额避免超支
- API 密钥不要泄露或提交到代码库

## 3. 📋 Trello 集成配置

### 获取 API 凭据
1. 访问 [Trello Power-Ups](https://trello.com/power-ups/admin)
2. 点击 "New" 创建新的 Power-Up
3. 填写基本信息
4. 获取凭据：
   - **API Key** → `6f058eeac873f1b902f1f2f482554397`
   - 访问 https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=EmailAssist&key=YOUR_API_KEY
   - 授权后获取 **Token** → `147e4248b26627c8e64feeedf7413c8e4b793d5f7cd7ac25df1c9209349ca194`

### 获取 Board ID
1. 打开您要使用的 Trello 看板
2. 在 URL 中找到看板 ID，例如：
   `https://trello.com/b/hSqfthYt/test`
3. 复制 BOARD_ID → `hSqfthYt`

## 4. 🎯 Jira 集成配置

### 获取 API Token
1. 访问 [Atlassian Account](https://id.atlassian.com/manage-profile/security/api-tokens)
2. 点击 "Create API token"
3. 输入标签名称（如 "Email Assist"）
4. 复制生成的 token → `JIRA_API_TOKEN`

### 配置信息
- **Host**: 您的 Jira 域名，例如 `your-domain.atlassian.net`
- **Email**: 您的 Atlassian 账户邮箱
- **Project Key**: 目标项目的键值（如 "PROJ"）

## 5. 🗄️ PostgreSQL 数据库配置

### 本地开发
```bash
# 安装 PostgreSQL
brew install postgresql  # macOS
sudo apt-get install postgresql  # Ubuntu

# 启动服务
brew services start postgresql  # macOS
sudo service postgresql start  # Ubuntu

# 创建数据库
createdb email_assist

# 设置密码（可选）
psql -d email_assist
ALTER USER postgres PASSWORD 'your_password';
```

### 云数据库（推荐生产环境）
- [Supabase](https://supabase.com/) - 免费套餐可用
- [Neon](https://neon.tech/) - PostgreSQL 云服务
- [Railway](https://railway.app/) - 一键部署

## 6. 📝 完整 .env 配置文件

在 `/backend` 目录创建 `.env` 文件：

```env
# ====== 基础配置 ======
NODE_ENV=development
PORT=3001

# ====== 数据库配置 ======
DB_HOST=localhost
DB_PORT=5432
DB_NAME=email_assist
DB_USER=postgres
DB_PASSWORD=your_password

# ====== Microsoft OAuth ======
MICROSOFT_CLIENT_ID=获取自Azure应用注册
MICROSOFT_CLIENT_SECRET=获取自Azure应用密码
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/auth/microsoft/callback

# ====== OpenAI ======
OPENAI_API_KEY=获取自OpenAI平台
OPENAI_MODEL=gpt-4  # 或 gpt-3.5-turbo

# ====== Trello (可选) ======
TRELLO_API_KEY=获取自Trello开发者
TRELLO_API_TOKEN=获取自Trello授权
TRELLO_BOARD_ID=您的看板ID

# ====== Jira (可选) ======
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=获取自Atlassian
JIRA_PROJECT_KEY=PROJ

# ====== JWT ======
JWT_SECRET=生成32位以上随机字符串
REFRESH_TOKEN_SECRET=生成另一个32位以上随机字符串

# ====== Redis (可选，用于缓存) ======
REDIS_URL=redis://localhost:6379

# ====== CORS ======
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

## 7. 🚀 快速启动步骤

### 1. 初始化数据库
```bash
cd backend
npm run db:init  # 运行数据库初始化脚本
```

### 2. 安装依赖
```bash
# 后端
cd backend
npm install

# 前端
cd ..
npm install
```

### 3. 启动服务
```bash
# 终端 1 - 启动后端
cd backend
npm run dev

# 终端 2 - 启动前端
npm run dev
```

### 4. 访问应用
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001/api
- API 文档：http://localhost:3001/api-docs

## 8. 🔐 安全建议

### 生产环境注意事项
1. **不要提交 .env 文件到 Git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **使用环境变量管理服务**
   - Vercel：Environment Variables
   - Heroku：Config Vars
   - AWS：Secrets Manager

3. **定期轮换密钥**
   - 每 3-6 个月更新 API 密钥
   - 使用密钥管理系统

4. **限制 API 权限**
   - 只授予必要的最小权限
   - 设置 IP 白名单（如果支持）

## 9. 🧪 测试配置

### 测试 Microsoft 连接
1. 访问 http://localhost:3000
2. 点击 "使用 Microsoft 登录"
3. 授权应用访问邮箱
4. 检查是否成功获取邮件列表

### 测试 OpenAI 集成
1. 选择一封邮件
2. 点击 "AI 分析"
3. 查看分析结果

### 测试 Trello/Jira 集成
1. 进入设置页面
2. 配置集成信息
3. 选择邮件创建任务

## 10. ❓ 常见问题

### Q: Microsoft 登录失败
A: 检查：
- 重定向 URI 是否正确配置
- 客户端密钥是否过期
- 权限是否正确授予

### Q: OpenAI API 报错
A: 检查：
- API 密钥是否有效
- 账户是否有余额
- 模型名称是否正确

### Q: 数据库连接失败
A: 检查：
- PostgreSQL 服务是否运行
- 数据库名称和密码是否正确
- 端口是否被占用

## 11. 📚 相关文档

- [Microsoft Graph API 文档](https://docs.microsoft.com/graph/)
- [OpenAI API 文档](https://platform.openai.com/docs/)
- [Trello API 文档](https://developer.atlassian.com/cloud/trello/)
- [Jira API 文档](https://developer.atlassian.com/cloud/jira/)

## 12. 🆘 获取帮助

如果遇到配置问题：
1. 检查 `/backend/logs/` 目录的错误日志
2. 查看浏览器控制台错误信息
3. 提交 Issue 到项目仓库

---

⚠️ **重要提醒**：在开始使用前，请确保已经配置了至少 Microsoft OAuth 和 OpenAI API，这是系统运行的最基本要求。Trello 和 Jira 集成是可选功能，可以稍后配置。