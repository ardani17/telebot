#!/bin/bash

echo "🔐 Setting up permissions for TeleWeb scripts..."

# Make all shell scripts executable
chmod +x /home/teleweb/*.sh
chmod +x /home/teleweb/scripts/*.sh

echo "✅ Permissions set for:"
echo "   - /home/teleweb/start-all.sh"
echo "   - /home/teleweb/check-services.sh"
echo "   - /home/teleweb/restart-nginx.sh"
echo "   - /home/teleweb/scripts/setup-nginx.sh"
echo "   - /home/teleweb/setup-permissions.sh"

echo ""
echo "🚀 Ready to start TeleWeb!"
echo "Run: bash /home/teleweb/start-all.sh" 