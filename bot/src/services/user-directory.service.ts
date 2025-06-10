import {
  createAllUserFeatureDirs,
  createUserFeatureDir,
} from '../../../shared/src/utils/file-utils';
import * as path from 'path';
import winston from 'winston';

export class UserDirectoryService {
  private logger: winston.Logger;
  private baseDir: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'temp');
  }

  /**
   * Initialize all feature directories for a user
   */
  async initializeUserDirectories(userId: string): Promise<void> {
    try {
      this.logger.info('Initializing user directories', { userId });

      const directories = await createAllUserFeatureDirs(this.baseDir, userId);

      this.logger.info('User directories created', {
        userId,
        directories: Object.keys(directories),
      });
    } catch (error) {
      this.logger.error('Failed to initialize user directories', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get or create specific feature directory for user
   */
  async getUserFeatureDirectory(userId: string, featureName: string): Promise<string> {
    try {
      return await createUserFeatureDir(this.baseDir, userId, featureName);
    } catch (error) {
      this.logger.error('Failed to create user feature directory', {
        userId,
        featureName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get base directory path
   */
  getBaseDirectory(): string {
    return this.baseDir;
  }
}
