# Email Assist 部署指南

本文档提供了 Email Assist 前端应用的完整部署指南，包括开发环境搭建、生产环境部署和持续集成配置。

## 📋 部署架构

```
┌─────────────────────────────────────────┐
│              用户访问                    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Netlify/Vercel               │
│         (前端静态文件托管)                │
└─────────────────┬───────────────────────┘
                  │ API 请求
┌─────────────────▼───────────────────────┐
│         后端 API 服务                    │
│      (Supabase/自建后端)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         外部服务集成                     │
│   Microsoft Graph | Trello | Jira      │
└─────────────────────────────────────────┘
```

## 🚀 快速部署 (推荐)

### 方式一：Netlify 部署

1. **准备工作**
```bash
# 确保项目构建正常
npm run build
```

2. **Netlify部署**
   - 访问 [Netlify](https://www.netlify.com/)
   - 连接GitHub仓库
   - 设置构建命令：`npm run build`
   - 设置发布目录：`dist`
   - 配置环境变量（见下文）

3. **环境变量配置**
```
VITE_APP_NAME=Email Assist
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_GRAPH_CLIENT_ID=your-graph-client-id
VITE_GRAPH_TENANT_ID=your-graph-tenant-id
VITE_TRELLO_APP_KEY=your-trello-key
```

### 方式二：Vercel 部署

1. **安装Vercel CLI**
```bash
npm install -g vercel
```

2. **部署到Vercel**
```bash
vercel --prod
```

3. **配置构建设置**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

## 🛠️ 详细部署步骤

### 1. 环境准备

**系统要求**
- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

**依赖安装**
```bash
# 克隆项目
git clone https://github.com/your-org/email-assist.git
cd email-assist

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
```

### 2. 环境变量配置

#### 开发环境 (.env.development)
```env
VITE_APP_NAME=Email Assist (Dev)
VITE_API_BASE_URL=http://localhost:3001/api
VITE_ENABLE_MOCK_DATA=true
VITE_ENABLE_ANALYTICS=false
```

#### 生产环境 (.env.production)
```env
VITE_APP_NAME=Email Assist
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_ENABLE_MOCK_DATA=false
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true

# Microsoft Graph
VITE_GRAPH_CLIENT_ID=your-production-client-id
VITE_GRAPH_TENANT_ID=your-production-tenant-id
VITE_GRAPH_REDIRECT_URI=https://yourdomain.com/auth/callback

# 外部服务
VITE_TRELLO_APP_KEY=your-production-trello-key
VITE_JIRA_API_URL=https://your-company.atlassian.net
```

### 3. 构建配置

**Vite生产构建优化**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false, // 生产环境关闭sourcemap
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          charts: ['recharts'],
          router: ['react-router-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

### 4. CI/CD 配置

#### GitHub Actions

创建 `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Lint
      run: npm run lint

    - name: Type check
      run: npm run type-check

    - name: Build
      run: npm run build
      env:
        VITE_APP_NAME: ${{ secrets.VITE_APP_NAME }}
        VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
        VITE_GRAPH_CLIENT_ID: ${{ secrets.VITE_GRAPH_CLIENT_ID }}
        VITE_GRAPH_TENANT_ID: ${{ secrets.VITE_GRAPH_TENANT_ID }}

    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v2.0
      with:
        publish-dir: './dist'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### 5. Docker 部署

**Dockerfile**
```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # 处理SPA路由
        location / {
            try_files $uri $uri/ /index.html;
        }

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API代理 (可选)
        location /api {
            proxy_pass http://your-api-server;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
}
```

**Docker Compose**
```yaml
version: '3.8'

services:
  email-assist-frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  # 如果有后端服务
  email-assist-api:
    image: your-api-image
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://...
    restart: unless-stopped
```

### 6. 性能优化

#### 构建优化
```bash
# 分析包大小
npm run build
npx vite-bundle-analyzer dist/stats.html
```

#### 代码分割
```typescript
// 路由级代码分割
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Analysis = React.lazy(() => import('./pages/Analysis'));

// 在App.tsx中使用Suspense包装
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/analysis" element={<Analysis />} />
  </Routes>
</Suspense>
```

#### 静态资源优化
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    }
  }
});
```

## 🔧 Microsoft Graph 集成配置

### Azure AD 应用注册

1. **注册应用**
   - 访问 [Azure Portal](https://portal.azure.com/)
   - 进入"Azure Active Directory" → "应用注册"
   - 点击"新注册"

2. **配置应用**
   - 应用名称：Email Assist
   - 受支持的账户类型：选择合适的选项
   - 重定向URI：`https://yourdomain.com/auth/callback`

3. **获取凭据**
   - 应用程序(客户端)ID → 复制到 `VITE_GRAPH_CLIENT_ID`
   - 目录(租户)ID → 复制到 `VITE_GRAPH_TENANT_ID`

4. **API权限配置**
   - 添加权限："Microsoft Graph"
   - 委派权限：
     - `Mail.Read`
     - `Mail.ReadWrite`
     - `User.Read`

### 生产环境注意事项

1. **域名验证**
   - 确保重定向URI与部署域名一致
   - 配置自定义域名的SSL证书

2. **权限申请**
   - 生产环境需要管理员同意某些权限
   - 提前申请必要的API权限

## 📊 监控和分析

### 错误监控 (可选)

集成 Sentry 进行错误监控：

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// main.tsx
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "your-sentry-dsn",
    environment: "production",
  });
}
```

### 性能监控

```typescript
// 添加性能监控
if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
  // Google Analytics 或其他分析工具
}
```

## 🔒 安全配置

### CSP (内容安全策略)

在 `index.html` 中添加：

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://apis.google.com; 
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;">
```

### 环境变量安全

- 敏感信息不要暴露到前端
- 使用服务器端代理处理API密钥
- 定期轮换API密钥

## 📝 部署检查清单

- [ ] 环境变量配置完成
- [ ] 构建成功，无错误和警告
- [ ] 所有页面路由正常工作
- [ ] API接口连接正常
- [ ] Microsoft Graph集成测试通过
- [ ] 第三方服务集成测试通过
- [ ] 响应式设计在各设备上正常显示
- [ ] 性能测试通过 (Lighthouse评分 > 90)
- [ ] 安全配置完成 (HTTPS、CSP等)
- [ ] 监控和日志配置完成
- [ ] 备份和恢复流程确认

## 🆘 故障排除

### 常见问题

1. **构建失败**
   ```bash
   # 清理缓存
   rm -rf node_modules package-lock.json
   npm install
   
   # 类型检查
   npm run type-check
   ```

2. **路由404错误**
   - 确保服务器配置了SPA回退规则
   - 检查`_redirects`文件 (Netlify) 或nginx配置

3. **API跨域问题**
   ```typescript
   // 开发环境代理配置
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:3001',
           changeOrigin: true
         }
       }
     }
   });
   ```

4. **环境变量未生效**
   - 确保变量名以`VITE_`开头
   - 重新构建应用
   - 检查部署平台的环境变量配置

### 日志调试

```typescript
// 添加调试日志
console.log('Environment:', import.meta.env.MODE);
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
```

## 📞 技术支持

如果在部署过程中遇到问题，请：

1. 检查本文档的故障排除部分
2. 查看项目的 [Issues](https://github.com/your-org/email-assist/issues)
3. 创建新的 Issue 描述问题
4. 联系技术支持团队

---

祝您部署顺利！🚀