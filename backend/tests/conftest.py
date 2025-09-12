"""
Pytest configuration and fixtures for Email Assist API testing
"""
import os
import sys
import asyncio
import json
import pytest
from typing import Dict, Any, AsyncGenerator, Generator
from unittest.mock import patch, MagicMock

# Add backend src to Python path
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_path = os.path.join(backend_root, 'src')
sys.path.insert(0, src_path)

import requests
from datetime import datetime, timedelta
from faker import Faker
import jwt
from psycopg2 import sql
import redis
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Test configuration
TEST_CONFIG = {
    'API_BASE_URL': 'http://localhost:3001/api',
    'TEST_DB_URL': 'postgresql://test:test@localhost:5432/email_assist_test',
    'TEST_REDIS_URL': 'redis://localhost:6379/1',
    'JWT_SECRET': 'test-jwt-secret-key-for-testing-only',
    'JWT_ALGORITHM': 'HS256',
    'JWT_EXPIRATION_HOURS': 24,
    'TEST_TIMEOUT': 30,
    'MOCK_EXTERNAL_SERVICES': True,
    'LOG_LEVEL': 'INFO'
}

fake = Faker()

class TestConfig:
    """Test configuration class"""
    
    @staticmethod
    def get(key: str, default=None):
        return TEST_CONFIG.get(key, default)
    
    @staticmethod
    def update(config: Dict[str, Any]):
        TEST_CONFIG.update(config)

@pytest.fixture(scope='session')
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope='session')
def test_config():
    """Test configuration fixture"""
    return TestConfig

@pytest.fixture(scope='session')
def api_base_url():
    """API base URL fixture"""
    return TEST_CONFIG['API_BASE_URL']

# Database fixtures
@pytest.fixture(scope='session')
def database_url():
    """Test database URL fixture"""
    return TEST_CONFIG['TEST_DB_URL']

@pytest.fixture(scope='session')
def db_engine(database_url):
    """Create test database engine"""
    engine = create_engine(database_url, echo=False)
    yield engine
    engine.dispose()

@pytest.fixture(scope='function')
def db_session(db_engine):
    """Create a database session for testing"""
    connection = db_engine.connect()
    transaction = connection.begin()
    
    Session = sessionmaker(bind=connection)
    session = Session()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope='function')
def clean_database(db_session):
    """Clean database before each test"""
    # Clean all test data
    tables_to_clean = [
        'email_messages',
        'email_analysis',
        'filter_rules',
        'reports',
        'report_schedules',
        'users',
        'user_sessions'
    ]
    
    for table in tables_to_clean:
        try:
            db_session.execute(text(f'TRUNCATE TABLE {table} CASCADE'))
            db_session.commit()
        except Exception as e:
            db_session.rollback()
            print(f"Warning: Could not clean table {table}: {e}")
    
    yield db_session

# Redis fixtures
@pytest.fixture(scope='session')
def redis_url():
    """Test Redis URL fixture"""
    return TEST_CONFIG['TEST_REDIS_URL']

@pytest.fixture(scope='function')
def redis_client(redis_url):
    """Create Redis client for testing"""
    client = redis.from_url(redis_url, decode_responses=True)
    yield client
    # Clean up Redis after each test
    client.flushdb()
    client.close()

# Authentication fixtures
@pytest.fixture
def jwt_secret():
    """JWT secret key fixture"""
    return TEST_CONFIG['JWT_SECRET']

@pytest.fixture
def jwt_algorithm():
    """JWT algorithm fixture"""
    return TEST_CONFIG['JWT_ALGORITHM']

def create_jwt_token(user_data: Dict[str, Any], 
                    secret: str = TEST_CONFIG['JWT_SECRET'],
                    algorithm: str = TEST_CONFIG['JWT_ALGORITHM'],
                    expires_in_hours: int = TEST_CONFIG['JWT_EXPIRATION_HOURS']) -> str:
    """Create a JWT token for testing"""
    payload = {
        'user_id': user_data.get('id'),
        'email': user_data.get('email'),
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=expires_in_hours)
    }
    
    return jwt.encode(payload, secret, algorithm=algorithm)

@pytest.fixture
def test_user():
    """Create test user data"""
    return {
        'id': fake.uuid4(),
        'email': fake.email(),
        'name': fake.name(),
        'password': 'TestPassword123!',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }

@pytest.fixture
def test_user_token(test_user):
    """Create JWT token for test user"""
    return create_jwt_token(test_user)

@pytest.fixture
def auth_headers(test_user_token):
    """Create authorization headers with JWT token"""
    return {'Authorization': f'Bearer {test_user_token}'}

@pytest.fixture
def multiple_test_users():
    """Create multiple test users"""
    return [
        {
            'id': fake.uuid4(),
            'email': fake.email(),
            'name': fake.name(),
            'password': 'TestPassword123!'
        }
        for _ in range(3)
    ]

# Email test data fixtures
@pytest.fixture
def test_email():
    """Create test email data"""
    return {
        'id': fake.uuid4(),
        'subject': fake.sentence(),
        'from': fake.email(),
        'to': fake.email(),
        'content': fake.text(max_nb_chars=1000),
        'date': fake.date_time_this_year(),
        'is_read': False,
        'labels': [fake.word() for _ in range(3)]
    }

@pytest.fixture
def multiple_test_emails():
    """Create multiple test emails"""
    return [
        {
            'id': fake.uuid4(),
            'subject': fake.sentence(),
            'from': fake.email(),
            'to': fake.email(),
            'content': fake.text(max_nb_chars=500),
            'date': fake.date_time_this_year(),
            'is_read': fake.boolean(),
            'labels': [fake.word() for _ in range(fake.random_int(1, 3))]
        }
        for _ in range(10)
    ]

@pytest.fixture
def test_filter_rule():
    """Create test filter rule"""
    return {
        'id': fake.uuid4(),
        'name': fake.words(2, unique=True),
        'description': fake.sentence(),
        'conditions': [
            {
                'field': 'subject',
                'operator': 'contains',
                'value': fake.word()
            }
        ],
        'actions': [
            {
                'type': 'move_to_folder',
                'target': 'filtered'
            }
        ],
        'priority': fake.random_int(1, 10),
        'active': True
    }

# API client fixtures
@pytest.fixture
def api_client():
    """HTTP client for API testing"""
    session = requests.Session()
    session.headers.update({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    })
    return session

@pytest.fixture
def authenticated_api_client(api_client, auth_headers):
    """Authenticated HTTP client for API testing"""
    api_client.headers.update(auth_headers)
    return api_client

# Mock fixtures for external services
@pytest.fixture
def mock_microsoft_graph():
    """Mock Microsoft Graph API"""
    with patch('services.MicrosoftGraphService') as mock_service:
        mock_instance = MagicMock()
        
        # Mock authentication
        mock_instance.get_auth_url.return_value = 'https://login.microsoftonline.com/oauth2/authorize?...'
        mock_instance.get_access_token.return_value = {
            'access_token': 'fake_access_token',
            'refresh_token': 'fake_refresh_token',
            'expires_in': 3600
        }
        
        # Mock user info
        mock_instance.get_user_info.return_value = {
            'id': fake.uuid4(),
            'displayName': fake.name(),
            'mail': fake.email()
        }
        
        # Mock email fetching
        mock_instance.get_messages.return_value = {
            'value': [
                {
                    'id': fake.uuid4(),
                    'subject': fake.sentence(),
                    'from': {'emailAddress': {'address': fake.email()}},
                    'receivedDateTime': fake.iso8601(),
                    'bodyPreview': fake.text(max_nb_chars=200)
                }
                for _ in range(5)
            ]
        }
        
        mock_service.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_openai():
    """Mock OpenAI API"""
    with patch('openai.ChatCompletion.create') as mock_create:
        mock_create.return_value = {
            'choices': [
                {
                    'message': {
                        'content': json.dumps({
                            'sentiment': fake.random_element(['positive', 'negative', 'neutral']),
                            'confidence': fake.random.uniform(0.7, 1.0),
                            'priority': fake.random_element(['high', 'medium', 'low']),
                            'category': fake.random_element(['work', 'personal', 'spam', 'promotional']),
                            'keywords': [fake.word() for _ in range(3)]
                        })
                    }
                }
            ]
        }
        yield mock_create

@pytest.fixture
def mock_smtp():
    """Mock SMTP service"""
    with patch('smtplib.SMTP') as mock_smtp:
        mock_instance = MagicMock()
        mock_smtp.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_imap():
    """Mock IMAP service"""
    with patch('imaplib.IMAP4_SSL') as mock_imap:
        mock_instance = MagicMock()
        mock_imap.return_value = mock_instance
        yield mock_instance

# Test data seeding fixtures
@pytest.fixture
def seed_test_users(clean_database, multiple_test_users):
    """Seed test users in database"""
    for user in multiple_test_users:
        clean_database.execute(
            text("""
                INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
                VALUES (:id, :email, :name, :password, :created_at, :updated_at)
            """),
            {
                **user,
                'password': 'hashed_password_placeholder',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        )
    clean_database.commit()
    return multiple_test_users

@pytest.fixture
def seed_test_emails(clean_database, test_user, multiple_test_emails):
    """Seed test emails in database"""
    for email in multiple_test_emails:
        clean_database.execute(
            text("""
                INSERT INTO email_messages (id, user_id, subject, from_email, to_email, 
                                          content, received_date, is_read, labels)
                VALUES (:id, :user_id, :subject, :from_email, :to_email, 
                        :content, :received_date, :is_read, :labels)
            """),
            {
                **email,
                'user_id': test_user['id'],
                'from_email': email['from'],
                'to_email': email['to'],
                'received_date': email['date'],
                'labels': json.dumps(email['labels'])
            }
        )
    clean_database.commit()
    return multiple_test_emails

# Performance testing fixtures
@pytest.fixture
def performance_config():
    """Configuration for performance tests"""
    return {
        'concurrent_users': 10,
        'requests_per_user': 5,
        'ramp_up_time': 5,
        'test_duration': 30,
        'acceptable_response_time': 2.0,
        'acceptable_error_rate': 0.05
    }

# Utility fixtures
@pytest.fixture
def test_utils():
    """Test utility functions"""
    class TestUtils:
        @staticmethod
        def wait_for_async_task(timeout: int = 10):
            """Wait for async task completion"""
            import time
            time.sleep(timeout)
        
        @staticmethod
        def generate_large_dataset(size: int = 1000):
            """Generate large dataset for performance testing"""
            return [
                {
                    'id': fake.uuid4(),
                    'data': fake.text(max_nb_chars=1000)
                }
                for _ in range(size)
            ]
        
        @staticmethod
        def assert_response_structure(response: dict, expected_keys: list):
            """Assert response has expected structure"""
            for key in expected_keys:
                assert key in response, f"Expected key '{key}' not found in response"
        
        @staticmethod
        def assert_error_response(response: dict, error_code: str = None):
            """Assert response is error format"""
            assert 'success' in response
            assert response['success'] is False
            assert 'error' in response
            if error_code:
                assert response.get('error', {}).get('code') == error_code
    
    return TestUtils

# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_after_test():
    """Cleanup after each test"""
    yield
    # Cleanup any test files, temporary data, etc.
    pass

# Session-level cleanup
@pytest.fixture(scope='session', autouse=True)
def cleanup_after_session():
    """Cleanup after test session"""
    yield
    # Final cleanup
    pass

# Pytest hooks
def pytest_configure(config):
    """Pytest configuration hook"""
    # Create reports directory
    reports_dir = os.path.join(os.path.dirname(__file__), 'reports')
    os.makedirs(reports_dir, exist_ok=True)

def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    # Add slow marker to tests that might take long
    for item in items:
        if 'performance' in item.keywords or 'load' in item.keywords:
            item.add_marker(pytest.mark.slow)

def pytest_runtest_setup(item):
    """Setup before each test"""
    # Skip external service tests if not configured
    if 'external' in item.keywords and TEST_CONFIG.get('MOCK_EXTERNAL_SERVICES', True):
        pytest.skip('External service tests are disabled')

# Test result reporting
@pytest.hookimpl(tryfirst=True)
def pytest_runtest_makereport(item, call):
    """Custom test result reporting"""
    if call.when == 'call':
        if hasattr(item, 'rep_call'):
            return
        item.rep_call = call