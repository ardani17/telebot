# TeleWeb Scripts Documentation

Kumpulan script untuk mengelola TeleWeb - Telegram Bot Web Integration project.

## 📋 Daftar Script

### 🔧 Development Scripts

#### `setup-once.sh`
Script setup awal yang hanya dijalankan sekali untuk konfigurasi lengkap environment development.

**Fungsi:**
- Install dan konfigurasi PostgreSQL & Redis
- Setup database, migrations, dan features
- Install dependencies dan build projects
- Setup PM2 dan konfigurasi startup
- Create admin user dan grant feature access

**Usage:**
```bash
sudo ./scripts/setup-once.sh
```

**Requirements:**
- File .env sudah dikonfigurasi
- Root/sudo privileges
- Internet connection

**Output:**
- PostgreSQL dan Redis berjalan
- Database teleweb dengan features lengkap
- PM2 terinstall dan terkonfigurasi
- File .setup_completed sebagai marker

#### `dev-start.sh`
Script untuk menjalankan development sehari-hari menggunakan PM2.

**Fungsi:**
- Check services (PostgreSQL, Redis)
- Start Telegram API Server
- Start semua services dengan PM2 (Backend, Frontend, Bot)
- Show status dan useful commands

**Usage:**
```bash
./scripts/dev-start.sh
```

**Requirements:**
- Setup-once sudah dijalankan (file .setup_completed exist)
- PM2 terinstall

**Output:**
- Semua services berjalan dengan PM2
- Real-time monitoring dengan pm2 monit
- Logs terorganisir per service

#### `dev-stop.sh`
Script untuk menghentikan semua development services.

**Fungsi:**
- Stop semua PM2 processes
- Stop Telegram API Server
- Cleanup ports (3000, 3001, 8081)
- Show final status

**Usage:**
```bash
./scripts/dev-stop.sh
```

#### `telegram-api-server.sh`
Script khusus untuk menjalankan Telegram Bot API Server lokal.

**Fungsi:**
- Start local Telegram Bot API server
- Update BOT_API_SERVER di .env
- Support systemd service (production)
- Create PID file untuk monitoring

**Usage:**
```bash
# Development (background)
./scripts/telegram-api-server.sh

# Production (systemd)
./scripts/telegram-api-server.sh --systemd
```

#### `fix-postgresql.sh`
Script untuk install dan konfigurasi PostgreSQL untuk native development.

**Fungsi:**
- Install PostgreSQL dan postgresql-contrib
- Membuat user 'root' dengan password dari .env
- Membuat database 'teleweb'
- Konfigurasi pg_hba.conf untuk local connections
- Test koneksi database
- Update DATABASE_URL di .env jika perlu

**Usage:**
```bash
sudo ./scripts/fix-postgresql.sh
```

**Requirements:**
- File .env dengan POSTGRES_PASSWORD configured
- Root/sudo privileges untuk install PostgreSQL

**Output:**
- PostgreSQL installed dan running
- Database 'teleweb' siap digunakan
- User 'root' dengan privileges yang benar

#### `install-deps.sh`
Script untuk install semua dependencies dengan kompatibilitas NPM yang lebih baik.

**Fungsi:**
- Install dependencies untuk semua packages (shared, backend, frontend, bot)
- Build shared package
- Menggunakan `--legacy-peer-deps` untuk kompatibilitas NPM versi lama
- Error handling untuk setiap step

**Usage:**
```bash
./scripts/install-deps.sh
```

**Benefits:**
- Mengatasi masalah workspace protocol pada NPM versi lama
- Install dependencies dalam urutan yang benar
- Comprehensive error handling

#### `dev-start.sh`
Script untuk memulai environment development lengkap.

**Fungsi:**
- Install semua dependencies menggunakan `install-deps.sh`
- Generate Prisma client
- Start Docker services (PostgreSQL, Redis)
- Run database migrations dan seeding
- Start semua services (Backend, Frontend, Bot) dalam mode development

**Usage:**
```bash
./scripts/dev-start.sh
```

**Output:**
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000
- API Docs: http://localhost:3001/api/docs
- Logs tersimpan di `logs/` directory

#### `dev-stop.sh`
Script untuk menghentikan semua services development.

**Fungsi:**
- Stop semua running processes
- Cleanup PID files
- Stop Docker services

**Usage:**
```bash
./scripts/dev-stop.sh
```

### 🚀 Production Scripts

#### `prod-start.sh`
Script untuk deploy dan menjalankan environment production.

**Fungsi:**
- Install production dependencies
- Build semua services
- Generate Prisma client
- Start production Docker services
- Run database migrations
- Start services dengan PM2

**Usage:**
```bash
./scripts/prod-start.sh
```

**Requirements:**
- PM2 installed globally: `npm install -g pm2`
- Production environment variables configured
- Docker dan Docker Compose installed

**Output:**
- Backend API managed by PM2
- Bot managed by PM2
- Frontend static files di `frontend/dist`
- Nginx untuk serve frontend (optional)

### 🤖 Bot Management Scripts

#### `bot-logout.sh`
Script untuk logout bot dari Telegram servers.

**Fungsi:**
- Logout bot dari Telegram API
- Berguna saat switching antara bot instances
- Stops webhook/polling updates

**Usage:**
```bash
./scripts/bot-logout.sh
```

**Environment Variables Required:**
- `BOT_TOKEN`: Telegram bot token
- `BOT_API_SERVER` (optional): Custom API server URL

#### `telegram-api-server.sh`
Script untuk menjalankan local Telegram Bot API server.

**Fungsi:**
- Start local Telegram Bot API server
- Support untuk systemd service
- Automatic directory creation
- Health checks

**Usage:**
```bash
# Run directly (development)
./scripts/telegram-api-server.sh

# Install as systemd service (production)
./scripts/telegram-api-server.sh --systemd
```

**Environment Variables Required:**
- `TELEGRAM_API_ID`: API ID dari my.telegram.org
- `TELEGRAM_API_HASH`: API Hash dari my.telegram.org
- `HTTP_PORT` (optional): Port untuk API server (default: 8081)
- `BOT_API_DATA_PATH` (optional): Data directory path
- `DATA_DIR` (optional): Base data directory

**Benefits:**
- Faster file downloads
- No file size limits
- Better performance
- Local file storage

## 🔧 Setup Instructions

### 1. Prerequisites
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install PM2 (for production)
sudo npm install -g pm2
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Make Scripts Executable
```bash
chmod +x scripts/*.sh
```

## 🔐 Admin User Auto-Setup

Semua startup scripts (`dev-start.sh`, `dev-start-native.sh`, `prod-start.sh`) sekarang **secara otomatis menambahkan admin user** ke database setiap kali dijalankan.

**Fitur:**
- Membuat admin user baru jika belum ada
- Update admin user yang sudah ada (memastikan role ADMIN dan status aktif)
- Memberikan akses ke semua features yang tersedia
- Menggunakan konfigurasi dari environment variables

**Environment Variables untuk Admin User:**
```bash
ADMIN_TELEGRAM_ID=your-telegram-id     # Required
ADMIN_NAME="Nama Admin"                # Optional (default: "Admin")
ADMIN_USERNAME="username_admin"        # Optional (default: "admin")
```

**Contoh Output saat Script Dijalankan:**
```bash
🔍 Adding admin user to database...
✅ Admin user already exists: Ardani (731289973)
✅ Admin user updated successfully
✅ Admin user setup completed
```

**Keunggulan:**
- Tidak perlu setup manual admin user setelah fresh database
- Konsisten di semua environment (development, production)
- Self-healing: admin user selalu dalam kondisi yang benar
- Zero downtime: tidak mengganggu proses startup lainnya

## 👥 User Management Scripts

#### `grant-ocr-access.sh`
Script untuk memberikan akses fitur OCR ke user dengan Telegram ID 731289973.

**Fungsi:**
- Menambahkan user ke database jika belum ada
- Memberikan akses fitur OCR
- Verifikasi status user dan feature access
- Auto-seed database jika features belum ada

**Usage:**
```bash
chmod +x scripts/grant-ocr-access.sh
./scripts/grant-ocr-access.sh
```

**Output:**
- User 731289973 ditambahkan ke database
- Akses OCR diberikan ke user
- Verifikasi final status user
- Instruksi cara test fitur OCR

#### `add-user-ocr.sh`
Script alternatif untuk menambahkan user dan memberikan akses OCR menggunakan inline Node.js.

**Usage:**
```bash
chmod +x scripts/add-user-ocr.sh
./scripts/add-user-ocr.sh
```

## 📝 Environment Variables

### Required Variables
```bash
# Bot Configuration
BOT_TOKEN=your-telegram-bot-token-here
ADMIN_TELEGRAM_ID=your-telegram-id

# Database
POSTGRES_PASSWORD=secure-password
REDIS_PASSWORD=secure-password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

### Optional Variables (for Local Bot API)
```bash
TELEGRAM_API_ID=your-api-id
TELEGRAM_API_HASH=your-api-hash
HTTP_PORT=8081
BOT_API_DATA_PATH=/var/lib/telegram-bot-api
```

## 🚦 Development Workflow

### 🆕 First Time Setup (Run Once)
```bash
# 1. Setup environment
cp .env.example .env
nano .env  # Edit configuration

# 2. Run one-time setup
sudo ./scripts/setup-once.sh

# 3. Start development
./scripts/dev-start.sh
```

### 🔄 Daily Development
```bash
# Start all services
./scripts/dev-start.sh

# Monitor services
pm2 monit

# View logs
pm2 logs
pm2 logs teleweb-backend-dev
pm2 logs teleweb-bot-dev

# Restart specific service
pm2 restart teleweb-backend-dev

# Stop all services
./scripts/dev-stop.sh
```

### 🔧 Useful PM2 Commands
```bash
pm2 status                    # Check all services status
pm2 logs                      # View all logs
pm2 logs --lines 100          # View last 100 lines
pm2 restart all              # Restart all services
pm2 reload all               # Reload all services (zero-downtime)
pm2 stop all                 # Stop all services
pm2 delete all               # Delete all services
pm2 monit                    # Real-time monitoring dashboard
```

### 📊 Port Information
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Docs:** http://localhost:3001/api/docs
- **Telegram API:** http://localhost:8081

## 🚦 Usage Examples

### Development Workflow
```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 2. Start development
./scripts/dev-start.sh

# 3. Development work...

# 4. Stop development
./scripts/dev-stop.sh
```

### Production Deployment
```bash
# 1. Setup production environment
cp .env.example .env
# Configure production values

# 2. Install Telegram Bot API (optional)
# Download and install telegram-bot-api binary

# 3. Start local Bot API server (optional)
./scripts/telegram-api-server.sh --systemd

# 4. Deploy application
./scripts/prod-start.sh

# 5. Check status
pm2 status
pm2 logs
```

### Bot Management
```bash
# Logout bot from Telegram
./scripts/bot-logout.sh

# Start local Bot API server
./scripts/telegram-api-server.sh

# Check if bot is responding
curl -X GET "https://api.telegram.org/bot$BOT_TOKEN/getMe"
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Denied
```bash
chmod +x scripts/*.sh
```

#### 2. Port Already in Use
```bash
# Check what's using the port
sudo netstat -tulpn | grep :3001

# Kill process if needed
sudo kill -9 <PID>
```

#### 3. Docker Permission Issues
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Logout and login again
```

#### 4. Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs teleweb-postgres-dev
```

#### 5. Bot Not Responding
```bash
# Check bot token
curl -X GET "https://api.telegram.org/bot$BOT_TOKEN/getMe"

# Check bot logs
tail -f logs/bot.log
```

### Log Locations

#### Development
- Backend: `logs/backend.log`
- Frontend: `logs/frontend.log`
- Bot: `logs/bot.log`

#### Production
- Backend: `pm2 logs teleweb-backend`
- Bot: `pm2 logs teleweb-bot`
- Telegram API: `sudo journalctl -u telegram-bot-api -f`

## 🔐 Security Notes

1. **Environment Variables**: Never commit `.env` files to version control
2. **Bot Token**: Keep bot token secure and rotate regularly
3. **Database Passwords**: Use strong passwords for production
4. **JWT Secrets**: Use cryptographically secure random strings
5. **File Permissions**: Ensure script files have appropriate permissions
6. **Firewall**: Configure firewall rules for production deployment

## 📚 Additional Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Local Bot API Server](https://github.com/tdlib/telegram-bot-api)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [NestJS Documentation](https://docs.nestjs.com/)

---

**TeleWeb Scripts** - Automated deployment and management for Telegram Bot Web Integration.

# TeleWeb Development Scripts

Scripts untuk memudahkan development TeleWeb bot tanpa menggunakan Docker.

## 📋 Daftar Scripts

### 🚀 `dev-setup.sh` - Setup Awal
Script untuk setup environment development pertama kali.

```bash
./scripts/dev-setup.sh
```

**Fungsi:**
- ✅ Check system requirements (Node.js, npm)
- 📦 Install semua dependencies (root, shared, backend, bot)
- ⚙️ Setup file .env
- 🗄️ Setup database (migrasi & seeding)
- 📁 Create required directories
- 🔧 Make scripts executable

**Jalankan sekali saat pertama kali setup project.**

---

### ▶️ `dev-start.sh` - Start Development Services
Script untuk menjalankan semua services development.

```bash
./scripts/dev-start.sh
```

**Fungsi:**
- 🔍 Check dependencies & environment
- 🗄️ Setup database jika diperlukan
- 🚀 Start Backend API (port 3001)
- 🤖 Start Telegram Bot
- 📊 Health check services
- 📝 Optional log monitoring

**Services yang dijalankan:**
- **Backend API**: http://localhost:3001
- **Swagger UI**: http://localhost:3001/api
- **Telegram Bot**: Polling mode

---

### ⏹️ `dev-stop.sh` - Stop Development Services
Script untuk menghentikan semua services.

```bash
./scripts/dev-stop.sh
```

**Fungsi:**
- 🛑 Stop services by PID files
- 🔪 Kill processes on ports 3001, 3000
- 🧹 Cleanup remaining Node.js processes
- 🗑️ Optional log file cleanup

---

### 📋 `dev-logs.sh` - View & Monitor Logs
Script interaktif untuk melihat logs services.

```bash
./scripts/dev-logs.sh
```

**Menu Options:**
1. **View all logs (combined)** - Gabungan semua logs
2. **View backend logs only** - Logs backend saja
3. **View bot logs only** - Logs bot saja
4. **View logs with live monitoring** - Monitor real-time
5. **View last 50 lines** - 50 baris terakhir
6. **Clear all logs** - Hapus semua log files
7. **Check service status** - Status services & ports
8. **Exit** - Keluar

---

## 🔧 Workflow Development Harian

### First Time Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd teleweb

# 2. Run setup script
./scripts/dev-setup.sh

# 3. Configure .env file (akan terbuka otomatis)
# - Set BOT_TOKEN dengan token bot Telegram Anda
# - Configure database URL jika perlu
# - Set Google Cloud credentials jika menggunakan OCR
```

### Daily Development
```bash
# Start services
./scripts/dev-start.sh

# Monitor logs (optional)
./scripts/dev-logs.sh

# Stop services ketika selesai
./scripts/dev-stop.sh
```

---

## 📂 File & Directory Structure

```
teleweb/
├── scripts/
│   ├── dev-setup.sh      # Setup awal
│   ├── dev-start.sh      # Start services
│   ├── dev-stop.sh       # Stop services
│   └── dev-logs.sh       # View logs
├── logs/
│   ├── backend.log       # Backend service logs
│   ├── bot.log          # Bot service logs
│   ├── Backend.pid      # Backend PID file
│   └── Bot.pid          # Bot PID file
├── backend/             # NestJS backend
├── bot/                # Telegram bot
├── shared/             # Shared utilities
└── .env                # Environment configuration
```

---

## ⚙️ Environment Configuration

File `.env` yang perlu dikonfigurasi:

```bash
# Database
DATABASE_URL="postgresql://teleweb:teleweb123@localhost:5432/teleweb?schema=public"

# Redis (optional untuk caching)
REDIS_URL="redis://localhost:6379"

# JWT untuk authentication
JWT_SECRET="your-jwt-secret-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Bot Configuration
BOT_TOKEN="your-telegram-bot-token"           # WAJIB diisi
BOT_API_SERVER="http://localhost:8081"        # Local Bot API (optional)
USE_POLLING=true

# API Configuration
BACKEND_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"

# Google Cloud Vision untuk OCR (optional)
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# File Upload
MAX_FILE_SIZE=10485760                        # 10MB
UPLOAD_PATH="./uploads"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL="info"
```

---

## 🔍 Debugging & Troubleshooting

### Check Service Status
```bash
# Via logs script
./scripts/dev-logs.sh
# Pilih option 7 untuk check status

# Manual check
ps aux | grep -E "(nest|ts-node)" | grep -v grep
lsof -i :3001  # Backend port
lsof -i :3000  # Bot port (jika ada)
```

### View Real-time Logs
```bash
# All logs combined
tail -f logs/*.log

# Individual logs
tail -f logs/backend.log
tail -f logs/bot.log
```

### Clean Start
```bash
# Stop all services
./scripts/dev-stop.sh

# Remove logs
rm -f logs/*.log logs/*.pid

# Kill any remaining processes
pkill -f "nest start"
pkill -f "ts-node-dev"

# Start fresh
./scripts/dev-start.sh
```

---

## 🚨 Common Issues

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3001

# Kill specific process
kill -9 <PID>

# Or use dev-stop script
./scripts/dev-stop.sh
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Reset database
cd backend
npm run prisma:reset
npm run prisma:migrate
npm run prisma:seed
```

### Dependencies Issues
```bash
# Clean install
rm -rf node_modules backend/node_modules bot/node_modules shared/node_modules
./scripts/dev-setup.sh
```

---

## 🎯 Bot Admin Commands Testing

Setelah services berjalan, test admin commands di bot:

```
/admin          # Panel admin
/users list     # Daftar users
/features list  # Daftar features
/stats quick    # Statistik ringkas
/broadcast Hello World  # Test broadcast
```

---

## 💡 Tips Development

1. **Use log monitoring**: Jalankan `./scripts/dev-logs.sh` untuk monitor real-time
2. **Check health**: Backend health endpoint: http://localhost:3001/health
3. **API Documentation**: Swagger UI di http://localhost:3001/api
4. **Environment switching**: Copy `.env` ke `.env.local` untuk config lokal
5. **Database management**: Gunakan `npm run prisma:studio` di folder backend

---

**Happy Coding! 🚀**
