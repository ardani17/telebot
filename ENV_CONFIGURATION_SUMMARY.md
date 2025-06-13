# Environment Configuration Summary - TeleWeb

## Current Configuration (All Using Main .env)

### Main .env Location
- **Path**: `/home/teleweb/.env`
- **Status**: ✅ Single source of truth for all environment variables

### Backend Configuration
- **File**: `backend/src/app.module.ts`
- **Config**: `envFilePath: '../.env'`
- **Status**: ✅ Correctly pointing to main .env

### Bot Configuration  
- **File**: `bot/src/index.ts`
- **Config**: `dotenv.config({ path: '../.env' });`
- **Status**: ✅ Correctly pointing to main .env

### Frontend Configuration
- **File**: `frontend/vite.config.ts`
- **Config**: `envDir: '../'`
- **Status**: ✅ Correctly pointing to main .env directory

### PM2 Ecosystem Configuration
- **File**: `ecosystem.config.js`
- **Config**: Reads from `.env` in current directory
- **Status**: ✅ Correctly loading main .env

### Scripts Configuration
- **File**: `scripts/seed-admin.js`
- **Config**: `dotenv.config({ path: '../.env' });`
- **Status**: ✅ Correctly pointing to main .env

## Removed .env Files
- ❌ `backend/.env` - Removed
- ❌ `bot/.env` - Removed  
- ❌ `frontend/.env` - Removed

## Key Environment Variables Needed
- `DATABASE_URL` - PostgreSQL connection string
- `BOT_TOKEN` - Telegram bot token
- `BACKEND_URL` - Backend API URL
- `BACKEND_PORT` - Backend server port
- `JWT_SECRET` - JWT signing secret
- `ADMIN_TELEGRAM_ID` - Admin user Telegram ID

## Testing Commands
```bash
# Test config loading
cd /home/teleweb
node test-config.js

# Test backend env
cd backend
node -e "console.log(process.env.DATABASE_URL)"

# Test bot env  
cd ../bot
node -e "require('dotenv').config({ path: '../.env' }); console.log(process.env.BOT_TOKEN)"
```

## Restart Services
```bash
cd /home/teleweb
pm2 kill
pm2 start ecosystem.config.js
pm2 logs --lines 10
``` 