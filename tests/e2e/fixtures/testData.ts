// 测试数据工厂和固定装置

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
}

export interface TestEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
}

// 测试用户数据
export const testUsers: Record<string, TestUser> = {
  admin: {
    email: 'admin@example.com',
    password: 'admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  user: {
    email: 'user@example.com',
    password: 'user123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user'
  },
  viewer: {
    email: 'viewer@example.com',
    password: 'viewer123!',
    firstName: 'Viewer',
    lastName: 'User',
    role: 'viewer'
  }
};

// 测试邮件数据
export const testEmails: TestEmail[] = [
  {
    id: '1',
    from: 'customer@company.com',
    to: 'support@email-assist.com',
    subject: 'Urgent: Production Issue',
    content: 'We are experiencing a critical issue in production that needs immediate attention.',
    priority: 'high',
    sentiment: 'negative',
    timestamp: new Date('2024-01-15T09:30:00Z')
  },
  {
    id: '2',
    from: 'client@business.com',
    to: 'support@email-assist.com',
    subject: 'Feature Request',
    content: 'Could you please add a new feature to export reports in PDF format?',
    priority: 'medium',
    sentiment: 'neutral',
    timestamp: new Date('2024-01-15T10:15:00Z')
  },
  {
    id: '3',
    from: 'happy@customer.com',
    to: 'support@email-assist.com',
    subject: 'Thank you for excellent service',
    content: 'I wanted to thank your team for the excellent customer service and quick resolution.',
    priority: 'low',
    sentiment: 'positive',
    timestamp: new Date('2024-01-15T11:00:00Z')
  }
];

// API 响应模拟数据
export const mockAPIResponses = {
  dashboard: {
    stats: {
      totalEmails: 156,
      urgentEmails: 12,
      processedEmails: 144,
      avgResponseTime: '2.5 hours',
      sentimentBreakdown: {
        positive: 45,
        neutral: 89,
        negative: 22
      }
    },
    recentActivity: testEmails.slice(0, 5)
  },
  
  analysis: {
    sentimentAnalysis: {
      overall: 'neutral',
      confidence: 0.78,
      breakdown: {
        positive: 0.35,
        neutral: 0.42,
        negative: 0.23
      }
    },
    priorityRanking: [
      { id: '1', priority: 'high', score: 0.92 },
      { id: '4', priority: 'high', score: 0.87 },
      { id: '7', priority: 'medium', score: 0.65 }
    ]
  }
};

// 表单验证测试数据
export const formValidationData = {
  invalidEmails: [
    'invalid-email',
    '@domain.com',
    'user@',
    'user.domain.com',
    ''
  ],
  validEmails: [
    'user@domain.com',
    'test.user@example.org',
    'admin+test@company.co.uk'
  ],
  weakPasswords: [
    '123',
    'password',
    '12345678',
    'abcdefgh'
  ],
  strongPasswords: [
    'StrongP@ssw0rd!',
    'MySecure123#',
    'Complex$Pass2024'
  ]
};

// 测试环境配置
export const testConfig = {
  timeouts: {
    short: 2000,
    medium: 5000,
    long: 10000,
    apiRequest: 30000
  },
  
  selectors: {
    loadingSpinner: '[data-testid="loading-spinner"]',
    errorMessage: '[data-testid="error-message"]',
    successMessage: '[data-testid="success-message"]',
    confirmDialog: '[data-testid="confirm-dialog"]'
  },
  
  urls: {
    login: '/login',
    dashboard: '/dashboard',
    analysis: '/analysis',
    settings: '/settings',
    reports: '/reports'
  }
};

// 邮件分析测试数据
export const emailTestData = {
  urgentEmail: {
    content: 'URGENT: Critical production system is down! Need immediate assistance!',
    from: 'ops@company.com',
    subject: 'URGENT: Production System Down',
    expectedSentiment: 'negative',
    expectedPriority: 'high'
  },
  
  positiveEmail: {
    content: 'Thank you so much for the excellent service! Everything works perfectly and our team is very satisfied with the results.',
    from: 'happy@customer.com',
    subject: 'Thanks for great service',
    expectedSentiment: 'positive',
    expectedPriority: 'low'
  },
  
  negativeEmail: {
    content: 'I am extremely disappointed with the service. The system has been failing repeatedly and causing major issues for our business.',
    from: 'angry@customer.com',
    subject: 'Very disappointed with service',
    expectedSentiment: 'negative',
    expectedPriority: 'high'
  },
  
  neutralEmail: {
    content: 'Please provide an update on the project status. We need to know the current progress and timeline.',
    from: 'manager@company.com',
    subject: 'Project Status Update Request',
    expectedSentiment: 'neutral',
    expectedPriority: 'medium'
  },
  
  highPriorityEmail: {
    content: 'CRITICAL: Security breach detected. Immediate action required to secure our systems.',
    from: 'security@company.com',
    subject: 'CRITICAL: Security Alert',
    expectedPriority: 'high'
  },
  
  mediumPriorityEmail: {
    content: 'We would like to schedule a meeting next week to discuss the new project requirements.',
    from: 'pm@company.com',
    subject: 'Meeting Schedule Request',
    expectedPriority: 'medium'
  },
  
  lowPriorityEmail: {
    content: 'Just wanted to share some feedback about the recent improvements to the user interface.',
    from: 'user@company.com',
    subject: 'UI Feedback',
    expectedPriority: 'low'
  },
  
  keywordRichEmail: {
    content: 'The project deadline is approaching fast and we need to discuss the budget allocation for the urgent meeting scheduled tomorrow.',
    from: 'pm@company.com',
    subject: 'Project Deadline and Budget Meeting',
    expectedKeywords: ['project', 'deadline', 'budget', 'meeting', 'urgent']
  },
  
  sampleEmail: {
    content: 'This is a sample email content used for testing the analysis functionality.',
    from: 'test@example.com',
    subject: 'Sample Email for Testing'
  },
  
  largeEmail: {
    content: 'This is a very long email content that simulates a real-world scenario with extensive text. '.repeat(100) + 
             'The purpose is to test the performance of the email analysis system when processing large amounts of text data.',
    from: 'sender@company.com',
    subject: 'Large Email Content for Performance Testing'
  },
  
  chineseEmail: {
    content: '您好，我需要关于产品功能的帮助。系统运行正常，但我有一些问题需要解决。谢谢您的协助。',
    from: 'user@china.com',
    subject: '产品功能咨询',
    expectedSentiment: 'neutral'
  },
  
  englishEmail: {
    content: 'Hello, I need help with the product features. The system is working fine, but I have some questions that need to be resolved.',
    from: 'user@company.com',
    subject: 'Product Feature Inquiry',
    expectedSentiment: 'neutral'
  }
};

// 性能测试配置
export const performanceTestData = {
  largeDataset: {
    emailCount: 1000,
    batchSize: 100,
    expectedProcessingTime: 30000, // 30秒
  },
  
  concurrentUsers: {
    userCount: 50,
    requestsPerUser: 10,
    expectedResponseTime: 2000, // 2秒
  },
  
  loadTesting: {
    rampUpTime: 60000, // 1分钟
    sustainTime: 300000, // 5分钟
    rampDownTime: 60000, // 1分钟
  }
};

// 可访问性测试数据
export const accessibilityTestData = {
  keyboardNavigation: [
    { key: 'Tab', expectedFocus: 'email-content-textarea' },
    { key: 'Tab', expectedFocus: 'from-field-input' },
    { key: 'Tab', expectedFocus: 'subject-field-input' },
    { key: 'Tab', expectedFocus: 'analyze-button' },
  ],
  
  screenReader: {
    requiredAriaLabels: [
      'email-content-textarea',
      'analyze-button',
      'analysis-results',
      'sentiment-result',
      'priority-result'
    ],
    requiredRoles: [
      { element: 'analysis-results', role: 'region' },
      { element: 'sentiment-chart', role: 'img' },
      { element: 'priority-distribution', role: 'img' }
    ]
  },
  
  colorContrast: {
    minimumRatio: 4.5,
    elementsToCheck: [
      'analyze-button',
      'sentiment-result',
      'priority-result',
      'error-message'
    ]
  }
};

// API mock响应数据
export const apiMockData = {
  emailAnalysis: {
    success: {
      analysis: {
        sentiment: 'positive',
        priority: 'medium',
        keywords: ['help', 'support', 'question'],
        confidence_score: 0.85,
        processing_time: 1.2
      }
    },
    
    error: {
      detail: 'AI service temporarily unavailable',
      error_code: 'SERVICE_UNAVAILABLE'
    },
    
    validation: {
      detail: [
        {
          loc: ['email_content'],
          msg: 'field required',
          type: 'value_error.missing'
        }
      ]
    }
  },
  
  batchAnalysis: {
    success: {
      batch_id: 'batch_123456',
      status: 'processing',
      total_emails: 50,
      processed_emails: 0,
      estimated_time: 120
    },
    
    completed: {
      batch_id: 'batch_123456',
      status: 'completed',
      total_emails: 50,
      processed_emails: 50,
      results_summary: {
        sentiment_distribution: {
          positive: 20,
          neutral: 25,
          negative: 5
        },
        priority_distribution: {
          high: 8,
          medium: 22,
          low: 20
        }
      }
    }
  }
};

// 数据生成工具函数
export class TestDataFactory {
  static generateEmail(overrides: Partial<TestEmail> = {}): TestEmail {
    const defaultEmail: TestEmail = {
      id: Math.random().toString(36).substr(2, 9),
      from: `user${Math.floor(Math.random() * 1000)}@example.com`,
      to: 'support@email-assist.com',
      subject: `Test Subject ${Date.now()}`,
      content: 'This is a test email content for automated testing.',
      priority: 'medium',
      sentiment: 'neutral',
      timestamp: new Date()
    };
    
    return { ...defaultEmail, ...overrides };
  }
  
  static generateUser(overrides: Partial<TestUser> = {}): TestUser {
    const defaultUser: TestUser = {
      email: `test${Math.floor(Math.random() * 1000)}@example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    };
    
    return { ...defaultUser, ...overrides };
  }
  
  static generateMultipleEmails(count: number): TestEmail[] {
    return Array.from({ length: count }, () => this.generateEmail());
  }
}