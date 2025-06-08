import winston from 'winston';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AuthContext } from '../types/auth';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';
import { LocalFileService } from '../services/local-file.service';

const execAsync = promisify(exec);

interface ArchiveContext extends AuthContext {}

interface UserArchiveState {
  mode: 'zip' | 'extract' | 'search' | null;
  files: string[];
  timestamp: number;
  searchPattern?: string;
  extractedDirs?: string[];
  searchResults?: string[];
}

interface UsageStats {
  zipCount: number;
  extractCount: number;
  searchCount: number;
  filesSent: number;
  filesReceived: number;
  lastUsed: number;
}

export class ArchiveHandler {
  private logger: winston.Logger;
  private backendUrl: string;
  private localFileService: LocalFileService;
  private userArchiveStates = new Map<string, UserArchiveState>();
  private userUsageStats = new Map<string, UsageStats>();

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    this.localFileService = new LocalFileService(logger);
  }

  async handleArchiveCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      ctx.setUserMode?.('archive');
      this.initUserArchiveState(telegramId);

      await ctx.reply(
        '📦 **Mode Archive Diaktifkan**\n\n' +
        '**Perintah yang tersedia:**\n\n' +
        '🗜️ **Kompres File:**\n' +
        '• `/zip` - Mulai mengompres file menjadi ZIP\n' +
        '• Kirim file yang ingin diarsipkan\n' +
        '• `/send` - Buat dan kirim file ZIP\n\n' +
        '📂 **Ekstrak Archive:**\n' +
        '• `/extract` - Mulai ekstraksi file arsip\n' +
        '• Kirim file ZIP/RAR yang ingin diekstrak\n' +
        '• `/send` - Ekstrak dan kirim semua file\n\n' +
        '🔍 **Cari dalam Archive:**\n' +
        '• `/search` - Mulai pencarian dalam arsip\n' +
        '• Kirim file ZIP/RAR untuk dicari isinya\n' +
        '• `/find <pola>` - Cari file dengan pola tertentu\n' +
        '• `/send_selected` - Kirim file yang ditemukan\n\n' +
        '📊 **Lainnya:**\n' +
        '• `/stats` - Statistik penggunaan\n' +
        'Ketik `/menu` untuk kembali ke menu utama.',
        { parse_mode: 'Markdown' }
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'activate_archive_mode',
        mode: 'archive',
        success: true,
      });

    } catch (error) {
      this.logger.error('Archive command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat mengaktifkan mode Archive.');
    }
  }

  async handleZipCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      this.initUserArchiveState(telegramId, 'zip');
      await this.cleanupUserFiles(telegramId);

      await ctx.reply(
        '🗜️ **Mode ZIP dimulai!**\n\n' +
        'Silakan kirim file-file yang ingin Anda arsipkan. ' +
        'Setelah selesai mengirim semua file, ketik `/send` untuk membuat file ZIP.\n\n' +
        '💡 **Tips:** Anda bisa mengirim beberapa file sekaligus.'
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_zip_mode',
        mode: 'archive',
        success: true,
      });

    } catch (error) {
      this.logger.error('ZIP command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memulai mode ZIP.');
    }
  }

  async handleExtractCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      this.initUserArchiveState(telegramId, 'extract');
      await this.cleanupUserFiles(telegramId);

      await ctx.reply(
        '📂 **Mode Extract dimulai!**\n\n' +
        'Silakan kirim file arsip (ZIP atau RAR) yang ingin Anda ekstrak. ' +
        'Setelah selesai, ketik `/send` untuk mengekstrak semua file.\n\n' +
        '📝 **Format yang didukung:** ZIP, RAR'
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_extract_mode',
        mode: 'archive',
        success: true,
      });

    } catch (error) {
      this.logger.error('Extract command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memulai mode Extract.');
    }
  }

  async handleSearchCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      this.initUserArchiveState(telegramId, 'search');
      await this.cleanupUserFiles(telegramId);

      await ctx.reply(
        '🔍 **Mode Search dimulai!**\n\n' +
        'Silakan kirim file arsip (ZIP atau RAR) yang ingin Anda cari isinya. ' +
        'File akan diekstrak di server untuk persiapan pencarian.\n\n' +
        '**Langkah selanjutnya:**\n' +
        '1. Kirim file arsip\n' +
        '2. Ketik `/find <pola>` untuk mencari file\n' +
        '   Contoh: `/find *.jpg` atau `/find dokumen`\n' +
        '3. Ketik `/send_selected` untuk mengirim file yang ditemukan\n\n' +
        '📝 **Format yang didukung:** ZIP, RAR'
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_search_mode',
        mode: 'archive',
        success: true,
      });

    } catch (error) {
      this.logger.error('Search command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memulai mode Search.');
    }
  }

  async handleFindCommand(ctx: ArchiveContext, searchPattern?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      const archiveState = this.getUserArchiveState(telegramId);
      if (!archiveState || archiveState.mode !== 'search' || !archiveState.extractedDirs || archiveState.extractedDirs.length === 0) {
        await ctx.reply('Anda harus menggunakan `/search` dan mengirim file arsip terlebih dahulu.');
        return;
      }

      if (!searchPattern) {
        await ctx.reply('Format pencarian tidak valid. Gunakan: `/find <pola>`\nContoh: `/find *.pdf` atau `/find dokumen`');
        return;
      }

      archiveState.searchPattern = searchPattern;
      await ctx.reply(`🔍 Mencari file dengan pola: "${searchPattern}"`);

      // Get all files from extracted directories
      let allExtractedFiles: string[] = [];
      for (const dir of archiveState.extractedDirs) {
        allExtractedFiles = allExtractedFiles.concat(this.collectAllFiles(dir));
      }

      // Filter files based on search pattern
      const matchingFiles: string[] = [];
      
      for (const filePath of allExtractedFiles) {
        const fileName = path.basename(filePath);
        const baseDir = archiveState.extractedDirs.find(d => filePath.startsWith(d)) || archiveState.extractedDirs[0];
        const relativePath = path.relative(baseDir, filePath);
        
        let isMatch = false;
        
        if (searchPattern.includes('*')) {
          // Wildcard pattern matching
          const regexPattern = searchPattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
          const regex = new RegExp(regexPattern, 'i');
          
          isMatch = regex.test(fileName) || regex.test(relativePath);
        } else {
          // Simple text search (case-insensitive)
          isMatch = fileName.toLowerCase().includes(searchPattern.toLowerCase()) ||
                   relativePath.toLowerCase().includes(searchPattern.toLowerCase());
        }
        
        if (isMatch) {
          matchingFiles.push(filePath);
        }
      }

      // Store search results
      archiveState.searchResults = matchingFiles;

      // Update stats
      this.updateUserStats(telegramId, { searchCount: this.getUserStats(telegramId).searchCount + 1 });

      if (matchingFiles.length === 0) {
        await ctx.reply(`❌ Tidak ditemukan file yang cocok dengan pola: "${searchPattern}"`);
        return;
      }

      // Show search results
      let resultMessage = `✅ Ditemukan ${matchingFiles.length} file yang cocok dengan pola: "${searchPattern}"\n\n`;
      
      const maxDisplay = 20;
      const displayFiles = matchingFiles.slice(0, maxDisplay);
      
      for (let i = 0; i < displayFiles.length; i++) {
        const filePath = displayFiles[i];
        const baseDir = archiveState.extractedDirs.find(d => filePath.startsWith(d)) || archiveState.extractedDirs[0];
        const relativePath = path.relative(baseDir, filePath);
        const fileSize = fs.statSync(filePath).size;
        
        resultMessage += `${i + 1}. 📄 ${relativePath} (${this.formatFileSize(fileSize)})\n`;
      }
      
      if (matchingFiles.length > maxDisplay) {
        resultMessage += `\n... dan ${matchingFiles.length - maxDisplay} file lainnya.`;
      }
      
      resultMessage += `\n\n💡 Ketik \`/send_selected\` untuk mengirim semua file yang ditemukan.`;
      
      await ctx.reply(resultMessage);

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'search_files',
        mode: 'archive',
        details: { 
          searchPattern,
          totalFiles: allExtractedFiles.length,
          matchingFiles: matchingFiles.length
        },
        success: true,
      });

    } catch (error) {
      this.logger.error('Find command failed', { error, searchPattern });
      await ctx.reply('❌ Terjadi kesalahan saat mencari file.');
    }
  }

  async handleSendCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      const archiveState = this.getUserArchiveState(telegramId);
      if (!archiveState || !archiveState.mode || archiveState.mode === 'search') {
        if (!archiveState || !archiveState.mode) {
          await ctx.reply('Silakan gunakan `/zip`, `/extract`, atau `/search` terlebih dahulu untuk memulai proses.');
        } else if (archiveState.mode === 'search') {
          await ctx.reply('Mode search menggunakan auto-extract. Gunakan `/find <pola>` untuk mencari, lalu `/send_selected` untuk mengirim file yang ditemukan.');
        }
        return;
      }

      if (archiveState.files.length === 0) {
        await ctx.reply('Anda belum mengirimkan file apapun. Silakan kirim file terlebih dahulu.');
        return;
      }

      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = await createUserFeatureDir(baseDir, telegramId, 'archive');

      if (archiveState.mode === 'zip') {
        await this.processZipFiles(ctx, telegramId, archiveState, userDir);
      } else if (archiveState.mode === 'extract') {
        await this.processExtractFiles(ctx, telegramId, archiveState, userDir);
      }

    } catch (error) {
      this.logger.error('Send command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses file.');
    }
  }

  async handleSendSelectedCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      const archiveState = this.getUserArchiveState(telegramId);
      if (!archiveState || archiveState.mode !== 'search' || !archiveState.searchResults || archiveState.searchResults.length === 0) {
        await ctx.reply('Tidak ada file yang dipilih. Gunakan `/search`, kirim file arsip, lalu `/find <pola>` terlebih dahulu.');
        return;
      }

      const filesToSend = archiveState.searchResults;
      const totalFilesToSend = filesToSend.length;
      
      await ctx.reply(`📤 Mengirim ${totalFilesToSend} file yang dipilih...`);

      let sentFilesCount = 0;
      let failedFilesCount = 0;

      for (const filePath of filesToSend) {
        try {
          const fileName = path.basename(filePath);
          const baseDir = archiveState.extractedDirs?.find(d => filePath.startsWith(d)) || archiveState.extractedDirs?.[0] || '';
          const relativePath = path.relative(baseDir, filePath);
          const fileSize = fs.statSync(filePath).size;
          
          const caption = relativePath.includes(path.sep) 
            ? `🔍 ${relativePath} (${this.formatFileSize(fileSize)})`
            : `🔍 ${fileName} (${this.formatFileSize(fileSize)})`;
          
          await ctx.replyWithDocument({ source: filePath }, { caption });
          sentFilesCount++;
          
        } catch (error: any) {
          failedFilesCount++;
          const fileName = path.basename(filePath);
          this.logger.error('Error sending selected file', { 
            error: error.message, 
            fileName,
            filePath: path.basename(filePath)
          });
          // Don't send individual error messages to avoid spam
        }
      }

      // Update stats
      this.updateUserStats(telegramId, { 
        filesSent: this.getUserStats(telegramId).filesSent + sentFilesCount
      });

      const summaryMessage =
        '📋 **Pengiriman File Terpilih Selesai**\n\n' +
        `✅ File berhasil dikirim: ${sentFilesCount}\n` +
        `❌ File gagal dikirim: ${failedFilesCount}\n` +
        `📁 Total file yang diproses: ${totalFilesToSend}\n` +
        `🔍 Pola pencarian: ${archiveState.searchPattern || 'N/A'}`;

      await ctx.reply(summaryMessage, { parse_mode: 'Markdown' });

      // Reset search results
      archiveState.searchResults = [];

      // Record activity (don't let this fail the entire operation)
      try {
        await this.recordActivity({
          userId: ctx.user.id,
          telegramId,
          action: 'send_selected_files',
          mode: 'archive',
          details: { 
            sentCount: sentFilesCount,
            failedCount: failedFilesCount,
            searchPattern: archiveState.searchPattern
          },
          success: true,
        });
      } catch (recordError: any) {
        this.logger.error('Failed to record activity', { recordError: recordError.message });
      }

    } catch (error: any) {
      this.logger.error('Send selected command failed', { error: error.message });
      await ctx.reply('❌ Terjadi kesalahan saat mengirim file terpilih.');
    }
  }

  async handleStatsCommand(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      const stats = this.getUserStats(telegramId);
      const lastUsedDate = new Date(stats.lastUsed).toLocaleString('id-ID');
      
      await ctx.reply(
        '📊 **Statistik Penggunaan Fitur Archive**\n\n' +
        `🗜 Jumlah ZIP dibuat: ${stats.zipCount}\n` +
        `📂 Jumlah ekstraksi: ${stats.extractCount}\n` +
        `🔍 Jumlah pencarian: ${stats.searchCount}\n` +
        `📤 File dikirim ke bot: ${stats.filesReceived}\n` +
        `📥 File diterima dari bot: ${stats.filesSent}\n` +
        `🕒 Terakhir digunakan: ${lastUsedDate}`,
        { parse_mode: 'Markdown' }
      );

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'view_stats',
        mode: 'archive',
        success: true,
      });

    } catch (error) {
      this.logger.error('Stats command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil statistik.');
    }
  }



  async handleDocument(ctx: ArchiveContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'archive') return;

      const message = ctx.message as any;
      if (!message.document) return;

      const document = message.document;
      const archiveState = this.getUserArchiveState(telegramId);
      
      if (!archiveState || !archiveState.mode) {
        await ctx.reply('Silakan gunakan `/zip`, `/extract`, atau `/search` terlebih dahulu untuk memulai proses.');
        return;
      }

      // Validate file type for extract and search modes
      const fileExt = path.extname(document.file_name || '').toLowerCase();
      if ((archiveState.mode === 'extract' || archiveState.mode === 'search') && 
          fileExt !== '.zip' && fileExt !== '.rar') {
        await ctx.reply('Hanya file ZIP dan RAR yang dapat diekstrak atau dicari. Silakan kirim file dengan format yang benar.');
        return;
      }

      // Get file info from Telegram
      const fileInfo = await ctx.telegram.getFile(document.file_id);
      let filePath: string;

      // Try local copy first (more efficient)
      if (await this.localFileService.isLocalModeAvailable()) {
        this.logger.info('Using local file copy mode', { 
          fileId: document.file_id, 
          filePath: fileInfo.file_path 
        });
        
        const localFileResult = await this.localFileService.copyFileToUserDirectory(
          document.file_id,
          fileInfo.file_path!,
          telegramId,
          'archive'
        );
        
        if (localFileResult.success) {
          const originalFileName = document.file_name || `file${fileExt || ''}`;
          const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
          const userDir = await createUserFeatureDir(baseDir, telegramId, 'archive');
          
          // Create new path with original filename
          const timestamp = Date.now();
          const uniqueFileName = `${timestamp}_${originalFileName}`;
          filePath = path.join(userDir, uniqueFileName);
          
          // Copy to new location with original name
          await fs.copy(localFileResult.localPath!, filePath);
          
          // Cleanup temp file from LocalFileService
          try {
            await fs.remove(localFileResult.localPath!);
          } catch (cleanupError: any) {
            this.logger.warn('Failed to cleanup temp local file', {
              tempPath: localFileResult.localPath,
              error: cleanupError.message
            });
          }
          
          this.logger.info('File copied locally with original name', {
            filePath,
            originalName: originalFileName,
            size: localFileResult.size
          });
        } else {
          throw new Error(`Local copy failed: ${localFileResult.error}`);
        }
      } else {
        // Fallback to HTTP download
        this.logger.info('Local mode not available, using HTTP download', { 
          fileId: document.file_id 
        });
        
        const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
        const userDir = await createUserFeatureDir(baseDir, telegramId, 'archive');
        
        const timestamp = Date.now();
        const fileName = `${timestamp}_${document.file_name || `file${fileExt || ''}`}`;
        filePath = path.join(userDir, fileName);

        const botApiServer = process.env.BOT_API_SERVER;
        let fileUrl: string;
        
        if (botApiServer) {
          fileUrl = `${botApiServer}/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        } else {
          fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        }

        // Download the file
        const response = await axios.get(fileUrl, { responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', reject);
        });
      }

      // Add file to state
      this.addFileToArchiveState(telegramId, filePath);
      this.updateUserStats(telegramId, { filesReceived: this.getUserStats(telegramId).filesReceived + 1 });

      let responseMessage = '';
      
      if (archiveState.mode === 'zip') {
        responseMessage = `File "${document.file_name || 'tanpa nama'}" berhasil diterima. ` +
          `Total file: ${archiveState.files.length}. ` +
          `Ketik \`/send\` untuk membuat arsip.`;
      } else if (archiveState.mode === 'extract') {
        responseMessage = `File "${document.file_name || 'tanpa nama'}" berhasil diterima. ` +
          `Ketik \`/send\` untuk mengekstrak file.`;
      } else if (archiveState.mode === 'search') {
        responseMessage = `File "${document.file_name || 'tanpa nama'}" berhasil diterima. ` +
          `Mengekstrak file untuk pencarian...`;
          
        // Auto-extract for search mode
        await this.autoExtractForSearch(ctx, telegramId, filePath, path.dirname(filePath));
      }
      
      await ctx.reply(responseMessage);

      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'upload_file',
        mode: 'archive',
        details: { 
          fileName: document.file_name,
          fileSize: document.file_size,
          mode: archiveState.mode
        },
        success: true,
      });

    } catch (error) {
      this.logger.error('Document handling failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat menerima file.');
    }
  }

  private async processZipFiles(ctx: ArchiveContext, telegramId: string, archiveState: UserArchiveState, userDir: string) {
    await ctx.reply('🗜️ Membuat file ZIP dari file yang dikirim...');
    
    const timestamp = Date.now();
    const zipFileName = `archive_${timestamp}.zip`;
    const zipFilePath = path.join(userDir, zipFileName);
    
    // Create file list for zip command
    const fileList = archiveState.files.map(file => `"${path.basename(file)}"`).join(' ');
    
    // Execute zip command
    const cmd = `cd "${userDir}" && zip -j "${zipFileName}" ${fileList}`;
    await execAsync(cmd);
    
    // Update stats
    this.updateUserStats(telegramId, { 
      zipCount: this.getUserStats(telegramId).zipCount + 1,
      filesSent: this.getUserStats(telegramId).filesSent + 1
    });
    
    // Send the zip file
    await ctx.replyWithDocument({ source: zipFilePath }, {
      caption: `✅ File ZIP berhasil dibuat dengan ${archiveState.files.length} file.`
    });
    
    // Cleanup
    await this.cleanupUserFiles(telegramId, [zipFilePath]);
    fs.unlinkSync(zipFilePath);
    this.initUserArchiveState(telegramId);
    
    this.logger.info('ZIP file created and sent', { telegramId, fileCount: archiveState.files.length });
  }

  private async processExtractFiles(ctx: ArchiveContext, telegramId: string, archiveState: UserArchiveState, userDir: string) {
    const totalArchives = archiveState.files.length;
    await ctx.reply(`📂 Mengekstrak ${totalArchives} file arsip...`);
    
    let sentFilesCount = 0;
    let failedFilesCount = 0;
    let allFilesToSend: string[] = [];
    let extractedArchiveCount = 0;
    let failedArchiveCount = 0;
    
    for (let i = 0; i < archiveState.files.length; i++) {
      const archiveFile = archiveState.files[i];
      const fileExt = path.extname(archiveFile).toLowerCase();
      const archiveName = path.basename(archiveFile);
      
      // Progress update for multiple files
      if (totalArchives > 1) {
        await ctx.reply(`🔄 Memproses arsip ${i + 1}/${totalArchives}: ${archiveName}`);
      }
      
      // Create extraction directory
      const extractDir = path.join(userDir, `extracted_${Date.now()}_${i}`);
      fs.ensureDirSync(extractDir);
      
      // Determine extraction command
      let cmd = '';
      if (fileExt === '.zip') {
        cmd = `unzip -o "${archiveFile}" -d "${extractDir}"`;
      } else if (fileExt === '.rar') {
        cmd = `unrar x "${archiveFile}" "${extractDir}"`;
      } else {
        await ctx.reply(`❌ Format file tidak didukung: ${archiveName}`);
        failedArchiveCount++;
        continue;
      }
      
      try {
        await execAsync(cmd);
        const filesToSend = this.collectAllFiles(extractDir);
        allFilesToSend.push(...filesToSend);
        extractedArchiveCount++;
        
        this.logger.info('Archive extracted successfully', {
          archiveFile: archiveName,
          extractedFiles: filesToSend.length,
          extractDir
        });
        
        if (totalArchives > 1) {
          await ctx.reply(`✅ ${archiveName}: ${filesToSend.length} file diekstrak`);
        }
        
      } catch (execError) {
        this.logger.error('Extraction failed', { execError, cmd, archiveFile: archiveName });
        await ctx.reply(`❌ Gagal mengekstrak arsip: ${archiveName}`);
        failedArchiveCount++;
        continue;
      }
    }
    
    // Summary of extraction results
    await ctx.reply(
      `📊 **Hasil Ekstraksi:**\n\n` +
      `📁 Arsip berhasil diekstrak: ${extractedArchiveCount}/${totalArchives}\n` +
      `❌ Arsip gagal diekstrak: ${failedArchiveCount}/${totalArchives}\n` +
      `📄 Total file ditemukan: ${allFilesToSend.length}`,
      { parse_mode: 'Markdown' }
    );
    
    if (allFilesToSend.length === 0) {
      await ctx.reply('❌ Tidak ada file yang berhasil diekstrak dari semua arsip.');
      return;
    }
    
    await ctx.reply(`📤 Mengirim ${allFilesToSend.length} file...`);
    
    // Send all extracted files
    for (let i = 0; i < allFilesToSend.length; i++) {
      const filePath = allFilesToSend[i];
      
      try {
        const fileName = path.basename(filePath);
        const fileSize = fs.statSync(filePath).size;
        const progress = `(${i + 1}/${allFilesToSend.length})`;
        const caption = `📄 ${fileName} ${progress}\n📏 ${this.formatFileSize(fileSize)}`;
        
        await ctx.replyWithDocument({ source: filePath }, { caption });
        sentFilesCount++;
        
        // Progress update for large batches
        if (allFilesToSend.length > 10 && (i + 1) % 5 === 0) {
          await ctx.reply(`📤 Progress: ${i + 1}/${allFilesToSend.length} file terkirim...`);
        }
        
      } catch (error: any) {
        failedFilesCount++;
        this.logger.error('Error sending extracted file', { 
          error: error.message, 
          filePath: path.basename(filePath) 
        });
        
        // Don't spam user with individual file errors, log them instead
        if (failedFilesCount <= 3) {
          await ctx.reply(`⚠️ Gagal mengirim: ${path.basename(filePath)}`);
        }
      }
    }
    
    // Final summary
    await ctx.reply(
      `🎉 **Ekstraksi Selesai!**\n\n` +
      `📁 Arsip diproses: ${extractedArchiveCount}/${totalArchives}\n` +
      `📄 File ditemukan: ${allFilesToSend.length}\n` +
      `✅ File berhasil dikirim: ${sentFilesCount}\n` +
      `❌ File gagal dikirim: ${failedFilesCount}`,
      { parse_mode: 'Markdown' }
    );
    
    // Update stats
    this.updateUserStats(telegramId, { 
      extractCount: this.getUserStats(telegramId).extractCount + 1,
      filesSent: this.getUserStats(telegramId).filesSent + sentFilesCount
    });
    
    // Cleanup
    await this.cleanupUserFiles(telegramId);
    this.initUserArchiveState(telegramId);
  }

  private async autoExtractForSearch(ctx: ArchiveContext, telegramId: string, archiveFile: string, userDir: string) {
    try {
      const fileExt = path.extname(archiveFile).toLowerCase();
      
      // Create extraction directory
      const extractDir = path.join(userDir, `search_${Date.now()}`);
      fs.ensureDirSync(extractDir);
      
      // Determine extraction command
      let cmd = '';
      if (fileExt === '.zip') {
        cmd = `unzip -o "${archiveFile}" -d "${extractDir}"`;
      } else if (fileExt === '.rar') {
        cmd = `unrar x "${archiveFile}" "${extractDir}"`;
      } else {
        await ctx.reply('Format file tidak didukung untuk pencarian.');
        return;
      }
      
      await execAsync(cmd);
      
      // Update archive state with extracted directory
      const archiveState = this.getUserArchiveState(telegramId);
      if (archiveState) {
        if (!archiveState.extractedDirs) {
          archiveState.extractedDirs = [];
        }
        archiveState.extractedDirs.push(extractDir);
      }
      
      const extractedFiles = this.collectAllFiles(extractDir);
      await ctx.reply(
        `✅ File berhasil diekstrak untuk pencarian. ` +
        `Ditemukan ${extractedFiles.length} file. ` +
        `Gunakan \`/find <pola>\` untuk mencari file tertentu.`
      );
      
    } catch (error) {
      this.logger.error('Auto extraction for search failed', { error, archiveFile });
      await ctx.reply('❌ Gagal mengekstrak file untuk pencarian.');
    }
  }

  private initUserArchiveState(telegramId: string, mode: 'zip' | 'extract' | 'search' | null = null): void {
    this.userArchiveStates.set(telegramId, {
      mode,
      files: [],
      timestamp: Date.now(),
      extractedDirs: [],
      searchResults: []
    });
  }

  private getUserArchiveState(telegramId: string): UserArchiveState | undefined {
    return this.userArchiveStates.get(telegramId);
  }

  private addFileToArchiveState(telegramId: string, filePath: string): void {
    const state = this.getUserArchiveState(telegramId);
    if (state) {
      state.files.push(filePath);
      state.timestamp = Date.now();
    }
  }

  private getUserStats(telegramId: string): UsageStats {
    if (!this.userUsageStats.has(telegramId)) {
      this.userUsageStats.set(telegramId, {
        zipCount: 0,
        extractCount: 0,
        searchCount: 0,
        filesSent: 0,
        filesReceived: 0,
        lastUsed: Date.now()
      });
    }
    return this.userUsageStats.get(telegramId)!;
  }

  private updateUserStats(telegramId: string, update: Partial<UsageStats>): void {
    const stats = this.getUserStats(telegramId);
    Object.assign(stats, { ...update, lastUsed: Date.now() });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private collectAllFiles(dirPath: string, baseDir: string = dirPath): string[] {
    let allFiles: string[] = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively collect files from subdirectories
          const subFiles = this.collectAllFiles(fullPath, baseDir);
          allFiles = allFiles.concat(subFiles);
          
          this.logger.info('Directory processed', {
            directory: path.relative(baseDir, fullPath),
            filesFound: subFiles.length
          });
        } else if (stat.isFile()) {
          // Skip hidden files and system files
          if (!item.startsWith('.') && !item.startsWith('__MACOSX')) {
            allFiles.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      this.logger.error('Error collecting files', { 
        error: error.message, 
        dirPath: path.relative(process.cwd(), dirPath) 
      });
    }
    
    return allFiles;
  }

  private async cleanupUserFiles(telegramId: string, filesToKeep: string[] = []): Promise<void> {
    try {
      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = path.join(baseDir, telegramId, 'archive');
      
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);
        
        for (const file of files) {
          const filePath = path.join(userDir, file);
          
          if (filesToKeep.includes(filePath)) {
            continue;
          }
          
          if (fs.statSync(filePath).isDirectory()) {
            fs.removeSync(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up user files', { error, telegramId });
    }
  }

  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'archive';
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await axios.post(`${this.backendUrl}/api/activities`, data);
    } catch (error) {
      this.logger.error('Failed to record activity', { error, data });
    }
  }
} 