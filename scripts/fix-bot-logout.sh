#!/bin/bash

# Fix Bot Logout Issue Script
# This script attempts to fix the "Logged out" error by using different approaches

echo "🔧 Fixing Bot Logout Issue..."

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

print_warning "The bot is currently in 'Logged out' state."
print_status "This usually happens when:"
print_status "  1. Bot was manually logged out"
print_status "  2. Multiple bot instances were running"
print_status "  3. Bot token was regenerated"
echo ""

print_status "Attempting different solutions..."

# Method 1: Try to set webhook to empty (this sometimes reactivates the bot)
print_status "Method 1: Clearing webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" -d "url=")
WEBHOOK_OK=$(echo "$WEBHOOK_RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)

if [ "$WEBHOOK_OK" = "true" ]; then
    print_success "Webhook cleared successfully"
    
    # Now try getMe again
    print_status "Testing bot status..."
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
    OK=$(echo "$RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)
    
    if [ "$OK" = "true" ]; then
        BOT_USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        print_success "Bot is now active! Username: @$BOT_USERNAME"
        exit 0
    fi
else
    print_warning "Webhook clearing failed"
fi

# Method 2: Try to get updates (this might reactivate)
print_status "Method 2: Attempting to get updates..."
UPDATES_RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" -d "limit=1")
UPDATES_OK=$(echo "$UPDATES_RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)

if [ "$UPDATES_OK" = "true" ]; then
    print_success "Updates request successful"
    
    # Test bot status again
    print_status "Testing bot status..."
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
    OK=$(echo "$RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)
    
    if [ "$OK" = "true" ]; then
        BOT_USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        print_success "Bot is now active! Username: @$BOT_USERNAME"
        exit 0
    fi
else
    print_warning "Updates request failed"
fi

# If all methods fail
print_error "Unable to reactivate the bot automatically."
echo ""
print_status "Manual solutions:"
print_status "1. Go to @BotFather on Telegram"
print_status "2. Send /mybots"
print_status "3. Select your bot"
print_status "4. Go to 'Bot Settings' -> 'Revoke Token'"
print_status "5. Generate a new token"
print_status "6. Update BOT_TOKEN in your .env file"
echo ""
print_status "Alternative:"
print_status "1. Wait 10-15 minutes and try again"
print_status "2. The bot might automatically reactivate"
echo ""
print_status "Current bot token: ${BOT_TOKEN:0:10}...${BOT_TOKEN: -3}"
