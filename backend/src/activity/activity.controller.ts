import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { BotMode } from '@prisma/client';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Get user activity statistics for a specific feature
   */
  @Get('user/:userId/feature/:feature')
  async getUserFeatureStats(
    @Param('userId') userId: string,
    @Param('feature') feature: string,
  ) {
    return this.activityService.getUserFeatureStats(userId, feature as BotMode);
  }

  /**
   * Get overall user activity statistics
   */
  @Get('user/:userId')
  async getUserOverallStats(@Param('userId') userId: string) {
    return this.activityService.getUserOverallStats(userId);
  }

  /**
   * Record user activity
   */
  @Post('record')
  async recordActivity(@Body() data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: BotMode;
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    return this.activityService.recordActivity(data);
  }
} 