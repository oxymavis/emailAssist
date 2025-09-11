"""
邮件分析API集成测试
测试邮件分析功能的完整流程
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import json

@pytest.mark.integration
@pytest.mark.api
@pytest.mark.email
@pytest.mark.ai
class TestEmailAnalysisAPI:
    """邮件分析API测试类"""
    
    async def test_analyze_email_success(self, client: AsyncClient, sample_email, auth_headers):
        """测试邮件分析API正常流程"""
        response = await client.post(
            "/api/v1/emails/analyze",
            json={
                "email_content": sample_email["content"],
                "from": sample_email["from"],
                "subject": sample_email["subject"],
                "to": sample_email["to"]
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证响应结构
        assert "analysis" in data
        assert "sentiment" in data["analysis"]
        assert "priority" in data["analysis"]
        assert "keywords" in data["analysis"]
        assert "confidence_score" in data["analysis"]
        
        # 验证数据类型和值范围
        analysis = data["analysis"]
        assert analysis["sentiment"] in ["positive", "negative", "neutral"]
        assert analysis["priority"] in ["high", "medium", "low"]
        assert isinstance(analysis["keywords"], list)
        assert 0.0 <= analysis["confidence_score"] <= 1.0
    
    async def test_analyze_email_with_urgent_content(self, client: AsyncClient, auth_headers):
        """测试紧急邮件内容的分析"""
        urgent_email = {
            "email_content": "URGENT: Critical production system is down! Need immediate assistance!",
            "from": "ops@company.com",
            "subject": "URGENT: Production System Down",
            "to": "support@email-assist.com"
        }
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json=urgent_email,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 紧急邮件应该被识别为高优先级和负面情感
        analysis = data["analysis"]
        assert analysis["priority"] == "high"
        assert analysis["sentiment"] in ["negative", "neutral"]  # 紧急但不一定负面
        assert analysis["confidence_score"] > 0.7  # 应该有较高的置信度
    
    async def test_analyze_email_with_positive_content(self, client: AsyncClient, auth_headers):
        """测试正面邮件内容的分析"""
        positive_email = {
            "email_content": "Thank you so much for the excellent service! Everything works perfectly.",
            "from": "happy@customer.com",
            "subject": "Thanks for great service",
            "to": "support@email-assist.com"
        }
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json=positive_email,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        analysis = data["analysis"]
        assert analysis["sentiment"] == "positive"
        assert analysis["priority"] in ["low", "medium"]  # 感谢邮件通常不紧急
    
    async def test_analyze_email_invalid_input(self, client: AsyncClient, auth_headers):
        """测试无效输入的错误处理"""
        invalid_inputs = [
            # 空内容
            {
                "email_content": "",
                "from": "test@example.com",
                "subject": "Test",
                "to": "support@example.com"
            },
            # 无效邮箱格式
            {
                "email_content": "Test content",
                "from": "invalid-email",
                "subject": "Test",
                "to": "support@example.com"
            },
            # 缺少必需字段
            {
                "email_content": "Test content",
                "from": "test@example.com"
                # 缺少subject和to
            }
        ]
        
        for invalid_input in invalid_inputs:
            response = await client.post(
                "/api/v1/emails/analyze",
                json=invalid_input,
                headers=auth_headers
            )
            
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data or "validation_errors" in data
    
    async def test_analyze_email_unauthorized(self, client: AsyncClient, sample_email):
        """测试未授权访问"""
        response = await client.post(
            "/api/v1/emails/analyze",
            json={
                "email_content": sample_email["content"],
                "from": sample_email["from"],
                "subject": sample_email["subject"],
                "to": sample_email["to"]
            }
            # 没有auth_headers
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    @pytest.mark.performance
    async def test_analyze_email_performance(self, client: AsyncClient, large_email_sample, auth_headers):
        """测试大邮件内容的性能"""
        start_time = datetime.now()
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json=large_email_sample,
            headers=auth_headers
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        assert response.status_code == 200
        assert processing_time < 10.0  # 10秒内完成分析
        
        data = response.json()
        assert "analysis" in data
    
    async def test_analyze_email_with_special_characters(self, client: AsyncClient, auth_headers):
        """测试包含特殊字符的邮件内容"""
        special_email = {
            "email_content": "邮件内容包含中文、émojis 😀🎉 和 special chars: @#$%^&*()",
            "from": "test@example.com",
            "subject": "Special Characters Test 测试",
            "to": "support@email-assist.com"
        }
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json=special_email,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis" in data
    
    async def test_batch_analyze_emails(self, client: AsyncClient, auth_headers):
        """测试批量邮件分析"""
        emails = [
            {
                "email_content": "First email content",
                "from": "user1@example.com",
                "subject": "First Email",
                "to": "support@example.com"
            },
            {
                "email_content": "Second email content",
                "from": "user2@example.com", 
                "subject": "Second Email",
                "to": "support@example.com"
            }
        ]
        
        response = await client.post(
            "/api/v1/emails/batch-analyze",
            json={"emails": emails},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 2
        
        # 每个结果都应该有分析数据
        for result in data["results"]:
            assert "analysis" in result
            assert "sentiment" in result["analysis"]
            assert "priority" in result["analysis"]
    
    @pytest.mark.slow
    async def test_analyze_email_rate_limiting(self, client: AsyncClient, auth_headers):
        """测试API速率限制"""
        # 快速连续发送多个请求
        tasks = []
        for i in range(10):
            task = client.post(
                "/api/v1/emails/analyze",
                json={
                    "email_content": f"Test email content {i}",
                    "from": f"test{i}@example.com",
                    "subject": f"Test {i}",
                    "to": "support@example.com"
                },
                headers=auth_headers
            )
            tasks.append(task)
        
        # 执行所有请求
        import asyncio
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 检查是否有速率限制
        status_codes = [r.status_code if hasattr(r, 'status_code') else None for r in responses]
        
        # 应该有一些成功的请求，可能有一些被限制
        success_count = sum(1 for code in status_codes if code == 200)
        rate_limited_count = sum(1 for code in status_codes if code == 429)
        
        assert success_count > 0  # 至少有一些请求成功
        # 如果有速率限制，检查错误消息
        if rate_limited_count > 0:
            rate_limited_response = next(r for r in responses if hasattr(r, 'status_code') and r.status_code == 429)
            data = rate_limited_response.json()
            assert "rate limit" in data["detail"].lower()
    
    async def test_analyze_email_with_attachments_info(self, client: AsyncClient, auth_headers):
        """测试包含附件信息的邮件分析"""
        email_with_attachments = {
            "email_content": "Please find the report attached.",
            "from": "sender@example.com",
            "subject": "Monthly Report",
            "to": "support@email-assist.com",
            "attachments": [
                {"name": "report.pdf", "size": 1024000, "type": "application/pdf"},
                {"name": "data.xlsx", "size": 512000, "type": "application/vnd.ms-excel"}
            ]
        }
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json=email_with_attachments,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 分析应该考虑到附件信息
        analysis = data["analysis"]
        assert "has_attachments" in analysis
        assert analysis["has_attachments"] is True
    
    async def test_analyze_email_error_handling(self, client: AsyncClient, auth_headers, monkeypatch):
        """测试AI服务错误时的处理"""
        # Mock AI服务返回错误
        async def mock_ai_analyze_error(*args, **kwargs):
            raise Exception("AI service temporarily unavailable")
        
        # 这里需要根据实际的AI服务模块路径调整
        monkeypatch.setattr("services.ai_service.analyze_email", mock_ai_analyze_error)
        
        response = await client.post(
            "/api/v1/emails/analyze",
            json={
                "email_content": "Test content",
                "from": "test@example.com",
                "subject": "Test",
                "to": "support@example.com"
            },
            headers=auth_headers
        )
        
        # 应该返回服务错误状态码
        assert response.status_code in [500, 503]
        data = response.json()
        assert "detail" in data
        assert "service" in data["detail"].lower() or "error" in data["detail"].lower()