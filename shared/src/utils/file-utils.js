"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_FEATURES = void 0;
exports.createUserFeatureDir = createUserFeatureDir;
exports.getUserFeatureDirPath = getUserFeatureDirPath;
exports.createAllUserFeatureDirs = createAllUserFeatureDirs;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
async function createUserFeatureDir(baseDir, userId, featureName) {
    const userDir = path.join(baseDir, userId);
    const featureDir = path.join(userDir, featureName);
    await fs.ensureDir(featureDir);
    return featureDir;
}
function getUserFeatureDirPath(baseDir, userId, featureName) {
    return path.join(baseDir, userId, featureName);
}
exports.AVAILABLE_FEATURES = [
    'ocr',
    'rar',
    'location',
    'geotags',
    'kml',
    'workbook'
];
async function createAllUserFeatureDirs(baseDir, userId) {
    const dirs = {};
    for (const feature of exports.AVAILABLE_FEATURES) {
        dirs[feature] = await createUserFeatureDir(baseDir, userId, feature);
    }
    return dirs;
}
//# sourceMappingURL=file-utils.js.map