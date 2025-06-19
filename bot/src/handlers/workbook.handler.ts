import { AuthContext } from '../types/auth';
import { getErrorMessage, getErrorStack } from '../utils/error-utils';
import { Message } from 'telegraf/typings/core/types/typegram';
import winston from 'winston';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { ApiClient } from '../services/api-client';
import { LocalFileService } from '../services/local-file.service';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';

interface WorkbookContext extends AuthContext {
  // Session management is now handled by AuthContext
}

interface UserWorkbookState {
  newFolderPath: string;
  imageCounter: number;
  downloadFlag: boolean;
  downloadCount: number;
  processingQueue: PhotoProcessingTask[];
  isProcessingQueue: boolean;
  lastProcessTime: number;
}

interface PhotoProcessingTask {
  fileId: string;
  fileName: string;
  chatId: number;
  timestamp: number;
}

export class WorkbookHandler {
  private logger: winston.Logger;
  private apiClient: ApiClient;
  private backendUrl: string;
  private localFileService: LocalFileService;
  private userStates = new Map<string, UserWorkbookState>();

  constructor(apiClient: ApiClient, logger: winston.Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    this.localFileService = new LocalFileService(logger);
  }

  /**
   * Handle /workbook command - enter workbook mode
   */
  async handleWorkbookCommand(ctx: WorkbookContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) {
        await ctx.reply('❌ Error: Tidak dapat mengidentifikasi pengguna.');
        return;
      }

      // Check if user has access to workbook feature
      const hasAccess = await ctx.hasFeatureAccess?.('workbook');
      if (!hasAccess) {
        await ctx.reply('❌ Anda tidak memiliki akses ke fitur Workbook.');
        return;
      }

      this.logger.info('Workbook command received', {
        telegramId,
        userId: ctx.user.id,
        username: ctx.user.username,
      });

      // Set user in workbook mode using session manager
      ctx.setUserMode?.('workbook');

      // Initialize workbook state
      this.initUserWorkbookState(telegramId);

      await ctx.reply(
        '📊 *Workbook Photo Manager*\n\n' +
          'Anda memiliki akses ke fitur Workbook. Cara penggunaan:\n\n' +
          '📝 Ketik nama sheet (contoh: "sheet1") untuk membuat sheet baru\n' +
          '📸 Kirim foto untuk disimpan ke sheet yang aktif\n' +
          '📋 `cek` - Lihat daftar sheet yang telah dibuat\n' +
          '📤 `send` - Generate file Excel dengan semua gambar\n' +
          '🗑️ `clear` - Hapus semua sheet dan foto\n' +
          '📊 `/workbook_stats` - Lihat statistik workbook\n\n' +
          '💡 Tips untuk penggunaan optimal:\n' +
          '• Bot memproses foto dengan delay 0.1 detik untuk performa optimal\n' +
          '• Notifikasi progress setiap 10 foto\n' +
          '• File Excel akan berisi layout 5 kolom per sheet\n' +
          '• Semua foto disimpan dengan timestamp untuk urutan yang konsisten\n\n' +
          '✅ Siap digunakan! Ketik nama sheet untuk memulai.'
      );
    } catch (error) {
      this.logger.error('Workbook command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan. Tim teknis telah diberitahu.');
    }
  }

  /**
   * Handle /workbook_clear command
   */
  async handleWorkbookClear(ctx: WorkbookContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('workbook');
      if (!hasAccess) return;

      const state = this.getUserWorkbookState(telegramId);

      // Clear processing queue
      state.processingQueue = [];
      state.isProcessingQueue = false;

      // Clear workbook mode using session manager
      await this.clearMediaFolder(telegramId);

      // Reset state
      state.downloadCount = 0;
      state.newFolderPath = '';

      await ctx.reply('🧹 Semua sheet dan antrian foto telah dibersihkan.');
      this.logger.info('Workbook session cleared', { telegramId });
    } catch (error) {
      this.logger.error('Error clearing workbook session', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat membersihkan session workbook.');
    }
  }

  /**
   * Handle /workbook_stats command
   */
  async handleWorkbookStats(ctx: WorkbookContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('workbook');
      if (!hasAccess) return;

      // Get user activity stats from backend
      const statsResponse = await axios.get(
        `${this.backendUrl}/activity/user/${ctx.user.id}/feature/workbook`
      );
      const activityStats = statsResponse.data;

      // Get current session info
      const state = this.getUserWorkbookState(telegramId);
      const mediaFolderPath = await this.getMediaFolderPath(telegramId);

      let statusMessage = '📊 *Statistik Workbook*\n\n';

      // Current Session Status
      statusMessage += '*📋 Session Saat Ini*\n';
      if (state.newFolderPath) {
        const currentSheet = path.basename(state.newFolderPath);
        statusMessage += `📝 Sheet Aktif: ${currentSheet}\n`;
        statusMessage += `📸 Foto di Sheet: ${state.downloadCount}\n`;
      } else {
        statusMessage += `📝 Sheet Aktif: Belum ada\n`;
      }

      if (state.processingQueue.length > 0) {
        statusMessage += `⏳ Antrian Foto: ${state.processingQueue.length}\n`;
      }

      // Check existing sheets
      if (await fs.pathExists(mediaFolderPath)) {
        const folders = (await fs.readdir(mediaFolderPath)).filter(async file =>
          (await fs.lstat(path.join(mediaFolderPath, file))).isDirectory()
        );

        if (folders.length > 0) {
          statusMessage += `📁 Total Sheet: ${folders.length}\n`;

          let totalSize = 0;
          for (const folder of folders) {
            const folderPath = path.join(mediaFolderPath, folder);
            if (await fs.pathExists(folderPath)) {
              totalSize += await this.getFolderSize(folderPath);
            }
          }
          const totalSizeInMB = totalSize / (1024 * 1024);
          statusMessage += `💾 Total Ukuran: ${totalSizeInMB.toFixed(2)} MB\n`;
        }
      }
      statusMessage += '\n';

      // User Activity Stats
      if (activityStats.success && activityStats.data) {
        const stats = activityStats.data;
        statusMessage += '*📈 Statistik Penggunaan*\n';
        statusMessage += `📤 Total Excel Generated: ${stats.totalExcel || 0}\n`;
        statusMessage += `📸 Total Foto Diproses: ${stats.totalPhotos || 0}\n`;
        statusMessage += `✅ Berhasil: ${stats.successCount || 0}\n`;
        statusMessage += `❌ Gagal: ${stats.failureCount || 0}\n`;
        statusMessage += `📊 Success Rate: ${stats.successRate || 0}%\n`;
        statusMessage += `🕐 Terakhir Digunakan: ${stats.lastUsed ? new Date(stats.lastUsed).toLocaleDateString('id-ID') : 'Belum pernah'}\n`;
        statusMessage += `📅 Bulan ini: ${stats.thisMonth || 0} kali\n`;
        statusMessage += `📅 Minggu ini: ${stats.thisWeek || 0} kali\n`;
        statusMessage += `📅 Hari ini: ${stats.today || 0} kali\n\n`;
      } else {
        statusMessage += '📊 Belum ada data penggunaan\n\n';
      }

      statusMessage += `🕐 Update: ${new Date().toLocaleString('id-ID')}`;

      await ctx.reply(statusMessage);
    } catch (error) {
      this.logger.error('Error getting workbook stats', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Gagal mengambil statistik workbook.');
    }
  }

  /**
   * Handle photo messages for workbook processing
   */
  async handlePhoto(ctx: WorkbookContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('workbook');
      if (!hasAccess) return;

      // Check if user is in workbook mode
      const userMode = ctx.getUserMode?.();
      const isInWorkbookMode = userMode === 'workbook';

      this.logger.info('Photo received for workbook', {
        telegramId,
        userMode,
        isInWorkbookMode,
        hasAccess: true,
      });

      // If user is not in workbook mode, ask them to activate it first
      if (!isInWorkbookMode) {
        await ctx.reply(
          'Workbook tersedia!\n\n' +
            'Untuk menggunakan Workbook, silakan ketik /workbook terlebih dahulu untuk mengaktifkan mode Workbook.\n\n' +
            'Setelah aktif, Anda bisa mengirim foto langsung tanpa perlu mengetik /workbook lagi.'
        );
        return;
      }

      const message = ctx.message as Message.PhotoMessage;
      if (!message.photo || message.photo.length === 0) return;

      const state = this.getUserWorkbookState(telegramId);

      // Check if sheet is selected
      if (state.newFolderPath === '') {
        await ctx.reply(
          "Silakan ketik nama sheet (contoh: 'sheet1') untuk membuat sheet baru terlebih dahulu."
        );
        return;
      }

      this.logger.info('Photo received for workbook processing', {
        telegramId,
        photoCount: message.photo.length,
        currentSheet: path.basename(state.newFolderPath),
      });

      // Get the largest photo
      const photo = message.photo[message.photo.length - 1];
      const fileId = photo.file_id;

      const timestamp = new Date().getTime();
      const fileName = `image_${timestamp}.jpg`;

      // Add photo to processing queue
      const task: PhotoProcessingTask = {
        fileId,
        fileName,
        chatId: ctx.chat!.id,
        timestamp,
      };

      state.processingQueue.push(task);

      // Simplified queue notification
      const queueLength = state.processingQueue.length;
      if (queueLength === 1 && !state.isProcessingQueue) {
        // First photo, start processing immediately
        this.processPhotoQueue(telegramId, ctx).catch(error => {
          this.logger.error('Error in processPhotoQueue:', error);
        });
      } else if (queueLength % 10 === 0) {
        // Notify every 10 photos added to queue
        await ctx.reply(`📸 ${queueLength} foto dalam antrian...`);
      }

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'add_photo_to_queue',
        mode: 'workbook',
        details: {
          fileId: photo.file_id,
          photoSize: photo.file_size,
          queueLength,
          currentSheet: path.basename(state.newFolderPath),
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('Error processing photo for workbook', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses foto.');
    }
  }

  /**
   * Handle text messages for workbook (sheet names, commands)
   */
  async handleText(ctx: WorkbookContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('workbook');
      if (!hasAccess) return;

      // Check if user is in workbook mode
      const userMode = ctx.getUserMode?.();
      if (userMode !== 'workbook') return;

      const message = ctx.message as Message.TextMessage;
      const text = message.text.toLowerCase();

      const state = this.getUserWorkbookState(telegramId);
      const mediaFolderPath = await this.getMediaFolderPath(telegramId);

      // Handle "clear" command
      if (text === 'clear') {
        state.processingQueue = [];
        state.isProcessingQueue = false;
        await this.clearMediaFolder(telegramId);
        state.downloadCount = 0;
        state.newFolderPath = '';

        await ctx.reply('Semua sheet dan antrian foto telah dihapus.');
        return;
      }

      // Handle "cek" command
      if (text === 'cek') {
        if (!(await fs.pathExists(mediaFolderPath))) {
          await ctx.reply('Belum ada sheet yang dibuat.');
          return;
        }

        const files = await fs.readdir(mediaFolderPath);
        const folders = [];

        for (const file of files) {
          const filePath = path.join(mediaFolderPath, file);
          if ((await fs.lstat(filePath)).isDirectory()) {
            folders.push(file as never);
          }
        }

        if (folders.length === 0) {
          await ctx.reply('Belum ada sheet yang dibuat.');
          return;
        }

        let folderList = '';
        let totalSizeInBytes = 0;

        for (const folder of folders) {
          const folderPath = path.join(mediaFolderPath, folder);
          const folderSizeInBytes = await this.getFolderSize(folderPath);
          totalSizeInBytes += folderSizeInBytes;
          const folderSizeInMegabytes = folderSizeInBytes / (1024 * 1024);
          folderList += `${folder} (Ukuran: ${folderSizeInMegabytes.toFixed(2)} MB)\n`;
        }

        const totalSizeInMegabytes = totalSizeInBytes / (1024 * 1024);
        const queueInfo =
          state.processingQueue.length > 0
            ? `\n\n📋 Foto dalam antrian: ${state.processingQueue.length}`
            : '';

        await ctx.reply(
          `Berikut adalah daftar sheet yang telah dibuat:\n${folderList}\nTotal Ukuran: ${totalSizeInMegabytes.toFixed(2)} MB${queueInfo}`
        );
        return;
      }

      // Handle "send" command
      if (text === 'send') {
        await this.handleSendCommand(ctx, telegramId, state, mediaFolderPath);
        return;
      }

      // Handle sheet name creation
      if (!text.startsWith('/')) {
        const newFolderName = message.text;
        state.newFolderPath = path.join(mediaFolderPath, newFolderName);

        // Create folder if it doesn't exist
        await fs.ensureDir(state.newFolderPath);

        state.imageCounter = 1;
        state.downloadCount = 0;

        await ctx.reply(
          `Sheet dengan nama ${newFolderName} telah dibuat. Anda sekarang bisa mengirim foto.\n\n📝 *Tips*: Bot akan memproses foto dengan delay 0.1 detik per foto. Notifikasi progress setiap 10 foto.`
        );
        return;
      }
    } catch (error) {
      this.logger.error('Error processing text for workbook', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah.');
    }
  }

  // Helper methods continue...
  private initUserWorkbookState(telegramId: string): UserWorkbookState {
    const state: UserWorkbookState = {
      newFolderPath: '',
      imageCounter: 1,
      downloadFlag: false,
      downloadCount: 0,
      processingQueue: [],
      isProcessingQueue: false,
      lastProcessTime: 0,
    };
    this.userStates.set(telegramId, state);
    return state;
  }

  private getUserWorkbookState(telegramId: string): UserWorkbookState {
    let state = this.userStates.get(telegramId);
    if (!state) {
      state = this.initUserWorkbookState(telegramId);
    }
    return state;
  }

  private async getMediaFolderPath(telegramId: string): Promise<string> {
    const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
    return await createUserFeatureDir(baseDir, telegramId, 'workbook');
  }

  private async clearMediaFolder(telegramId: string): Promise<void> {
    const mediaFolderPath = await this.getMediaFolderPath(telegramId);

    if (await fs.pathExists(mediaFolderPath)) {
      const files = await fs.readdir(mediaFolderPath);
      for (const file of files) {
        const filePath = path.join(mediaFolderPath, file);
        if ((await fs.lstat(filePath)).isDirectory()) {
          await fs.remove(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
    }
  }

  private async getFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0;
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = await fs.lstat(filePath);
      if (stat.isDirectory()) {
        totalSize += await this.getFolderSize(filePath); // Recursive for sub-folders
      } else {
        totalSize += stat.size;
      }
    }
    return totalSize;
  }

  private async processPhotoQueue(telegramId: string, ctx: WorkbookContext) {
    const state = this.getUserWorkbookState(telegramId);

    if (state.isProcessingQueue || state.processingQueue.length === 0) {
      return;
    }

    state.isProcessingQueue = true;
    const initialQueueLength = state.processingQueue.length;

    this.logger.info(
      `Starting photo queue processing for user ${telegramId}, initial queue length: ${initialQueueLength}`
    );

    // Send initial processing message
    if (initialQueueLength > 0) {
      await ctx.reply(`📸 Memproses ${initialQueueLength} foto dengan delay 0.1 detik per foto...`);
    }

    let processedCount = 0;
    let errorCount = 0;

    while (state.processingQueue.length > 0) {
      const task = state.processingQueue.shift();
      if (!task) break;

      try {
        // Apply delay to prevent rate limiting
        const timeSinceLastProcess = Date.now() - state.lastProcessTime;
        if (timeSinceLastProcess < 100) {
          const delayNeeded = 100 - timeSinceLastProcess;
          await this.sleep(delayNeeded);
        }

        // Process the photo
        await this.processPhotoTask(telegramId, task, ctx);
        state.lastProcessTime = Date.now();
        processedCount++;

        // Send progress update every 10 photos or at the end
        if (processedCount % 10 === 0 || state.processingQueue.length === 0) {
          const remaining = state.processingQueue.length;
          if (remaining > 0) {
            await ctx.reply(
              `✅ ${processedCount}/${initialQueueLength} foto selesai. Sisa: ${remaining} foto.`
            );
          } else {
            const successRate = errorCount > 0 ? ` (${errorCount} error)` : '';
            await ctx.reply(
              `🎉 Semua ${initialQueueLength} foto berhasil diproses${successRate}! Total foto di sheet "${path.basename(state.newFolderPath)}": ${state.downloadCount}`
            );
          }
        }
      } catch (error) {
        this.logger.error('Error processing photo task:', error);
        errorCount++;
        processedCount++;

        // Only show error message every 10 processed items (including errors)
        if (processedCount % 10 === 0) {
          await ctx.reply(
            `⚠️ Ada ${errorCount} error dari ${processedCount} foto. Melanjutkan pemrosesan...`
          );
        }
      }
    }

    state.isProcessingQueue = false;
    this.logger.info(
      `Photo queue processing completed for user ${telegramId}. Processed: ${processedCount} photos, Errors: ${errorCount}`
    );
  }

  private async processPhotoTask(
    telegramId: string,
    task: PhotoProcessingTask,
    ctx: WorkbookContext
  ) {
    const state = this.getUserWorkbookState(telegramId);

    try {
      this.logger.info(`Starting to process photo task: ${task.fileName} for user ${telegramId}`);

      // Check if sheet folder exists
      if (!state.newFolderPath || !(await fs.pathExists(state.newFolderPath))) {
        throw new Error(`Sheet folder not found or not set: ${state.newFolderPath}`);
      }

      // Get image file directly to the target sheet folder
      const targetPath = path.join(state.newFolderPath, task.fileName);
      this.logger.info(`Target path for photo: ${targetPath}`);

      const downloadPath = await this.getImageFileForWorkbook(task.fileId, targetPath, ctx);

      // Verify the file was successfully saved
      if (!(await fs.pathExists(downloadPath))) {
        throw new Error(`File was not saved to expected path: ${downloadPath}`);
      }

      const stats = await fs.stat(downloadPath);
      if (stats.size === 0) {
        throw new Error(`Downloaded file is empty: ${downloadPath}`);
      }

      state.imageCounter++;
      state.downloadFlag = true;
      state.downloadCount++;

      this.logger.info(
        `Photo processed successfully: ${task.fileName} for user ${telegramId}, size: ${stats.size} bytes`
      );
    } catch (error) {
      this.logger.error(`Error in processPhotoTask for ${task.fileName}:`, {
        error: error instanceof Error ? getErrorMessage(error) : String(error),
        telegramId,
        fileId: task.fileId,
        fileName: task.fileName,
        newFolderPath: state.newFolderPath,
        stack: error instanceof Error ? getErrorStack(error) : undefined,
      });
      throw error;
    }
  }

  private async getImageFileForWorkbook(
    fileId: string,
    targetPath: string,
    ctx: WorkbookContext
  ): Promise<string> {
    try {
      this.logger.info('Starting getImageFileForWorkbook process', { fileId, targetPath });

      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await fs.ensureDir(targetDir);

      // Try local copy first (more efficient)
      let fileInfo;
      let fileLink;

      try {
        fileInfo = await ctx.telegram.getFile(fileId);
        this.logger.info('File info retrieved', { fileId, filePath: fileInfo.file_path });
      } catch (error) {
        this.logger.error('Failed to get file info', { error: (error as Error).message, fileId });
        throw new Error(`Failed to get file info: ${(error as Error).message}`);
      }

      if (await this.localFileService.isLocalModeAvailable()) {
        this.logger.info('Using local file copy mode for workbook', { fileId });

        const telegramId = ctx.from!.id.toString();
        const localFileResult = await this.localFileService.copyFileToUserDirectory(
          fileId,
          fileInfo.file_path!,
          telegramId,
          'workbook'
        );

        if (localFileResult.success) {
          // Copy from temp location to target path
          await fs.copy(localFileResult.localPath!, targetPath);

          // Clean up temp file
          await fs.remove(localFileResult.localPath!);

          this.logger.info('File copied locally to workbook successfully', {
            targetPath,
            fileName: localFileResult.fileName,
            size: localFileResult.size,
          });

          return targetPath;
        } else {
          this.logger.warn(`Local copy failed, fallback to HTTP: ${localFileResult.error}`);
        }
      }

      // Fallback to HTTP download
      this.logger.info('Using HTTP download for workbook', { fileId });

      try {
        fileLink = await ctx.telegram.getFileLink(fileId);
        this.logger.info('File link retrieved', { fileId, fileLink: fileLink.href });
      } catch (error) {
        this.logger.error('Failed to get file link', { error: (error as Error).message, fileId });
        throw new Error(`Failed to get file link: ${(error as Error).message}`);
      }

      // Download directly to target path
      await this.downloadImage(fileLink.href, targetPath);

      // Verify downloaded file
      const downloadedStats = await fs.stat(targetPath);
      this.logger.info('Direct downloaded file stats for workbook', {
        targetPath,
        size: downloadedStats.size,
      });

      if (downloadedStats.size > 0) {
        this.logger.info('Direct HTTP download completed successfully for workbook');
        return targetPath;
      } else {
        throw new Error('Direct downloaded file is empty for workbook');
      }
    } catch (error) {
      this.logger.error('Error getting image file for workbook', { error, fileId, targetPath });
      throw error;
    }
  }

  private async downloadImage(url: string, filepath: string): Promise<void> {
    const writer = fs.createWriteStream(filepath);

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', err => reject(err));
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async handleSendCommand(
    ctx: WorkbookContext,
    telegramId: string,
    state: UserWorkbookState,
    mediaFolderPath: string
  ) {
    try {
      // Check if there are photos still in queue
      if (state.processingQueue.length > 0) {
        await ctx.reply(
          `Masih ada ${state.processingQueue.length} foto dalam antrian. Mohon tunggu hingga semua foto selesai diproses sebelum membuat Excel.`
        );
        return;
      }

      if (!(await fs.pathExists(mediaFolderPath))) {
        await ctx.reply('Tidak ada sheet yang tersedia. Silakan buat sheet terlebih dahulu.');
        return;
      }

      // Wait a bit to ensure all files are written completely
      await this.sleep(500);

      // Get list of directories (sheets) only
      const allItems = await fs.readdir(mediaFolderPath);
      const folders = [];

      for (const item of allItems) {
        const itemPath = path.join(mediaFolderPath, item);
        try {
          const stats = await fs.lstat(itemPath);
          if (stats.isDirectory()) {
            // Verify folder has images
            const folderFiles = await fs.readdir(itemPath);
            const imageFiles = folderFiles.filter(file =>
              /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
            );
            if (imageFiles.length > 0) {
              folders.push(item as never);
            }
          }
        } catch (error) {
          this.logger.warn(`Error checking item ${itemPath}:`, error);
        }
      }

      if (folders.length === 0) {
        await ctx.reply(
          'Tidak ada sheet dengan foto yang tersedia. Silakan tambahkan foto ke sheet terlebih dahulu.'
        );
        return;
      }

      await ctx.reply(`Membuat file Excel dengan ${folders.length} sheet...`);

      // Send request to backend to generate Excel file
      const response = await axios.post(
        `${this.backendUrl}/files/workbook/generate`,
        {
          telegramId,
          userId: ctx.user!.id,
          mediaFolderPath,
          folders: folders,
        },
        {
          timeout: 60000, // 60 second timeout for large files
        }
      );

      if (response.data.success) {
        const excelFilePath = response.data.data.excelFilePath;
        const fileSizeInMB = response.data.data.fileSizeInMB;

        // Send Excel file
        await ctx.replyWithDocument({ source: excelFilePath });
        await ctx.reply(`File Excel berhasil dibuat dengan ukuran ${fileSizeInMB} MB.`);

        // Record successful activity
        await this.recordActivity({
          userId: ctx.user!.id,
          telegramId,
          action: 'generate_excel',
          mode: 'workbook',
          details: {
            sheetsCount: folders.length,
            fileSizeInMB,
            excelFilePath: path.basename(excelFilePath),
          },
          success: true,
        });
      } else {
        await ctx.reply(`❌ Gagal membuat Excel: ${response.data.error}`);
      }
    } catch (error) {
      this.logger.error('Error in handleSendCommand:', error);
      await ctx.reply('❌ Gagal membuat file Excel. Silakan coba lagi.');
    }
  }

  /**
   * Record user activity
   */
  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'workbook';
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await axios.post(`${this.backendUrl}/activity/record`, data);
    } catch (error) {
      this.logger.warn('Failed to record activity', {
        error: (error as Error).message,
        data,
      });
    }
  }
}
