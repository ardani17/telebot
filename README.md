# TeleWeb - Telegram Bot Web Management System

TeleWeb adalah sistem manajemen bot Telegram yang terintegrasi dengan aplikasi web, memungkinkan administrasi bot dan fitur-fitur canggih melalui antarmuka web yang modern.

## 🚀 Features

- **Bot Management**: OCR, Archive Processing, Location Services, Geotags, KML, Workbook
- **Web Admin Panel**: User management, feature access control, file management
- **Real-time Monitoring**: System logs, bot activities, resource usage
- **Security**: JWT authentication, role-based access control, rate limiting
- **High Performance**: Support for high-volume message processing

## 📋 System Requirements

- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v13 or higher
- **Redis**: v6 or higher
- **Nginx**: For production deployment
- **PM2**: For process management
- **Telegram Bot API Server** (optional): For local file handling

## 🛠️ Installation Guide for New VPS

### 1. System Update & Basic Tools
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

### 2. Install Node.js
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PostgreSQL
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE teleweb;
CREATE USER root WITH PASSWORD 'teleweb_password';
GRANT ALL PRIVILEGES ON DATABASE teleweb TO root;
EOF
```

### 4. Install Redis
```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis password
sudo sed -i 's/# requirepass foobared/requirepass redis_password/g' /etc/redis/redis.conf
sudo systemctl restart redis-server
```

### 5. Install Nginx
```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6. Install PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup
pm2 startup
# Follow the instructions shown
```

### 7. Install Telegram Bot API Server (Optional)
```bash
# For local file handling (if needed)
# Download from: https://github.com/tdlib/telegram-bot-api
# Or build from source
```

### 8. Clone and Setup TeleWeb
```bash
# Clone repository
cd /home
git clone https://github.com/yourusername/teleweb.git
cd teleweb

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your configuration
```

### 9. Setup Google Cloud Vision (for OCR)
```bash
# Create config directory
mkdir -p /home/teleweb/config

# Add your Google Cloud key
nano /home/teleweb/config/google-cloud-key.json
```

### 10. Build Applications
```bash
# Build all applications
npm run build:all

# Or build individually
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
cd bot && npm run build && cd ..
```

## 🚀 Production Start Guide

### Smart Deployment (Recommended)
```bash
cd /home/teleweb
./deploy.sh
```

This automated script will:
- ✅ Check PostgreSQL connection
- ✅ Auto-detect if database is empty
- ✅ Setup database schema if needed
- ✅ Seed admin user if needed
- ✅ Start all services with PM2
- ✅ Run health checks

### Quick Start (Legacy)
```bash
cd /home/teleweb
./scripts/prod-start-no-docker.sh
```

This script will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Build all applications
- ✅ Setup database migrations
- ✅ Configure Nginx
- ✅ Start Telegram API Server
- ✅ Start all services with PM2

### Manual Start
```bash
# 1. Start Telegram API Server (if using local bot API)
./scripts/telegram-api-server.sh start

# 2. Start services with PM2
pm2 start ecosystem.config.js --env production

# 3. Save PM2 configuration
pm2 save
```

## 📦 Database & Prisma Management

### Understanding Prisma Components

TeleWeb menggunakan **Prisma ORM** untuk database management. Ada 2 komponen terpisah:

1. **Prisma Client** - Sudah di-bundle ke aplikasi, otomatis berjalan
2. **Database Schema** - Perlu setup manual saat database kosong

### Deployment Scenarios

| Skenario | PM2 Start Langsung | Perlu Setup Database |
|----------|-------------------|-------------------|
| **Restart VPS sama** | ✅ Bisa langsung | ❌ Tidak perlu |
| **Pindah VPS baru** | ❌ Error database | ✅ Wajib setup |
| **Update schema** | ❌ Error schema | ✅ Wajib update |

### Database Setup Commands

#### Auto Setup (Recommended)
```bash
cd /home/teleweb
./deploy.sh  # Otomatis detect & setup database
```

#### Manual Setup
```bash
# 1. Setup database schema (jika database kosong)
cd /home/teleweb/backend
npx dotenv -e ../.env -- prisma db push --skip-generate

# 2. Seed admin user (jika belum ada)
cd /home/teleweb/scripts
node seed-admin.js

# 3. Start services
cd /home/teleweb
pm2 start ecosystem.config.js
```

#### Development/Schema Updates
```bash
# Generate Prisma client
cd /home/teleweb/backend
npx dotenv -e ../.env -- prisma generate

# Push schema changes
npx dotenv -e ../.env -- prisma db push --skip-generate

# Restart services
cd /home/teleweb
pm2 restart all
```

### Environment Configuration

Semua services menggunakan **single .env file** di `/home/teleweb/.env`:

- ✅ **Backend**: `envFilePath: '../.env'`
- ✅ **Bot**: `dotenv.config({ path: '../.env' })`
- ✅ **Frontend**: `envDir: '../'`
- ✅ **PM2**: Reads dari current directory

**Tidak ada .env lokal** di subdirectory untuk menghindari konflik konfigurasi.

### Service Management
```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Monitor resources
pm2 monit
```

## 🔄 Changing IP Address or Domain

### When Moving to New VPS or Changing Domain

#### Option 1: Using Update Script (Recommended)
```bash
cd /home/teleweb
./scripts/update-env-urls.sh
```

Select one of the options:
1. Use current IP address
2. Use a domain name (with HTTPS support)
3. Use a different IP address
4. Use localhost (development)

The script will automatically update:
- `BACKEND_URL`
- `BOT_API_SERVER`
- `CORS_ORIGIN`
- All related configurations

#### Option 2: Manual Update
1. Edit `.env` file:
```bash
nano /home/teleweb/.env
```

2. Update these variables:
```env
# For IP-based setup
PUBLIC_IP=YOUR_NEW_IP
BACKEND_URL=http://YOUR_NEW_IP:3001/api
BOT_API_SERVER=http://YOUR_NEW_IP:8081
CORS_ORIGIN=http://YOUR_NEW_IP

# For domain-based setup (with Cloudflare)
PUBLIC_IP=YOUR_SERVER_IP
BACKEND_URL=https://yourdomain.com/api
BOT_API_SERVER=http://YOUR_SERVER_IP:8081  # Bot uses direct IP
CORS_ORIGIN=https://yourdomain.com
```

3. Update Nginx configuration:
```bash
sudo nano /etc/nginx/sites-enabled/teleweb
# Change server_name to your domain
```

4. Restart all services:
```bash
pm2 restart all --update-env
sudo nginx -s reload
```

### Cloudflare Configuration (If Using Domain)
1. Add A record pointing to your server IP
2. Set SSL/TLS mode to "Flexible"
3. Enable proxy (orange cloud)
4. Wait for DNS propagation

## 📁 Project Structure

```
teleweb/
├── backend/        # NestJS backend API
├── frontend/       # React web interface
├── bot/           # Telegram bot
├── shared/        # Shared types and utilities
├── scripts/       # Utility scripts
├── logs/          # Application logs
└── ecosystem.config.js  # PM2 configuration
```

## 🔧 Configuration Files

### Environment Variables (.env)
Key variables to configure:
- Database connection
- Redis connection
- Telegram bot token
- API credentials
- Port configurations
- Domain/IP settings

### Nginx Configuration
Default location: `/etc/nginx/sites-enabled/teleweb`
- Port 80 for web interface
- Proxy to backend on port 3001
- Cloudflare real IP support

### PM2 Configuration
File: `ecosystem.config.js`
- Auto-restart on failure
- Log rotation
- Environment variable loading

## 📊 Monitoring & Logs

### Real-time Logs
```bash
# All services
pm2 logs

# Specific service
pm2 logs teleweb-backend
pm2 logs teleweb-bot

# Telegram API Server
tail -f /home/teleweb/logs/telegram-bot-api.log
```

### Web Dashboard
Access system monitoring at: `http://your-domain/dashboard`
- Real-time system logs
- Resource usage
- Bot activities
- User statistics

## 🛟 Troubleshooting

### Common Issues After VPS Restart

#### Backend Error: "DATABASE_URL not found"
**Symptoms:**
- Backend logs show Prisma validation errors
- Bot gets 502 Bad Gateway responses
- `pm2 start ecosystem.config.js` fails

**Root Cause:**
- Environment variables tidak terbaca dengan benar
- Database schema mungkin hilang

**Solution:**
```bash
cd /home/teleweb
./deploy.sh  # Auto-fix database dan environment
```

#### Environment Configuration Conflicts
**Symptoms:**
- Services menggunakan konfigurasi berbeda
- Database connection errors randomly

**Root Cause:**
- Multiple .env files dengan konfigurasi berbeda
- Inconsistent environment loading

**Solution:**
```bash
# Pastikan hanya ada 1 .env file
ls -la backend/.env bot/.env frontend/.env  # Should not exist
ls -la .env  # Should exist

# Re-deploy jika ada konflik
./deploy.sh
```

### Standard Troubleshooting

#### Bot Not Responding
```bash
# Check bot status
pm2 status teleweb-bot

# Check bot logs
pm2 logs teleweb-bot --lines 100

# Restart bot
pm2 restart teleweb-bot
```

#### Web Interface Not Accessible
```bash
# Check nginx
sudo systemctl status nginx
sudo nginx -t

# Check backend
pm2 status teleweb-backend
curl http://localhost:3001/api/health
```

#### Database Connection Issues
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1;"

# Setup database schema
cd /home/teleweb/backend
npx dotenv -e ../.env -- prisma db push --skip-generate
```

#### Prisma Environment Issues
```bash
# Install dotenv-cli jika belum ada
cd /home/teleweb/backend
npm install --save-dev dotenv-cli

# Generate Prisma client dengan environment
npx dotenv -e ../.env -- prisma generate

# Push schema ke database
npx dotenv -e ../.env -- prisma db push --skip-generate
```

### Debug Commands
```bash
# Test environment loading
cd /home/teleweb
node test-config.js

# Check database connection
psql -U root -h localhost -d teleweb -p 5432 -c "SELECT current_database();"

# Verify Prisma schema
cd backend
npx dotenv -e ../.env -- prisma validate

# Check PM2 environment
pm2 describe teleweb-backend
```

## 🔒 Security Notes

1. Always use strong passwords in production
2. Configure firewall (ufw) to restrict access
3. Use HTTPS in production (Let's Encrypt recommended)
4. Regularly update dependencies
5. Monitor logs for suspicious activities

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

Untuk pertanyaan atau dukungan, hubungi:

- Email: your-email@domain.com
- Telegram: @your-username

---

**TeleWeb** - Bridging Telegram Bot and Web Application for seamless file
processing and management.
