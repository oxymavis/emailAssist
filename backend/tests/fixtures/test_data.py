"""
Test data fixtures and generators for Email Assist API testing
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from faker import Faker
import random

fake = Faker()

class TestDataGenerator:
    """Generate test data for API testing"""
    
    @staticmethod
    def generate_user(override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test user data"""
        user_data = {
            "id": str(uuid.uuid4()),
            "email": fake.email(),
            "name": fake.name(),
            "password": "TestPassword123!",
            "created_at": fake.date_time_this_year().isoformat(),
            "updated_at": fake.date_time_this_year().isoformat(),
            "is_active": True,
            "email_verified": True,
            "last_login": fake.date_time_this_month().isoformat()
        }
        
        if override:
            user_data.update(override)
        
        return user_data
    
    @staticmethod
    def generate_email(user_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test email data"""
        subjects = [
            "Meeting scheduled for next week",
            "URGENT: Server maintenance required",
            "Project update - Q4 progress",
            "Invoice #12345 ready for review",
            "Welcome to our newsletter",
            "Password reset requested",
            "Your order has been shipped",
            "Weekly team sync notes",
            "Security alert: New login detected",
            "Congratulations on your promotion!"
        ]
        
        email_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or str(uuid.uuid4()),
            "subject": random.choice(subjects),
            "from": fake.email(),
            "to": fake.email(),
            "cc": [fake.email()] if random.random() > 0.7 else [],
            "bcc": [fake.email()] if random.random() > 0.9 else [],
            "content": fake.text(max_nb_chars=1000),
            "html_content": f"<p>{fake.text(max_nb_chars=500)}</p>",
            "received_date": fake.date_time_this_month().isoformat(),
            "is_read": random.choice([True, False]),
            "is_starred": random.choice([True, False]),
            "is_archived": random.choice([True, False]),
            "folder": random.choice(["inbox", "sent", "drafts", "trash", "archive"]),
            "labels": random.sample(["important", "work", "personal", "urgent", "follow-up"], 
                                  random.randint(0, 3)),
            "attachments": [],
            "priority": random.choice(["low", "medium", "high"]),
            "category": random.choice(["work", "personal", "newsletter", "promotional", "social"]),
            "thread_id": str(uuid.uuid4()),
            "created_at": fake.date_time_this_month().isoformat(),
            "updated_at": fake.date_time_this_month().isoformat()
        }
        
        # Add attachments sometimes
        if random.random() > 0.8:
            email_data["attachments"] = [
                {
                    "id": str(uuid.uuid4()),
                    "filename": fake.file_name(),
                    "size": random.randint(1024, 1024*1024),
                    "content_type": random.choice(["image/jpeg", "application/pdf", "text/plain"])
                }
                for _ in range(random.randint(1, 3))
            ]
        
        if override:
            email_data.update(override)
        
        return email_data
    
    @staticmethod
    def generate_filter_rule(user_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test filter rule data"""
        rule_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or str(uuid.uuid4()),
            "name": fake.words(3, unique=True),
            "description": fake.sentence(),
            "conditions": [
                {
                    "field": random.choice(["subject", "from", "to", "content"]),
                    "operator": random.choice(["contains", "equals", "starts_with", "ends_with"]),
                    "value": fake.word(),
                    "case_sensitive": False
                }
            ],
            "actions": [
                {
                    "type": random.choice(["move_to_folder", "add_label", "mark_read", "delete"]),
                    "target": random.choice(["spam", "archive", "work", "important"])
                }
            ],
            "priority": random.randint(1, 10),
            "active": True,
            "logic": "AND",
            "created_at": fake.date_time_this_year().isoformat(),
            "updated_at": fake.date_time_this_year().isoformat(),
            "last_executed": fake.date_time_this_month().isoformat(),
            "execution_count": random.randint(0, 100),
            "match_count": random.randint(0, 50)
        }
        
        if override:
            rule_data.update(override)
        
        return rule_data
    
    @staticmethod
    def generate_report_template(user_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test report template data"""
        template_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or str(uuid.uuid4()),
            "name": fake.words(3, unique=True) + " Report",
            "description": fake.sentence(),
            "type": random.choice(["daily", "weekly", "monthly", "custom"]),
            "sections": random.sample([
                "email_count", "sentiment_analysis", "priority_distribution",
                "top_senders", "category_breakdown", "keyword_analysis"
            ], random.randint(2, 4)),
            "format": random.choice(["pdf", "excel", "json", "csv"]),
            "filters": {
                "date_range": random.choice(["last_7_days", "last_30_days", "last_90_days"]),
                "folders": random.sample(["inbox", "sent", "archive"], random.randint(1, 2)),
                "include_archived": random.choice([True, False])
            },
            "chart_types": {
                "email_count": "line",
                "sentiment_analysis": "pie",
                "priority_distribution": "bar"
            },
            "active": True,
            "created_at": fake.date_time_this_year().isoformat(),
            "updated_at": fake.date_time_this_year().isoformat()
        }
        
        if override:
            template_data.update(override)
        
        return template_data
    
    @staticmethod
    def generate_report(template_id: str = None, user_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test report data"""
        report_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or str(uuid.uuid4()),
            "template_id": template_id or str(uuid.uuid4()),
            "name": fake.words(3, unique=True) + " Report - " + fake.date().strftime("%Y-%m-%d"),
            "status": random.choice(["pending", "generating", "completed", "failed"]),
            "progress": random.randint(0, 100),
            "date_range": {
                "start": (datetime.now() - timedelta(days=30)).isoformat(),
                "end": datetime.now().isoformat()
            },
            "filters_applied": {
                "folders": ["inbox", "sent"],
                "total_emails": random.randint(100, 1000)
            },
            "report_data": {
                "email_count": {
                    "total": random.randint(100, 1000),
                    "read": random.randint(50, 500),
                    "unread": random.randint(50, 500)
                },
                "sentiment_analysis": {
                    "positive": random.randint(20, 40),
                    "negative": random.randint(10, 30),
                    "neutral": random.randint(30, 50)
                },
                "top_senders": [
                    {"email": fake.email(), "count": random.randint(5, 50)}
                    for _ in range(5)
                ]
            },
            "file_path": f"/reports/{uuid.uuid4()}.pdf",
            "file_size": random.randint(1024*100, 1024*1024*5),  # 100KB to 5MB
            "created_at": fake.date_time_this_month().isoformat(),
            "updated_at": fake.date_time_this_month().isoformat(),
            "completed_at": fake.date_time_this_month().isoformat() if random.random() > 0.3 else None
        }
        
        if override:
            report_data.update(override)
        
        return report_data
    
    @staticmethod
    def generate_analysis_result(email_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test AI analysis result"""
        analysis_data = {
            "id": str(uuid.uuid4()),
            "email_id": email_id or str(uuid.uuid4()),
            "sentiment": {
                "label": random.choice(["positive", "negative", "neutral"]),
                "confidence": round(random.uniform(0.7, 0.99), 2),
                "score": round(random.uniform(-1.0, 1.0), 2)
            },
            "priority": {
                "level": random.choice(["low", "medium", "high", "critical"]),
                "confidence": round(random.uniform(0.6, 0.95), 2),
                "factors": random.sample([
                    "urgent_keywords", "sender_importance", "time_sensitivity", "content_analysis"
                ], random.randint(1, 3))
            },
            "category": {
                "label": random.choice(["work", "personal", "newsletter", "promotional", "support"]),
                "confidence": round(random.uniform(0.7, 0.98), 2)
            },
            "keywords": [
                {
                    "keyword": fake.word(),
                    "relevance": round(random.uniform(0.5, 1.0), 2),
                    "frequency": random.randint(1, 5)
                }
                for _ in range(random.randint(3, 8))
            ],
            "entities": [
                {
                    "text": fake.name() if random.random() > 0.5 else fake.company(),
                    "type": random.choice(["PERSON", "ORGANIZATION", "LOCATION", "DATE"]),
                    "confidence": round(random.uniform(0.8, 0.99), 2)
                }
                for _ in range(random.randint(0, 3))
            ],
            "language": "en",
            "processing_time": round(random.uniform(0.1, 2.5), 2),
            "model_version": "v1.2.3",
            "created_at": fake.date_time_this_month().isoformat()
        }
        
        if override:
            analysis_data.update(override)
        
        return analysis_data
    
    @staticmethod
    def generate_scheduled_report(template_id: str = None, user_id: str = None, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test scheduled report data"""
        schedule_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or str(uuid.uuid4()),
            "template_id": template_id or str(uuid.uuid4()),
            "name": fake.words(3, unique=True) + " Scheduled Report",
            "description": fake.sentence(),
            "schedule": random.choice([
                "0 9 * * 1",    # Every Monday at 9 AM
                "0 18 * * 5",   # Every Friday at 6 PM
                "0 0 1 * *",    # First day of every month at midnight
                "0 12 * * *"    # Every day at noon
            ]),
            "timezone": "UTC",
            "recipients": [fake.email() for _ in range(random.randint(1, 3))],
            "last_executed": fake.date_time_this_month().isoformat(),
            "next_execution": (datetime.now() + timedelta(days=random.randint(1, 7))).isoformat(),
            "execution_count": random.randint(0, 50),
            "success_count": random.randint(0, 45),
            "failure_count": random.randint(0, 5),
            "active": True,
            "created_at": fake.date_time_this_year().isoformat(),
            "updated_at": fake.date_time_this_year().isoformat()
        }
        
        if override:
            schedule_data.update(override)
        
        return schedule_data
    
    @staticmethod
    def generate_system_metrics(override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate test system metrics data"""
        metrics_data = {
            "timestamp": datetime.now().isoformat(),
            "api": {
                "request_count": random.randint(1000, 10000),
                "average_response_time": round(random.uniform(50, 500), 2),
                "error_rate": round(random.uniform(0.001, 0.05), 3),
                "active_connections": random.randint(10, 100),
                "throughput": round(random.uniform(50, 200), 2)
            },
            "database": {
                "connection_count": random.randint(5, 20),
                "active_connections": random.randint(2, 15),
                "query_count": random.randint(5000, 50000),
                "average_query_time": round(random.uniform(10, 200), 2),
                "slow_queries": random.randint(0, 10)
            },
            "redis": {
                "status": "connected",
                "memory_used": random.randint(10*1024*1024, 100*1024*1024),  # 10MB to 100MB
                "memory_total": 256*1024*1024,  # 256MB
                "key_count": random.randint(1000, 10000),
                "hit_rate": round(random.uniform(0.85, 0.99), 2),
                "operations_per_second": random.randint(100, 1000)
            },
            "system": {
                "cpu": {
                    "usage": round(random.uniform(10, 80), 1),
                    "cores": random.choice([2, 4, 8, 16])
                },
                "memory": {
                    "used": random.randint(1*1024*1024*1024, 4*1024*1024*1024),  # 1GB to 4GB
                    "total": 8*1024*1024*1024,  # 8GB
                    "percent": round(random.uniform(20, 70), 1)
                },
                "disk": {
                    "used": random.randint(10*1024*1024*1024, 50*1024*1024*1024),  # 10GB to 50GB
                    "total": 100*1024*1024*1024,  # 100GB
                    "percent": round(random.uniform(15, 75), 1)
                },
                "uptime": random.randint(3600, 30*24*3600)  # 1 hour to 30 days
            }
        }
        
        if override:
            metrics_data.update(override)
        
        return metrics_data
    
    @classmethod
    def generate_batch_users(cls, count: int = 10) -> List[Dict[str, Any]]:
        """Generate multiple test users"""
        return [cls.generate_user() for _ in range(count)]
    
    @classmethod
    def generate_batch_emails(cls, user_id: str, count: int = 20) -> List[Dict[str, Any]]:
        """Generate multiple test emails for a user"""
        return [cls.generate_email(user_id=user_id) for _ in range(count)]
    
    @classmethod
    def generate_batch_rules(cls, user_id: str, count: int = 5) -> List[Dict[str, Any]]:
        """Generate multiple test filter rules for a user"""
        return [cls.generate_filter_rule(user_id=user_id) for _ in range(count)]
    
    @classmethod
    def generate_complete_user_dataset(cls, user_override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete test dataset for a user"""
        user = cls.generate_user(user_override)
        user_id = user["id"]
        
        return {
            "user": user,
            "emails": cls.generate_batch_emails(user_id, 50),
            "rules": cls.generate_batch_rules(user_id, 10),
            "templates": [cls.generate_report_template(user_id) for _ in range(3)],
            "reports": [cls.generate_report(user_id=user_id) for _ in range(5)],
            "scheduled_reports": [cls.generate_scheduled_report(user_id=user_id) for _ in range(2)],
            "analysis_results": [
                cls.generate_analysis_result(email["id"]) 
                for email in cls.generate_batch_emails(user_id, 10)
            ]
        }


# Predefined test data sets
SAMPLE_USERS = [
    {
        "id": "test-user-1",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "password": "TestPassword123!"
    },
    {
        "id": "test-user-2", 
        "email": "jane.smith@example.com",
        "name": "Jane Smith",
        "password": "TestPassword123!"
    },
    {
        "id": "test-user-3",
        "email": "admin@example.com",
        "name": "Admin User",
        "password": "TestPassword123!"
    }
]

SAMPLE_EMAILS = [
    {
        "subject": "URGENT: Server maintenance required",
        "from": "ops@company.com",
        "content": "The production server requires immediate maintenance. Please schedule downtime.",
        "priority": "high",
        "category": "work",
        "sentiment": "negative"
    },
    {
        "subject": "Great job on the project!",
        "from": "manager@company.com", 
        "content": "I wanted to congratulate you on the excellent work on the latest project.",
        "priority": "medium",
        "category": "work",
        "sentiment": "positive"
    },
    {
        "subject": "Weekly newsletter",
        "from": "newsletter@example.com",
        "content": "Here's your weekly update with the latest news and updates.",
        "priority": "low",
        "category": "newsletter",
        "sentiment": "neutral"
    }
]

SAMPLE_FILTER_RULES = [
    {
        "name": "Spam Filter",
        "conditions": [
            {"field": "subject", "operator": "contains", "value": "SPAM"}
        ],
        "actions": [
            {"type": "move_to_folder", "target": "spam"}
        ]
    },
    {
        "name": "Important Emails",
        "conditions": [
            {"field": "from", "operator": "contains", "value": "@company.com"},
            {"field": "subject", "operator": "contains", "value": "URGENT"}
        ],
        "actions": [
            {"type": "add_label", "target": "important"}
        ],
        "logic": "AND"
    }
]


def save_test_data_to_file(filename: str, data: Any):
    """Save test data to JSON file"""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2, default=str)


def load_test_data_from_file(filename: str) -> Any:
    """Load test data from JSON file"""
    with open(filename, 'r') as f:
        return json.load(f)


if __name__ == "__main__":
    # Generate and save sample test datasets
    generator = TestDataGenerator()
    
    # Generate complete datasets
    datasets = {
        "users": generator.generate_batch_users(10),
        "complete_user_1": generator.generate_complete_user_dataset({"email": "test1@example.com"}),
        "complete_user_2": generator.generate_complete_user_dataset({"email": "test2@example.com"}),
        "system_metrics": generator.generate_system_metrics()
    }
    
    # Save to files
    for name, dataset in datasets.items():
        save_test_data_to_file(f"test_data_{name}.json", dataset)
    
    print("Test data files generated successfully!")
    print("Generated files:")
    for name in datasets.keys():
        print(f"  - test_data_{name}.json")