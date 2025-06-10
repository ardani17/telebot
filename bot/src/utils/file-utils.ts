import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Create user feature directory and ensure it exists
 */
export async function createUserFeatureDir(
  baseDir: string,
  telegramId: string,
  feature: string
): Promise<string> {
  const userDir = path.join(baseDir, `user_${telegramId}`, feature);
  await fs.ensureDir(userDir);
  return userDir;
}
