import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Create user-specific directory structure for features
 * Structure: baseDir/userId/featureName/
 */
export async function createUserFeatureDir(
  baseDir: string,
  userId: string,
  featureName: string
): Promise<string> {
  const userDir = path.join(baseDir, userId);
  const featureDir = path.join(userDir, featureName);
  await fs.ensureDir(featureDir);
  return featureDir;
}

/**
 * Get user feature directory path without creating it
 */
export function getUserFeatureDirPath(
  baseDir: string,
  userId: string,
  featureName: string
): string {
  return path.join(baseDir, userId, featureName);
}

/**
 * Get all available features for directory structure
 */
export const AVAILABLE_FEATURES = [
  'ocr',
  'rar', 
  'location',
  'geotags',
  'kml',
  'workbook',
  'archive'
] as const;

export type FeatureName = typeof AVAILABLE_FEATURES[number];

/**
 * Create all feature directories for a user
 */
export async function createAllUserFeatureDirs(
  baseDir: string,
  userId: string
): Promise<Record<FeatureName, string>> {
  const dirs: Record<string, string> = {};
  
  for (const feature of AVAILABLE_FEATURES) {
    dirs[feature] = await createUserFeatureDir(baseDir, userId, feature);
  }
  
  return dirs as Record<FeatureName, string>;
} 