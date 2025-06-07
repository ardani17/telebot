#!/bin/bash

# Telegram Bot Logout Script
# This script logs out the bot from Telegram servers

echo "🔐 Logging out Telegram Bot..."

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

# Set API server URL (default to official Telegram API)
API_SERVER=${BOT_API_SERVER:-"https://api.telegram.org"}

print_status "Using API Server: $API_SERVER"
print_status "Bot Token: ${BOT_TOKEN:0:10}..."

# Logout from Telegram API
print_status "Sending logout request to Telegram..."

RESPONSE=$(curl -s -X POST "${API_SERVER}/bot${BOT_TOKEN}/logOut")

# Check if curl command was successful
if [ $? -ne 0 ]; then
    print_error "Failed to send logout request. Check your internet connection and API server."
    exit 1
fi

# Parse response
OK=$(echo "$RESPONSE" | grep -o '"ok":[^,]*' | cut -d':' -f2)
DESCRIPTION=$(echo "$RESPONSE" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)

if [ "$OK" = "true" ]; then
    print_success "Bot successfully logged out from Telegram servers"
    print_status "The bot will no longer receive updates until it's started again"
else
    print_error "Failed to logout bot"
    if [ ! -z "$DESCRIPTION" ]; then
        print_error "Error: $DESCRIPTION"
    fi
    print_status "Full response: $RESPONSE"
    exit 1
fi

print_status "Logout completed successfully!"
echo ""
echo "📝 Note:"
echo "   - The bot is now logged out from Telegram servers"
echo "   - No webhook or polling updates will be received"
echo "   - To reactivate the bot, restart your bot application"
echo "   - This is useful when switching between different bot instances"
echo ""
