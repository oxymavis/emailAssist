"""
报告生成API集成测试
测试报告创建、导出、调度等功能
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import json
import io
import pandas as pd
from unittest.mock import patch

@pytest.mark.integration
@pytest.mark.api
@pytest.mark.reports
class TestReportsAPI:
    """报告API测试类"""
    
    async def test_create_report_success(self, client: AsyncClient, auth_headers):
        """测试创建报告成功"""
        report_data = {
            "title": "Monthly Email Analysis Report",
            "type": "email_analysis", 
            "date_range": {
                "start_date": "2024-08-01",
                "end_date": "2024-08-31"
            },
            "filters": {
                "sender_domains": ["company.com", "client.com"],
                "sentiment": ["positive", "neutral"],
                "priority": ["high", "medium"]
            },
            "format": "pdf",
            "include_charts": True
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # 验证响应结构
        assert "id" in data
        assert "title" in data
        assert "status" in data
        assert "created_at" in data
        assert "download_url" in data
        
        # 验证报告信息
        assert data["title"] == report_data["title"]
        assert data["type"] == report_data["type"]
        assert data["status"] in ["pending", "processing", "completed"]
        
        return data["id"]  # 返回报告ID供其他测试使用
    
    async def test_create_report_invalid_data(self, client: AsyncClient, auth_headers):
        """测试创建报告 - 无效数据"""
        invalid_reports = [
            # 缺少必需字段
            {
                "title": "Test Report"
                # 缺少type和date_range
            },
            # 无效日期范围
            {
                "title": "Test Report",
                "type": "email_analysis",
                "date_range": {
                    "start_date": "2024-08-31",
                    "end_date": "2024-08-01"  # 结束日期早于开始日期
                }
            },
            # 无效报告类型
            {
                "title": "Test Report",
                "type": "invalid_type",
                "date_range": {
                    "start_date": "2024-08-01",
                    "end_date": "2024-08-31"
                }
            },
            # 无效格式
            {
                "title": "Test Report",
                "type": "email_analysis",
                "date_range": {
                    "start_date": "2024-08-01", 
                    "end_date": "2024-08-31"
                },
                "format": "invalid_format"
            }
        ]
        
        for invalid_data in invalid_reports:
            response = await client.post(
                "/api/v1/reports",
                json=invalid_data,
                headers=auth_headers
            )
            
            assert response.status_code == 422
            data = response.json()
            assert "detail" in data or "validation_errors" in data
    
    async def test_get_reports_list(self, client: AsyncClient, auth_headers):
        """测试获取报告列表"""
        response = await client.get(
            "/api/v1/reports",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证响应结构
        assert "reports" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        
        # 验证报告列表
        assert isinstance(data["reports"], list)
        
        if data["reports"]:  # 如果有报告
            report = data["reports"][0]
            assert "id" in report
            assert "title" in report
            assert "type" in report
            assert "status" in report
            assert "created_at" in report
    
    async def test_get_reports_list_with_pagination(self, client: AsyncClient, auth_headers):
        """测试报告列表分页"""
        # 测试第一页
        response = await client.get(
            "/api/v1/reports?page=1&page_size=5",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["reports"]) <= 5
    
    async def test_get_reports_list_with_filters(self, client: AsyncClient, auth_headers):
        """测试报告列表过滤"""
        # 按类型过滤
        response = await client.get(
            "/api/v1/reports?type=email_analysis",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证所有返回的报告都是email_analysis类型
        for report in data["reports"]:
            assert report["type"] == "email_analysis"
        
        # 按状态过滤
        response = await client.get(
            "/api/v1/reports?status=completed",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证所有返回的报告都是completed状态
        for report in data["reports"]:
            assert report["status"] == "completed"
    
    async def test_get_report_by_id(self, client: AsyncClient, auth_headers, sample_report_id):
        """测试通过ID获取报告详情"""
        response = await client.get(
            f"/api/v1/reports/{sample_report_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证详细信息
        assert data["id"] == sample_report_id
        assert "title" in data
        assert "type" in data
        assert "status" in data
        assert "created_at" in data
        assert "date_range" in data
        assert "filters" in data
        assert "metadata" in data
    
    async def test_get_nonexistent_report(self, client: AsyncClient, auth_headers):
        """测试获取不存在的报告"""
        response = await client.get(
            "/api/v1/reports/nonexistent-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    async def test_download_report_pdf(self, client: AsyncClient, auth_headers, completed_report_id):
        """测试下载PDF报告"""
        response = await client.get(
            f"/api/v1/reports/{completed_report_id}/download",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers["content-disposition"]
        
        # 验证PDF内容不为空
        content = response.content
        assert len(content) > 1000  # PDF文件应该有一定大小
        assert content.startswith(b"%PDF")  # PDF文件标识
    
    async def test_download_report_excel(self, client: AsyncClient, auth_headers, completed_excel_report_id):
        """测试下载Excel报告"""
        response = await client.get(
            f"/api/v1/reports/{completed_excel_report_id}/download",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "attachment" in response.headers["content-disposition"]
        
        # 验证Excel内容
        content = response.content
        assert len(content) > 500  # Excel文件应该有一定大小
        
        # 尝试读取Excel内容验证格式正确性
        excel_file = io.BytesIO(content)
        df = pd.read_excel(excel_file)
        assert not df.empty  # 应该有数据
    
    async def test_download_report_not_ready(self, client: AsyncClient, auth_headers, processing_report_id):
        """测试下载未完成的报告"""
        response = await client.get(
            f"/api/v1/reports/{processing_report_id}/download",
            headers=auth_headers
        )
        
        assert response.status_code == 409  # Conflict - report not ready
        data = response.json()
        assert "detail" in data
        assert "not ready" in data["detail"].lower() or "processing" in data["detail"].lower()
    
    async def test_delete_report_success(self, client: AsyncClient, auth_headers, deletable_report_id):
        """测试删除报告成功"""
        response = await client.delete(
            f"/api/v1/reports/{deletable_report_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        # 验证报告已删除
        get_response = await client.get(
            f"/api/v1/reports/{deletable_report_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
    
    async def test_delete_nonexistent_report(self, client: AsyncClient, auth_headers):
        """测试删除不存在的报告"""
        response = await client.delete(
            "/api/v1/reports/nonexistent-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    async def test_update_report_success(self, client: AsyncClient, auth_headers, updatable_report_id):
        """测试更新报告成功"""
        update_data = {
            "title": "Updated Report Title",
            "filters": {
                "sender_domains": ["updated-company.com"],
                "sentiment": ["positive"]
            }
        }
        
        response = await client.put(
            f"/api/v1/reports/{updatable_report_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证更新的信息
        assert data["title"] == update_data["title"]
        assert data["filters"]["sender_domains"] == update_data["filters"]["sender_domains"]
        assert "updated_at" in data
    
    async def test_create_scheduled_report(self, client: AsyncClient, auth_headers):
        """测试创建定时报告"""
        scheduled_report_data = {
            "title": "Weekly Email Analysis",
            "type": "email_analysis",
            "schedule": {
                "frequency": "weekly",
                "day_of_week": 1,  # Monday
                "time": "09:00"
            },
            "date_range_type": "rolling",  # 滚动时间窗口
            "rolling_days": 7,
            "format": "pdf",
            "recipients": ["manager@company.com", "analyst@company.com"],
            "auto_send": True
        }
        
        response = await client.post(
            "/api/v1/reports/scheduled",
            json=scheduled_report_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # 验证定时报告信息
        assert "id" in data
        assert "schedule" in data
        assert "next_run" in data
        assert data["schedule"]["frequency"] == "weekly"
        assert data["auto_send"] is True
        assert len(data["recipients"]) == 2
    
    async def test_get_scheduled_reports(self, client: AsyncClient, auth_headers):
        """测试获取定时报告列表"""
        response = await client.get(
            "/api/v1/reports/scheduled",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "scheduled_reports" in data
        assert isinstance(data["scheduled_reports"], list)
        
        if data["scheduled_reports"]:
            report = data["scheduled_reports"][0]
            assert "id" in report
            assert "title" in report
            assert "schedule" in report
            assert "next_run" in report
            assert "is_active" in report
    
    async def test_pause_scheduled_report(self, client: AsyncClient, auth_headers, active_scheduled_report_id):
        """测试暂停定时报告"""
        response = await client.post(
            f"/api/v1/reports/scheduled/{active_scheduled_report_id}/pause",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "paused" in data["message"].lower()
        
        # 验证报告状态已更新
        get_response = await client.get(
            f"/api/v1/reports/scheduled/{active_scheduled_report_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        report_data = get_response.json()
        assert report_data["is_active"] is False
    
    async def test_resume_scheduled_report(self, client: AsyncClient, auth_headers, paused_scheduled_report_id):
        """测试恢复定时报告"""
        response = await client.post(
            f"/api/v1/reports/scheduled/{paused_scheduled_report_id}/resume",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "resumed" in data["message"].lower()
        
        # 验证报告状态已更新
        get_response = await client.get(
            f"/api/v1/reports/scheduled/{paused_scheduled_report_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        report_data = get_response.json()
        assert report_data["is_active"] is True
    
    async def test_get_report_templates(self, client: AsyncClient, auth_headers):
        """测试获取报告模板"""
        response = await client.get(
            "/api/v1/reports/templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert isinstance(data["templates"], list)
        
        if data["templates"]:
            template = data["templates"][0]
            assert "id" in template
            assert "name" in template
            assert "description" in template
            assert "type" in template
            assert "default_config" in template
    
    async def test_create_report_from_template(self, client: AsyncClient, auth_headers, report_template_id):
        """测试从模板创建报告"""
        template_report_data = {
            "template_id": report_template_id,
            "title": "Report from Template",
            "date_range": {
                "start_date": "2024-08-01",
                "end_date": "2024-08-31"
            },
            "custom_config": {
                "include_charts": True,
                "chart_types": ["pie", "bar"]
            }
        }
        
        response = await client.post(
            "/api/v1/reports/from-template",
            json=template_report_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert "id" in data
        assert data["title"] == template_report_data["title"]
        assert "template_id" in data
        assert data["template_id"] == report_template_id
    
    @pytest.mark.performance
    async def test_report_generation_performance(self, client: AsyncClient, auth_headers):
        """测试报告生成性能"""
        report_data = {
            "title": "Performance Test Report",
            "type": "email_analysis",
            "date_range": {
                "start_date": "2024-07-01",
                "end_date": "2024-07-31"  # 一个月的数据
            },
            "format": "pdf",
            "include_charts": True
        }
        
        start_time = datetime.now()
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=auth_headers
        )
        
        creation_time = (datetime.now() - start_time).total_seconds()
        
        assert response.status_code == 201
        assert creation_time < 5.0  # 创建报告请求应该在5秒内完成
        
        # 检查报告状态更新性能
        report_id = response.json()["id"]
        
        # 等待报告处理完成 (模拟或检查实际处理)
        max_wait_time = 60  # 最多等待60秒
        wait_start = datetime.now()
        
        while (datetime.now() - wait_start).total_seconds() < max_wait_time:
            status_response = await client.get(
                f"/api/v1/reports/{report_id}",
                headers=auth_headers
            )
            
            if status_response.json()["status"] == "completed":
                break
            
            await asyncio.sleep(2)  # 等待2秒后再检查
        
        total_time = (datetime.now() - start_time).total_seconds()
        assert total_time < max_wait_time  # 总处理时间应该在限制内
    
    async def test_report_data_accuracy(self, client: AsyncClient, auth_headers, known_email_data):
        """测试报告数据准确性"""
        # 创建基于已知数据的报告
        report_data = {
            "title": "Data Accuracy Test Report",
            "type": "email_analysis",
            "date_range": {
                "start_date": known_email_data["date_range"]["start"],
                "end_date": known_email_data["date_range"]["end"]
            },
            "format": "json"  # 使用JSON格式便于验证数据
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        report_id = response.json()["id"]
        
        # 等待报告完成并下载
        # (这里应该有等待逻辑)
        
        download_response = await client.get(
            f"/api/v1/reports/{report_id}/download",
            headers=auth_headers
        )
        
        assert download_response.status_code == 200
        report_data = download_response.json()
        
        # 验证关键数据点
        assert "total_emails" in report_data
        assert "sentiment_distribution" in report_data
        assert "priority_distribution" in report_data
        
        # 根据已知数据验证准确性
        expected_total = known_email_data["expected_total"]
        assert abs(report_data["total_emails"] - expected_total) / expected_total < 0.05  # 5%误差内
    
    async def test_concurrent_report_generation(self, client: AsyncClient, auth_headers):
        """测试并发报告生成"""
        import asyncio
        
        # 创建多个并发报告生成任务
        tasks = []
        for i in range(5):
            report_data = {
                "title": f"Concurrent Report {i}",
                "type": "email_analysis",
                "date_range": {
                    "start_date": "2024-08-01",
                    "end_date": "2024-08-31"
                },
                "format": "pdf"
            }
            
            task = client.post(
                "/api/v1/reports",
                json=report_data,
                headers=auth_headers
            )
            tasks.append(task)
        
        # 执行所有任务
        responses = await asyncio.gather(*tasks)
        
        # 验证所有请求都成功
        for response in responses:
            assert response.status_code == 201
            assert "id" in response.json()
        
        # 验证报告ID都不同
        report_ids = [r.json()["id"] for r in responses]
        assert len(set(report_ids)) == len(report_ids)  # 所有ID都应该唯一
    
    async def test_report_unauthorized_access(self, client: AsyncClient):
        """测试未授权访问报告"""
        # 尝试不带认证访问报告列表
        response = await client.get("/api/v1/reports")
        assert response.status_code == 401
        
        # 尝试不带认证创建报告
        report_data = {
            "title": "Unauthorized Report",
            "type": "email_analysis",
            "date_range": {
                "start_date": "2024-08-01",
                "end_date": "2024-08-31"
            }
        }
        
        response = await client.post(
            "/api/v1/reports",
            json=report_data
        )
        assert response.status_code == 401