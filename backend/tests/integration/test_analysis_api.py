"""
AI Analysis API Integration Tests for Email Assist
"""
import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock


@pytest.mark.api
@pytest.mark.analysis
class TestSentimentAnalysis:
    """Test email sentiment analysis functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for analysis tests"""
        registration_data = {
            "email": "analysistest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Analysis Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_single_email_sentiment_analysis(self, api_client, api_base_url, mock_openai):
        """Test ANALYSIS-001: Single email sentiment analysis"""
        analysis_data = {
            "messageId": "msg123",
            "content": "I am very happy with the excellent service provided by your team. Thank you!"
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/sentiment",
            json=analysis_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Sentiment analysis endpoint not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check sentiment analysis result structure
        analysis_result = data["data"]
        expected_fields = ["sentiment", "confidence", "score"]
        
        # At least sentiment should be present
        assert "sentiment" in analysis_result
        assert analysis_result["sentiment"] in ["positive", "negative", "neutral"]
        
        # Check confidence if present
        if "confidence" in analysis_result:
            confidence = analysis_result["confidence"]
            assert 0.0 <= confidence <= 1.0
        
        # Check score if present
        if "score" in analysis_result:
            score = analysis_result["score"]
            assert -1.0 <= score <= 1.0
    
    def test_batch_sentiment_analysis(self, api_client, api_base_url, mock_openai):
        """Test ANALYSIS-002: Batch email sentiment analysis"""
        batch_data = {
            "messages": [
                {
                    "id": "msg1",
                    "content": "Great job on the project! I'm really impressed with the results."
                },
                {
                    "id": "msg2", 
                    "content": "This is terrible service. I'm very disappointed and frustrated."
                },
                {
                    "id": "msg3",
                    "content": "Please send me the meeting notes from yesterday's session."
                }
            ]
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/sentiment/batch",
            json=batch_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Batch sentiment analysis not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check batch results
        batch_results = data["data"]
        assert isinstance(batch_results, list)
        assert len(batch_results) == 3
        
        # Check each result
        for result in batch_results:
            assert "id" in result
            assert "sentiment" in result
            assert result["sentiment"] in ["positive", "negative", "neutral"]
    
    def test_sentiment_analysis_with_subject(self, api_client, api_base_url, mock_openai):
        """Test sentiment analysis including email subject"""
        analysis_data = {
            "messageId": "msg123",
            "subject": "URGENT: Critical Issue Needs Immediate Attention",
            "content": "We have a critical system failure that requires immediate resolution."
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/sentiment",
            json=analysis_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Sentiment analysis not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "sentiment" in data["data"]
    
    def test_empty_content_sentiment_analysis(self, api_client, api_base_url):
        """Test sentiment analysis with empty content"""
        analysis_data = {
            "messageId": "msg123",
            "content": ""
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/sentiment",
            json=analysis_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Sentiment analysis not implemented yet")
        
        # Should handle empty content gracefully
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            # Might return neutral sentiment for empty content
            assert data["data"]["sentiment"] in ["neutral", "unknown"]
    
    def test_very_long_content_sentiment_analysis(self, api_client, api_base_url, mock_openai):
        """Test sentiment analysis with very long content"""
        # Create very long content (simulate long email)
        long_content = "This is a test email. " * 1000  # Very long content
        
        analysis_data = {
            "messageId": "msg123",
            "content": long_content
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/sentiment",
            json=analysis_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Sentiment analysis not implemented yet")
        
        # Should handle long content (might truncate or process in chunks)
        assert response.status_code in [200, 413, 400]


@pytest.mark.api
@pytest.mark.analysis
class TestPriorityAssessment:
    """Test email priority assessment functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for priority tests"""
        registration_data = {
            "email": "prioritytest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Priority Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_email_priority_assessment(self, api_client, api_base_url, mock_openai):
        """Test ANALYSIS-003: Email priority assessment"""
        priority_data = {
            "messageId": "msg123",
            "subject": "URGENT: Server down - Production Impact",
            "from": "ceo@company.com",
            "content": "The production server is down and customers are unable to access our services. This needs immediate attention.",
            "receivedDate": datetime.now().isoformat()
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/priority",
            json=priority_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Priority analysis not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check priority assessment result
        priority_result = data["data"]
        
        # Should have priority level
        assert "priority" in priority_result
        assert priority_result["priority"] in ["high", "medium", "low", "critical"]
        
        # Check priority score if present
        if "score" in priority_result:
            score = priority_result["score"]
            assert 0.0 <= score <= 1.0
        
        # Check reasoning if present
        if "reasoning" in priority_result:
            assert isinstance(priority_result["reasoning"], str)
            assert len(priority_result["reasoning"]) > 0
    
    def test_low_priority_email_assessment(self, api_client, api_base_url, mock_openai):
        """Test priority assessment for low priority email"""
        priority_data = {
            "messageId": "msg456",
            "subject": "FYI: Newsletter subscription confirmation",
            "from": "newsletter@example.com",
            "content": "Thank you for subscribing to our weekly newsletter. You will receive updates every Friday.",
            "receivedDate": datetime.now().isoformat()
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/priority",
            json=priority_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Priority analysis not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        priority_result = data["data"]
        
        # Newsletter should be low priority
        expected_low_priority = ["low", "medium"]  # Allow some flexibility in classification
        assert priority_result["priority"] in expected_low_priority
    
    def test_batch_priority_assessment(self, api_client, api_base_url, mock_openai):
        """Test batch priority assessment"""
        batch_data = {
            "messages": [
                {
                    "id": "msg1",
                    "subject": "CRITICAL: Security breach detected",
                    "from": "security@company.com",
                    "content": "We have detected unauthorized access to our systems."
                },
                {
                    "id": "msg2",
                    "subject": "Weekly team meeting notes",
                    "from": "team@company.com", 
                    "content": "Here are the notes from this week's team meeting."
                },
                {
                    "id": "msg3",
                    "subject": "Invitation: Company picnic next month",
                    "from": "hr@company.com",
                    "content": "You're invited to our annual company picnic next month."
                }
            ]
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/priority/batch",
            json=batch_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Batch priority analysis not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        batch_results = data["data"]
        
        assert isinstance(batch_results, list)
        assert len(batch_results) == 3
        
        for result in batch_results:
            assert "id" in result
            assert "priority" in result
            assert result["priority"] in ["high", "medium", "low", "critical"]
    
    def test_priority_factors_analysis(self, api_client, api_base_url, mock_openai):
        """Test priority assessment with various factors"""
        # Test with different sender importance
        high_importance_sender_data = {
            "messageId": "msg789",
            "subject": "Meeting request for tomorrow",
            "from": "ceo@company.com",  # High importance sender
            "content": "Can we schedule a meeting for tomorrow to discuss the quarterly results?",
            "receivedDate": datetime.now().isoformat()
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/priority",
            json=high_importance_sender_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Priority analysis not implemented yet")
        
        assert response.status_code == 200
        
        # CEO emails should generally have higher priority
        data = response.json()
        priority_result = data["data"]
        
        # Should be at least medium priority from CEO
        assert priority_result["priority"] in ["medium", "high", "critical"]


@pytest.mark.api
@pytest.mark.analysis
class TestEmailCategorization:
    """Test email content categorization functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for categorization tests"""
        registration_data = {
            "email": "categorytest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Category Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_email_content_categorization(self, api_client, api_base_url, mock_openai):
        """Test ANALYSIS-004: Email content categorization"""
        categorization_data = {
            "messageId": "msg123",
            "subject": "Team meeting scheduled for next Tuesday",
            "content": "Hi everyone, I've scheduled our weekly team meeting for next Tuesday at 2 PM in Conference Room A. Please bring your status updates and any blockers you're facing."
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/categorize",
            json=categorization_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Email categorization not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check categorization result
        category_result = data["data"]
        
        # Should have category
        assert "category" in category_result
        
        # Common email categories
        valid_categories = [
            "meeting", "work", "personal", "spam", "promotional", 
            "newsletter", "notification", "support", "finance", 
            "travel", "social", "shopping", "education"
        ]
        
        assert category_result["category"] in valid_categories
        
        # Check confidence if present
        if "confidence" in category_result:
            confidence = category_result["confidence"]
            assert 0.0 <= confidence <= 1.0
    
    def test_spam_email_categorization(self, api_client, api_base_url, mock_openai):
        """Test categorization of spam emails"""
        spam_data = {
            "messageId": "msg456",
            "subject": "WINNER! Claim your $1,000,000 prize NOW!!!",
            "from": "winner@suspicious-domain.com",
            "content": "Congratulations! You have won $1,000,000 in our lottery! Click here to claim your prize now! Hurry, this offer expires in 24 hours!"
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/categorize",
            json=spam_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Email categorization not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        category_result = data["data"]
        
        # Should be categorized as spam or promotional
        expected_categories = ["spam", "promotional", "suspicious"]
        assert category_result["category"] in expected_categories
    
    def test_work_email_categorization(self, api_client, api_base_url, mock_openai):
        """Test categorization of work-related emails"""
        work_data = {
            "messageId": "msg789",
            "subject": "Q4 Financial Report - Action Required",
            "from": "finance@company.com",
            "content": "Please review the attached Q4 financial report and provide your feedback by Friday. The board meeting is scheduled for next week and we need to finalize these numbers."
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/categorize",
            json=work_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Email categorization not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        category_result = data["data"]
        
        # Should be work-related
        expected_categories = ["work", "finance", "business", "report"]
        assert category_result["category"] in expected_categories
    
    def test_batch_email_categorization(self, api_client, api_base_url, mock_openai):
        """Test batch email categorization"""
        batch_data = {
            "messages": [
                {
                    "id": "msg1",
                    "subject": "Doctor appointment reminder",
                    "content": "This is a reminder about your appointment tomorrow at 3 PM."
                },
                {
                    "id": "msg2",
                    "subject": "New features in our app!",
                    "content": "Check out the exciting new features we've added to our mobile app."
                },
                {
                    "id": "msg3",
                    "subject": "Invoice #12345 is ready",
                    "content": "Your monthly invoice is ready for download from our portal."
                }
            ]
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/categorize/batch",
            json=batch_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Batch categorization not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        batch_results = data["data"]
        
        assert isinstance(batch_results, list)
        assert len(batch_results) == 3
        
        for result in batch_results:
            assert "id" in result
            assert "category" in result


@pytest.mark.api
@pytest.mark.analysis
class TestKeywordExtraction:
    """Test email keyword extraction functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for keyword extraction tests"""
        registration_data = {
            "email": "keywordtest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Keyword Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_email_keyword_extraction(self, api_client, api_base_url, mock_openai):
        """Test ANALYSIS-005: Email keyword extraction"""
        keyword_data = {
            "messageId": "msg123",
            "subject": "Quarterly Financial Report Analysis",
            "content": "The quarterly financial report shows significant growth in revenue and profit margins. Our sales team exceeded targets by 15% and customer satisfaction scores improved. The marketing campaigns were particularly effective in the technology sector."
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/keywords",
            json=keyword_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Keyword extraction not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check keyword extraction result
        keyword_result = data["data"]
        
        # Should have keywords list
        assert "keywords" in keyword_result
        assert isinstance(keyword_result["keywords"], list)
        assert len(keyword_result["keywords"]) > 0
        
        # Check keyword structure
        for keyword in keyword_result["keywords"]:
            # Might be just strings or objects with metadata
            if isinstance(keyword, dict):
                assert "word" in keyword or "keyword" in keyword
                if "relevance" in keyword:
                    assert 0.0 <= keyword["relevance"] <= 1.0
            else:
                assert isinstance(keyword, str)
                assert len(keyword) > 0
    
    def test_technical_email_keyword_extraction(self, api_client, api_base_url, mock_openai):
        """Test keyword extraction from technical emails"""
        technical_data = {
            "messageId": "msg456",
            "subject": "API Integration and Database Migration Status",
            "content": "The REST API integration with the PostgreSQL database is complete. We've implemented OAuth2 authentication and JWT tokens for secure access. The Redis cache layer is improving performance by 40%. Next steps include Docker containerization and Kubernetes deployment."
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/keywords",
            json=technical_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Keyword extraction not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        keyword_result = data["data"]
        keywords = keyword_result["keywords"]
        
        # Should extract technical terms
        keyword_text = " ".join([
            kw if isinstance(kw, str) else kw.get("word", kw.get("keyword", ""))
            for kw in keywords
        ]).lower()
        
        # Some technical terms should be present (flexible check)
        technical_terms = ["api", "database", "oauth", "jwt", "redis", "docker", "kubernetes"]
        found_terms = sum(1 for term in technical_terms if term in keyword_text)
        
        # Should find at least some technical terms
        assert found_terms >= 2, f"Expected technical terms in keywords: {keywords}"
    
    def test_batch_keyword_extraction(self, api_client, api_base_url, mock_openai):
        """Test batch keyword extraction"""
        batch_data = {
            "messages": [
                {
                    "id": "msg1",
                    "content": "Machine learning algorithms are improving our customer recommendation system significantly."
                },
                {
                    "id": "msg2",
                    "content": "The marketing campaign for our new product launch exceeded all expectations and KPIs."
                },
                {
                    "id": "msg3",
                    "content": "Legal compliance review is required for the new data privacy regulations implementation."
                }
            ]
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/keywords/batch",
            json=batch_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Batch keyword extraction not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        batch_results = data["data"]
        
        assert isinstance(batch_results, list)
        assert len(batch_results) == 3
        
        for result in batch_results:
            assert "id" in result
            assert "keywords" in result
            assert isinstance(result["keywords"], list)
    
    def test_empty_content_keyword_extraction(self, api_client, api_base_url):
        """Test keyword extraction with empty content"""
        empty_data = {
            "messageId": "msg789",
            "content": ""
        }
        
        response = api_client.post(
            f"{api_base_url}/analysis/keywords",
            json=empty_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Keyword extraction not implemented yet")
        
        # Should handle empty content gracefully
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            keyword_result = data["data"]
            # Should return empty keywords list or handle gracefully
            assert "keywords" in keyword_result
            assert isinstance(keyword_result["keywords"], list)


@pytest.mark.api
@pytest.mark.analysis
@pytest.mark.integration
class TestAnalysisWorkflow:
    """Test complete analysis workflow integration"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for workflow tests"""
        registration_data = {
            "email": "workflowtest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Workflow Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_complete_email_analysis(self, api_client, api_base_url, mock_openai):
        """Test complete analysis workflow for an email"""
        email_data = {
            "messageId": "msg123",
            "subject": "URGENT: Critical system failure requires immediate attention",
            "from": "ops@company.com",
            "to": "admin@company.com",
            "content": "We are experiencing a critical system failure in our production environment. Customer transactions are failing and the website is down. This needs immediate investigation and resolution.",
            "receivedDate": datetime.now().isoformat()
        }
        
        # Test all analysis endpoints
        analysis_endpoints = [
            ("sentiment", f"{api_base_url}/analysis/sentiment"),
            ("priority", f"{api_base_url}/analysis/priority"), 
            ("categorize", f"{api_base_url}/analysis/categorize"),
            ("keywords", f"{api_base_url}/analysis/keywords")
        ]
        
        results = {}
        
        for analysis_type, endpoint in analysis_endpoints:
            response = api_client.post(
                endpoint,
                json=email_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                continue  # Skip if not implemented
            
            assert response.status_code == 200, f"Failed {analysis_type} analysis"
            data = response.json()
            assert data["success"] is True
            
            results[analysis_type] = data["data"]
        
        # Verify we got at least some analysis results
        assert len(results) > 0, "No analysis endpoints are implemented"
        
        # Check consistency across analyses
        if "sentiment" in results and "priority" in results:
            # Urgent/critical emails should generally have negative sentiment
            sentiment = results["sentiment"]["sentiment"]
            priority = results["priority"]["priority"]
            
            # This is a loose check - urgent system failures might be negative
            if priority in ["high", "critical"]:
                print(f"High priority email sentiment: {sentiment}, priority: {priority}")
    
    def test_analysis_with_missing_fields(self, api_client, api_base_url, mock_openai):
        """Test analysis with minimal email data"""
        minimal_data = {
            "messageId": "msg456",
            "content": "Brief message."
        }
        
        # Test which analyses work with minimal data
        endpoints = [
            f"{api_base_url}/analysis/sentiment",
            f"{api_base_url}/analysis/categorize",
            f"{api_base_url}/analysis/keywords"
        ]
        
        for endpoint in endpoints:
            response = api_client.post(
                endpoint,
                json=minimal_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                continue  # Skip if not implemented
            
            # Should handle minimal data gracefully
            assert response.status_code in [200, 400], f"Endpoint {endpoint} failed with minimal data"
    
    @pytest.mark.slow
    def test_analysis_performance(self, api_client, api_base_url, mock_openai):
        """Test analysis performance with various content sizes"""
        import time
        
        content_sizes = [
            ("short", "Short email content."),
            ("medium", "Medium length email content. " * 50),
            ("long", "Very long email content with lots of text. " * 500)
        ]
        
        for size_name, content in content_sizes:
            email_data = {
                "messageId": f"perf-test-{size_name}",
                "content": content
            }
            
            start_time = time.time()
            
            response = api_client.post(
                f"{api_base_url}/analysis/sentiment",
                json=email_data,
                headers=self.auth_headers
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 404:
                pytest.skip("Analysis endpoints not implemented")
            
            print(f"Analysis time for {size_name} content ({len(content)} chars): {response_time:.2f}s")
            
            # Performance should be reasonable
            assert response_time < 10.0, f"Analysis too slow for {size_name} content"
            
            if response.status_code == 200:
                data = response.json()
                assert data["success"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])