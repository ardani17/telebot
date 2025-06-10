import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function grantFeatures() {
  try {
    console.log('🔑 Granting feature access to user...');

    // Get parameters from command line
    const telegramId = process.argv[2];
    const featureNames = process.argv.slice(3); // All remaining arguments are feature names

    if (!telegramId) {
      console.error('❌ Usage: npm run user:grant-features <telegramId> <feature1> [feature2] ...');
      console.log('📋 Available features: ocr, rar, location, geotags, kml, workbook');
      return;
    }

    console.log(`📋 Granting features to Telegram ID: ${telegramId}`);
    console.log(`🎯 Features to grant: ${featureNames.join(', ')}`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramId },
    });

    if (!user) {
      console.error(`❌ User with Telegram ID ${telegramId} not found`);
      return;
    }

    console.log(`✅ User found: ${user.name} (${user.role})`);

    // Find admin user for granting
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.error('❌ No admin user found to grant access');
      return;
    }

    // Grant access to specified features
    let grantedCount = 0;
    for (const featureName of featureNames) {
      const feature = await prisma.feature.findUnique({
        where: { name: featureName },
      });

      if (!feature) {
        console.log(`⚠️  Feature '${featureName}' not found, skipping...`);
        continue;
      }

      // Check if access already exists
      const existingAccess = await prisma.userFeatureAccess.findUnique({
        where: {
          userId_featureId: {
            userId: user.id,
            featureId: feature.id,
          },
        },
      });

      if (existingAccess) {
        console.log(`ℹ️  User already has access to '${featureName}'`);
        continue;
      }

      // Grant access
      await prisma.userFeatureAccess.create({
        data: {
          userId: user.id,
          featureId: feature.id,
          grantedBy: adminUser.id,
        },
      });

      console.log(`✅ Granted access to '${featureName}'`);
      grantedCount++;
    }

    console.log(`\n🎉 Successfully granted access to ${grantedCount} features!`);

    // Show final user status
    const updatedUser = await prisma.user.findUnique({
      where: { telegramId: telegramId },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    console.log(`\n📊 Final status for ${updatedUser.name}:`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Total Features: ${updatedUser.featureAccess.length}`);
    updatedUser.featureAccess.forEach(access => {
      console.log(`   - ${access.feature.name}: ${access.feature.description}`);
    });
  } catch (error) {
    console.error('❌ Error granting features:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Show available features if no arguments
async function showAvailableFeatures() {
  try {
    const features = await prisma.feature.findMany();
    console.log('\n📋 Available Features:');
    features.forEach(feature => {
      console.log(`   - ${feature.name}: ${feature.description}`);
    });
  } catch (error) {
    console.error('Error fetching features:', error);
  }
}

// Main execution
async function main() {
  if (process.argv.length < 3) {
    console.log('🔑 TeleWeb Feature Access Management\n');
    console.log('Usage: npm run user:grant-features <telegramId> <feature1> [feature2] ...\n');
    await showAvailableFeatures();
    return;
  }

  await grantFeatures();
}

main().catch(console.error);
