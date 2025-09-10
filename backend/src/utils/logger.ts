import fs from 'fs';
import path from 'path';
import config from '@/config';

/**
 * Custom logger utility
 * Provides structured logging with different levels and formats
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
  requestId?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logDir: string;

  private constructor() {
    this.logLevel = this.getLogLevel(config.env.LOG_LEVEL);
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLog(level: LogLevel, message: string, meta?: any, requestId?: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message
    };
    
    if (meta !== undefined) {
      entry.meta = meta;
    }
    
    if (requestId !== undefined) {
      entry.requestId = requestId;
    }
    
    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private writeToFile(logEntry: LogEntry): void {
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFile(logFile, logLine, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      }
    });
  }

  private logToConsole(logEntry: LogEntry): void {
    const colorMap = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m'  // Magenta
    };
    
    const resetColor = '\x1b[0m';
    const color = colorMap[logEntry.level as keyof typeof colorMap] || '';
    
    const formattedMessage = `${color}[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}${resetColor}`;
    
    if (logEntry.meta) {
      console.log(formattedMessage, logEntry.meta);
    } else {
      console.log(formattedMessage);
    }
  }

  private log(level: LogLevel, message: string, meta?: any, requestId?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatLog(level, message, meta, requestId);
    
    // Always log to console
    this.logToConsole(logEntry);
    
    // Write to file in production or when specifically configured
    if (config.isProduction || config.env.LOG_LEVEL === 'debug') {
      this.writeToFile(logEntry);
    }
  }

  public error(message: string, meta?: any, requestId?: string): void {
    this.log(LogLevel.ERROR, message, meta, requestId);
  }

  public warn(message: string, meta?: any, requestId?: string): void {
    this.log(LogLevel.WARN, message, meta, requestId);
  }

  public info(message: string, meta?: any, requestId?: string): void {
    this.log(LogLevel.INFO, message, meta, requestId);
  }

  public debug(message: string, meta?: any, requestId?: string): void {
    this.log(LogLevel.DEBUG, message, meta, requestId);
  }

  // Helper method for HTTP request logging
  public httpRequest(method: string, url: string, statusCode: number, responseTime: number, requestId?: string): void {
    const message = `${method} ${url} - ${statusCode} - ${responseTime}ms`;
    this.info(message, { method, url, statusCode, responseTime }, requestId);
  }

  // Helper method for database operation logging
  public dbOperation(operation: string, table: string, duration: number, requestId?: string): void {
    const message = `DB ${operation} on ${table} - ${duration}ms`;
    this.debug(message, { operation, table, duration }, requestId);
  }

  // Helper method for error with stack trace
  public errorWithStack(message: string, error: Error, requestId?: string): void {
    this.error(message, {
      error: error.message,
      stack: error.stack,
      name: error.name
    }, requestId);
  }
}

// Export singleton instance
const logger = Logger.getInstance();
export default logger;