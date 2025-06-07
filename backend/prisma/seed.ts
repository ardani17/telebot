import { PrismaClient, UserRole, BotMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID || '731289973';
  const adminName = process.env.ADMIN_NAME || 'Ardani';
  const adminUsername = process.env.ADMIN_USERNAME || 'yaelahdan';

  const adminUser = await prisma.user.upsert({
    where: { telegramId: adminTelegramId },
    update: {},
    create: {
      telegramId: adminTelegramId,
      name: adminName,
      username: adminUsername,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Admin user created/updated:', {
    id: adminUser.id,
    name: adminUser.name,
    telegramId: adminUser.telegramId,
    role: adminUser.role
  });

  // Create default features
  const features = [
    { 
      name: 'ocr', 
      description: 'OCR Text Recognition from Images - Extract text from images using Google Vision API' 
    },
    { 
      name: 'rar', 
      description: 'Archive Extraction and Management - Extract and process ZIP, RAR, 7Z files' 
    },
    { 
      name: 'location', 
      description: 'Location and GPS Processing - Process location data and coordinates' 
    },
    { 
      name: 'geotags', 
      description: 'Geotag Extraction from Images - Extract GPS coordinates from image EXIF data' 
    },
    { 
      name: 'kml', 
      description: 'KML File Processing - Process and convert KML/KMZ geographic files' 
    },
    { 
      name: 'workbook', 
      description: 'Excel/CSV File Processing - Process spreadsheet files and data conversion' 
    },
  ];

  for (const featureData of features) {
    const feature = await prisma.feature.upsert({
      where: { name: featureData.name },
      update: { description: featureData.description },
      create: {
        name: featureData.name,
        description: featureData.description,
        isEnabled: true,
      },
    });

    // Grant access to admin user
    await prisma.userFeatureAccess.upsert({
      where: {
        userId_featureId: {
          userId: adminUser.id,
          featureId: feature.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        featureId: feature.id,
        grantedBy: adminUser.id,
      },
    });

    console.log(`✅ Feature '${featureData.name}' created and granted to admin`);
  }

  // Create bot configuration
  const botToken = process.env.BOT_TOKEN || 'default-token';
  const botApiServer = process.env.BOT_API_SERVER || 'https://api.telegram.org';

  const botConfig = await prisma.botConfig.upsert({
    where: { token: botToken },
    update: {
      apiServer: botApiServer,
      isActive: true,
    },
    create: {
      token: botToken,
      apiServer: botApiServer,
      isActive: true,
      maxFileSize: 1900 * 1024 * 1024, // 1.9GB
      allowedFileTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/zip', 'application/x-rar-compressed', 
        'application/x-7z-compressed', 'application/pdf',
        'text/plain', 'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-earth.kml+xml',
        'application/vnd.google-earth.kmz'
      ],
    },
  });

  // Create bot feature configurations
  for (const featureData of features) {
    const feature = await prisma.feature.findUnique({
      where: { name: featureData.name }
    });

    if (feature) {
      await prisma.botFeatureConfig.upsert({
        where: {
          botConfigId_feature: {
            botConfigId: botConfig.id,
            feature: featureData.name as BotMode,
          },
        },
        update: {},
        create: {
          botConfigId: botConfig.id,
          feature: featureData.name as BotMode,
          enabled: true,
          config: {
            maxFileSize: 100 * 1024 * 1024, // 100MB per feature
            supportedFormats: getFeatureSupportedFormats(featureData.name),
          },
        },
      });
    }
  }

  console.log('✅ Bot configuration created:', {
    id: botConfig.id,
    apiServer: botConfig.apiServer,
    maxFileSize: `${Math.round(botConfig.maxFileSize / 1024 / 1024)}MB`
  });

  // Create some system config entries
  const systemConfigs = [
    {
      key: 'MAINTENANCE_MODE',
      value: 'false',
      description: 'Enable/disable maintenance mode for the bot',
      type: 'BOOLEAN'
    },
    {
      key: 'MAX_USERS_PER_DAY',
      value: '100',
      description: 'Maximum new users that can register per day',
      type: 'NUMBER'
    },
    {
      key: 'WELCOME_MESSAGE',
      value: 'Selamat datang di TeleWeb Bot! Silakan gunakan /help untuk melihat fitur yang tersedia.',
      description: 'Welcome message for new users',
      type: 'STRING'
    }
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        key: config.key,
        value: config.value,
        description: config.description,
        type: config.type as any,
        updatedBy: adminUser.id,
      },
    });
  }

  console.log('✅ System configurations created');

  console.log('🎉 Database seeding completed successfully!');
  
  // Print summary
  const userCount = await prisma.user.count();
  const featureCount = await prisma.feature.count();
  const configCount = await prisma.systemConfig.count();
  
  console.log('\n📊 Database Summary:');
  console.log(`   👥 Users: ${userCount}`);
  console.log(`   🎯 Features: ${featureCount}`);
  console.log(`   ⚙️  System Configs: ${configCount}`);
  console.log(`   🤖 Bot Configs: 1`);
}

function getFeatureSupportedFormats(featureName: string): string[] {
  switch (featureName) {
    case 'ocr':
      return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    case 'rar':
      return ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'];
    case 'geotags':
      return ['image/jpeg', 'image/png'];
    case 'kml':
      return ['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz'];
    case 'workbook':
      return ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    case 'location':
      return ['text/plain', 'application/json'];
    default:
      return ['*/*'];
  }
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
