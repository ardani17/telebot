#!/usr/bin/env node

// Load environment variables from parent directory
require('dotenv').config({ path: '../.env' });

// Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  console.error('Make sure ../env file exists and contains DATABASE_URL');
  process.exit(1);
}

console.log('DATABASE_URL loaded successfully');
console.log('Running prisma db push...');

// Run prisma db push using child_process
const { execSync } = require('child_process');

try {
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('✅ Database sync completed successfully');
} catch (error) {
  console.error('❌ Error running prisma db push:', error.message);
  process.exit(1);
}
