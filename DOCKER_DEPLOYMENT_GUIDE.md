# Email Assist - Docker部署完整指南

## 概览

本指南详细介绍了Email Assist项目的完整Docker化部署方案，包括开发、测试、预发布和生产环境的配置和部署流程。

## 架构概述

### 容器化架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   Frontend      │    │   Backend       │
│   (Reverse      │    │   (React +      │    │   (Node.js +    │
│    Proxy)       │    │    TypeScript)  │    │    Express)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Redis         │    │   Monitoring    │
│   (Database)    │    │   (Cache)       │    │   (Prometheus   │
│                 │    │                 │    │    + Grafana)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 服务组件
- **Frontend**: React应用 + Nginx静态文件服务器
- **Backend**: Node.js API服务器
- **Database**: PostgreSQL数据库
- **Cache**: Redis缓存服务
- **Proxy**: Nginx反向代理和负载均衡器
- **Monitoring**: Prometheus + Grafana监控栈
- **Logging**: Loki + Promtail日志收集

## 快速开始

### 1. 环境准备

**系统要求:**
- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 20GB+ 可用磁盘空间

**安装Docker (Ubuntu/Debian):**
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加用户到docker组
sudo usermod -aG docker $USER
```

### 2. 项目设置

```bash
# 克隆项目
git clone <repository-url>
cd email-assist

# 复制环境配置
cp .env.docker .env

# 编辑环境变量
nano .env
```

### 3. 一键部署

```bash
# 生产环境部署
./deploy.sh deploy production

# 开发环境部署
./deploy.sh dev
```

## 环境配置

### 环境变量配置

创建`.env`文件并配置以下变量：

```bash
# 数据库配置
POSTGRES_DB=email_assist
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Redis配置
REDIS_PASSWORD=your_redis_password_here

# JWT配置
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long

# OpenAI配置
OPENAI_API_KEY=sk-your_openai_api_key_here

# 邮件服务配置
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret

# 监控配置
GRAFANA_PASSWORD=your_grafana_password
```

### SSL证书配置

**生产环境SSL证书:**
```bash
# 创建SSL目录
mkdir -p ssl

# 使用Let's Encrypt (推荐)
certbot certonly --standalone -d your-domain.com
ln -s /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
ln -s /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/private.key

# 或者使用自签名证书 (仅开发环境)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/private.key -out ssl/cert.pem
```

## 部署方案

### 开发环境部署

开发环境提供热重载和调试功能：

```bash
# 启动开发环境
./deploy.sh dev

# 或者使用Docker Compose直接启动
docker-compose -f docker-compose.dev.yml up -d

# 查看服务状态
docker-compose -f docker-compose.dev.yml ps
```

**开发环境服务端口:**
- Frontend (Vite): http://localhost:5173
- Backend API: http://localhost:3001
- Database Admin (Adminer): http://localhost:8081
- Redis Admin: http://localhost:8082
- Mailhog (邮件测试): http://localhost:8025

### 生产环境部署

生产环境配置了完整的安全和性能优化：

```bash
# 生产环境部署
./deploy.sh deploy production

# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs

# 备份数据
./deploy.sh backup
```

**生产环境服务端口:**
- Application: https://localhost (or your domain)
- Grafana监控: http://localhost:3000
- Prometheus: http://localhost:9090

### 预发布环境部署

预发布环境用于生产前的最终测试：

```bash
# 预发布环境部署
docker-compose -f docker-compose.staging.yml up -d

# 健康检查
curl -f http://localhost:8080/health
```

## 服务配置详解

### Frontend服务配置

**多阶段构建优化:**
- Build阶段: Node.js环境编译TypeScript和构建资源
- Production阶段: Nginx Alpine镜像提供静态文件服务

**安全特性:**
- 非root用户运行
- 安全头部配置
- Gzip压缩启用
- 静态资源缓存优化

### Backend服务配置

**生产环境优化:**
- TypeScript编译为JavaScript
- 生产依赖优化
- 健康检查端点
- 日志管理

**环境变量管理:**
- 敏感数据通过环境变量注入
- 多环境配置支持
- 配置验证机制

### 数据库配置

**PostgreSQL优化:**
- 连接池配置
- 索引优化
- 自动备份策略
- 性能监控

**初始化脚本:**
- 数据库模式创建
- 索引创建
- 初始数据插入
- 权限配置

### 缓存配置

**Redis优化:**
- 内存限制配置
- 持久化策略
- 安全认证
- 性能调优

### 监控配置

**Prometheus指标收集:**
- 应用性能指标
- 系统资源监控
- 业务指标追踪
- 告警规则配置

**Grafana仪表板:**
- 系统性能监控
- 应用健康状态
- 业务数据分析
- 告警通知

## CI/CD集成

### GitHub Actions工作流

自动化构建和部署流程：

1. **代码质量检查**
   - TypeScript类型检查
   - ESLint代码检查
   - 安全漏洞扫描

2. **镜像构建**
   - 多阶段Docker构建
   - 多架构支持 (amd64/arm64)
   - 镜像缓存优化

3. **自动化测试**
   - 单元测试
   - 集成测试
   - E2E测试

4. **部署流程**
   - 预发布环境自动部署
   - 生产环境手动审批部署
   - 回滚机制

### 部署脚本功能

`deploy.sh`脚本提供完整的部署管理：

```bash
# 查看帮助
./deploy.sh help

# 部署命令
./deploy.sh deploy [production|staging]
./deploy.sh dev              # 开发环境
./deploy.sh build            # 构建镜像
./deploy.sh status           # 服务状态
./deploy.sh logs [service]   # 查看日志
./deploy.sh backup           # 数据备份
./deploy.sh cleanup          # 清理资源
./deploy.sh update           # 更新部署
```

## 运维管理

### 健康检查

所有服务都配置了健康检查：

```bash
# 检查所有服务健康状态
docker-compose ps

# 检查特定服务
curl -f http://localhost/health
curl -f http://localhost:3001/health
```

### 日志管理

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend

# 使用部署脚本查看日志
./deploy.sh logs backend
```

### 性能监控

**Grafana仪表板访问:**
- URL: http://localhost:3000
- 用户名: admin
- 密码: 配置的GRAFANA_PASSWORD

**关键监控指标:**
- CPU和内存使用率
- 数据库连接数
- API响应时间
- 错误率统计
- 业务指标

### 数据备份

```bash
# 手动备份
./deploy.sh backup

# 自动备份 (配置在crontab中)
0 2 * * * /path/to/email-assist/deploy.sh backup
```

**备份内容:**
- PostgreSQL数据库完整转储
- 用户上传文件
- 配置文件
- 日志文件

### 安全配置

**网络安全:**
- 容器间网络隔离
- 端口访问控制
- HTTPS强制重定向
- 安全头部配置

**数据安全:**
- 数据库访问控制
- Redis密码保护
- 敏感数据加密存储
- 访问日志记录

**容器安全:**
- 非root用户运行
- 只读文件系统
- 资源限制配置
- 安全漏洞扫描

## 故障排除

### 常见问题

**1. 服务启动失败**
```bash
# 检查服务状态
docker-compose ps

# 查看详细错误信息
docker-compose logs service_name

# 重启服务
docker-compose restart service_name
```

**2. 数据库连接问题**
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready -U postgres

# 检查网络连接
docker-compose exec backend ping postgres
```

**3. 内存不足**
```bash
# 查看资源使用
docker stats

# 清理未使用的镜像和容器
docker system prune -f
```

**4. 磁盘空间不足**
```bash
# 查看磁盘使用
df -h

# 清理Docker资源
docker system prune -a -f

# 清理日志文件
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### 性能优化

**1. 数据库优化**
```sql
-- 查看慢查询
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- 分析表
ANALYZE;

-- 重建索引
REINDEX DATABASE email_assist;
```

**2. 缓存优化**
```bash
# Redis内存使用情况
docker-compose exec redis redis-cli info memory

# 清理过期键
docker-compose exec redis redis-cli --scan --pattern "*" | xargs redis-cli del
```

**3. 应用优化**
- 启用Gzip压缩
- 配置静态资源缓存
- 数据库连接池优化
- API响应缓存

## 扩展和定制

### 水平扩展

```yaml
# docker-compose.scale.yml
services:
  backend:
    scale: 3  # 运行3个backend实例
    
  nginx:
    volumes:
      - ./nginx/load-balancer.conf:/etc/nginx/conf.d/default.conf
```

### 微服务架构扩展

```yaml
# 添加新的微服务
  email-processor:
    build: ./services/email-processor
    scale: 2
    
  notification-service:
    build: ./services/notifications
    
  analytics-service:
    build: ./services/analytics
```

### 云平台部署

**AWS部署:**
- ECS/Fargate容器服务
- RDS托管数据库
- ElastiCache托管Redis
- ALB负载均衡器

**Azure部署:**
- Container Instances
- Azure Database for PostgreSQL
- Azure Redis Cache
- Application Gateway

**Google Cloud部署:**
- Cloud Run
- Cloud SQL
- Memorystore for Redis
- Cloud Load Balancing

## 最佳实践

### 安全最佳实践

1. **定期更新基础镜像**
2. **扫描安全漏洞**
3. **最小权限原则**
4. **网络隔离**
5. **敏感数据加密**

### 性能最佳实践

1. **镜像大小优化**
2. **分层缓存利用**
3. **资源限制配置**
4. **健康检查优化**
5. **日志管理策略**

### 运维最佳实践

1. **自动化部署流程**
2. **监控和告警配置**
3. **备份和恢复测试**
4. **文档维护更新**
5. **团队培训和知识共享**

## 支持和维护

### 版本更新

```bash
# 更新到最新版本
git pull origin main
./deploy.sh update

# 回滚到之前版本
git checkout <previous-commit>
./deploy.sh deploy production
```

### 技术支持

如遇到问题，请按以下步骤：

1. 查看本文档的故障排除部分
2. 检查GitHub Issues
3. 查看服务日志获取详细错误信息
4. 提交Issue时请包含：
   - 错误信息和日志
   - 环境配置信息
   - 复现步骤

### 贡献指南

欢迎贡献代码和改进建议：

1. Fork项目仓库
2. 创建功能分支
3. 提交更改并测试
4. 提交Pull Request

---

这个Docker化部署方案为Email Assist项目提供了完整的容器化解决方案，涵盖了从开发到生产的全流程部署和运维管理。通过这套方案，可以实现高效、安全、可扩展的应用部署。