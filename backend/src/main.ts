import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { SettingsService } from './settings/settings.service';
import helmet from 'helmet';

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

    logger.log(
      `🎉 Admin user created: ${adminUser.name} (${adminUser.telegramId}) with ${allFeatures.length} features`
    );
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
    })
  );

  // Security middleware with comprehensive headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );

  // Trust proxy untuk Cloudflare
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // CORS configuration
  const allowedOrigins = [
    configService.get('CORS_ORIGIN', 'http://localhost:3000'),
    `http://${configService.get('PUBLIC_IP')}:3000`,
    `http://${configService.get('PUBLIC_IP')}:8080`,
    'https://teleweb.cloudnexify.com',
    'http://localhost:3000',
    'http://localhost:8080',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Only allow requests with no origin in development mode
      if (!origin) {
        const isDev = configService.get('NODE_ENV') === 'development';
        if (isDev) {
          return callback(null, true);
        } else {
          logger.warn('CORS blocked request with no origin in production');
          return callback(null, false);
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // Cache preflight for 24 hours
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
