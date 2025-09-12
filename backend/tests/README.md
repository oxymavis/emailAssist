# Email Assist Backend API Testing Suite

这是Email Assist后端API的完整测试套件，提供全面的API功能测试、性能测试和安全测试。

## 项目结构

```
tests/
├── conftest.py                 # Pytest配置和全局fixtures
├── pytest.ini                 # Pytest设置
├── requirements.txt            # 测试依赖
├── run_tests.py               # 主测试运行器
├── API_TEST_CASES.md          # 详细测试用例文档
├── README.md                  # 本文档
├── fixtures/                  # 测试数据和fixtures
│   └── test_data.py          # 测试数据生成器
├── utils/                     # 测试工具
│   ├── database_setup.py     # 数据库测试环境
│   └── mock_services.py      # Mock外部服务
├── unit/                      # 单元测试
├── integration/              # 集成测试
│   ├── test_auth_api.py      # 用户认证API测试
│   ├── test_email_api.py     # 邮件管理API测试
│   ├── test_analysis_api.py  # AI分析API测试
│   ├── test_rules_api.py     # 过滤规则API测试
│   ├── test_reports_api.py   # 报告生成API测试
│   └── test_monitoring_api.py # 监控性能API测试
├── performance/              # 性能测试
├── security/                 # 安全测试
└── reports/                  # 测试报告输出
```

## 快速开始

### 1. 安装测试依赖

```bash
cd /Users/shelia/Desktop/01_Unis/05_Cursor/0908/backend/tests
pip install -r requirements.txt
```

### 2. 配置测试环境

复制环境配置文件：
```bash
cp ../.env.example .env.test
```

编辑 `.env.test` 文件，设置测试环境变量：
```env
# 测试数据库配置
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=password
TEST_DB_NAME=email_assist_test
TEST_DB_URL=postgresql://postgres:password@localhost:5432/email_assist_test

# 测试Redis配置
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
REDIS_TEST_DB=1
TEST_REDIS_URL=redis://localhost:6379/1

# API服务配置
API_BASE_URL=http://localhost:3001/api

# 测试配置
SEED_TEST_DATA=true
USE_MOCK_SERVICES=true
```

### 3. 启动后端服务

确保后端服务正在运行：
```bash
cd ..
npm run dev
```

### 4. 运行测试

#### 运行所有测试
```bash
python run_tests.py
```

#### 运行特定类型的测试
```bash
# 只运行集成测试
python run_tests.py --integration

# 只运行单元测试
python run_tests.py --unit

# 只运行性能测试
python run_tests.py --performance

# 只运行安全测试
python run_tests.py --security

# 运行烟雾测试
python run_tests.py --smoke
```

#### 运行特定测试文件
```bash
# 运行认证API测试
python run_tests.py integration/test_auth_api.py

# 运行邮件API测试
python run_tests.py integration/test_email_api.py
```

#### 使用标记运行测试
```bash
# 运行标记为api的测试
python run_tests.py -m api

# 运行标记为auth的测试
python run_tests.py -m auth

# 运行多个标记
python run_tests.py -m "api and auth"
```

## 测试选项

### 基础选项

- `-v, --verbose`: 增加输出详细程度
- `-s, --capture`: 禁用输出捕获，显示print语句
- `-x, --exitfirst`: 遇到第一个失败就停止
- `--maxfail N`: N次失败后停止
- `-n N, --workers N`: 并行运行测试

### 环境选项

- `--no-setup`: 跳过环境设置
- `--no-teardown`: 跳过环境清理
- `--no-mock`: 禁用Mock服务（使用真实服务）
- `--no-seed`: 跳过测试数据种子

### 报告选项

- `--report-dir DIR`: 指定报告输出目录
- `--no-report`: 跳过HTML报告生成
- `--no-cov`: 禁用覆盖率报告
- `--cov-fail-under N`: 覆盖率低于N%时失败

## 测试类别

### 集成测试 (integration/)

测试完整的API端点功能，包括：

- **认证测试** (`test_auth_api.py`): 用户注册、登录、JWT管理、OAuth
- **邮件测试** (`test_email_api.py`): CRUD操作、搜索、标签、批量操作
- **分析测试** (`test_analysis_api.py`): 情感分析、优先级评估、分类、关键词提取
- **规则测试** (`test_rules_api.py`): 过滤规则CRUD、执行引擎、性能监控
- **报告测试** (`test_reports_api.py`): 模板管理、生成、导出、调度
- **监控测试** (`test_monitoring_api.py`): 健康检查、性能指标、缓存管理

### 性能测试 (performance/)

测试系统在负载下的表现：

- 负载测试：模拟正常用户负载
- 压力测试：测试系统极限
- 并发测试：多用户同时操作
- 响应时间测试：API响应时间基准

### 安全测试 (security/)

测试安全漏洞和防护：

- 认证绕过测试
- 授权检查测试
- 输入验证测试
- SQL注入防护测试
- XSS防护测试
- Rate limiting测试

## 测试数据

测试套件使用以下数据：

### 自动生成数据

- 使用 `TestDataGenerator` 类生成真实的测试数据
- 支持生成用户、邮件、规则、报告等完整数据集
- 可自定义数据特征和规模

### 预定义数据

- `fixtures/test_data.py` 包含预定义的测试用例
- 包括边界测试用例和特殊场景
- 支持从JSON文件加载自定义数据集

## Mock服务

测试套件包含完整的外部服务Mock：

### Microsoft Graph API Mock
- OAuth认证流程
- 用户信息获取
- 邮件同步和管理

### OpenAI API Mock  
- 智能分析响应
- 情感分析结果
- 优先级和分类评估

### Gmail API Mock
- Gmail邮件同步
- OAuth认证
- 邮件操作

### SMTP/IMAP Mock
- 邮件发送测试
- IMAP邮件获取
- 连接和认证测试

## 数据库测试

### 测试数据库设置

- 自动创建独立的测试数据库
- 完整的数据库模式创建
- 测试数据种子和清理

### 事务管理

- 每个测试使用独立事务
- 测试结束后自动回滚
- 保证测试间的数据隔离

## 配置选项

### 环境变量

```bash
# 数据库配置
TEST_DB_HOST=localhost           # 测试数据库主机
TEST_DB_PORT=5432               # 测试数据库端口  
TEST_DB_USER=postgres           # 测试数据库用户
TEST_DB_PASSWORD=password       # 测试数据库密码
TEST_DB_NAME=email_assist_test  # 测试数据库名称

# Redis配置
TEST_REDIS_HOST=localhost       # 测试Redis主机
TEST_REDIS_PORT=6379           # 测试Redis端口
REDIS_TEST_DB=1                # 测试Redis数据库编号

# API配置
API_BASE_URL=http://localhost:3001/api  # API服务地址

# 测试行为配置
SEED_TEST_DATA=true            # 是否种子测试数据
USE_MOCK_SERVICES=true         # 是否使用Mock服务
TEST_TIMEOUT=30                # 测试超时时间（秒）
LOG_LEVEL=INFO                 # 日志级别
```

## 测试报告

测试完成后，以下报告会生成在 `reports/` 目录：

### HTML报告
- `test_report.html`: 交互式测试报告
- `coverage/index.html`: 代码覆盖率报告

### JSON报告  
- `test_report.json`: 机器可读的测试结果
- `coverage.xml`: XML格式的覆盖率报告

## 持续集成

### GitHub Actions

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: email_assist_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        cd backend/tests
        pip install -r requirements.txt
    
    - name: Run tests
      run: |
        cd backend/tests
        python run_tests.py --no-setup --cov-fail-under=80
      env:
        TEST_DB_URL: postgresql://postgres:password@localhost:5432/email_assist_test
        TEST_REDIS_URL: redis://localhost:6379/1
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查PostgreSQL是否运行
   sudo systemctl status postgresql
   
   # 检查连接参数
   psql -h localhost -p 5432 -U postgres -d postgres
   ```

2. **Redis连接失败**
   ```bash
   # 检查Redis是否运行
   sudo systemctl status redis
   
   # 测试连接
   redis-cli ping
   ```

3. **API服务不可达**
   ```bash
   # 检查后端服务是否运行
   curl http://localhost:3001/health
   
   # 检查端口占用
   netstat -tlnp | grep :3001
   ```

4. **测试数据问题**
   ```bash
   # 手动清理测试数据
   python run_tests.py --no-seed --no-teardown
   
   # 重置测试数据库
   dropdb email_assist_test
   createdb email_assist_test
   ```

### 调试模式

```bash
# 启用详细日志
python run_tests.py -vv --capture

# 只运行失败的测试
python run_tests.py --lf

# 进入调试模式
python run_tests.py --pdb

# 生成调试报告
python run_tests.py --report-dir=debug_reports
```

## 贡献指南

### 添加新测试

1. 在相应目录创建测试文件
2. 使用适当的pytest标记
3. 添加详细的文档字符串
4. 确保测试独立且可重复
5. 更新测试用例文档

### 测试命名规范

- 测试文件: `test_*.py`
- 测试类: `Test*`
- 测试方法: `test_*`
- 使用描述性名称说明测试目的

### 代码质量

- 遵循PEP8代码风格
- 使用类型提示
- 添加适当的错误处理
- 保持80%以上的测试覆盖率

## 性能基准

### API响应时间目标
- 认证API: < 500ms
- 邮件查询: < 1s
- AI分析: < 2s
- 报告生成: < 10s

### 并发性能目标
- 支持100个并发用户
- 错误率 < 1%
- 95%请求响应时间 < 2s

### 资源使用目标
- 内存使用 < 1GB
- CPU使用 < 80%
- 数据库连接 < 20

---

有关详细的测试用例说明，请参阅 [API_TEST_CASES.md](API_TEST_CASES.md)。