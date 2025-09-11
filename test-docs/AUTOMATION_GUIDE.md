# Email Assist 自动化测试指南

## 1. 概述

本指南提供Email Assist项目的自动化测试环境搭建、执行和维护的详细说明。

---

## 2. 环境准备

### 2.1 系统要求

**最低配置:**
- Node.js 18+
- Python 3.11+  
- RAM: 8GB
- 磁盘空间: 20GB

**推荐配置:**
- Node.js 18.17+
- Python 3.11+
- RAM: 16GB
- SSD存储
- 稳定网络连接

### 2.2 依赖安装

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 安装Playwright浏览器
npx playwright install --with-deps

# 验证安装
npm run test:unit -- --version
cd backend && pytest --version
npx playwright --version
```

---

## 3. 测试配置

### 3.1 环境变量配置

创建 `.env.test` 文件：

```env
# 测试数据库
TEST_DATABASE_URL=postgresql://test:test@localhost:5433/email_assist_test
TEST_REDIS_URL=redis://localhost:6380/1

# API测试
API_BASE_URL=http://localhost:3001
FRONTEND_BASE_URL=http://localhost:3000

# 第三方服务（测试环境）
OPENAI_API_KEY=test-key-or-mock
TRELLO_API_KEY=test-trello-key
JIRA_API_URL=https://test.atlassian.net

# CI环境标识
CI=true
NODE_ENV=test
PYTHON_ENV=test
```

### 3.2 测试数据库设置

```bash
# 启动测试数据库
docker run --name email-assist-test-db \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=email_assist_test \
  -p 5433:5432 \
  -d postgres:13

# 运行数据库迁移
cd backend
alembic upgrade head

# 导入测试数据
python scripts/seed_test_data.py
```

---

## 4. 前端测试

### 4.1 单元测试

**运行命令:**
```bash
# 运行所有单元测试
npm run test:unit

# 带覆盖率报告
npm run test:unit -- --coverage

# 监听模式
npm run test:unit -- --watch

# 单个文件测试
npm run test:unit -- LoginComponent.test.tsx

# 调试模式
npm run test:unit -- --no-coverage --verbose
```

**配置文件:** `test-config/jest.config.js`

**测试文件位置:** `tests/unit/frontend/`

### 4.2 E2E测试

**运行命令:**
```bash
# 运行所有E2E测试
npm run test:e2e

# 指定浏览器
npm run test:e2e -- --project=chromium

# 运行特定测试文件
npm run test:e2e -- tests/e2e/specs/login.e2e.ts

# 调试模式
npm run test:e2e -- --debug

# 头显示模式（可以看到浏览器）
npm run test:e2e -- --headed

# 生成报告
npm run test:e2e -- --reporter=html
```

**配置文件:** `test-config/playwright.config.ts`

**测试文件位置:** `tests/e2e/`

### 4.3 组件测试

**运行命令:**
```bash
# React组件测试
npm run test:components

# Storybook交互测试
npm run test:storybook

# 可访问性测试
npm run test:a11y
```

---

## 5. 后端测试

### 5.1 单元测试

**运行命令:**
```bash
cd backend

# 运行所有单元测试
pytest tests/unit/

# 带覆盖率报告
pytest tests/unit/ --cov=src --cov-report=html

# 并行执行
pytest tests/unit/ -n auto

# 特定模块测试
pytest tests/unit/services/test_email_service.py

# 详细输出
pytest tests/unit/ -v --tb=short

# 只运行失败的测试
pytest tests/unit/ --lf
```

### 5.2 集成测试

**运行命令:**
```bash
cd backend

# 运行集成测试
pytest tests/integration/

# API测试
pytest tests/integration/api/

# 数据库测试
pytest tests/integration/database/

# 带标记的测试
pytest -m "api and not slow"

# 生成JUnit报告
pytest tests/integration/ --junitxml=../test-reports/junit/backend-integration.xml
```

---

## 6. 性能测试

### 6.1 前端性能测试

```bash
# Lighthouse性能测试
npm run test:lighthouse

# Core Web Vitals检测
npm run test:vitals

# 包大小分析
npm run analyze:bundle
```

### 6.2 后端性能测试

```bash
# API负载测试
artillery run tests/performance/api-load-test.yml

# 数据库性能测试
cd backend
pytest tests/performance/ -m performance

# 内存泄漏检测
pytest tests/performance/test_memory_leaks.py
```

---

## 7. 安全测试

### 7.1 前端安全扫描

```bash
# ESLint安全检查
npm run lint:security

# 依赖安全检查
npm audit

# 修复安全漏洞
npm audit fix
```

### 7.2 后端安全扫描

```bash
cd backend

# Bandit安全扫描
bandit -r src/

# Safety依赖检查
safety check

# 生成安全报告
bandit -r src/ -f json -o ../test-reports/security/bandit-report.json
```

---

## 8. CI/CD集成

### 8.1 GitHub Actions工作流

测试工作流自动在以下情况触发：
- Push到主分支
- 创建Pull Request
- 手动触发
- 定时执行（每日）

**主要工作流文件:**
- `.github/workflows/test-frontend.yml`
- `.github/workflows/test-backend.yml`  
- `.github/workflows/test-e2e.yml`

### 8.2 本地CI模拟

```bash
# 模拟完整CI流程
npm run ci:local

# 分步骤执行
npm run ci:lint
npm run ci:test
npm run ci:build
npm run ci:deploy-test
```

---

## 9. 测试数据管理

### 9.1 测试数据生成

```bash
# 生成用户测试数据
python scripts/generate_test_users.py --count 100

# 生成邮件测试数据  
python scripts/generate_test_emails.py --count 1000

# 生成分析结果数据
python scripts/generate_analysis_data.py --emails 1000
```

### 9.2 数据清理和重置

```bash
# 清理测试数据
npm run test:clean-data

# 重置测试数据库
npm run test:reset-db

# 重新导入种子数据
npm run test:seed-data
```

---

## 10. 调试指南

### 10.1 前端测试调试

**Jest单元测试调试:**
```bash
# 使用Node调试器
node --inspect-brk node_modules/.bin/jest --runInBand

# VS Code调试配置
{
  "type": "node", 
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

**Playwright E2E调试:**
```bash
# 调试特定测试
npx playwright test --debug tests/e2e/specs/login.e2e.ts

# 使用UI模式
npx playwright test --ui

# 查看测试执行录像
npx playwright show-trace test-results/trace.zip
```

### 10.2 后端测试调试

**Pytest调试:**
```bash
# 使用pdb调试器
pytest tests/unit/test_email_service.py -s --pdb

# VS Code调试配置
{
  "type": "python",
  "request": "launch", 
  "name": "Debug Pytest",
  "module": "pytest",
  "args": ["tests/unit/"],
  "console": "integratedTerminal"
}
```

---

## 11. 最佳实践

### 11.1 测试编写规范

**单元测试:**
```typescript
// Good: 描述性测试名称
test('should return error when email format is invalid', () => {
  // AAA模式：Arrange, Act, Assert
  const invalidEmail = 'invalid-email';
  
  const result = validateEmail(invalidEmail);
  
  expect(result.isValid).toBe(false);
  expect(result.error).toContain('Invalid email format');
});

// Bad: 模糊的测试名称
test('email test', () => {
  // 测试逻辑...
});
```

**E2E测试:**
```typescript
// Good: 使用Page Object模式
test('user login flow', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
  
  await expect(page).toHaveURL('/dashboard');
});
```

### 11.2 Mock和Fixture管理

**API Mock:**
```typescript
// 使用MSW进行API Mock
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('/api/login', (req, res, ctx) => {
    return res(
      ctx.json({ token: 'mock-token', user: { id: 1 } })
    );
  })
);
```

**测试数据Fixture:**
```python
# pytest fixture
@pytest.fixture
def sample_user():
    return {
        'email': 'test@example.com',
        'password': 'testpass123',
        'role': 'user'
    }

@pytest.fixture
def authenticated_client(client, sample_user):
    # 登录逻辑...
    return client
```

### 11.3 测试稳定性

**避免不稳定测试:**
```typescript
// Good: 使用明确的等待
await expect(page.getByTestId('loading')).toBeHidden();
await expect(page.getByTestId('data-table')).toBeVisible();

// Bad: 使用固定延时
await page.waitForTimeout(5000);
```

**元素定位最佳实践:**
```typescript
// Good: 优先使用testid
page.getByTestId('login-button')

// Good: 使用语义化定位
page.getByRole('button', { name: 'Login' })

// Avoid: CSS选择器（脆弱）
page.locator('.btn.btn-primary')
```

---

## 12. 故障排除

### 12.1 常见问题

**问题1: 测试数据库连接失败**
```bash
# 检查数据库状态
docker ps | grep postgres

# 重启测试数据库
docker restart email-assist-test-db

# 验证连接
psql -h localhost -p 5433 -U test -d email_assist_test
```

**问题2: Playwright浏览器下载失败**
```bash
# 手动安装浏览器
npx playwright install chromium

# 检查浏览器状态
npx playwright install --dry-run

# 使用代理安装
HTTPS_PROXY=http://proxy:8080 npx playwright install
```

**问题3: Jest内存泄漏**
```bash
# 增加内存限制
node --max-old-space-size=8192 node_modules/.bin/jest

# 检查内存使用
npm run test:unit -- --logHeapUsage

# 运行垃圾回收
npm run test:unit -- --expose-gc
```

### 12.2 性能问题优化

**加速测试执行:**
```bash
# 并行执行
npm run test:unit -- --maxWorkers=4
pytest -n 4

# 只运行变更的测试
npm run test:unit -- --onlyChanged
pytest --testmon

# 缓存优化
npm run test:unit -- --cache
```

**减少测试不稳定性:**
```typescript
// 增加超时时间
test('slow operation', async () => {
  // ...
}, 30000); // 30秒超时

// 重试机制
test.describe.configure({ retries: 2 });
```

---

## 13. 监控和报告

### 13.1 测试报告

**HTML报告:**
- Jest: `test-reports/coverage/index.html`
- Playwright: `test-reports/playwright-report/index.html`
- Pytest: `test-reports/coverage/backend/index.html`

**JUnit报告:**
- 前端: `test-reports/junit/frontend-tests.xml`
- 后端: `test-reports/junit/backend-tests.xml`

### 13.2 覆盖率监控

```bash
# 查看覆盖率摘要
npm run test:coverage-summary

# 详细覆盖率报告
npm run test:coverage-detailed

# 覆盖率趋势分析
npm run test:coverage-trend
```

---

## 14. 附录

### 14.1 有用的命令速查

```bash
# 常用测试命令
npm run test:quick        # 快速测试
npm run test:watch        # 监听模式
npm run test:debug        # 调试模式
npm run test:ci          # CI模式
npm run test:coverage    # 覆盖率测试

# 清理命令
npm run clean:cache      # 清理缓存
npm run clean:reports    # 清理报告
npm run clean:deps       # 清理依赖

# 辅助工具
npm run format:tests     # 格式化测试代码
npm run lint:tests       # 检查测试代码
npm run docs:tests       # 生成测试文档
```

### 14.2 相关资源

**官方文档:**
- [Jest官方文档](https://jestjs.io/docs)
- [Playwright官方文档](https://playwright.dev/docs)
- [Pytest官方文档](https://docs.pytest.org/)

**社区资源:**
- [Testing Library最佳实践](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Playwright最佳实践](https://playwright.dev/docs/best-practices)
- [Python测试最佳实践](https://docs.python-guide.org/writing/tests/)

### 14.3 联系支持

- **技术问题**: 在GitHub Issues中提出
- **紧急问题**: 联系项目维护者
- **功能建议**: 通过GitHub Discussions讨论

---

*本指南将持续更新以反映最新的测试实践和工具版本。*