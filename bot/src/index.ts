import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import winston from 'winston';
import { ApiClient } from './services/api-client';
import { SessionManager } from './services/session-manager';
import { UserDirectoryService } from './services/user-directory.service';
import { LocalFileService } from './services/local-file.service';
import { AuthContext, optionalAuth, requireAuth, requireAdmin, requireFeature } from './middleware/auth';
import { OcrHandler } from './handlers/ocr.handler';
import { WorkbookHandler } from './handlers/workbook.handler';
import { GeotagsHandler } from './handlers/geotags.handler';
import { LocationHandler } from './handlers/location.handler';
import { KmlHandler } from './handlers/kml.handler';
import { ArchiveHandler } from './handlers/archive.handler';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/bot-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/bot-combined.log' })
  ]
});

// Validate required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN is required in environment variables');
  process.exit(1);
}

// Bot configuration
const BOT_API_SERVER = process.env.BOT_API_SERVER;
const USE_POLLING = process.env.BOT_POLLING === 'true';

logger.info('Bot Configuration:', {
  usePolling: USE_POLLING,
  apiServer: BOT_API_SERVER || 'api.telegram.org',
  backendUrl: BACKEND_URL,
  token: BOT_TOKEN.substring(0, 10) + '...'
});

// Initialize API client
const apiClient = new ApiClient(BACKEND_URL, logger);

// Initialize session manager
const sessionManager = new SessionManager(logger);

// Initialize user directory service
const userDirectoryService = new UserDirectoryService(logger);

// Initialize OCR handler
const ocrHandler = new OcrHandler(apiClient, logger);

// Initialize Workbook handler
const workbookHandler = new WorkbookHandler(apiClient, logger);

// Initialize Geotags handler
const geotagsHandler = new GeotagsHandler(apiClient, logger);

// Initialize Location handler
const locationHandler = new LocationHandler(apiClient, logger);

// Initialize KML handler
const kmlHandler = new KmlHandler(logger);

// Initialize Archive handler
const archiveHandler = new ArchiveHandler(logger);

// Create bot instance with typed context
const bot = new Telegraf<AuthContext>(BOT_TOKEN, {
  telegram: {
    apiRoot: BOT_API_SERVER ? `${BOT_API_SERVER}/bot` : undefined
  }
});

// Error handling
bot.catch((err, ctx) => {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Bot error:', {
    error: error.message,
    stack: error.stack,
    updateType: ctx.updateType,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id
  });
});

// Public commands (no authentication required)
bot.start(optionalAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  // Clear user mode when starting fresh
  ctx.clearUserMode?.();
  const telegramId = ctx.from.id.toString();
  
  logger.info('Start command received', {
    userId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    isRegistered: !!ctx.user
  });
  
  if (ctx.user) {
    ctx.reply(
      `🤖 Selamat datang kembali, ${ctx.user.name}!\n\n` +
      'Bot TeleWeb siap melayani Anda.\n\n' +
      `Role: ${ctx.user.role}\n` +
      'Gunakan /help untuk melihat daftar perintah yang tersedia.'
    );
  } else {
    ctx.reply(
      '🤖 Selamat datang di TeleWeb Bot!\n\n' +
      'Untuk menggunakan fitur bot, Anda perlu terdaftar dalam sistem.\n\n' +
      `Telegram ID Anda: \`${telegramId}\`\n\n` +
      'Hubungi administrator untuk mendapatkan akses dengan menyertakan ID tersebut.'
    );
  }
});

bot.help(optionalAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  // Clear user mode when accessing help
  ctx.clearUserMode?.();
  if (!ctx.user) {
    const helpText = `
🤖 *TeleWeb Bot - Bantuan*

*Status:* Anda belum terdaftar dalam sistem

*Perintah Tersedia:*
/start - Memulai bot
/help - Menampilkan bantuan ini

*Untuk Akses Penuh:*
Hubungi administrator dengan menyertakan Telegram ID Anda: \`${ctx.from.id}\`

*Informasi:*
Bot ini menggunakan ${BOT_API_SERVER ? 'Local Bot API Server' : 'Remote Telegram API'}
Mode: ${USE_POLLING ? 'Polling' : 'Webhook'}
    `;
    
    ctx.replyWithMarkdown(helpText);
    return;
  }

  const helpText = `
🤖 *TeleWeb Bot - Bantuan*

*Status:* ✅ Terdaftar sebagai ${ctx.user.role}
*Nama:* ${ctx.user.name}

*Perintah Dasar:*
/start - Memulai bot
/help - Menampilkan bantuan ini
/status - Status bot dan koneksi
/ping - Test koneksi bot
/profile - Info profil Anda

*Fitur yang Tersedia:*
📄 /ocr - Extract text from images using Google Vision API
📦 /archive - Archive Processing - Create ZIP, extract ZIP/RAR, search in archives
📍 /location - Coordinates, maps, distance measurement
🏷️ /geotags - Add GPS coordinates overlay to photos
🗺️ /kml - Create and manage geographic points, lines, and KML files
📊 /workbook - Excel Image Processing

${ctx.user.role === 'ADMIN' ? `
*Perintah Admin:*
/admin - Panel administrasi
/users - Kelola pengguna
/features - Kelola fitur
` : ''}

*Informasi:*
Bot ini menggunakan Local Bot API Server
Mode: Polling

Untuk menggunakan fitur, kirim file atau gunakan perintah yang sesuai.
  `;
  
  ctx.replyWithMarkdown(helpText);
});

// Add menu command to clear mode
bot.command('menu', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  ctx.clearUserMode?.();
  await ctx.reply(
    '🏠 *Menu Utama*\n\n' +
    'Mode fitur telah direset. Pilih fitur yang ingin digunakan:\n\n' +
    '📄 /ocr - OCR Text Recognition\n' +
    '📦 /archive - Archive Processing\n' +
    '📍 /location - Location Processing\n' +
    '🏷️ /geotags - Geotag Photos with Location\n' +
    '🗺️ /kml - KML Geographic Data Processing\n' +
    '📊 /workbook - Excel Image Processing\n\n' +
    'Ketik /help untuk bantuan lengkap.',
    { parse_mode: 'Markdown' }
  );
});

// Protected commands (require authentication)
bot.command('profile', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  const user = ctx.user!;
  const featuresResponse = await apiClient.getUserFeatures(ctx.from.id.toString());
  const features = featuresResponse.success ? featuresResponse.data || [] : [];
  
  const activeFeatures = features
    .filter(access => access.feature.isEnabled)
    .map(access => access.feature.name)
    .join(', ') || 'Tidak ada';

  const profileText = `
👤 *Profil Pengguna*

*Informasi Dasar:*
Nama: ${user.name}
Username: ${user.username || 'Tidak ada'}
Role: ${user.role}
Status: ${user.isActive ? '✅ Aktif' : '❌ Tidak Aktif'}

*Fitur Tersedia:*
${activeFeatures}

*Detail Akun:*
Telegram ID: \`${user.telegramId}\`
Terdaftar: ${new Date(user.createdAt).toLocaleDateString('id-ID')}
Update Terakhir: ${new Date(user.updatedAt).toLocaleDateString('id-ID')}
  `;
  
  ctx.replyWithMarkdown(profileText);
});

bot.command('status', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  const status = {
    botId: ctx.botInfo.id,
    botUsername: ctx.botInfo.username,
    apiServer: BOT_API_SERVER || 'api.telegram.org',
    mode: USE_POLLING ? 'Polling' : 'Webhook',
    uptime: process.uptime(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
  
  // Check backend connectivity
  const backendHealthy = await apiClient.healthCheck();
  
  logger.info('Status command received', { userId: ctx.from.id, status });
  
  const statusText = `
🤖 *Status Bot TeleWeb*

*Bot Info:*
ID: \`${status.botId}\`
Username: @${status.botUsername}

*Konfigurasi:*
API Server: \`${status.apiServer}\`
Mode: \`${status.mode}\`
Uptime: \`${Math.floor(status.uptime)}s\`

*Backend:*
URL: \`${BACKEND_URL}\`
Status: ${backendHealthy ? '✅ Online' : '❌ Offline'}

*System:*
Node.js: \`${status.nodeVersion}\`
Timestamp: \`${status.timestamp}\`

${backendHealthy ? '✅ Semua sistem berjalan normal' : '⚠️ Backend tidak dapat diakses'}
  `;
  
  ctx.replyWithMarkdown(statusText);
});

bot.command('ping', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const startTime = Date.now();
  
  ctx.reply('🏓 Pong!').then(() => {
    const responseTime = Date.now() - startTime;
    logger.info('Ping command', {
      userId: ctx.from.id,
      responseTime: `${responseTime}ms`
    });
    
    ctx.reply(`⚡ Response time: ${responseTime}ms`);
  });
});

// Admin commands
bot.command('admin', requireAdmin(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const adminText = `
🔧 *Panel Administrator*

*Perintah Tersedia:*
/users - Kelola pengguna
/features - Kelola fitur sistem
/stats - Statistik penggunaan
/broadcast - Kirim pesan broadcast

*Status:* Administrator verified ✅
  `;
  
  ctx.replyWithMarkdown(adminText);
});

// Feature-specific commands - OCR
bot.command('ocr', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return ocrHandler.handleOcrCommand(ctx);
});

bot.command('ocr_clear', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return ocrHandler.handleOcrClear(ctx);
});

bot.command('ocr_stats', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return ocrHandler.handleOcrStats(ctx);
});

// Feature-specific commands - Workbook
bot.command('workbook', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return workbookHandler.handleWorkbookCommand(ctx);
});

bot.command('workbook_clear', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return workbookHandler.handleWorkbookClear(ctx);
});

bot.command('workbook_stats', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return workbookHandler.handleWorkbookStats(ctx);
});

// Feature-specific commands - Geotags
bot.command('geotags', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return geotagsHandler.handleGeotagsCommand(ctx);
});

bot.command('geotags_clear', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return geotagsHandler.handleGeotagsClear(ctx);
});

bot.command('geotags_stats', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return geotagsHandler.handleGeotagsStats(ctx);
});

bot.command('alwaystag', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return geotagsHandler.handleAlwaysTag(ctx);
});

// Handle set_time command with parameter extraction
bot.hears(/^\/set_time(?:\s+(.+))?/, requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const match = ctx.message.text.match(/^\/set_time(?:\s+(.+))?/);
  const timeString = match ? match[1] : undefined;
  return geotagsHandler.handleSetTime(ctx, timeString);
});

// Feature-specific commands - Location
bot.command('location', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleLocationCommand(ctx);
});

// Handle alamat command with parameter extraction
bot.hears(/^\/alamat(?:\s+(.+))?/, requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const match = ctx.message.text.match(/^\/alamat(?:\s+(.+))?/);
  const addressQuery = match ? match[1] : undefined;
  return locationHandler.handleAlamatCommand(ctx, addressQuery);
});

// Handle koordinat command with parameter extraction
bot.hears(/^\/koordinat(?:\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*))?/, requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const match = ctx.message.text.match(/^\/koordinat(?:\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*))?/);
  const lat = match ? match[1] : undefined;
  const lon = match ? match[2] : undefined;
  return locationHandler.handleKoordinatCommand(ctx, lat, lon);
});

// Handle show_map command with parameter extraction  
bot.hears(/^\/show_map(?:\s+(.+))?/, requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const match = ctx.message.text.match(/^\/show_map(?:\s+(.+))?/);
  const locationQuery = match ? match[1] : undefined;
  return locationHandler.handleShowMapCommand(ctx, locationQuery);
});

// Handle measurement commands
bot.command('ukur', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleUkurCommand(ctx, 'walking');
});

bot.command('ukur_mobil', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleUkurCommand(ctx, 'driving');
});

bot.command('ukur_motor', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleUkurCommand(ctx, 'motorcycling');
});

bot.command('show_jarak', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleShowJarakCommand(ctx);
});

bot.command('batal', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return locationHandler.handleBatalCommand(ctx);
});

// KML feature commands
bot.command('kml', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return kmlHandler.handleKmlCommand(ctx);
});

bot.command('add', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const [lat, lon, ...nameParts] = args;
  const name = nameParts.join(' ');
  return kmlHandler.handleAddCommand(ctx, lat, lon, name);
});

bot.command('addpoint', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const pointName = ctx.message.text.split(' ').slice(1).join(' ');
  return kmlHandler.handleAddPointCommand(ctx, pointName);
});

bot.command('alwayspoint', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const persistentName = ctx.message.text.split(' ').slice(1).join(' ');
  return kmlHandler.handleAlwaysPointCommand(ctx, persistentName);
});

bot.command('startline', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const lineName = ctx.message.text.split(' ').slice(1).join(' ');
  return kmlHandler.handleStartLineCommand(ctx, lineName);
});

bot.command('endline', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return kmlHandler.handleEndLineCommand(ctx);
});

bot.command('cancelline', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return kmlHandler.handleCancelLineCommand(ctx);
});

bot.command('mydata', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return kmlHandler.handleMyDataCommand(ctx);
});

bot.command('createkml', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const docName = ctx.message.text.split(' ').slice(1).join(' ');
  return kmlHandler.handleCreateKmlCommand(ctx, docName);
});

bot.command('cleardata', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return kmlHandler.handleClearDataCommand(ctx);
});

// Archive feature commands
bot.command('archive', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleArchiveCommand(ctx);
});

bot.command('zip', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleZipCommand(ctx);
});

bot.command('extract', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleExtractCommand(ctx);
});

bot.command('search', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleSearchCommand(ctx);
});

bot.command('find', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  const searchPattern = ctx.message.text.split(' ').slice(1).join(' ');
  return archiveHandler.handleFindCommand(ctx, searchPattern);
});

bot.command('send', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleSendCommand(ctx);
});

bot.command('send_selected', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleSendSelectedCommand(ctx);
});

bot.command('stats', requireAuth(apiClient, logger, sessionManager, userDirectoryService), (ctx) => {
  return archiveHandler.handleStatsCommand(ctx);
});



// Handle text messages
bot.on('text', optionalAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  const text = ctx.message.text;
  
  // Handle OCR koordinat command when user is in OCR mode
  if (text === '/ocr_koordinat' && ctx.user) {
    const userMode = ctx.getUserMode?.();
    if (userMode === 'ocr') {
      return ocrHandler.handleOcrKoordinat(ctx);
    }
  }
  
  if (text.startsWith('/')) {
    logger.warn('Unknown command received', {
      command: text,
      userId: ctx.from.id,
      isRegistered: !!ctx.user
    });
    
    if (ctx.user) {
      await ctx.reply(
        '❓ Perintah tidak dikenal.\n\n' +
        'Gunakan /help untuk melihat daftar perintah yang tersedia.'
      );
    } else {
      await ctx.reply(
        '❓ Perintah tidak dikenal.\n\n' +
        'Anda perlu terdaftar untuk menggunakan perintah bot.\n' +
        `Telegram ID: \`${ctx.from.id}\`\n\n` +
        'Hubungi administrator untuk mendapatkan akses.'
      );
    }
    return;
  } else {
    // Check if user is in specific mode for text handling
    if (ctx.user) {
      const userMode = ctx.getUserMode?.();
      if (userMode === 'workbook') {
        return workbookHandler.handleText(ctx);
      } else if (userMode === 'location') {
        return locationHandler.handleText(ctx);
      }
    }
    
    // Handle regular text messages
    logger.info('Text message received', {
      userId: ctx.from.id,
      messageLength: text.length,
      isRegistered: !!ctx.user
    });
    
    if (ctx.user) {
      await ctx.reply(
        '📝 Pesan teks diterima!\n\n' +
        'Untuk menggunakan fitur bot, kirim file atau gunakan perintah yang tersedia.\n' +
        'Ketik /help untuk bantuan.'
      );
    } else {
      await ctx.reply(
        '📝 Pesan diterima, tetapi Anda belum terdaftar.\n\n' +
        `Telegram ID: \`${ctx.from.id}\`\n` +
        'Hubungi administrator untuk mendapatkan akses.'
      );
    }
  }
});

// Handle photo uploads for OCR, Workbook, and Geotags
bot.on('photo', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  // Check user mode and route to appropriate handler
  const userMode = ctx.getUserMode?.();
  
  if (userMode === 'workbook') {
    return workbookHandler.handlePhoto(ctx);
  } else if (userMode === 'geotags') {
    return geotagsHandler.handlePhoto(ctx);
  } else if (userMode === 'ocr') {
    return ocrHandler.handlePhoto(ctx);
  }
  
  // No default handling - user must be in appropriate mode
  logger.info('Photo received but user not in any active mode', {
    userId: ctx.from.id,
    userMode
  });
});

// Handle location messages for Geotags, Location, and KML mode
bot.on('location', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  // Check user mode and route to appropriate handler
  const userMode = ctx.getUserMode?.();
  if (userMode === 'geotags') {
    return geotagsHandler.handleLocation(ctx);
  } else if (userMode === 'location') {
    return locationHandler.handleLocation(ctx);
  } else if (userMode === 'kml') {
    return kmlHandler.handleLocation(ctx);
  }
  
  // No default handling - user must be in appropriate mode to use location
  logger.info('Location received but user not in location-enabled mode', {
    userId: ctx.from.id,
    latitude: ctx.message.location.latitude,
    longitude: ctx.message.location.longitude,
    userMode
  });
});

// Handle file uploads (require authentication)
bot.on('document', requireAuth(apiClient, logger, sessionManager, userDirectoryService), async (ctx) => {
  const userMode = ctx.getUserMode?.();
  
  // Route to archive handler if in archive mode
  if (userMode === 'archive') {
    return archiveHandler.handleDocument(ctx);
  }
  
  // Check if it's an image document for OCR
  const document = ctx.message.document;
  const mimeType = document.mime_type || '';
  
  if (mimeType.startsWith('image/')) {
    return ocrHandler.handleDocument(ctx);
  }
  
  logger.info('Document received', {
    userId: ctx.from.id,
    userName: ctx.user!.name,
    fileName: ctx.message.document.file_name,
    fileSize: ctx.message.document.file_size || 0,
    mimeType: ctx.message.document.mime_type
  });
  
  const fileSize = ctx.message.document.file_size || 0;
  
  ctx.reply(
    '📄 File diterima!\n\n' +
    `Nama: ${ctx.message.document.file_name}\n` +
    `Ukuran: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n` +
    `Tipe: ${ctx.message.document.mime_type}\n\n` +
    '🔄 Memproses file... (fitur akan segera tersedia)'
  );
});

// This photo handler is duplicate - remove it since we already have one above

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});

// Start bot
async function startBot() {
  try {
    logger.info('Starting TeleWeb Bot...');
    
    // Check backend connectivity first
    const backendHealthy = await apiClient.healthCheck();
    if (!backendHealthy) {
      logger.warn('Backend is not healthy, but starting bot anyway...');
    } else {
      logger.info('✅ Backend connectivity verified');
    }
    
    // Get bot info
    const botInfo = await bot.telegram.getMe();
    logger.info('Bot info retrieved', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name
    });
    
    if (USE_POLLING) {
      logger.info('Starting bot in polling mode...');
      
      // Clear pending updates to prevent processing old messages
      try {
        await bot.telegram.getUpdates(0, 1, -1, undefined);
        logger.info('Cleared pending updates - bot will only process new messages');
      } catch (error) {
        logger.warn('Failed to clear pending updates:', error);
      }
      
      await bot.launch({
        allowedUpdates: ['message', 'callback_query', 'inline_query'],
        dropPendingUpdates: true // This also helps skip old updates
      });
      logger.info('✅ Bot started successfully in polling mode');
    } else {
      logger.warn('Webhook mode not implemented yet, falling back to polling');
      
      // Clear pending updates for webhook fallback too
      try {
        await bot.telegram.getUpdates(0, 1, -1, undefined);
        logger.info('Cleared pending updates - bot will only process new messages');
      } catch (error) {
        logger.warn('Failed to clear pending updates:', error);
      }
      
      await bot.launch({
        allowedUpdates: ['message', 'callback_query', 'inline_query'],
        dropPendingUpdates: true
      });
      logger.info('✅ Bot started successfully in polling mode (fallback)');
    }
    
      } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to start bot:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
}

// Start the bot
startBot();
