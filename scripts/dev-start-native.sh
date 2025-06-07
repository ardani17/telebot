#!/bin/bash

# TeleWeb Native Development Start Script
# This script starts all services using native Ubuntu installations (no Docker)

set -e  # Exit on any error

echo "🚀 Starting TeleWeb Development Environment (Native Ubuntu)..."

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it first"
    exit 1
fi

# Load environment variables
source .env

# Copy .env to all service directories
print_status "Setting up environment variables..."
cp .env backend/.env 2>/dev/null || true
cp .env frontend/.env 2>/dev/null || true
cp .env bot/.env 2>/dev/null || true
print_success "Environment variables configured"

# Function to check and kill processes using specific ports
check_and_kill_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking if port $port is in use..."
    local pid=$(ss -tuln | grep ":$port " | head -1)
    
    if [ ! -z "$pid" ]; then
        print_warning "Port $port is in use"
        local actual_pid=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$actual_pid" ]; then
            print_status "Killing process on port $port..."
            kill -9 $actual_pid 2>/dev/null || true
            sleep 2
            print_success "Process on port $port killed"
        fi
    else
        print_status "Port $port is available"
    fi
}

# Cleanup conflicting ports
print_status "Performing cleanup..."
check_and_kill_port 3001 "Backend API"
check_and_kill_port 3000 "Frontend"

# Check and start native services
print_status "Checking native services (PostgreSQL, Redis)..."

# Check PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    print_status "Starting PostgreSQL service..."
    systemctl start postgresql
    print_success "PostgreSQL started"
else
    print_success "PostgreSQL already running"
fi

# Check Redis
if ! systemctl is-active --quiet redis-server; then
    print_status "Starting Redis service..."
    systemctl start redis-server
    print_success "Redis started"
else
    print_success "Redis already running"
fi

# Test database connectivity
print_status "Testing database connectivity..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if psql -U root -h localhost -d teleweb -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_warning "Database connection failed, but continuing..."
    print_status "Try running: ./scripts/fix-postgresql.sh to setup PostgreSQL"
fi

# Test Redis connectivity
if redis-cli ping > /dev/null 2>&1; then
    print_success "Redis connection successful"
else
    print_warning "Redis connection failed, but continuing..."
fi

# Check Telegram Bot API server
print_status "Checking Telegram Bot API server..."
HTTP_PORT=${HTTP_PORT:-8081}
PUBLIC_IP=${PUBLIC_IP:-"localhost"}
DATA_DIR=${DATA_DIR:-"/tmp/telegram-bot-api"}

if ss -tuln | grep -q ":$HTTP_PORT "; then
    if pgrep -f "telegram-bot-api" > /dev/null; then
        print_success "Telegram API Server is already running"
    else
        print_error "Port $HTTP_PORT is occupied by another process"
        exit 1
    fi
else
    # Start Telegram API Server
    print_status "Starting Telegram Bot API Server..."
    
    # Create data directory
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/temp"
    
    /usr/local/bin/telegram-bot-api \
        --local \
        --api-id="$TELEGRAM_API_ID" \
        --api-hash="$TELEGRAM_API_HASH" \
        --http-port="$HTTP_PORT" \
        --dir="$DATA_DIR" \
        --temp-dir="$DATA_DIR/temp" \
        --verbosity=1 &
    
    TELEGRAM_API_PID=$!
    echo $TELEGRAM_API_PID > logs/telegram-api.pid
    
    # Wait for API server to start
    print_status "Waiting for API server to start..."
    sleep 3
    
    # Test API server
    for i in {1..5}; do
        if curl -s "http://$PUBLIC_IP:$HTTP_PORT" > /dev/null 2>&1; then
            print_success "Telegram API Server is running on port $HTTP_PORT"
            break
        fi
        if [ $i -eq 5 ]; then
            print_error "API Server failed to respond after 5 attempts"
            kill $TELEGRAM_API_PID 2>/dev/null
            exit 1
        fi
        print_status "Waiting for API server... ($i/5)"
        sleep 1
    done
fi

# Update .env to use local API server
print_status "Configuring bot to use local API server..."
if grep -q "^BOT_API_SERVER=" .env; then
    sed -i "s|^BOT_API_SERVER=.*|BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT|" .env
else
    echo "BOT_API_SERVER=http://$PUBLIC_IP:$HTTP_PORT" >> .env
fi

# Copy updated .env to bot directory
cp .env bot/.env

# Prisma setup
print_status "Setting up Prisma..."
cd backend
if [ ! -d "node_modules/.prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
else
    print_success "Prisma client already exists"
fi

# Run migrations if needed
print_status "Running database migrations..."
npx prisma migrate deploy || print_warning "Migration failed, but continuing..."

# Add admin user to database
print_status "Adding admin user to database..."
if [ ! -z "$ADMIN_TELEGRAM_ID" ]; then
    node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function addAdminUser() {
      try {
        const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
        const adminName = process.env.ADMIN_NAME || 'Admin';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        
        if (!adminTelegramId) {
          console.log('⚠️  ADMIN_TELEGRAM_ID not found in .env - skipping admin setup');
          return;
        }
        
        // Check if admin user exists
        const existingUser = await prisma.user.findUnique({
          where: { telegramId: adminTelegramId },
        });
        
        if (existingUser) {
          console.log('✅ Admin user already exists: ' + existingUser.name + ' (' + existingUser.telegramId + ')');
          
          // Update to ensure active status and correct role
          await prisma.user.update({
            where: { telegramId: adminTelegramId },
            data: {
              name: adminName,
              username: adminUsername,
              role: 'ADMIN',
              isActive: true,
            },
          });
          console.log('✅ Admin user updated successfully');
          return;
        }
        
        // Create admin user
        console.log('🌱 Creating admin user: ' + adminTelegramId);
        
        const adminUser = await prisma.user.create({
          data: {
            telegramId: adminTelegramId,
            name: adminName,
            username: adminUsername,
            role: 'ADMIN',
            isActive: true,
          },
        });
        
        // Grant all features to admin
        const allFeatures = await prisma.feature.findMany();
        
        for (const feature of allFeatures) {
          await prisma.userFeatureAccess.create({
            data: {
              userId: adminUser.id,
              featureId: feature.id,
              grantedBy: adminUser.id,
            },
          });
        }
        
        console.log('🎉 Admin user created: ' + adminUser.name + ' (' + adminUser.telegramId + ') with ' + allFeatures.length + ' features');
        
      } catch (error) {
        console.error('❌ Error adding admin user:', error.message);
      } finally {
        await prisma.\$disconnect();
      }
    }
    
    addAdminUser();
    " || print_warning "Admin user setup failed, but continuing..."
    print_success "Admin user setup completed"
else
    print_warning "ADMIN_TELEGRAM_ID not found in .env - skipping admin user setup"
fi

cd ..

print_status "Starting all services in development mode..."

# Create logs directory
mkdir -p logs

# Start services in background with logging
print_status "Starting Backend API (port 3001)..."
cd backend
npm run start:dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

print_status "Starting Frontend (port 3000)..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

print_status "Starting Telegram Bot..."
cd bot
npm run dev > ../logs/bot.log 2>&1 &
BOT_PID=$!
cd ..

# Save PIDs for cleanup
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid
echo $BOT_PID > logs/bot.pid

print_success "All services started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   API Docs: http://localhost:3001/api/docs"
echo ""
echo "📝 Logs:"
echo "   Backend: tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo "   Bot: tail -f logs/bot.log"
echo ""
echo "🛑 To stop all services: ./scripts/dev-stop.sh"
echo ""

# Wait for services to start
sleep 5

# Check if services are running
print_status "Checking service health..."

# Check backend
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        print_success "Backend API is running"
        break
    fi
    if [ $i -eq 10 ]; then
        print_warning "Backend API might not be ready yet"
    fi
    sleep 1
done

# Check frontend
if curl -s http://localhost:3000 > /dev/null; then
    print_success "Frontend is running"
else
    print_warning "Frontend might not be ready yet"
fi

print_success "Native development environment is ready!"
print_status "Using native Ubuntu services (PostgreSQL, Redis)"
print_status "Press Ctrl+C to stop all services or run ./scripts/dev-stop.sh"

# Keep script running and handle Ctrl+C
trap 'echo ""; print_status "Stopping all services..."; ./scripts/dev-stop.sh; exit 0' INT

# Wait indefinitely
while true; do
    sleep 1
done 