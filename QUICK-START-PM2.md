# 🚀 TeleWeb Quick Start Guide (PM2 Production)

## ✅ Yang Sudah Berjalan:

Berdasarkan setup Anda, services sudah running dengan PM2:
- ✅ **Backend** (teleweb-backend) via PM2
- ✅ **Bot** (teleweb-bot) via PM2
- ✅ **PostgreSQL** 
- ✅ **Redis**
- ✅ **Nginx** sudah install

## 🔧 Yang Perlu Diperbaiki:

Nginx belum listening di port yang benar. Mari kita perbaiki:

### 1. Fix Nginx Configuration

```bash
# Set permissions untuk scripts
chmod +x /home/teleweb/*.sh

# Fix nginx port issue
bash /home/teleweb/fix-nginx-port.sh
```

### 2. Check All Services

```bash
# Check PM2 services status
bash /home/teleweb/check-pm2-services.sh
```

## 🌍 Access Points:

Setelah nginx diperbaiki, Anda bisa akses:

- **Frontend**: `http://YOUR_SERVER_IP:8080/` atau `http://YOUR_SERVER_IP/`
- **API Docs**: `http://YOUR_SERVER_IP:8080/api/docs`

## 📋 Management Commands (PM2):

```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Restart specific service
pm2 restart teleweb-backend
pm2 restart teleweb-bot

# Stop all
pm2 stop all

# Start all
pm2 start all
```

## 🔧 Nginx Commands:

```bash
# Check nginx status
systemctl status nginx

# Restart nginx
systemctl restart nginx

# Check nginx logs
tail -f /var/log/nginx/teleweb_*.log
tail -f /var/log/nginx/error.log
```

## 🆘 Troubleshooting:

### Frontend tidak bisa diakses?

```bash
# Fix nginx configuration
bash /home/teleweb/fix-nginx-port.sh

# Check which port nginx is using
netstat -tlnp | grep nginx
```

### Backend API tidak respond?

```bash
# Check PM2 backend
pm2 status
pm2 logs teleweb-backend

# Restart backend
pm2 restart teleweb-backend
```

### Bot tidak bekerja?

```bash
# Check PM2 bot
pm2 logs teleweb-bot

# Restart bot
pm2 restart teleweb-bot
```

## ⚠️ JANGAN Gunakan `start-all.sh`

Script `start-all.sh` akan konflik dengan PM2. 

**Gunakan PM2 commands** untuk manajemen production services.

## 🎯 Next Steps:

1. ✅ Run: `bash /home/teleweb/fix-nginx-port.sh`
2. ✅ Run: `bash /home/teleweb/check-pm2-services.sh`
3. ✅ Test web interface di browser
4. ✅ Test bot commands
5. ✅ Configure domain/SSL jika perlu 