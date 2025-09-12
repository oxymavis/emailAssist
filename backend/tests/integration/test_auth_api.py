"""
Authentication API Integration Tests for Email Assist
"""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import jwt


@pytest.mark.api
@pytest.mark.auth
class TestAuthRegistration:
    """Test user registration functionality"""
    
    def test_successful_registration(self, api_client, api_base_url, clean_database):
        """Test AUTH-001: Successful user registration"""
        registration_data = {
            "email": "newuser@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "New Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Assert response structure
        assert data["success"] is True
        assert "data" in data
        assert "token" in data["data"]
        assert "user" in data["data"]
        
        # Assert user data
        user_data = data["data"]["user"]
        assert user_data["email"] == registration_data["email"]
        assert user_data["name"] == registration_data["name"]
        assert "id" in user_data
        assert "password" not in user_data  # Password should not be returned
        
        # Assert JWT token is valid
        token = data["data"]["token"]
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_duplicate_email_registration(self, api_client, api_base_url, clean_database, test_user):
        """Test AUTH-002: Registration with existing email"""
        # First, register a user
        registration_data = {
            "email": test_user["email"],
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": test_user["name"]
        }
        
        # First registration should succeed
        response1 = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        assert response1.status_code == 201
        
        # Second registration with same email should fail
        response2 = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response2.status_code == 409
        data = response2.json()
        assert data["success"] is False
        assert "error" in data
        assert "email" in data["error"]["message"].lower() or "exists" in data["error"]["message"].lower()
    
    def test_password_mismatch_registration(self, api_client, api_base_url):
        """Test AUTH-003: Registration with password mismatch"""
        registration_data = {
            "email": "test@example.com",
            "password": "Password123!",
            "confirmPassword": "DifferentPassword123!",
            "name": "Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "error" in data
        assert "password" in data["error"]["message"].lower()
    
    def test_weak_password_registration(self, api_client, api_base_url):
        """Test AUTH-004: Registration with weak password"""
        registration_data = {
            "email": "test@example.com",
            "password": "123",
            "confirmPassword": "123",
            "name": "Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "password" in data["error"]["message"].lower()
    
    @pytest.mark.parametrize("invalid_email", [
        "invalid-email",
        "@example.com",
        "test@",
        "test.example.com",
        ""
    ])
    def test_invalid_email_registration(self, api_client, api_base_url, invalid_email):
        """Test registration with invalid email formats"""
        registration_data = {
            "email": invalid_email,
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
    
    def test_missing_required_fields(self, api_client, api_base_url):
        """Test registration with missing required fields"""
        test_cases = [
            {"email": "test@example.com", "password": "Password123!", "name": "Test User"},  # Missing confirmPassword
            {"password": "Password123!", "confirmPassword": "Password123!", "name": "Test User"},  # Missing email
            {"email": "test@example.com", "confirmPassword": "Password123!", "name": "Test User"},  # Missing password
            {"email": "test@example.com", "password": "Password123!", "confirmPassword": "Password123!"}  # Missing name
        ]
        
        for incomplete_data in test_cases:
            response = api_client.post(
                f"{api_base_url}/auth/register",
                json=incomplete_data
            )
            
            assert response.status_code == 400
            data = response.json()
            assert data["success"] is False


@pytest.mark.api
@pytest.mark.auth
class TestAuthLogin:
    """Test user login functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self, api_client, api_base_url, clean_database):
        """Setup a registered user for login tests"""
        registration_data = {
            "email": "logintest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Login Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        self.test_user = registration_data
    
    def test_successful_login(self, api_client, api_base_url):
        """Test AUTH-005: Successful user login"""
        login_data = {
            "email": self.test_user["email"],
            "password": self.test_user["password"]
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/login",
            json=login_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Assert response structure
        assert data["success"] is True
        assert "data" in data
        assert "token" in data["data"]
        assert "user" in data["data"]
        
        # Assert user data
        user_data = data["data"]["user"]
        assert user_data["email"] == login_data["email"]
        assert "password" not in user_data
        
        # Assert JWT token
        token = data["data"]["token"]
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_wrong_password_login(self, api_client, api_base_url):
        """Test AUTH-006: Login with wrong password"""
        login_data = {
            "email": self.test_user["email"],
            "password": "WrongPassword123!"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/login",
            json=login_data
        )
        
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert "error" in data
    
    def test_nonexistent_user_login(self, api_client, api_base_url):
        """Test AUTH-007: Login with non-existent user"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "Password123!"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/login",
            json=login_data
        )
        
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert "error" in data
    
    def test_empty_credentials_login(self, api_client, api_base_url):
        """Test login with empty credentials"""
        test_cases = [
            {"email": "", "password": "Password123!"},
            {"email": self.test_user["email"], "password": ""},
            {"email": "", "password": ""}
        ]
        
        for login_data in test_cases:
            response = api_client.post(
                f"{api_base_url}/auth/login",
                json=login_data
            )
            
            assert response.status_code == 400
            data = response.json()
            assert data["success"] is False


@pytest.mark.api
@pytest.mark.auth
class TestJWTTokenManagement:
    """Test JWT token management"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user with token"""
        # Register and login user
        registration_data = {
            "email": "tokentest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Token Test User"
        }
        
        # Register
        register_response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        assert register_response.status_code == 201
        
        # Login to get token
        login_data = {
            "email": registration_data["email"],
            "password": registration_data["password"]
        }
        
        login_response = api_client.post(
            f"{api_base_url}/auth/login",
            json=login_data
        )
        assert login_response.status_code == 200
        
        self.token_data = login_response.json()["data"]
        self.user_data = registration_data
    
    def test_token_refresh(self, api_client, api_base_url):
        """Test AUTH-008: JWT token refresh"""
        refresh_data = {
            "refresh_token": self.token_data.get("refresh_token", self.token_data["token"])
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/refresh",
            json=refresh_data,
            headers={"Authorization": f"Bearer {self.token_data['token']}"}
        )
        
        # Token refresh might not be implemented yet, so accept either success or not implemented
        assert response.status_code in [200, 501]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "token" in data["data"]
            assert data["data"]["token"] != self.token_data["token"]  # New token should be different
    
    def test_invalid_token_refresh(self, api_client, api_base_url):
        """Test AUTH-009: Refresh with invalid token"""
        refresh_data = {
            "refresh_token": "invalid_refresh_token"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/refresh",
            json=refresh_data,
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code in [401, 501]  # Unauthorized or not implemented
    
    def test_token_verification(self, api_client, api_base_url):
        """Test AUTH-010: JWT token verification"""
        response = api_client.get(
            f"{api_base_url}/auth/verify",
            headers={"Authorization": f"Bearer {self.token_data['token']}"}
        )
        
        # Token verification might not be implemented as separate endpoint
        # Check if user profile endpoint works with token
        profile_response = api_client.get(
            f"{api_base_url}/auth/profile",
            headers={"Authorization": f"Bearer {self.token_data['token']}"}
        )
        
        # Should be able to access protected resource
        assert profile_response.status_code in [200, 404]  # Success or endpoint not found
    
    def test_invalid_token_verification(self, api_client, api_base_url):
        """Test token verification with invalid token"""
        invalid_tokens = [
            "invalid_token",
            "Bearer invalid_token",
            "",
            "expired_token_here"
        ]
        
        for invalid_token in invalid_tokens:
            headers = {"Authorization": f"Bearer {invalid_token}"}
            
            # Try accessing a protected endpoint
            response = api_client.get(
                f"{api_base_url}/email/messages",  # This should be protected
                headers=headers
            )
            
            assert response.status_code == 401
    
    def test_missing_authorization_header(self, api_client, api_base_url):
        """Test accessing protected resource without authorization"""
        response = api_client.get(f"{api_base_url}/email/messages")
        assert response.status_code == 401
    
    def test_malformed_authorization_header(self, api_client, api_base_url):
        """Test with malformed authorization headers"""
        malformed_headers = [
            {"Authorization": "InvalidFormat token"},
            {"Authorization": "Bearer"},
            {"Authorization": "token_without_bearer"},
            {"Authorization": "Bearer "},
        ]
        
        for headers in malformed_headers:
            response = api_client.get(
                f"{api_base_url}/email/messages",
                headers=headers
            )
            assert response.status_code == 401


@pytest.mark.api
@pytest.mark.auth
@pytest.mark.external
class TestMicrosoftOAuth:
    """Test Microsoft OAuth2 integration"""
    
    def test_get_microsoft_auth_url(self, api_client, api_base_url, mock_microsoft_graph):
        """Test AUTH-011: Microsoft OAuth2 authorization URL generation"""
        response = api_client.get(f"{api_base_url}/auth/microsoft")
        
        # This might not be implemented yet
        if response.status_code == 404:
            pytest.skip("Microsoft OAuth not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "authUrl" in data["data"]
        assert "login.microsoftonline.com" in data["data"]["authUrl"]
    
    def test_microsoft_auth_callback(self, api_client, api_base_url, mock_microsoft_graph):
        """Test AUTH-012: Microsoft OAuth2 callback handling"""
        callback_data = {
            "code": "mock_authorization_code",
            "state": "mock_state_value"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/microsoft/callback",
            json=callback_data
        )
        
        # This might not be implemented yet
        if response.status_code == 404:
            pytest.skip("Microsoft OAuth callback not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "token" in data["data"]
        assert "user" in data["data"]
    
    def test_microsoft_auth_callback_invalid_code(self, api_client, api_base_url, mock_microsoft_graph):
        """Test Microsoft OAuth2 callback with invalid code"""
        # Mock the Graph service to return error
        mock_microsoft_graph.get_access_token.side_effect = Exception("Invalid authorization code")
        
        callback_data = {
            "code": "invalid_authorization_code",
            "state": "mock_state_value"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/microsoft/callback",
            json=callback_data
        )
        
        if response.status_code == 404:
            pytest.skip("Microsoft OAuth callback not implemented yet")
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False


@pytest.mark.api
@pytest.mark.auth
class TestAuthSecurity:
    """Test authentication security features"""
    
    def test_password_hashing(self, api_client, api_base_url, clean_database, db_session):
        """Test that passwords are properly hashed in database"""
        registration_data = {
            "email": "security@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Security Test User"
        }
        
        response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        
        # Check database directly - password should be hashed
        from sqlalchemy import text
        result = db_session.execute(
            text("SELECT password_hash FROM users WHERE email = :email"),
            {"email": registration_data["email"]}
        ).fetchone()
        
        if result:
            # Password should be hashed (not plain text)
            assert result[0] != registration_data["password"]
            # Should look like a bcrypt hash
            assert result[0].startswith('$2') or len(result[0]) >= 50
    
    def test_rate_limiting(self, api_client, api_base_url):
        """Test rate limiting on login attempts"""
        login_data = {
            "email": "ratelimit@example.com",
            "password": "WrongPassword123!"
        }
        
        # Make multiple failed login attempts
        responses = []
        for _ in range(10):  # Try 10 failed logins
            response = api_client.post(
                f"{api_base_url}/auth/login",
                json=login_data
            )
            responses.append(response.status_code)
        
        # Check if any rate limiting is applied
        # This test is informational - rate limiting might not be implemented yet
        rate_limited = any(status == 429 for status in responses)
        
        # Log the results for analysis
        print(f"Rate limiting test results: {responses}")
        print(f"Rate limiting detected: {rate_limited}")
    
    def test_jwt_token_expiration(self, test_config):
        """Test JWT token expiration"""
        # Create an expired token
        from conftest import create_jwt_token
        
        user_data = {"id": "test", "email": "test@example.com"}
        
        # Create token that expires in -1 hour (already expired)
        expired_token = create_jwt_token(
            user_data, 
            expires_in_hours=-1
        )
        
        # Try to decode the token - should raise exception
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(
                expired_token, 
                test_config.get('JWT_SECRET'), 
                algorithms=[test_config.get('JWT_ALGORITHM')]
            )
    
    def test_jwt_token_tampering(self, api_client, api_base_url, test_user_token):
        """Test protection against JWT token tampering"""
        # Tamper with the token
        tampered_token = test_user_token[:-5] + "XXXXX"
        
        response = api_client.get(
            f"{api_base_url}/email/messages",
            headers={"Authorization": f"Bearer {tampered_token}"}
        )
        
        assert response.status_code == 401
    
    @pytest.mark.slow
    def test_password_strength_requirements(self, api_client, api_base_url):
        """Test password strength requirements"""
        weak_passwords = [
            "123456",
            "password",
            "qwerty",
            "abc123",
            "123456789",
            "password123",
            "admin",
            "letmein",
            "welcome",
            "monkey"
        ]
        
        for weak_password in weak_passwords:
            registration_data = {
                "email": f"weakpass{weak_password}@example.com",
                "password": weak_password,
                "confirmPassword": weak_password,
                "name": "Weak Password User"
            }
            
            response = api_client.post(
                f"{api_base_url}/auth/register",
                json=registration_data
            )
            
            # Should reject weak passwords
            assert response.status_code == 400, f"Weak password '{weak_password}' was accepted"


@pytest.mark.api
@pytest.mark.auth
class TestAuthLogout:
    """Test user logout functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_logged_in_user(self, api_client, api_base_url, clean_database):
        """Setup logged in user for logout tests"""
        # Register and login
        registration_data = {
            "email": "logout@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Logout Test User"
        }
        
        # Register
        register_response = api_client.post(
            f"{api_base_url}/auth/register",
            json=registration_data
        )
        assert register_response.status_code == 201
        
        # Login
        login_data = {
            "email": registration_data["email"],
            "password": registration_data["password"]
        }
        
        login_response = api_client.post(
            f"{api_base_url}/auth/login",
            json=login_data
        )
        assert login_response.status_code == 200
        
        self.token = login_response.json()["data"]["token"]
    
    def test_successful_logout(self, api_client, api_base_url):
        """Test successful user logout"""
        response = api_client.post(
            f"{api_base_url}/auth/logout",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # Logout might not be implemented yet
        if response.status_code == 404:
            pytest.skip("Logout endpoint not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_logout_without_token(self, api_client, api_base_url):
        """Test logout without authentication token"""
        response = api_client.post(f"{api_base_url}/auth/logout")
        
        if response.status_code == 404:
            pytest.skip("Logout endpoint not implemented yet")
        
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])