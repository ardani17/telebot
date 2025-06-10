# 🧹 TeleWeb Project Cleanup Analysis

## ✅ KEEP - File yang BERGUNA untuk dipelihara:

### Core Project Files (JANGAN DIHAPUS):
- `package.json` - Dependency utama project
- `ecosystem.config.js` - Konfigurasi PM2 production
- `README.md` - Dokumentasi project
- `.env` - Environment variables
- `docker-compose.yml` & `docker-compose.prod.yml` - Docker configs
- `.gitignore` - Git configuration
- `.eslintrc.cjs` & `.prettierrc.cjs` - Code quality tools

### Documentation (KEEP):
- `QUICK-START.md` - Panduan cepat
- `QUICK-START-PM2.md` - Panduan PM2
- `scripts/README.md` - Dokumentasi scripts

### Useful Scripts (KEEP):
- `start-all.sh` - Script utama untuk start semua services
- `check-services.sh` - Check status services
- `setup-permissions.sh` - Setup permissions
- `scripts/prod-start.sh` - Production start script
- `scripts/check-status.sh` - Status checking
- `scripts/seed-admin.js` - Create admin user
- `scripts/setup-nginx.sh` - Nginx setup

## ❌ DELETE - File yang BISA DIHAPUS:

### Debugging Scripts (sudah tidak diperlukan):
- `debug-login.sh` - Masalah login sudah fixed
- `complete-network-fix.sh` - Network issue sudah resolved
- `deep-debug-network.sh` - Debug deep sudah selesai
- `fix-cors-env.sh` - CORS sudah fixed
- `create-env-and-fix.sh` - .env sudah ada
- `create-production-env.sh` - .env sudah configured
- `diagnose-network-issue.sh` - Network issue resolved
- `fix-all-network-issues.sh` - Issues sudah fixed
- `rebuild-frontend.sh` - Frontend sudah rebuilt
- `fix-network-error.sh` - Network error fixed
- `fix-nginx-port.sh` - Nginx sudah configured
- `fix-nginx-proxy.sh` - Proxy sudah working
- `fix-frontend-api-config.sh` - API config sudah fixed

### Manual/One-time Scripts:
- `manual-start-production.sh` - Sudah ada prod-start.sh
- `run-production.sh` - Redundant dengan start-all.sh
- `restart-nginx.sh` - Simple command, tidak perlu script
- `test-nginx.sh` - Very simple test

### Development Files:
- `ecosystem.config.dev.js` - Development config, bisa dihapus jika tidak pakai
- `todo.md` - Task list bisa dihapus jika sudah selesai
- `test-archive-feature.md` - Test notes
- `.eslintcache` - Cache file bisa dihapus
- `.setup_completed` - Setup marker file

### Scripts Folder Cleanup:
#### DELETE:
- `scripts/prod-start-no-docker.sh` - Redundant
- `scripts/dev-*.sh` (multiple) - Development scripts
- `scripts/test-*.js` - Test scripts sudah tidak diperlukan
- `scripts/analyze-ocr-logs.sh` - Debug specific
- `scripts/fix-*.sh` (multiple) - Fix scripts sudah tidak diperlukan
- `scripts/debug-*.sh` - Debug scripts
- `scripts/docker-test.sh` - Test script
- `scripts/reset-bot.sh` - Reset script
- `scripts/manual-bot-logout.sh` - Manual script

#### KEEP:
- `scripts/prod-start.sh` - Production start
- `scripts/check-status.sh` - Status monitoring
- `scripts/seed-admin.js` - User management
- `scripts/setup-nginx.sh` - Infrastructure setup
- `scripts/add-admin-user.sql` - Database utility

## 🗂️ SUGGESTED FOLDER STRUCTURE AFTER CLEANUP:

```
teleweb/
├── frontend/
├── backend/
├── bot/
├── shared/
├── config/
├── scripts/
│   ├── prod-start.sh
│   ├── check-status.sh
│   ├── seed-admin.js
│   ├── setup-nginx.sh
│   └── add-admin-user.sql
├── docs/
├── start-all.sh
├── check-services.sh
├── setup-permissions.sh
├── ecosystem.config.js
├── package.json
├── README.md
├── QUICK-START.md
├── QUICK-START-PM2.md
└── .env
``` 