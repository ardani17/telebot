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
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      cores: number;
      loadAverage: number[];
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

      // Get system performance metrics
      const memory = await this.getMemoryInfo();
      const cpu = await this.getCpuInfo();

      // Check system status
      const systemStatus = {
        database: await this.checkDatabaseHealth(),
        bot: await this.checkBotHealth(),
        storage,
        memory,
        cpu,
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
          memory: {
            used: 0,
            total: 8 * 1024 * 1024 * 1024, // 8GB
            percentage: 0,
          },
          cpu: {
            usage: 0,
            cores: os.cpus().length,
            loadAverage: [0, 0, 0],
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
      const execAsync = promisify(exec);
      
      // First check if bot process is running via PM2
      try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout || '[]');
        const botProcess = processes.find(p => p.name === 'teleweb-bot');
        
        if (!botProcess) {
          return 'error'; // Bot process not found
        }
        
        if (botProcess.pm2_env.status !== 'online') {
          return 'error'; // Bot process not online
        }
        
        // If process is online, check for recent activity as secondary indicator
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentActivity = await this.prisma.botActivity.findFirst({
          where: {
            createdAt: {
              gte: thirtyMinutesAgo,
            },
          },
        });

        if (recentActivity) {
          return 'healthy'; // Process online + recent activity
        }

        // Check if there's activity in the last 2 hours (bot might be idle but working)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const hourlyActivity = await this.prisma.botActivity.findFirst({
          where: {
            createdAt: {
              gte: twoHoursAgo,
            },
          },
        });

        // If process is online but no recent activity, consider it warning (idle but working)
        return hourlyActivity ? 'warning' : 'healthy';
        
      } catch (pm2Error) {
        console.error('PM2 check failed, falling back to activity check:', pm2Error);
        
        // Fallback to activity-based check if PM2 fails
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentActivity = await this.prisma.botActivity.findFirst({
          where: {
            createdAt: {
              gte: fifteenMinutesAgo,
            },
          },
        });

        return recentActivity ? 'healthy' : 'warning';
      }
    } catch (error) {
      console.error('Bot health check error:', error);
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

  private async getMemoryInfo(): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const percentage = Math.round((usedMemory / totalMemory) * 100);

      return {
        used: usedMemory,
        total: totalMemory,
        percentage,
      };
    } catch (error) {
      console.error('Memory info error:', error);
      return {
        used: 0,
        total: 8 * 1024 * 1024 * 1024, // 8GB default
        percentage: 0,
      };
    }
  }

  private async getCpuInfo(): Promise<{
    usage: number;
    cores: number;
    loadAverage: number[];
  }> {
    try {
      const cpus = os.cpus();
      const loadAvg = os.loadavg();

      // Calculate CPU usage by reading /proc/stat on Linux
      let cpuUsage = 0;
      try {
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(
          "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
        );
        cpuUsage = parseFloat(stdout.trim()) || 0;
      } catch (error) {
        // Fallback: estimate CPU usage from load average
        cpuUsage = Math.min((loadAvg[0] / cpus.length) * 100, 100);
      }

      return {
        usage: Math.round(cpuUsage * 100) / 100, // Round to 2 decimal places
        cores: cpus.length,
        loadAverage: loadAvg,
      };
    } catch (error) {
      console.error('CPU info error:', error);
      return {
        usage: 0,
        cores: os.cpus().length,
        loadAverage: [0, 0, 0],
      };
    }
  }

  async getSystemMetrics() {
    try {
      const [memory, cpu] = await Promise.all([
        this.getMemoryInfo(),
        this.getCpuInfo(),
      ]);

      return {
        memory: {
          used: memory.used,
          total: memory.total,
          percentage: memory.percentage,
          usedGB: (memory.used / 1024 / 1024 / 1024).toFixed(2),
          totalGB: (memory.total / 1024 / 1024 / 1024).toFixed(2),
        },
        cpu: {
          usage: cpu.usage,
          cores: cpu.cores,
          loadAverage: cpu.loadAverage,
          load1m: cpu.loadAverage[0],
          load5m: cpu.loadAverage[1],
          load15m: cpu.loadAverage[2],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('System metrics error:', error);
      return {
        memory: {
          used: 0,
          total: 8 * 1024 * 1024 * 1024, // 8GB default
          percentage: 0,
          usedGB: '0.00',
          totalGB: '8.00',
        },
        cpu: {
          usage: 0,
          cores: os.cpus().length,
          loadAverage: [0, 0, 0],
          load1m: 0,
          load5m: 0,
          load15m: 0,
        },
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
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
      switch (service) {
        case 'backend':
          return await this.getBackendLogs(lines, execAsync);
        case 'frontend':
          return await this.getFrontendLogs(lines, execAsync);
        case 'bot':
          return await this.getBotLogs(lines, execAsync);
        default:
          return [`Unknown service: ${service}`];
      }
    } catch (error) {
      return [`Error getting ${service} logs: ${error.message}`];
    }
  }

  private async getBackendLogs(lines: number, execAsync: any): Promise<string[]> {
    const logPath = '/home/teleweb/logs/backend-out.log';
    
    // Try to read from log files
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
      const { stdout } = await execAsync(
        `pm2 logs teleweb-backend --nostream --lines ${lines} --out 2>/dev/null | tail -n ${lines}`
      );
      if (stdout.trim()) {
        return stdout.trim().split('\n').filter(line => line.length > 0);
      }
    } catch (pm2Error) {
      // Continue to fallback
    }

    return [`No backend logs available`];
  }

  private async getBotLogs(lines: number, execAsync: any): Promise<string[]> {
    const logPath = '/home/teleweb/logs/bot-out.log';
    
    // Try to read from log files
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
      const { stdout } = await execAsync(
        `pm2 logs teleweb-bot --nostream --lines ${lines} --out 2>/dev/null | tail -n ${lines}`
      );
      if (stdout.trim()) {
        return stdout.trim().split('\n').filter(line => line.length > 0);
      }
    } catch (pm2Error) {
      // Continue to fallback
    }

    return [`No bot logs available`];
  }

  private async getFrontendLogs(lines: number, execAsync: any): Promise<string[]> {
    const logs: string[] = [];

    try {
      // Frontend uses Nginx, so get access logs (most relevant for production)
      const { stdout: accessLogs } = await execAsync(
        `tail -n ${Math.ceil(lines / 2)} /var/log/nginx/teleweb_access.log 2>/dev/null | head -n ${Math.ceil(lines / 2)}`
      ).catch(() => ({ stdout: '' }));

      if (accessLogs.trim()) {
        const accessLogLines = accessLogs.trim().split('\n').filter(line => line.length > 0);
        logs.push('[NGINX ACCESS]', ...accessLogLines);
      }

      // Get error logs if available
      const { stdout: errorLogs } = await execAsync(
        `tail -n ${Math.floor(lines / 2)} /var/log/nginx/teleweb_error.log 2>/dev/null | head -n ${Math.floor(lines / 2)}`
      ).catch(() => ({ stdout: '' }));

      if (errorLogs.trim()) {
        const errorLogLines = errorLogs.trim().split('\n').filter(line => line.length > 0);
        logs.push('[NGINX ERROR]', ...errorLogLines);
      }

      // Fallback: Try development logs if nginx logs not available
      if (logs.length === 0) {
        const { stdout: devLogs } = await execAsync(
          `tail -n ${lines} /home/teleweb/logs/frontend.log 2>/dev/null`
        ).catch(() => ({ stdout: '' }));

        if (devLogs.trim()) {
          const devLogLines = devLogs.trim().split('\n').filter(line => line.length > 0);
          logs.push('[VITE DEV]', ...devLogLines);
        }
      }

      return logs.length > 0 ? logs : [
        'Frontend (React+Vite) served as static files by Nginx',
        'Logs: Check nginx access/error logs',
        'Status: Frontend served successfully if you can access the web interface'
      ];

    } catch (error) {
      return [
        'Frontend Nginx logs not accessible',
        'Frontend is served as static files by Nginx',
        `Error: ${error.message}`
      ];
    }
  }

  private async checkProcessStatus() {
    const execAsync = promisify(exec);

    try {
      // Use PM2 to check process status for backend and bot
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout || '[]');
      
      const getProcessStatus = (processName: string) => {
        const process = processes.find(p => p.name === processName);
        if (!process) return 'stopped';
        return process.pm2_env.status === 'online' ? 'running' : 'stopped';
      };

      // Frontend is served by Nginx, not PM2, so check Nginx status
      const frontendStatus = await this.checkFrontendStatus(execAsync);

      return {
        backend: getProcessStatus('teleweb-backend'),
        frontend: frontendStatus,
        bot: getProcessStatus('teleweb-bot'),
      };
    } catch (error) {
      console.error('Process status check error:', error);
      // Fallback to ps aux method if PM2 fails
      try {
        const [backendCheck, botCheck, frontendCheck] = await Promise.all([
          execAsync('ps aux | grep "node.*backend" | grep -v grep').catch(() => ({ stdout: '' })),
          execAsync('ps aux | grep "node.*bot" | grep -v grep').catch(() => ({ stdout: '' })),
          this.checkFrontendStatus(execAsync),
        ]);

        return {
          backend: backendCheck.stdout.trim() ? 'running' : 'stopped',
          frontend: frontendCheck,
          bot: botCheck.stdout.trim() ? 'running' : 'stopped',
        };
      } catch (fallbackError) {
        return {
          backend: 'error',
          frontend: 'error',
          bot: 'error',
        };
      }
    }
  }

  private async checkFrontendStatus(execAsync: any): Promise<string> {
    try {
      // Frontend is served by Nginx as static files
      // Check if Nginx is running and serving teleweb
      const nginxCheck = await execAsync('ps aux | grep "nginx" | grep -v grep').catch(() => ({ stdout: '' }));
      
      if (!nginxCheck.stdout.trim()) {
        return 'stopped'; // Nginx not running
      }

      // Check if teleweb nginx config is active and frontend files exist
      const [configCheck, filesCheck] = await Promise.all([
        execAsync('nginx -T 2>/dev/null | grep -q "teleweb" && echo "config_ok"').catch(() => ({ stdout: '' })),
        execAsync('ls -la /home/teleweb/frontend/dist/index.html 2>/dev/null && echo "files_ok"').catch(() => ({ stdout: '' })),
      ]);

      if (configCheck.stdout.includes('config_ok') && filesCheck.stdout.includes('files_ok')) {
        return 'running'; // Nginx running + config exists + files exist
      }

      if (configCheck.stdout.includes('config_ok')) {
        return 'running'; // At least nginx config exists
      }

      // Final check: Try to access nginx teleweb logs (indicates it's configured)
      const logsCheck = await execAsync('ls -la /var/log/nginx/teleweb_access.log 2>/dev/null && echo "logs_ok"').catch(() => ({ stdout: '' }));
      
      if (logsCheck.stdout.includes('logs_ok')) {
        return 'running'; // Nginx serving teleweb (logs exist)
      }

      return 'stopped'; // Nginx running but teleweb not configured
      
    } catch (error) {
      console.error('Frontend status check error:', error);
      return 'unknown';
    }
  }
}
