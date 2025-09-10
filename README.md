# Email Assist - AI驱动的智能邮件助手

![Email Assist Logo](https://via.placeholder.com/200x80/2196F3/FFFFFF?text=Email+Assist)

Email Assist 是一款基于 AI 技术的智能邮件管理系统，专为提高邮件处理效率和工作流自动化而设计。通过先进的人工智能分析，帮助用户更好地管理、分析和处理电子邮件。

## ✨ 核心功能

### 📊 智能仪表板
- **实时统计**: 邮件处理量、未读邮件数、响应时间等关键指标
- **趋势分析**: 邮件流量趋势、处理效率变化
- **快速概览**: 最近邮件、紧急事项一目了然

### 🤖 AI邮件分析
- **情感分析**: 自动识别邮件的积极、中性、消极情感倾向
- **紧急程度评估**: 智能判断邮件的重要性和紧急程度
- **内容摘要**: AI生成邮件摘要，快速了解核心信息
- **关键主题提取**: 自动提取邮件关键词和主题
- **智能回复建议**: 根据邮件内容提供回复建议

### 🔧 过滤规则引擎
- **可视化规则配置**: 拖拽式界面，轻松创建过滤条件
- **多条件组合**: 支持AND/OR逻辑组合，精确匹配
- **自动化动作**: 自动分类、标签、转发、删除等操作
- **规则测试**: 实时预览规则效果，确保准确性

### 📈 报告中心
- **多维度报告**: 日报、周报、月报及自定义时间段
- **数据可视化**: 丰富的图表展示，直观了解邮件趋势
- **导出功能**: 支持PDF、Excel格式导出
- **自动生成**: 定时生成报告，无需手动操作

### 🔗 工作流集成
- **Trello集成**: 自动创建Trello卡片，项目管理更轻松
- **Jira集成**: 将邮件转换为Jira问题单，技术支持更高效
- **自定义模板**: 灵活配置输出内容，满足不同需求
- **状态跟踪**: 实时监控工作流执行状态

### ⚙️ 系统设置
- **个性化配置**: 主题切换、语言设置、时区配置
- **通知管理**: 邮件通知、推送通知的个性化设置
- **集成管理**: Microsoft Graph、第三方服务连接管理
- **数据备份**: 自动备份设置和数据，保障数据安全

## 🚀 技术栈

### 前端技术
- **React 18**: 现代化的前端框架
- **TypeScript**: 类型安全的开发体验
- **Material-UI v5**: 优雅的Material Design组件库
- **React Router v6**: 单页应用路由管理
- **Zustand**: 轻量级状态管理
- **Recharts**: 数据可视化图表库

### 开发工具
- **Vite**: 快速的构建工具
- **ESLint**: 代码质量检查
- **Axios**: HTTP客户端

### 设计规范
- **Material Design 3**: 遵循最新设计规范
- **响应式设计**: 完美适配桌面和移动设备
- **蓝橙红配色**: 专业、活力、警示的配色方案

## 📱 项目结构

```
email-assist/
├── public/                 # 静态资源
├── src/                    # 源代码
│   ├── components/         # React组件
│   │   ├── common/        # 公共组件
│   │   ├── dashboard/     # 仪表板组件
│   │   ├── analysis/      # 分析组件
│   │   ├── filters/       # 过滤规则组件
│   │   ├── reports/       # 报告组件
│   │   ├── workflows/     # 工作流组件
│   │   └── settings/      # 设置组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义Hooks
│   ├── services/          # API服务
│   ├── store/             # 状态管理
│   ├── themes/            # 主题配置
│   ├── types/             # TypeScript类型定义
│   ├── utils/             # 工具函数
│   ├── App.tsx            # 应用根组件
│   └── main.tsx           # 应用入口
├── package.json           # 项目配置
├── vite.config.ts         # Vite配置
├── tsconfig.json          # TypeScript配置
└── README.md              # 项目文档
```

## 🛠️ 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-org/email-assist.git
cd email-assist
```

2. **安装依赖**
```bash
npm install
# 或者
yarn install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置相应的API密钥和服务地址
```

4. **启动开发服务器**
```bash
npm run dev
# 或者
yarn dev
```

5. **访问应用**
打开浏览器访问 http://localhost:3000

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🔧 配置说明

### 环境变量配置

在项目根目录创建 `.env` 文件，参考 `.env.example` 配置：

```env
# 应用基本配置
VITE_APP_NAME=Email Assist
VITE_APP_VERSION=1.0.0

# API服务配置
VITE_API_BASE_URL=http://localhost:3001/api

# Microsoft Graph配置
VITE_GRAPH_CLIENT_ID=your-client-id
VITE_GRAPH_TENANT_ID=your-tenant-id

# 第三方服务配置
VITE_TRELLO_APP_KEY=your-trello-key
VITE_JIRA_API_URL=https://your-domain.atlassian.net
```

### Microsoft Graph集成

1. 在Azure Active Directory中注册应用
2. 配置OAuth重定向URI
3. 获取Client ID和Tenant ID
4. 在环境变量中配置相关信息

### 第三方服务集成

#### Trello集成
1. 访问 [Trello开发者页面](https://trello.com/app-key)
2. 获取App Key和Token
3. 在设置页面配置Trello集成

#### Jira集成
1. 创建Jira API Token
2. 配置Jira服务器URL
3. 在设置页面完成Jira集成配置

## 📚 功能指南

### 1. 邮件分析

**自动分析**
- 启用自动分析后，新邮件将自动进行AI分析
- 支持情感分析、紧急程度评估、内容摘要等功能

**批量分析**
- 选择多封邮件进行批量AI分析
- 支持导出分析结果

### 2. 过滤规则

**创建规则**
1. 点击"创建规则"按钮
2. 设置过滤条件（发件人、主题、内容等）
3. 配置执行动作（移动、标签、转发等）
4. 测试规则效果
5. 保存并启用规则

**规则管理**
- 支持规则优先级设置
- 实时启用/禁用规则
- 规则执行统计

### 3. 报告生成

**报告类型**
- 日报：每日邮件处理统计
- 周报：周度邮件趋势分析
- 月报：月度邮件数据汇总
- 自定义：灵活设置时间范围

**导出功能**
- PDF格式：适合打印和分享
- Excel格式：便于数据二次分析

### 4. 工作流配置

**Trello工作流**
1. 获取Trello API Key
2. 配置目标Board
3. 设置卡片模板
4. 测试连接并启用

**Jira工作流**
1. 配置Jira服务器信息
2. 设置项目Key
3. 定义问题单模板
4. 测试连接并启用

## 🎨 界面预览

### 仪表板
![仪表板预览](https://via.placeholder.com/800x600/F5F5F5/333333?text=Dashboard+Preview)

### AI分析
![AI分析预览](https://via.placeholder.com/800x600/E3F2FD/1976D2?text=AI+Analysis+Preview)

### 过滤规则
![过滤规则预览](https://via.placeholder.com/800x600/FFF3E0/F57C00?text=Filter+Rules+Preview)

### 报告中心
![报告中心预览](https://via.placeholder.com/800x600/E8F5E8/4CAF50?text=Reports+Preview)

## 🔍 开发指南

### 代码规范

- 使用TypeScript进行类型检查
- 遵循ESLint规则
- 采用函数式组件和Hooks
- 统一的命名约定

### 组件开发

```tsx
// 组件示例
import React from 'react';
import { Box, Typography } from '@mui/material';

interface ExampleComponentProps {
  title: string;
  subtitle?: string;
}

const ExampleComponent: React.FC<ExampleComponentProps> = ({ 
  title, 
  subtitle 
}) => {
  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default ExampleComponent;
```

### 状态管理

使用Zustand进行状态管理：

```typescript
import { create } from 'zustand';

interface AppState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

## 🤝 贡献指南

我们欢迎任何形式的贡献！请遵循以下步骤：

1. **Fork项目**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **创建Pull Request**

### 提交规范

使用[Conventional Commits](https://www.conventionalcommits.org/)规范：

- `feat:` 新功能
- `fix:` 修复问题
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建和工具相关

## 📝 更新日志

### v1.0.0 (2024-01-20)

**新功能**
- ✨ 完整的仪表板功能
- 🤖 AI邮件分析系统
- 🔧 可视化过滤规则配置
- 📊 多维度报告生成
- 🔗 Trello/Jira工作流集成
- ⚙️ 系统设置和个性化配置

**技术特性**
- 📱 完全响应式设计
- 🎨 Material Design 3规范
- 🚀 基于React 18和TypeScript
- 💾 本地数据持久化
- 🌍 国际化支持

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和设计师！

特别感谢：
- [Material-UI](https://mui.com/) - 优秀的React组件库
- [React](https://reactjs.org/) - 强大的前端框架
- [Vite](https://vitejs.dev/) - 快速的构建工具
- [Zustand](https://github.com/pmndrs/zustand) - 轻量级状态管理

---

<div align="center">
  <p>用 ❤️ 和 ☕ 制作</p>
  <p>© 2024 Email Assist Team. All rights reserved.</p>
</div>