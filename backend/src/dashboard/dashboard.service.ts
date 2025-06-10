import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
        where: { isActive: true },
      });

      // Get file statistics (from FileMetadata model)
      // Note: File stats not currently used in dashboard summary

      // Get bot activities (from BotActivity model)
      const botActivities = await this.prisma.botActivity.count();
      const todayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: startOfDay,
          },
        },
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
        storage,
      };

      return {
        totalUsers,
        activeUsers,
        botActivities,
        todayActivities,
        userGrowthPercentage,
        activityGrowthPercentage,
        systemStatus,
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
            percentage: 0,
          },
        },
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
            telegramId: true,
          },
        },
      },
    });

    return activities.map(activity => ({
      id: activity.id,
      type: activity.action,
      user: activity.user.name || activity.user.telegramId,
      description:
        activity.errorMessage || `${activity.action} ${activity.success ? 'completed' : 'failed'}`,
      timestamp: activity.createdAt.toISOString(),
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
            gte: fiveMinutesAgo,
          },
        },
      });

      if (recentActivity) {
        return 'healthy';
      }

      // Check if there's activity in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyActivity = await this.prisma.botActivity.findFirst({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
        },
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
      const execAsync = promisify(exec);

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
          percentage: Math.min(percentage, 100),
        };
      } else {
        throw new Error('Invalid df output format');
      }
    } catch (error) {
      // Fallback: try to get basic filesystem stats
      try {
        // Just check if path exists
        fs.statSync('/');
        return {
          used: 0,
          total: 100 * 1024 * 1024 * 1024, // 100GB fallback
          percentage: 0,
        };
      } catch (fallbackError) {
        return {
          used: 0,
          total: 100 * 1024 * 1024 * 1024, // 100GB fallback
          percentage: 0,
        };
      }
    }
  }

  private parseStorageSize(sizeStr: string): number {
    const size = parseFloat(sizeStr);
    const unit = sizeStr.slice(-1).toUpperCase();

    switch (unit) {
      case 'K':
        return size * 1024;
      case 'M':
        return size * 1024 * 1024;
      case 'G':
        return size * 1024 * 1024 * 1024;
      case 'T':
        return size * 1024 * 1024 * 1024 * 1024;
      default:
        return size; // Assume bytes if no unit
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
            gte: lastWeek,
          },
        },
      });

      // Count users created previous week
      const previousWeekStart = new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previousWeekUsers = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: previousWeekStart,
            lt: lastWeek,
          },
        },
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
      // Note: dayBeforeYesterday not currently used but may be needed for future calculations

      // Count activities today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      });

      // Count activities yesterday
      const yesterdayStart = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate()
      );
      const yesterdayActivities = await this.prisma.botActivity.count({
        where: {
          createdAt: {
            gte: yesterdayStart,
            lt: todayStart,
          },
        },
      });

      if (yesterdayActivities === 0) return todayActivities > 0 ? 100 : 0;

      const growthPercentage =
        ((todayActivities - yesterdayActivities) / yesterdayActivities) * 100;
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
        timestamp: new Date().toISOString(),
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
        error: error.message,
      };
    }
  }

  async getSystemStatus() {
    try {
      // Using os module import
      const [dbHealth, botHealth, storage] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkBotHealth(),
        this.getStorageInfo(),
      ]);

      // Check process status
      const processStatus = await this.checkProcessStatus();

      // Get system information
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const uptime = process.uptime();

      // Format uptime in human readable format
      const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        return `${days}d ${hours}h ${minutes}m`;
      };

      // Format memory sizes
      const formatMemory = (bytes: number) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
      };

      return {
        database: dbHealth,
        bot: botHealth,
        storage,
        processes: processStatus,
        // System information for Settings page
        nodejs: {
          version: process.version,
        },
        platform: os.platform(),
        arch: os.arch(),
        memory: {
          total: formatMemory(totalMemory),
          free: formatMemory(freeMemory),
          used: formatMemory(totalMemory - freeMemory),
          heapUsed: formatMemory(memoryUsage.heapUsed),
          heapTotal: formatMemory(memoryUsage.heapTotal),
        },
        cpus: os.cpus().length,
        uptime: formatUptime(uptime),
        uptimeSeconds: uptime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('System status error:', error);
      return {
        database: 'error',
        bot: 'error',
        storage: { used: 0, total: 0, percentage: 0 },
        processes: { backend: 'error', frontend: 'error', bot: 'error' },
        nodejs: { version: process.version || 'Unknown' },
        platform: 'Unknown',
        arch: 'Unknown',
        memory: {
          total: 'Unknown',
          free: 'Unknown',
          used: 'Unknown',
          heapUsed: 'Unknown',
          heapTotal: 'Unknown',
        },
        cpus: 0,
        uptime: 'Unknown',
        uptimeSeconds: 0,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async getServiceLogs(service: string, lines: number): Promise<string[]> {
    const execAsync = promisify(exec);

    try {
      let logPath = '';
      let serviceName = '';

      switch (service) {
        case 'backend':
          logPath = '/home/teleweb/logs/backend-out.log';
          serviceName = 'teleweb-backend';
          break;
        case 'frontend':
          // Frontend logs might not be available in production
          logPath = '/home/teleweb/logs/frontend-out.log';
          serviceName = 'teleweb-frontend';
          break;
        case 'bot':
          logPath = '/home/teleweb/logs/bot-out.log';
          serviceName = 'teleweb-bot';
          break;
        default:
          return [`Unknown service: ${service}`];
      }

      // First try to read from log files
      try {
        const { stdout } = await execAsync(`tail -n ${lines} "${logPath}" 2>/dev/null`);
        if (stdout.trim()) {
          return stdout.trim().split('\n').filter(line => line.length > 0);
        }
      } catch (fileError) {
        // If log file doesn't exist, try PM2 logs
      }

      // Fallback to PM2 logs
      try {
        const { stdout } = await execAsync(`pm2 logs ${serviceName} --nostream --lines ${lines} --out 2>/dev/null | tail -n ${lines}`);
        if (stdout.trim()) {
          return stdout.trim().split('\n').filter(line => line.length > 0);
        }
      } catch (pm2Error) {
        // If PM2 command fails, continue to next fallback
      }

      // If neither works, return a message
      return [`No logs available for ${service}`];
    } catch (error) {
      return [`Error getting ${service} logs: ${error.message}`];
    }
  }

  private async checkProcessStatus() {
    const execAsync = promisify(exec);

    try {
      const [backendCheck, frontendCheck, botCheck] = await Promise.all([
        execAsync('ps aux | grep "nest start" | grep -v grep').catch(() => ({ stdout: '' })),
        execAsync('ps aux | grep "vite" | grep -v grep').catch(() => ({ stdout: '' })),
        // Check for bot processes - look for teleweb processes with src/index.ts
        execAsync('ps aux | grep "teleweb.*src/index" | grep -v grep').catch(() => ({
          stdout: '',
        })),
      ]);

      return {
        backend: backendCheck.stdout.trim() ? 'running' : 'stopped',
        frontend: frontendCheck.stdout.trim() ? 'running' : 'stopped',
        bot: botCheck.stdout.trim() ? 'running' : 'stopped',
      };
    } catch (error) {
      return {
        backend: 'error',
        frontend: 'error',
        bot: 'error',
      };
    }
  }
}
