#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function setPassword() {
  const prisma = new PrismaClient();
  
  try {
    const telegramId = '731289973';
    const password = '123456';
    
    // Hash password
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    console.log('🔄 Setting password for user:', telegramId);
    console.log('🔐 Password hash:', hashedPassword);
    
    // Update user password
    const updatedUser = await prisma.user.update({
      where: { telegramId },
      data: { password: hashedPassword },
    });
    
    console.log('✅ Password updated successfully!');
    console.log('📋 User info:', {
      id: updatedUser.id,
      telegramId: updatedUser.telegramId,
      name: updatedUser.name,
      role: updatedUser.role,
      hasPassword: !!updatedUser.password
    });
    
  } catch (error) {
    console.error('❌ Error setting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setPassword(); 