import winston from 'winston';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { AuthContext } from '../types/auth';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';
import { Telegraf } from 'telegraf';
import { SessionManager } from '../services/session-manager';

interface KmlContext extends AuthContext {}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface NamedPoint extends GeoPoint {
  name: string;
  timestamp: number;
}

interface LineTrack {
  name: string;
  coordinates: GeoPoint[];
  timestamp: number;
}

interface UserKmlData {
  placemarks: NamedPoint[];
  lines: LineTrack[];
  activeLine?: {
    name: string;
    points: GeoPoint[];
  } | null;
  persistentPointName?: string | null;
}

export class KmlHandler {
  private logger: winston.Logger;
  private backendUrl: string;
  private userKmlDataMap = new Map<string, UserKmlData>();
  private nextPointNameMap = new Map<string, string>();
  private bot: Telegraf;
  private sessionManager: SessionManager;
  private uploadDir: string;

  constructor(bot: Telegraf, logger: winston.Logger) {
    this.bot = bot;
    this.logger = logger.child({ module: 'KMLHandler' });
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    this.sessionManager = new SessionManager(this.logger);
    this.uploadDir = '/tmp/kml-uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async handleKmlCommand(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      ctx.setUserMode?.('kml');
      this.loadUserKmlData(telegramId);

      await ctx.reply(
        '🗺️ **Mode KML Diaktifkan**\n\n' +
          '**Perintah yang tersedia:**\n\n' +
          '📍 **Titik Individual:**\n' +
          '• Kirim **Lokasi** (via attachment) - Menambahkan titik\n' +
          '• `/add <lat> <lon> [nama_titik]` - Menambahkan titik via teks\n' +
          '• `/addpoint <nama_titik>` - Menetapkan nama untuk satu titik berikutnya\n' +
          '• `/alwayspoint [nama_titik]` - Menetapkan nama default tetap\n\n' +
          '〰️ **Garis/Jalur:**\n' +
          '• `/startline [nama_garis]` - Memulai pembuatan garis\n' +
          '• `/endline` - Menyimpan garis aktif\n' +
          '• `/cancelline` - Membatalkan garis aktif\n\n' +
          '💾 **Data & KML:**\n' +
          '• `/mydata` - Menampilkan semua data tersimpan\n' +
          '• `/createkml [nama_dokumen]` - Membuat file KML\n' +
          '• `/cleardata` - Menghapus SEMUA data Anda\n\n' +
          'Ketik `/menu` untuk kembali ke menu utama.',
        { parse_mode: 'Markdown' }
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'activate_kml_mode',
        mode: 'kml',
        success: true,
      });
    } catch (error) {
      this.logger.error('KML command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat mengaktifkan mode KML.');
    }
  }

  async handleAddCommand(ctx: KmlContext, lat?: string, lon?: string, name?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      if (!lat || !lon) {
        await ctx.reply(
          'Silakan masukkan koordinat yang valid.\nContoh: `/add -7.250445 112.768845 Rumah Saya`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        await ctx.reply('❌ Koordinat tidak valid atau di luar jangkauan.');
        return;
      }

      const userData = this.loadUserKmlData(telegramId);

      if (userData.activeLine) {
        userData.activeLine.points.push({ latitude, longitude });
        this.saveUserKmlData(telegramId, userData);

        let messageText = `↪️ Titik (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}) via teks ditambahkan ke garis "${this.escapeXml(userData.activeLine.name)}". Total ${userData.activeLine.points.length} titik.`;

        if (name) {
          messageText += ` (Nama "${this.escapeXml(name)}" dari perintah /add diabaikan).`;
        }

        await ctx.reply(messageText);
      } else {
        let finalPointName: string;

        if (name) {
          finalPointName = name;
        } else {
          const pointNameFromMap = this.nextPointNameMap.get(telegramId);

          if (pointNameFromMap) {
            finalPointName = pointNameFromMap;
            this.nextPointNameMap.delete(telegramId);
          } else if (userData.persistentPointName) {
            finalPointName = userData.persistentPointName;
          } else {
            finalPointName = `Koordinat Manual ${userData.placemarks.length + 1}`;
          }
        }

        userData.placemarks.push({
          latitude,
          longitude,
          name: finalPointName,
          timestamp: Date.now(),
        });

        this.saveUserKmlData(telegramId, userData);

        await ctx.reply(
          `📍 Titik individual "${this.escapeXml(finalPointName)}" (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}) via teks telah disimpan!`
        );
      }

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'add_point_text',
        mode: 'kml',
        details: { latitude, longitude, name, isActiveLine: !!userData.activeLine },
        success: true,
      });
    } catch (error) {
      this.logger.error('Add command failed', { error, lat, lon, name });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /add.');
    }
  }

  async handleAddPointCommand(ctx: KmlContext, pointName?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      if (!pointName) {
        await ctx.reply('Gunakan format: `/addpoint <nama_titik>`', { parse_mode: 'Markdown' });
        return;
      }

      this.nextPointNameMap.set(telegramId, pointName);
      await ctx.reply(
        `📝 Nama "${this.escapeXml(pointName)}" akan digunakan untuk **titik individual berikutnya** (jika tidak ada garis aktif & tidak ada nama di /add).`,
        { parse_mode: 'Markdown' }
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'set_next_point_name',
        mode: 'kml',
        details: { pointName },
        success: true,
      });
    } catch (error) {
      this.logger.error('AddPoint command failed', { error, pointName });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /addpoint.');
    }
  }

  async handleAlwaysPointCommand(ctx: KmlContext, persistentName?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);

      if (!persistentName) {
        userData.persistentPointName = null;
        this.saveUserKmlData(telegramId, userData);
        await ctx.reply('🔄 Nama default tetap untuk titik telah dihapus.');
      } else {
        userData.persistentPointName = persistentName;
        this.saveUserKmlData(telegramId, userData);
        await ctx.reply(
          `🔗 Nama "${this.escapeXml(persistentName)}" ditetapkan sebagai **nama default tetap** untuk semua titik individual (jika tidak ada nama dari /add atau /addpoint).`,
          { parse_mode: 'Markdown' }
        );
      }

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'set_persistent_point_name',
        mode: 'kml',
        details: { persistentName },
        success: true,
      });
    } catch (error) {
      this.logger.error('AlwaysPoint command failed', { error, persistentName });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /alwayspoint.');
    }
  }

  async handleStartLineCommand(ctx: KmlContext, lineName?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);

      if (userData.activeLine) {
        await ctx.reply(
          `⚠️ Anda sudah memiliki garis aktif: "${this.escapeXml(userData.activeLine.name)}". Selesaikan atau batalkan terlebih dahulu.`
        );
        return;
      }

      const finalLineName = lineName || `Garis ${userData.lines.length + 1}`;
      userData.activeLine = {
        name: finalLineName,
        points: [],
      };

      this.saveUserKmlData(telegramId, userData);

      await ctx.reply(
        `🆕 Garis "${this.escapeXml(finalLineName)}" dimulai! Kirim lokasi atau gunakan /add untuk menambahkan titik-titik ke garis.`
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_line',
        mode: 'kml',
        details: { lineName: finalLineName },
        success: true,
      });
    } catch (error) {
      this.logger.error('StartLine command failed', { error, lineName });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /startline.');
    }
  }

  async handleEndLineCommand(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);

      if (!userData.activeLine) {
        await ctx.reply('❌ Tidak ada garis aktif. Gunakan /startline terlebih dahulu.');
        return;
      }

      if (userData.activeLine.points.length < 2) {
        await ctx.reply(
          `❌ Garis "${this.escapeXml(userData.activeLine.name)}" hanya memiliki ${userData.activeLine.points.length} titik. Minimal 2 titik diperlukan untuk menyimpan garis.`
        );
        return;
      }

      userData.lines.push({
        name: userData.activeLine.name,
        coordinates: [...userData.activeLine.points],
        timestamp: Date.now(),
      });

      const savedLineName = userData.activeLine.name;
      const pointCount = userData.activeLine.points.length;
      userData.activeLine = null;

      this.saveUserKmlData(telegramId, userData);

      await ctx.reply(
        `✅ Garis "${this.escapeXml(savedLineName)}" dengan ${pointCount} titik telah disimpan!`
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'end_line',
        mode: 'kml',
        details: { lineName: savedLineName, pointCount },
        success: true,
      });
    } catch (error) {
      this.logger.error('EndLine command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /endline.');
    }
  }

  async handleCancelLineCommand(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);

      if (!userData.activeLine) {
        await ctx.reply('❌ Tidak ada garis aktif untuk dibatalkan.');
        return;
      }

      const canceledLineName = userData.activeLine.name;
      const pointCount = userData.activeLine.points.length;
      userData.activeLine = null;

      this.saveUserKmlData(telegramId, userData);

      await ctx.reply(
        `🗑️ Garis aktif "${this.escapeXml(canceledLineName)}" dengan ${pointCount} titik telah dibatalkan/dihapus.`
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'cancel_line',
        mode: 'kml',
        details: { lineName: canceledLineName, pointCount },
        success: true,
      });
    } catch (error) {
      this.logger.error('CancelLine command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /cancelline.');
    }
  }

  async handleMyDataCommand(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);
      let response = '📊 **Data KML Anda:**\n\n';
      let hasData = false;

      if (userData.placemarks && userData.placemarks.length > 0) {
        hasData = true;
        response += `📍 **Titik Individual (${userData.placemarks.length}):**\n`;
        userData.placemarks.forEach((point, index) => {
          response += `${index + 1}. "${this.escapeXml(point.name)}" (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})\n`;
        });
        response += '\n';
      }

      if (userData.lines && userData.lines.length > 0) {
        hasData = true;
        response += `〰️ **Garis Tersimpan (${userData.lines.length}):**\n`;
        userData.lines.forEach((line, index) => {
          response += `${index + 1}. "${this.escapeXml(line.name)}" dengan ${line.coordinates.length} titik\n`;
        });
        response += '\n';
      }

      if (userData.activeLine) {
        hasData = true;
        response += `🔄 **Garis Aktif:** "${this.escapeXml(userData.activeLine.name)}" (${userData.activeLine.points.length} titik)\n\n`;
      }

      if (userData.persistentPointName) {
        response += `🔗 **Nama Default Tetap:** "${this.escapeXml(userData.persistentPointName)}"\n\n`;
      }

      if (!hasData) {
        response += 'Anda belum menyimpan data apapun atau mengatur nama default tetap.';
      }

      await ctx.reply(response, { parse_mode: 'Markdown' });

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'view_data',
        mode: 'kml',
        success: true,
      });
    } catch (error) {
      this.logger.error('MyData command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /mydata.');
    }
  }

  async handleCreateKmlCommand(ctx: KmlContext, docName?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const userData = this.loadUserKmlData(telegramId);
      const userFirstName = ctx.from?.first_name || ctx.from?.username || 'Pengguna';

      const hasPlacemarks = userData.placemarks && userData.placemarks.length > 0;
      const hasLines = userData.lines && userData.lines.length > 0;
      const hasActiveValidLine = userData.activeLine && userData.activeLine.points.length >= 2;

      if (!hasPlacemarks && !hasLines && !hasActiveValidLine) {
        await ctx.reply(
          'Anda belum menyimpan data (titik atau garis yang valid) untuk dibuat KML.'
        );
        return;
      }

      const finalDocName = docName || `KML Data - ${userFirstName}`;
      const kmlContent = this.createKmlContent(userData, finalDocName);

      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = await createUserFeatureDir(baseDir, telegramId, 'kml');

      // Gunakan nama dari parameter untuk nama file, sanitasi untuk nama file yang aman
      const sanitizedName = docName
        ? docName
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
        : `kml_data_${userFirstName
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()}`;
      const fileName = `${sanitizedName}_${Date.now()}.kml`;
      const filePath = path.join(userDir, fileName);

      await fs.writeFile(filePath, kmlContent);

      await ctx.replyWithDocument(
        { source: filePath },
        {
          caption:
            `📄 File KML "${this.escapeXml(finalDocName)}" berhasil dibuat, ${userFirstName}!\n\n` +
            `📂 Nama file: \`${fileName}\``,
        }
      );

      await fs.unlink(filePath);

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'create_kml',
        mode: 'kml',
        details: {
          docName: finalDocName,
          fileName,
          placemarksCount: userData.placemarks.length,
          linesCount: userData.lines.length,
          hasActiveLine: !!userData.activeLine,
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('CreateKml command failed', { error, docName });
      await ctx.reply('❌ Terjadi kesalahan saat membuat atau mengirim file KML.');
    }
  }

  async handleClearDataCommand(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      this.saveUserKmlData(telegramId, this.defaultUserKmlData());
      this.nextPointNameMap.delete(telegramId);

      await ctx.reply(
        '🗑️ Semua data KML Anda (titik, garis, sesi garis aktif, dan nama default tetap) telah dihapus.'
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'clear_data',
        mode: 'kml',
        success: true,
      });
    } catch (error) {
      this.logger.error('ClearData command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses perintah /cleardata.');
    }
  }

  async handleLocation(ctx: KmlContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'kml') return;

      const message = ctx.message as any;
      if (!message.location) return;

      const { latitude, longitude } = message.location;
      const userData = this.loadUserKmlData(telegramId);

      if (userData.activeLine) {
        userData.activeLine.points.push({ latitude, longitude });
        this.saveUserKmlData(telegramId, userData);

        await ctx.reply(
          `↪️ Titik (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}) ditambahkan ke garis "${this.escapeXml(userData.activeLine.name)}". Total ${userData.activeLine.points.length} titik.`
        );
      } else {
        let pointName: string;
        const pointNameFromMap = this.nextPointNameMap.get(telegramId);

        if (pointNameFromMap) {
          pointName = pointNameFromMap;
          this.nextPointNameMap.delete(telegramId);
        } else if (userData.persistentPointName) {
          pointName = userData.persistentPointName;
        } else {
          pointName = `Titik Terlampir ${userData.placemarks.length + 1}`;
        }

        userData.placemarks.push({
          latitude,
          longitude,
          name: pointName,
          timestamp: Date.now(),
        });

        this.saveUserKmlData(telegramId, userData);

        await ctx.reply(
          `📍 Lokasi individual "${this.escapeXml(pointName)}" (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}) telah disimpan!`
        );
      }

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'add_point_location',
        mode: 'kml',
        details: { latitude, longitude, isActiveLine: !!userData.activeLine },
        success: true,
      });
    } catch (error) {
      this.logger.error('Location handling failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses lokasi.');
    }
  }

  private defaultUserKmlData(): UserKmlData {
    return {
      placemarks: [],
      lines: [],
      activeLine: null,
      persistentPointName: null,
    };
  }

  private loadUserKmlData(telegramId: string): UserKmlData {
    if (this.userKmlDataMap.has(telegramId)) {
      return this.userKmlDataMap.get(telegramId)!;
    }

    try {
      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = path.join(baseDir, telegramId, 'kml');
      const storagePath = path.join(userDir, 'kml_data.json');

      if (!fs.existsSync(storagePath)) {
        const defaultData = this.defaultUserKmlData();
        this.userKmlDataMap.set(telegramId, defaultData);
        return defaultData;
      }

      const data = fs.readFileSync(storagePath, 'utf-8');
      const userData: UserKmlData = JSON.parse(data);

      const completeUserData = { ...this.defaultUserKmlData(), ...userData };
      this.userKmlDataMap.set(telegramId, completeUserData);

      return completeUserData;
    } catch (error) {
      this.logger.error('Failed to load KML data', { error, telegramId });
      const defaultData = this.defaultUserKmlData();
      this.userKmlDataMap.set(telegramId, defaultData);
      return defaultData;
    }
  }

  private saveUserKmlData(telegramId: string, kmlData: UserKmlData): void {
    try {
      this.userKmlDataMap.set(telegramId, kmlData);

      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = path.join(baseDir, telegramId, 'kml');

      fs.ensureDirSync(userDir);

      const storagePath = path.join(userDir, 'kml_data.json');
      fs.writeFileSync(storagePath, JSON.stringify(kmlData, null, 2));
    } catch (error) {
      this.logger.error('Failed to save KML data', { error, telegramId });
    }
  }

  private escapeXml(unsafe: string | undefined | null): string {
    if (typeof unsafe !== 'string') {
      return '';
    }
    return unsafe.replace(/[<>&'"]/g, c => {
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

  private createKmlContent(userData: UserKmlData, docName: string = 'Data KML Pengguna'): string {
    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXml(docName)}</name>
    <description>File KML yang dibuat oleh TeleWeb Bot</description>
`;

    // Add individual placemarks
    if (userData.placemarks && userData.placemarks.length > 0) {
      userData.placemarks.forEach(placemark => {
        kmlContent += `    <Placemark>
      <name>${this.escapeXml(placemark.name)}</name>
      <Point>
        <coordinates>${placemark.longitude},${placemark.latitude},0</coordinates>
      </Point>
    </Placemark>
`;
      });
    }

    // Add saved lines
    if (userData.lines && userData.lines.length > 0) {
      userData.lines.forEach(line => {
        const coordinatesString = line.coordinates
          .map(coord => `${coord.longitude},${coord.latitude},0`)
          .join(' ');

        kmlContent += `    <Placemark>
      <name>${this.escapeXml(line.name)}</name>
      <LineString>
        <coordinates>${coordinatesString}</coordinates>
      </LineString>
    </Placemark>
`;
      });
    }

    // Add active line if it has enough points
    if (userData.activeLine && userData.activeLine.points.length >= 2) {
      const coordinatesString = userData.activeLine.points
        .map(coord => `${coord.longitude},${coord.latitude},0`)
        .join(' ');

      kmlContent += `    <Placemark>
      <name>${this.escapeXml(userData.activeLine.name)} (Garis Aktif)</name>
      <LineString>
        <coordinates>${coordinatesString}</coordinates>
      </LineString>
    </Placemark>
`;
    }

    kmlContent += `  </Document>
</kml>`;

    return kmlContent;
  }

  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'kml';
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await axios.post(`${this.backendUrl}/activity/record`, data);
    } catch (error) {
      this.logger.error('Failed to record activity', { error, data });
    }
  }
}
