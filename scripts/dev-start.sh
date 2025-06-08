#!/bin/bash

# TeleWeb Development Start Script
# Simple version that starts all services without complex checks

set -e

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Starting TeleWeb Development Environment"
print_status "========================================"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "bot" ]; then
    print_error "Please run this script from the teleweb root directory"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Install dependencies if needed
print_status "Checking dependencies..."

if [ ! -d "backend/node_modules" ]; then
    print_status "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "bot/node_modules" ]; then
    print_status "Installing bot dependencies..."
    cd bot && npm install && cd ..
fi

if [ ! -d "shared/node_modules" ]; then
    print_status "Installing shared dependencies..."
    cd shared && npm install && cd ..
fi

# Setup database
print_status "Setting up database..."
cd backend
npm run prisma:generate
npm run prisma:migrate
cd ..

print_status "Starting services..."

# Start Telegram API Server
print_status "Starting Telegram API Server..."
nohup ./scripts/telegram-api-server.sh > logs/telegram-api.log 2>&1 &
TELEGRAM_API_PID=$!
echo $TELEGRAM_API_PID > logs/telegram-api.pid

# Wait for Telegram API Server to start
sleep 3

# Start Backend
print_status "Starting Backend service..."
cd backend
nohup npm run start:dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..

# Wait a bit for backend to start
sleep 5

# Start Bot
print_status "Starting Bot service..."
cd bot
nohup npm run dev > ../logs/bot.log 2>&1 &
BOT_PID=$!
echo $BOT_PID > ../logs/bot.pid
cd ..

# Display status
print_success "Services started!"
print_status ""
print_status "Service PIDs:"
print_status "- Telegram API Server: $TELEGRAM_API_PID"
print_status "- Backend: $BACKEND_PID"
print_status "- Bot: $BOT_PID"
print_status ""
print_status "Log files:"
print_status "- Telegram API: logs/telegram-api.log"
print_status "- Backend: logs/backend.log"
print_status "- Bot: logs/bot.log"
print_status ""
print_status "To stop services, run: ./scripts/dev-stop.sh"
print_status "To view logs, run: ./scripts/dev-logs.sh"

print_success "Development environment ready!"
