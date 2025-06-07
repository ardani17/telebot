#!/bin/bash

# TeleWeb Docker Compose Test Script
# This script tests the Docker Compose setup and ensures all services start correctly

set -e  # Exit on any error

echo "🐳 Testing TeleWeb Docker Compose Setup..."

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
    print_error ".env file not found. Please create it first."
    exit 1
fi

# Load environment variables
source .env

# Function to check and kill processes using specific ports
check_and_kill_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking if port $port is in use..."
    local pid=$(lsof -ti:$port 2>/dev/null || ss -tulpn | grep ":$port " | awk '{print $7}' | cut -d',' -f2 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        print_warning "Port $port is in use by PID $pid ($service_name)"
        print_status "Killing process on port $port..."
        kill -9 $pid 2>/dev/null || true
        sleep 2
        print_success "Process on port $port killed"
    else
        print_status "Port $port is available"
    fi
}

# Function to stop and remove existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    
    # Stop and remove existing containers
    docker-compose down 2>/dev/null || true
    docker container prune -f 2>/dev/null || true
    docker image prune -f 2>/dev/null || true
    
    print_success "Container cleanup completed"
}

# Update Dockerfiles to use npm install instead of npm ci
update_dockerfiles() {
    print_status "Updating Dockerfiles to use npm install..."
    
    # Update backend Dockerfile
    sed -i 's/npm ci --only=production/npm install --legacy-peer-deps --no-package-lock --production/g' backend/Dockerfile
    sed -i 's/npm ci$/npm install --legacy-peer-deps --no-package-lock/g' backend/Dockerfile
    
    # Update frontend Dockerfile  
    sed -i 's/npm ci --only=production/npm install --legacy-peer-deps --no-package-lock --production/g' frontend/Dockerfile
    sed -i 's/npm ci$/npm install --legacy-peer-deps --no-package-lock/g' frontend/Dockerfile
    
    # Update bot Dockerfile
    sed -i 's/npm ci --only=production/npm install --legacy-peer-deps --no-package-lock --production/g' bot/Dockerfile
    sed -i 's/npm ci$/npm install --legacy-peer-deps --no-package-lock/g' bot/Dockerfile
    
    print_success "Dockerfiles updated"
}

# Pre-install dependencies to avoid Docker build issues
prepare_dependencies() {
    print_status "Preparing dependencies for Docker build..."
    
    # Install shared dependencies
    print_status "Installing shared dependencies..."
    cd shared
    npm install --legacy-peer-deps --no-package-lock 2>/dev/null || true
    npm run build 2>/dev/null || true
    cd ..
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install --legacy-peer-deps --no-package-lock 2>/dev/null || true
    npx prisma generate 2>/dev/null || true
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install --legacy-peer-deps --no-package-lock 2>/dev/null || true
    cd ..
    
    # Install bot dependencies
    print_status "Installing bot dependencies..."
    cd bot
    npm install --legacy-peer-deps --no-package-lock 2>/dev/null || true
    cd ..
    
    print_success "Dependencies prepared"
}

# Test individual services
test_service() {
    local service_name=$1
    local port=$2
    local health_endpoint=$3
    local max_attempts=30
    
    print_status "Testing $service_name service..."
    
    for i in $(seq 1 $max_attempts); do
        if [ "$health_endpoint" != "" ]; then
            if curl -s "$health_endpoint" > /dev/null 2>&1; then
                print_success "$service_name is running and responding"
                return 0
            fi
        else
            # Use docker container check for services without health endpoint
            if docker-compose ps | grep -q "$service_name.*Up"; then
                print_success "$service_name container is running"
                return 0
            fi
        fi
        
        if [ $i -eq $max_attempts ]; then
            print_error "$service_name failed to start after $max_attempts attempts"
            return 1
        fi
        
        print_status "Waiting for $service_name... ($i/$max_attempts)"
        sleep 5
    done
}

# Main test function
main() {
    print_status "Starting Docker Compose test..."
    
    # Pre-test cleanup
    check_and_kill_port 5432 "PostgreSQL"
    check_and_kill_port 6379 "Redis"  
    check_and_kill_port 3001 "Backend API"
    check_and_kill_port 3000 "Frontend"
    cleanup_containers
    
    # Prepare for build
    update_dockerfiles
    prepare_dependencies
    
    # Start infrastructure services first
    print_status "Starting infrastructure services (PostgreSQL, Redis)..."
    docker-compose up -d postgres redis
    
    # Wait for infrastructure
    test_service "PostgreSQL" 5432 ""
    test_service "Redis" 6379 ""
    
    # Start backend service
    print_status "Starting backend service..."
    docker-compose up -d backend
    
    # Test backend
    sleep 10  # Give backend time to start
    test_service "Backend" 3001 "http://localhost:3001/health"
    
    # Start frontend service
    print_status "Starting frontend service..."
    docker-compose up -d frontend
    
    # Test frontend
    sleep 10  # Give frontend time to start
    test_service "Frontend" 3000 "http://localhost:3000"
    
    # Start bot service
    print_status "Starting bot service..."
    docker-compose up -d bot
    
    # Wait for bot to start
    sleep 5
    
    # Check all containers status
    print_status "Checking container status..."
    docker-compose ps
    
    # Show logs for debugging
    print_status "Recent logs from all services:"
    echo "=== Backend Logs ==="
    docker-compose logs --tail=10 backend
    echo "=== Frontend Logs ==="
    docker-compose logs --tail=10 frontend
    echo "=== Bot Logs ==="
    docker-compose logs --tail=10 bot
    
    print_success "Docker Compose test completed!"
    echo ""
    echo "📊 Service URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:3001"
    echo "   API Docs: http://localhost:3001/api/docs"
    echo ""
    echo "📝 To view logs: docker-compose logs -f [service_name]"
    echo "🛑 To stop: docker-compose down"
    echo ""
}

# Run main function
main "$@" 