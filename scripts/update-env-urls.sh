#!/bin/bash

# Script to update environment URLs dynamically
# This script updates API URLs in .env based on PUBLIC_IP or domain

set -e

echo "🔧 Update Environment URLs"
echo "========================="

# Configuration
ENV_FILE="/home/teleweb/.env"
ENV_BACKUP="/home/teleweb/.env.backup"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found at $ENV_FILE"
    exit 1
fi

# Backup current .env
cp "$ENV_FILE" "$ENV_BACKUP"
log_success "Backup created at $ENV_BACKUP"

# Get current PUBLIC_IP from .env
source "$ENV_FILE"
CURRENT_IP=${PUBLIC_IP:-$(hostname -I | awk '{print $1}')}

# Ask user for domain or IP
echo ""
echo "Current configuration:"
echo "  PUBLIC_IP: $CURRENT_IP"
echo "  BACKEND_URL: $BACKEND_URL"
echo "  BOT_API_SERVER: $BOT_API_SERVER"
echo ""
echo "Select update mode:"
echo "1) Use current IP address ($CURRENT_IP)"
echo "2) Use a domain name"
echo "3) Use a different IP address"
echo "4) Use localhost (development)"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        BASE_URL="http://$CURRENT_IP"
        log_info "Using current IP: $CURRENT_IP"
        ;;
    2)
        read -p "Enter domain name (e.g., example.com): " DOMAIN
        read -p "Use HTTPS? (y/n): " USE_HTTPS
        if [[ $USE_HTTPS =~ ^[Yy]$ ]]; then
            BASE_URL="https://$DOMAIN"
        else
            BASE_URL="http://$DOMAIN"
        fi
        log_info "Using domain: $BASE_URL"
        ;;
    3)
        read -p "Enter IP address: " NEW_IP
        BASE_URL="http://$NEW_IP"
        CURRENT_IP=$NEW_IP
        log_info "Using new IP: $NEW_IP"
        ;;
    4)
        BASE_URL="http://localhost"
        CURRENT_IP="localhost"
        log_info "Using localhost for development"
        ;;
    *)
        log_warning "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Update .env file
log_info "Updating .env file..."

# Update BACKEND_URL
sed -i "s|^BACKEND_URL=.*|BACKEND_URL=${BASE_URL}:${BACKEND_PORT:-3001}/api|" "$ENV_FILE"

# Update BOT_API_SERVER
sed -i "s|^BOT_API_SERVER=.*|BOT_API_SERVER=${BASE_URL}:${BOT_API_PORT:-8081}|" "$ENV_FILE"

# Update PUBLIC_IP if changed
if [ "$choice" != "4" ]; then
    sed -i "s|^PUBLIC_IP=.*|PUBLIC_IP=$CURRENT_IP|" "$ENV_FILE"
fi

# Update CORS_ORIGIN
if [ "$choice" == "4" ]; then
    # Development mode
    CORS_ORIGIN="http://localhost:3000,http://localhost:8080"
else
    # Production mode
    CORS_ORIGIN="${BASE_URL}:3000,${BASE_URL}:8080"
fi
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=$CORS_ORIGIN|" "$ENV_FILE"

# Show updated values
echo ""
log_success "Environment URLs updated!"
echo ""
echo "New configuration:"
grep -E "^(PUBLIC_IP|BACKEND_URL|BOT_API_SERVER|CORS_ORIGIN)=" "$ENV_FILE" | while read line; do
    echo "  $line"
done

echo ""
log_info "Please restart all services for changes to take effect:"
echo "  pm2 restart all"
echo "  ./scripts/telegram-api-server.sh restart"
echo ""
echo "To revert changes:"
echo "  cp $ENV_BACKUP $ENV_FILE" 