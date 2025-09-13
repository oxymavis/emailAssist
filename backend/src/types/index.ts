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

// Email Provider Types
export type EmailProvider = 'microsoft' | 'gmail' | 'imap' | 'exchange';

export interface EmailProviderConfig {
  provider: EmailProvider;
  displayName: string;
  authType: 'oauth2' | 'basic' | 'ntlm';
  scopes?: string[];
  endpoints: {
    auth?: string;
    token?: string;
    api?: string;
  };
  capabilities: {
    sendEmail: boolean;
    readEmail: boolean;
    searchEmail: boolean;
    webhooks: boolean;
    calendar: boolean;
    contacts: boolean;
  };
}

// OAuth 2.0 Types
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope?: string;
}

// Email Account Types
export interface EmailAccount {
  id: string;
  userId: string;
  provider: EmailProvider;
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error' | 'initializing' | 'suspended';
  errorMessage?: string;
  connectionConfig: {
    oauth?: OAuthTokens;
    imap?: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
    };
    exchange?: {
      serverUrl: string;
      username: string;
      password: string;
      domain?: string;
    };
  };
  folderStructure: {
    inbox: string;
    sent: string;
    drafts: string;
    trash: string;
    spam?: string;
    custom: string[];
  };
  syncSettings: {
    autoSync: boolean;
    syncInterval: number; // in minutes
    syncScope: 'recent' | 'all' | 'custom';
    maxEmails?: number;
    syncFolders: string[];
    enableRealtime: boolean;
  };
  quotaInfo?: {
    used: number;
    total: number;
    remainingQuota: number;
  };
  createdAt: Date;
  updatedAt: Date;
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

// Gmail API Types
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      attachmentId?: string;
      size: number;
      data?: string;
    };
    parts?: any[];
  };
  sizeEstimate: number;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

// IMAP Types
export interface ImapMessage {
  uid: number;
  flags: string[];
  date: Date;
  struct: any;
  size: number;
  envelope: {
    date: Date;
    subject: string;
    from: Array<{
      name?: string;
      mailbox: string;
      host: string;
    }>;
    to: Array<{
      name?: string;
      mailbox: string;
      host: string;
    }>;
    cc?: Array<{
      name?: string;
      mailbox: string;
      host: string;
    }>;
    messageId: string;
  };
}

// Exchange Web Services (EWS) Types
export interface EwsMessage {
  itemId: {
    id: string;
    changeKey: string;
  };
  subject: string;
  body: {
    bodyType: 'HTML' | 'Text';
    value: string;
  };
  from: {
    name: string;
    emailAddress: string;
  };
  toRecipients: Array<{
    name: string;
    emailAddress: string;
  }>;
  ccRecipients?: Array<{
    name: string;
    emailAddress: string;
  }>;
  importance: 'Low' | 'Normal' | 'High';
  isRead: boolean;
  dateTimeReceived: string;
  dateTimeSent: string;
  hasAttachments: boolean;
  conversationId: string;
}

// Unified Email Message Interface
export interface UnifiedEmailMessage {
  id: string;
  providerId: string; // Original ID from provider
  provider: EmailProvider;
  accountId: string;
  subject: string;
  sender: {
    name?: string;
    address: string;
  };
  recipients: {
    to: Array<{ name?: string; address: string }>;
    cc?: Array<{ name?: string; address: string }>;
    bcc?: Array<{ name?: string; address: string }>;
  };
  content: {
    text?: string;
    html?: string;
    snippet?: string;
  };
  receivedAt: Date;
  sentAt?: Date;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    downloadUrl?: string;
  }>;
  labels: string[];
  folders: string[];
  flags: string[];
  conversationId?: string;
  threadId?: string;
  internetMessageId?: string;
  metadata: {
    originalData?: any;
    customProperties?: Record<string, any>;
  };
}

// Email Service Operation Types
export interface EmailSearchQuery {
  query?: string;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  importance?: 'low' | 'normal' | 'high';
  dateRange?: {
    start: Date;
    end: Date;
  };
  labels?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'date' | 'subject' | 'from' | 'importance';
  orderDirection?: 'asc' | 'desc';
}

export interface EmailSendRequest {
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  bcc?: Array<{ name?: string; address: string }>;
  subject: string;
  body: {
    text?: string;
    html?: string;
  };
  attachments?: Array<{
    name: string;
    content: Buffer | string;
    contentType: string;
  }>;
  importance?: 'low' | 'normal' | 'high';
  replyTo?: { name?: string; address: string };
  headers?: Record<string, string>;
}

export interface EmailOperationResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    provider: EmailProvider;
    operationType: string;
    timestamp: Date;
    executionTime: number;
  };
}

// Email Service Interface
export interface IEmailService {
  provider: EmailProvider;
  isConnected(): Promise<boolean>;
  connect(config: any): Promise<void>;
  disconnect(): Promise<void>;
  
  // Authentication
  authenticate(tokens: OAuthTokens): Promise<boolean>;
  refreshTokens(): Promise<OAuthTokens>;
  
  // Email operations
  getMessages(query?: EmailSearchQuery): Promise<UnifiedEmailMessage[]>;
  getMessage(messageId: string): Promise<UnifiedEmailMessage>;
  sendMessage(message: EmailSendRequest): Promise<EmailOperationResult>;
  deleteMessage(messageId: string): Promise<EmailOperationResult>;
  markAsRead(messageId: string, isRead: boolean): Promise<EmailOperationResult>;
  
  // Folder operations
  getFolders(): Promise<Array<{ id: string; name: string; type: string }>>;
  moveMessage(messageId: string, folderId: string): Promise<EmailOperationResult>;
  
  // Sync operations
  syncMessages(options?: { incremental?: boolean; folderId?: string }): Promise<{
    newMessages: UnifiedEmailMessage[];
    updatedMessages: UnifiedEmailMessage[];
    deletedMessageIds: string[];
  }>;
  
  // User info
  getUserInfo(): Promise<{
    email: string;
    name: string;
    quota?: {
      used: number;
      total: number;
    };
  }>;
  
  // Webhook support
  setupWebhook?(callbackUrl: string): Promise<{ subscriptionId: string }>;
  removeWebhook?(subscriptionId: string): Promise<void>;
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
  provider: EmailProvider;
  code?: string;
  state?: string;
  config?: {
    // For IMAP/SMTP
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    // For Exchange
    serverUrl?: string;
    domain?: string;
  };
}

// Email Sync Types
export interface SyncOperation {
  id: string;
  accountId: string;
  type: 'full' | 'incremental' | 'realtime';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  progress: {
    processed: number;
    total: number;
    currentFolder?: string;
  };
  stats: {
    newMessages: number;
    updatedMessages: number;
    deletedMessages: number;
    errors: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface WebhookNotification {
  id: string;
  provider: EmailProvider;
  accountId: string;
  type: 'message.created' | 'message.updated' | 'message.deleted' | 'folder.created' | 'folder.updated';
  data: {
    messageId?: string;
    folderId?: string;
    changeType?: string;
    timestamp: Date;
  };
  signature?: string;
  receivedAt: Date;
}

// Rate Limiting Types
export interface RateLimitConfig {
  provider: EmailProvider;
  limits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  quotas: {
    emailsPerDay?: number;
    apiCallsPerMonth?: number;
  };
}

export interface RateLimitStatus {
  provider: EmailProvider;
  accountId: string;
  current: {
    requestsThisSecond: number;
    requestsThisMinute: number;
    requestsThisHour: number;
    requestsThisDay: number;
  };
  limits: RateLimitConfig['limits'];
  resetTimes: {
    second: Date;
    minute: Date;
    hour: Date;
    day: Date;
  };
  isThrottled: boolean;
  retryAfter?: number;
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
  
  // Microsoft Graph API
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID: string;
  MICROSOFT_REDIRECT_URI: string;
  MICROSOFT_GRAPH_SCOPE: string;
  
  // Google Gmail API
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_GMAIL_SCOPE: string;
  
  // Email Service Settings
  EMAIL_SYNC_INTERVAL: number;
  EMAIL_BATCH_SIZE: number;
  EMAIL_SYNC_TIMEOUT: number;
  EMAIL_WEBHOOK_SECRET: string;
  EMAIL_ENCRYPTION_KEY: string;
  
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  BCRYPT_ROUNDS: number;
  LOG_LEVEL: string;
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_BASE_URL: string;
  DEEPSEEK_MODEL: string;
  DEEPSEEK_MAX_TOKENS: number;
  DEEPSEEK_TEMPERATURE: number;
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