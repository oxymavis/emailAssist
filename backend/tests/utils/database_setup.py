"""
Database setup and management utilities for testing
"""
import os
import sys
import time
import logging
from typing import Optional, Dict, Any
from contextlib import contextmanager

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import redis

# Add backend src to Python path
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src_path = os.path.join(backend_root, 'src')
sys.path.insert(0, src_path)

logger = logging.getLogger(__name__)


class TestDatabaseManager:
    """Manage test database lifecycle"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.test_db_name = config.get('TEST_DB_NAME', 'email_assist_test')
        self.main_db_config = {
            'host': config.get('DB_HOST', 'localhost'),
            'port': config.get('DB_PORT', 5432),
            'user': config.get('DB_USER', 'postgres'),
            'password': config.get('DB_PASSWORD', 'password'),
        }
        self.test_db_config = {
            **self.main_db_config,
            'database': self.test_db_name
        }
        
    def create_test_database(self):
        """Create test database if it doesn't exist"""
        try:
            # Connect to default postgres database to create test database
            conn = psycopg2.connect(
                host=self.main_db_config['host'],
                port=self.main_db_config['port'],
                user=self.main_db_config['user'],
                password=self.main_db_config['password'],
                database='postgres'
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn.cursor() as cur:
                # Check if test database exists
                cur.execute(
                    "SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s",
                    (self.test_db_name,)
                )
                
                if not cur.fetchone():
                    # Create test database
                    cur.execute(
                        sql.SQL("CREATE DATABASE {}").format(
                            sql.Identifier(self.test_db_name)
                        )
                    )
                    logger.info(f"Created test database: {self.test_db_name}")
                else:
                    logger.info(f"Test database {self.test_db_name} already exists")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to create test database: {e}")
            raise
    
    def drop_test_database(self):
        """Drop test database"""
        try:
            # Connect to default postgres database
            conn = psycopg2.connect(
                host=self.main_db_config['host'],
                port=self.main_db_config['port'],
                user=self.main_db_config['user'],
                password=self.main_db_config['password'],
                database='postgres'
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn.cursor() as cur:
                # Terminate active connections to test database
                cur.execute("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = %s AND pid <> pg_backend_pid()
                """, (self.test_db_name,))
                
                # Drop test database
                cur.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        sql.Identifier(self.test_db_name)
                    )
                )
                logger.info(f"Dropped test database: {self.test_db_name}")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to drop test database: {e}")
            raise
    
    def setup_test_schema(self):
        """Setup test database schema"""
        try:
            conn = psycopg2.connect(**self.test_db_config)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn.cursor() as cur:
                # Create basic tables for testing
                self._create_users_table(cur)
                self._create_emails_table(cur)
                self._create_filter_rules_table(cur)
                self._create_reports_table(cur)
                self._create_analysis_table(cur)
                self._create_scheduled_reports_table(cur)
                self._create_system_metrics_table(cur)
            
            conn.close()
            logger.info("Test database schema created successfully")
            
        except Exception as e:
            logger.error(f"Failed to setup test schema: {e}")
            raise
    
    def _create_users_table(self, cursor):
        """Create users table"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)")
    
    def _create_emails_table(self, cursor):
        """Create email_messages table"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_messages (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subject TEXT,
                from_email VARCHAR(255) NOT NULL,
                to_email VARCHAR(255) NOT NULL,
                cc_emails TEXT[],
                bcc_emails TEXT[],
                content TEXT,
                html_content TEXT,
                received_date TIMESTAMP NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                is_starred BOOLEAN DEFAULT FALSE,
                is_archived BOOLEAN DEFAULT FALSE,
                folder VARCHAR(50) DEFAULT 'inbox',
                labels TEXT[],
                attachments JSONB,
                priority VARCHAR(20) DEFAULT 'medium',
                category VARCHAR(50),
                thread_id VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_emails_user_id ON email_messages(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_emails_received_date ON email_messages(received_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_emails_folder ON email_messages(folder)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_emails_is_read ON email_messages(is_read)")
    
    def _create_filter_rules_table(self, cursor):
        """Create filter_rules table"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS filter_rules (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                conditions JSONB NOT NULL,
                actions JSONB NOT NULL,
                priority INTEGER DEFAULT 1,
                active BOOLEAN DEFAULT TRUE,
                logic VARCHAR(10) DEFAULT 'AND',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_executed TIMESTAMP,
                execution_count INTEGER DEFAULT 0,
                match_count INTEGER DEFAULT 0
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_user_id ON filter_rules(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_active ON filter_rules(active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_priority ON filter_rules(priority)")
    
    def _create_reports_table(self, cursor):
        """Create reports related tables"""
        # Report templates
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_templates (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                type VARCHAR(50) NOT NULL,
                sections TEXT[] NOT NULL,
                format VARCHAR(20) NOT NULL,
                filters JSONB,
                chart_types JSONB,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Generated reports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                template_id VARCHAR(36) REFERENCES report_templates(id) ON DELETE SET NULL,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                date_range JSONB,
                filters_applied JSONB,
                report_data JSONB,
                file_path VARCHAR(500),
                file_size BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_report_templates_user_id ON report_templates(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)")
    
    def _create_analysis_table(self, cursor):
        """Create email_analysis table"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_analysis (
                id VARCHAR(36) PRIMARY KEY,
                email_id VARCHAR(36) NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
                sentiment JSONB,
                priority JSONB,
                category JSONB,
                keywords JSONB,
                entities JSONB,
                language VARCHAR(10) DEFAULT 'en',
                processing_time FLOAT,
                model_version VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_email_id ON email_analysis(email_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON email_analysis(created_at)")
    
    def _create_scheduled_reports_table(self, cursor):
        """Create report_schedules table"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_schedules (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                template_id VARCHAR(36) NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                schedule VARCHAR(100) NOT NULL,
                timezone VARCHAR(50) DEFAULT 'UTC',
                recipients TEXT[] NOT NULL,
                last_executed TIMESTAMP,
                next_execution TIMESTAMP,
                execution_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_report_schedules_user_id ON report_schedules(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_report_schedules_next_execution ON report_schedules(next_execution)")
    
    def _create_system_metrics_table(self, cursor):
        """Create system_metrics table for monitoring"""
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                metric_type VARCHAR(50) NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                metric_value FLOAT NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_metrics_type_name ON system_metrics(metric_type, metric_name)")
    
    def clean_test_database(self):
        """Clean all test data from database"""
        try:
            conn = psycopg2.connect(**self.test_db_config)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn.cursor() as cur:
                # Get all table names
                cur.execute("""
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public'
                """)
                
                tables = [row[0] for row in cur.fetchall()]
                
                # Disable foreign key checks and truncate all tables
                cur.execute("SET session_replication_role = replica")
                
                for table in tables:
                    cur.execute(f"TRUNCATE TABLE {table} CASCADE")
                
                cur.execute("SET session_replication_role = DEFAULT")
            
            conn.close()
            logger.info("Test database cleaned successfully")
            
        except Exception as e:
            logger.error(f"Failed to clean test database: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Get database connection context manager"""
        conn = None
        try:
            conn = psycopg2.connect(**self.test_db_config)
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def seed_test_data(self, test_data: Dict[str, Any]):
        """Seed database with test data"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Insert users
                    if 'users' in test_data:
                        self._insert_users(cur, test_data['users'])
                    
                    # Insert emails
                    if 'emails' in test_data:
                        self._insert_emails(cur, test_data['emails'])
                    
                    # Insert filter rules
                    if 'rules' in test_data:
                        self._insert_rules(cur, test_data['rules'])
                    
                    # Insert report templates
                    if 'templates' in test_data:
                        self._insert_templates(cur, test_data['templates'])
                    
                    # Insert reports
                    if 'reports' in test_data:
                        self._insert_reports(cur, test_data['reports'])
                    
                    # Insert analysis results
                    if 'analysis_results' in test_data:
                        self._insert_analysis(cur, test_data['analysis_results'])
                
                conn.commit()
                logger.info("Test data seeded successfully")
                
        except Exception as e:
            logger.error(f"Failed to seed test data: {e}")
            raise
    
    def _insert_users(self, cursor, users):
        """Insert users into database"""
        for user in users:
            cursor.execute("""
                INSERT INTO users (id, email, name, password_hash, is_active, email_verified, created_at, updated_at, last_login)
                VALUES (%(id)s, %(email)s, %(name)s, %(password)s, %(is_active)s, %(email_verified)s, %(created_at)s, %(updated_at)s, %(last_login)s)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    updated_at = EXCLUDED.updated_at
            """, {
                **user,
                'password': 'hashed_test_password_placeholder',
                'is_active': user.get('is_active', True),
                'email_verified': user.get('email_verified', True),
                'last_login': user.get('last_login')
            })
    
    def _insert_emails(self, cursor, emails):
        """Insert emails into database"""
        for email in emails:
            cursor.execute("""
                INSERT INTO email_messages (
                    id, user_id, subject, from_email, to_email, cc_emails, bcc_emails,
                    content, html_content, received_date, is_read, is_starred, is_archived,
                    folder, labels, attachments, priority, category, thread_id, created_at, updated_at
                ) VALUES (
                    %(id)s, %(user_id)s, %(subject)s, %(from)s, %(to)s, %(cc)s, %(bcc)s,
                    %(content)s, %(html_content)s, %(received_date)s, %(is_read)s, %(is_starred)s, %(is_archived)s,
                    %(folder)s, %(labels)s, %(attachments)s, %(priority)s, %(category)s, %(thread_id)s, %(created_at)s, %(updated_at)s
                )
                ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            """, {
                **email,
                'from': email.get('from'),
                'to': email.get('to'),
                'cc': email.get('cc', []),
                'bcc': email.get('bcc', []),
                'attachments': psycopg2.extras.Json(email.get('attachments', []))
            })
    
    def _insert_rules(self, cursor, rules):
        """Insert filter rules into database"""
        for rule in rules:
            cursor.execute("""
                INSERT INTO filter_rules (
                    id, user_id, name, description, conditions, actions, priority, 
                    active, logic, created_at, updated_at, last_executed, execution_count, match_count
                ) VALUES (
                    %(id)s, %(user_id)s, %(name)s, %(description)s, %(conditions)s, %(actions)s, %(priority)s,
                    %(active)s, %(logic)s, %(created_at)s, %(updated_at)s, %(last_executed)s, %(execution_count)s, %(match_count)s
                )
                ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            """, {
                **rule,
                'conditions': psycopg2.extras.Json(rule['conditions']),
                'actions': psycopg2.extras.Json(rule['actions'])
            })
    
    def _insert_templates(self, cursor, templates):
        """Insert report templates into database"""
        for template in templates:
            cursor.execute("""
                INSERT INTO report_templates (
                    id, user_id, name, description, type, sections, format, 
                    filters, chart_types, active, created_at, updated_at
                ) VALUES (
                    %(id)s, %(user_id)s, %(name)s, %(description)s, %(type)s, %(sections)s, %(format)s,
                    %(filters)s, %(chart_types)s, %(active)s, %(created_at)s, %(updated_at)s
                )
                ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            """, {
                **template,
                'filters': psycopg2.extras.Json(template.get('filters', {})),
                'chart_types': psycopg2.extras.Json(template.get('chart_types', {}))
            })
    
    def _insert_reports(self, cursor, reports):
        """Insert reports into database"""
        for report in reports:
            cursor.execute("""
                INSERT INTO reports (
                    id, user_id, template_id, name, status, progress, date_range,
                    filters_applied, report_data, file_path, file_size, created_at, updated_at, completed_at
                ) VALUES (
                    %(id)s, %(user_id)s, %(template_id)s, %(name)s, %(status)s, %(progress)s, %(date_range)s,
                    %(filters_applied)s, %(report_data)s, %(file_path)s, %(file_size)s, %(created_at)s, %(updated_at)s, %(completed_at)s
                )
                ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            """, {
                **report,
                'date_range': psycopg2.extras.Json(report.get('date_range', {})),
                'filters_applied': psycopg2.extras.Json(report.get('filters_applied', {})),
                'report_data': psycopg2.extras.Json(report.get('report_data', {}))
            })
    
    def _insert_analysis(self, cursor, analysis_results):
        """Insert analysis results into database"""
        for analysis in analysis_results:
            cursor.execute("""
                INSERT INTO email_analysis (
                    id, email_id, sentiment, priority, category, keywords, entities,
                    language, processing_time, model_version, created_at
                ) VALUES (
                    %(id)s, %(email_id)s, %(sentiment)s, %(priority)s, %(category)s, %(keywords)s, %(entities)s,
                    %(language)s, %(processing_time)s, %(model_version)s, %(created_at)s
                )
                ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at
            """, {
                **analysis,
                'sentiment': psycopg2.extras.Json(analysis.get('sentiment', {})),
                'priority': psycopg2.extras.Json(analysis.get('priority', {})),
                'category': psycopg2.extras.Json(analysis.get('category', {})),
                'keywords': psycopg2.extras.Json(analysis.get('keywords', [])),
                'entities': psycopg2.extras.Json(analysis.get('entities', []))
            })


class TestRedisManager:
    """Manage test Redis instance"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.redis_config = {
            'host': config.get('REDIS_HOST', 'localhost'),
            'port': config.get('REDIS_PORT', 6379),
            'db': config.get('REDIS_TEST_DB', 1),  # Use DB 1 for testing
            'decode_responses': True
        }
    
    def get_client(self) -> redis.Redis:
        """Get Redis client"""
        return redis.Redis(**self.redis_config)
    
    def clear_test_data(self):
        """Clear all test data from Redis"""
        try:
            client = self.get_client()
            client.flushdb()
            logger.info("Test Redis data cleared successfully")
        except Exception as e:
            logger.error(f"Failed to clear test Redis data: {e}")
            raise
    
    def is_available(self) -> bool:
        """Check if Redis is available"""
        try:
            client = self.get_client()
            client.ping()
            return True
        except Exception:
            return False
    
    def seed_test_cache_data(self, test_data: Dict[str, Any]):
        """Seed Redis with test cache data"""
        try:
            client = self.get_client()
            
            # Cache some test data
            if 'cache_data' in test_data:
                for key, value in test_data['cache_data'].items():
                    if isinstance(value, dict):
                        client.hmset(key, value)
                    else:
                        client.set(key, value)
            
            # Set some performance metrics
            client.set('api:request_count', 1000)
            client.set('api:avg_response_time', 150.5)
            client.set('api:error_rate', 0.02)
            
            logger.info("Test cache data seeded successfully")
            
        except Exception as e:
            logger.error(f"Failed to seed test cache data: {e}")
            raise


def setup_test_environment(config: Dict[str, Any]):
    """Setup complete test environment"""
    logger.info("Setting up test environment...")
    
    # Setup database
    db_manager = TestDatabaseManager(config)
    db_manager.create_test_database()
    db_manager.setup_test_schema()
    
    # Setup Redis
    redis_manager = TestRedisManager(config)
    if redis_manager.is_available():
        redis_manager.clear_test_data()
        logger.info("Test environment setup completed successfully")
    else:
        logger.warning("Redis not available - cache-related tests may fail")
    
    return db_manager, redis_manager


def teardown_test_environment(db_manager: TestDatabaseManager, redis_manager: TestRedisManager):
    """Teardown test environment"""
    logger.info("Tearing down test environment...")
    
    try:
        # Clean database
        db_manager.clean_test_database()
        
        # Clean Redis
        if redis_manager.is_available():
            redis_manager.clear_test_data()
        
        logger.info("Test environment teardown completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to teardown test environment: {e}")


if __name__ == "__main__":
    # Example usage
    import json
    from fixtures.test_data import TestDataGenerator
    
    # Test configuration
    config = {
        'DB_HOST': 'localhost',
        'DB_PORT': 5432,
        'DB_USER': 'postgres',
        'DB_PASSWORD': 'password',
        'TEST_DB_NAME': 'email_assist_test',
        'REDIS_HOST': 'localhost',
        'REDIS_PORT': 6379,
        'REDIS_TEST_DB': 1
    }
    
    # Setup test environment
    db_manager, redis_manager = setup_test_environment(config)
    
    # Generate and seed test data
    generator = TestDataGenerator()
    test_dataset = generator.generate_complete_user_dataset({
        "email": "test@example.com",
        "name": "Test User"
    })
    
    db_manager.seed_test_data(test_dataset)
    redis_manager.seed_test_cache_data({'cache_data': {'test:key': 'test_value'}})
    
    print("Test environment setup completed!")
    print(f"Test database: {db_manager.test_db_name}")
    print(f"Redis DB: {redis_manager.redis_config['db']}")
    print("Use teardown_test_environment() to clean up when done.")