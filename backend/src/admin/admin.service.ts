import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import * as os from 'os';
import axios from 'axios';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // User management methods
  async getUsers(isActiveFilter?: boolean) {
    try {
      const where = isActiveFilter !== undefined ? { isActive: isActiveFilter } : {};

      const users = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          telegramId: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          featureAccess: {
            select: {
              feature: {
                select: {
                  name: true,
                  isEnabled: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return users;
    } catch (error) {
      this.logger.error('Failed to get users', error);
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          featureAccess: {
            include: {
              feature: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to get user ${telegramId}`, error);
      throw error;
    }
  }

  async checkTelegramUser(telegramId: string) {
    try {
      const botToken = process.env.BOT_TOKEN;
      if (!botToken) {
        throw new Error('BOT_TOKEN environment variable is not set');
      }

      // Use getChat method to get user information
      const botApiServer = process.env.BOT_API_SERVER;
      let apiUrl: string;
      
      if (botApiServer) {
        apiUrl = `${botApiServer}/bot${botToken}/getChat`;
      } else {
        apiUrl = `https://api.telegram.org/bot${botToken}/getChat`;
      }

      const response = await axios.get(apiUrl, {
        params: {
          chat_id: telegramId
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data.ok && response.data.result) {
        const userInfo = response.data.result;
        
        return {
          id: userInfo.id,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          username: userInfo.username,
          type: userInfo.type
        };
      } else {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found or bot cannot access this user`);
      }
    } catch (error) {
      this.logger.error(`Failed to check Telegram user ${telegramId}`, error);
      
      if (error.response?.status === 400) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found or bot cannot access this user`);
      }
      
      throw error;
    }
  }

  async createUser(userData: {
    telegramId: string;
    name: string;
    username?: string;
    role?: 'ADMIN' | 'USER';
    isActive?: boolean;
  }) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { telegramId: userData.telegramId },
      });

      if (existingUser) {
        throw new ConflictException(`User with Telegram ID ${userData.telegramId} already exists`);
      }

      const user = await this.prisma.user.create({
        data: {
          telegramId: userData.telegramId,
          name: userData.name,
          username: userData.username,
          role: userData.role || 'USER',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
        },
      });

      this.logger.log(`User created: ${user.telegramId} (${user.name})`);
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }

  async updateUser(
    telegramId: string,
    updateData: {
      name?: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      isActive?: boolean;
    }
  ) {
    try {
      const user = await this.prisma.user.update({
        where: { telegramId },
        data: updateData,
      });

      this.logger.log(`User updated: ${telegramId}`);
      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }
      this.logger.error(`Failed to update user ${telegramId}`, error);
      throw error;
    }
  }

  async deleteUser(telegramId: string) {
    try {
      // First delete related records
      await this.prisma.userFeatureAccess.deleteMany({
        where: { user: { telegramId } },
      });

      // Then delete the user
      const user = await this.prisma.user.delete({
        where: { telegramId },
      });

      this.logger.log(`User deleted: ${telegramId}`);
      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }
      this.logger.error(`Failed to delete user ${telegramId}`, error);
      throw error;
    }
  }

  // Feature management methods
  async getFeatures() {
    try {
      const features = await this.prisma.feature.findMany({
        include: {
          userAccess: {
            include: {
              user: {
                select: {
                  telegramId: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return features;
    } catch (error) {
      this.logger.error('Failed to get features', error);
      throw error;
    }
  }

  async updateFeature(featureName: string, isEnabled: boolean) {
    try {
      const feature = await this.prisma.feature.update({
        where: { name: featureName },
        data: { isEnabled },
      });

      this.logger.log(`Feature ${featureName} ${isEnabled ? 'enabled' : 'disabled'}`);
      return feature;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Feature ${featureName} not found`);
      }
      this.logger.error(`Failed to update feature ${featureName}`, error);
      throw error;
    }
  }

  async grantFeatureAccess(telegramId: string, featureName: string) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      if (!user) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }

      // Check if feature exists
      const feature = await this.prisma.feature.findUnique({
        where: { name: featureName },
      });

      if (!feature) {
        throw new NotFoundException(`Feature ${featureName} not found`);
      }

      // Check if access already exists
      const existingAccess = await this.prisma.userFeatureAccess.findUnique({
        where: {
          userId_featureId: {
            userId: user.id,
            featureId: feature.id,
          },
        },
      });

      if (existingAccess) {
        throw new ConflictException(
          `User ${telegramId} already has access to feature ${featureName}`
        );
      }

      // Grant access
      const access = await this.prisma.userFeatureAccess.create({
        data: {
          userId: user.id,
          featureId: feature.id,
          grantedBy: user.id,
        },
      });

      this.logger.log(`Feature access granted: ${telegramId} -> ${featureName}`);
      return access;
    } catch (error) {
      this.logger.error(`Failed to grant feature access: ${telegramId} -> ${featureName}`, error);
      throw error;
    }
  }

  async revokeFeatureAccess(telegramId: string, featureName: string) {
    try {
      // Get user and feature
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      if (!user) {
        throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
      }

      const feature = await this.prisma.feature.findUnique({
        where: { name: featureName },
      });

      if (!feature) {
        throw new NotFoundException(`Feature ${featureName} not found`);
      }

      // Revoke access
      const access = await this.prisma.userFeatureAccess.delete({
        where: {
          userId_featureId: {
            userId: user.id,
            featureId: feature.id,
          },
        },
      });

      this.logger.log(`Feature access revoked: ${telegramId} -> ${featureName}`);
      return access;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `User ${telegramId} does not have access to feature ${featureName}`
        );
      }
      this.logger.error(`Failed to revoke feature access: ${telegramId} -> ${featureName}`, error);
      throw error;
    }
  }

  // Statistics methods
  async getUserStats() {
    try {
      const totalUsers = await this.prisma.user.count();
      const activeUsers = await this.prisma.user.count({
        where: { isActive: true },
      });
      const adminUsers = await this.prisma.user.count({
        where: { role: 'ADMIN' },
      });

      // New users today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newUsersToday = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      });

      return {
        totalUsers,
        activeUsers,
        adminUsers,
        newUsersToday,
        inactiveUsers: totalUsers - activeUsers,
        regularUsers: totalUsers - adminUsers,
      };
    } catch (error) {
      this.logger.error('Failed to get user stats', error);
      throw error;
    }
  }

  async getFeatureStats() {
    try {
      const totalFeatures = await this.prisma.feature.count();
      const activeFeatures = await this.prisma.feature.count({
        where: { isEnabled: true },
      });

      // Most used feature (based on user access count)
      const featureUsage = await this.prisma.feature.findMany({
        include: {
          _count: {
            select: {
              userAccess: true,
            },
          },
        },
        orderBy: {
          userAccess: {
            _count: 'desc',
          },
        },
        take: 1,
      });

      const mostUsedFeature = featureUsage.length > 0 ? featureUsage[0].name : null;

      return {
        totalFeatures,
        activeFeatures,
        inactiveFeatures: totalFeatures - activeFeatures,
        mostUsedFeature,
      };
    } catch (error) {
      this.logger.error('Failed to get feature stats', error);
      throw error;
    }
  }

  async getActivityStats() {
    try {
      // For now, return mock data since we don't have activity logging yet
      // In a real implementation, you'd track user activities in a separate table

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      // For now, we can use user creation as activity proxy
      const todayActivities = await this.prisma.user.count({
        where: {
          updatedAt: {
            gte: today,
          },
        },
      });

      const weekActivities = await this.prisma.user.count({
        where: {
          updatedAt: {
            gte: weekAgo,
          },
        },
      });

      const monthActivities = await this.prisma.user.count({
        where: {
          updatedAt: {
            gte: monthAgo,
          },
        },
      });

      return {
        todayActivities,
        weekActivities,
        monthActivities,
        todaySuccess: Math.floor(todayActivities * 0.9), // Mock success rate
        successRate: 90, // Mock success rate
      };
    } catch (error) {
      this.logger.error('Failed to get activity stats', error);
      throw error;
    }
  }

  async getSystemStats() {
    try {
      const uptime = process.uptime();
      const uptimeFormatted = this.formatUptime(uptime);

      const memoryUsage = process.memoryUsage();
      const memoryUsageFormatted = `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`;

      // Database size (approximate)
      const userCount = await this.prisma.user.count();
      const featureCount = await this.prisma.feature.count();
      const accessCount = await this.prisma.userFeatureAccess.count();

      return {
        uptime: uptimeFormatted,
        memoryUsage: memoryUsageFormatted,
        databaseSize: `${userCount + featureCount + accessCount} records`,
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      };
    } catch (error) {
      this.logger.error('Failed to get system stats', error);
      throw error;
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}
