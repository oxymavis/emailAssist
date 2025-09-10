import { Request } from 'express';

// Core Types and Interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    version: string;
    requestId: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'readonly';
  microsoftTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'hourly' | 'daily';
  };
  analysis: {
    autoAnalyze: boolean;
    confidenceThreshold: number;
  };
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Email Account Types
export interface EmailAccount {
  id: string;
  userId: string;
  provider: 'microsoft' | 'gmail' | 'exchange';
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  folderStructure: {
    inbox: string;
    sent: string;
    drafts: string;
    custom: string[];
  };
  syncSettings: {
    autoSync: boolean;
    syncInterval: number;
    syncScope: 'recent' | 'all';
  };
  createdAt: Date;
}

// Microsoft Graph API Types
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  officeLocation?: string;
}

export interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  isDraft: boolean;
  sender: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  conversationId: string;
  parentFolderId: string;
  internetMessageId: string;
}

// Request/Response Types
export interface CreateUserRequest {
  email: string;
  name: string;
  password?: string;
}

export interface UpdateUserRequest {
  name?: string;
  avatar?: string;
  settings?: Partial<UserSettings>;
}

export interface MicrosoftAuthRequest {
  code: string;
  state?: string;
}

export interface ConnectEmailRequest {
  provider: 'microsoft' | 'gmail' | 'exchange';
  code?: string;
  state?: string;
}

// Error Types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Database Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// Cache Types
export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

// Environment Types
export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  API_VERSION: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID: string;
  MICROSOFT_REDIRECT_URI: string;
  MICROSOFT_GRAPH_SCOPE: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  BCRYPT_ROUNDS: number;
  LOG_LEVEL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_MAX_TOKENS: number;
  OPENAI_TEMPERATURE: number;
  AI_ANALYSIS_CACHE_TTL: number;
  AI_BATCH_SIZE: number;
  AI_ANALYSIS_TIMEOUT: number;
}

// Filter Rule Types
export interface FilterRuleCondition {
  id?: string;
  field: string; // subject, sender, content, priority, receivedDate, etc.
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: string | number | boolean;
  valueType: 'string' | 'number' | 'boolean' | 'date';
}

export interface FilterRuleAction {
  id?: string;
  type: 'add_tag' | 'remove_tag' | 'move_to_folder' | 'copy_to_folder' | 'forward' | 'create_task' | 'send_notification' | 'mark_as_read' | 'mark_as_unread' | 'set_importance' | 'delete_message';
  parameters: Record<string, any>;
}

export interface FilterRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  logicOperator: 'AND' | 'OR';
  conditions: FilterRuleCondition[];
  actions: FilterRuleAction[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFilterRuleRequest {
  name: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  logicOperator?: 'AND' | 'OR';
  conditions: FilterRuleCondition[];
  actions: FilterRuleAction[];
}

export interface UpdateFilterRuleRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  logicOperator?: 'AND' | 'OR';
  conditions?: FilterRuleCondition[];
  actions?: FilterRuleAction[];
}

export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  userId: string;
  emailMessageId: string;
  executionTime: Date;
  status: 'success' | 'error' | 'skipped';
  actionsExecuted: Array<{
    actionType: string;
    parameters: Record<string, any>;
    result: 'success' | 'error';
    errorMessage?: string;
  }>;
  errorMessage?: string;
  executionDurationMs?: number;
  createdAt: Date;
}

export interface CreateRuleExecutionLogRequest {
  ruleId: string;
  userId: string;
  emailMessageId: string;
  executionTime: Date;
  status: 'success' | 'error' | 'skipped';
  actionsExecuted?: Array<{
    actionType: string;
    parameters: Record<string, any>;
    result: 'success' | 'error';
    errorMessage?: string;
  }>;
  errorMessage?: string;
  executionDurationMs?: number;
}

export interface FilterRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateData: {
    name: string;
    description?: string;
    logicOperator: 'AND' | 'OR';
    conditions: FilterRuleCondition[];
    actions: FilterRuleAction[];
  };
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleTestRequest {
  conditions: FilterRuleCondition[];
  logicOperator: 'AND' | 'OR';
  testEmails: Array<{
    messageId: string;
    subject: string;
    sender: string;
    content: string;
    receivedDate: Date;
    importance: 'low' | 'normal' | 'high';
    isRead: boolean;
  }>;
}

export interface RuleTestResult {
  messageId: string;
  matched: boolean;
  matchedConditions: string[];
  nonMatchedConditions: string[];
  overallMatch: boolean;
}

export interface BatchRuleApplyRequest {
  ruleIds: string[];
  emailMessageIds: string[];
  dryRun?: boolean;
}

export interface BatchRuleApplyResult {
  processedEmails: number;
  appliedRules: number;
  totalActions: number;
  results: Array<{
    emailMessageId: string;
    appliedRules: Array<{
      ruleId: string;
      ruleName: string;
      matched: boolean;
      actionsExecuted: number;
      errors?: string[];
    }>;
  }>;
  errors: string[];
}

// Email Message Types (扩展现有的邮件类型)
export interface EmailMessage {
  id: string;
  userId: string;
  accountId: string;
  messageId: string; // Microsoft Graph API message ID
  conversationId: string;
  subject: string;
  sender: {
    name: string;
    address: string;
  };
  recipients: {
    to: Array<{ name: string; address: string }>;
    cc?: Array<{ name: string; address: string }>;
    bcc?: Array<{ name: string; address: string }>;
  };
  content: {
    text: string;
    html: string;
  };
  receivedAt: Date;
  sentAt: Date;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
  folders: string[];
  tags: string[];
  customProperties: Record<string, any>;
  analysisResult?: {
    sentiment: number;
    priority: number;
    category: string;
    keywords: string[];
    confidence: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Rule Engine Service Types
export interface RuleMatchResult {
  matched: boolean;
  matchedConditions: FilterRuleCondition[];
  nonMatchedConditions: FilterRuleCondition[];
  executionTime: number;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: Array<{
    actionType: string;
    parameters: Record<string, any>;
    result: 'success' | 'error';
    errorMessage?: string;
    executionTime: number;
  }>;
  totalExecutionTime: number;
  error?: string;
}

export interface RuleEngineStats {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  rulesWithErrors: number;
  lastExecutionTime?: Date;
}

// Express Extended Types
export interface AuthRequest extends Request {
  user?: User;
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}