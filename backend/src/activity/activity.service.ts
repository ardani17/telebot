import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotMode } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record user activity
   */
  async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: BotMode;
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      return await this.prisma.botActivity.create({
        data: {
          userId: data.userId,
          telegramId: data.telegramId,
          action: data.action,
          mode: data.mode,
          details: data.details || {},
          success: data.success,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      console.error('Error recording activity:', error);
      throw error;
    }
  }

  /**
   * Get user activity statistics for a specific feature
   */
  async getUserFeatureStats(userId: string, feature: BotMode) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all activities for this user and feature
      const activities = await this.prisma.botActivity.findMany({
        where: {
          userId,
          mode: feature,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate statistics
      const totalCount = activities.length;
      const successCount = activities.filter(a => a.success).length;
      const failureCount = totalCount - successCount;
      const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

      // Count by time periods
      const today = activities.filter(a => a.createdAt >= startOfDay).length;
      const thisWeek = activities.filter(a => a.createdAt >= startOfWeek).length;
      const thisMonth = activities.filter(a => a.createdAt >= startOfMonth).length;

      // Get last used date
      const lastUsed = activities.length > 0 ? activities[0].createdAt : null;

      // Count by action type for this feature
      const actionCounts = activities.reduce((acc, activity) => {
        const action = activity.action;
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // For OCR specifically, count images vs documents
      let totalImages = 0;
      let totalDocuments = 0;
      
      if (feature === 'ocr') {
        totalImages = actionCounts['ocr_photo'] || 0;
        totalDocuments = actionCounts['ocr_document'] || 0;
      }

      return {
        success: true,
        data: {
          totalCount,
          successCount,
          failureCount,
          successRate,
          today,
          thisWeek,
          thisMonth,
          lastUsed,
          totalImages,
          totalDocuments,
          actionCounts,
        },
      };
    } catch (error) {
      console.error('Error getting user feature stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get overall user activity statistics
   */
  async getUserOverallStats(userId: string) {
    try {
      const activities = await this.prisma.botActivity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const featureStats = activities.reduce((acc, activity) => {
        const mode = activity.mode;
        if (!acc[mode]) {
          acc[mode] = { total: 0, success: 0, failure: 0 };
        }
        acc[mode].total++;
        if (activity.success) {
          acc[mode].success++;
        } else {
          acc[mode].failure++;
        }
        return acc;
      }, {} as Record<string, any>);

      return {
        success: true,
        data: {
          totalActivities: activities.length,
          featureStats,
          lastActivity: activities.length > 0 ? activities[0].createdAt : null,
        },
      };
    } catch (error) {
      console.error('Error getting user overall stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
} 