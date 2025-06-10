import { SUPPORTED_FILE_TYPES, FILE_SIZE_LIMITS, MIME_TYPES } from './constants';

/**
 * Validate file extension
 */
export function isValidFileExtension(fileName: string, allowedTypes: readonly string[]): boolean {
  const extension = getFileExtension(fileName);
  return allowedTypes.includes(extension);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string | undefined {
  for (const [mimeType, extensions] of Object.entries(MIME_TYPES)) {
    if ((extensions as readonly string[]).includes(extension.toLowerCase())) {
      return mimeType;
    }
  }
  return undefined;
}

/**
 * Validate file size
 */
export function isValidFileSize(
  fileSize: number,
  maxSize: number = FILE_SIZE_LIMITS.MAX_FILE_SIZE
): boolean {
  return fileSize > 0 && fileSize <= maxSize;
}

/**
 * Validate image file
 */
export function isImageFile(fileName: string): boolean {
  return isValidFileExtension(fileName, SUPPORTED_FILE_TYPES.IMAGES);
}

/**
 * Validate archive file
 */
export function isArchiveFile(fileName: string): boolean {
  return isValidFileExtension(fileName, SUPPORTED_FILE_TYPES.ARCHIVES);
}

/**
 * Validate document file
 */
export function isDocumentFile(fileName: string): boolean {
  return isValidFileExtension(fileName, SUPPORTED_FILE_TYPES.DOCUMENTS);
}

/**
 * Validate spreadsheet file
 */
export function isSpreadsheetFile(fileName: string): boolean {
  return isValidFileExtension(fileName, SUPPORTED_FILE_TYPES.SPREADSHEETS);
}

/**
 * Validate geospatial file
 */
export function isGeospatialFile(fileName: string): boolean {
  return isValidFileExtension(fileName, SUPPORTED_FILE_TYPES.GEOSPATIAL);
}

/**
 * Validate Telegram ID format
 */
export function isValidTelegramId(telegramId: string): boolean {
  return /^\d+$/.test(telegramId) && telegramId.length >= 5 && telegramId.length <= 15;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate bot token format
 */
export function isValidBotToken(token: string): boolean {
  // Telegram bot token format: number:alphanumeric_string
  const tokenRegex = /^\d+:[a-zA-Z0-9_-]{35}$/;
  return tokenRegex.test(token);
}

/**
 * Sanitize filename
 */
export function sanitizeFileName(fileName: string): string {
  // Remove or replace invalid characters
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

/**
 * Validate and sanitize user input
 */
export function sanitizeUserInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: number, limit: number): { page: number; limit: number } {
  const validPage = Math.max(1, Math.floor(page) || 1);
  const validLimit = Math.min(100, Math.max(1, Math.floor(limit) || 10));

  return { page: validPage, limit: validLimit };
}

/**
 * Validate date range
 */
export function validateDateRange(
  dateFrom?: string,
  dateTo?: string
): { dateFrom?: Date; dateTo?: Date } {
  const result: { dateFrom?: Date; dateTo?: Date } = {};

  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      result.dateFrom = from;
    }
  }

  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to.getTime())) {
      result.dateTo = to;
    }
  }

  // Ensure dateFrom is before dateTo
  if (result.dateFrom && result.dateTo && result.dateFrom > result.dateTo) {
    [result.dateFrom, result.dateTo] = [result.dateTo, result.dateFrom];
  }

  return result;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Convert string to slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}
