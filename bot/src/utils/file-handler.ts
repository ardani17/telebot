import { createWriteStream, promises as fs } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface FileInfo {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  extension: string;
}

export class FileHandler {
  private uploadDir: string;
  private tempDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || './uploads';
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }

  /**
   * Download file from Telegram
   */
  async downloadFile(fileId: string, fileName: string): Promise<FileInfo> {
    const botToken = process.env.BOT_TOKEN;
    const botApiServer = process.env.BOT_API_SERVER || 'https://api.telegram.org';

    // Get file info from Telegram
    const fileInfoResponse = await axios.get(
      `${botApiServer}/bot${botToken}/getFile?file_id=${fileId}`
    );

    if (!fileInfoResponse.data.ok) {
      throw new Error('Failed to get file info from Telegram');
    }

    const filePath = fileInfoResponse.data.result.file_path;
    const fileSize = fileInfoResponse.data.result.file_size || 0;

    // Download file
    const fileUrl = `${botApiServer}/file/bot${botToken}/${filePath}`;
    const response = await axios.get(fileUrl, { responseType: 'stream' });

    // Generate unique filename
    const extension = extname(fileName).toLowerCase();
    const uniqueFileName = `${uuidv4()}${extension}`;
    const localFilePath = join(this.uploadDir, uniqueFileName);

    // Save file
    const writer = createWriteStream(localFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve({
          id: uuidv4(),
          originalName: fileName,
          fileName: uniqueFileName,
          filePath: localFilePath,
          fileSize,
          extension: extension.replace('.', ''),
          mimeType: response.headers['content-type'],
        });
      });

      writer.on('error', reject);
    });
  }

  /**
   * Create temporary file
   */
  async createTempFile(content: string | Buffer, extension: string): Promise<string> {
    const fileName = `${uuidv4()}.${extension}`;
    const filePath = join(this.tempDir, fileName);

    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<any> {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error}`);
    }
  }

  /**
   * Validate file size
   */
  validateFileSize(fileSize: number, maxSize?: number): boolean {
    const limit = maxSize || parseInt(process.env.MAX_FILE_SIZE || '104857600'); // 100MB default
    return fileSize <= limit;
  }

  /**
   * Validate file type
   */
  validateFileType(fileName: string, allowedTypes: string[]): boolean {
    const extension = extname(fileName).toLowerCase().replace('.', '');
    return allowedTypes.includes(extension);
  }

  /**
   * Clean up old files
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await this.deleteFile(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup files:', error);
    }
  }
}
