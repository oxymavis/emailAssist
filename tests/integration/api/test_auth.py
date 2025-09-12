"""
用户认证API集成测试
测试用户注册、登录、token验证等认证功能
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import json
import jwt
from unittest.mock import patch

@pytest.mark.integration
@pytest.mark.api  
@pytest.mark.auth
class TestAuthAPI:
    """用户认证API测试类"""
    
    async def test_user_registration_success(self, client: AsyncClient):
        """测试用户注册成功流程"""
        registration_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "New User",
            "company": "Test Company"
        }
        
        response = await client.post(
            "/api/v1/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # 验证响应结构
        assert "user" in data
        assert "access_token" in data
        assert "token_type" in data
        
        # 验证用户信息
        user_data = data["user"]
        assert user_data["email"] == registration_data["email"]
        assert user_data["full_name"] == registration_data["full_name"]
        assert user_data["company"] == registration_data["company"]
        assert "id" in user_data
        assert "created_at" in user_data
        
        # 验证密码不在响应中
        assert "password" not in user_data
        
        # 验证token
        assert data["token_type"] == "bearer"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 50  # JWT token应该相对较长
    
    async def test_user_registration_duplicate_email(self, client: AsyncClient, existing_user):
        """测试重复邮箱注册"""
        registration_data = {
            "email": existing_user["email"],  # 使用已存在的邮箱
            "password": "SecurePassword123!",
            "full_name": "Duplicate User",
            "company": "Test Company"
        }
        
        response = await client.post(
            "/api/v1/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 409  # Conflict
        data = response.json()
        assert "detail" in data
        assert "email" in data["detail"].lower()
        assert "already exists" in data["detail"].lower()
    
    async def test_user_registration_invalid_data(self, client: AsyncClient):
        """测试无效注册数据"""
        invalid_registrations = [
            # 无效邮箱格式
            {
                "email": "invalid-email",
                "password": "SecurePassword123!",
                "full_name": "Test User",
                "company": "Test Company"
            },
            # 弱密码
            {
                "email": "test@example.com",
                "password": "weak",
                "full_name": "Test User",
                "company": "Test Company"
            },
            # 缺少必需字段
            {
                "email": "test@example.com",
                "password": "SecurePassword123!"
                # 缺少full_name
            },
            # 空字段
            {
                "email": "",
                "password": "SecurePassword123!",
                "full_name": "Test User",
                "company": "Test Company"
            }
        ]
        
        for invalid_data in invalid_registrations:
            response = await client.post(
                "/api/v1/auth/register",
                json=invalid_data
            )
            
            assert response.status_code == 422  # Validation Error
            data = response.json()
            assert "detail" in data or "validation_errors" in data
    
    async def test_user_login_success(self, client: AsyncClient, existing_user):
        """测试用户登录成功"""
        login_data = {
            "email": existing_user["email"],
            "password": "testpassword123"  # 从fixture获取的密码
        }
        
        response = await client.post(
            "/api/v1/auth/login",
            json=login_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证响应结构
        assert "user" in data
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        
        # 验证用户信息
        user_data = data["user"]
        assert user_data["email"] == existing_user["email"]
        assert "id" in user_data
        assert "last_login" in user_data
        
        # 验证token
        assert data["token_type"] == "bearer"
        assert isinstance(data["access_token"], str)
        assert isinstance(data["refresh_token"], str)
    
    async def test_user_login_invalid_credentials(self, client: AsyncClient):
        """测试无效登录凭据"""
        invalid_logins = [
            # 错误密码
            {
                "email": "test@example.com",
                "password": "wrongpassword"
            },
            # 不存在的用户
            {
                "email": "nonexistent@example.com",
                "password": "anypassword"
            },
            # 空凭据
            {
                "email": "",
                "password": ""
            }
        ]
        
        for invalid_login in invalid_logins:
            response = await client.post(
                "/api/v1/auth/login",
                json=invalid_login
            )
            
            assert response.status_code == 401  # Unauthorized
            data = response.json()
            assert "detail" in data
            assert "credentials" in data["detail"].lower() or "invalid" in data["detail"].lower()
    
    async def test_token_refresh_success(self, client: AsyncClient, valid_refresh_token):
        """测试token刷新成功"""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": valid_refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证新token
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        
        # 新token应该与旧token不同
        assert data["access_token"] != valid_refresh_token
        assert data["refresh_token"] != valid_refresh_token
    
    async def test_token_refresh_invalid_token(self, client: AsyncClient):
        """测试无效refresh token"""
        invalid_tokens = [
            "invalid.jwt.token",
            "expired.token.here",
            "",
            None
        ]
        
        for invalid_token in invalid_tokens:
            payload = {}
            if invalid_token is not None:
                payload["refresh_token"] = invalid_token
            
            response = await client.post(
                "/api/v1/auth/refresh",
                json=payload
            )
            
            assert response.status_code in [400, 401]  # Bad Request or Unauthorized
            data = response.json()
            assert "detail" in data
    
    async def test_user_profile_get_success(self, client: AsyncClient, auth_headers):
        """测试获取用户资料成功"""
        response = await client.get(
            "/api/v1/auth/profile",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证用户资料结构
        assert "id" in data
        assert "email" in data
        assert "full_name" in data
        assert "company" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "is_active" in data
        
        # 验证敏感信息不在响应中
        assert "password" not in data
        assert "password_hash" not in data
    
    async def test_user_profile_get_unauthorized(self, client: AsyncClient):
        """测试未授权访问用户资料"""
        response = await client.get(
            "/api/v1/auth/profile"
            # 没有auth_headers
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    async def test_user_profile_update_success(self, client: AsyncClient, auth_headers):
        """测试更新用户资料成功"""
        update_data = {
            "full_name": "Updated Name",
            "company": "Updated Company",
            "preferences": {
                "theme": "dark",
                "language": "en",
                "notifications": {
                    "email": True,
                    "push": False
                }
            }
        }
        
        response = await client.put(
            "/api/v1/auth/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证更新的信息
        assert data["full_name"] == update_data["full_name"]
        assert data["company"] == update_data["company"]
        assert data["preferences"]["theme"] == update_data["preferences"]["theme"]
        assert "updated_at" in data
    
    async def test_password_change_success(self, client: AsyncClient, auth_headers):
        """测试修改密码成功"""
        password_change_data = {
            "current_password": "testpassword123",
            "new_password": "NewSecurePassword456!",
            "confirm_password": "NewSecurePassword456!"
        }
        
        response = await client.put(
            "/api/v1/auth/change-password",
            json=password_change_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "success" in data["message"].lower()
    
    async def test_password_change_invalid_current_password(self, client: AsyncClient, auth_headers):
        """测试错误的当前密码"""
        password_change_data = {
            "current_password": "wrongpassword",
            "new_password": "NewSecurePassword456!",
            "confirm_password": "NewSecurePassword456!"
        }
        
        response = await client.put(
            "/api/v1/auth/change-password",
            json=password_change_data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "current password" in data["detail"].lower()
    
    async def test_password_change_mismatched_passwords(self, client: AsyncClient, auth_headers):
        """测试新密码确认不匹配"""
        password_change_data = {
            "current_password": "testpassword123",
            "new_password": "NewSecurePassword456!",
            "confirm_password": "DifferentPassword789!"
        }
        
        response = await client.put(
            "/api/v1/auth/change-password",
            json=password_change_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert "match" in data["detail"].lower() or "confirm" in data["detail"].lower()
    
    async def test_logout_success(self, client: AsyncClient, auth_headers):
        """测试登出成功"""
        response = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "logged out" in data["message"].lower()
    
    async def test_forgot_password_success(self, client: AsyncClient, existing_user):
        """测试忘记密码功能"""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": existing_user["email"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "reset" in data["message"].lower()
    
    async def test_forgot_password_nonexistent_email(self, client: AsyncClient):
        """测试忘记密码 - 不存在的邮箱"""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nonexistent@example.com"}
        )
        
        # 出于安全考虑，即使邮箱不存在也应该返回成功
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    async def test_reset_password_success(self, client: AsyncClient, valid_reset_token):
        """测试重置密码成功"""
        reset_data = {
            "token": valid_reset_token,
            "new_password": "ResetPassword789!",
            "confirm_password": "ResetPassword789!"
        }
        
        response = await client.post(
            "/api/v1/auth/reset-password",
            json=reset_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "reset" in data["message"].lower()
    
    async def test_reset_password_invalid_token(self, client: AsyncClient):
        """测试重置密码 - 无效token"""
        reset_data = {
            "token": "invalid.reset.token",
            "new_password": "ResetPassword789!",
            "confirm_password": "ResetPassword789!"
        }
        
        response = await client.post(
            "/api/v1/auth/reset-password",
            json=reset_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "token" in data["detail"].lower()
    
    async def test_email_verification_success(self, client: AsyncClient, valid_email_verification_token):
        """测试邮箱验证成功"""
        response = await client.get(
            f"/api/v1/auth/verify-email?token={valid_email_verification_token}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "verified" in data["message"].lower()
    
    async def test_email_verification_invalid_token(self, client: AsyncClient):
        """测试邮箱验证 - 无效token"""
        response = await client.get(
            "/api/v1/auth/verify-email?token=invalid.verification.token"
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "token" in data["detail"].lower()
    
    @pytest.mark.performance
    async def test_login_performance(self, client: AsyncClient, existing_user):
        """测试登录性能"""
        login_data = {
            "email": existing_user["email"],
            "password": "testpassword123"
        }
        
        start_time = datetime.now()
        
        response = await client.post(
            "/api/v1/auth/login",
            json=login_data
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        assert response.status_code == 200
        assert processing_time < 2.0  # 登录应该在2秒内完成
    
    @pytest.mark.security
    async def test_auth_rate_limiting(self, client: AsyncClient):
        """测试认证API速率限制"""
        # 尝试多次失败登录
        failed_login_data = {
            "email": "test@example.com",
            "password": "wrongpassword"
        }
        
        responses = []
        for _ in range(10):  # 10次失败尝试
            response = await client.post(
                "/api/v1/auth/login",
                json=failed_login_data
            )
            responses.append(response)
        
        # 检查是否触发了速率限制
        status_codes = [r.status_code for r in responses]
        rate_limited_count = sum(1 for code in status_codes if code == 429)
        
        # 应该有一些请求被速率限制
        assert rate_limited_count > 0
        
        # 检查速率限制响应
        rate_limited_response = next(r for r in responses if r.status_code == 429)
        data = rate_limited_response.json()
        assert "rate limit" in data["detail"].lower()
    
    @pytest.mark.security
    async def test_jwt_token_validation(self, client: AsyncClient, auth_headers):
        """测试JWT token验证"""
        # 测试有效token
        response = await client.get(
            "/api/v1/auth/profile",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 测试无效token格式
        invalid_headers = {"Authorization": "Bearer invalid.jwt.token"}
        response = await client.get(
            "/api/v1/auth/profile",
            headers=invalid_headers
        )
        assert response.status_code == 401
        
        # 测试过期token (如果有mock的话)
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = jwt.ExpiredSignatureError()
            
            response = await client.get(
                "/api/v1/auth/profile",
                headers=auth_headers
            )
            assert response.status_code == 401
    
    async def test_user_role_and_permissions(self, client: AsyncClient, auth_headers):
        """测试用户角色和权限"""
        # 获取用户资料，检查角色
        response = await client.get(
            "/api/v1/auth/profile",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "role" in data
        assert "permissions" in data
        assert isinstance(data["permissions"], list)
    
    async def test_account_deactivation(self, client: AsyncClient, auth_headers):
        """测试账户停用功能"""
        response = await client.post(
            "/api/v1/auth/deactivate",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "deactivated" in data["message"].lower()
        
        # 验证停用后无法访问
        profile_response = await client.get(
            "/api/v1/auth/profile",
            headers=auth_headers
        )
        assert profile_response.status_code == 401