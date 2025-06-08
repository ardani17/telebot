#!/usr/bin/env node

const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const testPassword = '123456';
const hashedPassword = hashPassword(testPassword);

console.log('🔐 Testing password hash');
console.log('Password:', testPassword);
console.log('Hashed:', hashedPassword);

// Test hash
const testHash = hashPassword('123456');
console.log('Match:', testHash === hashedPassword ? '✅' : '❌'); 