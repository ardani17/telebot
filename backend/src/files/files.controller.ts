import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Get,
  Param,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { OcrService, ProcessingStats } from './ocr.service';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('ocr/process')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'ocr');
          fs.ensureDirSync(uploadDir);
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const ext = path.extname(file.originalname);
          cb(null, `ocr-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/bmp',
          'image/webp',
          'image/tiff',
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('File harus berupa gambar (JPEG, PNG, GIF, BMP, WebP, TIFF)'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async processOcr(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId?: string; telegramId?: string }
  ) {
    try {
      if (!file) {
        throw new BadRequestException('File gambar diperlukan');
      }

      this.logger.log('Processing OCR request', {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        userId: body.userId,
        telegramId: body.telegramId,
      });

      // Validate image file
      if (!this.ocrService.isValidImageFile(file.originalname, file.mimetype)) {
        // Clean up uploaded file
        await fs.remove(file.path);
        throw new BadRequestException('Format file tidak didukung');
      }

      // Process OCR
      const result = await this.ocrService.extractTextFromImage(file.path);

      // Clean up uploaded file after processing
      try {
        await fs.remove(file.path);
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup uploaded file', { 
          path: file.path, 
          error: cleanupError 
        });
      }

      if (result.success) {
        this.logger.log('OCR processing successful', {
          filename: file.filename,
          textLength: result.text?.length,
          detectedLanguage: result.language,
          totalLanguagesDetected: result.detectedLanguages?.length || 0,
        });

        return {
          success: true,
          data: {
            filename: file.originalname,
            extractedText: result.text,
            processedAt: new Date().toISOString(),
            language: result.language,
            detectedLanguages: result.detectedLanguages,
            confidence: result.confidence,
            processingInfo: result.processingInfo,
          },
        };
      } else {
        this.logger.warn('OCR processing failed', {
          filename: file.filename,
          error: result.error,
        });

        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      this.logger.error('Error in OCR processing endpoint', {
        error: error.message,
        stack: error.stack,
        filename: file?.filename,
      });

      // Clean up file if it exists
      if (file?.path) {
        try {
          await fs.remove(file.path);
        } catch (cleanupError) {
          this.logger.warn('Failed to cleanup file after error', { 
            path: file.path, 
            error: cleanupError 
          });
        }
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Gagal memproses gambar untuk OCR');
    }
  }

  @Post('ocr/batch')
  @UseInterceptors(
    FileInterceptor('images', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'ocr', 'batch');
          fs.ensureDirSync(uploadDir);
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const ext = path.extname(file.originalname);
          cb(null, `batch-ocr-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for batch
      },
    }),
  )
  async processBatchOcr(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId?: string; telegramId?: string }
  ) {
    // This could be enhanced to handle ZIP files containing multiple images
    // For now, it's a placeholder for future batch processing capability
    throw new BadRequestException('Batch OCR processing belum tersedia');
  }

  @Get('ocr/stats')
  async getOcrStats() {
    try {
      const stats = await this.ocrService.getProcessingStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error getting OCR stats', { error });
      return {
        success: false,
        error: 'Gagal mengambil statistik OCR',
      };
    }
  }

  @Get('ocr/health')
  async checkOcrHealth() {
    try {
      const stats = await this.ocrService.getProcessingStats();
      return {
        success: true,
        healthy: stats.isServiceHealthy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('OCR health check failed', { error });
      return {
        success: false,
        healthy: false,
        error: 'OCR service tidak tersedia',
        timestamp: new Date().toISOString(),
      };
    }
  }
} 