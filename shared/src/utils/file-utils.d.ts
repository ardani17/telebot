export declare function createUserFeatureDir(baseDir: string, userId: string, featureName: string): Promise<string>;
export declare function getUserFeatureDirPath(baseDir: string, userId: string, featureName: string): string;
export declare const AVAILABLE_FEATURES: readonly ["ocr", "archive", "location", "geotags", "kml", "workbook"];
export type FeatureName = typeof AVAILABLE_FEATURES[number];
export declare function createAllUserFeatureDirs(baseDir: string, userId: string): Promise<Record<FeatureName, string>>;
//# sourceMappingURL=file-utils.d.ts.map