#!/bin/bash

# TeleWeb Deployment Script
# Handles database setup and service startup

set -e  # Exit on any error

echo "🚀 Starting TeleWeb Deployment..."

# Check if we're in the right directory
if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ Please run this script from /home/teleweb directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check database connection
echo "🔍 Checking PostgreSQL connection..."
if ! psql -U root -h localhost -d teleweb -p 5432 -c "SELECT 1;" >/dev/null 2>&1; then
    echo "📦 Database 'teleweb' not found. Creating..."
    sudo -u postgres createdb teleweb 2>/dev/null || echo "Database might already exist"
fi

# Check if database has tables
echo "🔍 Checking database schema..."
TABLE_COUNT=$(psql -U root -h localhost -d teleweb -p 5432 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
    echo "📋 Database is empty. Setting up schema..."
    cd backend
    npx dotenv -e ../.env -- prisma db push --skip-generate
    echo "✅ Database schema created"
    
    echo "🌱 Seeding admin user..."
    cd ../scripts
    node seed-admin.js
    echo "✅ Admin user seeded"
    cd ..
else
    echo "✅ Database schema already exists ($TABLE_COUNT tables found)"
fi

# Stop existing services
echo "⏸️ Stopping existing services..."
pm2 delete all 2>/dev/null || echo "No existing PM2 processes"

# Start services
echo "🔄 Starting services..."
pm2 start ecosystem.config.js

# Wait a moment for services to start
sleep 3

# Check service status
echo "📊 Service Status:"
pm2 status

# Health check
echo "🏥 Health check..."
sleep 2
if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "⚠️ Backend health check failed"
    echo "📋 Backend logs:"
    pm2 logs teleweb-backend --lines 10 --nostream
fi

echo "🎉 Deployment completed!"
echo ""
echo "Next steps:"
echo "- Monitor logs: pm2 logs"
echo "- Check status: pm2 status"
echo "- Test bot: Send /start to your Telegram bot" 