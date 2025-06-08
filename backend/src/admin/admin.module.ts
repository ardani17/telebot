import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BotAuthGuard } from '../auth/bot-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, BotAuthGuard],
  exports: [AdminService]
})
export class AdminModule {}