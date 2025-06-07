// Bot feature constants
export const BOT_FEATURES = {
  OCR: 'ocr',
  ARCHIVE: 'rar',
  LOCATION: 'location',
  GEOTAGS: 'geotags',
  KML: 'kml',
  WORKBOOK: 'workbook',
} as const;

// Bot commands
export const BOT_COMMANDS = {
  START: '/start',
  HELP: '/help',
  STATUS: '/status',
  CANCEL: '/cancel',
  OCR: '/ocr',
  RAR: '/rar',
  LOCATION: '/location',
  GEOTAGS: '/geotags',
  KML: '/kml',
  WORKBOOK: '/workbook',
  ADMIN: '/admin',
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_IMAGE_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_ARCHIVE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'],
  ARCHIVES: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  DOCUMENTS: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
  SPREADSHEETS: ['xls', 'xlsx', 'csv', 'ods'],
  GEOSPATIAL: ['kml', 'kmz', 'gpx', 'geojson'],
} as const;

// MIME types
export const MIME_TYPES = {
  // Images
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/bmp': ['bmp'],
  'image/webp': ['webp'],
  'image/tiff': ['tiff', 'tif'],
  
  // Archives
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-7z-compressed': ['7z'],
  'application/x-tar': ['tar'],
  'application/gzip': ['gz'],
  'application/x-bzip2': ['bz2'],
  
  // Documents
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt'],
  'application/rtf': ['rtf'],
  
  // Spreadsheets
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
  
  // Geospatial
  'application/vnd.google-earth.kml+xml': ['kml'],
  'application/vnd.google-earth.kmz': ['kmz'],
  'application/gpx+xml': ['gpx'],
  'application/geo+json': ['geojson'],
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  
  // Users
  USERS: '/users',
  USER_BY_ID: '/users/:id',
  USER_BY_TELEGRAM_ID: '/users/telegram/:telegramId',
  USER_FEATURES: '/users/:id/features',
  
  // Features
  FEATURES: '/features',
  FEATURE_BY_ID: '/features/:id',
  
  // Bot
  BOT_CONFIG: '/bot/config',
  BOT_STATS: '/bot/stats',
  BOT_ACTIVITIES: '/bot/activities',
  BOT_FILES: '/bot/files',
  BOT_SESSIONS: '/bot/sessions',
  
  // Files
  FILES: '/files',
  FILE_BY_ID: '/files/:id',
  FILE_DOWNLOAD: '/files/:id/download',
  FILE_UPLOAD: '/files/upload',
  
  // Dashboard
  DASHBOARD_STATS: '/dashboard/stats',
  
  // Health
  HEALTH: '/health',
  
  // WebSocket
  WEBSOCKET: '/ws',
} as const;

// Error codes
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_INACTIVE: 'USER_INACTIVE',
  
  // Feature errors
  FEATURE_NOT_FOUND: 'FEATURE_NOT_FOUND',
  FEATURE_ACCESS_DENIED: 'FEATURE_ACCESS_DENIED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',
  
  // Bot errors
  BOT_NOT_CONFIGURED: 'BOT_NOT_CONFIGURED',
  BOT_INACTIVE: 'BOT_INACTIVE',
  INVALID_BOT_TOKEN: 'INVALID_BOT_TOKEN',
  BOT_API_ERROR: 'BOT_API_ERROR',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const;

// Success messages (Indonesian)
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User berhasil dibuat',
  USER_UPDATED: 'User berhasil diperbarui',
  USER_DELETED: 'User berhasil dihapus',
  FEATURE_CREATED: 'Fitur berhasil dibuat',
  FEATURE_UPDATED: 'Fitur berhasil diperbarui',
  FEATURE_DELETED: 'Fitur berhasil dihapus',
  FEATURE_ACCESS_GRANTED: 'Akses fitur berhasil diberikan',
  FEATURE_ACCESS_REVOKED: 'Akses fitur berhasil dicabut',
  FILE_UPLOADED: 'File berhasil diupload',
  FILE_PROCESSED: 'File berhasil diproses',
  BOT_CONFIG_UPDATED: 'Konfigurasi bot berhasil diperbarui',
  LOGIN_SUCCESS: 'Login berhasil',
  LOGOUT_SUCCESS: 'Logout berhasil',
} as const;

// Error messages (Indonesian)
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Tidak memiliki akses',
  FORBIDDEN: 'Akses ditolak',
  TOKEN_EXPIRED: 'Token telah kedaluwarsa',
  INVALID_TOKEN: 'Token tidak valid',
  USER_NOT_FOUND: 'User tidak ditemukan',
  USER_ALREADY_EXISTS: 'User sudah ada',
  USER_INACTIVE: 'User tidak aktif',
  FEATURE_NOT_FOUND: 'Fitur tidak ditemukan',
  FEATURE_ACCESS_DENIED: 'Akses fitur ditolak',
  FEATURE_DISABLED: 'Fitur tidak aktif',
  FILE_NOT_FOUND: 'File tidak ditemukan',
  FILE_TOO_LARGE: 'File terlalu besar',
  UNSUPPORTED_FILE_TYPE: 'Tipe file tidak didukung',
  FILE_UPLOAD_FAILED: 'Upload file gagal',
  FILE_PROCESSING_FAILED: 'Proses file gagal',
  BOT_NOT_CONFIGURED: 'Bot belum dikonfigurasi',
  BOT_INACTIVE: 'Bot tidak aktif',
  INVALID_BOT_TOKEN: 'Token bot tidak valid',
  BOT_API_ERROR: 'Error API bot',
  VALIDATION_ERROR: 'Error validasi',
  INVALID_INPUT: 'Input tidak valid',
  MISSING_REQUIRED_FIELD: 'Field wajib tidak ada',
  INTERNAL_SERVER_ERROR: 'Error server internal',
  DATABASE_ERROR: 'Error database',
  REDIS_ERROR: 'Error Redis',
  EXTERNAL_API_ERROR: 'Error API eksternal',
} as const;

// Bot messages (Indonesian)
export const BOT_MESSAGES = {
  WELCOME: 'Selamat datang! Gunakan /help untuk melihat daftar perintah.',
  HELP: 'Daftar perintah yang tersedia:\n\n' +
        '/ocr - Mode OCR untuk extract text dari gambar\n' +
        '/rar - Mode Archive untuk compress/extract file\n' +
        '/location - Mode Location untuk proses koordinat GPS\n' +
        '/geotags - Mode Geotags untuk extract metadata lokasi\n' +
        '/kml - Mode KML untuk proses file KML\n' +
        '/workbook - Mode Workbook untuk proses Excel/CSV\n' +
        '/status - Lihat status dan mode aktif\n' +
        '/cancel - Batalkan mode aktif\n' +
        '/help - Tampilkan pesan ini',
  STATUS_NO_MODE: 'Tidak ada mode aktif. Gunakan salah satu perintah untuk memulai.',
  STATUS_ACTIVE_MODE: 'Mode aktif: {mode}',
  MODE_CANCELLED: 'Mode dibatalkan.',
  MODE_ACTIVATED: 'Mode {mode} diaktifkan.',
  FEATURE_ACCESS_DENIED: 'Anda tidak memiliki akses ke fitur ini.',
  USER_NOT_REGISTERED: 'Anda belum terdaftar. Hubungi admin untuk mendaftar.',
  PROCESSING_FILE: 'Memproses file...',
  FILE_PROCESSED: 'File berhasil diproses.',
  ERROR_PROCESSING: 'Terjadi error saat memproses file.',
  INVALID_FILE_TYPE: 'Tipe file tidak didukung untuk mode ini.',
  FILE_TOO_LARGE: 'File terlalu besar. Maksimal {maxSize}.',
  SEND_FILE: 'Silakan kirim file untuk diproses.',
  UNKNOWN_COMMAND: 'Perintah tidak dikenal. Gunakan /help untuk melihat daftar perintah.',
} as const;

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
  SORT_ORDER: 'desc',
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  USER_SESSION: 3600, // 1 hour
  BOT_CONFIG: 300, // 5 minutes
  FEATURE_ACCESS: 600, // 10 minutes
  FILE_METADATA: 1800, // 30 minutes
  DASHBOARD_STATS: 60, // 1 minute
} as const;

// WebSocket events
export const WS_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  BOT_ACTIVITY: 'bot_activity',
  USER_UPDATE: 'user_update',
  FEATURE_UPDATE: 'feature_update',
  FILE_UPDATE: 'file_update',
  SYSTEM_STATUS: 'system_status',
  ERROR: 'error',
} as const;

// Environment variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
  JWT_SECRET: 'JWT_SECRET',
  JWT_EXPIRES_IN: 'JWT_EXPIRES_IN',
  BOT_TOKEN: 'BOT_TOKEN',
  BOT_API_SERVER: 'BOT_API_SERVER',
  ADMIN_TELEGRAM_ID: 'ADMIN_TELEGRAM_ID',
  GOOGLE_CLOUD_KEY_FILE: 'GOOGLE_CLOUD_KEY_FILE',
  UPLOAD_DIR: 'UPLOAD_DIR',
  TEMP_DIR: 'TEMP_DIR',
} as const;

// Default configurations
export const DEFAULT_CONFIG = {
  MAX_FILE_SIZE: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES: [
    ...SUPPORTED_FILE_TYPES.IMAGES,
    ...SUPPORTED_FILE_TYPES.ARCHIVES,
    ...SUPPORTED_FILE_TYPES.DOCUMENTS,
    ...SUPPORTED_FILE_TYPES.SPREADSHEETS,
    ...SUPPORTED_FILE_TYPES.GEOSPATIAL,
  ],
  SESSION_TIMEOUT: 3600000, // 1 hour in milliseconds
  CLEANUP_INTERVAL: 300000, // 5 minutes in milliseconds
} as const;
