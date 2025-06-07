#!/bin/bash

# Reset Telegram Bot Script
# This script resets the bot by calling getMe to reactivate it

echo "🔄 Resetting Telegram Bot Status..."

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
    print_error ".env file not found. Please create environment file with BOT_TOKEN."
    exit 1
fi

# Load environment variables
source .env

# Check if BOT_TOKEN is set
if [ -z "$BOT_TOKEN" ]; then
    print_error "BOT_TOKEN is not set in .env file"
    exit 1
fi

print_status "Bot Token: ${BOT_TOKEN:0:10}..."

# Try to get bot info to reactivate it
print_status "Attempting to reactivate bot..."

RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getMe")

# Check if curl command was successful
if [ $? -ne 0 ]; then
    print_error "Failed to send request. Check your internet connection."
    exit 1
fi

# Parse response
OK=$(echo "$RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)
BOT_ID=$(echo "$RESPONSE" | grep -o '"id":[^,]*' | cut -d':' -f2)
BOT_USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
BOT_FIRST_NAME=$(echo "$RESPONSE" | grep -o '"first_name":"[^"]*"' | cut -d'"' -f4)

if [ "$OK" = "true" ]; then
    print_success "Bot successfully reactivated!"
    print_status "Bot Info:"
    print_status "  ID: $BOT_ID"
    print_status "  Username: @$BOT_USERNAME"
    print_status "  Name: $BOT_FIRST_NAME"
    
    # Try to delete webhook if any
    print_status "Removing any existing webhook..."
    WEBHOOK_RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook")
    WEBHOOK_OK=$(echo "$WEBHOOK_RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)
    
    if [ "$WEBHOOK_OK" = "true" ]; then
        print_success "Webhook removed (if any existed)"
    else
        print_warning "Could not remove webhook (might not exist)"
    fi
    
else
    print_error "Failed to reactivate bot"
    print_status "Full response: $RESPONSE"
    exit 1
fi

print_success "Bot reset completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Bot is now ready to receive updates"
echo "   2. You can start the bot with: cd bot && npm run dev"
echo "   3. Or start full environment with: ./scripts/dev-start.sh"
echo ""
