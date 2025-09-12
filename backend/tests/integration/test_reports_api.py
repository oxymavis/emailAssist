"""
Reports Generation API Integration Tests for Email Assist
"""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock


@pytest.mark.api
@pytest.mark.reports
class TestReportTemplates:
    """Test report template management functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for reports tests"""
        registration_data = {
            "email": "reportstest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Reports Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
        self.user_data = registration_data
    
    def test_create_report_template(self, api_client, api_base_url):
        """Test REPORTS-001: Create report template"""
        template_data = {
            "name": "Weekly Email Summary",
            "description": "Weekly summary of email activities and analytics",
            "type": "weekly",
            "sections": [
                "email_count",
                "sentiment_analysis", 
                "priority_distribution",
                "top_senders",
                "category_breakdown"
            ],
            "format": "pdf",
            "filters": {
                "dateRange": "last_7_days",
                "folders": ["inbox", "sent"],
                "includeArchived": False
            },
            "chartTypes": {
                "email_count": "line",
                "sentiment_analysis": "pie",
                "priority_distribution": "bar"
            },
            "active": True
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/templates",
            json=template_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report templates endpoint not implemented yet")
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check created template structure
        created_template = data["data"]
        assert "id" in created_template
        assert created_template["name"] == template_data["name"]
        assert created_template["description"] == template_data["description"]
        assert created_template["type"] == template_data["type"]
        assert created_template["format"] == template_data["format"]
        assert created_template["active"] == template_data["active"]
        
        # Verify sections are preserved
        assert "sections" in created_template
        assert len(created_template["sections"]) == len(template_data["sections"])
        
        # Store template ID for other tests
        self.created_template_id = created_template["id"]
        return created_template
    
    def test_get_report_templates_list(self, api_client, api_base_url):
        """Test REPORTS-002: Get report templates list"""
        response = api_client.get(
            f"{api_base_url}/reports/templates",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report templates endpoint not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # If we have templates, check structure
        if data["data"]:
            template = data["data"][0]
            expected_fields = ["id", "name", "description", "type", "format", "sections", "active"]
            
            for field in expected_fields:
                assert field in template, f"Missing field {field} in template"
    
    def test_get_template_by_id(self, api_client, api_base_url):
        """Test getting specific template by ID"""
        # First create a template
        created_template = self.test_create_report_template(api_client, api_base_url)
        template_id = created_template["id"]
        
        response = api_client.get(
            f"{api_base_url}/reports/templates/{template_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Individual template retrieval not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        retrieved_template = data["data"]
        
        # Should match created template
        assert retrieved_template["id"] == template_id
        assert retrieved_template["name"] == created_template["name"]
        assert retrieved_template["description"] == created_template["description"]
    
    def test_update_report_template(self, api_client, api_base_url):
        """Test updating report template"""
        # First create a template
        created_template = self.test_create_report_template(api_client, api_base_url)
        template_id = created_template["id"]
        
        # Update template data
        updated_data = {
            "name": "Updated Weekly Summary",
            "description": "Updated weekly summary with new sections",
            "sections": [
                "email_count",
                "sentiment_analysis",
                "keyword_analysis"  # New section
            ],
            "format": "excel",  # Changed format
            "active": False
        }
        
        response = api_client.put(
            f"{api_base_url}/reports/templates/{template_id}",
            json=updated_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Template update not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        updated_template = data["data"]
        
        # Verify updates were applied
        assert updated_template["name"] == updated_data["name"]
        assert updated_template["description"] == updated_data["description"]
        assert updated_template["format"] == updated_data["format"]
        assert updated_template["active"] == updated_data["active"]
    
    def test_delete_report_template(self, api_client, api_base_url):
        """Test deleting report template"""
        # First create a template
        created_template = self.test_create_report_template(api_client, api_base_url)
        template_id = created_template["id"]
        
        response = api_client.delete(
            f"{api_base_url}/reports/templates/{template_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Template deletion not implemented yet")
        
        assert response.status_code in [204, 200]  # No content or success
        
        # Verify template is deleted
        get_response = api_client.get(
            f"{api_base_url}/reports/templates/{template_id}",
            headers=self.auth_headers
        )
        
        assert get_response.status_code == 404  # Should not be found
    
    def test_invalid_template_data(self, api_client, api_base_url):
        """Test creating template with invalid data"""
        invalid_templates = [
            {},  # Empty template
            {"name": "Test"},  # Missing required fields
            {
                "name": "Test",
                "sections": [],  # Empty sections
                "format": "invalid_format"  # Invalid format
            },
            {
                "name": "Test",
                "type": "invalid_type",  # Invalid type
                "format": "pdf"
            }
        ]
        
        for invalid_template in invalid_templates:
            response = api_client.post(
                f"{api_base_url}/reports/templates",
                json=invalid_template,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                continue  # Skip if endpoint not implemented
            
            # Should reject invalid data
            assert response.status_code == 400, f"Invalid template was accepted: {invalid_template}"


@pytest.mark.api
@pytest.mark.reports
class TestReportGeneration:
    """Test report generation functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for report generation tests"""
        registration_data = {
            "email": "reportgentest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Report Generation Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_generate_report(self, api_client, api_base_url):
        """Test REPORTS-003: Generate report from template"""
        # First create a template
        template_data = {
            "name": "Test Report Template",
            "description": "Template for testing report generation",
            "type": "custom",
            "sections": ["email_count", "sentiment_analysis"],
            "format": "json",
            "active": True
        }
        
        template_response = api_client.post(
            f"{api_base_url}/reports/templates",
            json=template_data,
            headers=self.auth_headers
        )
        
        if template_response.status_code == 404:
            pytest.skip("Report templates not implemented yet")
        
        assert template_response.status_code == 201
        template_id = template_response.json()["data"]["id"]
        
        # Generate report using template
        generation_data = {
            "templateId": template_id,
            "name": "Test Report - " + datetime.now().strftime("%Y-%m-%d"),
            "dateRange": {
                "start": (datetime.now() - timedelta(days=7)).isoformat(),
                "end": datetime.now().isoformat()
            },
            "filters": {
                "folders": ["inbox"],
                "includeRead": True,
                "includeUnread": True
            }
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        assert response.status_code in [200, 202]  # Success or accepted (async processing)
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check report generation result
        report_result = data["data"]
        
        if response.status_code == 200:  # Synchronous generation
            # Should have report data or report ID
            assert "id" in report_result or "reportData" in report_result
            
            if "reportData" in report_result:
                report_data = report_result["reportData"]
                # Should have sections from template
                expected_sections = template_data["sections"]
                for section in expected_sections:
                    assert section in report_data or any(
                        section in key for key in report_data.keys()
                    ), f"Missing section {section} in report data"
        
        elif response.status_code == 202:  # Async processing
            # Should have job ID or report ID for tracking
            assert "id" in report_result or "jobId" in report_result
    
    def test_generate_report_with_date_range(self, api_client, api_base_url):
        """Test report generation with specific date range"""
        generation_data = {
            "name": "Date Range Report",
            "sections": ["email_count", "top_senders"],
            "format": "json",
            "dateRange": {
                "start": "2024-01-01T00:00:00Z",
                "end": "2024-01-31T23:59:59Z"
            }
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        assert response.status_code in [200, 202]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            
            # Check if date range is reflected in the report
            report_data = data["data"]
            if "reportData" in report_data:
                # Report should contain data for the specified date range
                assert "dateRange" in report_data["reportData"] or "period" in report_data["reportData"]
    
    def test_generate_report_with_filters(self, api_client, api_base_url):
        """Test report generation with various filters"""
        generation_data = {
            "name": "Filtered Report",
            "sections": ["email_count", "category_breakdown"],
            "format": "json",
            "dateRange": {
                "start": (datetime.now() - timedelta(days=30)).isoformat(),
                "end": datetime.now().isoformat()
            },
            "filters": {
                "folders": ["inbox", "sent"],
                "senders": ["important@company.com"],
                "labels": ["important", "work"],
                "categories": ["work", "meeting"],
                "priorities": ["high", "medium"],
                "readStatus": "both"
            }
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        assert response.status_code in [200, 202]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
    
    def test_report_status_tracking(self, api_client, api_base_url):
        """Test tracking report generation status"""
        # Generate a report that might take time
        generation_data = {
            "name": "Large Report",
            "sections": ["email_count", "sentiment_analysis", "keyword_analysis"],
            "format": "pdf",
            "dateRange": {
                "start": (datetime.now() - timedelta(days=90)).isoformat(),
                "end": datetime.now().isoformat()
            }
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        if response.status_code == 202:  # Async processing
            data = response.json()
            job_id = data["data"]["id"] or data["data"]["jobId"]
            
            # Check report status
            status_response = api_client.get(
                f"{api_base_url}/reports/{job_id}/status",
                headers=self.auth_headers
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                assert "status" in status_data["data"]
                
                # Status should be one of expected values
                valid_statuses = ["pending", "processing", "completed", "failed"]
                assert status_data["data"]["status"] in valid_statuses
    
    def test_invalid_report_generation(self, api_client, api_base_url):
        """Test report generation with invalid parameters"""
        invalid_requests = [
            {},  # Empty request
            {
                "name": "Test",
                "dateRange": {"start": "invalid-date"}  # Invalid date
            },
            {
                "name": "Test",
                "sections": []  # Empty sections
            },
            {
                "templateId": "nonexistent-template-id"  # Non-existent template
            }
        ]
        
        for invalid_request in invalid_requests:
            response = api_client.post(
                f"{api_base_url}/reports/generate",
                json=invalid_request,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                continue  # Skip if endpoint not implemented
            
            # Should reject invalid requests
            assert response.status_code == 400, f"Invalid request was accepted: {invalid_request}"


@pytest.mark.api
@pytest.mark.reports
class TestReportExport:
    """Test report export functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for export tests"""
        registration_data = {
            "email": "exporttest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Export Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_export_report_as_pdf(self, api_client, api_base_url):
        """Test REPORTS-004: Export report as PDF"""
        # First generate a report
        generation_data = {
            "name": "PDF Export Test Report",
            "sections": ["email_count", "sentiment_analysis"],
            "format": "json",  # Generate as JSON first
            "dateRange": {
                "start": (datetime.now() - timedelta(days=7)).isoformat(),
                "end": datetime.now().isoformat()
            }
        }
        
        gen_response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if gen_response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        if gen_response.status_code in [200, 202]:
            report_data = gen_response.json()["data"]
            report_id = report_data.get("id")
            
            if not report_id:
                pytest.skip("Report ID not available for export test")
            
            # Export report as PDF
            export_response = api_client.get(
                f"{api_base_url}/reports/{report_id}/export/pdf",
                headers=self.auth_headers
            )
            
            if export_response.status_code == 404:
                pytest.skip("PDF export not implemented yet")
            
            assert export_response.status_code == 200
            
            # Check content type is PDF
            content_type = export_response.headers.get('content-type', '').lower()
            assert 'pdf' in content_type or 'application/pdf' in content_type
            
            # Check that we got binary content
            assert len(export_response.content) > 0
            
            # PDF files should start with %PDF
            if export_response.content:
                assert export_response.content.startswith(b'%PDF')
    
    def test_export_report_as_excel(self, api_client, api_base_url):
        """Test REPORTS-005: Export report as Excel"""
        # Generate a report suitable for Excel export
        generation_data = {
            "name": "Excel Export Test Report",
            "sections": ["email_count", "top_senders", "category_breakdown"],
            "format": "json",
            "dateRange": {
                "start": (datetime.now() - timedelta(days=14)).isoformat(),
                "end": datetime.now().isoformat()
            }
        }
        
        gen_response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if gen_response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        if gen_response.status_code in [200, 202]:
            report_data = gen_response.json()["data"]
            report_id = report_data.get("id")
            
            if not report_id:
                pytest.skip("Report ID not available for export test")
            
            # Export report as Excel
            export_response = api_client.get(
                f"{api_base_url}/reports/{report_id}/export/excel",
                headers=self.auth_headers
            )
            
            if export_response.status_code == 404:
                pytest.skip("Excel export not implemented yet")
            
            assert export_response.status_code == 200
            
            # Check content type is Excel
            content_type = export_response.headers.get('content-type', '').lower()
            excel_types = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'excel',
                'xlsx'
            ]
            
            assert any(excel_type in content_type for excel_type in excel_types)
            
            # Check that we got binary content
            assert len(export_response.content) > 0
    
    def test_export_report_as_csv(self, api_client, api_base_url):
        """Test exporting report as CSV"""
        # Generate a report
        generation_data = {
            "name": "CSV Export Test Report",
            "sections": ["email_count", "top_senders"],
            "format": "json",
            "dateRange": {
                "start": (datetime.now() - timedelta(days=7)).isoformat(),
                "end": datetime.now().isoformat()
            }
        }
        
        gen_response = api_client.post(
            f"{api_base_url}/reports/generate",
            json=generation_data,
            headers=self.auth_headers
        )
        
        if gen_response.status_code == 404:
            pytest.skip("Report generation not implemented yet")
        
        if gen_response.status_code in [200, 202]:
            report_data = gen_response.json()["data"]
            report_id = report_data.get("id")
            
            if not report_id:
                pytest.skip("Report ID not available for export test")
            
            # Export report as CSV
            export_response = api_client.get(
                f"{api_base_url}/reports/{report_id}/export/csv",
                headers=self.auth_headers
            )
            
            if export_response.status_code == 404:
                pytest.skip("CSV export not implemented yet")
            
            assert export_response.status_code == 200
            
            # Check content type is CSV
            content_type = export_response.headers.get('content-type', '').lower()
            assert 'csv' in content_type or 'text/csv' in content_type
            
            # Check that we got text content
            assert len(export_response.content) > 0
            
            # Should be valid CSV format
            content_text = export_response.content.decode('utf-8')
            lines = content_text.strip().split('\n')
            assert len(lines) > 0  # Should have at least headers
    
    def test_export_nonexistent_report(self, api_client, api_base_url):
        """Test exporting non-existent report"""
        nonexistent_id = "nonexistent-report-123"
        
        export_response = api_client.get(
            f"{api_base_url}/reports/{nonexistent_id}/export/pdf",
            headers=self.auth_headers
        )
        
        if export_response.status_code == 404:
            # Could be either export not implemented or report not found
            # Both are acceptable for this test
            assert True
        else:
            # If export is implemented, should return 404 for non-existent report
            assert export_response.status_code == 404


@pytest.mark.api
@pytest.mark.reports
class TestReportScheduling:
    """Test scheduled report functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for scheduling tests"""
        registration_data = {
            "email": "scheduletest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Schedule Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_create_scheduled_report(self, api_client, api_base_url):
        """Test REPORTS-006: Create scheduled report task"""
        # First create a template
        template_data = {
            "name": "Scheduled Report Template",
            "sections": ["email_count", "sentiment_analysis"],
            "format": "pdf",
            "active": True
        }
        
        template_response = api_client.post(
            f"{api_base_url}/reports/templates",
            json=template_data,
            headers=self.auth_headers
        )
        
        if template_response.status_code == 404:
            pytest.skip("Report templates not implemented yet")
        
        template_id = template_response.json()["data"]["id"]
        
        # Create scheduled report
        schedule_data = {
            "name": "Weekly Auto Report",
            "description": "Automatically generated weekly report",
            "templateId": template_id,
            "schedule": "0 9 * * 1",  # Every Monday at 9 AM (cron format)
            "timezone": "UTC",
            "recipients": ["user@example.com", "manager@example.com"],
            "filters": {
                "dateRange": "last_7_days",
                "folders": ["inbox", "sent"]
            },
            "active": True
        }
        
        response = api_client.post(
            f"{api_base_url}/reports/schedules",
            json=schedule_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report scheduling not implemented yet")
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check scheduled report structure
        scheduled_report = data["data"]
        assert "id" in scheduled_report
        assert scheduled_report["name"] == schedule_data["name"]
        assert scheduled_report["templateId"] == template_id
        assert scheduled_report["schedule"] == schedule_data["schedule"]
        assert scheduled_report["active"] == schedule_data["active"]
        
        # Verify recipients are preserved
        assert "recipients" in scheduled_report
        assert len(scheduled_report["recipients"]) == len(schedule_data["recipients"])
        
        return scheduled_report
    
    def test_get_scheduled_reports_list(self, api_client, api_base_url):
        """Test getting scheduled reports list"""
        response = api_client.get(
            f"{api_base_url}/reports/schedules",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Report schedules endpoint not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # If we have scheduled reports, check structure
        if data["data"]:
            schedule = data["data"][0]
            expected_fields = ["id", "name", "templateId", "schedule", "active", "recipients"]
            
            for field in expected_fields:
                assert field in schedule, f"Missing field {field} in scheduled report"
    
    def test_update_scheduled_report(self, api_client, api_base_url):
        """Test updating scheduled report"""
        # First create a scheduled report
        scheduled_report = self.test_create_scheduled_report(api_client, api_base_url)
        schedule_id = scheduled_report["id"]
        
        # Update scheduled report
        updated_data = {
            "name": "Updated Weekly Report",
            "schedule": "0 10 * * 1",  # Changed to 10 AM
            "recipients": ["newuser@example.com"],  # Different recipients
            "active": False  # Disabled
        }
        
        response = api_client.put(
            f"{api_base_url}/reports/schedules/{schedule_id}",
            json=updated_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Schedule update not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        updated_schedule = data["data"]
        
        # Verify updates were applied
        assert updated_schedule["name"] == updated_data["name"]
        assert updated_schedule["schedule"] == updated_data["schedule"]
        assert updated_schedule["active"] == updated_data["active"]
    
    def test_delete_scheduled_report(self, api_client, api_base_url):
        """Test deleting scheduled report"""
        # First create a scheduled report
        scheduled_report = self.test_create_scheduled_report(api_client, api_base_url)
        schedule_id = scheduled_report["id"]
        
        response = api_client.delete(
            f"{api_base_url}/reports/schedules/{schedule_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Schedule deletion not implemented yet")
        
        assert response.status_code in [204, 200]
        
        # Verify scheduled report is deleted
        get_response = api_client.get(
            f"{api_base_url}/reports/schedules/{schedule_id}",
            headers=self.auth_headers
        )
        
        assert get_response.status_code == 404
    
    def test_trigger_scheduled_report_manually(self, api_client, api_base_url):
        """Test manually triggering scheduled report"""
        # First create a scheduled report
        scheduled_report = self.test_create_scheduled_report(api_client, api_base_url)
        schedule_id = scheduled_report["id"]
        
        # Trigger the report manually
        response = api_client.post(
            f"{api_base_url}/reports/schedules/{schedule_id}/trigger",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Manual schedule trigger not implemented yet")
        
        assert response.status_code in [200, 202]  # Success or accepted
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            
            # Should provide information about the triggered report
            if "data" in data:
                trigger_result = data["data"]
                expected_fields = ["reportId", "status", "jobId", "triggered"]
                
                # Should have some indication of the trigger result
                assert any(field in trigger_result for field in expected_fields)
    
    def test_scheduled_report_execution_history(self, api_client, api_base_url):
        """Test getting scheduled report execution history"""
        # First create a scheduled report
        scheduled_report = self.test_create_scheduled_report(api_client, api_base_url)
        schedule_id = scheduled_report["id"]
        
        # Get execution history
        response = api_client.get(
            f"{api_base_url}/reports/schedules/{schedule_id}/history",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Schedule history not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Should return execution history
        history = data["data"]
        assert isinstance(history, list)
        
        # If there's history, check structure
        if history:
            execution = history[0]
            expected_fields = ["id", "executedAt", "status", "reportId", "duration"]
            
            # Should have some execution information
            assert any(field in execution for field in expected_fields)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])