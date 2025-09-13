# Trello 集成详细配置指南

## 📋 Trello Power-Up 配置

### 第一步：创建 Trello Power-Up

1. **访问 Trello Power-Ups 管理页面**
   - 打开 https://trello.com/power-ups/admin
   - 登录您的 Trello 账户

2. **创建新的 Power-Up**
   - 点击 "Create New Power-Up"
   - 填写基本信息：
     - **Name**: Email Assist Integration
     - **Overview**: Sync emails to Trello cards
     - **Description**: Create Trello cards from emails with AI analysis

3. **配置 Power-Up 功能**
   
   在 "Capabilities" 部分，启用以下功能：
   - ✅ **Board Buttons** - 在看板上添加按钮
   - ✅ **Card Buttons** - 在卡片上添加按钮
   - ✅ **Card Badges** - 显示卡片徽章
   - ✅ **Card Detail Badges** - 显示详细徽章

### 第二步：配置 Iframe 连接器 URL

在 Power-Up 配置页面的 "Iframe connector URL" 部分：

#### 开发环境配置
```
https://localhost:3000/trello-connector
```

或者如果您使用 ngrok 进行本地开发：
```
https://your-subdomain.ngrok.io/trello-connector
```

#### 生产环境配置
```
https://your-domain.com/trello-connector
```

### 第三步：创建 Trello 连接器页面

在前端项目中创建连接器页面：

```typescript
// src/pages/TrelloConnector.tsx
import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CircularProgress, Typography } from '@mui/material';

declare global {
  interface Window {
    TrelloPowerUp: any;
  }
}

const TrelloConnector: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    // 加载 Trello Power-Up 客户端库
    const script = document.createElement('script');
    script.src = 'https://p.trellocdn.com/power-up.min.js';
    script.onload = () => {
      if (window.TrelloPowerUp) {
        initializePowerUp();
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const initializePowerUp = () => {
    window.TrelloPowerUp.initialize({
      // 看板按钮
      'board-buttons': async (t: any) => {
        return [{
          icon: {
            dark: 'https://your-domain.com/email-icon-dark.svg',
            light: 'https://your-domain.com/email-icon-light.svg'
          },
          text: 'Import Emails',
          callback: handleImportEmails
        }];
      },
      
      // 卡片按钮
      'card-buttons': async (t: any) => {
        return [{
          icon: 'https://your-domain.com/email-icon.svg',
          text: 'Link Email',
          callback: handleLinkEmail
        }];
      },
      
      // 卡片徽章
      'card-badges': async (t: any) => {
        const cardData = await t.card('all');
        const emailId = await t.get('card', 'shared', 'emailId');
        
        if (emailId) {
          return [{
            text: '📧 Email',
            color: 'blue',
            icon: 'https://your-domain.com/email-icon.svg'
          }];
        }
        return [];
      },
      
      // 卡片详细徽章
      'card-detail-badges': async (t: any) => {
        const emailId = await t.get('card', 'shared', 'emailId');
        
        if (emailId) {
          return [{
            title: 'Email',
            text: 'View Original Email',
            color: 'blue',
            callback: (t: any) => {
              return t.popup({
                title: 'Email Details',
                url: `https://your-domain.com/email/${emailId}`,
                height: 600
              });
            }
          }];
        }
        return [];
      }
    });
    
    setIsInitialized(true);
  };

  const handleImportEmails = async (t: any) => {
    setT(t);
    
    // 打开选择邮件的弹窗
    return t.popup({
      title: 'Import Emails to Trello',
      url: 'https://your-domain.com/trello-import',
      height: 600
    });
  };

  const handleLinkEmail = async (t: any) => {
    // 链接邮件到卡片
    const email = await selectEmail(); // 实现邮件选择逻辑
    
    if (email) {
      // 保存邮件ID到卡片
      await t.set('card', 'shared', 'emailId', email.id);
      
      // 更新卡片描述
      const card = await t.card('desc');
      const newDesc = `${card.desc}\n\n---\n📧 **Linked Email**\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}`;
      
      await t.updateCard('desc', newDesc);
      
      // 添加附件链接
      await t.attach({
        name: `Email: ${email.subject}`,
        url: `https://your-domain.com/email/${email.id}`
      });
    }
  };

  const selectEmail = async (): Promise<any> => {
    // 实现邮件选择逻辑
    // 可以打开一个模态框让用户选择邮件
    return null;
  };

  if (!isInitialized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        Email Assist - Trello Integration
      </Typography>
      <Typography variant="body1" color="text.secondary">
        This connector enables Email Assist to work with your Trello boards.
      </Typography>
    </Card>
  );
};

export default TrelloConnector;
```

### 第四步：配置路由

在 React Router 中添加路由：

```typescript
// src/App.tsx
import TrelloConnector from '@/pages/TrelloConnector';

// 在路由配置中添加
<Route path="/trello-connector" element={<TrelloConnector />} />
```

### 第五步：创建导入页面

创建邮件导入页面：

```typescript
// src/pages/TrelloImport.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography
} from '@mui/material';
import { useEmails } from '@/store';
import realAPI from '@/services/realApi';

const TrelloImport: React.FC = () => {
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [listId, setListId] = useState<string>('');
  const emails = useEmails();

  useEffect(() => {
    // 从 Trello 上下文获取列表 ID
    const t = window.TrelloPowerUp.iframe();
    t.board('id', 'name').then((board: any) => {
      // 获取看板的列表
      t.lists('all').then((lists: any) => {
        if (lists.length > 0) {
          setListId(lists[0].id);
        }
      });
    });
  }, []);

  const handleToggle = (emailId: string) => {
    const currentIndex = selectedEmails.indexOf(emailId);
    const newSelected = [...selectedEmails];

    if (currentIndex === -1) {
      newSelected.push(emailId);
    } else {
      newSelected.splice(currentIndex, 1);
    }

    setSelectedEmails(newSelected);
  };

  const handleImport = async () => {
    const t = window.TrelloPowerUp.iframe();
    
    for (const emailId of selectedEmails) {
      const email = emails.find(e => e.id === emailId);
      if (email) {
        // 创建 Trello 卡片
        await realAPI.integration.createTrelloCard(emailId, listId);
      }
    }
    
    // 关闭弹窗
    t.closePopup();
  };

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Select Emails to Import
      </Typography>
      
      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {emails.map((email) => (
          <ListItem
            key={email.id}
            button
            onClick={() => handleToggle(email.id)}
          >
            <ListItemIcon>
              <Checkbox
                checked={selectedEmails.includes(email.id)}
                edge="start"
              />
            </ListItemIcon>
            <ListItemText
              primary={email.subject}
              secondary={`From: ${email.from?.email} - ${new Date(email.receivedAt).toLocaleDateString()}`}
            />
          </ListItem>
        ))}
      </List>
      
      <Box mt={2} display="flex" justifyContent="flex-end" gap={2}>
        <Button
          variant="outlined"
          onClick={() => window.TrelloPowerUp.iframe().closePopup()}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={selectedEmails.length === 0}
        >
          Import {selectedEmails.length} Email(s)
        </Button>
      </Box>
    </Paper>
  );
};

export default TrelloImport;
```

### 第六步：配置 CORS 和安全设置

在后端配置中允许 Trello 域名：

```typescript
// backend/src/middleware/cors.ts
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://trello.com',
    'https://*.trello.com',
    'https://p.trellocdn.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Trello-Client-Version']
};
```

### 第七步：添加到 HTML

在 `index.html` 中添加 CSP 策略：

```html
<!-- public/index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://p.trellocdn.com; 
               connect-src 'self' https://api.trello.com https://trello.com;
               frame-ancestors https://trello.com https://*.trello.com;">
```

### 第八步：获取 API 凭据

1. **获取 API Key**
   - 访问 https://trello.com/app-key
   - 复制 API Key

2. **获取 Token**
   - 点击页面上的 "Token" 链接
   - 或访问：
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&name=Email%20Assist&key=YOUR_API_KEY
   ```
   - 授权后复制 Token

3. **配置环境变量**
   ```env
   TRELLO_API_KEY=your_api_key_here
   TRELLO_API_TOKEN=your_token_here
   ```

### 第九步：测试集成

1. **安装 Power-Up 到看板**
   - 打开 Trello 看板
   - 点击 "Power-Ups" → "Custom"
   - 输入您的 Power-Up ID 或 URL
   - 点击 "Add"

2. **测试功能**
   - 检查看板按钮是否显示
   - 尝试导入邮件到卡片
   - 验证卡片徽章显示

### 🔧 调试技巧

1. **使用 ngrok 进行本地测试**
   ```bash
   # 安装 ngrok
   npm install -g ngrok
   
   # 暴露本地端口
   ngrok http 3000
   ```
   使用 ngrok 提供的 HTTPS URL 作为 Iframe connector URL

2. **查看控制台日志**
   - 在 Trello 中按 F12 打开开发者工具
   - 查看 Console 和 Network 标签

3. **测试 Power-Up 沙箱**
   - 访问 https://trello.com/power-up-preview
   - 输入您的 Power-Up manifest URL
   - 测试功能

### 📋 完整配置清单

- [ ] 创建 Trello Power-Up
- [ ] 配置 Iframe connector URL
- [ ] 实现连接器页面
- [ ] 配置路由
- [ ] 获取 API 凭据
- [ ] 配置 CORS
- [ ] 测试集成

### 🚀 生产环境部署

部署到生产环境时：

1. 更新 Iframe connector URL 为生产域名
2. 确保 HTTPS 已启用
3. 配置正确的 CSP 策略
4. 在 Power-Up 设置中添加截图和说明
5. 提交 Power-Up 审核（如果要公开发布）

### 📚 参考资源

- [Trello Power-Ups 文档](https://developer.atlassian.com/cloud/trello/power-ups/)
- [Power-Up 客户端库](https://developer.atlassian.com/cloud/trello/power-ups/client-library/)
- [Power-Up 示例](https://github.com/trello/power-up-template)
- [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/)

---

需要帮助？查看 [Trello 开发者社区](https://community.developer.atlassian.com/c/trello) 或提交 Issue。