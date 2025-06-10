#!/usr/bin/env node

// TeleWeb Admin Password Setup Script
// Script untuk mengatur password admin untuk login web

const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

function askPassword(question) {
  return new Promise(resolve => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    stdin.on('data', function (char) {
      char = char + '';

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    });
  });
}

async function setAdminPassword() {
  console.log('🔐 TeleWeb Admin Password Setup');
  console.log('================================\n');

  try {
    // Get admin telegram ID
    let telegramId = process.argv[2];

    if (!telegramId) {
      telegramId = await askQuestion('Masukkan Telegram ID admin: ');
    }

    if (!telegramId.trim()) {
      console.error('❌ Telegram ID tidak boleh kosong');
      process.exit(1);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: telegramId.trim() },
    });

    if (!existingUser) {
      console.log('❌ User dengan Telegram ID tersebut tidak ditemukan');
      console.log('   Silakan buat user terlebih dahulu atau pastikan Telegram ID benar');
      process.exit(1);
    }

    console.log(`✅ User ditemukan: ${existingUser.name} (${existingUser.telegramId})`);
    console.log(`   Role: ${existingUser.role}`);
    console.log('');

    // Get new password
    const password = await askPassword('Masukkan password baru: ');

    if (password.length < 6) {
      console.log('\n❌ Password minimal 6 karakter');
      process.exit(1);
    }

    const confirmPassword = await askPassword('Konfirmasi password: ');

    if (password !== confirmPassword) {
      console.log('\n❌ Password tidak cocok');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔒 Mengenkripsi password...');
    const hashedPassword = createHash('sha256').update(password).digest('hex');

    // Update user with password
    const updatedUser = await prisma.user.update({
      where: { telegramId: telegramId.trim() },
      data: {
        password: hashedPassword,
        isActive: true,
        role: existingUser.role === 'USER' ? 'ADMIN' : existingUser.role, // Promote to admin if needed
      },
    });

    console.log('✅ Password berhasil diatur!');
    console.log('\n📋 Informasi Login:');
    console.log(`   Telegram ID: ${updatedUser.telegramId}`);
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Status: ${updatedUser.isActive ? 'Active' : 'Inactive'}`);
    console.log('\n🌐 Sekarang Anda dapat login ke web admin dengan:');
    console.log(`   URL: http://localhost:3000`);
    console.log(`   Telegram ID: ${updatedUser.telegramId}`);
    console.log(`   Password: [password yang baru diatur]`);
  } catch (error) {
    console.error('❌ Error mengatur password:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('TeleWeb Admin Password Setup');
  console.log('============================');
  console.log('');
  console.log('Usage:');
  console.log('  node set-admin-password.js [telegram_id]');
  console.log('');
  console.log('Example:');
  console.log('  node set-admin-password.js 731289973');
  console.log('  node set-admin-password.js');
  console.log('');
  console.log('Jika telegram_id tidak disediakan, script akan meminta input.');
  process.exit(0);
}

setAdminPassword();
