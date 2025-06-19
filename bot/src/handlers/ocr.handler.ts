import { Message } from 'telegraf/typings/core/types/typegram';
import { AuthContext } from '../middleware/auth';
import { ApiClient } from '../services/api-client';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';
import { LocalFileService } from '../services/local-file.service';
import { getErrorMessage } from '../utils/error-utils';
import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import FormData from 'form-data';
import winston from 'winston';

interface OcrContext extends AuthContext {
  // Session management is now handled by AuthContext
}

export class OcrHandler {
  private logger: winston.Logger;
  private apiClient: ApiClient;
  private backendUrl: string;
  private localFileService: LocalFileService;
  private koordinatModeUsers = new Set<string>(); // Track users in koordinat sub-mode

  constructor(apiClient: ApiClient, logger: winston.Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    this.localFileService = new LocalFileService(logger);
  }

  /**
   * Handle /ocr command - enter OCR mode
   */
  async handleOcrCommand(ctx: OcrContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) {
        await ctx.reply('❌ Error: Tidak dapat mengidentifikasi pengguna.');
        return;
      }

      // Check if user has access to OCR feature
      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) {
        await ctx.reply('❌ Anda tidak memiliki akses ke fitur OCR Processing.');
        return;
      }

      this.logger.info('OCR command received', {
        telegramId,
        userId: ctx.user.id,
        username: ctx.user.username,
      });

      // Set user in OCR mode using session manager
      ctx.setUserMode?.('ocr');

      // Clear koordinat sub-mode if active (ensure regular OCR mode)
      const wasInKoordinatMode = this.koordinatModeUsers.has(telegramId);
      this.koordinatModeUsers.delete(telegramId);

      if (wasInKoordinatMode) {
        this.logger.info('Cleared koordinat sub-mode for regular OCR', { telegramId });
      }

      await ctx.reply(
        '🔤 OCR Text Recognition\n\n' +
          'Anda memiliki akses ke fitur OCR. Cara penggunaan:\n\n' +
          '📸 Kirim gambar langsung untuk mengekstrak teks (mendukung Bahasa Indonesia & Inggris)\n' +
          '📄 Kirim dokumen gambar untuk diproses\n' +
          '📍 /ocr_koordinat - Mode khusus ekstraksi koordinat dari gambar\n' +
          '📊 /ocr_stats - Lihat status OCR service\n\n' +
          '💡 Tips untuk hasil terbaik:\n' +
          '• Pastikan gambar tidak buram\n' +
          '• Teks minimal 100x100 piksel\n' +
          '• Kontras yang jelas antara teks dan background\n' +
          '• Hindari gambar miring atau terbalik\n\n' +
          '✅ Siap digunakan! Kirim gambar sekarang.'
      );
    } catch (error) {
      this.logger.error('OCR command failed', {
        error: getErrorMessage(error),
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan. Tim teknis telah diberitahu.');
    }
  }

  /**
   * Handle /ocr_clear command
   */
  async handleOcrClear(ctx: OcrContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) return;

      // Clear OCR mode using session manager
      ctx.clearUserMode?.();

      // Also clear koordinat sub-mode if active
      this.koordinatModeUsers.delete(telegramId);

      await ctx.reply('🧹 Session OCR telah dibersihkan.');
      this.logger.info('OCR session cleared', { telegramId });
    } catch (error) {
      this.logger.error('Error clearing OCR session', {
        error: getErrorMessage(error),
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat membersihkan session OCR.');
    }
  }

  /**
   * Handle /ocr_stats command
   */
  async handleOcrStats(ctx: OcrContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) return;

      // Get OCR health from backend
      const healthResponse = await axios.get(`${this.backendUrl}/files/ocr/health`);
      const healthData = healthResponse.data;

      // Get user activity stats from backend
      const statsResponse = await axios.get(
        `${this.backendUrl}/activity/user/${ctx.user.id}/feature/ocr`
      );
      const activityStats = statsResponse.data;

      let statusMessage = '📊 *Statistik OCR*\n\n';

      // Service Status
      statusMessage += '*🔧 Status Layanan*\n';
      if (healthData.success && healthData.healthy) {
        statusMessage += '✅ Service: Healthy\n';
        statusMessage += '🤖 Provider: Google Cloud Vision API\n';
        statusMessage += '🌐 Languages: Indonesia, English\n\n';
      } else {
        statusMessage += '❌ Service: Unhealthy\n';
        statusMessage += `⚠️ Error: ${healthData.error || 'Unknown error'}\n\n`;
      }

      // User Activity Stats
      statusMessage += '*📈 Penggunaan Anda*\n';
      if (activityStats.success && activityStats.data) {
        const stats = activityStats.data;
        statusMessage += `📷 Total Gambar: ${stats.totalImages || 0}\n`;
        statusMessage += `📄 Total Dokumen: ${stats.totalDocuments || 0}\n`;
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

      await ctx.reply(statusMessage); // NO parse_mode
    } catch (error) {
      this.logger.error('Error getting OCR stats', {
        error: getErrorMessage(error),
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Gagal mengambil statistik OCR.');
    }
  }

  /**
   * Handle /ocr_koordinat command - OCR processing with coordinate extraction
   */
  async handleOcrKoordinat(ctx: OcrContext) {
    try {
      const telegramId = ctx.from!.id.toString();
      const userId = ctx.from!.id;

      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) {
        await ctx.reply('❌ Anda tidak memiliki akses ke fitur OCR Processing.');
        return;
      }

      this.logger.info('OCR Koordinat command received', { telegramId, userId });

      // Stay in OCR mode but enable coordinate extraction for this user
      this.koordinatModeUsers.add(telegramId);
      this.logger.info('OCR koordinat sub-mode activated', { userId, telegramId });

      await ctx.reply(
        '📍 *Mode OCR Koordinat Aktif*\n\n' +
          'Kirim gambar yang mengandung koordinat. Bot akan:\n' +
          '• Melakukan OCR pada gambar\n' +
          '• Mencari koordinat dalam teks\n' +
          '• Menampilkan dalam format Decimal dan Geografis\n\n' +
          '📝 Format yang didukung:\n' +
          '• Decimal: -7.251679, 112.7334\n' +
          '• DMS: 7°15\'6" S 112°44\'0" E\n' +
          '• Dan berbagai format koordinat lainnya\n\n' +
          'Ketik /menu untuk kembali ke menu utama.'
      );
    } catch (error) {
      this.logger.error('OCR Koordinat command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan. Tim teknis telah diberitahu.');
    }
  }

  /**
   * Handle photo messages for OCR processing
   */
  async handlePhoto(ctx: OcrContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) return;

      // Check if user is in OCR mode
      const userMode = ctx.getUserMode?.();
      const isInOcrMode = userMode === 'ocr';
      const isInKoordinatMode = this.koordinatModeUsers.has(telegramId);

      this.logger.info('Photo received for OCR', {
        telegramId,
        userMode,
        isInOcrMode,
        isInKoordinatMode,
        hasAccess: true,
      });

      // If user is not in OCR mode, ask them to activate it first
      if (!isInOcrMode) {
        await ctx.reply(
          'OCR tersedia!\n\n' +
            'Untuk menggunakan OCR, silakan ketik /ocr terlebih dahulu untuk mengaktifkan mode OCR.\n\n' +
            'Setelah aktif, Anda bisa mengirim gambar langsung tanpa perlu mengetik /ocr lagi.'
        ); // NO parse_mode
        return;
      }

      const message = ctx.message as Message.PhotoMessage;
      if (!message.photo || message.photo.length === 0) return;

      this.logger.info('Photo received for OCR processing', {
        telegramId,
        photoCount: message.photo.length,
      });

      const processingMsg = await ctx.reply('🔄 Memproses gambar, mohon tunggu...');
      let tempFilePath: string | null = null;

      try {
        // Get the largest photo
        const photo = message.photo[message.photo.length - 1];
        const fileId = photo.file_id;

        // Get file info from Telegram
        const fileInfo = await ctx.telegram.getFile(fileId);

        // Try local copy first (more efficient)
        if (await this.localFileService.isLocalModeAvailable()) {
          this.logger.info('Using local file copy mode', { fileId, filePath: fileInfo.file_path });

          const localFileResult = await this.localFileService.copyFileToUserDirectory(
            fileId,
            fileInfo.file_path!,
            telegramId,
            'ocr'
          );

          if (localFileResult.success) {
            tempFilePath = localFileResult.localPath!;
            this.logger.info('File copied locally successfully', {
              tempFilePath,
              fileName: localFileResult.fileName,
              size: localFileResult.size,
            });
          } else {
            throw new Error(`Local copy failed: ${localFileResult.error}`);
          }
        } else {
          // Fallback to HTTP download
          this.logger.info('Local mode not available, using HTTP download', { fileId });

          const botApiServer = process.env.BOT_API_SERVER;
          let fileUrl: string;

          if (botApiServer) {
            fileUrl = `${botApiServer}/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
          } else {
            fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
          }

          // Download the image
          const response = await axios.get(fileUrl, { responseType: 'stream' });

          // Create user-specific OCR directory
          const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'temp');
          const ocrDir = await createUserFeatureDir(baseDir, telegramId, 'ocr');
          tempFilePath = path.join(ocrDir, `ocr-${Date.now()}.jpg`);

          const writer = fs.createWriteStream(tempFilePath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
          });
        }

        // Check if we have a valid file path
        if (!tempFilePath) {
          throw new Error('File processing failed - no valid file path');
        }

        // Send to backend for OCR processing
        const formData = new FormData();
        formData.append('image', fs.createReadStream(tempFilePath));
        formData.append('telegramId', telegramId);
        formData.append('userId', ctx.user.id);

        const ocrResponse = await axios.post(`${this.backendUrl}/files/ocr/process`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 second timeout
        });

        // Delete processing message
        await ctx.deleteMessage(processingMsg.message_id);

        // Clean up temp file after processing
        try {
          await fs.remove(tempFilePath);
        } catch (cleanupError) {
          this.logger.warn('Failed to cleanup temp file', {
            tempFilePath: tempFilePath || 'unknown',
            error: getErrorMessage(cleanupError),
          });
        }

        if (ocrResponse.data.success && ocrResponse.data.data.extractedText) {
          const extractedText = ocrResponse.data.data.extractedText;

          this.logger.info('OCR processing successful', {
            telegramId,
            textLength: extractedText.length,
          });

          // Record successful activity
          await this.recordActivity({
            userId: ctx.user.id,
            telegramId,
            action: 'ocr_photo',
            mode: 'ocr',
            details: {
              fileId: photo.file_id,
              textLength: extractedText.length,
              photoSize: photo.file_size,
            },
            success: true,
          });

          // --- PLAIN TEXT SANITIZATION WITH LINE BREAKS ---
          const sanitizePlain = (text: string): string => {
            if (!text || typeof text !== 'string') return '';
            // Replace common markdown characters to avoid unintended formatting
            return text
              .replace(/[*_[\]`]/g, '') // remove *, _, [ ], `
              .replace(/\r\n/g, '\n') // normalize Windows line endings
              .replace(/\n{3,}/g, '\n\n') // max 2 consecutive newlines
              .replace(/[ \t]+\n/g, '\n') // remove trailing spaces before newlines
              .replace(/\n[ \t]+/g, '\n') // remove leading spaces after newlines
              .replace(/[ \t]+/g, ' ') // collapse multiple spaces/tabs to single space
              .trim();
          };

          const plainText = sanitizePlain(extractedText);

          // Check if user is in koordinat sub-mode
          if (isInKoordinatMode) {
            // Extract coordinates from OCR text
            const coordinates = this.extractCoordinates(extractedText);

            if (coordinates) {
              await ctx.reply('📍 *Koordinat Terdeteksi:*', { parse_mode: 'Markdown' });

              if (coordinates.decimal) {
                await ctx.reply('Koordinat Decimal = ' + `\`${coordinates.decimal}\``, {
                  parse_mode: 'Markdown',
                });
              }

              if (coordinates.dms) {
                await ctx.reply('Koordinat DMS = ' + `\`${coordinates.dms}\``, {
                  parse_mode: 'Markdown',
                });
              }

              await ctx.reply('💡 _Tap koordinat di atas untuk copy_', { parse_mode: 'Markdown' });

              this.logger.info('Coordinates extracted successfully', {
                telegramId,
                decimal: coordinates.decimal,
                dms: coordinates.dms,
              });
            } else {
              await ctx.reply(
                '📍 *Koordinat tidak terdeteksi*\n\nTidak ditemukan koordinat yang valid dalam gambar ini.',
                { parse_mode: 'Markdown' }
              );

              this.logger.info('No coordinates found in OCR text', {
                telegramId,
                textLength: extractedText.length,
              });
            }
          } else {
            // Regular OCR mode
            const resultMessage = `Hasil OCR:\n\n${plainText}`;

            if (resultMessage.length > 4096) {
              // Split long messages
              const chunks = this.splitMessage(plainText, 4000);
              await ctx.reply('Hasil OCR (Bagian 1):');

              for (let i = 0; i < chunks.length; i++) {
                await ctx.reply(chunks[i]);
              }
            } else {
              await ctx.reply(resultMessage); // NO parse_mode
            }
          }
        } else {
          const errorMsg = ocrResponse.data.error || 'Tidak ada teks yang terdeteksi dalam gambar.';

          // Record failed activity
          await this.recordActivity({
            userId: ctx.user.id,
            telegramId,
            action: 'ocr_photo',
            mode: 'ocr',
            details: {
              fileId: photo.file_id,
              photoSize: photo.file_size,
            },
            success: false,
            errorMessage: errorMsg,
          });

          await ctx.reply(`❌ ${errorMsg}`);
        }
      } catch (processingError) {
        this.logger.error('Error during OCR processing', {
          error: getErrorMessage(processingError),
          telegramId,
        });

        // Clean up temp file on error
        if (tempFilePath) {
          try {
            await fs.remove(tempFilePath);
          } catch (cleanupError) {
            this.logger.warn('Failed to cleanup temp file on error', {
              tempFilePath: tempFilePath,
              error: getErrorMessage(cleanupError),
            });
          }
        }

        await ctx.deleteMessage(processingMsg.message_id);
        await ctx.reply(
          '❌ Gagal memproses gambar. Pastikan gambar tidak buram dan teks cukup jelas.'
        );
      }
    } catch (error) {
      this.logger.error('Error processing photo for OCR', {
        error: getErrorMessage(error),
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses gambar.');
    }
  }

  /**
   * Handle document messages for OCR processing
   */
  async handleDocument(ctx: OcrContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('ocr');
      if (!hasAccess) return;

      // Check if user is in OCR mode
      const userMode = ctx.getUserMode?.();
      const isInOcrMode = userMode === 'ocr';

      if (!isInOcrMode) {
        await ctx.reply(
          'OCR tersedia!\n\n' +
            'Untuk menggunakan OCR, silakan ketik /ocr terlebih dahulu untuk mengaktifkan mode OCR.'
        ); // NO parse_mode
        return;
      }

      const message = ctx.message as Message.DocumentMessage;
      if (!message.document) return;

      const document = message.document;
      const fileName = document.file_name || '';
      const mimeType = document.mime_type || '';

      this.logger.info('Document received for OCR processing', {
        telegramId,
        fileName: fileName,
        mimeType: mimeType,
        userMode,
      });

      // Check if it's an image document by MIME type or file extension
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
      const isImageByMime = mimeType.startsWith('image/');
      const isImageByExtension = imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

      if (!isImageByMime && !isImageByExtension) {
        await ctx.reply(
          '❌ Hanya file gambar yang dapat diproses dengan OCR.\n\n' +
            'Format yang didukung: JPG, JPEG, PNG, GIF, BMP, WEBP, TIFF'
        );
        return;
      }

      this.logger.info('Processing image document for OCR', {
        telegramId,
        fileName,
        isImageByMime,
        isImageByExtension,
        fileSize: document.file_size,
      });

      await this.processDocumentForOcr(ctx, document);
    } catch (error) {
      this.logger.error('Error processing document for OCR', {
        error: getErrorMessage(error),
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses dokumen.');
    }
  }

  /**
   * Process document for OCR (similar to photo processing)
   */
  private async processDocumentForOcr(ctx: OcrContext, document: any) {
    const processingMsg = await ctx.reply('🔄 Memproses dokumen gambar, mohon tunggu...');
    const telegramId = ctx.from!.id.toString();

    try {
      const fileId = document.file_id;
      const fileName = document.file_name || 'unknown.jpg';

      // Get file info from Telegram
      const fileInfo = await ctx.telegram.getFile(fileId);

      let tempFilePath: string | null = null;

      // Try local file copy first (more efficient)
      if (await this.localFileService.isLocalModeAvailable()) {
        this.logger.info('Using local file copy mode for document', {
          fileId,
          filePath: fileInfo.file_path,
        });

        const localFileResult = await this.localFileService.copyFileToUserDirectory(
          fileId,
          fileInfo.file_path!,
          telegramId,
          'ocr'
        );

        if (localFileResult.success) {
          tempFilePath = localFileResult.localPath!;
          this.logger.info('Document copied locally successfully', {
            tempFilePath,
            fileName: localFileResult.fileName,
            size: localFileResult.size,
          });
        } else {
          throw new Error(`Local copy failed: ${localFileResult.error}`);
        }
      } else {
        // Fallback to HTTP download
        this.logger.info('Local mode not available, using HTTP download for document', { fileId });

        const botApiServer = process.env.BOT_API_SERVER;
        let fileUrl: string;

        if (botApiServer) {
          fileUrl = `${botApiServer}/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        } else {
          fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        }

        // Download the document
        const response = await axios.get(fileUrl, { responseType: 'stream' });

        // Create user-specific OCR directory
        const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'temp');
        const ocrDir = await createUserFeatureDir(baseDir, telegramId, 'ocr');
        const ext = path.extname(fileName) || '.jpg';
        tempFilePath = path.join(ocrDir, `ocr-doc-${Date.now()}${ext}`);

        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', reject);
        });

        this.logger.info('Document downloaded successfully', {
          tempFilePath,
          fileName,
        });
      }

      // Check if we have a valid file path
      if (!tempFilePath) {
        throw new Error('Document processing failed - no valid file path');
      }

      // Send to backend for OCR processing
      const formData = new FormData();
      formData.append('image', fs.createReadStream(tempFilePath));
      formData.append('telegramId', telegramId);
      formData.append('userId', ctx.user!.id);

      const ocrResponse = await axios.post(`${this.backendUrl}/files/ocr/process`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 30000,
      });

      await ctx.deleteMessage(processingMsg.message_id);

      // Clean up temp file after processing
      try {
        await fs.remove(tempFilePath);
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup document temp file', {
          tempFilePath: tempFilePath || 'unknown',
          error: getErrorMessage(cleanupError),
        });
      }

      if (ocrResponse.data.success && ocrResponse.data.data.extractedText) {
        const extractedText = ocrResponse.data.data.extractedText;

        this.logger.info('OCR document processing successful', {
          telegramId,
          fileName,
          textLength: extractedText.length,
        });

        // Record successful activity
        await this.recordActivity({
          userId: ctx.user!.id,
          telegramId,
          action: 'ocr_document',
          mode: 'ocr',
          details: {
            fileId: document.file_id,
            fileName: fileName,
            textLength: extractedText.length,
            fileSize: document.file_size,
          },
          success: true,
        });

        // --- PLAIN TEXT SANITIZATION WITH LINE BREAKS ---
        const sanitizePlain = (text: string): string => {
          if (!text || typeof text !== 'string') return '';
          // Replace common markdown characters to avoid unintended formatting
          return text
            .replace(/[*_[\]`]/g, '') // remove *, _, [ ], `
            .replace(/\r\n/g, '\n') // normalize Windows line endings
            .replace(/\n{3,}/g, '\n\n') // max 2 consecutive newlines
            .replace(/[ \t]+\n/g, '\n') // remove trailing spaces before newlines
            .replace(/\n[ \t]+/g, '\n') // remove leading spaces after newlines
            .replace(/[ \t]+/g, ' ') // collapse multiple spaces/tabs to single space
            .trim();
        };

        const plainText = sanitizePlain(extractedText);
        const resultMessage = `Hasil OCR:\n\n${plainText}`;

        if (resultMessage.length > 4096) {
          // Split long messages
          const chunks = this.splitMessage(plainText, 4000);
          await ctx.reply('Hasil OCR (Bagian 1):');

          for (const chunk of chunks) {
            await ctx.reply(chunk);
          }
        } else {
          await ctx.reply(resultMessage); // NO parse_mode
        }
      } else {
        const errorMsg = ocrResponse.data.error || 'Tidak ada teks yang terdeteksi dalam dokumen.';

        // Record failed activity
        await this.recordActivity({
          userId: ctx.user!.id,
          telegramId,
          action: 'ocr_document',
          mode: 'ocr',
          details: {
            fileId: document.file_id,
            fileName: fileName,
            fileSize: document.file_size,
          },
          success: false,
          errorMessage: errorMsg,
        });

        await ctx.reply(`❌ ${errorMsg}`);
      }
    } catch (error) {
      this.logger.error('Error processing document for OCR', {
        error: getErrorMessage(error),
        telegramId,
        fileName: document.file_name,
      });

      await ctx.deleteMessage(processingMsg.message_id);
      await ctx.reply('❌ Gagal memproses dokumen gambar. Pastikan file adalah gambar yang valid.');
    }
  }

  /**
   * Record user activity
   */
  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'ocr';
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await axios.post(`${this.backendUrl}/activity/record`, data);
    } catch (error) {
      this.logger.warn('Failed to record activity', {
        error: getErrorMessage(error),
        data,
      });
    }
  }

  /**
   * Split long messages into chunks
   */
  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const words = text.split(' ');

    for (const word of words) {
      if ((currentChunk + ' ' + word).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          // Word is longer than maxLength, split it
          chunks.push(word.substring(0, maxLength));
          currentChunk = word.substring(maxLength);
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Extract coordinates from OCR text
   */
  private extractCoordinates(text: string): { decimal?: string; dms?: string } | null {
    const result: { decimal?: string; dms?: string } = {};

    this.logger.info('Extracting coordinates from text', {
      textLength: text.length,
      textSample: text.substring(0, 500),
    });

    // Improved patterns untuk decimal coordinates (avoid temperature °C, °F)
    const decimalPatterns = [
      // Standard: -7.251583, 112.7334 atau -7.251583,112.7334 (tidak diikuti °C/°F)
      /(-?\d+\.?\d+)\s*[,]\s*(-?\d+\.?\d+)(?!\s*°[CF])/g,
      // Decimal format: Decimal = -7.251583, 112.7334
      /decimal[:\s=]*(-?\d+\.?\d+)[,\s]+(-?\d+\.?\d+)(?!\s*°[CF])/gi,
      // With spaces but not followed by temperature: -7.251583 112.7334
      /(-?\d+\.?\d+)\s+(-?\d+\.?\d+)(?!\s*°[CF])(?!\s*°)/g,
    ];

    // Separate patterns for multiline lat/lon format
    const latLonPatterns = [
      // Format: Lat/Long: 7.260978°S, 112.721873°E
      /(?:lat\/long|lat\/lon)[:\s]*(\d+\.?\d*)°([NS]),\s*(\d+\.?\d*)°([EW])/gi,
      // Format: Lat -7.2516737 / Long 112.7335706 (with / separator)
      /(?:lat)[:\s]*(-?\d+\.?\d+)\s*\/\s*(?:long)[:\s]*(-?\d+\.?\d+)/gi,
      // Koordinat format: Lat: -7.251583, Lon: 112.7334 (single line)
      /(?:lat|latitude)[:\s]*(-?\d+\.?\d+).*?(?:lon|longitude)[:\s]*(-?\d+\.?\d+)/gi,
      // Multiline format: Latitude -7.251583 ... Longitude 112.733387 (with any content between)
      /(?:lat|latitude)[:\s]*(-?\d+\.?\d+)[\s\S]*?(?:lon|longitude)[:\s]*(-?\d+\.?\d+)/gi,
    ];

    // Pattern untuk decimal coordinates dengan direction indicator
    const decimalDirectionPatterns = [
      // Format with dot separator: 7.16075264S 112.65048935E
      /(\d+\.?\d*)([NS])\s+(\d+\.?\d*)([EW])/g,
      // Format with comma separator: 7,258150S 112,745900E
      /(\d+,?\d*)([NS])\s+(\d+,?\d*)([EW])/g,
      // NEW FORMAT: Sign with direction (comma as decimal separator): -7,1607S+112,5317E
      /([+-]?\d+,\d+)([NS])([+-]?\d+,\d+)([EW])/g,
      // NEW FORMAT: Sign with direction (dot as decimal separator): -7.1607S+112.5317E
      /([+-]?\d+\.\d+)([NS])([+-]?\d+\.\d+)([EW])/g,
    ];

    // Pattern untuk DMS coordinates - improved
    const dmsPatterns = [
      // Standard: 7°15'5" S 112°44'0" E
      /(\d+)°(\d+)'(\d+)"\s*([NSEW])\s+(\d+)°(\d+)'(\d+)"\s*([NSEW])/gi,
      // Alternative: 7° 15' 5" S 112° 44' 0" E
      /(\d+)°\s*(\d+)'\s*(\d+)"\s*([NSEW])\s+(\d+)°\s*(\d+)'\s*(\d+)"\s*([NSEW])/gi,
      // With decimal seconds: 7°15'5.23" S 112°44'0.45" E
      /(\d+)°(\d+)'(\d+\.?\d*)"\s*([NSEW])\s+(\d+)°(\d+)'(\d+\.?\d*)"\s*([NSEW])/gi,
    ];

    // PRIORITY 1: Try lat/lon patterns FIRST (most reliable)
    for (const pattern of latLonPatterns) {
      const matches = [...text.matchAll(pattern)];
      this.logger.info('Lat/Lon pattern match attempt', {
        pattern: pattern.source,
        matchCount: matches.length,
        matches: matches.map(m => ({ lat: m[1], lon: m[2] })),
      });

      for (const match of matches) {
        let lat: number, lon: number;

        // Check if this is the special degree format: Lat/Long: 7.260978°S, 112.721873°E
        if (
          match[1] &&
          match[2] &&
          match[3] &&
          match[4] &&
          (match[2] === 'S' || match[2] === 'N')
        ) {
          // Special degree format: match[1]=lat, match[2]=latDir, match[3]=lon, match[4]=lonDir
          lat = parseFloat(match[1]);
          lon = parseFloat(match[3]);

          // Apply direction: S = negative lat, W = negative lon
          if (match[2] === 'S') lat = -lat;
          if (match[4] === 'W') lon = -lon;

          this.logger.info('Processing degree format coordinates', {
            originalLat: match[1],
            latDir: match[2],
            originalLon: match[3],
            lonDir: match[4],
            finalLat: lat,
            finalLon: lon,
          });
        } else {
          // Standard format: match[1]=lat, match[2]=lon
          lat = parseFloat(match[1]);
          lon = parseFloat(match[2]);
        }

        this.logger.info('Checking lat/lon coordinate validity', {
          lat,
          lon,
          latValid: lat >= -90 && lat <= 90,
          lonValid: lon >= -180 && lon <= 180,
        });

        // Enhanced validation for realistic geographical coordinates
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          // Additional checks for realistic coordinates
          const isRealistic =
            Math.abs(lat) > 0.001 &&
            Math.abs(lon) > 0.001 && // Not too close to 0,0
            !(Math.abs(lat) < 1 && Math.abs(lon) < 1) && // Avoid small numbers that might be temperatures
            Math.abs(lat) <= 85 && // Exclude extreme polar regions (likely false positives)
            !(
              lat > 0 &&
              lat < 100 &&
              lon > 0 &&
              lon < 100 &&
              Math.floor(lat) === lat &&
              Math.floor(lon) === lon
            ); // Avoid integer temperature-like values

          if (isRealistic) {
            result.decimal = `${lat},${lon}`;
            result.dms = this.convertDecimalToDMS(lat, lon);

            this.logger.info('Valid lat/lon coordinates found', {
              decimal: result.decimal,
              dms: result.dms,
            });
            break;
          } else {
            this.logger.warn('Lat/lon coordinates rejected as unrealistic', {
              lat,
              lon,
              reason: 'Failed realism checks',
            });
          }
        }
      }

      if (result.decimal) break;
    }

    // PRIORITY 1.5: Try decimal with direction indicators (e.g., 7.16075264S 112.65048935E or 7,258150S 112,745900E)
    if (!result.decimal) {
      for (const pattern of decimalDirectionPatterns) {
        const matches = [...text.matchAll(pattern)];
        this.logger.info('Decimal direction pattern match attempt', {
          pattern: pattern.source,
          matchCount: matches.length,
          matches: matches.map(m => ({
            latValue: m[1],
            latDir: m[2],
            lonValue: m[3],
            lonDir: m[4],
          })),
        });

        for (const match of matches) {
          // Convert comma to dot for parsing (European decimal format)
          const latValue = match[1].replace(',', '.');
          const lonValue = match[3].replace(',', '.');

          let lat = parseFloat(latValue);
          const latDir = match[2];
          let lon = parseFloat(lonValue);
          const lonDir = match[4];

          // For new format with sign: respect the existing sign but also consider direction
          // If number already has sign, use it as is; otherwise apply direction
          if (!match[1].includes('+') && !match[1].includes('-')) {
            // Traditional format without sign - apply direction
            if (latDir === 'S') lat = -Math.abs(lat);
            if (latDir === 'N') lat = Math.abs(lat);
          }

          if (!match[3].includes('+') && !match[3].includes('-')) {
            // Traditional format without sign - apply direction
            if (lonDir === 'W') lon = -Math.abs(lon);
            if (lonDir === 'E') lon = Math.abs(lon);
          }

          this.logger.info('Checking decimal direction coordinate validity', {
            lat,
            lon,
            latDir,
            lonDir,
            originalLatValue: match[1],
            originalLonValue: match[3],
            latValid: lat >= -90 && lat <= 90,
            lonValid: lon >= -180 && lon <= 180,
          });

          // Enhanced validation for realistic geographical coordinates
          if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            // Additional checks for realistic coordinates
            const isRealistic =
              Math.abs(lat) > 0.001 &&
              Math.abs(lon) > 0.001 && // Not too close to 0,0
              !(Math.abs(lat) < 1 && Math.abs(lon) < 1) && // Avoid small numbers that might be temperatures
              Math.abs(lat) <= 85 && // Exclude extreme polar regions (likely false positives)
              !(
                lat > 0 &&
                lat < 100 &&
                lon > 0 &&
                lon < 100 &&
                Math.floor(lat) === lat &&
                Math.floor(lon) === lon
              ); // Avoid integer temperature-like values

            if (isRealistic) {
              result.decimal = `${lat},${lon}`;
              result.dms = this.convertDecimalToDMS(lat, lon);

              this.logger.info('Valid decimal direction coordinates found', {
                decimal: result.decimal,
                dms: result.dms,
                originalFormat: `${match[1]}${latDir}${match[3]}${lonDir}`,
                formatType:
                  match[1].includes('+') || match[1].includes('-')
                    ? 'signed_with_direction'
                    : 'traditional_with_direction',
              });
              break;
            } else {
              this.logger.warn('Decimal direction coordinates rejected as unrealistic', {
                lat,
                lon,
                latDir,
                lonDir,
                reason: 'Failed realism checks',
              });
            }
          }
        }

        if (result.decimal) break;
      }
    }

    // PRIORITY 2: Try general decimal patterns only if lat/lon failed
    if (!result.decimal) {
      for (const pattern of decimalPatterns) {
        const matches = [...text.matchAll(pattern)];
        this.logger.info('Decimal pattern match attempt', {
          pattern: pattern.source,
          matchCount: matches.length,
          matches: matches.map(m => ({ lat: m[1], lon: m[2] })),
        });

        for (const match of matches) {
          const lat = parseFloat(match[1]);
          const lon = parseFloat(match[2]);

          this.logger.info('Checking coordinate validity', {
            lat,
            lon,
            latValid: lat >= -90 && lat <= 90,
            lonValid: lon >= -180 && lon <= 180,
          });

          // Enhanced validation for realistic geographical coordinates
          if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            // Additional checks for realistic coordinates - more strict for general patterns
            const isRealistic =
              Math.abs(lat) > 0.001 &&
              Math.abs(lon) > 0.001 && // Not too close to 0,0
              Math.abs(lat) > 1 &&
              Math.abs(lon) > 1 && // Must be > 1 for general patterns to avoid instrument readings
              Math.abs(lat) <= 85 && // Exclude extreme polar regions
              !(
                lat > 0 &&
                lat < 100 &&
                lon > 0 &&
                lon < 100 &&
                Math.floor(lat) === lat &&
                Math.floor(lon) === lon
              ) && // Avoid integer temperature-like values
              !(Math.abs(lat) < 50 && Math.abs(lon) < 50 && Math.abs(lat - Math.round(lat)) < 0.1); // Avoid instrument readings like -09.17

            if (isRealistic) {
              result.decimal = `${lat},${lon}`;
              result.dms = this.convertDecimalToDMS(lat, lon);

              this.logger.info('Valid decimal coordinates found', {
                decimal: result.decimal,
                dms: result.dms,
              });
              break;
            } else {
              this.logger.warn('Coordinates rejected as unrealistic', {
                lat,
                lon,
                reason: 'Failed realism checks (general pattern)',
              });
            }
          }
        }

        if (result.decimal) break;
      }
    }

    // Jika tidak ada decimal valid, coba parse DMS
    if (!result.decimal) {
      for (const pattern of dmsPatterns) {
        const matches = [...text.matchAll(pattern)];
        this.logger.info('DMS pattern match attempt', {
          pattern: pattern.source,
          matchCount: matches.length,
        });

        for (const match of matches) {
          try {
            const lat = this.parseDMSToDecimal(
              parseInt(match[1]),
              parseInt(match[2]),
              parseFloat(match[3]),
              match[4]
            );
            const lon = this.parseDMSToDecimal(
              parseInt(match[5]),
              parseInt(match[6]),
              parseFloat(match[7]),
              match[8]
            );

            this.logger.info('DMS to decimal conversion', {
              originalDMS: match[0],
              lat,
              lon,
              latValid: lat >= -90 && lat <= 90,
              lonValid: lon >= -180 && lon <= 180,
            });

            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
              result.decimal = `${lat},${lon}`;
              result.dms = match[0]; // Use original DMS format

              this.logger.info('Valid DMS coordinates found', {
                decimal: result.decimal,
                dms: result.dms,
              });
              break;
            }
          } catch (error) {
            this.logger.warn('DMS parsing error', {
              error: getErrorMessage(error),
              match: match[0],
            });
            continue;
          }
        }

        if (result.decimal) break;
      }
    }

    const hasResult = Object.keys(result).length > 0;
    this.logger.info('Coordinate extraction result', {
      hasResult,
      result: hasResult ? result : null,
    });

    return hasResult ? result : null;
  }

  /**
   * Convert decimal coordinates to DMS format
   */
  private convertDecimalToDMS(lat: number, lon: number): string {
    const formatDMS = (decimal: number, isLatitude: boolean): string => {
      const absolute = Math.abs(decimal);
      const degrees = Math.floor(absolute);
      const minutes = Math.floor((absolute - degrees) * 60);
      const seconds = Math.floor(((absolute - degrees) * 60 - minutes) * 60);

      let direction: string;
      if (isLatitude) {
        direction = decimal >= 0 ? 'N' : 'S';
      } else {
        direction = decimal >= 0 ? 'E' : 'W';
      }

      return `${degrees}°${minutes}'${seconds}" ${direction}`;
    };

    return `${formatDMS(lat, true)} ${formatDMS(lon, false)}`;
  }

  /**
   * Parse DMS to decimal
   */
  private parseDMSToDecimal(
    degrees: number,
    minutes: number,
    seconds: number,
    direction: string
  ): number {
    let decimal = degrees + minutes / 60 + seconds / 3600;

    if (direction.toUpperCase() === 'S' || direction.toUpperCase() === 'W') {
      decimal = -decimal;
    }

    // Round to 6 decimal places for precision
    return Math.round(decimal * 1000000) / 1000000;
  }
}
