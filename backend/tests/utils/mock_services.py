"""
Mock services for external API testing
"""
import json
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from unittest.mock import MagicMock, patch
import responses
from faker import Faker

fake = Faker()


class MockMicrosoftGraphService:
    """Mock Microsoft Graph API service"""
    
    def __init__(self):
        self.mock_users = []
        self.mock_messages = []
        self.access_tokens = {}
    
    def generate_mock_token_response(self, authorization_code: str = None) -> Dict[str, Any]:
        """Generate mock OAuth token response"""
        return {
            "token_type": "Bearer",
            "scope": "https://graph.microsoft.com/mail.read https://graph.microsoft.com/user.read",
            "expires_in": 3600,
            "ext_expires_in": 3600,
            "access_token": f"mock_access_token_{uuid.uuid4().hex[:16]}",
            "refresh_token": f"mock_refresh_token_{uuid.uuid4().hex[:16]}",
            "id_token": f"mock_id_token_{uuid.uuid4().hex[:16]}"
        }
    
    def generate_mock_user_info(self) -> Dict[str, Any]:
        """Generate mock user information"""
        return {
            "id": str(uuid.uuid4()),
            "displayName": fake.name(),
            "givenName": fake.first_name(),
            "surname": fake.last_name(),
            "mail": fake.email(),
            "userPrincipalName": fake.email(),
            "jobTitle": fake.job(),
            "officeLocation": fake.city(),
            "businessPhones": [fake.phone_number()],
            "mobilePhone": fake.phone_number()
        }
    
    def generate_mock_message(self, override: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate mock email message"""
        message = {
            "id": str(uuid.uuid4()),
            "createdDateTime": fake.date_time_this_month().isoformat() + "Z",
            "lastModifiedDateTime": fake.date_time_this_month().isoformat() + "Z",
            "receivedDateTime": fake.date_time_this_month().isoformat() + "Z",
            "sentDateTime": fake.date_time_this_month().isoformat() + "Z",
            "hasAttachments": random.choice([True, False]),
            "internetMessageId": f"<{uuid.uuid4()}@example.com>",
            "subject": fake.sentence(),
            "bodyPreview": fake.text(max_nb_chars=200),
            "importance": random.choice(["low", "normal", "high"]),
            "parentFolderId": str(uuid.uuid4()),
            "conversationId": str(uuid.uuid4()),
            "isDeliveryReceiptRequested": False,
            "isReadReceiptRequested": False,
            "isRead": random.choice([True, False]),
            "isDraft": False,
            "webLink": f"https://outlook.office365.com/mail/id/{uuid.uuid4()}",
            "body": {
                "contentType": "html",
                "content": f"<html><body><p>{fake.text()}</p></body></html>"
            },
            "sender": {
                "emailAddress": {
                    "name": fake.name(),
                    "address": fake.email()
                }
            },
            "from": {
                "emailAddress": {
                    "name": fake.name(),
                    "address": fake.email()
                }
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "name": fake.name(),
                        "address": fake.email()
                    }
                }
            ],
            "ccRecipients": [],
            "bccRecipients": [],
            "replyTo": [],
            "categories": []
        }
        
        if override:
            message.update(override)
        
        return message
    
    def generate_mock_messages_response(self, count: int = 10) -> Dict[str, Any]:
        """Generate mock messages list response"""
        return {
            "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#me/messages",
            "@odata.nextLink": f"https://graph.microsoft.com/v1.0/me/messages?$skip={count}",
            "value": [self.generate_mock_message() for _ in range(count)]
        }
    
    @responses.activate
    def setup_mock_responses(self):
        """Setup mock HTTP responses for Microsoft Graph API"""
        # Mock token endpoint
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            json=self.generate_mock_token_response(),
            status=200
        )
        
        # Mock user info endpoint
        responses.add(
            responses.GET,
            "https://graph.microsoft.com/v1.0/me",
            json=self.generate_mock_user_info(),
            status=200
        )
        
        # Mock messages endpoint
        responses.add(
            responses.GET,
            "https://graph.microsoft.com/v1.0/me/messages",
            json=self.generate_mock_messages_response(),
            status=200
        )
        
        # Mock specific message endpoint
        responses.add_callback(
            responses.GET,
            url_matcher=lambda url: "https://graph.microsoft.com/v1.0/me/messages/" in url.url,
            callback=self._mock_message_callback,
            content_type="application/json"
        )
    
    def _mock_message_callback(self, request):
        """Callback for individual message requests"""
        message_id = request.url.split('/')[-1]
        message = self.generate_mock_message({"id": message_id})
        return (200, {}, json.dumps(message))


class MockOpenAIService:
    """Mock OpenAI API service"""
    
    def __init__(self):
        self.request_count = 0
    
    def generate_mock_sentiment_response(self, content: str) -> Dict[str, Any]:
        """Generate mock sentiment analysis response"""
        # Simple heuristic based on content
        positive_words = ["good", "great", "excellent", "happy", "love", "amazing", "wonderful"]
        negative_words = ["bad", "terrible", "awful", "hate", "horrible", "worst", "disappointed"]
        
        content_lower = content.lower()
        positive_count = sum(1 for word in positive_words if word in content_lower)
        negative_count = sum(1 for word in negative_words if word in content_lower)
        
        if positive_count > negative_count:
            sentiment = "positive"
            score = round(random.uniform(0.6, 1.0), 2)
        elif negative_count > positive_count:
            sentiment = "negative"
            score = round(random.uniform(-1.0, -0.6), 2)
        else:
            sentiment = "neutral"
            score = round(random.uniform(-0.3, 0.3), 2)
        
        return {
            "sentiment": sentiment,
            "confidence": round(random.uniform(0.7, 0.95), 2),
            "score": score
        }
    
    def generate_mock_priority_response(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock priority analysis response"""
        subject = email_data.get("subject", "").lower()
        sender = email_data.get("from", "").lower()
        
        # Simple heuristics for priority
        urgent_keywords = ["urgent", "asap", "emergency", "critical", "immediate"]
        important_senders = ["ceo", "manager", "director", "admin"]
        
        priority_score = 0.3  # Base priority
        
        # Check for urgent keywords
        if any(keyword in subject for keyword in urgent_keywords):
            priority_score += 0.4
        
        # Check sender importance
        if any(title in sender for title in important_senders):
            priority_score += 0.3
        
        # Determine priority level
        if priority_score >= 0.8:
            priority = "high"
        elif priority_score >= 0.6:
            priority = "medium"
        else:
            priority = "low"
        
        return {
            "priority": priority,
            "confidence": round(random.uniform(0.6, 0.9), 2),
            "score": round(min(priority_score, 1.0), 2),
            "factors": [
                factor for factor in ["urgent_keywords", "sender_importance", "content_analysis"]
                if random.random() > 0.5
            ]
        }
    
    def generate_mock_category_response(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock categorization response"""
        subject = email_data.get("subject", "").lower()
        content = email_data.get("content", "").lower()
        
        # Simple categorization based on keywords
        categories = {
            "work": ["meeting", "project", "task", "deadline", "report", "team"],
            "personal": ["family", "friend", "birthday", "vacation", "personal"],
            "newsletter": ["newsletter", "subscribe", "unsubscribe", "weekly", "update"],
            "promotional": ["sale", "discount", "offer", "deal", "buy", "shop"],
            "support": ["help", "support", "issue", "problem", "ticket", "error"]
        }
        
        category_scores = {}
        text = subject + " " + content
        
        for category, keywords in categories.items():
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                category_scores[category] = score
        
        if category_scores:
            category = max(category_scores, key=category_scores.get)
        else:
            category = "other"
        
        return {
            "category": category,
            "confidence": round(random.uniform(0.7, 0.95), 2)
        }
    
    def generate_mock_keywords_response(self, content: str) -> Dict[str, Any]:
        """Generate mock keyword extraction response"""
        # Simple keyword extraction
        words = content.lower().split()
        common_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those"}
        
        # Filter out common words and short words
        meaningful_words = [word for word in words if len(word) > 3 and word not in common_words]
        
        # Get word frequencies
        word_freq = {}
        for word in meaningful_words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Sort by frequency and take top keywords
        top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:8]
        
        keywords = [
            {
                "keyword": word,
                "relevance": round(min(1.0, freq / len(meaningful_words) * 10), 2),
                "frequency": freq
            }
            for word, freq in top_keywords
        ]
        
        return {"keywords": keywords}
    
    def generate_mock_completion_response(self, prompt: str) -> Dict[str, Any]:
        """Generate mock OpenAI completion response"""
        self.request_count += 1
        
        # Analyze the prompt to determine response type
        if "sentiment" in prompt.lower():
            analysis_result = self.generate_mock_sentiment_response(prompt)
        elif "priority" in prompt.lower():
            analysis_result = self.generate_mock_priority_response({"subject": prompt, "content": prompt})
        elif "categor" in prompt.lower():
            analysis_result = self.generate_mock_category_response({"subject": prompt, "content": prompt})
        elif "keyword" in prompt.lower():
            analysis_result = self.generate_mock_keywords_response(prompt)
        else:
            # Generic response
            analysis_result = {
                "analysis": "general",
                "confidence": round(random.uniform(0.7, 0.9), 2)
            }
        
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:16]}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": "gpt-3.5-turbo",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(analysis_result)
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": len(prompt.split()),
                "completion_tokens": len(json.dumps(analysis_result).split()),
                "total_tokens": len(prompt.split()) + len(json.dumps(analysis_result).split())
            }
        }
    
    @responses.activate
    def setup_mock_responses(self):
        """Setup mock HTTP responses for OpenAI API"""
        responses.add_callback(
            responses.POST,
            "https://api.openai.com/v1/chat/completions",
            callback=self._mock_completion_callback,
            content_type="application/json"
        )
    
    def _mock_completion_callback(self, request):
        """Callback for OpenAI completion requests"""
        request_data = json.loads(request.body)
        messages = request_data.get("messages", [])
        
        # Extract content from messages
        content = ""
        for message in messages:
            content += message.get("content", "") + " "
        
        response = self.generate_mock_completion_response(content.strip())
        return (200, {}, json.dumps(response))


class MockGmailService:
    """Mock Gmail API service"""
    
    def __init__(self):
        self.mock_messages = []
    
    def generate_mock_gmail_message(self) -> Dict[str, Any]:
        """Generate mock Gmail message"""
        return {
            "id": uuid.uuid4().hex[:16],
            "threadId": uuid.uuid4().hex[:16],
            "labelIds": ["INBOX", "UNREAD"] if random.random() > 0.5 else ["INBOX"],
            "snippet": fake.text(max_nb_chars=150),
            "payload": {
                "partId": "",
                "mimeType": "multipart/alternative",
                "filename": "",
                "headers": [
                    {"name": "From", "value": fake.email()},
                    {"name": "To", "value": fake.email()},
                    {"name": "Subject", "value": fake.sentence()},
                    {"name": "Date", "value": fake.date_time_this_month().strftime("%a, %d %b %Y %H:%M:%S %z")}
                ],
                "body": {
                    "size": random.randint(100, 5000)
                },
                "parts": [
                    {
                        "partId": "0",
                        "mimeType": "text/plain",
                        "filename": "",
                        "headers": [
                            {"name": "Content-Type", "value": "text/plain; charset=UTF-8"}
                        ],
                        "body": {
                            "size": random.randint(100, 2000),
                            "data": "SGVsbG8gV29ybGQh"  # Base64 encoded "Hello World!"
                        }
                    }
                ]
            },
            "sizeEstimate": random.randint(1000, 10000),
            "historyId": str(random.randint(10000, 99999)),
            "internalDate": str(int(fake.date_time_this_month().timestamp() * 1000))
        }
    
    @responses.activate
    def setup_mock_responses(self):
        """Setup mock HTTP responses for Gmail API"""
        # Mock messages list endpoint
        responses.add_callback(
            responses.GET,
            url_matcher=lambda url: "gmail/v1/users/me/messages" in url.url,
            callback=self._mock_messages_list_callback,
            content_type="application/json"
        )
        
        # Mock message get endpoint
        responses.add_callback(
            responses.GET,
            url_matcher=lambda url: "gmail/v1/users/me/messages/" in url.url and len(url.url.split('/')[-1]) > 10,
            callback=self._mock_message_get_callback,
            content_type="application/json"
        )
    
    def _mock_messages_list_callback(self, request):
        """Callback for Gmail messages list requests"""
        messages = [{"id": msg["id"], "threadId": msg["threadId"]} for msg in [self.generate_mock_gmail_message() for _ in range(10)]]
        return (200, {}, json.dumps({
            "messages": messages,
            "nextPageToken": f"token_{uuid.uuid4().hex[:16]}",
            "resultSizeEstimate": len(messages)
        }))
    
    def _mock_message_get_callback(self, request):
        """Callback for Gmail message get requests"""
        message = self.generate_mock_gmail_message()
        return (200, {}, json.dumps(message))


class MockSMTPService:
    """Mock SMTP service"""
    
    def __init__(self):
        self.sent_emails = []
    
    def mock_send_email(self, to_addresses: List[str], subject: str, body: str, from_address: str = None) -> bool:
        """Mock email sending"""
        email_record = {
            "id": str(uuid.uuid4()),
            "to": to_addresses,
            "subject": subject,
            "body": body,
            "from": from_address or "test@example.com",
            "sent_at": datetime.now().isoformat(),
            "status": "sent"
        }
        
        self.sent_emails.append(email_record)
        return True
    
    def get_sent_emails(self) -> List[Dict[str, Any]]:
        """Get list of sent emails"""
        return self.sent_emails
    
    def clear_sent_emails(self):
        """Clear sent emails list"""
        self.sent_emails = []


class MockIMAPService:
    """Mock IMAP service"""
    
    def __init__(self):
        self.mock_mailboxes = {
            "INBOX": [self._generate_mock_email() for _ in range(20)],
            "SENT": [self._generate_mock_email() for _ in range(10)],
            "DRAFTS": [self._generate_mock_email() for _ in range(3)],
            "TRASH": [self._generate_mock_email() for _ in range(5)]
        }
    
    def _generate_mock_email(self) -> Dict[str, Any]:
        """Generate mock IMAP email"""
        return {
            "uid": random.randint(1000, 9999),
            "message_id": f"<{uuid.uuid4()}@example.com>",
            "subject": fake.sentence(),
            "from": fake.email(),
            "to": fake.email(),
            "date": fake.date_time_this_month(),
            "body": fake.text(max_nb_chars=1000),
            "flags": random.sample(["\\Seen", "\\Answered", "\\Flagged", "\\Deleted"], random.randint(0, 2))
        }
    
    def mock_list_mailboxes(self) -> List[str]:
        """Mock mailbox listing"""
        return list(self.mock_mailboxes.keys())
    
    def mock_get_messages(self, mailbox: str = "INBOX", limit: int = 10) -> List[Dict[str, Any]]:
        """Mock message retrieval"""
        return self.mock_mailboxes.get(mailbox, [])[:limit]


class MockServicesManager:
    """Centralized mock services manager"""
    
    def __init__(self):
        self.microsoft_graph = MockMicrosoftGraphService()
        self.openai = MockOpenAIService()
        self.gmail = MockGmailService()
        self.smtp = MockSMTPService()
        self.imap = MockIMAPService()
        self.patches = []
    
    def setup_all_mocks(self):
        """Setup all mock services"""
        # Setup HTTP mocks
        self.microsoft_graph.setup_mock_responses()
        self.openai.setup_mock_responses()
        self.gmail.setup_mock_responses()
        
        # Setup Python mocks
        self._setup_python_mocks()
    
    def _setup_python_mocks(self):
        """Setup Python-based mocks"""
        # Mock OpenAI client
        openai_patch = patch('openai.ChatCompletion.create')
        mock_openai_create = openai_patch.start()
        mock_openai_create.side_effect = lambda **kwargs: self.openai.generate_mock_completion_response(
            kwargs.get('messages', [{}])[-1].get('content', '')
        )
        self.patches.append(openai_patch)
        
        # Mock SMTP
        smtp_patch = patch('smtplib.SMTP')
        mock_smtp = smtp_patch.start()
        mock_smtp_instance = MagicMock()
        mock_smtp_instance.send_message.side_effect = lambda msg: self.smtp.mock_send_email(
            msg['To'].split(','), msg['Subject'], str(msg), msg['From']
        )
        mock_smtp.return_value = mock_smtp_instance
        self.patches.append(smtp_patch)
        
        # Mock IMAP
        imap_patch = patch('imaplib.IMAP4_SSL')
        mock_imap = imap_patch.start()
        mock_imap_instance = MagicMock()
        mock_imap_instance.list.return_value = ('OK', [f'({flags}) "/" {mailbox}'.encode() 
                                                       for mailbox, flags in [("INBOX", "\\HasNoChildren"), ("SENT", "\\HasNoChildren")]])
        mock_imap.return_value = mock_imap_instance
        self.patches.append(imap_patch)
    
    def teardown_mocks(self):
        """Teardown all mocks"""
        # Stop all patches
        for patch_obj in self.patches:
            patch_obj.stop()
        self.patches.clear()
        
        # Clear responses
        if hasattr(responses, 'registered'):
            responses.reset()
        
        # Clear sent emails
        self.smtp.clear_sent_emails()
    
    def get_mock_stats(self) -> Dict[str, Any]:
        """Get statistics from mock services"""
        return {
            "openai_requests": self.openai.request_count,
            "sent_emails": len(self.smtp.sent_emails),
            "microsoft_graph_active": len(self.microsoft_graph.access_tokens),
            "gmail_messages": len(self.gmail.mock_messages),
            "imap_mailboxes": len(self.imap.mock_mailboxes)
        }


# Global mock manager instance
mock_services = MockServicesManager()


# Context manager for easy mock setup/teardown
class MockServicesContext:
    """Context manager for mock services"""
    
    def __enter__(self):
        mock_services.setup_all_mocks()
        return mock_services
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        mock_services.teardown_mocks()


if __name__ == "__main__":
    # Example usage
    with MockServicesContext() as mocks:
        print("Mock services active")
        print(f"Mock stats: {mocks.get_mock_stats()}")
        
        # Test OpenAI mock
        response = mocks.openai.generate_mock_completion_response("Analyze sentiment: I love this product!")
        print(f"OpenAI mock response: {response}")
        
        # Test Microsoft Graph mock
        token_response = mocks.microsoft_graph.generate_mock_token_response()
        print(f"Microsoft Graph token: {token_response}")
        
        # Test SMTP mock
        mocks.smtp.mock_send_email(["test@example.com"], "Test Subject", "Test Body")
        print(f"Sent emails: {len(mocks.smtp.get_sent_emails())}")
    
    print("Mock services cleaned up")