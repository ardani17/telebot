#!/bin/bash

# Telegram Bot API Server Script
# This script starts the local Telegram Bot API server on VPS

echo "🚀 Starting Telegram Bot API Server..."

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create environment file with required variables."
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
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

# Set default values if not provided
HTTP_PORT=${HTTP_PORT:-8081}
PUBLIC_IP=${PUBLIC_IP:-"localhost"}
BOT_API_DATA_PATH=${BOT_API_DATA_PATH:-"/tmp/telegram-bot-api"}
DATA_DIR=${DATA_DIR:-"/tmp/telegram-bot-api"}

print_status "Configuration:"
print_status "  API ID: $TELEGRAM_API_ID"
print_status "  API Hash: ${TELEGRAM_API_HASH:0:8}..."
print_status "  HTTP Port: $HTTP_PORT"
print_status "  Data Path: $BOT_API_DATA_PATH"
print_status "  Temp Dir: $DATA_DIR/temp"

# Create necessary directories
print_status "Creating directories..."
mkdir -p "$BOT_API_DATA_PATH"
mkdir -p "$DATA_DIR/temp"

# Check if port is available
if ss -tuln | grep -q ":$HTTP_PORT " 2>/dev/null || lsof -i:$HTTP_PORT > /dev/null 2>&1; then
    print_warning "Port $HTTP_PORT is already in use"
    print_status "Checking if telegram-bot-api is already running..."
    
    if pgrep -f "telegram-bot-api" > /dev/null; then
        print_warning "telegram-bot-api is already running"
        print_status "PID: $(pgrep -f telegram-bot-api)"
        print_status "To restart, first stop the existing process:"
        print_status "  sudo pkill -f telegram-bot-api"
        exit 1
    fi
fi

print_status "Starting Telegram Bot API Server..."

# Create systemd service file for production use
if [ "$1" = "--systemd" ]; then
    print_status "Creating systemd service..."
    
    sudo tee /etc/systemd/system/telegram-bot-api.service > /dev/null << EOF
[Unit]
Description=Telegram Bot API Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$PWD
Environment=TELEGRAM_API_ID=$TELEGRAM_API_ID
Environment=TELEGRAM_API_HASH=$TELEGRAM_API_HASH
Environment=HTTP_PORT=$HTTP_PORT
Environment=BOT_API_DATA_PATH=$BOT_API_DATA_PATH
Environment=DATA_DIR=$DATA_DIR
ExecStart=/usr/local/bin/telegram-bot-api --local --api-id=$TELEGRAM_API_ID --api-hash=$TELEGRAM_API_HASH --http-port=$HTTP_PORT --dir=$BOT_API_DATA_PATH --temp-dir=$DATA_DIR/temp --verbosity=1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable telegram-bot-api
    sudo systemctl start telegram-bot-api
    
    print_success "Telegram Bot API Server started as systemd service"
    print_status "Service status:"
    sudo systemctl status telegram-bot-api --no-pager
    
    print_status "Service management commands:"
    print_status "  Status: sudo systemctl status telegram-bot-api"
    print_status "  Stop: sudo systemctl stop telegram-bot-api"
    print_status "  Restart: sudo systemctl restart telegram-bot-api"
    print_status "  Logs: sudo journalctl -u telegram-bot-api -f"
    
else
    # Run directly (for development/testing)
    print_status "Starting server directly..."
    print_warning "For production use, consider using --systemd flag"
    
    # Check if telegram-bot-api binary exists
    if [ ! -f "/usr/local/bin/telegram-bot-api" ]; then
        print_error "telegram-bot-api binary not found at /usr/local/bin/telegram-bot-api"
        print_status "Please install telegram-bot-api first"
        exit 1
    fi
    
    /usr/local/bin/telegram-bot-api \
        --local \
        --api-id="$TELEGRAM_API_ID" \
        --api-hash="$TELEGRAM_API_HASH" \
        --http-port="$HTTP_PORT" \
        --dir="$BOT_API_DATA_PATH" \
        --temp-dir="$DATA_DIR/temp" \
        --verbosity=1 &
    
    TELEGRAM_API_PID=$!
    mkdir -p ../logs
    echo $TELEGRAM_API_PID > ../logs/telegram-api.pid
    
    print_success "Telegram API Server started with PID: $TELEGRAM_API_PID"
    
    # Update .env BOT_API_SERVER
    if [ -f "../.env" ]; then
        if grep -q "^BOT_API_SERVER=" ../.env; then
            sed -i "s|^BOT_API_SERVER=.*|BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT|" ../.env
        else
            echo "BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT" >> ../.env
        fi
        print_success "Updated BOT_API_SERVER in .env"
    fi
fi

print_success "Telegram Bot API Server is running!"
echo ""
echo "📊 Server Information:"
echo "   Local API URL: http://localhost:$HTTP_PORT"
echo "   Data Directory: $BOT_API_DATA_PATH"
echo "   Temp Directory: $DATA_DIR/temp"
echo ""
echo "🔧 Usage in your bot:"
echo "   Set BOT_API_SERVER=http://localhost:$HTTP_PORT in your .env file"
echo "   Your bot will now use the local API server instead of api.telegram.org"
echo ""
echo "📝 Benefits:"
echo "   - Faster file downloads"
echo "   - No file size limits"
echo "   - Better performance"
echo "   - Local file storage"
echo ""
