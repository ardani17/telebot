#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        telegramId: true,
        name: true,
        username: true,
        role: true,
        password: true,
        isActive: true
      }
    });
    
    console.log('📋 Users in database:');
    console.log('=====================');
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('   You need to create an admin user first');
    } else {
      users.forEach(user => {
        console.log(`🟢 ${user.name} (${user.telegramId})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Username: ${user.username || 'N/A'}`);
        console.log(`   Password: ${user.password ? '✅ Set' : '❌ Not set'}`);
        console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 