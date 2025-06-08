import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

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
        foldersCount: folders.length
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
        const imageFiles = files
          .filter(file => /\.(jpg|jpeg|png|gif|bmp)$/i.test(file))
          .sort(); // Sort for consistent ordering

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
              ext: { width: 150, height: 150 }
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
              error: (imageError as Error).message
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
        sheetsCount: folderList.length
      });

      return {
        excelFilePath: outputPath,
        filename,
        fileSizeInMB: parseFloat(fileSizeInMB),
        sheetsCount: folderList.length
      };

    } catch (error) {
      this.logger.error('Error generating workbook Excel', {
        error: (error as Error).message,
        telegramId,
        userId,
        mediaFolderPath
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
} 