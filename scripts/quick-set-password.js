const { createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setPassword() {
  const password = 'admin123';
  const hashedPassword = createHash('sha256').update(password).digest('hex');
  
  const updatedUser = await prisma.user.update({
    where: { telegramId: '731289973' },
    data: { password: hashedPassword }
  });
  
  console.log('✅ Password berhasil diatur untuk user:', updatedUser.name);
  console.log('📋 Login credentials:');
  console.log('   Telegram ID: 731289973');
  console.log('   Password: admin123');
  
  await prisma.$disconnect();
}

setPassword().catch(console.error); 