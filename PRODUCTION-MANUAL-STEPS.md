# 🚀 Manual Production Start Steps

Karena shell terminal mengalami masalah, berikut langkah manual untuk start production:

## 1. Masuk ke Direktori TeleWeb

```bash
cd /home/teleweb
```

## 2. Set Permissions untuk Scripts

```bash
chmod +x scripts/*.sh
chmod +x *.sh
```

## 3. Pilih Salah Satu Metode Berikut:

### Metode A: Menggunakan Script Production (Recommended)

```bash
# Jalankan script production lengkap
bash scripts/prod-start-no-docker.sh
```

Script ini akan:
- ✅ Check dan start PostgreSQL & Redis
- ✅ Install dependencies
- ✅ Build backend, frontend, dan bot
- ✅ Setup database migrations
- ✅ Setup admin user
- ✅ Start Telegram API server
- ✅ Start services dengan PM2
- ✅ Setup PM2 startup

### Metode B: Manual PM2 Start (Jika A gagal)

```bash
# 1. Ensure builds exist
cd backend && npm run build && cd ..
cd bot && npm run build && cd ..
cd frontend && npm run build && cd ..

# 2. Start with PM2
pm2 start ecosystem.config.js

# 3. Save PM2 configuration
pm2 save

# 4. Setup PM2 startup
pm2 startup
```

### Metode C: Direct Node.js Start (Fallback)

```bash
# Terminal 1 - Backend
cd /home/teleweb/backend
NODE_ENV=production npm run start:prod

# Terminal 2 - Bot  
cd /home/teleweb/bot
NODE_ENV=production npm run start:prod
```

## 4. Setup Nginx (Setelah services running)

```bash
# Fix nginx configuration
bash fix-nginx-port.sh

# Atau restart nginx manual
systemctl restart nginx
```

## 5. Check Status

```bash
# Check PM2 services
pm2 status

# Check all services
bash check-pm2-services.sh

# Check individual services
systemctl status nginx
systemctl status postgresql
systemctl status redis-server
```

## 6. Test Access

```bash
# Test backend API
curl http://localhost:3001/api/health

# Test frontend via nginx
curl -I http://localhost:8080/
curl -I http://localhost/
```

## 7. Troubleshooting

### Jika Backend gagal start:

```bash
# Check logs
pm2 logs teleweb-backend

# Restart backend
pm2 restart teleweb-backend
```

### Jika Bot gagal start:

```bash
# Check logs
pm2 logs teleweb-bot

# Restart bot
pm2 restart teleweb-bot
```

### Jika Nginx tidak accessible:

```bash
# Check nginx config
nginx -t

# Fix nginx port
bash fix-nginx-port.sh

# Check nginx logs
tail -f /var/log/nginx/error.log
```

## 8. Expected Results

Setelah semua berjalan, Anda akan melihat:

```bash
pm2 status
```

Output seperti:
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ teleweb-backend    │ cluster  │ 0    │ online    │ 0%       │ 183.6mb  │
│ 1  │ teleweb-bot        │ cluster  │ 0    │ online    │ 0%       │ 99.7mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

Dan web interface accessible di:
- **Frontend**: `http://YOUR_SERVER_IP:8080/`
- **API Docs**: `http://YOUR_SERVER_IP:8080/api/docs`

## 9. Daily Management Commands

```bash
# Status
pm2 status

# Logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Reload nginx
systemctl reload nginx
``` 