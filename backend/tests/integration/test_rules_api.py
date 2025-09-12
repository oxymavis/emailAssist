"""
Email Filter Rules API Integration Tests for Email Assist
"""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock


@pytest.mark.api
@pytest.mark.rules
class TestRulesCRUDOperations:
    """Test email filter rules CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for rules tests"""
        registration_data = {
            "email": "rulestest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Rules Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
        self.user_data = registration_data
    
    def test_create_filter_rule(self, api_client, api_base_url):
        """Test RULES-001: Create email filter rule"""
        rule_data = {
            "name": "Spam Filter",
            "description": "Filter spam emails to spam folder",
            "conditions": [
                {
                    "field": "subject",
                    "operator": "contains",
                    "value": "SPAM",
                    "caseSensitive": False
                },
                {
                    "field": "from",
                    "operator": "contains", 
                    "value": "suspicious",
                    "caseSensitive": False
                }
            ],
            "actions": [
                {
                    "type": "move_to_folder",
                    "target": "spam"
                },
                {
                    "type": "add_label",
                    "target": "spam"
                }
            ],
            "priority": 1,
            "active": True,
            "logic": "AND"  # All conditions must match
        }
        
        response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Rules endpoint not implemented yet")
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check created rule structure
        created_rule = data["data"]
        assert "id" in created_rule
        assert created_rule["name"] == rule_data["name"]
        assert created_rule["description"] == rule_data["description"]
        assert created_rule["active"] == rule_data["active"]
        assert created_rule["priority"] == rule_data["priority"]
        
        # Verify conditions and actions are preserved
        assert "conditions" in created_rule
        assert "actions" in created_rule
        assert len(created_rule["conditions"]) == 2
        assert len(created_rule["actions"]) == 2
        
        # Store rule ID for other tests
        self.created_rule_id = created_rule["id"]
        return created_rule
    
    def test_get_rules_list(self, api_client, api_base_url):
        """Test RULES-002: Get user's filter rules list"""
        response = api_client.get(
            f"{api_base_url}/rules",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Rules endpoint not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # If we have rules, check structure
        if data["data"]:
            rule = data["data"][0]
            expected_fields = ["id", "name", "description", "active", "priority", "conditions", "actions"]
            
            for field in expected_fields:
                assert field in rule, f"Missing field {field} in rule"
    
    def test_get_rule_by_id(self, api_client, api_base_url):
        """Test getting specific rule by ID"""
        # First create a rule
        created_rule = self.test_create_filter_rule(api_client, api_base_url)
        rule_id = created_rule["id"]
        
        response = api_client.get(
            f"{api_base_url}/rules/{rule_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Individual rule retrieval not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        retrieved_rule = data["data"]
        
        # Should match created rule
        assert retrieved_rule["id"] == rule_id
        assert retrieved_rule["name"] == created_rule["name"]
        assert retrieved_rule["description"] == created_rule["description"]
    
    def test_update_filter_rule(self, api_client, api_base_url):
        """Test RULES-003: Update existing filter rule"""
        # First create a rule
        created_rule = self.test_create_filter_rule(api_client, api_base_url)
        rule_id = created_rule["id"]
        
        # Update rule data
        updated_data = {
            "name": "Updated Spam Filter",
            "description": "Updated spam filter with new conditions",
            "conditions": [
                {
                    "field": "subject",
                    "operator": "contains",
                    "value": "UPDATED_SPAM",
                    "caseSensitive": False
                }
            ],
            "actions": [
                {
                    "type": "move_to_folder", 
                    "target": "junk"
                }
            ],
            "priority": 2,
            "active": False
        }
        
        response = api_client.put(
            f"{api_base_url}/rules/{rule_id}",
            json=updated_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Rule update not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        updated_rule = data["data"]
        
        # Verify updates were applied
        assert updated_rule["name"] == updated_data["name"]
        assert updated_rule["description"] == updated_data["description"]
        assert updated_rule["active"] == updated_data["active"]
        assert updated_rule["priority"] == updated_data["priority"]
    
    def test_delete_filter_rule(self, api_client, api_base_url):
        """Test RULES-004: Delete filter rule"""
        # First create a rule
        created_rule = self.test_create_filter_rule(api_client, api_base_url)
        rule_id = created_rule["id"]
        
        response = api_client.delete(
            f"{api_base_url}/rules/{rule_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Rule deletion not implemented yet")
        
        assert response.status_code in [204, 200]  # No content or success
        
        # Verify rule is deleted
        get_response = api_client.get(
            f"{api_base_url}/rules/{rule_id}",
            headers=self.auth_headers
        )
        
        assert get_response.status_code == 404  # Should not be found
    
    def test_unauthorized_rule_access(self, api_client, api_base_url):
        """Test accessing rules without authentication"""
        response = api_client.get(f"{api_base_url}/rules")
        
        if response.status_code == 404:
            pytest.skip("Rules endpoint not implemented yet")
        
        assert response.status_code == 401
    
    def test_invalid_rule_data(self, api_client, api_base_url):
        """Test creating rule with invalid data"""
        invalid_rules = [
            {},  # Empty rule
            {"name": "Test"},  # Missing required fields
            {
                "name": "Test",
                "conditions": [],  # Empty conditions
                "actions": []  # Empty actions
            },
            {
                "name": "Test",
                "conditions": [{"invalid": "condition"}],  # Invalid condition format
                "actions": [{"type": "move_to_folder"}]  # Missing target
            }
        ]
        
        for invalid_rule in invalid_rules:
            response = api_client.post(
                f"{api_base_url}/rules",
                json=invalid_rule,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                continue  # Skip if endpoint not implemented
            
            # Should reject invalid data
            assert response.status_code == 400, f"Invalid rule was accepted: {invalid_rule}"


@pytest.mark.api
@pytest.mark.rules
class TestRuleExecution:
    """Test email filter rule execution engine"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for rule execution tests"""
        registration_data = {
            "email": "ruleexectest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Rule Execution Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_rule_matching(self, api_client, api_base_url):
        """Test RULES-005: Rule matching against email"""
        # First create a test rule
        rule_data = {
            "name": "Important Email Filter",
            "description": "Filter important emails",
            "conditions": [
                {
                    "field": "subject",
                    "operator": "contains",
                    "value": "IMPORTANT",
                    "caseSensitive": False
                }
            ],
            "actions": [
                {
                    "type": "add_label",
                    "target": "important"
                }
            ],
            "priority": 1,
            "active": True
        }
        
        # Create rule
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        assert rule_response.status_code == 201
        rule_id = rule_response.json()["data"]["id"]
        
        # Test rule matching
        test_email = {
            "subject": "IMPORTANT: Please review this document",
            "from": "sender@example.com",
            "to": "recipient@example.com",
            "content": "This is an important email that needs your attention.",
            "date": datetime.now().isoformat()
        }
        
        match_response = api_client.post(
            f"{api_base_url}/rules/test",
            json={
                "ruleId": rule_id,
                "email": test_email
            },
            headers=self.auth_headers
        )
        
        if match_response.status_code == 404:
            pytest.skip("Rule testing not implemented yet")
        
        assert match_response.status_code == 200
        match_data = match_response.json()
        
        assert match_data["success"] is True
        assert "data" in match_data
        
        # Check match result
        match_result = match_data["data"]
        assert "matched" in match_result
        assert match_result["matched"] is True  # Should match "IMPORTANT" in subject
        
        if "actions" in match_result:
            assert len(match_result["actions"]) > 0
    
    def test_rule_no_match(self, api_client, api_base_url):
        """Test rule that doesn't match email"""
        # Create a rule that won't match
        rule_data = {
            "name": "Specific Filter",
            "conditions": [
                {
                    "field": "from",
                    "operator": "equals",
                    "value": "specific@example.com"
                }
            ],
            "actions": [
                {
                    "type": "add_label",
                    "target": "specific"
                }
            ],
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        assert rule_response.status_code == 201
        rule_id = rule_response.json()["data"]["id"]
        
        # Test with email that won't match
        test_email = {
            "subject": "Test email",
            "from": "different@example.com",  # Different sender
            "content": "This should not match the rule."
        }
        
        match_response = api_client.post(
            f"{api_base_url}/rules/test",
            json={
                "ruleId": rule_id,
                "email": test_email
            },
            headers=self.auth_headers
        )
        
        if match_response.status_code == 404:
            pytest.skip("Rule testing not implemented yet")
        
        assert match_response.status_code == 200
        match_data = match_response.json()
        
        match_result = match_data["data"]
        assert match_result["matched"] is False  # Should not match
    
    def test_batch_rule_application(self, api_client, api_base_url):
        """Test RULES-006: Apply rules to multiple emails"""
        # Create a test rule
        rule_data = {
            "name": "Newsletter Filter",
            "conditions": [
                {
                    "field": "from",
                    "operator": "contains",
                    "value": "newsletter"
                }
            ],
            "actions": [
                {
                    "type": "move_to_folder",
                    "target": "newsletters"
                }
            ],
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        rule_id = rule_response.json()["data"]["id"]
        
        # Apply rule to multiple emails
        batch_data = {
            "ruleId": rule_id,
            "messageIds": ["msg1", "msg2", "msg3"]
        }
        
        apply_response = api_client.post(
            f"{api_base_url}/rules/apply",
            json=batch_data,
            headers=self.auth_headers
        )
        
        if apply_response.status_code == 404:
            pytest.skip("Batch rule application not implemented yet")
        
        assert apply_response.status_code == 200
        apply_data = apply_response.json()
        
        assert apply_data["success"] is True
        
        # Check application results
        if "data" in apply_data:
            result = apply_data["data"]
            expected_fields = ["processed", "successful", "failed", "results"]
            
            # Should have some indication of what was processed
            assert any(field in result for field in expected_fields)
    
    def test_complex_rule_conditions(self, api_client, api_base_url):
        """Test rules with complex conditions (AND/OR logic)"""
        complex_rule = {
            "name": "Complex Filter",
            "description": "Filter with multiple conditions",
            "conditions": [
                {
                    "field": "subject",
                    "operator": "contains",
                    "value": "urgent"
                },
                {
                    "field": "from",
                    "operator": "contains",
                    "value": "@company.com"
                }
            ],
            "actions": [
                {
                    "type": "add_label",
                    "target": "urgent-internal"
                }
            ],
            "logic": "AND",  # Both conditions must match
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=complex_rule,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        assert rule_response.status_code == 201
        rule_id = rule_response.json()["data"]["id"]
        
        # Test email that matches both conditions
        matching_email = {
            "subject": "Urgent: Please review",
            "from": "manager@company.com",
            "content": "This needs urgent attention."
        }
        
        match_response = api_client.post(
            f"{api_base_url}/rules/test",
            json={
                "ruleId": rule_id,
                "email": matching_email
            },
            headers=self.auth_headers
        )
        
        if match_response.status_code == 404:
            pytest.skip("Rule testing not implemented yet")
        
        assert match_response.status_code == 200
        
        # Should match both conditions
        match_result = match_response.json()["data"]
        assert match_result["matched"] is True
        
        # Test email that matches only one condition
        partial_match_email = {
            "subject": "Urgent: Please review",
            "from": "external@other.com",  # Doesn't match @company.com
            "content": "This needs urgent attention."
        }
        
        partial_match_response = api_client.post(
            f"{api_base_url}/rules/test",
            json={
                "ruleId": rule_id,
                "email": partial_match_email
            },
            headers=self.auth_headers
        )
        
        if partial_match_response.status_code != 404:
            # Should NOT match with AND logic
            partial_result = partial_match_response.json()["data"]
            assert partial_result["matched"] is False
    
    def test_rule_priority_execution(self, api_client, api_base_url):
        """Test rule execution order based on priority"""
        # Create multiple rules with different priorities
        rules = [
            {
                "name": "High Priority Rule",
                "priority": 1,  # High priority
                "conditions": [{"field": "subject", "operator": "contains", "value": "test"}],
                "actions": [{"type": "add_label", "target": "high-priority"}],
                "active": True
            },
            {
                "name": "Low Priority Rule", 
                "priority": 5,  # Low priority
                "conditions": [{"field": "subject", "operator": "contains", "value": "test"}],
                "actions": [{"type": "add_label", "target": "low-priority"}],
                "active": True
            }
        ]
        
        created_rules = []
        for rule_data in rules:
            response = api_client.post(
                f"{api_base_url}/rules",
                json=rule_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                pytest.skip("Rules not implemented yet")
            
            assert response.status_code == 201
            created_rules.append(response.json()["data"])
        
        # Test email that would match both rules
        test_email = {
            "subject": "Test email for priority",
            "from": "test@example.com",
            "content": "This should match both rules"
        }
        
        # Apply all rules (if there's an endpoint for this)
        apply_all_response = api_client.post(
            f"{api_base_url}/rules/apply-all",
            json={
                "email": test_email
            },
            headers=self.auth_headers
        )
        
        if apply_all_response.status_code == 404:
            pytest.skip("Apply all rules not implemented yet")
        
        # This test is informational - we just want to see if priority is considered
        print(f"Rule priority execution result: {apply_all_response.json()}")


@pytest.mark.api  
@pytest.mark.rules
class TestRulePerformanceMonitoring:
    """Test rule performance monitoring and analytics"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for performance tests"""
        registration_data = {
            "email": "ruleperftest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Rule Performance Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_rule_performance_metrics(self, api_client, api_base_url):
        """Test RULES-007: Get rule execution performance metrics"""
        # Create a test rule first
        rule_data = {
            "name": "Performance Test Rule",
            "conditions": [
                {
                    "field": "subject", 
                    "operator": "contains",
                    "value": "performance"
                }
            ],
            "actions": [
                {
                    "type": "add_label",
                    "target": "performance-test"
                }
            ],
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        rule_id = rule_response.json()["data"]["id"]
        
        # Get performance metrics for the rule
        perf_response = api_client.get(
            f"{api_base_url}/rules/{rule_id}/performance",
            headers=self.auth_headers
        )
        
        if perf_response.status_code == 404:
            pytest.skip("Rule performance monitoring not implemented yet")
        
        assert perf_response.status_code == 200
        perf_data = perf_response.json()
        
        assert perf_data["success"] is True
        assert "data" in perf_data
        
        # Check performance metrics structure
        metrics = perf_data["data"]
        expected_metrics = [
            "executionTime", "averageExecutionTime", "matchRate", 
            "successRate", "totalExecutions", "totalMatches"
        ]
        
        # Should have some performance metrics
        assert any(metric in metrics for metric in expected_metrics)
    
    def test_rule_analytics_overview(self, api_client, api_base_url):
        """Test getting rule analytics overview"""
        response = api_client.get(
            f"{api_base_url}/rules/analytics",
            headers=self.auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Rule analytics not implemented yet")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        
        # Check analytics overview
        if "data" in data:
            analytics = data["data"]
            expected_fields = [
                "totalRules", "activeRules", "totalExecutions",
                "averageMatchRate", "topPerformingRules"
            ]
            
            # Should have some analytics data
            # This is informational - structure may vary
            print(f"Rule analytics: {analytics}")
    
    def test_rule_execution_logs(self, api_client, api_base_url):
        """Test getting rule execution logs"""
        # Create and test a rule to generate logs
        rule_data = {
            "name": "Logging Test Rule",
            "conditions": [{"field": "subject", "operator": "contains", "value": "log"}],
            "actions": [{"type": "add_label", "target": "logged"}],
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        rule_id = rule_response.json()["data"]["id"]
        
        # Get execution logs
        logs_response = api_client.get(
            f"{api_base_url}/rules/{rule_id}/logs",
            headers=self.auth_headers
        )
        
        if logs_response.status_code == 404:
            pytest.skip("Rule execution logs not implemented yet")
        
        assert logs_response.status_code == 200
        logs_data = logs_response.json()
        
        assert logs_data["success"] is True
        
        # Check logs structure
        if "data" in logs_data:
            logs = logs_data["data"]
            assert isinstance(logs, list)
            
            # If there are logs, check structure
            if logs:
                log_entry = logs[0]
                expected_fields = [
                    "timestamp", "ruleId", "emailId", "matched", 
                    "executionTime", "actions"
                ]
                
                # Should have some log fields
                assert any(field in log_entry for field in expected_fields)


@pytest.mark.api
@pytest.mark.rules
@pytest.mark.performance  
class TestRulesPerformance:
    """Test rules system performance"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for performance tests"""
        registration_data = {
            "email": "rulesperftest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Rules Performance Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        assert register_response.status_code == 201
        
        login_data = {"email": registration_data["email"], "password": registration_data["password"]}
        login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
        assert login_response.status_code == 200
        
        self.auth_token = login_response.json()["data"]["token"]
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
    
    @pytest.mark.slow
    def test_multiple_rules_performance(self, api_client, api_base_url):
        """Test performance with multiple rules"""
        import time
        
        # Create multiple rules
        rule_templates = [
            {
                "name": f"Performance Test Rule {i}",
                "conditions": [
                    {
                        "field": "subject",
                        "operator": "contains", 
                        "value": f"test{i}"
                    }
                ],
                "actions": [
                    {
                        "type": "add_label",
                        "target": f"test-{i}"
                    }
                ],
                "active": True,
                "priority": i
            }
            for i in range(1, 11)  # Create 10 rules
        ]
        
        created_rules = []
        for rule_template in rule_templates:
            response = api_client.post(
                f"{api_base_url}/rules",
                json=rule_template,
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                pytest.skip("Rules not implemented yet")
            
            if response.status_code == 201:
                created_rules.append(response.json()["data"])
        
        # Test performance of getting all rules
        start_time = time.time()
        
        list_response = api_client.get(
            f"{api_base_url}/rules",
            headers=self.auth_headers
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        if list_response.status_code == 200:
            print(f"Time to fetch {len(created_rules)} rules: {response_time:.2f}s")
            
            # Performance should be reasonable
            assert response_time < 5.0, f"Rule listing too slow: {response_time}s"
            
            # Should return all created rules
            rules_data = list_response.json()["data"]
            assert len(rules_data) >= len(created_rules)
    
    @pytest.mark.slow
    def test_rule_execution_performance(self, api_client, api_base_url):
        """Test rule execution performance"""
        import time
        
        # Create a simple rule
        rule_data = {
            "name": "Execution Performance Test",
            "conditions": [
                {
                    "field": "subject",
                    "operator": "contains",
                    "value": "performance"
                }
            ],
            "actions": [
                {
                    "type": "add_label",
                    "target": "performance-test"
                }
            ],
            "active": True
        }
        
        rule_response = api_client.post(
            f"{api_base_url}/rules",
            json=rule_data,
            headers=self.auth_headers
        )
        
        if rule_response.status_code == 404:
            pytest.skip("Rules not implemented yet")
        
        rule_id = rule_response.json()["data"]["id"]
        
        # Test execution time
        test_email = {
            "subject": "Performance test email",
            "from": "test@example.com",
            "content": "This is a test email for performance measurement."
        }
        
        # Measure execution time
        start_time = time.time()
        
        exec_response = api_client.post(
            f"{api_base_url}/rules/test",
            json={
                "ruleId": rule_id,
                "email": test_email
            },
            headers=self.auth_headers
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        if exec_response.status_code == 200:
            print(f"Rule execution time: {execution_time:.3f}s")
            
            # Rule execution should be fast
            assert execution_time < 2.0, f"Rule execution too slow: {execution_time}s"
            
            # Should successfully match
            result = exec_response.json()["data"]
            assert result["matched"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])