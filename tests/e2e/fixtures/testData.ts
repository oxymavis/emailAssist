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