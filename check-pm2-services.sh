#!/bin/bash

echo "🔍 Checking TeleWeb PM2 Services Status..."
echo "=========================================="

# Check PM2 status
echo "📊 PM2 Services:"
pm2 status

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
elif curl -s http://localhost/ > /dev/null 2>&1; then
    echo "✅ Frontend is accessible via Nginx (port 80)"
    echo "🌍 Access TeleWeb at: http://YOUR_SERVER_IP/"
else
    echo "❌ Frontend is not accessible via Nginx"
    echo "   Try: systemctl restart nginx"
fi

echo ""
echo "📋 PM2 Management Commands:"
echo "=========================="
echo "Status:         pm2 status"
echo "Logs:           pm2 logs"
echo "Restart All:    pm2 restart all"
echo "Stop All:       pm2 stop all"
echo "Backend Logs:   pm2 logs teleweb-backend"
echo "Bot Logs:       pm2 logs teleweb-bot"
echo "Reload Nginx:   systemctl reload nginx" 