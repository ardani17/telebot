import { Telegraf, Context } from 'telegraf';
// import { getErrorMessage } from '../utils/error-utils';
import { UserService } from '../services/user.service';
import { ModeManager } from '../utils/mode-manager';
import { FileHandler } from '../utils/file-handler';
import { createLogger } from '../utils/logger';

export interface BotServices {
  userService: UserService;
  modeManager: ModeManager;
  fileHandler: FileHandler;
  logger: ReturnType<typeof createLogger>;
}

export class BotManager {
  private bot: Telegraf;
  private services: BotServices;

  constructor(bot: Telegraf, services: BotServices) {
    this.bot = bot;
    this.services = services;
  }

  async setup(): Promise<void> {
    this.setupMiddleware();
    this.setupCommands();
    this.setupHandlers();
  }

  private setupMiddleware(): void {
    // User validation middleware
    this.bot.use(async (ctx, next) => {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId) {
        return;
      }

      try {
        const isRegistered = await this.services.userService.isUserRegistered(telegramId);
        if (!isRegistered) {
          await ctx.reply(
            '❌ Anda belum terdaftar dalam sistem.\n\n' +
              'Silakan hubungi administrator untuk mendaftarkan akun Anda.'
          );
          return;
        }

        await next();
      } catch (error) {
        this.services.logger.error('Error in user validation middleware', { error, telegramId });
        await ctx.reply('❌ Terjadi kesalahan sistem. Silakan coba lagi nanti.');
      }
    });

    // Logging middleware
    this.bot.use(async (ctx, next) => {
      const telegramId = ctx.from?.id.toString();
      const action = ctx.message ? 'message' : ctx.callbackQuery ? 'callback' : 'unknown';

      this.services.logger.info('Bot interaction', {
        telegramId,
        action,
        text: 'text' in (ctx.message || {}) ? (ctx.message as any)?.text : undefined,
      });

      await next();
    });
  }

  private setupCommands(): void {
    // Start command
    this.bot.command('start', async ctx => {
      const telegramId = ctx.from.id.toString();
      const user = await this.services.userService.getUserByTelegramId(telegramId);

      if (!user) {
        await ctx.reply(
          '❌ Anda belum terdaftar dalam sistem.\n\n' +
            'Silakan hubungi administrator untuk mendaftarkan akun Anda.'
        );
        return;
      }

      const welcomeMessage = `
🤖 *Selamat datang di TeleWeb Bot!*

Halo ${user.name}! Bot ini menyediakan berbagai fitur untuk membantu pekerjaan Anda.

*Fitur yang tersedia:*
${user.features.map(feature => `• ${this.getFeatureDescription(feature)}`).join('\n')}

*Perintah yang tersedia:*
/help - Bantuan dan daftar perintah
/status - Status akun dan fitur
/cancel - Batalkan operasi yang sedang berjalan

Ketik /help untuk melihat panduan lengkap.
      `;

      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.command('help', async ctx => {
      const helpMessage = `
📖 *Panduan Penggunaan Bot*

*Perintah Umum:*
/start - Mulai menggunakan bot
/help - Tampilkan panduan ini
/status - Lihat status akun dan fitur
/cancel - Batalkan operasi yang sedang berjalan

*Cara Menggunakan Fitur:*
1. Kirim file yang ingin diproses
2. Bot akan mendeteksi jenis file dan menanyakan mode yang diinginkan
3. Ikuti instruksi yang diberikan bot
4. Bot akan memproses file dan mengirim hasilnya

*Jenis File yang Didukung:*
• Gambar (JPG, PNG, WEBP) - untuk OCR dan ekstraksi geotag
• Arsip (ZIP, RAR, 7Z) - untuk ekstraksi dan analisis
• Dokumen (XLS, XLSX, CSV) - untuk konversi dan analisis
• KML/KMZ - untuk ekstraksi data lokasi

Jika ada pertanyaan, hubungi administrator.
      `;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Status command
    this.bot.command('status', async ctx => {
      const telegramId = ctx.from.id.toString();
      const user = await this.services.userService.getUserByTelegramId(telegramId);
      const currentMode = this.services.modeManager.getMode(telegramId);

      if (!user) {
        await ctx.reply('❌ Data pengguna tidak ditemukan.');
        return;
      }

      const statusMessage = `
👤 *Status Akun*

*Informasi Pengguna:*
• Nama: ${user.name}
• Username: ${user.username || 'Tidak ada'}
• Role: ${user.role}
• Status: ${user.isActive ? '✅ Aktif' : '❌ Tidak Aktif'}

*Mode Saat Ini:*
${currentMode ? `🔄 ${currentMode}` : '⭕ Tidak ada mode aktif'}

*Fitur yang Tersedia:*
${user.features.map(feature => `✅ ${this.getFeatureDescription(feature)}`).join('\n')}

*Statistik Session:*
• Total Session: ${this.services.modeManager.getSessionCount()}
      `;

      await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
    });

    // Cancel command
    this.bot.command('cancel', async ctx => {
      const telegramId = ctx.from.id.toString();
      const currentMode = this.services.modeManager.getMode(telegramId);

      if (!currentMode) {
        await ctx.reply('⭕ Tidak ada operasi yang sedang berjalan.');
        return;
      }

      this.services.modeManager.clearMode(telegramId);
      await ctx.reply('✅ Operasi dibatalkan. Anda dapat memulai operasi baru.');
    });
  }

  private setupHandlers(): void {
    // Document handler
    this.bot.on('document', async ctx => {
      await this.handleFileUpload(ctx, ctx.message.document);
    });

    // Photo handler
    this.bot.on('photo', async ctx => {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      await this.handleFileUpload(ctx, photo);
    });

    // Text handler for mode interactions
    this.bot.on('text', async ctx => {
      const telegramId = ctx.from.id.toString();
      const currentMode = this.services.modeManager.getMode(telegramId);

      if (currentMode) {
        // Handle mode-specific text input
        await this.handleModeInput(ctx, currentMode);
      } else {
        // No active mode, show help
        await ctx.reply(
          '❓ Tidak ada operasi yang sedang berjalan.\n\n' +
            'Kirim file untuk memulai, atau ketik /help untuk bantuan.'
        );
      }
    });
  }

  private async handleFileUpload(ctx: Context, file: any): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    try {
      // Check if user has any feature access
      const userFeatures = await this.services.userService.getUserFeatures(telegramId);
      if (userFeatures.length === 0) {
        await ctx.reply('❌ Anda tidak memiliki akses ke fitur apapun.');
        return;
      }

      await ctx.reply('📥 File diterima, sedang memproses...');

      // Download file
      const fileName = file.file_name || `file_${Date.now()}`;
      const fileInfo = await this.services.fileHandler.downloadFile(file.file_id, fileName);

      // Save file metadata
      await this.services.userService.saveFileMetadata({
        telegramId,
        fileName: fileInfo.originalName,
        filePath: fileInfo.filePath,
        fileType: fileInfo.extension,
        fileSize: fileInfo.fileSize,
        mimeType: fileInfo.mimeType,
        mode: 'upload',
      });

      // Determine available modes based on file type and user features
      const availableModes = this.getAvailableModesForFile(fileInfo, userFeatures);

      if (availableModes.length === 0) {
        await ctx.reply('❌ Tidak ada mode yang tersedia untuk jenis file ini.');
        return;
      }

      // Store file info in session
      this.services.modeManager.updateState(telegramId, 'fileInfo', fileInfo);

      // Show mode selection
      await this.showModeSelection(ctx, availableModes);
    } catch (error) {
      this.services.logger.error('Error handling file upload', { error, telegramId });
      await ctx.reply('❌ Terjadi kesalahan saat memproses file. Silakan coba lagi.');
    }
  }

  private async handleModeInput(ctx: Context, mode: string): Promise<void> {
    // This will be implemented based on specific mode handlers
    await ctx.reply(`🔄 Mode ${mode} sedang dalam pengembangan.`);
  }

  private async showModeSelection(ctx: Context, modes: string[]): Promise<void> {
    const modeDescriptions = modes
      .map(mode => `• ${mode} - ${this.getModeDescription(mode)}`)
      .join('\n');

    const message = `
📋 *Pilih Mode Pemrosesan*

File berhasil diunggah! Pilih mode pemrosesan yang diinginkan:

${modeDescriptions}

Balas dengan nama mode yang diinginkan (contoh: OCR)
    `;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private getAvailableModesForFile(fileInfo: any, userFeatures: string[]): string[] {
    const modes: string[] = [];
    const extension = fileInfo.extension.toLowerCase();

    // Image files
    if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      if (userFeatures.includes('ocr')) modes.push('OCR');
      if (userFeatures.includes('geotags')) modes.push('GEOTAGS');
    }

    // Archive files
    if (['zip', 'rar', '7z'].includes(extension)) {
      if (userFeatures.includes('archive')) modes.push('ARCHIVE');
    }

    // Spreadsheet files
    if (['xls', 'xlsx', 'csv'].includes(extension)) {
      if (userFeatures.includes('workbook')) modes.push('WORKBOOK');
    }

    // KML files
    if (['kml', 'kmz'].includes(extension)) {
      if (userFeatures.includes('kml')) modes.push('KML');
    }

    return modes;
  }

  private getFeatureDescription(feature: string): string {
    const descriptions: Record<string, string> = {
      ocr: 'OCR - Ekstraksi teks dari gambar',
      geotags: 'Geotags - Ekstraksi data lokasi dari foto',
      archive: 'Archive - Ekstraksi dan analisis file arsip',
      workbook: 'Workbook - Konversi dan analisis spreadsheet',
      kml: 'KML - Ekstraksi data dari file KML/KMZ',
      location: 'Location - Pemrosesan data lokasi',
    };
    return descriptions[feature] || feature;
  }

  private getModeDescription(mode: string): string {
    const descriptions: Record<string, string> = {
      OCR: 'Ekstraksi teks dari gambar',
      GEOTAGS: 'Ekstraksi koordinat GPS dari foto',
      ARCHIVE: 'Ekstraksi dan analisis isi arsip',
      WORKBOOK: 'Konversi format spreadsheet',
      KML: 'Ekstraksi data lokasi dari KML',
      LOCATION: 'Pemrosesan data koordinat',
    };
    return descriptions[mode] || mode;
  }
}
