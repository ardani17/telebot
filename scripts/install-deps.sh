#!/bin/bash

# TeleWeb Dependencies Installation Script
# This script installs all dependencies without using workspace protocol

echo "📦 Installing TeleWeb Dependencies..."

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

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "NPM version: $(npm --version)"

# Install dependencies in order
print_status "Installing shared package dependencies..."
cd shared
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    print_error "Failed to install shared dependencies"
    exit 1
fi
print_success "Shared dependencies installed"
cd ..

print_status "Building shared package..."
cd shared
npm run build
if [ $? -ne 0 ]; then
    print_error "Failed to build shared package"
    exit 1
fi
print_success "Shared package built"
cd ..

print_status "Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    print_error "Failed to install backend dependencies"
    exit 1
fi
print_success "Backend dependencies installed"
cd ..

print_status "Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    print_error "Failed to install frontend dependencies"
    exit 1
fi
print_success "Frontend dependencies installed"
cd ..

print_status "Installing bot dependencies..."
cd bot
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    print_error "Failed to install bot dependencies"
    exit 1
fi
print_success "Bot dependencies installed"
cd ..

print_status "Installing root dependencies..."
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    print_error "Failed to install root dependencies"
    exit 1
fi
print_success "Root dependencies installed"

print_success "All dependencies installed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure .env file: cp .env.example .env"
echo "   2. Start development: ./scripts/dev-start.sh"
echo "   3. Or start production: ./scripts/prod-start.sh"
echo ""
