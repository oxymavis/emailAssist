import { Request } from 'express';

// Core Types and Interfaces
export class EmailSyncError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'EmailSyncError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface EmailAnalysisResult {
  id: string;
  emailId: string;
  sentiment: EmailSentiment;
  urgency: EmailUrgency;
  category: string;
  keyTopics: string[];
  summary: string;
  actionRequired: boolean;
  suggestedResponse?: string;
  confidence: number;
  processedAt: string;
}

export type EmailSentiment = 'positive' | 'neutral' | 'negative';
export type EmailUrgency = 'low' | 'medium' | 'high' | 'critical';

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
  
  // Redis Configuration
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD: string;
  REDIS_DB: string;
  
  // API Configuration
  API_BASE_URL: string;
}

// Filter Rule Types
export interface FilterAction {
  id?: string;
  type: 'mark_as_read' | 'mark_as_unread' | 'move_to_folder' | 'add_label' | 'delete' | 'forward' | 'reply' | 'archive' | 'add_tag' | 'remove_tag' | 'copy_to_folder' | 'create_task' | 'send_notification' | 'set_importance' | 'delete_message';
  parameters: Record<string, any>;
  value?: string | boolean | number;
}

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
  stopProcessing?: boolean;
  appliedCount?: number;
  lastAppliedAt?: Date;
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
  
  // Additional properties for compatibility
  from?: {
    name: string;
    email: string;
  };
  to?: Array<{ name: string; email: string }>;
  body?: string;
  size?: number;
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

// Notification Types
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'websocket' | 'email' | 'webhook' | 'sms';
  isEnabled: boolean;
  config: {
    // WebSocket specific
    socketNamespace?: string;
    
    // Email specific
    smtpSettings?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    
    // Webhook specific
    webhookUrl?: string;
    webhookSecret?: string;
    webhookHeaders?: Record<string, string>;
    
    // SMS specific
    smsProvider?: 'twilio' | 'aws-sns';
    smsConfig?: Record<string, any>;
  };
  retryConfig: {
    maxAttempts: number;
    retryDelay: number; // in seconds
    backoffMultiplier: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'email_alert' | 'priority_email' | 'ai_analysis' | 'system_alert' | 'custom';
  channels: Array<{
    channelId: string;
    isEnabled: boolean;
    templateContent: {
      // For email
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      
      // For WebSocket/Push
      title?: string;
      message?: string;
      icon?: string;
      
      // For Webhook
      payload?: Record<string, any>;
    };
  }>;
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
  isSystem: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number; // 1-10, higher = more priority
  triggers: Array<{
    type: 'email_analysis' | 'filter_rule' | 'time_based' | 'system_event' | 'api_trigger';
    conditions: {
      // For email analysis triggers
      analysisTypes?: Array<'sentiment' | 'priority' | 'category'>;
      sentimentThreshold?: number;
      priorityThreshold?: number;
      categories?: string[];
      
      // For filter rule triggers
      ruleIds?: string[];
      
      // For time-based triggers
      schedule?: {
        type: 'cron' | 'interval';
        expression: string; // cron expression or interval in ms
        timezone?: string;
      };
      
      // For system event triggers
      eventTypes?: Array<'user_login' | 'sync_completed' | 'sync_failed' | 'quota_exceeded'>;
      
      // General conditions
      additionalFilters?: {
        senderDomains?: string[];
        subjectKeywords?: string[];
        timeRange?: {
          start: string; // HH:mm
          end: string;   // HH:mm
        };
        workingDaysOnly?: boolean;
      };
    };
  }>;
  actions: Array<{
    channelId: string;
    templateId: string;
    isEnabled: boolean;
    throttling?: {
      maxPerHour?: number;
      maxPerDay?: number;
      cooldownMinutes?: number;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  globalSettings: {
    isEnabled: boolean;
    quietHours?: {
      start: string; // HH:mm
      end: string;   // HH:mm
      timezone: string;
    };
    workingDaysOnly: boolean;
    maxNotificationsPerHour: number;
  };
  channelPreferences: Array<{
    channelId: string;
    isEnabled: boolean;
    priority: number;
    settings: Record<string, any>;
  }>;
  categoryPreferences: Array<{
    category: NotificationTemplate['category'];
    isEnabled: boolean;
    minPriority: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  ruleId?: string;
  templateId: string;
  channelId: string;
  priority: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  title: string;
  message: string;
  data?: Record<string, any>; // Template variables and context
  metadata: {
    sourceType: 'email_analysis' | 'filter_rule' | 'system_event' | 'manual';
    sourceId?: string; // email ID, rule ID, etc.
    triggeredBy?: string;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
    retryCount: number;
    lastRetryAt?: Date;
  };
  deliveryResults: Array<{
    attempt: number;
    attemptedAt: Date;
    result: 'success' | 'error';
    errorCode?: string;
    errorMessage?: string;
    responseData?: any;
  }>;
  readAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  totalNotifications: number;
  sentNotifications: number;
  failedNotifications: number;
  pendingNotifications: number;
  successRate: number;
  avgDeliveryTime: number; // in milliseconds
  notificationsByChannel: Record<string, number>;
  notificationsByTemplate: Record<string, number>;
  recentFailures: Array<{
    notificationId: string;
    errorCode: string;
    errorMessage: string;
    occurredAt: Date;
  }>;
}

// Notification Service Interfaces
export interface INotificationService {
  // Template management
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;
  updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  deleteTemplate(id: string): Promise<void>;
  getTemplate(id: string): Promise<NotificationTemplate | null>;
  getTemplates(category?: NotificationTemplate['category']): Promise<NotificationTemplate[]>;
  
  // Rule management
  createRule(rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule>;
  updateRule(id: string, updates: Partial<NotificationRule>): Promise<NotificationRule>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<NotificationRule | null>;
  getUserRules(userId: string): Promise<NotificationRule[]>;
  
  // Channel management
  createChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel>;
  updateChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel>;
  deleteChannel(id: string): Promise<void>;
  getChannel(id: string): Promise<NotificationChannel | null>;
  getChannels(): Promise<NotificationChannel[]>;
  
  // Preference management
  getUserPreferences(userId: string): Promise<NotificationPreference | null>;
  updateUserPreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<NotificationPreference>;
  
  // Notification processing
  triggerNotification(trigger: {
    type: NotificationRule['triggers'][0]['type'];
    userId: string;
    data: Record<string, any>;
    sourceId?: string;
    priority?: number;
  }): Promise<Notification[]>;
  
  processNotification(notificationId: string): Promise<void>;
  retryFailedNotification(notificationId: string): Promise<void>;
  cancelNotification(notificationId: string): Promise<void>;
  
  // Queue management
  getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    failed: number;
  }>;
  
  // Analytics
  getNotificationStats(userId?: string, timeRange?: { start: Date; end: Date }): Promise<NotificationStats>;
  getUserNotifications(userId: string, options?: {
    limit?: number;
    offset?: number;
    status?: Notification['status'];
    unreadOnly?: boolean;
  }): Promise<{
    notifications: Notification[];
    total: number;
  }>;
  
  markAsRead(notificationId: string, userId: string): Promise<void>;
  archiveNotification(notificationId: string, userId: string): Promise<void>;
}

// WebSocket Event Types
export interface WebSocketNotificationEvent {
  type: 'notification' | 'notification_update' | 'notification_stats';
  data: {
    notification?: Notification;
    stats?: NotificationStats;
    userId: string;
  };
}

// API Request/Response Types
export interface CreateNotificationTemplateRequest {
  name: string;
  description?: string;
  category: NotificationTemplate['category'];
  channels: NotificationTemplate['channels'];
  variables?: NotificationTemplate['variables'];
}

export interface UpdateNotificationTemplateRequest {
  name?: string;
  description?: string;
  channels?: NotificationTemplate['channels'];
  variables?: NotificationTemplate['variables'];
}

export interface CreateNotificationRuleRequest {
  name: string;
  description?: string;
  priority?: number;
  triggers: NotificationRule['triggers'];
  actions: NotificationRule['actions'];
}

export interface UpdateNotificationRuleRequest {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  priority?: number;
  triggers?: NotificationRule['triggers'];
  actions?: NotificationRule['actions'];
}

export interface CreateNotificationChannelRequest {
  name: string;
  type: NotificationChannel['type'];
  config: NotificationChannel['config'];
  retryConfig?: NotificationChannel['retryConfig'];
}

export interface UpdateNotificationChannelRequest {
  name?: string;
  isEnabled?: boolean;
  config?: NotificationChannel['config'];
  retryConfig?: NotificationChannel['retryConfig'];
}

export interface TriggerNotificationRequest {
  type: NotificationRule['triggers'][0]['type'];
  data: Record<string, any>;
  sourceId?: string;
  priority?: number;
}

export interface UpdateNotificationPreferencesRequest {
  globalSettings?: NotificationPreference['globalSettings'];
  channelPreferences?: NotificationPreference['channelPreferences'];
  categoryPreferences?: NotificationPreference['categoryPreferences'];
}

// ===== 高级搜索和智能过滤系统类型定义 =====

// 搜索查询类型
export interface AdvancedSearchQuery {
  // 基础查询
  query?: string;
  queryType?: 'fulltext' | 'semantic' | 'advanced' | 'filter';
  
  // 全文搜索参数
  fulltext?: {
    query: string;
    language?: 'zh' | 'en' | 'auto';
    operator?: 'and' | 'or';
    fuzzy?: boolean;
    highlight?: boolean;
  };
  
  // 语义搜索参数
  semantic?: {
    query: string;
    threshold?: number;
    maxResults?: number;
    includeFulltext?: boolean;
  };
  
  // 高级过滤条件
  filters?: {
    sender?: {
      addresses?: string[];
      domains?: string[];
      exclude?: string[];
    };
    recipients?: {
      addresses?: string[];
      domains?: string[];
      includeCC?: boolean;
      includeBCC?: boolean;
    };
    subject?: {
      contains?: string[];
      excludes?: string[];
      exactMatch?: string;
      regex?: string;
    };
    content?: {
      contains?: string[];
      excludes?: string[];
      regex?: string;
      minLength?: number;
      maxLength?: number;
    };
    dates?: {
      received?: {
        start?: Date;
        end?: Date;
      };
      sent?: {
        start?: Date;
        end?: Date;
      };
      relative?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month';
    };
    properties?: {
      hasAttachments?: boolean;
      attachmentTypes?: string[];
      isRead?: boolean;
      importance?: 'low' | 'normal' | 'high';
      folders?: string[];
      labels?: string[];
      size?: {
        min?: number;
        max?: number;
      };
    };
    analysis?: {
      sentiment?: {
        min?: number;
        max?: number;
      };
      priority?: {
        min?: number;
        max?: number;
      };
      categories?: string[];
      keywords?: string[];
      confidence?: {
        min?: number;
      };
    };
  };
  
  // 排序和分页
  sort?: {
    field: 'date' | 'sender' | 'subject' | 'importance' | 'relevance' | 'sentiment' | 'priority';
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page?: number;
    limit?: number;
    offset?: number;
  };
  
  // 结果选项
  options?: {
    includeHighlight?: boolean;
    includeAnalysis?: boolean;
    includeAttachments?: boolean;
    groupByConversation?: boolean;
    deduplicate?: boolean;
  };
}

// 搜索结果类型
export interface SearchResult {
  id: string;
  score: number;
  relevanceType: 'exact' | 'fuzzy' | 'semantic' | 'keyword';
  email: EmailMessage;
  highlights?: {
    subject?: string[];
    content?: string[];
    sender?: string[];
  };
  explanation?: {
    matchedTerms: string[];
    searchType: string;
    scoreBreakdown?: {
      textRelevance?: number;
      semanticSimilarity?: number;
      recencyBoost?: number;
      importanceBoost?: number;
    };
  };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  executionTime: number;
  searchId: string;
  suggestions?: SearchSuggestion[];
  facets?: SearchFacets;
  pagination: {
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// 搜索建议类型
export interface SearchSuggestion {
  text: string;
  type: 'query' | 'filter' | 'sender' | 'subject' | 'keyword';
  category: string;
  confidence: number;
  frequency?: number;
}

// 搜索分面统计
export interface SearchFacets {
  senders: Array<{ value: string; count: number }>;
  subjects: Array<{ value: string; count: number }>;
  dates: Array<{ value: string; count: number }>;
  attachments: Array<{ value: string; count: number }>;
  importance: Array<{ value: string; count: number }>;
  folders: Array<{ value: string; count: number }>;
}

// 自动完成类型
export interface AutocompleteRequest {
  query: string;
  type?: 'all' | 'sender' | 'subject' | 'keyword' | 'filter';
  limit?: number;
  includeHistory?: boolean;
}

export interface AutocompleteResponse {
  suggestions: Array<{
    text: string;
    type: string;
    category: string;
    relevance: number;
    metadata?: {
      count?: number;
      lastUsed?: Date;
      isPopular?: boolean;
    };
  }>;
  executionTime: number;
}

// 搜索历史类型
export interface SearchHistory {
  id: string;
  userId: string;
  queryText: string;
  queryType: 'fulltext' | 'semantic' | 'advanced' | 'filter';
  searchFilters: AdvancedSearchQuery['filters'];
  resultsCount: number;
  executionTime: number;
  clickedResults: string[];
  searchSessionId?: string;
  createdAt: Date;
}

export interface SearchSession {
  id: string;
  userId: string;
  sessionStart: Date;
  sessionEnd?: Date;
  totalSearches: number;
  uniqueQueries: number;
  mostSearchedTerms: string[];
}

// 搜索过滤器预设
export interface SearchFilterPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  filterConfig: AdvancedSearchQuery;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 搜索分析统计
export interface SearchAnalytics {
  totalQueries: number;
  queryTypes: Record<string, number>;
  avgExecutionTime: number;
  slowQueries: number;
  noResultQueries: number;
  popularTerms: Array<{ term: string; count: number }>;
  userActivity: {
    activeUsers: number;
    avgQueriesPerUser: number;
  };
  performance: {
    p50ExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
  };
  timeRange: {
    start: Date;
    end: Date;
  };
}

// 语义搜索相关类型
export interface EmbeddingVector {
  id: string;
  messageId: string;
  vector: number[];
  model: string;
  createdAt: Date;
}

export interface SemanticSearchRequest {
  query: string;
  threshold?: number;
  maxResults?: number;
  includeMetadata?: boolean;
  filters?: AdvancedSearchQuery['filters'];
}

export interface SemanticSearchResult {
  messageId: string;
  similarity: number;
  embedding?: EmbeddingVector;
  message?: EmailMessage;
}

// 搜索索引管理
export interface SearchIndex {
  name: string;
  type: 'fulltext' | 'trigram' | 'vector';
  table: string;
  columns: string[];
  configuration?: string;
  isActive: boolean;
  lastUpdated: Date;
  documentCount: number;
  size: string;
}

export interface IndexRebuildStatus {
  indexName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  processedDocuments: number;
  totalDocuments: number;
}

// 搜索服务接口
export interface IAdvancedSearchService {
  // 全文搜索
  fulltextSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse>;
  
  // 语义搜索
  semanticSearch(query: SemanticSearchRequest, userId: string): Promise<SearchResponse>;
  
  // 高级搜索（组合多种搜索方式）
  advancedSearch(query: AdvancedSearchQuery, userId: string): Promise<SearchResponse>;
  
  // 搜索建议
  getSuggestions(query: string, userId: string): Promise<SearchSuggestion[]>;
  
  // 自动完成
  autocomplete(request: AutocompleteRequest, userId: string): Promise<AutocompleteResponse>;
  
  // 搜索历史
  getSearchHistory(userId: string, limit?: number): Promise<SearchHistory[]>;
  saveSearchHistory(history: Omit<SearchHistory, 'id' | 'createdAt'>): Promise<void>;
  
  // 过滤器预设
  getFilterPresets(userId: string): Promise<SearchFilterPreset[]>;
  saveFilterPreset(preset: Omit<SearchFilterPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SearchFilterPreset>;
  deleteFilterPreset(presetId: string, userId: string): Promise<void>;
  
  // 搜索分析
  getSearchAnalytics(userId?: string, timeRange?: { start: Date; end: Date }): Promise<SearchAnalytics>;
  
  // 索引管理
  getIndexStatus(): Promise<SearchIndex[]>;
  rebuildIndex(indexName: string): Promise<IndexRebuildStatus>;
}

// 语义搜索服务接口
export interface ISemanticSearchService {
  // 向量化文本
  embedText(text: string): Promise<number[]>;
  
  // 批量向量化
  embedTexts(texts: string[]): Promise<number[][]>;
  
  // 计算向量相似度
  calculateSimilarity(vector1: number[], vector2: number[]): number;
  
  // 语义搜索
  search(queryVector: number[], filters?: AdvancedSearchQuery['filters'], limit?: number): Promise<SemanticSearchResult[]>;
  
  // 更新邮件向量
  updateMessageEmbedding(messageId: string, content: string): Promise<void>;
  
  // 批量更新向量
  batchUpdateEmbeddings(messages: Array<{ id: string; content: string }>): Promise<void>;
  
  // 删除向量
  deleteMessageEmbedding(messageId: string): Promise<void>;
}

// API请求响应类型
export interface SearchRequest {
  query: AdvancedSearchQuery;
  sessionId?: string;
}

export interface AutocompleteRequest {
  query: string;
  type?: 'all' | 'sender' | 'subject' | 'keyword' | 'filter';
  limit?: number;
}

export interface SaveFilterPresetRequest {
  name: string;
  description?: string;
  filterConfig: AdvancedSearchQuery;
  isPublic?: boolean;
}

export interface UpdateFilterPresetRequest {
  name?: string;
  description?: string;
  filterConfig?: AdvancedSearchQuery;
  isPublic?: boolean;
}

// 搜索错误类型
export interface SearchError extends Error {
  code: 'INVALID_QUERY' | 'SEARCH_TIMEOUT' | 'INDEX_ERROR' | 'SEMANTIC_ERROR' | 'PERMISSION_DENIED';
  details?: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}