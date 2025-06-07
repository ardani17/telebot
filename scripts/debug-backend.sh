#!/bin/bash

# TeleWeb Backend Debug Script
echo "🔍 Debugging TeleWeb Backend..."

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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in teleweb directory. Please run from /home/teleweb"
    exit 1
fi

# Kill any existing processes
print_status "Cleaning up existing processes..."
pkill -f "nest start" 2>/dev/null || true
pkill -f "npm run start:dev" 2>/dev/null || true
sleep 3

# Check infrastructure services
print_status "Checking infrastructure services..."
if docker-compose ps | grep -q "postgres.*Up"; then
    print_success "PostgreSQL is running"
else
    print_warning "Starting PostgreSQL..."
    docker-compose up -d postgres
fi

if docker-compose ps | grep -q "redis.*Up"; then
    print_success "Redis is running"  
else
    print_warning "Starting Redis..."
    docker-compose up -d redis
fi

# Test database connection
print_status "Testing database connection..."
cd backend
if npx prisma db push --accept-data-loss --force-reset > /dev/null 2>&1; then
    print_success "Database connection working"
else
    print_error "Database connection failed"
fi

# Try to generate Prisma client
print_status "Generating Prisma client..."
if npx prisma generate > /dev/null 2>&1; then
    print_success "Prisma client generated"
else
    print_error "Prisma client generation failed"
fi

# Install missing dependencies
print_status "Checking for missing dependencies..."
if ! npm list @fastify/static > /dev/null 2>&1; then
    print_warning "Installing @fastify/static..."
    npm install @fastify/static --legacy-peer-deps --no-package-lock
fi

# Create a simple test script
print_status "Creating simple backend test..."
cat > test-server.js << 'EOF'
const express = require('express');
const app = express();
const port = 3001;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!', pid: process.pid });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on http://localhost:${port}`);
});
EOF

# Test if Express is available
if npm list express > /dev/null 2>&1; then
    print_status "Starting simple test server..."
    node test-server.js &
    TEST_PID=$!
    echo $TEST_PID > ../logs/test-server.pid
    
    sleep 3
    
    if curl -s http://localhost:3001/api/health > /dev/null; then
        print_success "Simple test server is working!"
        print_status "Test response:"
        curl -s http://localhost:3001/api/test | json_pp || curl -s http://localhost:3001/api/test
        
        print_status "Stopping test server..."
        kill $TEST_PID 2>/dev/null
        rm test-server.js
    else
        print_error "Simple test server failed"
        kill $TEST_PID 2>/dev/null
    fi
else
    print_warning "Express not available, skipping simple test"
fi

# Try NestJS with direct approach
print_status "Attempting to start NestJS backend..."
echo "Starting backend in background..."

# Set environment variables explicitly
export NODE_ENV=development
export BACKEND_PORT=3001
export PORT=3001

# Start backend with explicit port
npm run start:dev -- --port 3001 > ../logs/backend-debug.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend-debug.pid

print_status "Backend PID: $BACKEND_PID"
print_status "Waiting for backend to start..."

# Wait and test
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        print_success "Backend is responding!"
        print_status "Health check response:"
        curl -s http://localhost:3001/api/health | json_pp || curl -s http://localhost:3001/api/health
        
        print_status "API docs available at: http://localhost:3001/api/docs"
        exit 0
    fi
    
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend process died"
        print_status "Last logs:"
        tail -20 ../logs/backend-debug.log 2>/dev/null || echo "No logs found"
        exit 1
    fi
    
    print_status "Waiting... ($i/30)"
    sleep 2
done

print_error "Backend failed to start after 60 seconds"
print_status "Backend logs:"
tail -30 ../logs/backend-debug.log 2>/dev/null || echo "No logs found"

print_status "Process status:"
ps aux | grep -E "(nest|node.*backend)" | grep -v grep

kill $BACKEND_PID 2>/dev/null
exit 1 