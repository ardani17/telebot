import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function addUser() {
  try {
    console.log('🔍 Adding/Verifying user in database...');

    // Get user information from command line arguments or use defaults
    const telegramId = process.argv[2] || '731289973';
    const name = process.argv[3] || 'Ardani';
    const username = process.argv[4] || 'yaelahdan';
    const role = (process.argv[5] as UserRole) || UserRole.ADMIN;

    console.log(`📋 User Info:
    - Telegram ID: ${telegramId}
    - Name: ${name}
    - Username: ${username}
    - Role: ${role}`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: telegramId },
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });

    if (existingUser) {
      console.log('✅ User already exists in database:');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Active: ${existingUser.isActive}`);
      console.log(`   Created: ${existingUser.createdAt}`);
      console.log(`   Feature Access: ${existingUser.featureAccess.length} features`);
      
      existingUser.featureAccess.forEach(access => {
        console.log(`     - ${access.feature.name}: ${access.feature.description}`);
      });

      // Update user if needed
      const updatedUser = await prisma.user.update({
        where: { telegramId: telegramId },
        data: {
          name: name,
          username: username,
          isActive: true,
        },
      });

      console.log('✅ User updated successfully');
      return updatedUser;
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        telegramId: telegramId,
        name: name,
        username: username,
        role: role,
        isActive: true,
      },
    });

    console.log('✅ New user created successfully:');
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Telegram ID: ${newUser.telegramId}`);
    console.log(`   Name: ${newUser.name}`);
    console.log(`   Role: ${newUser.role}`);

    // Grant access to all features if admin
    if (role === UserRole.ADMIN) {
      const features = await prisma.feature.findMany();
      
      for (const feature of features) {
        await prisma.userFeatureAccess.create({
          data: {
            userId: newUser.id,
            featureId: feature.id,
            grantedBy: newUser.id, // Self-granted for admin
          },
        });
        console.log(`   ✅ Granted access to feature: ${feature.name}`);
      }
    }

    return newUser;

  } catch (error) {
    console.error('❌ Error adding user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkDatabase() {
  try {
    console.log('\n📊 Database Status Check:');
    
    const userCount = await prisma.user.count();
    const featureCount = await prisma.feature.count();
    const configCount = await prisma.systemConfig.count();
    const botConfigCount = await prisma.botConfig.count();
    
    console.log(`   👥 Total Users: ${userCount}`);
    console.log(`   🎯 Total Features: ${featureCount}`);
    console.log(`   ⚙️  System Configs: ${configCount}`);
    console.log(`   🤖 Bot Configs: ${botConfigCount}`);

    // List all users
    const users = await prisma.user.findMany({
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });

    console.log('\n👥 All Users:');
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.telegramId}) - ${user.role} - Features: ${user.featureAccess.length}`);
    });

    // List all features
    const features = await prisma.feature.findMany();
    console.log('\n🎯 All Features:');
    features.forEach(feature => {
      console.log(`   - ${feature.name}: ${feature.description} (Enabled: ${feature.isEnabled})`);
    });

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 TeleWeb User Management Script\n');
  
  await checkDatabase();
  await addUser();
  
  console.log('\n🎉 Script completed successfully!');
}

main().catch(console.error); 