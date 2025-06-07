export interface BotSession {
  id: string;
  userId: string;
  mode: BotMode | null;
  state: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export enum BotMode {
  OCR = 'ocr',
  ARCHIVE = 'rar',
  LOCATION = 'location',
  GEOTAGS = 'geotags',
  KML = 'kml',
  WORKBOOK = 'workbook'
}

export interface BotActivity {
  id: string;
  userId: string;
  telegramId: string;
  action: string;
  mode?: BotMode;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface FileMetadata {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  mimeType?: string;
  mode: BotMode;
  processed: boolean;
  processedAt?: Date;
  createdAt: Date;
}

// Bot command interfaces
export interface BotCommand {
  command: string;
  description: string;
  mode?: BotMode;
  adminOnly?: boolean;
}

// User upload state interfaces (from existing code patterns)
export interface UserUploadState {
  mode: BotMode | null;
  files: string[];
  timestamp: number;
  searchPattern?: string;
  extractedDir?: string;
  searchResults?: string[];
  extractedDirs?: string[];
}

export interface UserOcrState {
  processingImage: boolean;
  imagesProcessed: number;
  lastImagePath?: string;
}

export interface UsageStats {
  zipCount: number;
  extractCount: number;
  searchCount: number;
  filesSent: number;
  filesReceived: number;
  lastUsed: number;
}

// Bot configuration
export interface BotConfig {
  id: string;
  token: string;
  apiServer: string;
  webhookUrl?: string;
  isActive: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
  features: BotFeatureConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BotFeatureConfig {
  feature: BotMode;
  enabled: boolean;
  config: Record<string, any>;
}

// Real-time events
export interface BotEvent {
  type: BotEventType;
  userId: string;
  telegramId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export enum BotEventType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  MODE_CHANGED = 'mode_changed',
  FILE_UPLOADED = 'file_uploaded',
  FILE_PROCESSED = 'file_processed',
  COMMAND_EXECUTED = 'command_executed',
  ERROR_OCCURRED = 'error_occurred'
}

// API responses
export interface BotStatsResponse {
  totalUsers: number;
  activeUsers: number;
  totalCommands: number;
  totalFiles: number;
  featureUsage: Record<BotMode, number>;
  recentActivity: BotActivity[];
}

export interface UserBotHistoryResponse {
  activities: BotActivity[];
  files: FileMetadata[];
  stats: UsageStats;
}
