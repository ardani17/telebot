# TeleWeb Production Setup Guide (Non-Docker)

Panduan lengkap untuk menjalankan TeleWeb di production tanpa Docker.

## 📋 Prerequisites

### System Requirements
- Ubuntu 20.04+ atau sistem Linux yang mendukung systemd
- Node.js 18+ dan npm
- PostgreSQL 12+
- Redis 6+ (opsional tapi direkomendasikan)
- Nginx (untuk frontend)
- PM2 (untuk process management)

### Dependencies Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo apt install build-essential -y
```

## 🗄️ Database Setup

### PostgreSQL Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE teleweb;
CREATE USER teleweb_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE teleweb TO teleweb_user;
\q

# Enable and start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Redis Configuration

```bash
# Start and enable Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

## 📁 Application Setup

### 1. Clone and Setup Application

```bash
# Navigate to your deployment directory
cd /home

# Clone or upload your TeleWeb project
# git clone your_repo teleweb
# OR upload your files to /home/teleweb

cd teleweb

# Make scripts executable
chmod +x scripts/*.sh
```

### 2. Environment Configuration

```bash
# Copy the example environment file
cp docs/production.env.example .env

# Edit the environment file
nano .env
```

**Required environment variables:**
```bash
# Bot Configuration
BOT_TOKEN=your_bot_token_from_botfather
BOT_USERNAME=your_bot_username

# Database
DATABASE_URL=postgresql://teleweb_user:your_secure_password@localhost:5432/teleweb

# Telegram API
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash

# Admin User
ADMIN_TELEGRAM_ID=your_telegram_user_id
ADMIN_NAME="Your Name"
ADMIN_USERNAME="yourusername"

# Server
NODE_ENV=production
FRONTEND_URL=http://yourdomain.com
CORS_ORIGIN=http://yourdomain.com

# Security
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
REFRESH_TOKEN_SECRET=your_super_secure_refresh_token_secret
```

### 3. Install Telegram Bot API Server

```bash
# Download and install telegram-bot-api
cd /tmp
git clone --recursive https://github.com/tdlib/telegram-bot-api.git
cd telegram-bot-api
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build . --target install

# The binary will be installed to /usr/local/bin/telegram-bot-api
```

## 🚀 Deployment

### 1. Run Production Setup

```bash
cd /home/teleweb

# Run the non-Docker production setup
./scripts/prod-start-no-docker.sh
```

**Script akan melakukan:**
- ✅ Cek dan start PostgreSQL & Redis
- ✅ Install dependencies
- ✅ Build backend, frontend, dan bot
- ✅ Generate Prisma client
- ✅ Test database connection
- ✅ Run database migrations
- ✅ Setup admin user
- ✅ Start Telegram API Server sebagai systemd service
- ✅ Start aplikasi dengan PM2

### 2. Configure Nginx

```bash
# Copy nginx configuration
sudo cp docs/nginx.example.conf /etc/nginx/sites-available/teleweb

# Edit configuration
sudo nano /etc/nginx/sites-available/teleweb
# Update server_name dan root path sesuai domain/path Anda

# Enable site
sudo ln -s /etc/nginx/sites-available/teleweb /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 🔧 Management Commands

### PM2 Process Management

```bash
# Check status
pm2 status

# View logs
pm2 logs                    # All logs
pm2 logs teleweb-backend   # Backend only
pm2 logs teleweb-bot       # Bot only

# Restart services
pm2 restart all            # All services
pm2 restart teleweb-backend
pm2 restart teleweb-bot

# Stop services
pm2 stop all

# Delete services (for redeployment)
pm2 delete all
```

### System Services

```bash
# Telegram API Server
sudo systemctl status telegram-bot-api
sudo systemctl restart telegram-bot-api
sudo systemctl stop telegram-bot-api
sudo journalctl -u telegram-bot-api -f

# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Redis
sudo systemctl status redis-server
sudo systemctl restart redis-server

# Nginx
sudo systemctl status nginx
sudo systemctl reload nginx
```

### Application Logs

```bash
# Application logs
tail -f logs/backend.log
tail -f logs/bot.log

# PM2 logs with timestamps
pm2 logs --timestamp

# System logs
sudo journalctl -u telegram-bot-api -f
sudo tail -f /var/log/nginx/teleweb_access.log
sudo tail -f /var/log/nginx/teleweb_error.log
```

## 🔄 Updates and Maintenance

### Code Updates

```bash
cd /home/teleweb

# Stop services
pm2 stop all

# Pull/upload new code
# git pull origin main

# Rebuild and restart
./scripts/prod-start-no-docker.sh
```

### Database Migrations

```bash
cd /home/teleweb/backend

# Run new migrations
npx prisma migrate deploy

# Restart backend
pm2 restart teleweb-backend
```

### Backup Database

```bash
# Create backup
sudo -u postgres pg_dump teleweb > teleweb_backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
sudo -u postgres psql teleweb < teleweb_backup_file.sql
```

## 🛡️ Security Considerations

### Firewall Setup

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Telegram API Server (local only)
# Port 8081 should NOT be accessible from outside
```

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### File Permissions

```bash
# Set proper ownership
sudo chown -R $USER:$USER /home/teleweb

# Secure environment file
chmod 600 .env

# Secure log directory
mkdir -p logs
chmod 755 logs
```

## 📊 Monitoring

### Health Checks

```bash
# Backend API
curl http://localhost:3001/api/health

# Frontend (via Nginx)
curl http://yourdomain.com

# Bot health (check PM2 status)
pm2 show teleweb-bot
```

### Performance Monitoring

```bash
# System resources
htop
free -h
df -h

# PM2 monitoring
pm2 monit

# Nginx access logs
sudo tail -f /var/log/nginx/teleweb_access.log
```

## ❌ Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Check DATABASE_URL in .env
# Check user permissions
```

**Bot not responding:**
```bash
# Check bot logs
pm2 logs teleweb-bot
# Check Telegram API Server
sudo systemctl status telegram-bot-api
# Verify BOT_TOKEN in .env
```

**Frontend not loading:**
```bash
# Check Nginx configuration
sudo nginx -t
# Check build files exist
ls -la frontend/dist/
# Check Nginx logs
sudo tail -f /var/log/nginx/teleweb_error.log
```

**PM2 services crashed:**
```bash
# Check PM2 status
pm2 status
# Restart crashed services
pm2 restart all
# Check application logs
pm2 logs
```

### Log Locations

```
Application Logs:
- Backend: /home/teleweb/logs/backend.log
- Bot: /home/teleweb/logs/bot.log
- PM2: ~/.pm2/logs/

System Logs:
- Telegram API: sudo journalctl -u telegram-bot-api
- Nginx: /var/log/nginx/teleweb_*.log
- PostgreSQL: /var/log/postgresql/
- Redis: /var/log/redis/
```

## 🎯 Production Checklist

- [ ] PostgreSQL dan Redis berjalan
- [ ] Environment variables dikonfigurasi dengan benar
- [ ] Database migrations berhasil
- [ ] Admin user terbuat
- [ ] Telegram API Server sebagai systemd service
- [ ] PM2 services running (backend + bot)
- [ ] Nginx dikonfigurasi dan SSL aktif
- [ ] Firewall dikonfigurasi
- [ ] Backup strategy disetup
- [ ] Monitoring tools dikonfigurasi
- [ ] Log rotation dikonfigurasi

## 📞 Support

Jika mengalami masalah:
1. Cek logs terlebih dahulu
2. Pastikan semua services berjalan
3. Verify environment configuration
4. Test database connectivity
5. Check firewall rules

---

**Note:** Setup ini adalah versi non-Docker untuk testing awal. Setelah aplikasi stabil, pertimbangkan migrasi ke Docker untuk easier deployment dan scaling. 