import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { execSync } from 'child_process';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Excel file from workbook photos
   */
  async generateWorkbookExcel(data: {
    telegramId: string;
    userId: string;
    mediaFolderPath: string;
    folders: string[];
  }) {
    const { telegramId, userId, mediaFolderPath, folders } = data;

    try {
      this.logger.log('Starting workbook Excel generation', {
        telegramId,
        userId,
        mediaFolderPath,
        foldersCount: folders.length,
      });

      // Read folders if not provided
      let folderList = folders;
      if (!folderList || folderList.length === 0) {
        if (await fs.pathExists(mediaFolderPath)) {
          const allFiles = await fs.readdir(mediaFolderPath);
          folderList = [];

          for (const file of allFiles) {
            const filePath = path.join(mediaFolderPath, file);
            if ((await fs.lstat(filePath)).isDirectory()) {
              folderList.push(file);
            }
          }
        } else {
          throw new Error('Media folder path does not exist');
        }
      }

      if (folderList.length === 0) {
        throw new Error('No folders found for Excel generation');
      }

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TeleWeb Bot';
      workbook.created = new Date();

      // Process each folder as a sheet
      for (const folderName of folderList) {
        const folderPath = path.join(mediaFolderPath, folderName);

        if (!(await fs.pathExists(folderPath))) {
          this.logger.warn(`Folder not found: ${folderPath}`);
          continue;
        }

        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|bmp)$/i.test(file)).sort(); // Sort for consistent ordering

        if (imageFiles.length === 0) {
          this.logger.warn(`No images found in folder: ${folderPath}`);
          continue;
        }

        // Create worksheet for this folder
        const worksheet = workbook.addWorksheet(folderName);

        // Set column widths with spacing - alternating image columns and spacing columns
        // Columns 1,3,5,7,9 for images, columns 2,4,6,8 for spacing
        for (let col = 1; col <= 9; col++) {
          if (col % 2 === 1) {
            // Image columns (1,3,5,7,9)
            worksheet.getColumn(col).width = 20;
          } else {
            // Spacing columns (2,4,6,8)
            worksheet.getColumn(col).width = 2;
          }
        }

        let currentRow = 1;
        let imageCount = 0;

        for (const imageFile of imageFiles) {
          const imagePath = path.join(folderPath, imageFile);

          try {
            // Calculate column position with spacing: 1,3,5,7,9
            const currentCol = (imageCount % 5) * 2 + 1;

            // Add image to worksheet
            const imageId = workbook.addImage({
              filename: imagePath,
              extension: path.extname(imageFile).substring(1).toLowerCase() as any,
            });

            worksheet.addImage(imageId, {
              tl: { col: currentCol - 1, row: currentRow - 1 },
              ext: { width: 150, height: 150 },
            });

            // Set row height to accommodate image
            worksheet.getRow(currentRow).height = 120;

            // Move to next position
            imageCount++;
            if (imageCount % 5 === 0) {
              // After 5 images, move to next row
              currentRow++;
            }
          } catch (imageError) {
            this.logger.warn(`Failed to add image: ${imagePath}`, {
              error: (imageError as Error).message,
            });
          }
        }

        this.logger.log(`Added ${imageFiles.length} images to sheet: ${folderName}`);
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `workbook_${telegramId}_${timestamp}.xlsx`;
      const outputPath = path.join(process.cwd(), 'temp', filename);

      // Ensure temp directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Write Excel file
      await workbook.xlsx.writeFile(outputPath);

      // Get file size
      const stats = await fs.stat(outputPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      this.logger.log('Workbook Excel generated successfully', {
        telegramId,
        userId,
        filename,
        fileSizeInMB,
        sheetsCount: folderList.length,
      });

      return {
        excelFilePath: outputPath,
        filename,
        fileSizeInMB: parseFloat(fileSizeInMB),
        sheetsCount: folderList.length,
      };
    } catch (error) {
      this.logger.error('Error generating workbook Excel', {
        error: (error as Error).message,
        telegramId,
        userId,
        mediaFolderPath,
      });
      throw error;
    }
  }

  /**
   * Get Excel cell reference (A1, B1, etc.)
   */
  private getCellReference(row: number, col: number): string {
    let colName = '';
    while (col > 0) {
      col--;
      colName = String.fromCharCode(65 + (col % 26)) + colName;
      col = Math.floor(col / 26);
    }
    return colName + row;
  }

  // File Management Methods

  /**
   * Get files with filtering and pagination
   */
  async getFiles(options: {
    userId?: string;
    telegramId?: string;
    mode?: string;
    processed?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { userId, telegramId, mode, processed, page = 1, limit = 50 } = options;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (telegramId) {
      where.user = {
        telegramId: telegramId,
      };
    }

    if (mode) {
      where.mode = mode;
    }

    if (processed !== undefined) {
      where.processed = processed;
    }

    const [files, total] = await Promise.all([
      this.prisma.fileMetadata.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.fileMetadata.count({ where }),
    ]);

    return {
      files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get files by user telegram ID
   */
  async getUserFiles(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const files = await this.prisma.fileMetadata.findMany({
      where: {
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { user, files };
  }

  /**
   * Get all user directories (admin only)
   */
  async getAllUserDirectories() {
    const botApiDataPath =
      process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');

    this.logger.log('Scanning all user directories', {
      botApiDataPath,
      envVar: process.env.BOT_API_DATA_PATH,
    });

    if (!(await fs.pathExists(botApiDataPath))) {
      this.logger.warn('Bot API data path does not exist', { botApiDataPath });
      return {
        dataPath: botApiDataPath,
        exists: false,
        users: [],
      };
    }

    try {
      const items = await fs.readdir(botApiDataPath);
      const users = [];

      for (const item of items) {
        const itemPath = path.join(botApiDataPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory() && !item.startsWith('.') && item !== 'temp') {
          // Count files and folders
          let totalFiles = 0;
          let totalSize = 0;
          const folders = [];

          try {
            const subItems = await fs.readdir(itemPath);
            for (const subItem of subItems) {
              const subPath = path.join(itemPath, subItem);
              const subStats = await fs.stat(subPath);

              if (subStats.isDirectory()) {
                const folderFiles = await this.countFilesInDirectory(subPath);
                folders.push({
                  name: subItem,
                  fileCount: folderFiles.count,
                  size: folderFiles.size,
                });
                totalFiles += folderFiles.count;
                totalSize += folderFiles.size;
              } else {
                totalFiles++;
                totalSize += subStats.size;
              }
            }
          } catch (error) {
            this.logger.warn('Error scanning user directory', {
              userPath: itemPath,
              error: error.message,
            });
          }

          users.push({
            telegramId: item,
            path: itemPath,
            totalFiles,
            totalSize,
            folders,
            lastModified: stats.mtime,
          });
        }
      }

      return {
        dataPath: botApiDataPath,
        exists: true,
        users: users.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
      };
    } catch (error) {
      this.logger.error('Error scanning data directory', {
        error: error.message,
        path: botApiDataPath,
      });
      throw new Error('Failed to scan data directory');
    }
  }

  /**
   * Get user filesystem (real folders and files)
   */
  async getUserFilesystem(telegramId: string) {
    const botApiDataPath =
      process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
    const userDataPath = path.join(botApiDataPath, telegramId);

    // Debug logging
    console.log('=== FILE SYSTEM DEBUG ===');
    console.log('TelegramId:', telegramId);
    console.log('BOT_API_DATA_PATH env:', process.env.BOT_API_DATA_PATH);
    console.log('botApiDataPath resolved:', botApiDataPath);
    console.log('userDataPath:', userDataPath);
    console.log('Current working directory:', process.cwd());

    this.logger.log('Scanning user filesystem - START', {
      telegramId,
      botApiDataPath,
      userDataPath,
      envVar: process.env.BOT_API_DATA_PATH,
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV,
    });

    // Check if path exists
    const pathExists = await fs.pathExists(userDataPath);
    this.logger.log('Path existence check', {
      userDataPath,
      pathExists,
      telegramId,
    });

    if (!pathExists) {
      this.logger.warn('User data path does not exist', {
        userDataPath,
        telegramId,
        botApiDataPath: process.env.BOT_API_DATA_PATH,
        resolvedPath: path.resolve(userDataPath),
      });
      return {
        userPath: userDataPath,
        exists: false,
        folders: [],
        files: [],
      };
    }

    const folders: any[] = [];
    const files: any[] = [];

    const scanDirectory = async (dirPath: string, relativePath: string = '') => {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          const subFolder = {
            name: item,
            path: itemRelativePath,
            fullPath: itemPath,
            size: 0,
            fileCount: 0,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            files: [],
            folders: [], // Add nested folders
          };

          // Recursively scan this folder for both files and subfolders
          try {
            const subItems = await fs.readdir(itemPath);

            for (const subItem of subItems) {
              const subItemPath = path.join(itemPath, subItem);
              const subItemStats = await fs.stat(subItemPath);

              if (subItemStats.isFile()) {
                // Add file to current folder
                const fileObj = {
                  name: subItem,
                  path: path.join(itemRelativePath, subItem),
                  fullPath: subItemPath,
                  size: subItemStats.size,
                  mimeType: this.getMimeType(subItem),
                  createdAt: subItemStats.birthtime,
                  modifiedAt: subItemStats.mtime,
                };
                subFolder.files.push(fileObj);
                subFolder.size += subItemStats.size;
                subFolder.fileCount++;
              } else if (subItemStats.isDirectory()) {
                // Recursively scan subfolder
                const nestedFolder = {
                  name: subItem,
                  path: path.join(itemRelativePath, subItem),
                  fullPath: subItemPath,
                  size: 0,
                  fileCount: 0,
                  createdAt: subItemStats.birthtime,
                  modifiedAt: subItemStats.mtime,
                  files: [],
                  folders: [],
                };

                // Recursive call to scan nested folder
                await this.scanFolderRecursive(
                  subItemPath,
                  path.join(itemRelativePath, subItem),
                  nestedFolder
                );

                // Add nested folder to current folder
                subFolder.folders.push(nestedFolder);
                subFolder.size += nestedFolder.size;
                subFolder.fileCount += nestedFolder.fileCount;
              }
            }
          } catch (error) {
            this.logger.warn('Error scanning subfolder', {
              error: error.message,
              folder: itemPath,
            });
          }

          folders.push(subFolder);
        } else {
          // Root level file
          files.push({
            name: item,
            path: itemRelativePath,
            fullPath: itemPath,
            size: stats.size,
            mimeType: this.getMimeType(item),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          });
        }
      }
    };

    try {
      this.logger.log('Starting directory scan', { userDataPath });
      await scanDirectory(userDataPath);
      this.logger.log('Directory scan completed successfully', {
        userDataPath,
        folderCount: folders.length,
        fileCount: files.length,
      });
    } catch (error) {
      this.logger.error('Error scanning user directory', {
        error: error.message,
        stack: error.stack,
        path: userDataPath,
        telegramId,
      });
      throw new Error(`Failed to scan user directory: ${error.message}`);
    }

    return {
      userPath: userDataPath,
      exists: true,
      folders,
      files,
      totalSize: [...folders, ...files].reduce((acc, item) => acc + item.size, 0),
    };
  }

  /**
   * Get file info by ID from database
   */
  async getFileInfo(fileId: string) {
    const file = await this.prisma.fileMetadata.findUnique({
      where: { id: fileId },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return file;
  }

  /**
   * Download file by path
   */
  async downloadFileByPath(telegramId: string, filePath: string) {
    this.logger.log('downloadFileByPath called', {
      telegramId,
      filePath,
      filePathLength: filePath.length,
    });

    const botApiDataPath =
      process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
    const userDataPath = path.join(botApiDataPath, telegramId);
    const fullPath = path.join(userDataPath, filePath);

    this.logger.log('Paths constructed', {
      botApiDataPath,
      userDataPath,
      fullPath,
      filePath,
    });

    // Security check: ensure path is within user directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedUserPath = path.resolve(userDataPath);

    this.logger.log('Security check', {
      resolvedPath,
      resolvedUserPath,
      startsWith: resolvedPath.startsWith(resolvedUserPath),
    });

    if (!resolvedPath.startsWith(resolvedUserPath)) {
      throw new NotFoundException('File path not allowed');
    }

    const exists = await fs.pathExists(fullPath);
    this.logger.log('File existence check', {
      fullPath,
      exists,
    });

    if (!exists) {
      throw new NotFoundException('File not found');
    }

    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) {
      throw new NotFoundException('Path is not a file');
    }

    const result = {
      fullPath,
      fileName: path.basename(filePath),
      mimeType: this.getMimeType(path.basename(filePath)),
      size: stats.size,
    };

    this.logger.log('Returning file info', result);
    return result;
  }

  /**
   * Delete file by ID from database and filesystem
   */
  async deleteFile(fileId: string) {
    const file = await this.prisma.fileMetadata.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete from filesystem if exists
    try {
      if (await fs.pathExists(file.filePath)) {
        await fs.remove(file.filePath);
      }
    } catch (error) {
      this.logger.warn('Failed to delete file from filesystem', {
        error: error.message,
        filePath: file.filePath,
      });
    }

    // Delete from database
    await this.prisma.fileMetadata.delete({
      where: { id: fileId },
    });

    return { success: true };
  }

  /**
   * Delete file by path from filesystem
   */
  async deleteFileByPath(telegramId: string, filePath: string) {
    this.logger.log('deleteFileByPath called', {
      telegramId,
      filePath,
      filePathLength: filePath.length,
    });

    const botApiDataPath =
      process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
    const userDataPath = path.join(botApiDataPath, telegramId);
    const fullPath = path.join(userDataPath, filePath);

    this.logger.log('Paths constructed for delete', {
      botApiDataPath,
      userDataPath,
      fullPath,
      filePath,
    });

    // Security check: ensure path is within user directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedUserPath = path.resolve(userDataPath);

    this.logger.log('Security check for delete', {
      resolvedPath,
      resolvedUserPath,
      startsWith: resolvedPath.startsWith(resolvedUserPath),
    });

    if (!resolvedPath.startsWith(resolvedUserPath)) {
      throw new NotFoundException('File path not allowed');
    }

    const exists = await fs.pathExists(fullPath);
    this.logger.log('File existence check for delete', {
      fullPath,
      exists,
    });

    if (!exists) {
      throw new NotFoundException('File not found');
    }

    await fs.remove(fullPath);
    this.logger.log('File deleted successfully', { fullPath });

    // Also try to remove from database if exists
    try {
      await this.prisma.fileMetadata.deleteMany({
        where: {
          filePath: fullPath,
        },
      });
    } catch (error) {
      this.logger.warn('File not found in database', { filePath: fullPath });
    }

    return { success: true };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const botApiDataPath =
      process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');

    let totalSize = 0;
    let fileCount = 0;
    let userCount = 0;

    try {
      // Get database stats
      const [dbFileCount, dbTotalSize] = await Promise.all([
        this.prisma.fileMetadata.count(),
        this.prisma.fileMetadata.aggregate({
          _sum: {
            fileSize: true,
          },
        }),
      ]);

      // Get filesystem stats
      if (await fs.pathExists(botApiDataPath)) {
        try {
          const users = await fs.readdir(botApiDataPath);
          userCount = users.length;

          for (const user of users) {
            const userPath = path.join(botApiDataPath, user);
            const stats = await fs.stat(userPath);

            if (stats.isDirectory()) {
              try {
                const sizeResult = execSync(`du -sb "${userPath}" 2>/dev/null | cut -f1`, {
                  encoding: 'utf8',
                }).trim();
                const size = parseInt(sizeResult, 10) || 0;
                totalSize += size;

                const fileCountResult = execSync(`find "${userPath}" -type f | wc -l`, {
                  encoding: 'utf8',
                }).trim();
                fileCount += parseInt(fileCountResult, 10) || 0;
              } catch (error) {
                this.logger.warn('Failed to get stats for user directory', {
                  user,
                  error: error.message,
                });
              }
            }
          }
        } catch (error) {
          this.logger.warn('Failed to scan data directory', { error: error.message });
        }
      }

      return {
        database: {
          fileCount: dbFileCount,
          totalSize: dbTotalSize._sum.fileSize || 0,
        },
        filesystem: {
          totalSize,
          fileCount,
          userCount,
          dataPath: botApiDataPath,
        },
        formatted: {
          totalSizeFormatted: this.formatBytes(totalSize),
          dbSizeFormatted: this.formatBytes(dbTotalSize._sum.fileSize || 0),
        },
      };
    } catch (error) {
      this.logger.error('Error getting storage stats', { error: error.message });
      throw new Error('Failed to get storage statistics');
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Recursively scan folder and populate folder structure
   */
  private async scanFolderRecursive(
    dirPath: string,
    relativePath: string,
    folderObj: any
  ): Promise<void> {
    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
          // Add file to current folder
          const fileObj = {
            name: item,
            path: itemRelativePath,
            fullPath: itemPath,
            size: stats.size,
            mimeType: this.getMimeType(item),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
          folderObj.files.push(fileObj);
          folderObj.size += stats.size;
          folderObj.fileCount++;
        } else if (stats.isDirectory()) {
          // Create nested folder object
          const nestedFolder = {
            name: item,
            path: itemRelativePath,
            fullPath: itemPath,
            size: 0,
            fileCount: 0,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            files: [],
            folders: [],
          };

          // Recursively scan the nested folder
          await this.scanFolderRecursive(itemPath, itemRelativePath, nestedFolder);

          // Add nested folder to current folder
          folderObj.folders.push(nestedFolder);
          folderObj.size += nestedFolder.size;
          folderObj.fileCount += nestedFolder.fileCount;
        }
      }
    } catch (error) {
      this.logger.warn('Error in recursive folder scan', {
        dirPath,
        relativePath,
        error: error.message,
      });
    }
  }

  /**
   * Count files in directory recursively
   */
  private async countFilesInDirectory(dirPath: string): Promise<{ count: number; size: number }> {
    let count = 0;
    let size = 0;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
          count++;
          size += stats.size;
        } else if (stats.isDirectory()) {
          const subResult = await this.countFilesInDirectory(itemPath);
          count += subResult.count;
          size += subResult.size;
        }
      }
    } catch (error) {
      this.logger.warn('Error counting files in directory', { dirPath, error: error.message });
    }

    return { count, size };
  }
}
