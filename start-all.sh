#!/bin/bash

echo "🚀 Starting TeleWeb Services..."
echo "==============================="

# Start PostgreSQL if not running
echo "🗄️ Starting PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    systemctl start postgresql
    sleep 2
fi

# Start Redis if not running  
echo "📦 Starting Redis..."
if ! systemctl is-active --quiet redis-server && ! systemctl is-active --quiet redis; then
    systemctl start redis-server 2>/dev/null || systemctl start redis
    sleep 2
fi

# Start Backend
echo "🔧 Starting Backend..."
cd /home/teleweb/backend
if ! netstat -tlnp 2>/dev/null | grep -q :3001; then
    echo "   Starting NestJS backend..."
    nohup npm run start:prod > /tmp/teleweb-backend.log 2>&1 &
    sleep 5
    
    if netstat -tlnp 2>/dev/null | grep -q :3001; then
        echo "✅ Backend started successfully"
    else
        echo "❌ Backend failed to start. Check /tmp/teleweb-backend.log"
    fi
else
    echo "✅ Backend already running"
fi

# Start Bot
echo "🤖 Starting Bot..."
cd /home/teleweb/bot
if ! pgrep -f "teleweb.*bot" > /dev/null; then
    echo "   Starting Telegram bot..."
    nohup npm run start:prod > /tmp/teleweb-bot.log 2>&1 &
    sleep 3
    
    if pgrep -f "teleweb.*bot" > /dev/null; then
        echo "✅ Bot started successfully"
    else
        echo "❌ Bot failed to start. Check /tmp/teleweb-bot.log"
    fi
else
    echo "✅ Bot already running"
fi

# Configure and start Nginx
echo "🌐 Starting Nginx..."
if ! systemctl is-active --quiet nginx; then
    systemctl start nginx
    sleep 2
fi

# Test nginx configuration and restart if needed
nginx -t > /dev/null 2>&1
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx configured and running"
else
    echo "❌ Nginx configuration error"
    nginx -t
fi

echo ""
echo "🎉 TeleWeb Services Started!"
echo "============================"

# Run the check script
bash /home/teleweb/check-services.sh