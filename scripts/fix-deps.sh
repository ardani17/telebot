#!/bin/bash

# TeleWeb Dependencies Fix Script
# This script fixes dependency version issues and installs with stable versions

echo "🔧 Fixing TeleWeb Dependencies..."

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Clear npm cache
print_status "Clearing npm cache..."
npm cache clean --force

# Remove all node_modules and package-lock.json
print_status "Cleaning existing installations..."
rm -rf node_modules package-lock.json
rm -rf shared/node_modules shared/package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf bot/node_modules bot/package-lock.json

# Install shared dependencies first with specific versions
print_status "Installing shared dependencies with fixed versions..."
cd shared
npm install --legacy-peer-deps --no-package-lock
if [ $? -ne 0 ]; then
    print_error "Failed to install shared dependencies"
    exit 1
fi
print_success "Shared dependencies installed"

print_status "Building shared package..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Failed to build shared package"
    exit 1
fi
print_success "Shared package built"
cd ..

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps --no-package-lock
if [ $? -ne 0 ]; then
    print_warning "Backend install failed, trying with --force..."
    npm install --legacy-peer-deps --force --no-package-lock
    if [ $? -ne 0 ]; then
        print_error "Failed to install backend dependencies"
        exit 1
    fi
fi
print_success "Backend dependencies installed"
cd ..

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps --no-package-lock
if [ $? -ne 0 ]; then
    print_warning "Frontend install failed, trying with --force..."
    npm install --legacy-peer-deps --force --no-package-lock
    if [ $? -ne 0 ]; then
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
fi
print_success "Frontend dependencies installed"
cd ..

# Install bot dependencies
print_status "Installing bot dependencies..."
cd bot
npm install --legacy-peer-deps --no-package-lock
if [ $? -ne 0 ]; then
    print_warning "Bot install failed, trying with --force..."
    npm install --legacy-peer-deps --force --no-package-lock
    if [ $? -ne 0 ]; then
        print_error "Failed to install bot dependencies"
        exit 1
    fi
fi
print_success "Bot dependencies installed"
cd ..

print_success "All dependencies fixed and installed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Start development: ./scripts/dev-start.sh"
echo "   2. Or start production: ./scripts/prod-start.sh"
echo ""
