#!/usr/bin/env python3
"""
Validate test setup and dependencies
"""
import sys
import os
import subprocess
import importlib
from pathlib import Path
from typing import Dict, List, Tuple, Any

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(message: str):
    print(f"{GREEN}✅ {message}{RESET}")

def print_error(message: str):
    print(f"{RED}❌ {message}{RESET}")

def print_warning(message: str):
    print(f"{YELLOW}⚠️  {message}{RESET}")

def print_info(message: str):
    print(f"{BLUE}ℹ️  {message}{RESET}")


class TestSetupValidator:
    """Validate test environment setup"""
    
    def __init__(self):
        self.test_root = Path(__file__).parent
        self.backend_root = self.test_root.parent
        self.errors = []
        self.warnings = []
        
    def validate_python_version(self) -> bool:
        """Validate Python version"""
        print_info("Checking Python version...")
        
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 8):
            self.errors.append(f"Python 3.8+ required, found {version.major}.{version.minor}")
            return False
        
        print_success(f"Python version: {version.major}.{version.minor}.{version.micro}")
        return True
    
    def validate_required_packages(self) -> bool:
        """Validate required Python packages"""
        print_info("Checking required packages...")
        
        required_packages = [
            'pytest', 'requests', 'psycopg2', 'redis', 'faker', 
            'responses', 'pydantic', 'pyjwt'
        ]
        
        missing_packages = []
        
        for package in required_packages:
            try:
                importlib.import_module(package)
                print_success(f"Package {package} is available")
            except ImportError:
                missing_packages.append(package)
                print_error(f"Package {package} is missing")
        
        if missing_packages:
            self.errors.append(f"Missing packages: {', '.join(missing_packages)}")
            print_info("Install missing packages with: pip install -r requirements.txt")
            return False
        
        return True
    
    def validate_database_connection(self) -> bool:
        """Validate database connection"""
        print_info("Checking database connection...")
        
        try:
            import psycopg2
            
            # Try to connect to default postgres database
            conn_params = {
                'host': os.getenv('TEST_DB_HOST', 'localhost'),
                'port': int(os.getenv('TEST_DB_PORT', '5432')),
                'user': os.getenv('TEST_DB_USER', 'postgres'),
                'password': os.getenv('TEST_DB_PASSWORD', 'password'),
                'database': 'postgres'
            }
            
            conn = psycopg2.connect(**conn_params)
            conn.close()
            
            print_success(f"Database connection successful ({conn_params['host']}:{conn_params['port']})")
            return True
            
        except Exception as e:
            self.errors.append(f"Database connection failed: {e}")
            print_error(f"Database connection failed: {e}")
            print_info("Make sure PostgreSQL is running and credentials are correct")
            return False
    
    def validate_redis_connection(self) -> bool:
        """Validate Redis connection"""
        print_info("Checking Redis connection...")
        
        try:
            import redis
            
            redis_params = {
                'host': os.getenv('TEST_REDIS_HOST', 'localhost'),
                'port': int(os.getenv('TEST_REDIS_PORT', '6379')),
                'db': int(os.getenv('REDIS_TEST_DB', '1')),
                'decode_responses': True
            }
            
            client = redis.Redis(**redis_params)
            client.ping()
            client.close()
            
            print_success(f"Redis connection successful ({redis_params['host']}:{redis_params['port']})")
            return True
            
        except Exception as e:
            self.warnings.append(f"Redis connection failed: {e}")
            print_warning(f"Redis connection failed: {e}")
            print_info("Redis is optional but recommended for cache-related tests")
            return False
    
    def validate_api_server(self) -> bool:
        """Validate API server accessibility"""
        print_info("Checking API server...")
        
        try:
            import requests
            
            api_base_url = os.getenv('API_BASE_URL', 'http://localhost:3001/api')
            
            # Try health check endpoint
            response = requests.get(f"{api_base_url}/../health", timeout=5)
            
            if response.status_code == 200:
                print_success(f"API server is accessible at {api_base_url}")
                return True
            else:
                self.warnings.append(f"API server returned {response.status_code}")
                print_warning(f"API server returned {response.status_code}")
                return False
                
        except Exception as e:
            self.warnings.append(f"API server not accessible: {e}")
            print_warning(f"API server not accessible: {e}")
            print_info("Start the backend server with: npm run dev")
            return False
    
    def validate_test_files(self) -> bool:
        """Validate test files structure"""
        print_info("Checking test files structure...")
        
        required_files = [
            'conftest.py',
            'pytest.ini', 
            'requirements.txt',
            'run_tests.py',
            'fixtures/test_data.py',
            'utils/database_setup.py',
            'utils/mock_services.py',
            'integration/test_auth_api.py',
            'integration/test_email_api.py',
            'integration/test_analysis_api.py',
            'integration/test_rules_api.py',
            'integration/test_reports_api.py',
            'integration/test_monitoring_api.py'
        ]
        
        missing_files = []
        
        for file_path in required_files:
            full_path = self.test_root / file_path
            if full_path.exists():
                print_success(f"Found {file_path}")
            else:
                missing_files.append(file_path)
                print_error(f"Missing {file_path}")
        
        if missing_files:
            self.errors.append(f"Missing test files: {', '.join(missing_files)}")
            return False
        
        return True
    
    def validate_environment_variables(self) -> bool:
        """Validate environment variables"""
        print_info("Checking environment variables...")
        
        recommended_vars = [
            'TEST_DB_URL',
            'TEST_REDIS_URL', 
            'API_BASE_URL'
        ]
        
        missing_vars = []
        
        for var in recommended_vars:
            if os.getenv(var):
                print_success(f"{var} is set")
            else:
                missing_vars.append(var)
                print_warning(f"{var} is not set (using default)")
        
        if missing_vars:
            print_info("Consider creating a .env.test file with your configuration")
        
        return True
    
    def run_sample_test(self) -> bool:
        """Run a simple test to validate pytest"""
        print_info("Running sample test...")
        
        try:
            # Create a simple test file
            sample_test = self.test_root / "test_sample_validation.py"
            
            sample_content = '''
def test_sample():
    """Sample test to validate pytest setup"""
    assert True

def test_imports():
    """Test that required modules can be imported"""
    import pytest
    import requests
    import faker
    assert True
'''
            
            with open(sample_test, 'w') as f:
                f.write(sample_content)
            
            # Run the test
            result = subprocess.run([
                sys.executable, '-m', 'pytest', str(sample_test), '-v'
            ], capture_output=True, text=True, cwd=self.test_root)
            
            # Clean up
            sample_test.unlink()
            
            if result.returncode == 0:
                print_success("Sample test passed")
                return True
            else:
                self.errors.append(f"Sample test failed: {result.stderr}")
                print_error(f"Sample test failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.errors.append(f"Failed to run sample test: {e}")
            print_error(f"Failed to run sample test: {e}")
            return False
    
    def generate_test_config(self):
        """Generate test configuration file"""
        print_info("Generating test configuration...")
        
        config_content = f"""# Email Assist API Test Configuration
# Copy this to .env.test and modify as needed

# Database Configuration
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=password
TEST_DB_NAME=email_assist_test
TEST_DB_URL=postgresql://postgres:password@localhost:5432/email_assist_test

# Redis Configuration  
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
REDIS_TEST_DB=1
TEST_REDIS_URL=redis://localhost:6379/1

# API Configuration
API_BASE_URL=http://localhost:3001/api

# Test Configuration
SEED_TEST_DATA=true
USE_MOCK_SERVICES=true
TEST_TIMEOUT=30
LOG_LEVEL=INFO

# JWT Configuration
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
"""
        
        config_file = self.test_root / ".env.test.example"
        with open(config_file, 'w') as f:
            f.write(config_content)
        
        print_success(f"Generated {config_file}")
        print_info("Copy .env.test.example to .env.test and customize as needed")
    
    def validate_all(self) -> bool:
        """Run all validations"""
        print_info("🔍 Validating Email Assist API Test Setup\n")
        
        validations = [
            ("Python Version", self.validate_python_version),
            ("Required Packages", self.validate_required_packages),
            ("Database Connection", self.validate_database_connection),
            ("Redis Connection", self.validate_redis_connection),
            ("API Server", self.validate_api_server),
            ("Test Files", self.validate_test_files),
            ("Environment Variables", self.validate_environment_variables),
            ("Sample Test", self.run_sample_test)
        ]
        
        passed = 0
        total = len(validations)
        
        for name, validator in validations:
            print(f"\n--- {name} ---")
            if validator():
                passed += 1
        
        # Generate config file
        print(f"\n--- Configuration ---")
        self.generate_test_config()
        
        # Print summary
        print(f"\n{'='*50}")
        print(f"📊 VALIDATION SUMMARY")
        print(f"{'='*50}")
        
        print(f"✅ Passed: {passed}/{total} validations")
        
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"   • {warning}")
        
        if passed == total and not self.errors:
            print(f"\n🎉 All validations passed! The test environment is ready.")
            print(f"\nNext steps:")
            print(f"   1. Start the backend server: cd .. && npm run dev")
            print(f"   2. Run tests: python run_tests.py")
            return True
        else:
            print(f"\n🔧 Please fix the issues above before running tests.")
            return False


def main():
    """Main validation entry point"""
    validator = TestSetupValidator()
    success = validator.validate_all()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()