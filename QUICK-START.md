# 🚀 TeleWeb Quick Start Guide

## Prerequisites

- ✅ Bot sudah berjalan
- ✅ Frontend sudah di-build (`npm run build` di folder frontend)
- ✅ Nginx sudah terinstall
- ✅ Backend dan database sudah dikonfigurasi

## 1. Setup Permissions

```bash
bash /home/teleweb/setup-permissions.sh
```

## 2. Start All Services

```bash
bash /home/teleweb/start-all.sh
```

Script ini akan:
- ✅ Start PostgreSQL & Redis
- ✅ Start Backend NestJS (port 3001)
- ✅ Start Telegram Bot
- ✅ Configure & start Nginx (port 8080)
- ✅ Test semua services

## 3. Check Services Status

```bash
bash /home/teleweb/check-services.sh
```

## 4. Access TeleWeb

- **Frontend**: `http://YOUR_SERVER_IP:8080/`
- **API Docs**: `http://YOUR_SERVER_IP:8080/api/docs`

## 5. Login ke Web Interface

1. Buka `http://YOUR_SERVER_IP:8080/`
2. Masukkan Telegram ID Anda
3. Klik "Login"

## Troubleshooting

### Frontend tidak bisa diakses?

```bash
# Check nginx status
systemctl status nginx

# Test nginx config
nginx -t

# Restart nginx
bash /home/teleweb/restart-nginx.sh
```

### API tidak bekerja?

```bash
# Check backend
netstat -tlnp | grep :3001

# Test backend directly
curl http://localhost:3001/api/health
```

### Bot tidak merespon?

```bash
# Check bot process
pgrep -f "teleweb.*bot"

# Check bot logs
tail -f /tmp/teleweb-bot.log
```

## Useful Commands

```bash
# Start all services
bash /home/teleweb/start-all.sh

# Check all services
bash /home/teleweb/check-services.sh

# Restart nginx only
bash /home/teleweb/restart-nginx.sh

# View nginx logs
tail -f /var/log/nginx/teleweb_*.log

# View backend logs
tail -f /tmp/teleweb-backend.log

# View bot logs
tail -f /tmp/teleweb-bot.log
```

## Port Information

- **Frontend (Nginx)**: 8080
- **Backend API**: 3001
- **PostgreSQL**: 5432
- **Redis**: 6379
- **Bot API Server** (jika local): 8081

## Next Steps

1. ✅ Test login functionality
2. ✅ Test bot commands
3. ✅ Test file upload/download
4. ✅ Configure domain & SSL (optional)
5. ✅ Setup monitoring & backups 