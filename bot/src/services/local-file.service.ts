import * as fs from 'fs-extra';
import { getErrorMessage } from '../utils/error-utils';
import * as path from 'path';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';
import winston from 'winston';

export interface LocalFileInfo {
  success: boolean;
  localPath?: string;
  fileName?: string;
  size?: number;
  error?: string;
}

export class LocalFileService {
  private logger: winston.Logger;
  private botApiDataDir: string;
  private userDataDir: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    // Bot API data directory (where Telegram stores files)
    this.botApiDataDir = path.resolve('/home/teleweb/backend/data-bot-api');
    // User data directory (where we store user files)
    this.userDataDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
  }

  /**
   * Copy file from bot API directory to user feature directory
   */
  async copyFileToUserDirectory(
    fileId: string,
    filePath: string,
    userId: string,
    featureName: string
  ): Promise<LocalFileInfo> {
    try {
      this.logger.info('Attempting to copy file locally', {
        fileId,
        filePath,
        userId,
        featureName,
      });

      // Find the file in bot API data directory
      const sourceFilePath = await this.findFileInBotApiDirectory(filePath);

      if (!sourceFilePath) {
        return {
          success: false,
          error: 'File not found in bot API directory',
        };
      }

      // Check if source file exists
      if (!(await fs.pathExists(sourceFilePath))) {
        return {
          success: false,
          error: `Source file does not exist: ${sourceFilePath}`,
        };
      }

      // Create user feature directory
      const userFeatureDir = await createUserFeatureDir(this.userDataDir, userId, featureName);

      // Generate unique filename
      const ext = path.extname(filePath) || '.jpg';
      const fileName = `${featureName}-${Date.now()}-${fileId}${ext}`;
      const destFilePath = path.join(userFeatureDir, fileName);

      // Copy file
      await fs.copy(sourceFilePath, destFilePath);

      // Get file stats
      const stats = await fs.stat(destFilePath);

      this.logger.info('File copied successfully', {
        sourceFilePath,
        destFilePath,
        fileName,
        size: stats.size,
        userId,
        featureName,
      });

      return {
        success: true,
        localPath: destFilePath,
        fileName,
        size: stats.size,
      };
    } catch (error) {
      this.logger.error('Failed to copy file locally', {
        error: getErrorMessage(error),
        fileId,
        filePath,
        userId,
        featureName,
      });

      return {
        success: false,
        error: `File copy failed: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Find file in bot API directory structure
   */
  private async findFileInBotApiDirectory(filePath: string): Promise<string | null> {
    try {
      this.logger.info('Searching for file in bot API directory', {
        filePath,
        botApiDataDir: this.botApiDataDir,
      });

      // If filePath is already absolute and points to bot API directory, use it
      if (path.isAbsolute(filePath) && filePath.includes(this.botApiDataDir)) {
        if (await fs.pathExists(filePath)) {
          return filePath;
        }
      }

      // Extract relative path - remove any absolute prefix
      let relativePath = filePath;
      if (path.isAbsolute(filePath)) {
        // Extract just the filename and directory structure
        const pathParts = filePath.split('/');
        const photosIndex = pathParts.indexOf('photos');
        if (photosIndex !== -1) {
          relativePath = pathParts.slice(photosIndex).join('/');
        } else {
          relativePath = path.basename(filePath);
        }
      }

      this.logger.info('Extracted relative path', {
        originalPath: filePath,
        relativePath,
      });

      // Search in bot token directories
      const botTokenDirs = await fs.readdir(this.botApiDataDir);

      for (const botDir of botTokenDirs) {
        const botDirPath = path.join(this.botApiDataDir, botDir);

        if ((await fs.stat(botDirPath)).isDirectory()) {
          // Try direct relative path
          const possibleFilePath = path.join(botDirPath, relativePath);

          if (await fs.pathExists(possibleFilePath)) {
            this.logger.info('File found', {
              foundPath: possibleFilePath,
            });
            return possibleFilePath;
          }

          // Try just filename if relative path fails
          if (relativePath.includes('/')) {
            const fileName = path.basename(relativePath);
            const photosDir = path.join(botDirPath, 'photos', fileName);

            if (await fs.pathExists(photosDir)) {
              this.logger.info('File found in photos directory', {
                foundPath: photosDir,
              });
              return photosDir;
            }
          }
        }
      }

      this.logger.warn('File not found in bot API directory', {
        filePath,
        relativePath,
        botApiDataDir: this.botApiDataDir,
        searchedDirs: botTokenDirs,
      });

      return null;
    } catch (error) {
      this.logger.error('Error searching for file in bot API directory', {
        error: getErrorMessage(error),
        filePath,
      });
      return null;
    }
  }

  /**
   * Get bot API data directory path
   */
  getBotApiDataDir(): string {
    return this.botApiDataDir;
  }

  /**
   * Get user data directory path
   */
  getUserDataDir(): string {
    return this.userDataDir;
  }

  /**
   * Check if local file operations are available
   */
  async isLocalModeAvailable(): Promise<boolean> {
    try {
      return await fs.pathExists(this.botApiDataDir);
    } catch {
      return false;
    }
  }
}
