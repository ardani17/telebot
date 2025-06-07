#!/bin/bash

# TeleWeb Production Start Script
# This script installs dependencies, builds projects, and starts all services in production mode

set -e  # Exit on any error

echo "🚀 Starting TeleWeb Production Environment..."

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
    print_error ".env file not found. Please create production environment file."
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$BOT_TOKEN" ]; then
    print_error "BOT_TOKEN is required in .env file"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL is required in .env file"
    exit 1
fi

print_status "Installing all dependencies..."
./scripts/install-deps.sh
if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_status "Building backend..."
cd backend
npm run build
print_success "Backend build completed"
cd ..

print_status "Building frontend..."
cd frontend
npm run build
print_success "Frontend build completed"
cd ..

print_status "Building bot..."
cd bot
npm run build
print_success "Bot build completed"
cd ..

print_status "Generating Prisma client..."
cd backend
npx prisma generate
cd ..

print_status "Starting production Docker services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 15

print_status "Running database migrations..."
cd backend
npx prisma migrate deploy
print_success "Database migrations completed"

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

print_status "Starting services with PM2..."

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'teleweb-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: '../logs/backend.log',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      max_memory_restart: '1G',
      restart_delay: 4000
    },
    {
      name: 'teleweb-bot',
      cwd: './bot',
      script: 'dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      log_file: '../logs/bot.log',
      error_file: '../logs/bot-error.log',
      out_file: '../logs/bot-out.log',
      max_memory_restart: '512M',
      restart_delay: 4000
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# Start services with PM2
pm2 start ecosystem.config.js

# Setup PM2 startup
pm2 startup
pm2 save

print_success "Production services started successfully!"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""
echo "📝 Logs:"
echo "   Backend: pm2 logs teleweb-backend"
echo "   Bot: pm2 logs teleweb-bot"
echo "   All: pm2 logs"
echo ""
echo "🔧 Management Commands:"
echo "   Status: pm2 status"
echo "   Restart: pm2 restart all"
echo "   Stop: pm2 stop all"
echo "   Delete: pm2 delete all"
echo ""
echo "🌐 Frontend:"
echo "   Serve static files from: ./frontend/dist"
echo "   Configure your web server (Nginx) to serve these files"
echo ""

print_success "Production environment is ready!"

# Show final status
sleep 3
print_status "Final service status:"
pm2 status
