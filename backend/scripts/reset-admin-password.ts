import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function resetAdminPassword() {
  try {
    console.log('🔧 Reset Admin Password Script');
    console.log('================================');

    // Get admin telegram ID from environment or ask user
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID || '731289973';
    
    console.log(`Admin Telegram ID: ${adminTelegramId}`);

    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { telegramId: adminTelegramId },
    });

    if (!adminUser) {
      console.error('❌ Admin user not found with Telegram ID:', adminTelegramId);
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${adminUser.name} (${adminUser.username})`);

    // Ask for new password
    const newPassword = await new Promise<string>((resolve) => {
      rl.question('Enter new password for admin: ', (password) => {
        resolve(password);
      });
    });

    if (!newPassword || newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Hash password with bcrypt
    console.log('🔐 Hashing password with bcrypt...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: hashedPassword },
    });

    console.log('✅ Admin password updated successfully!');
    console.log('🔑 Password is now hashed with bcrypt (salt rounds: 12)');
    console.log('🌐 You can now login to the web interface with the new password');

  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

resetAdminPassword(); 