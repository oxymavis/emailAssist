# ngrok 隧道测试配置

## 🚀 ngrok 隧道已成功启动！

### 隧道 URL 信息

#### 前端应用
- **本地地址**: http://localhost:3000
- **ngrok URL**: https://148807625e89.ngrok.app
- **状态**: ✅ 运行中

#### 后端 API
- **本地地址**: http://localhost:3001
- **ngrok URL**: 需要在新终端运行: `ngrok http 3001`

### 📋 Trello Power-Up 配置步骤

#### 1. 访问 Trello Power-Ups 管理页面
打开浏览器访问: https://trello.com/power-ups/admin

#### 2. 创建或更新 Power-Up
如果还没有创建 Power-Up:
1. 点击 "Create New Power-Up"
2. 填写基本信息:
   - **Name**: Email Assist Integration
   - **Overview**: Sync emails to Trello cards
   - **Description**: Create Trello cards from emails with AI analysis

#### 3. 配置 Iframe Connector URL
在 Power-Up 设置中，将 **Iframe connector URL** 设置为:
```
https://148807625e89.ngrok.app/trello-connector
```

#### 4. 配置 Capabilities
启用以下功能:
- ✅ Board Buttons
- ✅ Card Buttons  
- ✅ Card Badges
- ✅ Card Detail Badges

#### 5. 配置图标 URL
更新图标 URL 为 ngrok 地址:
- Icon URL: `https://148807625e89.ngrok.app/email-icon.svg`
- Dark Icon: `https://148807625e89.ngrok.app/email-icon-dark.svg`
- Light Icon: `https://148807625e89.ngrok.app/email-icon-light.svg`

### 🔧 测试步骤

#### 1. 安装 Power-Up 到测试看板
1. 打开一个 Trello 看板
2. 点击菜单 → Power-Ups
3. 点击 "Custom" 或 "Add Power-Ups"
4. 搜索您的 Power-Up 名称或输入 Power-Up ID
5. 点击 "Add"

#### 2. 测试功能
1. **看板按钮测试**:
   - 检查看板顶部是否出现 "Import Emails" 按钮
   - 点击按钮，应该打开邮件导入弹窗

2. **卡片按钮测试**:
   - 打开任意卡片
   - 检查是否有 "Link Email" 按钮
   - 点击测试链接功能

3. **卡片徽章测试**:
   - 链接邮件后，卡片应显示邮件徽章

### 📝 环境变量配置

在前端 `.env` 文件中添加:
```env
# Trello 配置
VITE_TRELLO_APP_KEY=your_trello_app_key
VITE_TRELLO_CONNECTOR_URL=https://148807625e89.ngrok.app/trello-connector

# 后端 API (如果后端也使用 ngrok)
VITE_API_BASE_URL=http://localhost:3001/api
```

在后端 `.env` 文件中添加:
```env
# Trello API 配置
TRELLO_API_KEY=your_trello_api_key
TRELLO_API_TOKEN=your_trello_api_token
TRELLO_BOARD_ID=your_board_id

# CORS 配置 - 添加 ngrok 和 Trello 域名
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://148807625e89.ngrok.app,https://trello.com,https://*.trello.com
```

### 🐛 调试工具

#### 查看 ngrok 监控面板
访问: http://localhost:4040

这里可以看到:
- 所有 HTTP 请求的详细信息
- 请求/响应的 headers 和 body
- 请求耗时和状态码

#### Chrome 开发者工具
1. 在 Trello 页面按 F12 打开开发者工具
2. 查看 Console 标签的错误信息
3. 查看 Network 标签监控 API 请求

#### Trello Power-Up 沙箱测试
访问: https://trello.com/power-up-preview
输入您的 manifest URL 进行测试

### ⚠️ 注意事项

1. **ngrok 免费版限制**:
   - URL 每次重启会改变
   - 有请求速率限制
   - 会话时长限制（8小时）

2. **HTTPS 要求**:
   - Trello Power-Up 必须使用 HTTPS
   - ngrok 自动提供 HTTPS 支持

3. **CORS 配置**:
   - 确保后端允许来自 ngrok URL 的请求
   - 添加 Trello 域名到允许列表

4. **本地开发提示**:
   - 保持 ngrok 终端窗口开启
   - 如果 URL 改变，需要更新 Power-Up 配置

### 🔄 重新启动 ngrok

如果需要重新启动 ngrok:

```bash
# 前端隧道
ngrok http 3000

# 后端隧道（新终端）
ngrok http 3001

# 查看所有隧道
curl http://localhost:4040/api/tunnels | python3 -m json.tool
```

### 📚 相关资源

- [ngrok 文档](https://ngrok.com/docs)
- [Trello Power-Up 文档](https://developer.atlassian.com/cloud/trello/power-ups/)
- [Power-Up 客户端库](https://developer.atlassian.com/cloud/trello/power-ups/client-library/)

---

✅ **ngrok 隧道已启动并运行！** 

您现在可以:
1. 使用上述 ngrok URL 配置 Trello Power-Up
2. 测试前端和 Trello 的集成
3. 通过 http://localhost:4040 监控所有请求

如有问题，请检查 ngrok 监控面板和浏览器控制台。