import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { OcrService } from './ocr.service';
import * as path from 'path';

@Module({
  imports: [
    MulterModule.register({
      dest: path.join(process.cwd(), 'uploads'),
    }),
  ],
  controllers: [FilesController],
  providers: [OcrService],
  exports: [OcrService],
})
export class FilesModule {}
