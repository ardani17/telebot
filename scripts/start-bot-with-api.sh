#!/bin/bash

# Start Bot with Telegram API Server Script
# This script starts the local Telegram Bot API server and then the bot

echo "🚀 Starting Telegram Bot with Local API Server..."

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

# Function to cleanup on exit
cleanup() {
    print_warning "Stopping services..."
    if [ ! -z "$API_SERVER_PID" ]; then
        kill $API_SERVER_PID 2>/dev/null
        print_status "Telegram API Server stopped"
    fi
    if [ ! -z "$BOT_PID" ]; then
        kill $BOT_PID 2>/dev/null
        print_status "Bot stopped"
    fi
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create environment file with required variables."
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$BOT_TOKEN" ]; then
    print_error "BOT_TOKEN is required in .env file"
    exit 1
fi

if [ -z "$TELEGRAM_API_ID" ]; then
    print_error "TELEGRAM_API_ID is required in .env file"
    print_status "Get it from https://my.telegram.org/apps"
    exit 1
fi

if [ -z "$TELEGRAM_API_HASH" ]; then
    print_error "TELEGRAM_API_HASH is required in .env file"
    print_status "Get it from https://my.telegram.org/apps"
    exit 1
fi

# Set default values
HTTP_PORT=${HTTP_PORT:-8081}
PUBLIC_IP=${PUBLIC_IP:-"localhost"}
DATA_DIR=${DATA_DIR:-"./backend/data-bot-api"}
TEMP_DIR=${BOT_API_DATA_PATH:-"./data-bot-user"}

print_status "Configuration:"
print_status "  Bot Token: ${BOT_TOKEN:0:10}..."
print_status "  API ID: $TELEGRAM_API_ID"
print_status "  HTTP Port: $HTTP_PORT"
print_status "  Public IP: $PUBLIC_IP"

# Check if telegram-bot-api binary exists
if [ ! -f "/usr/local/bin/telegram-bot-api" ]; then
    print_error "telegram-bot-api binary not found at /usr/local/bin/telegram-bot-api"
    print_status "Please install telegram-bot-api first"
    exit 1
fi

# Logout from remote Telegram server to avoid conflicts
print_status "Logging out from remote Telegram server..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/logOut" > /dev/null 2>&1
print_success "Logged out from remote server"

# Create data directory
mkdir -p "$DATA_DIR"
mkdir -p "$TEMP_DIR"

# Check if API server is already running
if netstat -tuln | grep -q ":$HTTP_PORT "; then
    print_warning "Port $HTTP_PORT is already in use"
    if pgrep -f "telegram-bot-api" > /dev/null; then
        print_success "Telegram API Server is already running"
        API_SERVER_RUNNING=true
    else
        print_error "Port $HTTP_PORT is occupied by another process"
        exit 1
    fi
else
    # Start Telegram API Server
    print_status "Starting Telegram Bot API Server..."
    
    /usr/local/bin/telegram-bot-api \
        --local \
        --api-id="$TELEGRAM_API_ID" \
        --api-hash="$TELEGRAM_API_HASH" \
        --http-port="$HTTP_PORT" \
        --dir="$DATA_DIR" \
        --temp-dir="$TEMP_DIR" \
        --verbosity=1 &
    
    API_SERVER_PID=$!
    
    # Wait for API server to start
    print_status "Waiting for API server to start..."
    sleep 3
    
    # Check if API server is running
    if ! kill -0 $API_SERVER_PID 2>/dev/null; then
        print_error "Failed to start Telegram API Server"
        exit 1
    fi
    
    # Test API server
    for i in {1..10}; do
        if curl -s "http://$PUBLIC_IP:$HTTP_PORT" > /dev/null 2>&1; then
            print_success "Telegram API Server is running on port $HTTP_PORT"
            break
        fi
        if [ $i -eq 10 ]; then
            print_error "API Server failed to respond after 10 attempts"
            kill $API_SERVER_PID 2>/dev/null
            exit 1
        fi
        print_status "Waiting for API server... ($i/10)"
        sleep 2
    done
fi

# Update .env to use local API server
print_status "Configuring bot to use local API server..."
if grep -q "^BOT_API_SERVER=" .env; then
    sed -i "s|^BOT_API_SERVER=.*|BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT|" .env
else
    echo "BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT" >> .env
fi

# Uncomment BOT_API_SERVER if it's commented
sed -i 's|^# BOT_API_SERVER=|BOT_API_SERVER=|' .env

print_success "Bot configured to use local API server: http://$PUBLIC_IP:$HTTP_PORT"

# Start the bot
print_status "Starting Telegram Bot..."
cd bot

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing bot dependencies..."
    npm install
fi

# Start bot in development mode
npm run dev &
BOT_PID=$!

print_success "Bot started with PID: $BOT_PID"

# Monitor both processes
print_status "Monitoring services... Press Ctrl+C to stop"
echo ""
print_status "Services running:"
if [ ! -z "$API_SERVER_PID" ]; then
    print_status "  - Telegram API Server (PID: $API_SERVER_PID)"
fi
print_status "  - Telegram Bot (PID: $BOT_PID)"
echo ""
print_status "API Server URL: http://$PUBLIC_IP:$HTTP_PORT"
print_status "Bot logs: tail -f bot/logs/bot-combined.log"
echo ""

# Wait for processes
wait
