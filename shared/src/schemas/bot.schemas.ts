import { z } from 'zod';
import { BotMode, BotEventType } from '../types/bot';

// Bot session schemas
export const botSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mode: z.nativeEnum(BotMode).nullable(),
  state: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional(),
});

export const createBotSessionSchema = z.object({
  userId: z.string().uuid(),
  mode: z.nativeEnum(BotMode).nullable(),
  state: z.record(z.any()).default({}),
  expiresAt: z.date().optional(),
});

export const updateBotSessionSchema = z.object({
  mode: z.nativeEnum(BotMode).nullable().optional(),
  state: z.record(z.any()).optional(),
  expiresAt: z.date().optional(),
});

// Bot activity schemas
export const botActivitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  telegramId: z.string(),
  action: z.string().min(1, 'Action is required'),
  mode: z.nativeEnum(BotMode).optional(),
  details: z.record(z.any()).optional(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  createdAt: z.date(),
});

export const createBotActivitySchema = z.object({
  userId: z.string().uuid(),
  telegramId: z.string().regex(/^\d+$/, 'Telegram ID must be numeric'),
  action: z.string().min(1, 'Action is required').max(100, 'Action too long'),
  mode: z.nativeEnum(BotMode).optional(),
  details: z.record(z.any()).optional(),
  success: z.boolean(),
  errorMessage: z.string().max(1000, 'Error message too long').optional(),
});

export const botActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'action', 'success']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().uuid().optional(),
  telegramId: z.string().regex(/^\d+$/).optional(),
  mode: z.nativeEnum(BotMode).optional(),
  success: z.coerce.boolean().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// File metadata schemas
export const fileMetadataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fileName: z.string().min(1, 'File name is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().int().min(0, 'File size must be non-negative'),
  mimeType: z.string().optional(),
  mode: z.nativeEnum(BotMode),
  processed: z.boolean(),
  processedAt: z.date().optional(),
  createdAt: z.date(),
});

export const createFileMetadataSchema = z.object({
  userId: z.string().uuid(),
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  filePath: z.string().min(1, 'File path is required'),
  fileType: z.string().min(1, 'File type is required').max(50, 'File type too long'),
  fileSize: z.number().int().min(0, 'File size must be non-negative').max(100 * 1024 * 1024, 'File too large'), // 100MB max
  mimeType: z.string().max(100, 'MIME type too long').optional(),
  mode: z.nativeEnum(BotMode),
  processed: z.boolean().default(false),
});

export const updateFileMetadataSchema = z.object({
  processed: z.boolean().optional(),
  processedAt: z.date().optional(),
});

export const fileMetadataQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'fileName', 'fileSize', 'processed']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().uuid().optional(),
  mode: z.nativeEnum(BotMode).optional(),
  processed: z.coerce.boolean().optional(),
  fileType: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Bot configuration schemas
export const botConfigSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(1, 'Bot token is required'),
  apiServer: z.string().url('Invalid API server URL'),
  webhookUrl: z.string().url('Invalid webhook URL').optional(),
  isActive: z.boolean(),
  maxFileSize: z.number().int().min(1, 'Max file size must be positive'),
  allowedFileTypes: z.array(z.string()),
  features: z.array(z.object({
    feature: z.nativeEnum(BotMode),
    enabled: z.boolean(),
    config: z.record(z.any()),
  })),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateBotConfigSchema = z.object({
  token: z.string().min(1, 'Bot token is required').optional(),
  apiServer: z.string().url('Invalid API server URL').optional(),
  webhookUrl: z.string().url('Invalid webhook URL').optional(),
  isActive: z.boolean().optional(),
  maxFileSize: z.number().int().min(1, 'Max file size must be positive').optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  features: z.array(z.object({
    feature: z.nativeEnum(BotMode),
    enabled: z.boolean(),
    config: z.record(z.any()),
  })).optional(),
});

// Bot event schemas
export const botEventSchema = z.object({
  type: z.nativeEnum(BotEventType),
  userId: z.string().uuid(),
  telegramId: z.string().regex(/^\d+$/, 'Telegram ID must be numeric'),
  data: z.record(z.any()),
  timestamp: z.date(),
});

export const createBotEventSchema = z.object({
  type: z.nativeEnum(BotEventType),
  userId: z.string().uuid(),
  telegramId: z.string().regex(/^\d+$/, 'Telegram ID must be numeric'),
  data: z.record(z.any()).default({}),
});

// Bot command schemas
export const botCommandSchema = z.object({
  command: z.string().min(1, 'Command is required').regex(/^\/[a-zA-Z0-9_]+$/, 'Invalid command format'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  mode: z.nativeEnum(BotMode).optional(),
  adminOnly: z.boolean().default(false),
});

// Usage stats schemas
export const usageStatsSchema = z.object({
  zipCount: z.number().int().min(0),
  extractCount: z.number().int().min(0),
  searchCount: z.number().int().min(0),
  filesSent: z.number().int().min(0),
  filesReceived: z.number().int().min(0),
  lastUsed: z.number().int().min(0),
});

// User upload state schemas (for bot internal use)
export const userUploadStateSchema = z.object({
  mode: z.nativeEnum(BotMode).nullable(),
  files: z.array(z.string()),
  timestamp: z.number().int().min(0),
  searchPattern: z.string().optional(),
  extractedDir: z.string().optional(),
  searchResults: z.array(z.string()).optional(),
  extractedDirs: z.array(z.string()).optional(),
});

export const userOcrStateSchema = z.object({
  processingImage: z.boolean(),
  imagesProcessed: z.number().int().min(0),
  lastImagePath: z.string().optional(),
});

// File validation schemas
export const fileUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().min(1, 'File size must be positive').max(100 * 1024 * 1024, 'File too large'),
  mimeType: z.string().min(1, 'MIME type is required'),
  mode: z.nativeEnum(BotMode),
});

// Telegram-specific validation
export const telegramFileSchema = z.object({
  file_id: z.string().min(1, 'File ID is required'),
  file_unique_id: z.string().min(1, 'File unique ID is required'),
  file_size: z.number().int().min(0).optional(),
  file_path: z.string().optional(),
});

export const telegramUserSchema = z.object({
  id: z.number().int().positive('Invalid Telegram user ID'),
  is_bot: z.boolean(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

// Type exports
export type BotSessionInput = z.infer<typeof botSessionSchema>;
export type CreateBotSessionInput = z.infer<typeof createBotSessionSchema>;
export type UpdateBotSessionInput = z.infer<typeof updateBotSessionSchema>;
export type BotActivityInput = z.infer<typeof botActivitySchema>;
export type CreateBotActivityInput = z.infer<typeof createBotActivitySchema>;
export type BotActivityQueryInput = z.infer<typeof botActivityQuerySchema>;
export type FileMetadataInput = z.infer<typeof fileMetadataSchema>;
export type CreateFileMetadataInput = z.infer<typeof createFileMetadataSchema>;
export type UpdateFileMetadataInput = z.infer<typeof updateFileMetadataSchema>;
export type FileMetadataQueryInput = z.infer<typeof fileMetadataQuerySchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type UpdateBotConfigInput = z.infer<typeof updateBotConfigSchema>;
export type BotEventInput = z.infer<typeof botEventSchema>;
export type CreateBotEventInput = z.infer<typeof createBotEventSchema>;
export type BotCommandInput = z.infer<typeof botCommandSchema>;
export type UsageStatsInput = z.infer<typeof usageStatsSchema>;
export type UserUploadStateInput = z.infer<typeof userUploadStateSchema>;
export type UserOcrStateInput = z.infer<typeof userOcrStateSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type TelegramFileInput = z.infer<typeof telegramFileSchema>;
export type TelegramUserInput = z.infer<typeof telegramUserSchema>;
