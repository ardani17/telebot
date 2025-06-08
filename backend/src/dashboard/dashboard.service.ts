import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  botActivities: number;
  todayActivities: number;
  userGrowthPercentage: number;
  activityGrowthPercentage: number;
  systemStatus: {
    database: 'healthy' | 'warning' | 'error';
    bot: 'healthy' | 'warning' | 'error';
    storage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

interface RecentActivity {
  id: string;
  type: string;
  user: string;
  description: string;
  timestamp: string;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get user statistics
      const totalUsers = await this.prisma.user.count();
      const activeUsers = await this.prisma.user.count({
        where: { isActive: true }
      });

      // Get file statistics (from FileMetadata model)
      const totalFiles = await this.prisma.fileMetadata.count();
      const todayFiles = await this.prisma.fileMetadata.count({
        where: {
          createdAt: {
            gte: startOfDay
          }
        }
      });

      // Get bot activities (from BotActivity model)
      const botActivities = await this.prisma.botActivity.count();
      const todayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: startOfDay
          }
        }
      });

      // Calculate growth percentages
      const userGrowthPercentage = await this.calculateUserGrowthPercentage();
      const activityGrowthPercentage = await this.calculateActivityGrowthPercentage();

      // Get storage information
      const storage = await this.getStorageInfo();

      // Check system status
      const systemStatus = {
        database: await this.checkDatabaseHealth(),
        bot: await this.checkBotHealth(),
        storage
      };

      return {
        totalUsers,
        activeUsers,
        botActivities,
        todayActivities,
        userGrowthPercentage,
        activityGrowthPercentage,
        systemStatus
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      
      // Return default/fallback data
      return {
        totalUsers: 0,
        activeUsers: 0,
        botActivities: 0,
        todayActivities: 0,
        userGrowthPercentage: 0,
        activityGrowthPercentage: 0,
        systemStatus: {
          database: 'error',
          bot: 'error',
          storage: {
            used: 0,
            total: 100 * 1024 * 1024 * 1024, // 100GB
            percentage: 0
          }
        }
      };
    }
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    const activities = await this.prisma.botActivity.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            telegramId: true
          }
        }
      }
    });

    return activities.map(activity => ({
      id: activity.id,
      type: activity.action,
      user: activity.user.name || activity.user.telegramId,
      description: activity.errorMessage || `${activity.action} ${activity.success ? 'completed' : 'failed'}`,
      timestamp: activity.createdAt.toISOString()
    }));
  }

  private async checkDatabaseHealth(): Promise<'healthy' | 'warning' | 'error'> {
    try {
      // Simple database ping
      await this.prisma.$queryRaw`SELECT 1`;
      return 'healthy';
    } catch (error) {
      return 'error';
    }
  }

  private async checkBotHealth(): Promise<'healthy' | 'warning' | 'error'> {
    try {
      // Check recent bot activity (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentActivity = await this.prisma.botActivity.findFirst({
        where: {
          createdAt: {
            gte: fiveMinutesAgo
          }
        }
      });

      if (recentActivity) {
        return 'healthy';
      }

      // Check if there's activity in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyActivity = await this.prisma.botActivity.findFirst({
        where: {
          createdAt: {
            gte: oneHourAgo
          }
        }
      });

      return hourlyActivity ? 'warning' : 'error';
    } catch (error) {
      return 'error';
    }
  }

  private async getStorageInfo(): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      // Get VPS system storage info using df command
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      
      if (parts.length >= 5) {
        // Parse df output: Filesystem Size Used Avail Use% Mounted
        const totalStr = parts[1];
        const usedStr = parts[2];
        const percentStr = parts[4];
        
        // Convert sizes to bytes
        const total = this.parseStorageSize(totalStr);
        const used = this.parseStorageSize(usedStr);
        const percentage = parseInt(percentStr.replace('%', ''));

        return {
          used,
          total,
          percentage: Math.min(percentage, 100)
        };
      } else {
        throw new Error('Invalid df output format');
      }
    } catch (error) {
      // Fallback: try to get basic filesystem stats
      try {
        const stats = fs.statSync('/');
        return {
          used: 0,
          total: 100 * 1024 * 1024 * 1024, // 100GB fallback
          percentage: 0
        };
      } catch (fallbackError) {
        return {
          used: 0,
          total: 100 * 1024 * 1024 * 1024, // 100GB fallback
          percentage: 0
        };
      }
    }
  }

  private parseStorageSize(sizeStr: string): number {
    const size = parseFloat(sizeStr);
    const unit = sizeStr.slice(-1).toUpperCase();
    
    switch (unit) {
      case 'K': return size * 1024;
      case 'M': return size * 1024 * 1024;
      case 'G': return size * 1024 * 1024 * 1024;
      case 'T': return size * 1024 * 1024 * 1024 * 1024;
      default: return size; // Assume bytes if no unit
    }
  }

  private async calculateUserGrowthPercentage(): Promise<number> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Count users created this week
      const thisWeekUsers = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: lastWeek
          }
        }
      });
      
      // Count users created previous week
      const previousWeekStart = new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previousWeekUsers = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: previousWeekStart,
            lt: lastWeek
          }
        }
      });
      
      if (previousWeekUsers === 0) return thisWeekUsers > 0 ? 100 : 0;
      
      const growthPercentage = ((thisWeekUsers - previousWeekUsers) / previousWeekUsers) * 100;
      return Math.round(growthPercentage * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      return 0;
    }
  }

  private async calculateActivityGrowthPercentage(): Promise<number> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      
      // Count activities today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: todayStart
          }
        }
      });
      
      // Count activities yesterday
      const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const yesterdayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: yesterdayStart,
            lt: todayStart
          }
        }
      });
      
      if (yesterdayActivities === 0) return todayActivities > 0 ? 100 : 0;
      
      const growthPercentage = ((todayActivities - yesterdayActivities) / yesterdayActivities) * 100;
      return Math.round(growthPercentage * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      return 0;
    }
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // If directory doesn't exist or can't be read, return 0
      return 0;
    }

    return totalSize;
  }

  async getSystemLogs(service: string = 'all', lines: number = 50) {
    try {
      const logs = {
        backend: [],
        frontend: [],
        bot: [],
        timestamp: new Date().toISOString()
      };

      // Get backend logs (from PM2 or console)
      if (service === 'all' || service === 'backend') {
        logs.backend = await this.getServiceLogs('backend', lines);
      }

      // Get frontend logs (from PM2 or console)
      if (service === 'all' || service === 'frontend') {
        logs.frontend = await this.getServiceLogs('frontend', lines);
      }

      // Get bot logs (from PM2 or console)
      if (service === 'all' || service === 'bot') {
        logs.bot = await this.getServiceLogs('bot', lines);
      }

      return logs;
    } catch (error) {
      return {
        backend: ['Error retrieving backend logs'],
        frontend: ['Error retrieving frontend logs'],
        bot: ['Error retrieving bot logs'],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async getSystemStatus() {
    try {
      const [dbHealth, botHealth, storage] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkBotHealth(),
        this.getStorageInfo()
      ]);

      // Check process status
      const processStatus = await this.checkProcessStatus();

      return {
        database: dbHealth,
        bot: botHealth,
        storage,
        processes: processStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: 'error',
        bot: 'error',
        storage: { used: 0, total: 0, percentage: 0 },
        processes: { backend: 'error', frontend: 'error', bot: 'error' },
        uptime: 0,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async getServiceLogs(service: string, lines: number): Promise<string[]> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      let command = '';
      
      switch (service) {
        case 'backend':
          // Try to get nest logs or fallback to generic logs
          command = `ps aux | grep "nest start" | grep -v grep | head -${lines}`;
          break;
        case 'frontend':
          command = `ps aux | grep "vite" | grep -v grep | head -${lines}`;
          break;
        case 'bot':
          command = `ps aux | grep "teleweb.*src/index" | grep -v grep | head -${lines}`;
          break;
        default:
          command = `ps aux | grep -E "(nest|vite|bot)" | grep -v grep | head -${lines}`;
      }

      const { stdout } = await execAsync(command);
      const logLines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      return logLines.length > 0 ? logLines : [`No ${service} processes found`];
    } catch (error) {
      return [`Error getting ${service} logs: ${error.message}`];
    }
  }

  private async checkProcessStatus() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const [backendCheck, frontendCheck, botCheck] = await Promise.all([
        execAsync('ps aux | grep "nest start" | grep -v grep').catch(() => ({ stdout: '' })),
        execAsync('ps aux | grep "vite" | grep -v grep').catch(() => ({ stdout: '' })),
        // Check for bot processes - look for teleweb processes with src/index.ts
        execAsync('ps aux | grep "teleweb.*src/index" | grep -v grep').catch(() => ({ stdout: '' }))
      ]);

      return {
        backend: backendCheck.stdout.trim() ? 'running' : 'stopped',
        frontend: frontendCheck.stdout.trim() ? 'running' : 'stopped',
        bot: botCheck.stdout.trim() ? 'running' : 'stopped'
      };
    } catch (error) {
      return {
        backend: 'error',
        frontend: 'error', 
        bot: 'error'
      };
    }
  }
} 