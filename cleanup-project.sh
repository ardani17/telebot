#!/bin/bash

echo "🧹 TeleWeb Project Cleanup"
echo "========================="
echo ""
echo "⚠️  PERINGATAN: Script ini akan MENGHAPUS file-file yang tidak diperlukan!"
echo "📖 Lihat cleanup-analysis.md untuk detail file yang akan dihapus."
echo ""
read -p "🤔 Lanjutkan cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup dibatalkan."
    exit 0
fi

echo ""
echo "🗂️ Backup file penting sebelum cleanup..."
# Backup important files just in case
mkdir -p /tmp/teleweb-backup-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/teleweb-backup-$(date +%Y%m%d-%H%M%S)"
cp ecosystem.config.js .env start-all.sh check-services.sh "$BACKUP_DIR/" 2>/dev/null
echo "✅ Backup disimpan di: $BACKUP_DIR"

echo ""
echo "🗑️ Menghapus debugging scripts..."

# Root level debugging scripts
FILES_TO_DELETE=(
    "debug-login.sh"
    "complete-network-fix.sh" 
    "deep-debug-network.sh"
    "fix-cors-env.sh"
    "create-env-and-fix.sh"
    "create-production-env.sh"
    "diagnose-network-issue.sh"
    "fix-all-network-issues.sh"
    "rebuild-frontend.sh"
    "fix-network-error.sh"
    "fix-nginx-port.sh"
    "fix-nginx-proxy.sh"
    "fix-frontend-api-config.sh"
    "manual-start-production.sh"
    "run-production.sh"
    "restart-nginx.sh"
    "test-nginx.sh"
    "ecosystem.config.dev.js"
    "todo.md"
    "test-archive-feature.md"
    ".eslintcache"
    ".setup_completed"
)

cd /home/teleweb

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "🗑️ Deleting: $file"
        rm -f "$file"
    fi
done

echo ""
echo "🗑️ Menghapus scripts yang tidak diperlukan..."

# Scripts folder cleanup
SCRIPTS_TO_DELETE=(
    "scripts/prod-start-no-docker.sh"
    "scripts/dev-logs.sh"
    "scripts/dev-stop.sh"
    "scripts/dev-start.sh"
    "scripts/dev-setup.sh"
    "scripts/test-ocr-plain.sh"
    "scripts/analyze-ocr-logs.sh"
    "scripts/test-web-password.js"
    "scripts/test-password.js"
    "scripts/quick-set-password.js"
    "scripts/direct-set-password.js"
    "scripts/clear-browser-storage.js"
    "scripts/check-users.js"
    "scripts/start-bot-with-api.sh"
    "scripts/telegram-api-server.sh"
    "scripts/grant-ocr-access.sh"
    "scripts/add-user-ocr.sh"
    "scripts/test-db.sh"
    "scripts/fix-postgresql.sh"
    "scripts/dev-start-native.sh"
    "scripts/restart-backend.sh"
    "scripts/fix-database.sh"
    "scripts/debug-database.sh"
    "scripts/dev-start-quick.sh"
    "scripts/continue-dev.sh"
    "scripts/debug-backend.sh"
    "scripts/docker-test.sh"
    "scripts/fix-bot-logout.sh"
    "scripts/reset-bot.sh"
    "scripts/manual-bot-logout.sh"
    "scripts/fix-deps.sh"
    "scripts/install-deps.sh"
    "scripts/bot-logout.sh"
)

for file in "${SCRIPTS_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "🗑️ Deleting: $file"
        rm -f "$file"
    fi
done

echo ""
echo "📊 Cleanup summary..."

echo ""
echo "✅ KEPT - Files yang dipelihara:"
echo "📂 Core:"
echo "   - ecosystem.config.js (PM2 config)"
echo "   - package.json (Dependencies)"
echo "   - README.md (Documentation)"
echo "   - .env (Environment variables)"
echo ""
echo "📂 Useful Scripts:"
echo "   - start-all.sh (Start all services)"
echo "   - check-services.sh (Check status)"
echo "   - setup-permissions.sh (Setup permissions)"
echo "   - scripts/prod-start.sh (Production start)"
echo "   - scripts/check-status.sh (Status monitoring)"
echo "   - scripts/seed-admin.js (Admin user management)"
echo ""

echo "📈 Menghitung space yang dibebaskan..."
cd /home/teleweb

CURRENT_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "💾 Current project size: $CURRENT_SIZE"

echo ""
echo "🎉 Project Cleanup Complete!"
echo "==========================="
echo ""
echo "📋 Next steps:"
echo "   1. Test semua functionality masih bekerja"
echo "   2. Commit changes ke git jika satisfactory"
echo "   3. Hapus backup di $BACKUP_DIR jika tidak diperlukan"
echo ""
echo "🔍 Quick test commands:"
echo "   - pm2 status"
echo "   - ./start-all.sh"
echo "   - ./check-services.sh"
echo ""
echo "📖 Lihat cleanup-analysis.md untuk detail lengkap yang sudah dihapus." 