"""
Monitoring and Performance API Integration Tests for Email Assist
"""
import pytest
import json
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock


@pytest.mark.api
@pytest.mark.monitoring
class TestHealthCheck:
    """Test system health check functionality"""
    
    def test_basic_health_check(self, api_client, api_base_url):
        """Test MONITORING-001: Basic system health check"""
        response = api_client.get("/health")  # No auth required for health check
        
        if response.status_code == 404:
            # Try with full URL
            response = api_client.get(f"{api_base_url}/../health")
        
        if response.status_code == 404:
            pytest.skip("Health check endpoint not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check basic health response structure
        assert "status" in data or "success" in data
        
        if "status" in data:
            assert data["status"] in ["ok", "healthy", "up"]
        
        if "success" in data:
            assert data["success"] is True
        
        # Should include timestamp
        timestamp_fields = ["timestamp", "time", "date", "checked_at"]
        assert any(field in data for field in timestamp_fields)
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for monitoring tests"""
        registration_data = {
            "email": "monitoringtest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Monitoring Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        if register_response.status_code == 201:
            login_data = {"email": registration_data["email"], "password": registration_data["password"]}
            login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
            if login_response.status_code == 200:
                self.auth_token = login_response.json()["data"]["token"]
                self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
            else:
                self.auth_headers = {}
        else:
            self.auth_headers = {}
    
    def test_detailed_health_check(self, api_client, api_base_url):
        """Test MONITORING-002: Detailed system health check"""
        response = api_client.get(
            f"{api_base_url}/monitoring/health/detailed",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Detailed health check not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check detailed health information
        health_data = data["data"]
        
        # Should include various system components
        expected_components = [
            "database", "redis", "api", "services", "external_services", 
            "memory", "disk", "cpu", "uptime"
        ]
        
        # Should have at least some health information
        found_components = sum(1 for comp in expected_components if comp in health_data)
        assert found_components >= 2, f"Expected health components, found: {list(health_data.keys())}"
        
        # If database status is present, check it
        if "database" in health_data:
            db_status = health_data["database"]
            assert "status" in db_status
            assert db_status["status"] in ["healthy", "ok", "connected", "up"]
        
        # If Redis status is present, check it
        if "redis" in health_data:
            redis_status = health_data["redis"]
            assert "status" in redis_status
            assert redis_status["status"] in ["healthy", "ok", "connected", "up"]
    
    def test_component_health_check(self, api_client, api_base_url):
        """Test individual component health checks"""
        components = ["database", "redis", "email", "ai"]
        
        for component in components:
            response = api_client.get(
                f"{api_base_url}/monitoring/health/{component}",
                headers=getattr(self, 'auth_headers', {})
            )
            
            if response.status_code == 404:
                continue  # Skip if component health check not implemented
            
            if response.status_code == 401:
                continue  # Skip if auth required but not available
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] is True
            assert "data" in data
            
            # Should have status for the specific component
            component_data = data["data"]
            assert "status" in component_data
            
            print(f"{component} health: {component_data['status']}")


@pytest.mark.api
@pytest.mark.monitoring
class TestPerformanceMetrics:
    """Test performance metrics monitoring"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for performance tests"""
        registration_data = {
            "email": "perfmontest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Performance Monitoring Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        if register_response.status_code == 201:
            login_data = {"email": registration_data["email"], "password": registration_data["password"]}
            login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
            if login_response.status_code == 200:
                self.auth_token = login_response.json()["data"]["token"]
                self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
            else:
                self.auth_headers = {}
        else:
            self.auth_headers = {}
    
    def test_api_performance_metrics(self, api_client, api_base_url):
        """Test MONITORING-003: Get API performance metrics"""
        response = api_client.get(
            f"{api_base_url}/monitoring/metrics",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Performance metrics not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check performance metrics structure
        metrics = data["data"]
        
        # Expected performance metrics
        expected_metrics = [
            "responseTime", "averageResponseTime", "requestCount", 
            "errorRate", "throughput", "activeConnections", "uptime"
        ]
        
        # Should have some performance metrics
        found_metrics = sum(1 for metric in expected_metrics if metric in metrics)
        assert found_metrics >= 2, f"Expected performance metrics, found: {list(metrics.keys())}"
        
        # If response time is present, it should be numeric
        if "responseTime" in metrics:
            assert isinstance(metrics["responseTime"], (int, float))
            assert metrics["responseTime"] >= 0
        
        # If error rate is present, it should be between 0 and 1
        if "errorRate" in metrics:
            assert 0.0 <= metrics["errorRate"] <= 1.0
    
    def test_database_performance_metrics(self, api_client, api_base_url):
        """Test MONITORING-004: Get database performance metrics"""
        response = api_client.get(
            f"{api_base_url}/monitoring/database",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Database monitoring not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check database performance metrics
        db_metrics = data["data"]
        
        # Expected database metrics
        expected_db_metrics = [
            "connectionCount", "activeConnections", "idleConnections",
            "queryCount", "averageQueryTime", "slowQueries", "poolStatus"
        ]
        
        # Should have some database metrics
        found_metrics = sum(1 for metric in expected_db_metrics if metric in db_metrics)
        assert found_metrics >= 1, f"Expected database metrics, found: {list(db_metrics.keys())}"
        
        # If connection count is present, it should be numeric
        if "connectionCount" in db_metrics:
            assert isinstance(db_metrics["connectionCount"], int)
            assert db_metrics["connectionCount"] >= 0
        
        # If query time is present, it should be numeric
        if "averageQueryTime" in db_metrics:
            assert isinstance(db_metrics["averageQueryTime"], (int, float))
            assert db_metrics["averageQueryTime"] >= 0
    
    def test_system_resource_metrics(self, api_client, api_base_url):
        """Test system resource monitoring"""
        response = api_client.get(
            f"{api_base_url}/monitoring/system",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("System monitoring not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check system resource metrics
        system_metrics = data["data"]
        
        # Expected system metrics
        expected_system_metrics = [
            "cpu", "memory", "disk", "network", "processes", "load", "uptime"
        ]
        
        # Should have some system metrics
        found_metrics = sum(1 for metric in expected_system_metrics if metric in system_metrics)
        assert found_metrics >= 1, f"Expected system metrics, found: {list(system_metrics.keys())}"
        
        # If CPU usage is present, check format
        if "cpu" in system_metrics:
            cpu_data = system_metrics["cpu"]
            if isinstance(cpu_data, dict):
                assert "usage" in cpu_data or "percent" in cpu_data
            elif isinstance(cpu_data, (int, float)):
                assert 0 <= cpu_data <= 100
        
        # If memory usage is present, check format
        if "memory" in system_metrics:
            memory_data = system_metrics["memory"]
            if isinstance(memory_data, dict):
                expected_mem_fields = ["used", "total", "free", "percent"]
                assert any(field in memory_data for field in expected_mem_fields)
    
    def test_metrics_with_time_range(self, api_client, api_base_url):
        """Test metrics with time range filtering"""
        # Request metrics for the last hour
        params = {
            "start": (datetime.now() - timedelta(hours=1)).isoformat(),
            "end": datetime.now().isoformat(),
            "interval": "5m"
        }
        
        response = api_client.get(
            f"{api_base_url}/monitoring/metrics/timeseries",
            params=params,
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Time series metrics not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        
        # Should return time series data
        if "data" in data:
            timeseries = data["data"]
            
            # Should be a list of data points or have timestamps
            if isinstance(timeseries, list):
                if timeseries:  # If not empty
                    datapoint = timeseries[0]
                    assert "timestamp" in datapoint or "time" in datapoint
            elif isinstance(timeseries, dict):
                # Might be organized by metric type
                for metric_name, metric_data in timeseries.items():
                    if isinstance(metric_data, list) and metric_data:
                        assert "timestamp" in metric_data[0] or "time" in metric_data[0]


@pytest.mark.api
@pytest.mark.monitoring
class TestCacheManagement:
    """Test cache management and monitoring"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for cache tests"""
        registration_data = {
            "email": "cachetest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Cache Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        if register_response.status_code == 201:
            login_data = {"email": registration_data["email"], "password": registration_data["password"]}
            login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
            if login_response.status_code == 200:
                self.auth_token = login_response.json()["data"]["token"]
                self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
            else:
                self.auth_headers = {}
        else:
            self.auth_headers = {}
    
    def test_get_cache_status(self, api_client, api_base_url):
        """Test CACHE-001: Get Redis cache status"""
        response = api_client.get(
            f"{api_base_url}/cache/status",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            # Try alternative endpoint
            response = api_client.get(
                f"{api_base_url}/monitoring/cache",
                headers=getattr(self, 'auth_headers', {})
            )
        
        if response.status_code == 404:
            pytest.skip("Cache status endpoint not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check cache status information
        cache_status = data["data"]
        
        # Expected cache metrics
        expected_cache_metrics = [
            "status", "connected", "memoryUsed", "memoryTotal", 
            "keyCount", "hitRate", "missRate", "evictions"
        ]
        
        # Should have some cache metrics
        found_metrics = sum(1 for metric in expected_cache_metrics if metric in cache_status)
        assert found_metrics >= 2, f"Expected cache metrics, found: {list(cache_status.keys())}"
        
        # If status is present, should be healthy
        if "status" in cache_status:
            assert cache_status["status"] in ["connected", "healthy", "ok", "up"]
        
        # If hit rate is present, should be between 0 and 1
        if "hitRate" in cache_status:
            assert 0.0 <= cache_status["hitRate"] <= 1.0
    
    def test_clear_cache(self, api_client, api_base_url):
        """Test CACHE-002: Clear cache entries"""
        clear_data = {
            "pattern": "email:*"  # Clear email-related cache entries
        }
        
        response = api_client.delete(
            f"{api_base_url}/cache/clear",
            json=clear_data,
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Cache clear endpoint not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        
        # Should provide information about cleared entries
        if "data" in data:
            clear_result = data["data"]
            expected_fields = ["cleared", "count", "pattern"]
            
            # Should have some indication of what was cleared
            assert any(field in clear_result for field in expected_fields)
    
    def test_clear_all_cache(self, api_client, api_base_url):
        """Test clearing all cache entries"""
        response = api_client.delete(
            f"{api_base_url}/cache/clear/all",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Clear all cache not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        # Should either succeed or be forbidden (for safety)
        assert response.status_code in [200, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
    
    def test_cache_statistics(self, api_client, api_base_url):
        """Test getting detailed cache statistics"""
        response = api_client.get(
            f"{api_base_url}/cache/statistics",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Cache statistics not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check cache statistics
        cache_stats = data["data"]
        
        # Expected statistics
        expected_stats = [
            "hits", "misses", "hitRate", "operations", "keyspaceHits", 
            "keyspaceMisses", "expiredKeys", "evictedKeys"
        ]
        
        # Should have some statistics
        found_stats = sum(1 for stat in expected_stats if stat in cache_stats)
        assert found_stats >= 1, f"Expected cache statistics, found: {list(cache_stats.keys())}"


@pytest.mark.api
@pytest.mark.monitoring
class TestAlertsAndNotifications:
    """Test monitoring alerts and notifications"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for alerts tests"""
        registration_data = {
            "email": "alertstest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Alerts Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        if register_response.status_code == 201:
            login_data = {"email": registration_data["email"], "password": registration_data["password"]}
            login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
            if login_response.status_code == 200:
                self.auth_token = login_response.json()["data"]["token"]
                self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
            else:
                self.auth_headers = {}
        else:
            self.auth_headers = {}
    
    def test_get_system_alerts(self, api_client, api_base_url):
        """Test getting system alerts"""
        response = api_client.get(
            f"{api_base_url}/monitoring/alerts",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("System alerts not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check alerts structure
        alerts = data["data"]
        assert isinstance(alerts, list)
        
        # If there are alerts, check structure
        if alerts:
            alert = alerts[0]
            expected_fields = [
                "id", "type", "severity", "message", "timestamp", 
                "status", "component", "metric"
            ]
            
            # Should have some alert fields
            found_fields = sum(1 for field in expected_fields if field in alert)
            assert found_fields >= 3, f"Expected alert fields, found: {list(alert.keys())}"
    
    def test_create_alert_rule(self, api_client, api_base_url):
        """Test creating monitoring alert rules"""
        alert_rule = {
            "name": "High Error Rate Alert",
            "description": "Alert when error rate exceeds 5%",
            "condition": {
                "metric": "errorRate",
                "operator": ">",
                "threshold": 0.05
            },
            "severity": "high",
            "notifications": {
                "email": ["admin@example.com"],
                "webhook": "https://hooks.example.com/alerts"
            },
            "active": True
        }
        
        response = api_client.post(
            f"{api_base_url}/monitoring/alerts/rules",
            json=alert_rule,
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Alert rules not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check created alert rule
        created_rule = data["data"]
        assert created_rule["name"] == alert_rule["name"]
        assert created_rule["active"] == alert_rule["active"]
    
    def test_alert_history(self, api_client, api_base_url):
        """Test getting alert history"""
        params = {
            "start": (datetime.now() - timedelta(days=7)).isoformat(),
            "end": datetime.now().isoformat(),
            "severity": "high"
        }
        
        response = api_client.get(
            f"{api_base_url}/monitoring/alerts/history",
            params=params,
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Alert history not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        
        # Check alert history
        history = data["data"]
        assert isinstance(history, list)
        
        # If there's history, check structure
        if history:
            alert_event = history[0]
            expected_fields = [
                "id", "ruleId", "triggeredAt", "resolvedAt", 
                "severity", "message", "status"
            ]
            
            # Should have some history fields
            found_fields = sum(1 for field in expected_fields if field in alert_event)
            assert found_fields >= 3, f"Expected history fields, found: {list(alert_event.keys())}"


@pytest.mark.api
@pytest.mark.monitoring
@pytest.mark.performance
class TestMonitoringPerformance:
    """Test monitoring system performance"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self, api_client, api_base_url, clean_database):
        """Setup authenticated user for performance tests"""
        registration_data = {
            "email": "monperftest@example.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "name": "Monitoring Performance Test User"
        }
        
        register_response = api_client.post(f"{api_base_url}/auth/register", json=registration_data)
        if register_response.status_code == 201:
            login_data = {"email": registration_data["email"], "password": registration_data["password"]}
            login_response = api_client.post(f"{api_base_url}/auth/login", json=login_data)
            if login_response.status_code == 200:
                self.auth_token = login_response.json()["data"]["token"]
                self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}
            else:
                self.auth_headers = {}
        else:
            self.auth_headers = {}
    
    @pytest.mark.slow
    def test_monitoring_endpoints_response_time(self, api_client, api_base_url):
        """Test response time of monitoring endpoints"""
        monitoring_endpoints = [
            "/health",
            f"{api_base_url}/monitoring/health/detailed",
            f"{api_base_url}/monitoring/metrics",
            f"{api_base_url}/cache/status"
        ]
        
        for endpoint in monitoring_endpoints:
            start_time = time.time()
            
            if endpoint == "/health":
                response = api_client.get(endpoint)
            else:
                response = api_client.get(endpoint, headers=getattr(self, 'auth_headers', {}))
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # Skip if endpoint not implemented
            if response.status_code == 404:
                continue
            
            # Skip if auth required but not available
            if response.status_code == 401:
                continue
            
            print(f"{endpoint} response time: {response_time:.3f}s")
            
            # Monitoring endpoints should be fast
            assert response_time < 5.0, f"Monitoring endpoint {endpoint} too slow: {response_time}s"
            
            # Should be successful
            assert response.status_code == 200
    
    @pytest.mark.slow
    def test_concurrent_monitoring_requests(self, api_client, api_base_url):
        """Test concurrent monitoring requests"""
        import threading
        
        results = []
        
        def make_health_request():
            start_time = time.time()
            response = api_client.get("/health")
            end_time = time.time()
            
            results.append({
                'status_code': response.status_code,
                'response_time': end_time - start_time
            })
        
        # Create and start threads
        threads = []
        num_threads = 10
        
        for _ in range(num_threads):
            thread = threading.Thread(target=make_health_request)
            threads.append(thread)
        
        # Start all threads
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Analyze results
        if results:
            successful_requests = sum(1 for r in results if r['status_code'] == 200)
            success_rate = successful_requests / len(results)
            avg_response_time = sum(r['response_time'] for r in results) / len(results)
            
            print(f"Concurrent health checks: {len(results)}")
            print(f"Success rate: {success_rate * 100:.1f}%")
            print(f"Average response time: {avg_response_time:.3f}s")
            print(f"Total test time: {total_time:.3f}s")
            
            # Health checks should be highly available
            assert success_rate >= 0.9, f"Health check success rate too low: {success_rate:.2f}"
            
            # Should be reasonably fast even under load
            assert avg_response_time < 2.0, f"Average response time too slow: {avg_response_time:.3f}s"
    
    def test_metrics_data_accuracy(self, api_client, api_base_url):
        """Test accuracy of metrics data"""
        # Make some API requests to generate metrics
        test_endpoints = [
            f"{api_base_url}/auth/verify",
            f"{api_base_url}/email/messages",
            f"{api_base_url}/analysis/sentiment"
        ]
        
        # Make requests (some will fail due to auth, that's OK)
        for endpoint in test_endpoints:
            try:
                api_client.get(endpoint, headers=getattr(self, 'auth_headers', {}))
            except:
                pass  # Ignore errors, we just want to generate some traffic
        
        # Wait a moment for metrics to be collected
        time.sleep(2)
        
        # Get metrics
        response = api_client.get(
            f"{api_base_url}/monitoring/metrics",
            headers=getattr(self, 'auth_headers', {})
        )
        
        if response.status_code == 404:
            pytest.skip("Metrics not implemented yet")
        
        if response.status_code == 401:
            pytest.skip("Authentication required but not available")
        
        if response.status_code == 200:
            data = response.json()
            metrics = data["data"]
            
            # If request count is available, it should be non-zero
            if "requestCount" in metrics:
                assert metrics["requestCount"] > 0, "Request count should reflect recent activity"
            
            # Response times should be reasonable
            if "averageResponseTime" in metrics:
                avg_time = metrics["averageResponseTime"]
                assert 0 <= avg_time <= 10000, f"Average response time seems unrealistic: {avg_time}ms"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])