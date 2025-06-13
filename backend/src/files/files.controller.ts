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
  UseGuards,
  Req,
  Delete,
  Query,
  Response,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { OcrService } from './ocr.service';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly ocrService: OcrService,
    private readonly filesService: FilesService
  ) {}

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
          cb(
            new BadRequestException('File harus berupa gambar (JPEG, PNG, GIF, BMP, WebP, TIFF)'),
            false
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    })
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
          error: cleanupError,
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
            error: cleanupError,
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
    })
  )
  async processBatchOcr(
    @UploadedFile() _file: Express.Multer.File,
    @Body() _body: { userId?: string; telegramId?: string }
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

  @Post('workbook/generate')
  async generateWorkbookExcel(@Body() generateDto: any) {
    try {
      const { telegramId, userId, mediaFolderPath, folders } = generateDto;

      this.logger.log('Workbook Excel generation request', {
        telegramId,
        userId,
        mediaFolderPath,
        foldersCount: folders?.length,
      });

      const result = await this.filesService.generateWorkbookExcel({
        telegramId,
        userId,
        mediaFolderPath,
        folders,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Error generating workbook Excel', {
        error: (error as Error).message,
        body: generateDto,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // File Management API Endpoints

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async getFiles(
    @Query('userId') userId?: string,
    @Query('telegramId') telegramId?: string,
    @Query('mode') mode?: string,
    @Query('processed') processed?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      return await this.filesService.getFiles({
        userId,
        telegramId,
        mode,
        processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
    } catch (error) {
      this.logger.error('Error getting files list', { error: error.message });
      throw new BadRequestException('Failed to get files list');
    }
  }

  @Get('user/:telegramId')
  @UseGuards(JwtAuthGuard)
  async getUserFiles(@Param('telegramId') telegramId: string) {
    try {
      return await this.filesService.getUserFiles(telegramId);
    } catch (error) {
      this.logger.error('Error getting user files', { error: error.message, telegramId });
      throw new BadRequestException('Failed to get user files');
    }
  }

  @Get('filesystem/all')
  @UseGuards(JwtAuthGuard)
  async getAllUserDirectories(@Req() req: any) {
    try {
      // Only allow admin to see all user directories
      if (req.user?.role !== 'ADMIN') {
        throw new BadRequestException('Access denied: Admin role required');
      }

      return await this.filesService.getAllUserDirectories();
    } catch (error) {
      this.logger.error('Error getting all user directories', { error: error.message });
      throw new BadRequestException('Failed to get user directories');
    }
  }

  @Get('filesystem/:telegramId')
  @UseGuards(JwtAuthGuard)
  async getUserFilesystem(@Param('telegramId') telegramId: string, @Req() req: any) {
    try {
      console.log('=== CONTROLLER DEBUG ===');
      console.log('Endpoint: GET /filesystem/:telegramId');
      console.log('TelegramId param:', telegramId);
      console.log('Request user:', req.user);
      console.log('User role:', req.user?.role);
      console.log('User telegramId:', req.user?.telegramId);
      console.log('Authorization header:', req.headers.authorization);

      this.logger.log('Getting user filesystem', {
        telegramId,
        requestedBy: req.user?.telegramId,
        userRole: req.user?.role,
        userId: req.user?.id,
      });

      // Allow admin to access any user, or user to access their own files
      if (req.user?.role !== 'ADMIN' && req.user?.telegramId !== telegramId) {
        this.logger.warn('Access denied', {
          userRole: req.user?.role,
          userTelegramId: req.user?.telegramId,
          requestedTelegramId: telegramId,
        });
        throw new BadRequestException('Access denied: Can only access your own files');
      }

      return await this.filesService.getUserFilesystem(telegramId);
    } catch (error) {
      console.log('=== CONTROLLER ERROR ===');
      console.log('Error:', error.message);
      console.log('Stack:', error.stack);

      this.logger.error('Error getting user filesystem', {
        error: error.message,
        telegramId,
        stack: error.stack,
      });
      throw new BadRequestException(`Failed to get user filesystem: ${error.message}`);
    }
  }

  @Get('download-file/:telegramId')
  @UseGuards(JwtAuthGuard)
  async downloadFileAlt(
    @Param('telegramId') telegramId: string,
    @Query('path') filePath: string,
    @Response() res: any
  ) {
    try {
      this.logger.log('Alternative download request', {
        telegramId,
        filePath,
        filePathLength: filePath?.length,
      });

      if (!filePath) {
        throw new BadRequestException('File path is required');
      }

      const result = await this.filesService.downloadFileByPath(telegramId, filePath);

      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');

      return res.sendFile(path.resolve(result.fullPath));
    } catch (error) {
      this.logger.error('Error in alternative download', {
        error: error.message,
        telegramId,
        filePath,
      });
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: 'File not found', error: error.message });
      } else {
        res.status(400).json({ message: 'Failed to download file', error: error.message });
      }
    }
  }

  @Get('download/path/:telegramId/*')
  @UseGuards(JwtAuthGuard)
  async downloadFileByPath(
    @Param('telegramId') telegramId: string,
    @Param('*') filePath: string,
    @Response() res: any,
    @Req() req: any
  ) {
    try {
      this.logger.log('Download request received', {
        telegramId,
        rawFilePath: filePath,
        fullUrl: req.url,
        originalUrl: req.originalUrl,
      });

      // Decode the URL encoded path
      const decodedPath = decodeURIComponent(filePath);
      
      this.logger.log('Path after decoding', {
        decodedPath,
        telegramId,
      });

      const result = await this.filesService.downloadFileByPath(telegramId, decodedPath);

      this.logger.log('File found, sending response', {
        fileName: result.fileName,
        fullPath: result.fullPath,
        mimeType: result.mimeType,
      });

      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');

      return res.sendFile(path.resolve(result.fullPath));
    } catch (error) {
      this.logger.error('Error downloading file by path', {
        error: error.message,
        stack: error.stack,
        telegramId,
        filePath,
      });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to download file');
    }
  }

  @Get('download/:fileId')
  @UseGuards(JwtAuthGuard)
  async downloadFile(@Param('fileId') fileId: string, @Response() res: any) {
    try {
      const fileInfo = await this.filesService.getFileInfo(fileId);
      if (!fileInfo) {
        throw new NotFoundException('File not found');
      }

      const filePath = fileInfo.filePath;
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundException('File not found on filesystem');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
      res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');

      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      this.logger.error('Error downloading file', { error: error.message, fileId });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to download file');
    }
  }

  @Delete('delete-file/:telegramId')
  @UseGuards(JwtAuthGuard)
  async deleteFileAlt(
    @Param('telegramId') telegramId: string,
    @Query('path') filePath: string
  ) {
    try {
      this.logger.log('Alternative delete request', {
        telegramId,
        filePath,
        filePathLength: filePath?.length,
      });

      if (!filePath) {
        throw new BadRequestException('File path is required');
      }

      await this.filesService.deleteFileByPath(telegramId, filePath);
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      this.logger.error('Error in alternative delete', {
        error: error.message,
        telegramId,
        filePath,
      });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete file');
    }
  }

  @Delete('path/:telegramId/*')
  @UseGuards(JwtAuthGuard)
  async deleteFileByPath(
    @Param('telegramId') telegramId: string, 
    @Param('*') filePath: string,
    @Req() req: any
  ) {
    try {
      this.logger.log('Delete request received', {
        telegramId,
        rawFilePath: filePath,
        fullUrl: req.url,
        originalUrl: req.originalUrl,
      });

      // Decode the URL encoded path
      const decodedPath = decodeURIComponent(filePath);
      
      this.logger.log('Path after decoding', {
        decodedPath,
        telegramId,
      });

      await this.filesService.deleteFileByPath(telegramId, decodedPath);
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting file by path', {
        error: error.message,
        stack: error.stack,
        telegramId,
        filePath,
      });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete file');
    }
  }

  @Delete(':fileId')
  @UseGuards(JwtAuthGuard)
  async deleteFile(@Param('fileId') fileId: string) {
    try {
      await this.filesService.deleteFile(fileId);
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting file', { error: error.message, fileId });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete file');
    }
  }

  @Get('stats/storage')
  @UseGuards(JwtAuthGuard)
  async getStorageStats() {
    try {
      return await this.filesService.getStorageStats();
    } catch (error) {
      this.logger.error('Error getting storage stats', { error: error.message });
      throw new BadRequestException('Failed to get storage stats');
    }
  }
}
