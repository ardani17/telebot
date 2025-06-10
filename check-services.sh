#!/bin/bash

echo "🔍 Checking TeleWeb Services Status..."
echo "=================================="

# Check if backend is running
echo "🔧 Backend (NestJS) Status:"
if netstat -tlnp 2>/dev/null | grep -q :3001; then
    echo "✅ Backend is running on port 3001"
    BACKEND_PID=$(netstat -tlnp 2>/dev/null | grep :3001 | awk '{print $7}' | cut -d'/' -f1)
    echo "   PID: $BACKEND_PID"
else
    echo "❌ Backend is NOT running on port 3001"
    echo "   To start: cd /home/teleweb/backend && npm run start:prod"
fi

echo ""

# Check if bot is running
echo "🤖 Bot Status:"
if pgrep -f "teleweb.*bot" > /dev/null; then
    echo "✅ Bot is running"
    BOT_PID=$(pgrep -f "teleweb.*bot")
    echo "   PID: $BOT_PID"
else
    echo "❌ Bot is NOT running"
    echo "   To start: cd /home/teleweb/bot && npm run start:prod"
fi

echo ""

# Check nginx
echo "🌐 Nginx Status:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
    if netstat -tlnp 2>/dev/null | grep -q :8080; then
        echo "✅ Nginx listening on port 8080"
    else
        echo "❌ Nginx not listening on port 8080"
    fi
else
    echo "❌ Nginx is NOT running"
    echo "   To start: systemctl start nginx"
fi

echo ""

# Check PostgreSQL
echo "🗄️ PostgreSQL Status:"
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is NOT running"
    echo "   To start: systemctl start postgresql"
fi

echo ""

# Check Redis
echo "📦 Redis Status:"
if systemctl is-active --quiet redis-server; then
    echo "✅ Redis is running"
elif systemctl is-active --quiet redis; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is NOT running"
    echo "   To start: systemctl start redis-server"
fi

echo ""
echo "🧪 Testing Services:"
echo "==================="

# Test backend API
echo "🔧 Testing Backend API..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is responding"
else
    echo "❌ Backend API is not responding"
fi

# Test frontend via nginx
echo "🌐 Testing Frontend via Nginx..."
if curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo "✅ Frontend is accessible via Nginx"
    echo "🌍 Access TeleWeb at: http://YOUR_SERVER_IP:8080/"
else
    echo "❌ Frontend is not accessible via Nginx"
fi

echo ""
echo "📋 Quick Start Commands:"
echo "======================="
echo "Start Backend:  cd /home/teleweb/backend && npm run start:prod"
echo "Start Bot:      cd /home/teleweb/bot && npm run start:prod"  
echo "Restart Nginx:  systemctl restart nginx"
echo "Check Logs:     tail -f /var/log/nginx/teleweb_*.log" 