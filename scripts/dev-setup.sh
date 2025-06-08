#!/bin/bash

# TeleWeb Development Setup Script
# This script sets up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

print_status "TeleWeb Development Environment Setup"
print_status "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "bot" ]; then
    print_error "Please run this script from the teleweb root directory"
    exit 1
fi

# Check if Node.js is installed
print_status "Checking system requirements..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js $(node --version) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm $(npm --version) detected"

# Install dependencies
print_status "Installing dependencies..."

print_status "Installing root dependencies..."
npm install

print_status "Installing shared dependencies..."
cd shared && npm install && cd ..

print_status "Installing backend dependencies..."
cd backend && npm install && cd ..

print_status "Installing bot dependencies..."
cd bot && npm install && cd ..

print_success "All dependencies installed"

# Setup environment configuration
print_status "Setting up environment configuration..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_status "Copying .env.example to .env"
        cp .env.example .env
        print_warning "Please configure your .env file"
    else
        print_status "Creating basic .env file"
        cat > .env << EOF
# Database
DATABASE_URL="postgresql://teleweb:teleweb123@localhost:5432/teleweb?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Bot Configuration
BOT_TOKEN="your-telegram-bot-token"
BOT_API_SERVER="http://localhost:8081"
USE_POLLING=true

# API Configuration
BACKEND_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"

# Google Cloud Vision (Optional)
GOOGLE_APPLICATION_CREDENTIALS=""

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH="./uploads"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL="info"
EOF
        print_warning "Basic .env file created. Please configure it with your settings."
    fi
    
    print_status "Opening .env file for configuration..."
    ${EDITOR:-nano} .env
    
    print_warning "Please ensure your .env file is properly configured before continuing"
    read -p "Press Enter after configuring .env file..."
fi

# Database setup
print_status "Setting up database..."

print_status "Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client not found. Please install PostgreSQL."
    print_status "On Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    print_status "On CentOS/RHEL: sudo yum install postgresql postgresql-server"
    print_status "On macOS: brew install postgresql"
else
    print_success "PostgreSQL client found"
fi

print_status "Setting up database schema..."
cd backend

# Generate Prisma client
print_status "Generating Prisma client..."
npm run prisma:generate

# Run migrations
print_status "Running database migrations..."
npm run prisma:migrate

# Seed database
print_status "Seeding database with initial data..."
npm run prisma:seed

cd ..

# Create directories
print_status "Creating required directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p temp

# Make scripts executable
print_status "Making scripts executable..."
chmod +x scripts/*.sh

print_success "Development environment setup completed!"
print_status ""
print_status "Next steps:"
print_status "==========="
print_status "1. Configure your .env file if not done already"
print_status "2. Start development services: ./scripts/dev-start.sh"
print_status "3. View logs: ./scripts/dev-logs.sh"
print_status "4. Stop services: ./scripts/dev-stop.sh"
print_status ""
print_status "Service URLs:"
print_status "- Backend API: http://localhost:3001"
print_status "- Swagger Documentation: http://localhost:3001/api"
print_status "- Telegram Bot: Active with your bot token"
print_status ""
print_success "Happy developing! 🚀" 