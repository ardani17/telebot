import { Context, Middleware } from 'telegraf';
import { ApiClient, User } from '../services/api-client';
import { SessionManager, UserMode } from '../services/session-manager';
import { UserDirectoryService } from '../services/user-directory.service';
import winston from 'winston';

export interface AuthContext extends Context {
  user?: User;
  hasFeatureAccess?: (featureName: string) => Promise<boolean>;
  sessionManager?: SessionManager;
  userDirectoryService?: UserDirectoryService;
  getUserMode?: () => UserMode;
  setUserMode?: (mode: UserMode, data?: any) => void;
  clearUserMode?: () => void;
}

export interface AuthMiddlewareOptions {
  apiClient: ApiClient;
  logger: winston.Logger;
  sessionManager: SessionManager;
  userDirectoryService: UserDirectoryService;
  allowUnregistered?: boolean;
  adminOnly?: boolean;
  requiredFeature?: string;
}

/**
 * Authentication middleware to validate users against the database
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions): Middleware<AuthContext> {
  const { apiClient, logger, sessionManager, userDirectoryService, allowUnregistered = false, adminOnly = false, requiredFeature } = options;

  return async (ctx, next) => {
    const telegramId = ctx.from?.id?.toString();
    
    if (!telegramId) {
      logger.warn('No Telegram ID found in context');
      await ctx.reply('❌ Error: Tidak dapat mengidentifikasi pengguna.');
      return;
    }

    try {
      // Validate user
      const userResponse = await apiClient.validateUser(telegramId);
      
      if (!userResponse.success) {
        if (allowUnregistered) {
          logger.info('Unregistered user interaction', { telegramId });
          // Continue without user context
          return await next();
        } else {
          logger.warn('Unauthorized user attempt', { telegramId });
          await ctx.reply(
            '🚫 Akses ditolak!\n\n' +
            'Anda belum terdaftar dalam sistem. Hubungi administrator untuk mendapatkan akses.\n\n' +
            `Telegram ID Anda: \`${telegramId}\``
          );
          return;
        }
      }

      const user = userResponse.data!;

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Inactive user attempt', { telegramId, userId: user.id });
        await ctx.reply(
          '⚠️ Akun Anda sedang tidak aktif.\n\n' +
          'Hubungi administrator untuk mengaktifkan kembali akun Anda.'
        );
        return;
      }

      // Check admin requirement
      if (adminOnly && user.role !== 'ADMIN') {
        logger.warn('Non-admin user attempting admin action', { telegramId, userId: user.id });
        await ctx.reply(
          '🔒 Fitur ini hanya tersedia untuk administrator.\n\n' +
          'Hubungi administrator jika Anda memerlukan akses khusus.'
        );
        return;
      }

      // Check specific feature requirement
      if (requiredFeature) {
        const hasAccess = await apiClient.checkFeatureAccess(telegramId, requiredFeature);
        if (!hasAccess) {
          logger.warn('User lacks feature access', { 
            telegramId, 
            userId: user.id, 
            feature: requiredFeature 
          });
          await ctx.reply(
            `🚫 Anda tidak memiliki akses ke fitur "${requiredFeature}".\n\n` +
            'Hubungi administrator untuk mendapatkan akses ke fitur ini.'
          );
          return;
        }
      }

      // Add user to context
      ctx.user = user;
      
      // Add feature access helper
      ctx.hasFeatureAccess = async (featureName: string) => {
        return await apiClient.checkFeatureAccess(telegramId, featureName);
      };

      // Add session management helpers
      ctx.sessionManager = sessionManager;
      ctx.userDirectoryService = userDirectoryService;
      ctx.getUserMode = () => sessionManager.getUserMode(telegramId);
      ctx.setUserMode = (mode: UserMode, data?: any) => sessionManager.setUserMode(telegramId, mode, data);
      ctx.clearUserMode = () => sessionManager.clearUserMode(telegramId);

      // Initialize user directories if this is first time
      try {
        await userDirectoryService.initializeUserDirectories(telegramId);
      } catch (error) {
        // Log but don't fail authentication for directory creation errors
        logger.warn('Failed to initialize user directories', {
          telegramId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Update user activity
      await apiClient.updateUserActivity(telegramId);

      logger.info('User authenticated', {
        telegramId,
        userId: user.id,
        username: user.username,
        role: user.role,
        feature: requiredFeature,
      });

      return await next();
      
    } catch (error) {
      logger.error('Authentication middleware error', {
        telegramId,
        error: error.message,
        stack: error.stack,
      });
      
      await ctx.reply(
        '❌ Terjadi kesalahan sistem saat validasi pengguna.\n\n' +
        'Silakan coba lagi nanti atau hubungi administrator.'
      );
    }
  };
}

/**
 * Quick middleware for basic user validation
 */
export function requireAuth(
  apiClient: ApiClient, 
  logger: winston.Logger, 
  sessionManager: SessionManager,
  userDirectoryService: UserDirectoryService
): Middleware<AuthContext> {
  return createAuthMiddleware({
    apiClient,
    logger,
    sessionManager,
    userDirectoryService,
    allowUnregistered: false,
  });
}

/**
 * Quick middleware for admin-only commands
 */
export function requireAdmin(
  apiClient: ApiClient, 
  logger: winston.Logger, 
  sessionManager: SessionManager,
  userDirectoryService: UserDirectoryService
): Middleware<AuthContext> {
  return createAuthMiddleware({
    apiClient,
    logger,
    sessionManager,
    userDirectoryService,
    allowUnregistered: false,
    adminOnly: true,
  });
}

/**
 * Quick middleware for specific feature access
 */
export function requireFeature(
  feature: string,
  apiClient: ApiClient,
  logger: winston.Logger,
  sessionManager: SessionManager,
  userDirectoryService: UserDirectoryService
): Middleware<AuthContext> {
  return createAuthMiddleware({
    apiClient,
    logger,
    sessionManager,
    userDirectoryService,
    allowUnregistered: false,
    requiredFeature: feature,
  });
}

/**
 * Middleware that allows unregistered users but still loads user context if available
 */
export function optionalAuth(
  apiClient: ApiClient, 
  logger: winston.Logger, 
  sessionManager: SessionManager,
  userDirectoryService: UserDirectoryService
): Middleware<AuthContext> {
  return createAuthMiddleware({
    apiClient,
    logger,
    sessionManager,
    userDirectoryService,
    allowUnregistered: true,
  });
} 