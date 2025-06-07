#!/bin/bash

# TeleWeb Status Check Script
# This script checks the status of all services and ports

echo "📊 TeleWeb Services Status Check..."

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

# Function to check port status
check_port() {
    local port=$1
    local service_name=$2
    
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        local process_name=$(ps -p $pid -o comm= 2>/dev/null)
        print_warning "Port $port ($service_name) is in use by PID $pid ($process_name)"
        return 1
    else
        print_success "Port $port ($service_name) is available"
        return 0
    fi
}

# Function to check Docker container status
check_container() {
    local container_name=$1
    
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        local status=$(docker ps --filter "name=$container_name" --format "{{.Status}}")
        print_success "Container $container_name is running ($status)"
        return 0
    elif docker ps -a --format "table {{.Names}}" | grep -q "$container_name"; then
        local status=$(docker ps -a --filter "name=$container_name" --format "{{.Status}}")
        print_warning "Container $container_name exists but not running ($status)"
        return 1
    else
        print_status "Container $container_name not found"
        return 2
    fi
}

# Function to check service health
check_service_health() {
    local url=$1
    local service_name=$2
    
    if curl -s "$url" > /dev/null 2>&1; then
        print_success "$service_name is responding at $url"
        return 0
    else
        print_error "$service_name is not responding at $url"
        return 1
    fi
}

echo ""
echo "🔍 Checking Ports..."
echo "===================="
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 3001 "Backend API"
check_port 3000 "Frontend"
check_port 8081 "Bot API Server"

echo ""
echo "🐳 Checking Docker Containers..."
echo "================================="
check_container "teleweb_postgres"
check_container "teleweb_redis"

echo ""
echo "🌐 Checking Service Health..."
echo "============================="
if check_port 3001 "Backend API" > /dev/null 2>&1; then
    check_service_health "http://localhost:3001/health" "Backend API"
fi

if check_port 3000 "Frontend" > /dev/null 2>&1; then
    check_service_health "http://localhost:3000" "Frontend"
fi

echo ""
echo "📋 Process Information..."
echo "========================="

# Check for saved PIDs
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_success "Backend API process running (PID: $BACKEND_PID)"
    else
        print_warning "Backend API PID file exists but process not running"
    fi
else
    print_status "No Backend API PID file found"
fi

if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_success "Frontend process running (PID: $FRONTEND_PID)"
    else
        print_warning "Frontend PID file exists but process not running"
    fi
else
    print_status "No Frontend PID file found"
fi

if [ -f "logs/bot.pid" ]; then
    BOT_PID=$(cat logs/bot.pid)
    if kill -0 $BOT_PID 2>/dev/null; then
        print_success "Bot process running (PID: $BOT_PID)"
    else
        print_warning "Bot PID file exists but process not running"
    fi
else
    print_status "No Bot PID file found"
fi

echo ""
echo "🔧 Docker Status..."
echo "==================="
if command -v docker > /dev/null 2>&1; then
    print_status "Docker containers:"
    docker ps --filter "name=teleweb" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || print_warning "No TeleWeb containers found"
else
    print_error "Docker not installed or not accessible"
fi

echo ""
echo "📊 Summary..."
echo "============="
print_status "Use the following commands:"
echo "   Start development: ./scripts/dev-start.sh"
echo "   Stop development: ./scripts/dev-stop.sh"
echo "   Fix dependencies: ./scripts/fix-deps.sh"
echo "   Check status: ./scripts/check-status.sh"
echo ""
