// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Authentication types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Query parameters
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserQuery extends PaginationQuery {
  search?: string;
  role?: string;
  isActive?: boolean;
}

export interface BotActivityQuery extends PaginationQuery {
  userId?: string;
  telegramId?: string;
  mode?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface FileMetadataQuery extends PaginationQuery {
  userId?: string;
  mode?: string;
  processed?: boolean;
  fileType?: string;
  dateFrom?: string;
  dateTo?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: Date;
}

export enum WebSocketMessageType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',

  // Bot events
  BOT_ACTIVITY = 'bot_activity',
  USER_MODE_CHANGED = 'user_mode_changed',
  FILE_UPLOADED = 'file_uploaded',
  FILE_PROCESSED = 'file_processed',

  // User events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',

  // Feature events
  FEATURE_UPDATED = 'feature_updated',
  USER_FEATURE_ACCESS_CHANGED = 'user_feature_access_changed',

  // System events
  SYSTEM_STATUS = 'system_status',
  ERROR = 'error',
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    bot: ServiceHealth;
  };
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

// Dashboard types
export interface DashboardStats {
  users: {
    total: number;
    active: number;
    new: number;
  };
  bot: {
    totalCommands: number;
    activeUsers: number;
    filesProcessed: number;
  };
  features: {
    enabled: number;
    total: number;
    usage: Record<string, number>;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

// File upload types
export interface FileUploadResponse {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface FileDownloadRequest {
  fileId: string;
  userId?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

// Configuration types
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  type: ConfigType;
  updatedAt: Date;
  updatedBy: string;
}

export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

export interface UpdateConfigRequest {
  value: string;
}
