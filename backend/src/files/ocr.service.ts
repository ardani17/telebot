import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';

interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  language?: string;
  detectedLanguages?: Array<{
    languageCode: string;
    confidence: number;
  }>;
  processingInfo?: {
    totalPages: number;
    totalBlocks: number;
    processingTime: number;
  };
}

interface ProcessingStats {
  totalProcessed: number;
  successfulProcesses: number;
  failedProcesses: number;
  averageProcessingTime: number;
  isServiceHealthy: boolean;
  lastProcessedAt?: Date;
}

export { ProcessingStats };

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private visionClient: ImageAnnotatorClient;
  private stats: ProcessingStats = {
    totalProcessed: 0,
    successfulProcesses: 0,
    failedProcesses: 0,
    averageProcessingTime: 0,
    isServiceHealthy: true,
  };

  constructor() {
    try {
      // Initialize Google Cloud Vision client
      const keyFilePath = path.join(process.cwd(), 'config', 'gcp-vision-key.json');

      if (fs.existsSync(keyFilePath)) {
        this.visionClient = new ImageAnnotatorClient({
          keyFilename: keyFilePath,
        });
        this.logger.log('Google Cloud Vision client initialized successfully');
      } else {
        this.logger.warn('GCP Vision key file not found, OCR will run in fallback mode');
        this.stats.isServiceHealthy = false;
      }
    } catch (error) {
      this.logger.error('Failed to initialize Google Cloud Vision client', error);
      this.stats.isServiceHealthy = false;
    }
  }

  /**
   * Extract text from image using Google Cloud Vision API
   */
  async extractTextFromImage(imagePath: string): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      if (!this.visionClient) {
        return {
          success: false,
          error: 'Google Cloud Vision client not available. Please check configuration.',
        };
      }

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      this.logger.log('Processing image for OCR with auto language detection', { imagePath });

      // Perform text detection with auto language detection
      const [result] = await this.visionClient.textDetection(imagePath);
      const detections = result.textAnnotations;
      const fullTextAnnotation = result.fullTextAnnotation;

      let extractedText = '';
      let confidence = 0;
      let detectedLanguages = [];
      let processingInfo = null;

      if (detections && detections.length > 0) {
        // First annotation contains the full text
        extractedText = detections[0].description || '';

        // Calculate average confidence from all detections
        const confidenceValues = detections
          .slice(1) // Skip the first one (full text)
          .map(detection => detection.confidence || 0)
          .filter(conf => conf > 0);

        if (confidenceValues.length > 0) {
          confidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;
        }
      }

      // Extract detailed language detection information
      if (fullTextAnnotation && fullTextAnnotation.pages && fullTextAnnotation.pages.length > 0) {
        const page = fullTextAnnotation.pages[0];

        // Get all detected languages with confidence scores
        if (page.property && page.property.detectedLanguages) {
          detectedLanguages = page.property.detectedLanguages.map(lang => ({
            languageCode: lang.languageCode,
            confidence: lang.confidence || 0,
          }));
        }

        // Processing statistics
        processingInfo = {
          totalPages: fullTextAnnotation.pages.length,
          totalBlocks: fullTextAnnotation.pages.reduce(
            (total, page) => total + (page.blocks ? page.blocks.length : 0),
            0
          ),
          processingTime: Date.now() - startTime,
        };
      }

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      if (extractedText.trim()) {
        // Log auto-detection results
        const primaryLanguage = detectedLanguages.length > 0 ? detectedLanguages[0] : null;
        this.logger.log('OCR completed with auto language detection', {
          textLength: extractedText.length,
          confidence: confidence.toFixed(2),
          primaryLanguage: primaryLanguage?.languageCode,
          languageConfidence: primaryLanguage?.confidence?.toFixed(2),
          totalLanguagesDetected: detectedLanguages.length,
          allDetectedLanguages: detectedLanguages
            .map(l => `${l.languageCode}(${(l.confidence * 100).toFixed(1)}%)`)
            .join(', '),
          processingTime: `${processingTime}ms`,
        });

        return {
          success: true,
          text: extractedText.trim(),
          confidence,
          language: primaryLanguage?.languageCode,
          detectedLanguages,
          processingInfo,
        };
      } else {
        this.logger.warn('No text detected in image');
        return {
          success: false,
          error: 'No text detected in the image',
        };
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime);

      this.logger.error('OCR processing failed', {
        error: error.message,
        stack: error.stack,
        imagePath,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: false,
        error: `OCR processing failed: ${error.message}`,
      };
    }
  }

  /**
   * Validate image file format and properties
   * This is simplified version without Sharp
   */
  isValidImageFile(filename: string, mimetype: string): boolean {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/tiff',
    ];

    const ext = path.extname(filename).toLowerCase();
    const isValidExtension = allowedExtensions.includes(ext);
    const isValidMimeType = allowedMimeTypes.includes(mimetype.toLowerCase());

    this.logger.debug('Image validation', {
      filename,
      mimetype,
      extension: ext,
      isValidExtension,
      isValidMimeType,
    });

    return isValidExtension && isValidMimeType;
  }

  /**
   * Validate and optimize image (simplified without Sharp for now)
   */
  private async validateAndOptimizeImage(imagePath: string): Promise<string> {
    try {
      // For now, just return the original path since Sharp is not working
      // In production, this would validate size, format, etc.

      const stats = await fs.stat(imagePath);

      if (stats.size > 50 * 1024 * 1024) {
        // 50MB limit
        throw new Error('Image file too large (max 50MB)');
      }

      this.logger.debug('Image validation passed', {
        path: imagePath,
        size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      });

      return imagePath;
    } catch (error) {
      this.logger.error('Image validation/optimization failed', {
        error: error.message,
        imagePath,
      });
      throw error;
    }
  }

  /**
   * Update processing statistics
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;

    if (success) {
      this.stats.successfulProcesses++;
    } else {
      this.stats.failedProcesses++;
    }

    // Update average processing time
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime) /
      this.stats.totalProcessed;

    this.stats.lastProcessedAt = new Date();

    // Update service health based on recent success rate
    const successRate = this.stats.successfulProcesses / this.stats.totalProcessed;
    this.stats.isServiceHealthy = successRate > 0.5 && this.visionClient !== null;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<ProcessingStats> {
    return { ...this.stats };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successfulProcesses: 0,
      failedProcesses: 0,
      averageProcessingTime: 0,
      isServiceHealthy: this.visionClient !== null,
    };
    this.logger.log('OCR statistics reset');
  }
}
