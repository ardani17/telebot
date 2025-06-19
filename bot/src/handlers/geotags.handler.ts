import { AuthContext } from '../types/auth';
import { Message } from 'telegraf/typings/core/types/typegram';
import winston from 'winston';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { ApiClient } from '../services/api-client';
import { LocalFileService } from '../services/local-file.service';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';

interface GeotagsContext extends AuthContext {
  // Session management is now handled by AuthContext
}

interface UserGeotagsState {
  pendingPhotoFileId?: string;
  pendingPhotos?: string[]; // Array untuk batch processing multiple photos
  alwaysTagLocation?: { latitude: number; longitude: number };
  isWaitingForStickyLocation?: boolean;
  customDateTime?: Date;
  batchTimer?: NodeJS.Timeout; // Timer untuk batch processing
}

export class GeotagsHandler {
  private logger: winston.Logger;
  private apiClient: ApiClient;
  private backendUrl: string;
  private localFileService: LocalFileService;
  private userStates = new Map<string, UserGeotagsState>();
  private mapsApiKey: string;

  constructor(apiClient: ApiClient, logger: winston.Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    this.localFileService = new LocalFileService(logger);
    this.mapsApiKey = process.env.MAPS_API_KEY || '';

    if (!this.mapsApiKey) {
      this.logger.warn('MAPS_API_KEY not found in environment variables');
    }
  }

  /**
   * Handle /geotags command - enter geotags mode
   */
  async handleGeotagsCommand(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) {
        await ctx.reply('❌ Error: Tidak dapat mengidentifikasi pengguna.');
        return;
      }

      // Check if user has access to geotags feature
      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) {
        await ctx.reply('❌ Anda tidak memiliki akses ke fitur Geotags.');
        return;
      }

      this.logger.info('Geotags command received', {
        telegramId,
        userId: ctx.user.id,
        username: ctx.user.username,
      });

      // Set user in geotags mode using session manager
      ctx.setUserMode?.('geotags');

      // Initialize geotags state
      this.initUserGeotagsState(telegramId);

      const helpMessage = `
🏷️ *Selamat datang di Mode Geotags!*

📷 *Mode Standar (1 Foto, 1 Lokasi):*
1. Kirim sebuah foto
2. Segera kirim lokasi Anda menggunakan fitur "Location" Telegram
   Bot akan otomatis menambahkan geotag ke foto tersebut

🔁 \`/alwaystag\` - *Mode Lokasi Menempel:*
• Ketik \`/alwaystag\` untuk mengaktifkan/menonaktifkan mode ini
• Saat pertama kali diaktifkan, bot akan meminta Anda mengirim lokasi
• Lokasi ini akan digunakan untuk semua foto selanjutnya

⏱️ \`/set_time {YYYY-MM-DD HH:MM}\` - *Atur Waktu Manual:*
• Format: \`YYYY-MM-DD HH:MM\`
• Contoh: \`/set_time 2024-12-25 15:30\`
• Reset: \`/set_time reset\`

📊 \`/geotags_stats\` - Lihat statistik penggunaan
🧹 \`/geotags_clear\` - Reset mode geotags

💡 *Tips:*
• Foto akan diberi overlay peta dan informasi koordinat
• Menggunakan Google Maps untuk tampilan peta
• Alamat didapat dari Google Geocoding API

✅ Siap digunakan! Kirim foto dan lokasi untuk memulai.
      `;

      await ctx.replyWithMarkdown(helpMessage.trim());
    } catch (error) {
      this.logger.error('Geotags command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan. Tim teknis telah diberitahu.');
    }
  }

  /**
   * Handle /geotags_clear command
   */
  async handleGeotagsClear(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Clear geotags state
      this.userStates.delete(telegramId);

      await ctx.reply('🧹 State geotags telah direset.');
      this.logger.info('Geotags session cleared', { telegramId });
    } catch (error) {
      this.logger.error('Error clearing geotags session', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat membersihkan session geotags.');
    }
  }

  /**
   * Handle /geotags_stats command
   */
  async handleGeotagsStats(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Get user activity stats from backend
      const statsResponse = await axios.get(
        `${this.backendUrl}/activity/user/${ctx.user.id}/feature/geotags`
      );
      const activityStats = statsResponse.data;

      // Get current session info
      const state = this.getUserGeotagsState(telegramId);

      let statusMessage = '🏷️ *Statistik Geotags*\n\n';

      // Current Session Status
      statusMessage += '*📋 Session Saat Ini*\n';
      if (state.alwaysTagLocation) {
        statusMessage += `📍 AlwaysTag: Aktif (${state.alwaysTagLocation.latitude.toFixed(5)}, ${state.alwaysTagLocation.longitude.toFixed(5)})\n`;
      } else {
        statusMessage += `📍 AlwaysTag: Tidak aktif\n`;
      }

      if (state.customDateTime) {
        statusMessage += `⏱️ Custom Time: ${state.customDateTime.toLocaleString('id-ID')}\n`;
      } else {
        statusMessage += `⏱️ Custom Time: Tidak diatur\n`;
      }

      if (state.pendingPhotoFileId) {
        statusMessage += `📸 Status: Menunggu lokasi\n`;
      } else {
        statusMessage += `📸 Status: Siap menerima foto\n`;
      }
      statusMessage += '\n';

      // User Activity Stats
      if (activityStats.success && activityStats.data) {
        const stats = activityStats.data;
        statusMessage += '*📈 Statistik Penggunaan*\n';
        statusMessage += `🏷️ Total Geotag Generated: ${stats.totalGeotags || 0}\n`;
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

      await ctx.replyWithMarkdown(statusMessage);
    } catch (error) {
      this.logger.error('Error getting geotags stats', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Gagal mengambil statistik geotags.');
    }
  }

  /**
   * Handle /alwaystag command
   */
  async handleAlwaysTag(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Check if user is in geotags mode
      const userMode = ctx.getUserMode?.();
      if (userMode !== 'geotags') return;

      const state = this.getUserGeotagsState(telegramId);

      if (state.alwaysTagLocation) {
        delete state.alwaysTagLocation;
        delete state.isWaitingForStickyLocation;
        await ctx.reply('📍 AlwaysTag mode NONAKTIF. Setiap foto akan memerlukan lokasi baru.');
      } else {
        state.isWaitingForStickyLocation = true;
        delete state.alwaysTagLocation;
        await ctx.reply(
          '📍 AlwaysTag mode AKTIF.\nSilakan kirim lokasi yang ingin Anda gunakan untuk beberapa foto ke depan. Untuk menonaktifkan, ketik /alwaystag lagi.'
        );
      }
    } catch (error) {
      this.logger.error('Error in alwaystag command', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengatur AlwaysTag.');
    }
  }

  /**
   * Handle /set_time command
   */
  async handleSetTime(ctx: GeotagsContext, timeString?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Check if user is in geotags mode
      const userMode = ctx.getUserMode?.();
      if (userMode !== 'geotags') return;

      const state = this.getUserGeotagsState(telegramId);

      if (!timeString) {
        await ctx.reply(
          'Gunakan format: /set_time YYYY-MM-DD HH:MM\nContoh: /set_time 2024-01-20 10:30\nAtau /set_time reset untuk menggunakan waktu saat ini.'
        );
        return;
      }

      if (timeString.toLowerCase() === 'reset') {
        delete state.customDateTime;
        await ctx.reply('⏱️ Pengaturan waktu manual dihapus. Bot akan menggunakan waktu saat ini.');
      } else {
        const parsedDate = this.customDateParser(timeString);
        if (parsedDate) {
          state.customDateTime = parsedDate;

          // Format preview in Indonesia timezone for confirmation
          const preview = parsedDate.toLocaleString('id-ID', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta',
          });

          // Debug logging
          this.logger.info('Custom time set', {
            telegramId,
            input: timeString,
            parsedUTC: parsedDate.toISOString(),
            previewWIB: preview,
          });

          await ctx.reply(`⏱️ Waktu manual diatur ke: ${preview} WIB`);
        } else {
          await ctx.reply(
            'Format tanggal/waktu tidak valid. Gunakan YYYY-MM-DD HH:MM\nContoh: /set_time 2024-06-28 14:00 (untuk 2 PM)'
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in set_time command', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengatur waktu.');
    }
  }

  /**
   * Handle photo messages for geotags processing
   */
  async handlePhoto(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Check if user is in geotags mode
      const userMode = ctx.getUserMode?.();
      const isInGeotagsMode = userMode === 'geotags';

      this.logger.info('Photo received for geotags', {
        telegramId,
        userMode,
        isInGeotagsMode,
        hasAccess: true,
      });

      // If user is not in geotags mode, ask them to activate it first
      if (!isInGeotagsMode) {
        await ctx.reply(
          'Geotags tersedia!\n\n' +
            'Untuk menggunakan Geotags, silakan ketik /geotags terlebih dahulu untuk mengaktifkan mode Geotags.\n\n' +
            'Setelah aktif, Anda bisa mengirim foto langsung tanpa perlu mengetik /geotags lagi.'
        );
        return;
      }

      const message = ctx.message as Message.PhotoMessage;
      if (!message.photo || message.photo.length === 0) {
        await ctx.reply('Gagal menerima foto.');
        return;
      }

      const photoFileId = message.photo[message.photo.length - 1].file_id;
      const state = this.getUserGeotagsState(telegramId);

      if (state.alwaysTagLocation && !state.isWaitingForStickyLocation) {
        // Initialize pendingPhotos array if not exists
        if (!state.pendingPhotos) {
          state.pendingPhotos = [];
        }

        // Add photo to batch queue
        state.pendingPhotos.push(photoFileId);

        // Clear existing timer if any
        if (state.batchTimer) {
          clearTimeout(state.batchTimer);
        }

        // Set timer for batch processing (2 seconds)
        state.batchTimer = setTimeout(async () => {
          if (state.pendingPhotos && state.pendingPhotos.length > 0) {
            await this.processBatchPhotosWithGeotag(
              ctx,
              state.pendingPhotos,
              state.alwaysTagLocation!,
              state.customDateTime
            );
            state.pendingPhotos = [];
            delete state.batchTimer;
          }
        }, 2000);

        await ctx.reply(
          `✔️ Foto ${state.pendingPhotos.length} diterima. Batch processing dalam 2 detik...`
        );
      } else {
        state.pendingPhotoFileId = photoFileId;
        if (state.isWaitingForStickyLocation) {
          await ctx.reply(
            '✔️ Foto diterima. Bot sedang menunggu Anda mengirimkan lokasi untuk diatur sebagai default AlwaysTag.'
          );
        } else {
          await ctx.reply('✔️ Foto diterima! Sekarang, silakan kirim lokasi Anda.');
        }
      }

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'receive_photo',
        mode: 'geotags',
        details: {
          fileId: photoFileId,
          hasAlwaysTag: !!state.alwaysTagLocation,
          isWaitingLocation: !state.alwaysTagLocation,
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('Error processing photo for geotags', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses foto.');
    }
  }

  /**
   * Handle location messages for geotags processing
   */
  async handleLocation(ctx: GeotagsContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const hasAccess = await ctx.hasFeatureAccess?.('geotags');
      if (!hasAccess) return;

      // Check if user is in geotags mode
      const userMode = ctx.getUserMode?.();
      if (userMode !== 'geotags') return;

      const message = ctx.message as Message.LocationMessage;
      if (!message.location) return;

      const state = this.getUserGeotagsState(telegramId);
      const receivedLocation = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
      };

      if (state.isWaitingForStickyLocation) {
        state.alwaysTagLocation = receivedLocation;
        delete state.isWaitingForStickyLocation;
        await ctx.reply(
          `📍 Lokasi telah diatur untuk mode AlwaysTag: ${receivedLocation.latitude.toFixed(5)}, ${receivedLocation.longitude.toFixed(5)}. Foto berikutnya akan menggunakan lokasi ini.`
        );

        if (state.pendingPhotoFileId) {
          const photoFileId = state.pendingPhotoFileId;
          delete state.pendingPhotoFileId;
          await this.processPhotoWithGeotag(
            ctx,
            photoFileId,
            receivedLocation,
            state.customDateTime
          );
        }
      } else if (state.alwaysTagLocation) {
        state.alwaysTagLocation = receivedLocation;
        await ctx.reply(
          `📍 Lokasi AlwaysTag diperbarui: ${receivedLocation.latitude.toFixed(5)}, ${receivedLocation.longitude.toFixed(5)}.`
        );

        if (state.pendingPhotoFileId) {
          const photoFileId = state.pendingPhotoFileId;
          delete state.pendingPhotoFileId;
          await this.processPhotoWithGeotag(
            ctx,
            photoFileId,
            receivedLocation,
            state.customDateTime
          );
        }
      } else {
        if (state.pendingPhotoFileId) {
          const photoFileId = state.pendingPhotoFileId;
          delete state.pendingPhotoFileId;
          await this.processPhotoWithGeotag(
            ctx,
            photoFileId,
            receivedLocation,
            state.customDateTime
          );
        } else {
          await ctx.reply(
            '📌 Lokasi diterima. Mohon kirim foto terlebih dahulu untuk mode standar atau aktifkan /alwaystag.'
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing location for geotags', {
        error: (error as Error).message,
        telegramId: ctx.from?.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses lokasi.');
    }
  }

  // Helper methods
  private initUserGeotagsState(telegramId: string): UserGeotagsState {
    const state: UserGeotagsState = {};
    this.userStates.set(telegramId, state);
    return state;
  }

  private getUserGeotagsState(telegramId: string): UserGeotagsState {
    let state = this.userStates.get(telegramId);
    if (!state) {
      state = this.initUserGeotagsState(telegramId);
    }
    return state;
  }

  private customDateParser(dateString: string): Date | null {
    const parts = dateString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
    if (!parts) return null;

    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const day = parseInt(parts[3], 10);
    const hours = parseInt(parts[4], 10);
    const minutes = parseInt(parts[5], 10);

    // ✅ FIX: Create date in Indonesia timezone (WIB = UTC+7)
    // User input: "2024-06-28 14:00" should be treated as 14:00 WIB

    // Create UTC date and adjust for Indonesia timezone offset
    const utcDate = new Date(Date.UTC(year, month, day, hours - 7, minutes)); // Subtract 7 hours for WIB

    // Validate the input components (before timezone adjustment)
    if (
      year >= 1900 &&
      year <= 2100 &&
      month >= 0 &&
      month <= 11 &&
      day >= 1 &&
      day <= 31 &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      return utcDate;
    }
    return null;
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }

  private splitAddressIntoLines(
    address: string,
    maxCharsPerLine: number,
    maxLines: number
  ): string[] {
    const lines: string[] = [];
    let remainingAddress = address.trim();

    for (let i = 0; i < maxLines && remainingAddress.length > 0; i++) {
      let currentLine: string;
      if (remainingAddress.length <= maxCharsPerLine) {
        currentLine = remainingAddress;
        remainingAddress = '';
      } else if (i === maxLines - 1) {
        currentLine = remainingAddress.substring(0, maxCharsPerLine - 3) + '...';
        remainingAddress = '';
      } else {
        let breakPoint = -1;
        for (let j = Math.min(remainingAddress.length - 1, maxCharsPerLine); j >= 0; j--) {
          if (remainingAddress[j] === ' ' || remainingAddress[j] === ',') {
            if (j > 0) {
              breakPoint = j;
              break;
            }
          }
        }

        if (breakPoint !== -1) {
          const includeSeparator = remainingAddress[breakPoint] === ',';
          currentLine = remainingAddress
            .substring(0, breakPoint + (includeSeparator ? 1 : 0))
            .trim();
          remainingAddress = remainingAddress.substring(breakPoint + 1).trim();
        } else {
          currentLine = remainingAddress.substring(0, maxCharsPerLine);
          remainingAddress = remainingAddress.substring(maxCharsPerLine).trim();
        }
      }
      lines.push(this.escapeXml(currentLine));
      if (remainingAddress.length === 0) break;
    }
    return lines;
  }

  private degreesToDms(lat: number, lon: number): { latDms: string; lonDms: string } {
    const latAbs = Math.abs(lat);
    const latDegrees = Math.floor(latAbs);
    const latMinutes = Math.floor((latAbs - latDegrees) * 60);
    const latSeconds = Math.round(((latAbs - latDegrees) * 60 - latMinutes) * 60);
    const latDirection = lat >= 0 ? 'N' : 'S';

    const lonAbs = Math.abs(lon);
    const lonDegrees = Math.floor(lonAbs);
    const lonMinutes = Math.floor((lonAbs - lonDegrees) * 60);
    const lonSeconds = Math.round(((lonAbs - lonDegrees) * 60 - lonMinutes) * 60);
    const lonDirection = lon >= 0 ? 'E' : 'W';

    return {
      latDms: `${latDegrees}°${latMinutes}'${latSeconds}" ${latDirection}`,
      lonDms: `${lonDegrees}°${lonMinutes}'${lonSeconds}" ${lonDirection}`,
    };
  }

  private async fetchAddressFromCoordinates(latitude: number, longitude: number): Promise<string> {
    if (!this.mapsApiKey) {
      this.logger.warn('MAPS_API_KEY not available, using fallback address');
      return `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }

    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.mapsApiKey}&language=id`;

    try {
      const response = await axios.get(geocodingUrl, { timeout: 10000 });

      if (response.data && response.data.results && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      return 'Alamat tidak ditemukan';
    } catch (error) {
      this.logger.error('Error fetching address from Google Geocoding:', error);
      return 'Gagal mengambil alamat';
    }
  }

  private async fetchGoogleStaticMap(latitude: number, longitude: number): Promise<Buffer> {
    if (!this.mapsApiKey) {
      this.logger.warn('MAPS_API_KEY not available, generating fallback map');
      return this.generateFallbackMap();
    }

    const mapWidth = 200;
    const mapHeight = 200;
    const zoomLevel = 15;

    // Google Static Maps API URL
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoomLevel}&size=${mapWidth}x${mapHeight}&markers=color:red%7C${latitude},${longitude}&key=${this.mapsApiKey}&maptype=roadmap`;

    try {
      const response = await axios.get(mapUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Error fetching Google Static Map:', error);
      return this.generateFallbackMap();
    }
  }

  private async generateFallbackMap(): Promise<Buffer> {
    const mapWidth = 200;
    const mapHeight = 200;

    const fallbackSvg = `
      <svg width="${mapWidth}" height="${mapHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${mapWidth}" height="${mapHeight}" fill="#DDDDDD" />
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#555555">Map Error</text>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="10" fill="#777777">(Google Maps unavailable)</text>
      </svg>
    `;

    return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
  }

  private async generateGeotagImage(
    latitude: number,
    longitude: number,
    customDateTime?: Date
  ): Promise<Buffer> {
    const mapTileBuffer = await this.fetchGoogleStaticMap(latitude, longitude);
    const mapImage = sharp(mapTileBuffer);

    let mapMetadata = { width: 200, height: 200 };
    try {
      const meta = await mapImage.metadata();
      mapMetadata = { width: meta.width || 200, height: meta.height || 200 };
    } catch (e) {
      this.logger.error('Error getting map metadata:', e);
    }

    const rawAddress = await this.fetchAddressFromCoordinates(latitude, longitude);

    // ✅ FIX: Proper timezone handling for Indonesia
    const targetDateTime = customDateTime || new Date();

    // Debug logging for timezone handling
    this.logger.info('Generating geotag timestamp', {
      isCustomTime: !!customDateTime,
      targetDateTimeUTC: targetDateTime.toISOString(),
      targetDateTimeLocal: targetDateTime.toString(),
    });

    // Format date and time in Indonesian format using the target datetime
    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Jakarta',
    });

    const dateStrParts = dateFormatter.formatToParts(targetDateTime);
    const dayName = dateStrParts.find(p => p.type === 'weekday')?.value || '';
    const day = dateStrParts.find(p => p.type === 'day')?.value || '';
    const month = dateStrParts.find(p => p.type === 'month')?.value || '';
    const year = dateStrParts.find(p => p.type === 'year')?.value || '';
    const timeStr = timeFormatter.format(targetDateTime).replace(/\./g, ':');

    // Debug the formatted result
    this.logger.info('Formatted timestamp result', {
      dateStrParts: dateStrParts.map(p => `${p.type}:${p.value}`),
      finalTimeStr: timeStr,
      finalDateTimeString: `${year}-${month}-${day}(${dayName}) ${timeStr}`,
    });

    // Format: 2025-06-07(Sab) 06:16(PM)
    const dateTimeString = `${year}-${month}-${day}(${dayName}) ${timeStr}`;
    const { latDms, lonDms } = this.degreesToDms(latitude, longitude);

    // Layout settings - 3 baris system dengan font consistency
    const geotagWidth = 600;
    const mapAreaWidth = mapMetadata.width;
    const mapAreaHeight = mapMetadata.height;
    const textSectionWidth = geotagWidth - mapAreaWidth;

    // Font settings - konsisten tanpa bold seperti Google Maps
    // const baseFontSize = 11; // Reserved for future font scaling
    const headerFontSize = 17;
    const coordLabelFontSize = 17;
    const coordValueFontSize = 17;
    const datetimeFontSize = 17;

    const textPadding = 15; // Margin kembali ke 15px untuk tampilan rapi
    const lineSpacing = 4;
    const sectionSpacing = 5;

    // Smart alamat layout: 1 atau 2 baris otomatis dengan center alignment
    const availableWidth = textSectionWidth - 2 * textPadding;
    const optimalFontSize = 10; // Font size yang comfortable untuk dibaca
    const charWidthRatio = 0.6; // Character width estimation
    const maxCharsPerLine = Math.floor(
      (availableWidth * 0.95) / (optimalFontSize * charWidthRatio)
    );

    const addressText = rawAddress.trim();
    let addressLines: string[] = [];
    let addressFontSize = optimalFontSize;

    if (addressText.length <= maxCharsPerLine) {
      // Alamat pendek → 1 baris dengan font bisa lebih besar
      addressLines = [addressText];
      const maxWidth = availableWidth * 0.95;
      const calculatedFontSize = maxWidth / (addressText.length * charWidthRatio);
      addressFontSize = Math.min(14, Math.max(8, calculatedFontSize));
    } else {
      // Alamat panjang → 2 baris dengan font optimal
      addressFontSize = optimalFontSize;
      const midPoint = Math.floor(addressText.length / 2);

      // Cari titik split yang bagus (space atau comma terdekat dari midpoint)
      let splitPoint = midPoint;
      for (let i = midPoint - 10; i <= midPoint + 10 && i < addressText.length; i++) {
        if (addressText[i] === ',' || addressText[i] === ' ') {
          splitPoint = i;
          break;
        }
      }

      const line1 = addressText.substring(0, splitPoint).trim();
      const line2 = addressText.substring(splitPoint + 1).trim();
      addressLines = [line1, line2];
    }

    // Debug logging
    this.logger.info('Smart address layout calculation', {
      addressLength: addressText.length,
      maxCharsPerLine,
      linesUsed: addressLines.length,
      fontSize: addressFontSize.toFixed(1),
      line1Length: addressLines[0]?.length || 0,
      line2Length: addressLines[1]?.length || 0,
      addressText: addressText.substring(0, 50) + '...',
    });

    // BARIS 1: Area Alamat (1 atau 2 baris, center aligned)
    const addressHeight = addressLines.length * (addressFontSize + lineSpacing) + textPadding * 2;

    // BARIS 3: Area DateTime (Fixed Height)
    const datetimeHeight = datetimeFontSize + textPadding * 2;

    // BARIS 2: Area Koordinat Table (Remaining space)
    const coordTableHeight = Math.max(80, mapAreaHeight - addressHeight - datetimeHeight);

    // Total height calculation
    const calculatedTextHeight = addressHeight + coordTableHeight + datetimeHeight;
    const geotagHeight = Math.max(mapAreaHeight, calculatedTextHeight);

    const svgTextElements: string[] = [];

    // ========================
    // BARIS 1: AREA ALAMAT (1-2 Baris, Center Aligned)
    // ========================
    const addressCenterX = textSectionWidth / 2; // Center horizontal position
    const currentAddressY = textPadding + addressFontSize;

    addressLines.forEach((line, index) => {
      const yPosition = currentAddressY + index * (addressFontSize + lineSpacing);
      svgTextElements.push(
        `<text x="${addressCenterX}" y="${yPosition}" class="address" text-anchor="middle">${this.escapeXml(line)}</text>`
      );
    });

    // ========================
    // BARIS 2: AREA KOORDINAT TABLE (3x3 Grid)
    // ========================
    const tableStartY = addressHeight + sectionSpacing;
    const tableWidth = textSectionWidth - 2 * textPadding;
    const colWidth = tableWidth / 3;
    const rowHeight = coordTableHeight / 3;

    // Table grid lines (3x3)
    // Horizontal lines (4 lines for 3 rows)
    for (let i = 0; i <= 3; i++) {
      const y = tableStartY + i * rowHeight;
      svgTextElements.push(
        `<line x1="${textPadding}" y1="${y}" x2="${textSectionWidth - textPadding}" y2="${y}" class="table-line"/>`
      );
    }

    // Vertical lines (4 lines for 3 columns)
    for (let i = 0; i <= 3; i++) {
      const x = textPadding + i * colWidth;
      svgTextElements.push(
        `<line x1="${x}" y1="${tableStartY}" x2="${x}" y2="${tableStartY + coordTableHeight}" class="table-line"/>`
      );
    }

    // Table content positioning
    const col1CenterX = textPadding + colWidth / 2;
    const col2CenterX = textPadding + colWidth + colWidth / 2;
    const col3CenterX = textPadding + 2 * colWidth + colWidth / 2;

    // Row 1: Header (kosong, "Decimal", "DMS")
    const row1Y = tableStartY + rowHeight / 2 + headerFontSize / 3;
    svgTextElements.push(
      `<text x="${col2CenterX}" y="${row1Y}" class="header" text-anchor="middle">Decimal</text>`
    );
    svgTextElements.push(
      `<text x="${col3CenterX}" y="${row1Y}" class="header" text-anchor="middle">DMS</text>`
    );

    // Row 2: Latitude
    const row2Y = tableStartY + rowHeight + rowHeight / 2 + coordValueFontSize / 3;
    svgTextElements.push(
      `<text x="${col1CenterX}" y="${row2Y}" class="coord-label" text-anchor="middle">Latitude</text>`
    );
    svgTextElements.push(
      `<text x="${col2CenterX}" y="${row2Y}" class="coord-value" text-anchor="middle">${this.escapeXml(latitude.toFixed(6))}</text>`
    );
    svgTextElements.push(
      `<text x="${col3CenterX}" y="${row2Y}" class="coord-value" text-anchor="middle">${this.escapeXml(latDms)}</text>`
    );

    // Row 3: Longitude
    const row3Y = tableStartY + 2 * rowHeight + rowHeight / 2 + coordValueFontSize / 3;
    svgTextElements.push(
      `<text x="${col1CenterX}" y="${row3Y}" class="coord-label" text-anchor="middle">Longitude</text>`
    );
    svgTextElements.push(
      `<text x="${col2CenterX}" y="${row3Y}" class="coord-value" text-anchor="middle">${this.escapeXml(longitude.toFixed(6))}</text>`
    );
    svgTextElements.push(
      `<text x="${col3CenterX}" y="${row3Y}" class="coord-value" text-anchor="middle">${this.escapeXml(lonDms)}</text>`
    );

    // ========================
    // BARIS 3: AREA DATETIME (Center Aligned)
    // ========================
    const datetimeY = geotagHeight - textPadding;
    const datetimeX = textSectionWidth / 2; // Center horizontal
    svgTextElements.push(
      `<text x="${datetimeX}" y="${datetimeY}" class="datetime" text-anchor="middle">${this.escapeXml(dateTimeString)}</text>`
    );

    const textSvg = `
      <svg width="${textSectionWidth}" height="${geotagHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .address { font-family: Arial, sans-serif; font-size: ${Math.round(addressFontSize)}px; font-weight: normal; fill: #FFFFFF; }
          .header { font-family: Arial, sans-serif; font-size: ${headerFontSize}px; font-weight: normal; fill: #FFFFFF; }
          .coord-label { font-family: Arial, sans-serif; font-size: ${coordLabelFontSize}px; font-weight: normal; fill: #FFFFFF; }
          .coord-value { font-family: Arial, sans-serif; font-size: ${coordValueFontSize}px; font-weight: normal; fill: #FFFFFF; }
          .datetime { font-family: Arial, sans-serif; font-size: ${datetimeFontSize}px; font-weight: normal; fill: #FFFFFF; }
          .table-line { stroke: #FFFFFF; stroke-width: 0.6; opacity: 0.9; }
        </style>
        ${svgTextElements.join('\n')}
      </svg>
    `;
    const textImageBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();

    return sharp({
      create: {
        width: geotagWidth,
        height: geotagHeight,
        channels: 4,
        background: { r: 140, g: 138, b: 141, alpha: 1 },
      },
    })
      .composite([
        {
          input: mapTileBuffer,
          gravity: 'northwest',
          top: Math.floor((geotagHeight - mapAreaHeight) / 2),
          left: 0,
        },
        { input: textImageBuffer, gravity: 'northeast', top: 0, left: mapAreaWidth },
      ])
      .png()
      .toBuffer();
  }

  private async overlayGeotagOnPhoto(photoBuffer: Buffer, geotagBuffer: Buffer): Promise<Buffer> {
    const mainImage = sharp(photoBuffer);
    const mainMetadata = await mainImage.metadata();
    if (!mainMetadata.width) {
      throw new Error('Tidak dapat membaca metadata lebar gambar utama.');
    }
    const resizedGeotagBuffer = await sharp(geotagBuffer)
      .resize({ width: mainMetadata.width })
      .toBuffer();
    return mainImage
      .composite([{ input: resizedGeotagBuffer, gravity: 'south' }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  private async processBatchPhotosWithGeotag(
    ctx: GeotagsContext,
    photoFileIds: string[],
    location: { latitude: number; longitude: number },
    customDateTime?: Date
  ) {
    if (!photoFileIds || photoFileIds.length === 0) return;

    let processingMessage;
    try {
      processingMessage = await ctx.reply(
        `⏳ Memproses ${photoFileIds.length} foto... Mohon tunggu sebentar.`
      );

      const telegramId = ctx.from!.id.toString();

      // Process all photos one by one and send immediately
      let successCount = 0;
      for (let i = 0; i < photoFileIds.length; i++) {
        const photoFileId = photoFileIds[i];
        try {
          const timestamp = Date.now();
          const filename = `geotag_batch_${i}_${timestamp}.jpg`;

          const photoPath = await this.getImageFileForGeotags(photoFileId, filename, ctx);
          const photoBuffer = await fs.readFile(photoPath);

          const geotagBuffer = await this.generateGeotagImage(
            location.latitude,
            location.longitude,
            customDateTime
          );
          const finalImageBuffer = await this.overlayGeotagOnPhoto(photoBuffer, geotagBuffer);

          // Send photo immediately without caption
          await ctx.replyWithPhoto({ source: finalImageBuffer });
          successCount++;
        } catch (error) {
          this.logger.error(`Error processing photo ${i + 1}/${photoFileIds.length}:`, error);
        }
      }

      if (processingMessage) {
        ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id).catch(() => {});
      }

      // Send summary message
      if (successCount === photoFileIds.length) {
        await ctx.reply(`✅ Berhasil memproses ${successCount} foto dengan geotag.`);
      } else {
        await ctx.reply(`⚠️ Berhasil memproses ${successCount} dari ${photoFileIds.length} foto.`);
      }

      // Record successful batch activity
      await this.recordActivity({
        userId: ctx.user!.id,
        telegramId,
        action: 'generate_batch_geotag',
        mode: 'geotags',
        details: {
          latitude: location.latitude,
          longitude: location.longitude,
          hasCustomDateTime: !!customDateTime,
          photoCount: photoFileIds.length,
          processedCount: successCount,
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('Error processing batch geotag images:', error);
      await ctx.reply(`❌ Maaf, terjadi kesalahan saat memproses ${photoFileIds.length} foto.`);

      if (processingMessage) {
        ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id).catch(() => {});
      }

      // Record failed batch activity
      await this.recordActivity({
        userId: ctx.user!.id,
        telegramId: ctx.from!.id.toString(),
        action: 'generate_batch_geotag',
        mode: 'geotags',
        details: {
          latitude: location.latitude,
          longitude: location.longitude,
          photoCount: photoFileIds.length,
          error: (error as Error).message,
        },
        success: false,
        errorMessage: (error as Error).message,
      });
    }
  }

  private async processPhotoWithGeotag(
    ctx: GeotagsContext,
    photoFileId: string,
    location: { latitude: number; longitude: number },
    customDateTime?: Date
  ) {
    let processingMessage;
    try {
      processingMessage = await ctx.reply('⏳ Memproses gambar Anda... Mohon tunggu sebentar.');

      const telegramId = ctx.from!.id.toString();

      // Get image file using LocalFileService
      const timestamp = Date.now();
      const filename = `geotag_${timestamp}.jpg`;

      const photoPath = await this.getImageFileForGeotags(photoFileId, filename, ctx);
      const photoBuffer = await fs.readFile(photoPath);

      const geotagBuffer = await this.generateGeotagImage(
        location.latitude,
        location.longitude,
        customDateTime
      );
      const finalImageBuffer = await this.overlayGeotagOnPhoto(photoBuffer, geotagBuffer);

      await ctx.replyWithPhoto({ source: finalImageBuffer });

      if (processingMessage) {
        ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id).catch(() => {});
      }

      // Record successful activity
      await this.recordActivity({
        userId: ctx.user!.id,
        telegramId,
        action: 'generate_geotag',
        mode: 'geotags',
        details: {
          latitude: location.latitude,
          longitude: location.longitude,
          hasCustomDateTime: !!customDateTime,
          photoFileId,
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('Error processing geotag image:', error);
      await ctx.reply('❌ Maaf, terjadi kesalahan saat memproses gambar Anda.');

      if (processingMessage) {
        ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id).catch(() => {});
      }

      // Record failed activity
      await this.recordActivity({
        userId: ctx.user!.id,
        telegramId: ctx.from!.id.toString(),
        action: 'generate_geotag',
        mode: 'geotags',
        details: {
          latitude: location.latitude,
          longitude: location.longitude,
          photoFileId,
          error: (error as Error).message,
        },
        success: false,
        errorMessage: (error as Error).message,
      });
    }
  }

  private async getImageFileForGeotags(
    fileId: string,
    filename: string,
    ctx: GeotagsContext
  ): Promise<string> {
    try {
      const telegramId = ctx.from!.id.toString();

      // Try local copy first (more efficient)
      if (await this.localFileService.isLocalModeAvailable()) {
        this.logger.info('Using local file copy mode for geotags', { fileId });

        const fileInfo = await ctx.telegram.getFile(fileId);
        const localFileResult = await this.localFileService.copyFileToUserDirectory(
          fileId,
          fileInfo.file_path!,
          telegramId,
          'geotags'
        );

        if (localFileResult.success) {
          this.logger.info('File copied locally for geotags successfully', {
            fileName: localFileResult.fileName,
            size: localFileResult.size,
          });

          return localFileResult.localPath!;
        } else {
          this.logger.warn(`Local copy failed, fallback to HTTP: ${localFileResult.error}`);
        }
      }

      // Fallback to HTTP download
      this.logger.info('Using HTTP download for geotags', { fileId });

      const fileLink = await ctx.telegram.getFileLink(fileId);

      // Create user feature directory
      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = await createUserFeatureDir(baseDir, telegramId, 'geotags');
      const fullPath = path.join(userDir, filename);

      // Download directly to target path
      await this.downloadImage(fileLink.href, fullPath);

      // Verify downloaded file
      const downloadedStats = await fs.stat(fullPath);
      this.logger.info('Direct downloaded file stats for geotags', {
        fullPath,
        size: downloadedStats.size,
      });

      if (downloadedStats.size > 0) {
        this.logger.info('Direct HTTP download completed successfully for geotags');
        return fullPath;
      } else {
        throw new Error('Direct downloaded file is empty for geotags');
      }
    } catch (error) {
      this.logger.error('Error getting image file for geotags', { error, fileId });
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

  /**
   * Record user activity
   */
  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'geotags';
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
