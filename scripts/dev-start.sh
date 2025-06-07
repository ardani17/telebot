#!/bin/bash

# TeleWeb Daily Development Start Script
# Script sederhana untuk development sehari-hari menggunakan PM2

set -e

echo "🚀 TeleWeb - Development Start (PM2)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if first time setup needed
if [ ! -f ".setup_completed" ]; then
    print_warning "First time setup required!"
    print_status "Please run: ./scripts/setup-once.sh"
    echo ""
    echo "After setup, you can use this script for daily development."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    exit 1
fi

source .env

print_status "Checking services..."

# Check PostgreSQL and Redis
if ! systemctl is-active --quiet postgresql; then
    print_status "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi

if ! systemctl is-active --quiet redis-server; then
    print_status "Starting Redis..."
    sudo systemctl start redis-server
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 not installed. Please run setup-once.sh first"
    exit 1
fi

print_status "Starting Telegram API Server..."
./scripts/telegram-api-server.sh &
sleep 3

print_status "Starting all services with PM2..."

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Create logs directory
mkdir -p logs

# Start services individually
print_status "Starting Backend Service..."
cd backend && pm2 start npm --name "teleweb-backend-dev" -- run start:dev && cd ..

print_status "Starting Bot Service..."
cd bot && pm2 start npm --name "teleweb-bot-dev" -- run dev && cd ..

# Frontend tidak perlu di-start untuk sekarang (masih development)
# print_status "Starting Frontend Service..."
# cd frontend && pm2 start npm --name "teleweb-frontend-dev" -- run dev && cd ..

print_success "All services started!"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""
echo "📝 Useful Commands:"
echo "   pm2 status                     # Check status"
echo "   pm2 logs                       # View all logs"
echo "   pm2 logs teleweb-backend-dev   # Backend logs only"
echo "   pm2 logs teleweb-bot-dev       # Bot logs only"
echo "   pm2 restart all               # Restart all services"
echo "   pm2 stop all                  # Stop all services"
echo "   pm2 monit                     # Real-time monitoring"
echo ""
echo "📊 Service URLs:"
echo "   Backend API: http://localhost:3001"
echo "   API Docs: http://localhost:3001/api/docs"
echo "   Telegram Bot: Active on your bot token"
echo ""
echo "🛑 To stop all services: pm2 stop all"
echo ""

print_success "Development environment ready!"
