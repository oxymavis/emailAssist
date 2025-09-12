#!/usr/bin/env python3
"""
Test runner script for Email Assist API testing
"""
import os
import sys
import argparse
import subprocess
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add backend root to Python path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root / 'src'))
sys.path.insert(0, str(backend_root / 'tests'))

from utils.database_setup import setup_test_environment, teardown_test_environment
from utils.mock_services import MockServicesContext
from fixtures.test_data import TestDataGenerator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TestRunner:
    """Test runner with environment management"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.test_root = Path(__file__).parent
        self.backend_root = self.test_root.parent
        
    def setup_environment(self):
        """Setup test environment"""
        logger.info("Setting up test environment...")
        
        try:
            # Setup database and Redis
            self.db_manager, self.redis_manager = setup_test_environment(self.config)
            
            # Generate and seed test data if requested
            if self.config.get('SEED_TEST_DATA', True):
                self.seed_test_data()
            
            logger.info("Test environment setup completed")
            
        except Exception as e:
            logger.error(f"Failed to setup test environment: {e}")
            raise
    
    def teardown_environment(self):
        """Teardown test environment"""
        logger.info("Tearing down test environment...")
        
        try:
            if hasattr(self, 'db_manager') and hasattr(self, 'redis_manager'):
                teardown_test_environment(self.db_manager, self.redis_manager)
            
            logger.info("Test environment teardown completed")
            
        except Exception as e:
            logger.error(f"Failed to teardown test environment: {e}")
    
    def seed_test_data(self):
        """Seed test database with sample data"""
        logger.info("Seeding test data...")
        
        try:
            generator = TestDataGenerator()
            
            # Generate test datasets
            datasets = []
            for i in range(3):  # Create 3 test users with complete datasets
                dataset = generator.generate_complete_user_dataset({
                    "email": f"testuser{i+1}@example.com",
                    "name": f"Test User {i+1}"
                })
                datasets.append(dataset)
            
            # Seed each dataset
            for dataset in datasets:
                self.db_manager.seed_test_data(dataset)
            
            # Seed cache data
            if self.redis_manager.is_available():
                cache_data = {
                    'cache_data': {
                        'api:request_count': '1000',
                        'api:avg_response_time': '150.5',
                        'api:error_rate': '0.02',
                        'test:setup_time': str(int(os.times().elapsed))
                    }
                }
                self.redis_manager.seed_test_cache_data(cache_data)
            
            logger.info(f"Test data seeded: {len(datasets)} user datasets")
            
        except Exception as e:
            logger.error(f"Failed to seed test data: {e}")
            raise
    
    def run_pytest(self, pytest_args: List[str]) -> int:
        """Run pytest with given arguments"""
        cmd = ['pytest'] + pytest_args
        
        logger.info(f"Running: {' '.join(cmd)}")
        
        # Set environment variables for tests
        env = os.environ.copy()
        env.update({
            'PYTHONPATH': f"{self.backend_root / 'src'}:{self.test_root}:{env.get('PYTHONPATH', '')}",
            'TEST_DB_URL': self.config.get('TEST_DB_URL', 'postgresql://test:test@localhost:5432/email_assist_test'),
            'TEST_REDIS_URL': self.config.get('TEST_REDIS_URL', 'redis://localhost:6379/1'),
            'API_BASE_URL': self.config.get('API_BASE_URL', 'http://localhost:3001/api'),
            'NODE_ENV': 'test'
        })
        
        try:
            result = subprocess.run(cmd, cwd=self.test_root, env=env)
            return result.returncode
        except KeyboardInterrupt:
            logger.info("Test run interrupted by user")
            return 130
        except Exception as e:
            logger.error(f"Failed to run pytest: {e}")
            return 1
    
    def generate_test_report(self, output_dir: Optional[str] = None):
        """Generate comprehensive test report"""
        output_dir = output_dir or str(self.test_root / 'reports')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate HTML and JSON reports
        report_args = [
            '--html', os.path.join(output_dir, 'test_report.html'),
            '--self-contained-html',
            '--json-report',
            '--json-report-file', os.path.join(output_dir, 'test_report.json'),
            '--cov-report', f'html:{output_dir}/coverage',
            '--cov-report', f'xml:{output_dir}/coverage.xml'
        ]
        
        return report_args


def get_test_config() -> Dict[str, Any]:
    """Get test configuration from environment"""
    return {
        'DB_HOST': os.getenv('TEST_DB_HOST', 'localhost'),
        'DB_PORT': int(os.getenv('TEST_DB_PORT', '5432')),
        'DB_USER': os.getenv('TEST_DB_USER', 'postgres'),
        'DB_PASSWORD': os.getenv('TEST_DB_PASSWORD', 'password'),
        'TEST_DB_NAME': os.getenv('TEST_DB_NAME', 'email_assist_test'),
        'TEST_DB_URL': os.getenv('TEST_DB_URL', 'postgresql://postgres:password@localhost:5432/email_assist_test'),
        'REDIS_HOST': os.getenv('TEST_REDIS_HOST', 'localhost'),
        'REDIS_PORT': int(os.getenv('TEST_REDIS_PORT', '6379')),
        'REDIS_TEST_DB': int(os.getenv('REDIS_TEST_DB', '1')),
        'TEST_REDIS_URL': os.getenv('TEST_REDIS_URL', 'redis://localhost:6379/1'),
        'API_BASE_URL': os.getenv('API_BASE_URL', 'http://localhost:3001/api'),
        'SEED_TEST_DATA': os.getenv('SEED_TEST_DATA', 'true').lower() == 'true',
        'USE_MOCK_SERVICES': os.getenv('USE_MOCK_SERVICES', 'true').lower() == 'true'
    }


def main():
    """Main test runner entry point"""
    parser = argparse.ArgumentParser(description='Email Assist API Test Runner')
    
    # Test selection arguments
    parser.add_argument('tests', nargs='*', help='Specific tests to run (default: all tests)')
    parser.add_argument('-m', '--marker', help='Run tests with specific marker')
    parser.add_argument('-k', '--keyword', help='Run tests matching keyword expression')
    
    # Test execution arguments
    parser.add_argument('-v', '--verbose', action='count', default=0, help='Increase verbosity')
    parser.add_argument('-s', '--capture', action='store_true', help='Disable output capture')
    parser.add_argument('-x', '--exitfirst', action='store_true', help='Stop on first failure')
    parser.add_argument('--maxfail', type=int, help='Stop after N failures')
    parser.add_argument('-n', '--workers', type=int, help='Run tests in parallel')
    
    # Coverage arguments
    parser.add_argument('--no-cov', action='store_true', help='Disable coverage reporting')
    parser.add_argument('--cov-fail-under', type=int, help='Fail if coverage is below threshold')
    
    # Environment arguments
    parser.add_argument('--no-setup', action='store_true', help='Skip environment setup')
    parser.add_argument('--no-teardown', action='store_true', help='Skip environment teardown')
    parser.add_argument('--no-mock', action='store_true', help='Disable mock services')
    parser.add_argument('--no-seed', action='store_true', help='Skip test data seeding')
    
    # Report arguments
    parser.add_argument('--report-dir', help='Directory for test reports')
    parser.add_argument('--no-report', action='store_true', help='Skip HTML report generation')
    
    # Test categories
    parser.add_argument('--unit', action='store_true', help='Run only unit tests')
    parser.add_argument('--integration', action='store_true', help='Run only integration tests')
    parser.add_argument('--performance', action='store_true', help='Run only performance tests')
    parser.add_argument('--security', action='store_true', help='Run only security tests')
    parser.add_argument('--smoke', action='store_true', help='Run smoke tests')
    
    args = parser.parse_args()
    
    # Get configuration
    config = get_test_config()
    
    # Override config from arguments
    if args.no_seed:
        config['SEED_TEST_DATA'] = False
    if args.no_mock:
        config['USE_MOCK_SERVICES'] = False
    
    # Initialize test runner
    runner = TestRunner(config)
    
    # Build pytest arguments
    pytest_args = []
    
    # Add verbosity
    if args.verbose >= 2:
        pytest_args.append('-vv')
    elif args.verbose >= 1:
        pytest_args.append('-v')
    
    # Add test execution options
    if args.capture:
        pytest_args.append('-s')
    if args.exitfirst:
        pytest_args.append('-x')
    if args.maxfail:
        pytest_args.extend(['--maxfail', str(args.maxfail)])
    if args.workers:
        pytest_args.extend(['-n', str(args.workers)])
    
    # Add markers and keywords
    if args.marker:
        pytest_args.extend(['-m', args.marker])
    if args.keyword:
        pytest_args.extend(['-k', args.keyword])
    
    # Add test categories
    category_markers = []
    if args.unit:
        category_markers.append('unit')
    if args.integration:
        category_markers.append('integration')
    if args.performance:
        category_markers.append('performance')
    if args.security:
        category_markers.append('security')
    if args.smoke:
        category_markers.append('smoke')
    
    if category_markers:
        pytest_args.extend(['-m', ' or '.join(category_markers)])
    
    # Add coverage options
    if not args.no_cov:
        if args.cov_fail_under:
            pytest_args.extend(['--cov-fail-under', str(args.cov_fail_under)])
    else:
        pytest_args.append('--no-cov')
    
    # Add report generation
    if not args.no_report:
        report_args = runner.generate_test_report(args.report_dir)
        pytest_args.extend(report_args)
    
    # Add specific tests
    if args.tests:
        pytest_args.extend(args.tests)
    
    exit_code = 0
    
    try:
        # Setup environment
        if not args.no_setup:
            runner.setup_environment()
        
        # Run tests with mock services if enabled
        if config['USE_MOCK_SERVICES'] and not args.no_mock:
            logger.info("Running tests with mock services enabled")
            with MockServicesContext():
                exit_code = runner.run_pytest(pytest_args)
        else:
            logger.info("Running tests with live services")
            exit_code = runner.run_pytest(pytest_args)
        
    except KeyboardInterrupt:
        logger.info("Test run interrupted by user")
        exit_code = 130
    except Exception as e:
        logger.error(f"Test run failed: {e}")
        exit_code = 1
    finally:
        # Teardown environment
        if not args.no_teardown:
            try:
                runner.teardown_environment()
            except Exception as e:
                logger.error(f"Teardown failed: {e}")
    
    # Print summary
    if exit_code == 0:
        logger.info("✅ All tests passed!")
    else:
        logger.error(f"❌ Tests failed with exit code: {exit_code}")
    
    if not args.no_report and not args.report_dir:
        reports_dir = Path(__file__).parent / 'reports'
        if reports_dir.exists():
            logger.info(f"📊 Test reports generated in: {reports_dir}")
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()