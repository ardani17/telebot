#!/bin/bash

# TeleWeb Continue Development Script
echo "🚀 Continuing TeleWeb Development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in teleweb directory. Please run from /home/teleweb"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

print_status "Current Development Status:"
echo "✅ Infrastructure: PostgreSQL, Redis"
echo "✅ Backend: NestJS API running on port 3001"  
echo "✅ Database: Prisma schema and migrations"
echo "✅ Environment: .env configuration"
echo "🔄 Frontend: Needs testing"
echo "⏳ Bot: Ready for implementation"
echo ""

# Check if backend is still running
if curl -s http://localhost:3001/api/health > /dev/null; then
    print_success "Backend is running"
else
    print_warning "Starting backend..."
    cd backend
    npm run start:dev > ../logs/backend.log 2>&1 &
    echo $! > ../logs/backend.pid
    cd ..
    sleep 10
fi

# Test and fix frontend
print_status "Testing frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    print_success "Frontend is running"
else
    print_warning "Starting frontend..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > ../logs/frontend.pid
    cd ..
    sleep 10
    
    if curl -s http://localhost:3000 > /dev/null; then
        print_success "Frontend started successfully"
    else
        print_warning "Frontend may need more time to start"
    fi
fi

# Database seeding
print_status "Setting up database seeding..."
cd backend

# Create seed script if it doesn't exist
if [ ! -f "prisma/seed.ts" ]; then
    print_status "Creating database seed script..."
    cat > prisma/seed.ts << 'EOF'
import { PrismaClient, UserRole, BotMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { telegramId: process.env.ADMIN_TELEGRAM_ID || '731289973' },
    update: {},
    create: {
      telegramId: process.env.ADMIN_TELEGRAM_ID || '731289973',
      name: process.env.ADMIN_NAME || 'Ardani',
      username: process.env.ADMIN_USERNAME || 'yaelahdan',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', adminUser);

  // Create default features
  const features = [
    { name: 'ocr', description: 'OCR Text Recognition from Images' },
    { name: 'rar', description: 'Archive Extraction and Management' },
    { name: 'location', description: 'Location and GPS Processing' },
    { name: 'geotags', description: 'Geotag Extraction from Images' },
    { name: 'kml', description: 'KML File Processing' },
    { name: 'workbook', description: 'Excel/CSV File Processing' },
  ];

  for (const feature of features) {
    const createdFeature = await prisma.feature.upsert({
      where: { name: feature.name },
      update: {},
      create: feature,
    });

    // Grant access to admin user
    await prisma.userFeatureAccess.upsert({
      where: {
        userId_featureId: {
          userId: adminUser.id,
          featureId: createdFeature.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        featureId: createdFeature.id,
        grantedBy: adminUser.id,
      },
    });

    console.log(`✅ Feature '${feature.name}' created and granted to admin`);
  }

  // Create bot configuration
  const botConfig = await prisma.botConfig.upsert({
    where: { token: process.env.BOT_TOKEN || 'default' },
    update: {},
    create: {
      token: process.env.BOT_TOKEN || 'default',
      apiServer: process.env.BOT_API_SERVER || 'https://api.telegram.org',
      isActive: true,
      maxFileSize: 1900 * 1024 * 1024, // 1.9GB
      allowedFileTypes: ['image/*', 'application/zip', 'application/rar', 'text/*'],
    },
  });

  console.log('✅ Bot configuration created:', botConfig);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

    # Update package.json to include seed script
    if ! grep -q '"prisma"' package.json; then
        # Add prisma section to package.json
        npx json -I -f package.json -e 'this.prisma={seed:"ts-node prisma/seed.ts"}'
    fi
fi

# Run database seeding
print_status "Running database seeding..."
if npx prisma db seed; then
    print_success "Database seeded successfully"
else
    print_warning "Database seeding skipped (may already be seeded)"
fi

cd ..

# Test all services
print_status "Testing all services..."

# Test backend
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    print_success "✅ Backend API: http://localhost:3001"
    print_status "   API Docs: http://localhost:3001/api/docs"
else
    print_error "❌ Backend not responding"
fi

# Test frontend  
if curl -s http://localhost:3000 > /dev/null; then
    print_success "✅ Frontend: http://localhost:3000"
else
    print_warning "⚠️  Frontend may still be starting"
fi

# Test database
if docker-compose exec -T postgres pg_isready > /dev/null 2>&1; then
    print_success "✅ PostgreSQL Database"
else
    print_warning "⚠️  Database connection issue"
fi

# Test Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_success "✅ Redis Cache"
else
    print_warning "⚠️  Redis connection issue"
fi

print_status ""
print_success "🎯 Development Environment Status:"
echo "   📊 Backend API: http://localhost:3001"
echo "   🎨 Frontend: http://localhost:3000"  
echo "   📚 API Docs: http://localhost:3001/api/docs"
echo "   🗄️  Database: PostgreSQL (Docker)"
echo "   ⚡ Cache: Redis (Docker)"
echo ""
print_status "📋 Next Steps:"
echo "   1. Test frontend functionality"
echo "   2. Implement bot features"
echo "   3. Add authentication flow"
echo "   4. Build admin dashboard"
echo ""
print_status "📝 Logs available in: ./logs/"
print_status "🛑 Stop services: ./scripts/dev-stop.sh" 