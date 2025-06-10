// Quick test to check environment variables
require('dotenv').config({ path: '../.env' });

console.log('=== ENVIRONMENT TEST ===');
console.log('BOT_API_DATA_PATH:', process.env.BOT_API_DATA_PATH);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Current working directory:', process.cwd());

const fs = require('fs-extra');
const path = require('path');

async function testPath() {
  const botApiDataPath = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
  const testUserPath = path.join(botApiDataPath, '731289973');

  console.log('=== PATH TEST ===');
  console.log('botApiDataPath:', botApiDataPath);
  console.log('testUserPath:', testUserPath);
  console.log('Path exists:', await fs.pathExists(testUserPath));

  if (await fs.pathExists(testUserPath)) {
    try {
      const items = await fs.readdir(testUserPath);
      console.log('Directory contents:', items);
    } catch (error) {
      console.error('Error reading directory:', error.message);
    }
  }
}

testPath().catch(console.error);
