#!/bin/bash

# Manual Telegram Bot Logout Script
# Run this script manually when you need to logout bot from previous sessions
# Usage: ./scripts/manual-bot-logout.sh

echo "🔐 Manual Bot Logout..."

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

print_status "This will logout the bot from Telegram servers"
print_warning "Only run this if you're switching between different bot instances"
print_warning "or if you're experiencing 'Logged out' errors"
echo ""

read -p "Are you sure you want to logout the bot? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Bot logout cancelled"
    exit 0
fi

# Run the actual logout script
print_status "Running bot logout..."
./scripts/bot-logout.sh

if [ $? -eq 0 ]; then
    print_success "Bot logout completed successfully"
    print_status "You can now restart your bot application"
    echo ""
    print_status "To start the development environment:"
    print_status "  ./scripts/dev-start.sh"
    echo ""
    print_status "To start only the bot:"
    print_status "  cd bot && npm run dev"
else
    print_error "Bot logout failed"
    print_status "The bot might not have been logged in"
fi
