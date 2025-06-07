#!/bin/bash

# TeleWeb Quick Development Start Script
# This script starts all services WITHOUT rebuilding or resetting database
# Use this for quick testing when dependencies are already installed

set -e  # Exit on any error

echo "⚡ Starting TeleWeb Development Environment (Quick Mode)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please run full ./scripts/dev-start.sh first"
    exit 1
fi

# Load environment variables
source .env

# Copy .env to all service directories (quick operation)
print_status "Setting up environment variables..."
cp .env backend/.env 2>/dev/null || true
cp .env frontend/.env 2>/dev/null || true
cp .env bot/.env 2>/dev/null || true
print_success "Environment variables configured"

# Function to check and kill processes using specific ports
check_and_kill_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking if port $port is in use..."
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        print_warning "Port $port is in use by PID $pid ($service_name)"
        print_status "Killing process on port $port..."
        kill -9 $pid 2>/dev/null || true
        sleep 2
        print_success "Process on port $port killed"
    else
        print_status "Port $port is available"
    fi
}

# Only cleanup ports that might conflict
print_status "Performing quick cleanup..."
check_and_kill_port 3001 "Backend API"
check_and_kill_port 3000 "Frontend"

# Start Docker services (don't recreate if already running)
print_status "Starting/checking Docker services (PostgreSQL, Redis)..."
if ! docker ps | grep -q "teleweb.*postgres"; then
    docker-compose up -d postgres redis
    print_status "Waiting for database to be ready..."
    sleep 5
else
    print_success "Database already running"
fi

# Check Telegram Bot API server
print_status "Checking Telegram Bot API server..."
HTTP_PORT=${HTTP_PORT:-8081}
PUBLIC_IP=${PUBLIC_IP:-"localhost"}
DATA_DIR=${DATA_DIR:-"/tmp/telegram-bot-api"}

if netstat -tuln | grep -q ":$HTTP_PORT "; then
    if pgrep -f "telegram-bot-api" > /dev/null; then
        print_success "Telegram API Server is already running"
    else
        print_error "Port $HTTP_PORT is occupied by another process"
        exit 1
    fi
else
    # Start Telegram API Server
    print_status "Starting Telegram Bot API Server..."
    
    # Create data directory
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/temp"
    
    /usr/local/bin/telegram-bot-api \
        --local \
        --api-id="$TELEGRAM_API_ID" \
        --api-hash="$TELEGRAM_API_HASH" \
        --http-port="$HTTP_PORT" \
        --dir="$DATA_DIR" \
        --temp-dir="$DATA_DIR/temp" \
        --verbosity=1 &
    
    TELEGRAM_API_PID=$!
    echo $TELEGRAM_API_PID > logs/telegram-api.pid
    
    # Wait for API server to start
    print_status "Waiting for API server to start..."
    sleep 3
    
    # Test API server
    for i in {1..5}; do
        if curl -s "http://$PUBLIC_IP:$HTTP_PORT" > /dev/null 2>&1; then
            print_success "Telegram API Server is running on port $HTTP_PORT"
            break
        fi
        if [ $i -eq 5 ]; then
            print_error "API Server failed to respond after 5 attempts"
            kill $TELEGRAM_API_PID 2>/dev/null
            exit 1
        fi
        print_status "Waiting for API server... ($i/5)"
        sleep 1
    done
fi

# Update .env to use local API server
print_status "Configuring bot to use local API server..."
if grep -q "^BOT_API_SERVER=" .env; then
    sed -i "s|^BOT_API_SERVER=.*|BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT|" .env
else
    echo "BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT" >> .env
fi

# Copy updated .env to bot directory
cp .env bot/.env

# Quick Prisma client generation (only if needed)
print_status "Checking Prisma client..."
cd backend
if [ ! -d "node_modules/.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
else
    print_success "Prisma client already exists"
fi
cd ..

# SKIP database migrations and seeding to preserve existing data
print_warning "Skipping database reset to preserve existing data"

print_status "Starting all services in development mode..."

# Create logs directory
mkdir -p logs

# Start services in background with logging
print_status "Starting Backend API (port 3001)..."
cd backend
npm run start:dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

print_status "Starting Frontend (port 3000)..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

print_status "Starting Telegram Bot..."
cd bot
npm run dev > ../logs/bot.log 2>&1 &
BOT_PID=$!
cd ..

# Save PIDs for cleanup
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid
echo $BOT_PID > logs/bot.pid

print_success "All services started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   API Docs: http://localhost:3001/api/docs"
echo ""
echo "📝 Logs:"
echo "   Backend: tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo "   Bot: tail -f logs/bot.log"
echo ""
echo "🛑 To stop all services: ./scripts/dev-stop.sh"
echo ""

# Wait for services to start
sleep 3

# Check if services are running
print_status "Checking service health..."

# Check backend
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        print_success "Backend API is running"
        break
    fi
    if [ $i -eq 10 ]; then
        print_warning "Backend API might not be ready yet"
    fi
    sleep 1
done

# Check frontend
if curl -s http://localhost:3000 > /dev/null; then
    print_success "Frontend is running"
else
    print_warning "Frontend might not be ready yet"
fi

print_success "Quick development environment is ready!"
print_status "Your existing users and data are preserved"
print_status "Press Ctrl+C to stop all services or run ./scripts/dev-stop.sh"

# Keep script running and handle Ctrl+C
trap 'echo ""; print_status "Stopping all services..."; ./scripts/dev-stop.sh; exit 0' INT

# Wait indefinitely
while true; do
    sleep 1
done 