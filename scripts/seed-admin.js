#!/usr/bin/env node

// TeleWeb Admin User Seeding Script
// This script adds the admin user from .env to the database

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Seeding admin user from .env...');
  
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  const adminName = process.env.ADMIN_NAME;
  const adminUsername = process.env.ADMIN_USERNAME;

  if (!adminTelegramId) {
    console.error('❌ ADMIN_TELEGRAM_ID not found in .env');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: adminTelegramId },
      include: { featureAccess: { include: { feature: true } } }
    });

    if (existingUser) {
      console.log(`✅ Admin user ${adminTelegramId} already exists`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Features: ${existingUser.featureAccess.length}`);
      return existingUser;
    }

    // Create admin user
    console.log(`📝 Creating admin user ${adminTelegramId}...`);
    
    const adminUser = await prisma.user.create({
      data: {
        telegramId: adminTelegramId,
        name: adminName || 'Admin',
        username: adminUsername || 'admin',
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log(`✅ Admin user created: ${adminUser.name} (${adminUser.telegramId})`);

    // Get all features
    const allFeatures = await prisma.feature.findMany();
    console.log(`📋 Found ${allFeatures.length} features to grant`);

    // Grant all features to admin
    for (const feature of allFeatures) {
      await prisma.userFeatureAccess.create({
        data: {
          userId: adminUser.id,
          featureId: feature.id,
          grantedBy: adminUser.id,
        },
      });
      console.log(`   ✓ Granted ${feature.name} feature`);
    }

    console.log(`🎉 Admin user setup completed!`);
    
    // Verify final state
    const finalUser = await prisma.user.findUnique({
      where: { telegramId: adminTelegramId },
      include: { featureAccess: { include: { feature: true } } }
    });

    console.log('\n📊 Final user state:');
    console.log(`   ID: ${finalUser.id}`);
    console.log(`   Telegram ID: ${finalUser.telegramId}`);
    console.log(`   Name: ${finalUser.name}`);
    console.log(`   Username: ${finalUser.username}`);
    console.log(`   Role: ${finalUser.role}`);
    console.log(`   Active: ${finalUser.isActive}`);
    console.log(`   Features: ${finalUser.featureAccess.length}`);
    
    finalUser.featureAccess.forEach(access => {
      console.log(`     - ${access.feature.name}: ${access.feature.description}`);
    });

    return finalUser;

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedAdmin();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedAdmin }; 