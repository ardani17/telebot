#!/bin/bash

# TeleWeb One-Time Setup Script
# Script ini hanya dijalankan sekali untuk setup awal database, Redis, dan konfigurasi

set -e

echo "🔧 TeleWeb - One-Time Setup Script"

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
    print_error ".env file not found. Please create it first"
    exit 1
fi

source .env

print_status "=== SETUP PHASE 1: PostgreSQL & Redis ==="

# Setup PostgreSQL
print_status "Setting up PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    print_status "Starting PostgreSQL service..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Setup Redis
print_status "Setting up Redis..."
if ! systemctl is-active --quiet redis-server; then
    print_status "Starting Redis service..."
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
fi

print_success "PostgreSQL and Redis services started"

print_status "=== SETUP PHASE 2: Database Configuration ==="

# Test database connection
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! psql -U root -h localhost -d teleweb -c "SELECT 1;" > /dev/null 2>&1; then
    print_warning "Database connection failed. Running PostgreSQL setup..."
    ./scripts/fix-postgresql.sh
fi

print_status "=== SETUP PHASE 3: Dependencies & Build ==="

# Install dependencies
print_status "Installing dependencies..."
./scripts/install-deps.sh

# Setup Prisma
print_status "Setting up Prisma..."
cd backend

if [ ! -d "node_modules/.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
fi

# Run migrations
print_status "Running database migrations..."
npx prisma migrate deploy

# Create features if not exist
print_status "Ensuring database features exist..."
if [ -f "../scripts/create-features.js" ]; then
    cp ../scripts/create-features.js ./
    node create-features.js
    rm create-features.js
fi

# Add admin user
print_status "Setting up admin user..."
if [ ! -z "$ADMIN_TELEGRAM_ID" ]; then
    npx ts-node scripts/add-user.ts "$ADMIN_TELEGRAM_ID" "$ADMIN_NAME" "$ADMIN_USERNAME" "ADMIN"
    
    # Grant all features to admin
    print_status "Granting all features to admin..."
    npx ts-node scripts/grant-features.ts "$ADMIN_TELEGRAM_ID" "ocr" "rar" "location" "geotags" "kml" "workbook" 2>/dev/null || true
fi

cd ..

print_status "=== SETUP PHASE 4: PM2 Configuration ==="

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
fi

# Setup PM2 startup
sudo pm2 startup
pm2 save

print_status "=== SETUP PHASE 5: Directories & Permissions ==="

# Create necessary directories
mkdir -p logs
mkdir -p backend/uploads
mkdir -p bot/data

# Set permissions
chmod +x scripts/*.sh

print_success "=== SETUP COMPLETED! ==="

# Mark setup as completed
touch .setup_completed

echo ""
echo "📋 Next Steps:"
echo "   1. Start daily development: ./scripts/dev-start.sh"
echo "   2. Monitor services: pm2 monit"
echo ""
echo "🔧 Management Commands:"
echo "   - ./scripts/dev-start.sh         # Start all services"
echo "   - pm2 status                     # Check status"
echo "   - pm2 logs                       # View all logs"
echo "   - pm2 logs teleweb-backend-dev   # Backend logs only"
echo "   - pm2 restart all               # Restart all services"
echo "   - pm2 stop all                  # Stop all services"
echo "   - pm2 delete all                # Delete all services"
echo ""
echo "📊 Service URLs (after start):"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api/docs"
echo ""
echo "⚠️  NOTE: This setup script should only be run once!"
echo "   For daily development, just use: ./scripts/dev-start.sh"
echo "" 