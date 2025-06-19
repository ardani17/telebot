import { Controller, Get, Param, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { BotMode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Activity')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Get paginated activities with filters
   */
  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated activities list' })
  async getActivities(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('telegramId') telegramId?: string,
    @Query('mode') mode?: string,
    @Query('action') action?: string,
    @Query('success') success?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.activityService.getActivities({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      telegramId,
      mode: mode as BotMode,
      action,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      dateFrom,
      dateTo,
    });
  }

  /**
   * Get activity statistics
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity statistics' })
  async getActivityStats() {
    return this.activityService.getActivityStats();
  }

  /**
   * Get activity time series data
   */
  @Get('time-series')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity time series data for charts' })
  async getActivityTimeSeries(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.activityService.getActivityTimeSeries(daysNum);
  }

  /**
   * Get user analytics with date range filter
   */
  @Get('user-analytics/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed analytics for a specific user' })
  async getUserAnalytics(
    @Param('userId') userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.activityService.getUserAnalytics(userId, dateFrom, dateTo);
  }

  /**
   * Get list of users for analytics
   */
  @Get('users-for-analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of users with activity data for analytics' })
  async getUsersForAnalytics() {
    return this.activityService.getUsersForAnalytics();
  }

  /**
   * Get user activity statistics for a specific feature
   */
  @Get('user/:userId/feature/:feature')
  async getUserFeatureStats(@Param('userId') userId: string, @Param('feature') feature: string) {
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
  async recordActivity(
    @Body()
    data: {
      userId: string;
      telegramId: string;
      action: string;
      mode: BotMode;
      details?: any;
      success: boolean;
      errorMessage?: string;
    }
  ) {
    return this.activityService.recordActivity(data);
  }
}
