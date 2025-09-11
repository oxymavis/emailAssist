"""
Pytest 配置和共享fixtures
Email Assist 项目后端测试配置
"""
import asyncio
import pytest
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from unittest.mock import Mock
import os
import sys

# 添加backend源码目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'src'))

# 测试数据库配置
TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL', 'postgresql://test:test@localhost:5433/email_assist_test')
TEST_REDIS_URL = os.getenv('TEST_REDIS_URL', 'redis://localhost:6380/1')

@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def app():
    """创建FastAPI应用实例"""
    from app import create_app
    
    app = create_app(testing=True)
    return app

@pytest.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """创建测试客户端"""
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        yield client

@pytest.fixture(scope="session")
async def db_session():
    """创建数据库会话"""
    from database import get_database, init_db
    
    # 初始化测试数据库
    await init_db(TEST_DATABASE_URL)
    
    # 获取数据库连接
    db = get_database(TEST_DATABASE_URL)
    
    try:
        yield db
    finally:
        # 清理数据库连接
        await db.close()

@pytest.fixture
async def clean_db(db_session):
    """每个测试前清理数据库"""
    # 清理所有表数据
    tables = ['users', 'emails', 'reports', 'filter_rules', 'workflows']
    
    for table in tables:
        await db_session.execute(f"TRUNCATE TABLE {table} CASCADE")
    
    await db_session.commit()
    yield db_session

@pytest.fixture
def redis_client():
    """创建Redis测试客户端"""
    import redis
    
    client = redis.from_url(TEST_REDIS_URL)
    client.flushdb()  # 清空测试数据库
    
    try:
        yield client
    finally:
        client.flushdb()
        client.close()

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI客户端"""
    mock_client = Mock()
    
    # Mock email analysis response
    mock_client.completions.create.return_value = Mock(
        choices=[Mock(
            message=Mock(
                content='{"sentiment": "neutral", "priority": "medium", "keywords": ["test", "email"]}'
            )
        )]
    )
    
    return mock_client

@pytest.fixture
def mock_email_service():
    """Mock 邮件服务"""
    mock_service = Mock()
    
    mock_service.fetch_emails.return_value = [
        {
            'id': 'test-email-1',
            'from': 'test@example.com',
            'subject': 'Test Email',
            'body': 'This is a test email content',
            'timestamp': '2024-01-15T10:00:00Z'
        }
    ]
    
    mock_service.send_email.return_value = {'message_id': 'test-message-123'}
    
    return mock_service

@pytest.fixture
def sample_user():
    """示例用户数据"""
    return {
        'id': 'user-123',
        'email': 'test@example.com',
        'first_name': 'Test',
        'last_name': 'User',
        'role': 'user',
        'is_active': True
    }

@pytest.fixture
def sample_email():
    """示例邮件数据"""
    return {
        'id': 'email-123',
        'from': 'customer@company.com',
        'to': 'support@email-assist.com',
        'subject': 'Test Support Request',
        'content': 'I need help with setting up my account.',
        'timestamp': '2024-01-15T10:30:00Z',
        'priority': 'medium',
        'sentiment': 'neutral'
    }

@pytest.fixture
def auth_headers(sample_user):
    """认证头部信息"""
    from auth import create_access_token
    
    token = create_access_token(data={'sub': sample_user['email']})
    return {'Authorization': f'Bearer {token}'}

@pytest.fixture
def admin_user():
    """管理员用户数据"""
    return {
        'id': 'admin-123',
        'email': 'admin@email-assist.com',
        'first_name': 'Admin',
        'last_name': 'User',
        'role': 'admin',
        'is_active': True
    }

@pytest.fixture
def admin_headers(admin_user):
    """管理员认证头部"""
    from auth import create_access_token
    
    token = create_access_token(data={'sub': admin_user['email']})
    return {'Authorization': f'Bearer {token}'}

@pytest.fixture
def large_email_sample():
    """大邮件内容样本（用于性能测试）"""
    return {
        'content': 'This is a very long email content. ' * 1000,
        'from': 'performance@test.com',
        'subject': 'Performance Test Email',
        'to': 'support@email-assist.com'
    }

@pytest.fixture(autouse=True)
def mock_external_services(monkeypatch):
    """自动Mock外部服务"""
    # Mock外部API调用
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setenv('REDIS_URL', TEST_REDIS_URL)
    monkeypatch.setenv('DATABASE_URL', TEST_DATABASE_URL)

# 测试标记处理
def pytest_configure(config):
    """配置pytest标记"""
    config.addinivalue_line("markers", "unit: 单元测试")
    config.addinivalue_line("markers", "integration: 集成测试")
    config.addinivalue_line("markers", "slow: 慢速测试")
    config.addinivalue_line("markers", "api: API测试")
    config.addinivalue_line("markers", "database: 数据库测试")
    config.addinivalue_line("markers", "auth: 认证测试")
    config.addinivalue_line("markers", "email: 邮件处理测试")
    config.addinivalue_line("markers", "ai: AI分析测试")
    config.addinivalue_line("markers", "security: 安全测试")
    config.addinivalue_line("markers", "performance: 性能测试")

def pytest_collection_modifyitems(config, items):
    """修改测试收集行为"""
    for item in items:
        # 为slow测试添加标记
        if "slow" in item.keywords:
            item.add_marker(pytest.mark.slow)
        
        # 为数据库测试添加标记
        if "database" in str(item.fspath):
            item.add_marker(pytest.mark.database)
        
        # 为API测试添加标记
        if "api" in str(item.fspath):
            item.add_marker(pytest.mark.api)

# 测试数据清理钩子
@pytest.fixture(autouse=True)
def cleanup_test_data():
    """测试后清理数据"""
    yield
    # 这里可以添加任何需要在测试后清理的逻辑