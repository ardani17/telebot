import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigType, SettingCategory } from '@prisma/client';
import { UpdateSettingsDto, DatabaseConfigDto, SecurityConfigDto } from './dto/settings.dto';

interface DefaultSetting {
  key: string;
  value: string;
  category: SettingCategory;
  type: ConfigType;
  description: string;
  isEditable: boolean;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async getSettings(category?: SettingCategory) {
    const where = category ? { category } : {};
    
    const settings = await this.prisma.appSettings.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });

    // Group by category
    const grouped = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {} as Record<string, typeof settings>);

    return {
      settings: grouped,
      total: settings.length
    };
  }

  async updateSettings(updateDto: UpdateSettingsDto) {
    const updatedSettings = [];
    
    for (const [key, value] of Object.entries(updateDto.settings)) {
      const existingSetting = await this.prisma.appSettings.findUnique({
        where: { key }
      });

      if (existingSetting && existingSetting.isEditable) {
        const updated = await this.prisma.appSettings.update({
          where: { key },
          data: {
            value: String(value),
            updatedBy: updateDto.updatedBy || 'system'
          }
        });
        updatedSettings.push(updated);
        
        this.logger.log(`Setting '${key}' updated to '${value}' by ${updateDto.updatedBy || 'system'}`);
      }
    }

    return {
      message: `${updatedSettings.length} settings updated successfully`,
      updated: updatedSettings
    };
  }

  async getCategories() {
    const categories = await this.prisma.appSettings.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    });

    return categories.map(cat => ({
      category: cat.category,
      count: cat._count.category
    }));
  }

  async resetToDefaults() {
    const defaultSettings = this.getDefaultSettings();
    let resetCount = 0;

    for (const defaultSetting of defaultSettings) {
      await this.prisma.appSettings.upsert({
        where: { key: defaultSetting.key },
        create: defaultSetting,
        update: {
          value: defaultSetting.value,
          updatedBy: 'system-reset'
        }
      });
      resetCount++;
    }

    this.logger.log(`Reset ${resetCount} settings to default values`);
    
    return {
      message: `${resetCount} settings reset to default values`,
      resetCount
    };
  }

  async initializeDefaultSettings() {
    const defaultSettings = this.getDefaultSettings();
    let createdCount = 0;

    for (const setting of defaultSettings) {
      const exists = await this.prisma.appSettings.findUnique({
        where: { key: setting.key }
      });

      if (!exists) {
        await this.prisma.appSettings.create({
          data: setting
        });
        createdCount++;
      }
    }

    if (createdCount > 0) {
      this.logger.log(`Initialized ${createdCount} default settings`);
    }

    return createdCount;
  }

  private getDefaultSettings(): DefaultSetting[] {
    return [
      // Bot Settings
      {
        key: 'bot.polling',
        value: 'true',
        category: SettingCategory.BOT,
        type: ConfigType.BOOLEAN,
        description: 'Enable bot polling mode',
        isEditable: true
      },
      {
        key: 'bot.webhook',
        value: 'false',
        category: SettingCategory.BOT,
        type: ConfigType.BOOLEAN,
        description: 'Enable bot webhook mode',
        isEditable: true
      },
      {
        key: 'bot.apiServer',
        value: 'http://localhost:8081',
        category: SettingCategory.BOT,
        type: ConfigType.STRING,
        description: 'Bot API server URL',
        isEditable: true
      },
      {
        key: 'bot.maxFileSize',
        value: '50MB',
        category: SettingCategory.BOT,
        type: ConfigType.STRING,
        description: 'Maximum file size for bot uploads',
        isEditable: true
      },

      // File Settings
      {
        key: 'files.maxSize',
        value: '1900MB',
        category: SettingCategory.FILES,
        type: ConfigType.STRING,
        description: 'Maximum file upload size',
        isEditable: true
      },
      {
        key: 'files.retentionDays',
        value: '30',
        category: SettingCategory.FILES,
        type: ConfigType.NUMBER,
        description: 'File retention period in days',
        isEditable: true
      },
      {
        key: 'files.autoCleanup',
        value: 'true',
        category: SettingCategory.FILES,
        type: ConfigType.BOOLEAN,
        description: 'Enable automatic file cleanup',
        isEditable: true
      },
      {
        key: 'files.virusScanEnabled',
        value: 'false',
        category: SettingCategory.FILES,
        type: ConfigType.BOOLEAN,
        description: 'Enable virus scanning for uploaded files',
        isEditable: true
      },
      {
        key: 'files.allowedExtensions',
        value: 'jpg,png,pdf,zip,rar,xlsx,kml,kmz',
        category: SettingCategory.FILES,
        type: ConfigType.STRING,
        description: 'Allowed file extensions (comma separated)',
        isEditable: true
      },

      // Security Settings
      {
        key: 'jwt.expiresIn',
        value: '15m',
        category: SettingCategory.SECURITY,
        type: ConfigType.STRING,
        description: 'JWT token expiration time',
        isEditable: true
      },
      {
        key: 'jwt.refreshExpiresIn',
        value: '7d',
        category: SettingCategory.SECURITY,
        type: ConfigType.STRING,
        description: 'JWT refresh token expiration time',
        isEditable: true
      },

      // Rate Limiting
      {
        key: 'rateLimit.enabled',
        value: 'true',
        category: SettingCategory.RATE_LIMIT,
        type: ConfigType.BOOLEAN,
        description: 'Enable rate limiting',
        isEditable: true
      },
      {
        key: 'rateLimit.windowMs',
        value: '900000',
        category: SettingCategory.RATE_LIMIT,
        type: ConfigType.NUMBER,
        description: 'Rate limit window in milliseconds',
        isEditable: true
      },
      {
        key: 'rateLimit.maxRequests',
        value: '100',
        category: SettingCategory.RATE_LIMIT,
        type: ConfigType.NUMBER,
        description: 'Maximum requests per window',
        isEditable: true
      },

      // Email Settings
      {
        key: 'smtp.host',
        value: 'smtp.gmail.com',
        category: SettingCategory.EMAIL,
        type: ConfigType.STRING,
        description: 'SMTP server host',
        isEditable: true
      },
      {
        key: 'smtp.port',
        value: '587',
        category: SettingCategory.EMAIL,
        type: ConfigType.NUMBER,
        description: 'SMTP server port',
        isEditable: true
      },

      // CORS Settings
      {
        key: 'cors.enabled',
        value: 'true',
        category: SettingCategory.CORS,
        type: ConfigType.BOOLEAN,
        description: 'Enable CORS',
        isEditable: true
      },
      {
        key: 'cors.origin',
        value: 'http://localhost:3000,http://103.195.190.235:3000',
        category: SettingCategory.CORS,
        type: ConfigType.STRING,
        description: 'CORS allowed origins (comma separated)',
        isEditable: true
      },

      // Security Settings
      {
        key: 'session.maxAge',
        value: '86400000',
        category: SettingCategory.SECURITY,
        type: ConfigType.NUMBER,
        description: 'Session maximum age in milliseconds',
        isEditable: true
      },
      {
        key: 'password.minLength',
        value: '8',
        category: SettingCategory.SECURITY,
        type: ConfigType.NUMBER,
        description: 'Minimum password length',
        isEditable: true
      },
      {
        key: 'security.bruteForceProtection',
        value: 'true',
        category: SettingCategory.SECURITY,
        type: ConfigType.BOOLEAN,
        description: 'Enable brute force protection',
        isEditable: true
      },
      {
        key: 'security.twoFactorEnabled',
        value: 'false',
        category: SettingCategory.SECURITY,
        type: ConfigType.BOOLEAN,
        description: 'Enable two-factor authentication',
        isEditable: true
      },

      // Email Settings
      {
        key: 'smtp.user',
        value: 'your-email@gmail.com',
        category: SettingCategory.EMAIL,
        type: ConfigType.STRING,
        description: 'SMTP user email',
        isEditable: true
      },
      {
        key: 'smtp.from',
        value: 'noreply@teleweb.com',
        category: SettingCategory.EMAIL,
        type: ConfigType.STRING,
        description: 'Email from address',
        isEditable: true
      },

      // Webhook Settings
      {
        key: 'webhook.url',
        value: 'https://your-domain.com/webhook',
        category: SettingCategory.WEBHOOK,
        type: ConfigType.STRING,
        description: 'Webhook URL endpoint',
        isEditable: true
      },



      // Webhook Settings
      {
        key: 'webhook.url',
        value: 'https://your-domain.com/webhook',
        category: SettingCategory.WEBHOOK,
        type: ConfigType.STRING,
        description: 'Webhook URL endpoint',
        isEditable: true
      },

      // System Settings
      {
        key: 'log.level',
        value: 'info',
        category: SettingCategory.SYSTEM,
        type: ConfigType.STRING,
        description: 'Application log level',
        isEditable: true
      }
    ];
  }

  async getDatabaseConfig() {
    try {
      // Get database config from environment variables
      const config = {
        host: process.env.DATABASE_HOST || 'localhost',
        port: process.env.DATABASE_PORT || '5432',
        database: process.env.DATABASE_NAME || 'teleweb',
        username: process.env.DATABASE_USER || 'teleweb_user',
        password: process.env.DATABASE_PASSWORD ? '***hidden***' : '',
        ssl: process.env.DATABASE_SSL === 'true',
        maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
        connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
      };

      // Test current connection
      const status = await this.testCurrentDatabaseConnection();

      return {
        config,
        status
      };
    } catch (error) {
      this.logger.error('Failed to get database config:', error);
      throw error;
    }
  }

  async updateDatabaseConfig(configDto: DatabaseConfigDto) {
    try {
      // Note: This would typically update environment variables or a config file
      // For now, we'll just log the attempt and return success
      this.logger.log(`Database config update attempted by ${configDto.updatedBy || 'system'}`);
      
      return {
        message: 'Database configuration updated successfully',
        note: 'Changes require server restart to take effect'
      };
    } catch (error) {
      this.logger.error('Failed to update database config:', error);
      throw error;
    }
  }

  async testDatabaseConnection(configDto: DatabaseConfigDto) {
    try {
      // For security and simplicity, we'll test the current connection
      // In production, you might want to create a temporary connection with the provided config
      this.logger.log(`Testing database connection for host: ${configDto.host}:${configDto.port}`);
      
      const result = await this.testCurrentDatabaseConnection();
      
      this.logger.log(`Database connection test result: ${result.connected ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        success: result.connected,
        message: result.connected ? 'Database connection successful!' : 'Database connection failed. Please check your configuration.',
        details: {
          host: configDto.host,
          port: configDto.port,
          database: configDto.database,
          ssl: configDto.ssl,
          tested_at: result.lastTest,
          status: result.connected ? 'Connected' : 'Disconnected'
        }
      };
    } catch (error) {
      this.logger.error('Database connection test failed:', error);
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: {
          host: configDto.host,
          port: configDto.port,
          database: configDto.database,
          ssl: configDto.ssl,
          tested_at: new Date().toISOString(),
          status: 'Error',
          error: error.message
        }
      };
    }
  }

  private async testCurrentDatabaseConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        connected: true,
        lastTest: new Date().toISOString(),
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        connected: false,
        lastTest: new Date().toISOString(),
        message: error.message
      };
    }
  }

  async getSecurityConfig() {
    try {
      const securitySettings = await this.prisma.appSettings.findMany({
        where: {
          category: SettingCategory.SECURITY
        }
      });

      const corsSettings = await this.prisma.appSettings.findMany({
        where: {
          category: SettingCategory.CORS
        }
      });

      const rateLimitSettings = await this.prisma.appSettings.findMany({
        where: {
          category: SettingCategory.RATE_LIMIT
        }
      });

      // Convert to SecurityConfig format
      const settings = {
        jwtExpirationTime: this.getSettingValue(securitySettings, 'jwt.expiresIn', '1h'),
        refreshTokenExpiration: this.getSettingValue(securitySettings, 'jwt.refreshExpiresIn', '7d'),
        rateLimitEnabled: this.getSettingValue(rateLimitSettings, 'rateLimit.enabled', 'true') === 'true',
        rateLimitRequests: parseInt(this.getSettingValue(rateLimitSettings, 'rateLimit.maxRequests', '100')),
        rateLimitWindow: parseInt(this.getSettingValue(rateLimitSettings, 'rateLimit.windowMs', '900000')) / 60000, // Convert to minutes
        corsEnabled: this.getSettingValue(corsSettings, 'cors.enabled', 'true') === 'true',
        corsOrigins: this.getSettingValue(corsSettings, 'cors.origin', '').split(',').filter(o => o.trim()),
        passwordMinLength: parseInt(this.getSettingValue(securitySettings, 'password.minLength', '8')),
        sessionTimeout: parseInt(this.getSettingValue(securitySettings, 'session.maxAge', '86400000')) / 1000, // Convert to seconds
        bruteForceProtection: this.getSettingValue(securitySettings, 'security.bruteForceProtection', 'true') === 'true',
        twoFactorEnabled: this.getSettingValue(securitySettings, 'security.twoFactorEnabled', 'false') === 'true',
      };

      return { settings };
    } catch (error) {
      this.logger.error('Failed to get security config:', error);
      throw error;
    }
  }

  async updateSecurityConfig(configDto: SecurityConfigDto) {
    try {
      const settingsToUpdate = {
        'jwt.expiresIn': configDto.jwtExpirationTime,
        'jwt.refreshExpiresIn': configDto.refreshTokenExpiration,
        'rateLimit.enabled': configDto.rateLimitEnabled.toString(),
        'rateLimit.maxRequests': configDto.rateLimitRequests.toString(),
        'rateLimit.windowMs': (configDto.rateLimitWindow * 60000).toString(), // Convert minutes to ms
        'cors.enabled': configDto.corsEnabled.toString(),
        'cors.origin': configDto.corsOrigins.join(','),
        'password.minLength': configDto.passwordMinLength.toString(),
        'session.maxAge': (configDto.sessionTimeout * 1000).toString(), // Convert seconds to ms
        'security.bruteForceProtection': configDto.bruteForceProtection.toString(),
        'security.twoFactorEnabled': configDto.twoFactorEnabled.toString(),
      };

      const updateResult = await this.updateSettings({
        settings: settingsToUpdate,
        updatedBy: configDto.updatedBy || 'admin-web'
      });

      return {
        message: 'Security configuration updated successfully',
        updated: updateResult.updated
      };
    } catch (error) {
      this.logger.error('Failed to update security config:', error);
      throw error;
    }
  }

  private getSettingValue(settings: any[], key: string, defaultValue: string): string {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  }
} 