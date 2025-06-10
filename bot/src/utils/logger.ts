import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LogContext {
  service?: string;
  userId?: string;
  telegramId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: any;
}

export function createLogger(context: LogContext = {}) {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const contextStr = Object.keys(context).length > 0 ? ` [${JSON.stringify(context)}]` : '';
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

        return `${timestamp} [${level.toUpperCase()}]${contextStr} ${message}${metaStr}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
      new DailyRotateFile({
        filename: process.env.LOG_FILE_PATH
          ? `${process.env.LOG_FILE_PATH}/bot-%DATE%.log`
          : './logs/bot-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    ],
  });

  return {
    info: (message: string, meta?: any) => logger.info(message, { ...context, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { ...context, ...meta }),
    error: (message: string, meta?: any) => logger.error(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { ...context, ...meta }),
    child: (childContext: LogContext) => createLogger({ ...context, ...childContext }),
  };
}
