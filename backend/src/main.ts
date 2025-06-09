import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { SettingsService } from './settings/settings.service';

async function seedAdminUser(app: any, configService: ConfigService, logger: Logger) {
  const prisma = app.get(PrismaService);
  
  const adminTelegramId = configService.get('ADMIN_TELEGRAM_ID');
  const adminName = configService.get('ADMIN_NAME', 'Admin');
  const adminUsername = configService.get('ADMIN_USERNAME', 'admin');

  if (!adminTelegramId) {
    logger.warn('⚠️  ADMIN_TELEGRAM_ID not found in .env - skipping admin user setup');
    return;
  }

  try {
    // Check if admin user exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: adminTelegramId },
    });

    if (existingUser) {
      logger.log(`✅ Admin user ${adminTelegramId} already exists`);
      return;
    }

    // Create admin user
    logger.log(`🌱 Creating admin user ${adminTelegramId}...`);
    
    const adminUser = await prisma.user.create({
      data: {
        telegramId: adminTelegramId,
        name: adminName,
        username: adminUsername,
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Get all features and grant to admin
    const allFeatures = await prisma.feature.findMany();
    
    for (const feature of allFeatures) {
      await prisma.userFeatureAccess.create({
        data: {
          userId: adminUser.id,
          featureId: feature.id,
          grantedBy: adminUser.id,
        },
      });
    }

    logger.log(`🎉 Admin user created: ${adminUser.name} (${adminUser.telegramId}) with ${allFeatures.length} features`);

  } catch (error) {
    logger.error('❌ Error seeding admin user:', error);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const corsOrigins = [
    configService.get('CORS_ORIGIN', 'http://localhost:3000'),
    `http://${configService.get('PUBLIC_IP')}:3000`,
    `http://${configService.get('PUBLIC_IP')}:5173`, // Vite dev server
  ].filter(Boolean);
  
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Telegram Bot Web Integration API')
    .setDescription('API documentation for Telegram Bot Web Integration')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Seed admin user
  await seedAdminUser(app, configService, logger);

  // Initialize default settings
  const settingsService = app.get(SettingsService);
  await settingsService.initializeDefaultSettings();

  const port = configService.get('BACKEND_PORT', 3001);
  const host = configService.get('SERVER_HOST', '0.0.0.0');
  
  await app.listen(port, host);
  
  logger.log(`🚀 Application is running on: http://${host}:${port}`);
  logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
}

bootstrap();
