import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigType, SettingCategory } from '@prisma/client';
import { UpdateSettingsDto } from './dto/settings.dto';

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

      {
        key: 'jwt.refreshExpiresIn',
        value: '7d',
        category: SettingCategory.SECURITY,
        type: ConfigType.STRING,
        description: 'JWT refresh token expiration time',
        isEditable: true
      },
      {
        key: 'session.maxAge',
        value: '86400000',
        category: SettingCategory.SECURITY,
        type: ConfigType.NUMBER,
        description: 'Session maximum age in milliseconds',
        isEditable: true
      },

      // Rate Limiting
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

      // CORS Settings
      {
        key: 'cors.origin',
        value: 'http://localhost:3000,http://103.195.190.235:3000',
        category: SettingCategory.CORS,
        type: ConfigType.STRING,
        description: 'CORS allowed origins (comma separated)',
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
} 