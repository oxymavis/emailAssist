# Email Assist 设计规范文档 (DESIGN_SPEC.md)

## 1. 设计系统概述

### 产品定位
Email Assist 是一款面向技术支持和项目管理人员的智能邮件监控分析Web应用，采用Modern Material Design 3设计体系，强调数据驱动和工作流效率优化。

### 设计原则
- **数据驱动设计**: 优先展示关键邮件分析数据和AI洞察
- **渐进式信息披露**: 从概览到详情的层次化信息架构
- **零界面交互**: AI主动推送重要信息，减少用户主动操作
- **一致性体验**: 跨页面统一的交互模式和视觉元素
- **可访问性优先**: 确保技术支持人员在各种工作环境下的易用性

## 2. 色彩规范

### 主色调系统
```css
/* 主色调 - Material Blue */
--primary-50: #E3F2FD
--primary-100: #BBDEFB
--primary-500: #1976D2  /* 主色 */
--primary-700: #1565C0
--primary-900: #0D47A1

/* 辅助色 - Vibrant Orange */
--secondary-50: #FFF3E0
--secondary-100: #FFE0B2
--secondary-500: #FF6D00  /* 辅色 */
--secondary-700: #E65100
--secondary-900: #BF360C

/* 功能色 - Alert Red */
--error-50: #FFEBEE
--error-100: #FFCDD2
--error-500: #D32F2F  /* 错误/紧急 */
--error-700: #C62828
--error-900: #B71C1C

/* 成功色 - Green */
--success-500: #4CAF50

/* 警告色 - Amber */
--warning-500: #FF9800

/* 中性色系 */
--neutral-50: #FAFAFA
--neutral-100: #F5F5F5
--neutral-200: #EEEEEE
--neutral-300: #E0E0E0
--neutral-400: #BDBDBD
--neutral-500: #9E9E9E
--neutral-600: #757575
--neutral-700: #616161
--neutral-800: #424242
--neutral-900: #212121
```

### 色彩使用指南
- **主色蓝色**: 主要按钮、链接、导航、品牌元素
- **辅色橙色**: CTA按钮、重要提醒、数据高亮
- **功能红色**: 紧急邮件标识、错误状态、删除操作
- **中性色**: 文字、背景、边框、阴影

## 3. 字体排版规范

### 字体系统
```css
/* 英文字体 */
font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 中文字体 */
font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

### 排版层级
```css
/* 标题层级 */
--h1-size: 32px; --h1-weight: 300; --h1-line-height: 1.2;
--h2-size: 24px; --h2-weight: 400; --h2-line-height: 1.3;
--h3-size: 20px; --h3-weight: 500; --h3-line-height: 1.4;
--h4-size: 16px; --h4-weight: 600; --h4-line-height: 1.5;

/* 正文层级 */
--body1-size: 16px; --body1-weight: 400; --body1-line-height: 1.6;
--body2-size: 14px; --body2-weight: 400; --body2-line-height: 1.6;
--caption-size: 12px; --caption-weight: 400; --caption-line-height: 1.4;
```

## 4. 组件库设计规范

### 4.1 按钮组件
```css
/* 主要按钮 */
.btn-primary {
  background: var(--primary-500);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

/* 次要按钮 */
.btn-secondary {
  background: var(--secondary-500);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
}

/* 文本按钮 */
.btn-text {
  background: transparent;
  color: var(--primary-500);
  padding: 8px 16px;
}
```

### 4.2 邮件卡片组件
```css
.email-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid transparent;
}

.email-card.urgent {
  border-left-color: var(--error-500);
}

.email-card.important {
  border-left-color: var(--secondary-500);
}
```

### 4.3 表单组件
```css
.form-input {
  border: 1px solid var(--neutral-300);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  border-color: var(--primary-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(25,118,210,0.1);
}
```

## 5. 页面布局和网格系统

### 5.1 网格系统
```css
/* 12列网格系统 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -12px;
}

.col {
  padding: 0 12px;
  flex: 1;
}
```

### 5.2 主要页面布局

#### 仪表板页面
```
[Header - 64px]
[Sidebar - 280px] [Main Content Area]
                  [Stats Cards - 3列]
                  [Email List + AI Analysis]
                  [Charts Section]
```

#### 邮件分析页面
```
[Header - 64px]
[Breadcrumb - 48px]
[Email Detail Card]
[AI Analysis Panel]
[Related Actions]
```

## 6. 交互设计原则

### 6.1 导航设计
- **顶部导航**: 全局功能入口，品牌标识
- **侧边导航**: 主要功能模块导航
- **面包屑**: 层级导航，帮助用户定位

### 6.2 状态反馈
```css
/* 加载状态 */
.loading {
  opacity: 0.6;
  pointer-events: none;
}

/* 成功状态 */
.success {
  color: var(--success-500);
}

/* 错误状态 */
.error {
  color: var(--error-500);
}
```

### 6.3 动效规范
```css
/* 基础过渡 */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* 悬停效果 */
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

## 7. 响应式设计规范

### 7.1 断点设置
```css
/* 移动端 */
@media (max-width: 767px) { /* 手机 */ }

/* 平板端 */
@media (min-width: 768px) and (max-width: 1023px) { /* 平板 */ }

/* 桌面端 */
@media (min-width: 1024px) { /* 桌面 */ }
```

### 7.2 响应式布局策略
- **移动端**: 单列布局，堆叠式信息展示
- **平板端**: 2列布局，侧边栏可收起
- **桌面端**: 3列布局，充分利用屏幕空间

## 8. 图标和图形元素

### 8.1 图标系统
使用Material Design Icons图标库：
- **邮件相关**: mail, inbox, send, priority_high
- **AI分析**: analytics, smart_toy, insights
- **操作类**: add, edit, delete, filter_list
- **状态类**: check_circle, warning, error, info

### 8.2 图形元素
- **圆角**: 统一使用8px圆角
- **阴影**: 使用Material Design elevation system
- **分隔线**: 1px solid var(--neutral-200)

## 9. 开发实现指南

### 9.1 CSS变量系统
```css
:root {
  /* 间距系统 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* 阴影系统 */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.1);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.15);
}
```

### 9.2 组件命名规范
使用BEM命名方式：
```css
.email-card { /* 块 */ }
.email-card__header { /* 元素 */ }
.email-card--urgent { /* 修饰符 */ }
```

## 10. 可用性和无障碍访问

### 10.1 对比度要求
- 正文文字对比度: 最低4.5:1
- 大字体对比度: 最低3:1
- 非文本元素对比度: 最低3:1

### 10.2 键盘导航
- 所有交互元素可通过Tab键访问
- 提供明显的焦点指示器
- 支持Escape键关闭模态框

### 10.3 屏幕阅读器支持
```html
<!-- 语义化HTML -->
<main role="main">
  <section aria-labelledby="inbox-heading">
    <h2 id="inbox-heading">收件箱</h2>
    <!-- 内容 -->
  </section>
</main>

<!-- ARIA标签 -->
<button aria-label="标记为重要邮件" aria-pressed="false">
  <span aria-hidden="true">⭐</span>
</button>
```

---

## 总结

本设计规范文档为Email Assist提供了完整的视觉和交互设计指导，确保产品具有：
- 现代化的Material Design 3风格
- 专业的蓝橙红配色体系
- 高效的数据展示和交互体验
- 完善的响应式适配
- 符合标准的可访问性支持

开发团队可基于此规范进行前端实现，确保最终产品的设计一致性和用户体验质量。