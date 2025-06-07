/**
 * Simple logger interface for shared module
 * This will be implemented differently in each service (backend, bot)
 */

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface LogContext {
  userId?: string;
  telegramId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: any;
}

/**
 * Console logger implementation for development
 */
export class ConsoleLogger implements Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 
      ? ` [${JSON.stringify(this.context)}]` 
      : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    
    return `${timestamp} [${level.toUpperCase()}]${contextStr} ${message}${metaStr}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: any): void {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message: string, meta?: any): void {
    console.debug(this.formatMessage('debug', message, meta));
  }

  child(context: LogContext): Logger {
    return new ConsoleLogger({ ...this.context, ...context });
  }
}

/**
 * No-op logger for testing
 */
export class NoOpLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  meta?: any;
  error?: Error;
}

/**
 * Create a logger with context
 */
export function createLogger(context: LogContext = {}): Logger {
  return new ConsoleLogger(context);
}

/**
 * Format error for logging
 */
export function formatError(error: Error): any {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

/**
 * Log performance timing
 */
export function logTiming(logger: Logger, operation: string, startTime: number): void {
  const duration = Date.now() - startTime;
  logger.info(`${operation} completed`, { duration: `${duration}ms` });
}

/**
 * Create correlation ID for request tracking
 */
export function createCorrelationId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Sanitize sensitive data for logging
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}
