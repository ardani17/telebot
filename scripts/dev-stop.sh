#!/bin/bash

# TeleWeb Development Stop Script
# Script untuk menghentikan semua services development

echo "🛑 TeleWeb - Stopping Development Services"

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

# Stop PM2 processes
print_status "Stopping PM2 services..."
pm2 stop all 2>/dev/null || print_warning "No PM2 processes running"
pm2 delete all 2>/dev/null || print_warning "No PM2 processes to delete"

# Stop Telegram API Server
print_status "Stopping Telegram API Server..."
if [ -f "logs/telegram-api.pid" ]; then
    PID=$(cat logs/telegram-api.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        print_success "Telegram API Server stopped"
    else
        print_warning "Telegram API Server was not running"
    fi
    rm -f logs/telegram-api.pid
else
    # Try to kill by process name
    pkill -f "telegram-bot-api" 2>/dev/null || print_warning "No telegram-bot-api process found"
fi

# Clean up any remaining processes on development ports
print_status "Cleaning up ports..."

# Function to kill process on port
kill_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        kill -9 $pid 2>/dev/null
        print_success "Stopped $name on port $port"
    fi
}

kill_port 3001 "Backend"
kill_port 3000 "Frontend" 
kill_port 8081 "Telegram API"

print_success "All development services stopped!"
echo ""
echo "📊 Status:"
echo "   PM2 processes: $(pm2 list | grep -c 'online' || echo '0') running"
echo "   Port 3001: $(lsof -ti:3001 2>/dev/null | wc -l) processes"
echo "   Port 3000: $(lsof -ti:3000 2>/dev/null | wc -l) processes"
echo "   Port 8081: $(lsof -ti:8081 2>/dev/null | wc -l) processes"
echo ""
echo "🚀 To start again: ./scripts/dev-start.sh"
