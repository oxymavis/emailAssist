import dotenv from 'dotenv';
import { EnvironmentConfig } from '@/types';

// Load environment variables
dotenv.config();

/**
 * Application configuration class
 * Centralizes all environment variable management and validation
 */
class Config {
  private static instance: Config;
  public readonly env: EnvironmentConfig;

  private constructor() {
    this.env = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfig(): EnvironmentConfig {
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseInt(process.env.PORT || '3001', 10),
      API_VERSION: process.env.API_VERSION || 'v1',
      
      // Database
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/email_assist_dev',
      
      // Redis
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      
      // JWT
      JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_for_development_32_chars_minimum',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
      REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your_super_secret_refresh_token_key_for_development_32_chars_minimum',
      REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      
      // Microsoft OAuth2
      MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
      MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
      MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID || 'common',
      MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback',
      MICROSOFT_GRAPH_SCOPE: process.env.MICROSOFT_GRAPH_SCOPE || 'openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read',
      
      // CORS
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',
      
      // Rate Limiting
      RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      
      // Security
      BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
      
      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      
      // OpenAI Configuration
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
      OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
      OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
      
      // AI Analysis Configuration
      AI_ANALYSIS_CACHE_TTL: parseInt(process.env.AI_ANALYSIS_CACHE_TTL || '3600', 10),
      AI_BATCH_SIZE: parseInt(process.env.AI_BATCH_SIZE || '10', 10),
      AI_ANALYSIS_TIMEOUT: parseInt(process.env.AI_ANALYSIS_TIMEOUT || '30000', 10)
    };
  }

  private validateConfig(): void {
    const requiredFields = [
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET'
    ];

    const missingFields = requiredFields.filter(field => {
      const value = this.env[field as keyof EnvironmentConfig];
      return !value || (typeof value === 'string' && value.length < 32);
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing or invalid required environment variables: ${missingFields.join(', ')}`);
    }

    // Validate Microsoft configuration in production
    if (this.env.NODE_ENV === 'production') {
      const microsoftFields = ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'];
      const missingMicrosoftFields = microsoftFields.filter(field => !this.env[field as keyof EnvironmentConfig]);
      
      if (missingMicrosoftFields.length > 0) {
        console.warn(`Warning: Missing Microsoft OAuth configuration: ${missingMicrosoftFields.join(', ')}`);
      }
    }
  }

  // Computed properties for easier access
  public get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  public get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  public get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  public get corsOrigins(): string[] {
    return this.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  }

  public get microsoftScopes(): string[] {
    return this.env.MICROSOFT_GRAPH_SCOPE.split(' ').map(scope => scope.trim());
  }

  public get databaseConfig() {
    const url = new URL(this.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      ssl: this.isProduction
    };
  }

  public get redisConfig() {
    const url = new URL(this.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      db: 0
    };
  }
}

// Export singleton instance
export default Config.getInstance();

// Export configuration constants
export const API_CONFIG = {
  BASE_PATH: `/api/${Config.getInstance().env.API_VERSION}`,
  TIMEOUT: 30000,
  MAX_RETRIES: 3
};

export const MICROSOFT_CONFIG = {
  AUTHORITY: `https://login.microsoftonline.com/${Config.getInstance().env.MICROSOFT_TENANT_ID}`,
  TOKEN_ENDPOINT: `https://login.microsoftonline.com/${Config.getInstance().env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
  GRAPH_ENDPOINT: 'https://graph.microsoft.com/v1.0',
  SCOPES: Config.getInstance().microsoftScopes
};

export const OPENAI_CONFIG = {
  API_KEY: Config.getInstance().env.OPENAI_API_KEY,
  MODEL: Config.getInstance().env.OPENAI_MODEL,
  MAX_TOKENS: Config.getInstance().env.OPENAI_MAX_TOKENS,
  TEMPERATURE: Config.getInstance().env.OPENAI_TEMPERATURE
};

export const AI_CONFIG = {
  CACHE_TTL: Config.getInstance().env.AI_ANALYSIS_CACHE_TTL,
  BATCH_SIZE: Config.getInstance().env.AI_BATCH_SIZE,
  TIMEOUT: Config.getInstance().env.AI_ANALYSIS_TIMEOUT
};

export const CACHE_KEYS = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  USER_PROFILE: (userId: string) => `profile:${userId}`,
  EMAIL_ACCOUNT: (accountId: string) => `email_account:${accountId}`,
  MICROSOFT_TOKEN: (userId: string) => `ms_token:${userId}`,
  RATE_LIMIT: (ip: string) => `rate_limit:${ip}`,
  EMAIL_ANALYSIS: (emailId: string) => `analysis:${emailId}`,
  AI_BATCH_QUEUE: 'ai_batch_queue'
};

export const CACHE_TTL = {
  SESSION: 24 * 60 * 60, // 24 hours
  PROFILE: 60 * 60, // 1 hour
  EMAIL_ACCOUNT: 30 * 60, // 30 minutes
  MICROSOFT_TOKEN: 55 * 60, // 55 minutes (tokens expire in 1 hour)
  RATE_LIMIT: 15 * 60, // 15 minutes
  AI_ANALYSIS: Config.getInstance().env.AI_ANALYSIS_CACHE_TTL, // AI analysis cache
  AI_BATCH_RESULT: 60 * 60 // 1 hour for batch results
};