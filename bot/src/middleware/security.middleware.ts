import { Context, Middleware } from 'telegraf';
import winston from 'winston';

interface SecurityConfig {
  maxMessageLength: number;
  maxFileSize: number;
  rateLimitWindow: number;
  rateLimitMax: number;
  blockedPatterns: RegExp[];
}

export class SecurityMiddleware {
  private logger: winston.Logger;
  private config: SecurityConfig;
  private messageCount: Map<number, { count: number; timestamp: number }> = new Map();
  private blockedUsers: Set<number> = new Set();
  private mediaGroupTracker: Map<string, number> = new Map(); // Track media groups

  constructor(logger: winston.Logger) {
    this.logger = logger.child({ module: 'SecurityMiddleware' });
    this.config = {
      maxMessageLength: 4096,
      maxFileSize: 1900 * 1024 * 1024, // 1900MB
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 50, // Increased to 50 messages per minute
      blockedPatterns: [
        /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}.*\.(exe|dll|bat|cmd|scr|vbs|js|jar|zip|rar)/gi,
        /<script.*?>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
      ],
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(): Middleware<Context> {
    return async (ctx, next) => {
      if (!ctx.from) return next();

      const userId = ctx.from.id;
      const now = Date.now();

      // Check if user is blocked
      if (this.blockedUsers.has(userId)) {
        this.logger.warn('Blocked user attempted to send message', { userId });
        return;
      }

      // BYPASS RATE LIMIT FOR USERS IN ACTIVE FEATURE MODE
      // Check if user has active mode in context (from session)
      const authContext = ctx as any;
      if (authContext.session && authContext.session.mode) {
        // User is in active feature mode (ocr, workbook, archive, etc)
        this.logger.debug('Bypassing rate limit for user in feature mode', {
          userId,
          mode: authContext.session.mode,
        });
        return next();
      }

      // Also bypass for specific commands that initiate features
      if (ctx.message && 'text' in ctx.message) {
        const featureCommands = ['/ocr', '/workbook', '/archive', '/location', '/geotags', '/kml'];
        const messageText = ctx.message.text;
        if (messageText && featureCommands.some(cmd => messageText.startsWith(cmd))) {
          return next();
        }
      }

      // Normal rate limiting for non-feature usage
      // Get or create user message count
      let userRecord = this.messageCount.get(userId);
      if (!userRecord || now - userRecord.timestamp > this.config.rateLimitWindow) {
        userRecord = { count: 0, timestamp: now };
        this.messageCount.set(userId, userRecord);
      }

      // Check if this is part of a media group (album)
      const message = ctx.message;
      let incrementCount = 1;

      if (message && 'media_group_id' in message && message.media_group_id) {
        // This is part of a media album
        const mediaGroupId = message.media_group_id;
        if (!this.mediaGroupTracker.has(mediaGroupId)) {
          // First message in the group, count it
          this.mediaGroupTracker.set(mediaGroupId, now);
          // Clean up old media groups after 5 seconds
          setTimeout(() => this.mediaGroupTracker.delete(mediaGroupId), 5000);
        } else {
          // Subsequent messages in the same group, count as 0.2 instead of 1
          incrementCount = 0.2;
        }
      }

      // Special handling for photo messages (workbook feature often uses many photos)
      if (message && 'photo' in message) {
        // Reduce count impact for photos
        incrementCount = Math.min(incrementCount, 0.5);
      }

      // Increment count
      userRecord.count += incrementCount;

      // Check rate limit
      if (userRecord.count > this.config.rateLimitMax) {
        this.logger.warn('User exceeded rate limit', {
          userId,
          count: userRecord.count,
          limit: this.config.rateLimitMax,
        });

        // Temporary block for 5 minutes
        this.blockedUsers.add(userId);
        setTimeout(() => this.blockedUsers.delete(userId), 300000);

        await ctx.reply('⚠️ Anda mengirim terlalu banyak pesan. Silakan tunggu beberapa menit.');
        return;
      }

      return next();
    };
  }

  /**
   * Message validation middleware
   */
  validateMessage(): Middleware<Context> {
    return async (ctx, next) => {
      // Check text message length
      if ('text' in ctx.message! && ctx.message.text.length > this.config.maxMessageLength) {
        await ctx.reply('❌ Pesan terlalu panjang. Maksimal 4096 karakter.');
        return;
      }

      // Check for malicious patterns in text
      if ('text' in ctx.message!) {
        for (const pattern of this.config.blockedPatterns) {
          if (pattern.test(ctx.message.text)) {
            this.logger.warn('Potentially malicious message detected', {
              userId: ctx.from?.id,
              pattern: pattern.source,
            });
            await ctx.reply('❌ Pesan mengandung konten yang tidak diizinkan.');
            return;
          }
        }
      }

      return next();
    };
  }

  /**
   * File validation middleware
   */
  validateFile(): Middleware<Context> {
    return async (ctx, next) => {
      const message = ctx.message;

      if (!message) return next();

      // Check file types
      const fileTypes = ['document', 'photo', 'video', 'audio', 'voice'];
      let file: any = null;
      let fileType: string = '';

      for (const type of fileTypes) {
        if (type in message) {
          file = (message as any)[type];
          fileType = type;
          break;
        }
      }

      if (!file) return next();

      // Get file info
      let fileSize = 0;
      let fileName = '';

      if (Array.isArray(file)) {
        // For photos, get the largest size
        file = file[file.length - 1];
        fileSize = file.file_size || 0;
      } else {
        fileSize = file.file_size || 0;
        fileName = file.file_name || '';
      }

      // Check file size
      if (fileSize > this.config.maxFileSize) {
        await ctx.reply(
          `❌ File terlalu besar. Maksimal ${Math.floor(this.config.maxFileSize / 1024 / 1024)}MB.`
        );
        return;
      }

      // Check file extension for documents
      if (fileType === 'document' && fileName) {
        const blockedExtensions = ['.exe', '.dll', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'];
        const fileExt = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

        if (blockedExtensions.includes(fileExt)) {
          this.logger.warn('Blocked file type upload attempt', {
            userId: ctx.from?.id,
            fileName,
            fileExt,
          });
          await ctx.reply('❌ Tipe file ini tidak diizinkan untuk keamanan.');
          return;
        }
      }

      return next();
    };
  }

  /**
   * Command injection protection
   */
  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters for shell commands
    return input
      .replace(/[;&|`$<>\\]/g, '')
      .replace(/\.\./g, '')
      .trim();
  }

  /**
   * Clean up old rate limit records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [userId, record] of this.messageCount.entries()) {
      if (now - record.timestamp > this.config.rateLimitWindow * 2) {
        this.messageCount.delete(userId);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval(): void {
    setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }
}
