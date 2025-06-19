const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
const envConfig = {};

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();
        // Remove surrounding quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        envConfig[key.trim()] = value;
      }
    }
  });
}

console.log('DATABASE_URL:', envConfig.DATABASE_URL);
console.log('POSTGRES_DB:', envConfig.POSTGRES_DB);
console.log('POSTGRES_USER:', envConfig.POSTGRES_USER);
console.log('POSTGRES_PASSWORD:', envConfig.POSTGRES_PASSWORD);
console.log('BACKEND_PORT:', envConfig.BACKEND_PORT);
console.log('\nTotal env vars loaded:', Object.keys(envConfig).length);
