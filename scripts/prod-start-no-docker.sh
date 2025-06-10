#!/bin/bash

# TeleWeb Production Start Script (No Docker)
# This script starts all TeleWeb services directly on the VPS without Docker

set -e  # Exit on any error

echo "🚀 TeleWeb Production Start (No Docker)"
echo "======================================="

# Configuration
PROJECT_DIR="/home/teleweb"
LOG_DIR="/home/teleweb/logs"
NGINX_CONFIG="/etc/nginx/sites-enabled/teleweb"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (for system services)
check_sudo() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. This is recommended for production setup."
    else
        log_info "Running as user: $(whoami)"
    fi
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Project directory $PROJECT_DIR not found!"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_error ".env file not found in $PROJECT_DIR"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 is not installed. Installing..."
        npm install -g pm2
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL client not found. Database operations may fail."
    fi
    
    # Check nginx
    if ! command -v nginx &> /dev/null; then
        log_warning "Nginx not found. Web server will not be available."
    fi
    
    log_success "Pre-flight checks completed"
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$PROJECT_DIR/backend/uploads"
    mkdir -p "$PROJECT_DIR/backend/temp"
    mkdir -p "$PROJECT_DIR/backend/data-bot-api"
    
    # Set proper permissions
    chmod -R 755 "$PROJECT_DIR"
    
    log_success "Directories created and permissions set"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."
    
    cd "$PROJECT_DIR"
    
    # Load environment variables
    if [ -f .env ]; then
        source .env
        log_success "Environment variables loaded"
    else
        log_error ".env file not found!"
        exit 1
    fi
    
    # Set NODE_ENV to production
    export NODE_ENV=production
    
    log_success "Environment setup completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Root dependencies
    if [ -f package.json ]; then
        npm install --production
        log_success "Root dependencies installed"
    fi
    
    # Backend dependencies
    if [ -d backend ] && [ -f backend/package.json ]; then
        cd backend
        npm install --production
        cd ..
        log_success "Backend dependencies installed"
    fi
    
    # Frontend dependencies (only for build)
    if [ -d frontend ] && [ -f frontend/package.json ]; then
        cd frontend
        npm install
        cd ..
        log_success "Frontend dependencies installed"
    fi
    
    # Bot dependencies
    if [ -d bot ] && [ -f bot/package.json ]; then
        cd bot
        npm install --production
        cd ..
        log_success "Bot dependencies installed"
    fi
    
    # Shared dependencies
    if [ -d shared ] && [ -f shared/package.json ]; then
        cd shared
        npm install --production
        cd ..
        log_success "Shared dependencies installed"
    fi
}

# Build applications
build_applications() {
    log_info "Building applications..."
    
    cd "$PROJECT_DIR"
    
    # Build shared module first
    if [ -d shared ]; then
        cd shared
        if [ -f package.json ] && npm run build &> /dev/null; then
            log_success "Shared module built"
        fi
        cd ..
    fi
    
    # Build backend
    if [ -d backend ]; then
        cd backend
        if [ -f package.json ] && npm run build &> /dev/null; then
            log_success "Backend built successfully"
        else
            log_warning "Backend build skipped or failed"
        fi
        cd ..
    fi
    
    # Build frontend
    if [ -d frontend ]; then
        cd frontend
        if [ -f package.json ]; then
            # Ensure VITE_API_URL is not set for relative URLs
            unset VITE_API_URL
            npm run build
            log_success "Frontend built successfully"
        fi
        cd ..
    fi
    
    # Build bot
    if [ -d bot ]; then
        cd bot
        if [ -f package.json ] && npm run build &> /dev/null; then
            log_success "Bot built successfully"
        else
            log_warning "Bot build skipped or failed"
        fi
        cd ..
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    cd "$PROJECT_DIR"
    
    # Check if database is running
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h localhost -p 5432 &> /dev/null; then
            log_success "PostgreSQL is running"
        else
            log_error "PostgreSQL is not running. Please start PostgreSQL service."
            exit 1
        fi
    fi
    
    # Run database migrations if available
    if [ -d backend ] && [ -f backend/package.json ]; then
        cd backend
        
        # Check if Prisma is used
        if [ -d prisma ]; then
            # Generate Prisma client
            npx prisma generate &> /dev/null || log_warning "Prisma generate failed"
            
            # Run migrations
            npx prisma migrate deploy &> /dev/null || log_warning "Prisma migrations failed"
            
            log_success "Database migrations completed"
        fi
        
        cd ..
    fi
}

# Setup nginx
setup_nginx() {
    log_info "Setting up nginx..."
    
    # Check if nginx config exists
    if [ -f "$NGINX_CONFIG" ]; then
        # Test nginx configuration
        if nginx -t &> /dev/null; then
            log_success "Nginx configuration is valid"
            
            # Restart nginx
            systemctl restart nginx &> /dev/null || log_warning "Failed to restart nginx"
            
            if systemctl is-active --quiet nginx; then
                log_success "Nginx restarted successfully"
            else
                log_error "Nginx failed to start"
            fi
        else
            log_error "Nginx configuration is invalid"
        fi
    else
        log_warning "Nginx configuration not found at $NGINX_CONFIG"
    fi
}

# Start Telegram API Server
start_telegram_api_server() {
    log_info "Starting Telegram Bot API Server..."
    
    # Check if telegram-bot-api binary exists
    if [ -f "/usr/local/bin/telegram-bot-api" ]; then
        # Start Telegram API Server using the script
        if [ -f "$PROJECT_DIR/scripts/telegram-api-server.sh" ]; then
            chmod +x "$PROJECT_DIR/scripts/telegram-api-server.sh"
            cd "$PROJECT_DIR"
            ./scripts/telegram-api-server.sh start
            log_success "Telegram Bot API Server started"
        else
            log_warning "telegram-api-server.sh not found at $PROJECT_DIR/scripts/, skipping API server"
        fi
    else
        log_warning "telegram-bot-api binary not found at /usr/local/bin/telegram-bot-api, skipping API server"
    fi
}

# Start services with PM2
start_services() {
    log_info "Starting services with PM2..."
    
    cd "$PROJECT_DIR"
    
    # Stop existing PM2 processes
    pm2 delete all &> /dev/null || log_info "No existing PM2 processes to stop"
    
    # Start Telegram API Server first
    start_telegram_api_server
    
    # Wait a bit for API server to be ready
    sleep 5
    
    # Start services using ecosystem file
    if [ -f ecosystem.config.js ]; then
        pm2 start ecosystem.config.js --env production
        log_success "Services started with PM2 ecosystem config"
    else
        # Fallback: start services individually
        log_warning "ecosystem.config.js not found, starting services individually"
        
        # Start backend
        if [ -d backend ] && [ -f backend/dist/main.js ]; then
            pm2 start backend/dist/main.js --name "teleweb-backend" --env production
            log_success "Backend started"
        elif [ -d backend ] && [ -f backend/src/main.ts ]; then
            pm2 start "npm run start:prod" --name "teleweb-backend" --cwd backend
            log_success "Backend started (dev mode)"
        fi
        
        # Start bot
        if [ -d bot ] && [ -f bot/dist/index.js ]; then
            pm2 start bot/dist/index.js --name "teleweb-bot" --env production
            log_success "Bot started"
        elif [ -d bot ] && [ -f bot/src/index.ts ]; then
            pm2 start "npm run start" --name "teleweb-bot" --cwd bot
            log_success "Bot started (dev mode)"
        fi
    fi
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup
    pm2 startup | grep -E "^sudo" | bash || log_warning "PM2 startup setup may have failed"
    
    log_success "PM2 services configured for auto-startup"
}

# Monitor services
monitor_services() {
    log_info "Monitoring services..."
    
    sleep 5  # Wait for services to fully start
    
    echo ""
    log_info "PM2 Status:"
    pm2 status
    
    echo ""
    log_info "Service Health Checks:"
    
    # Check backend health
    if curl -sf http://localhost:3001/api/health &> /dev/null; then
        log_success "Backend is healthy (port 3001)"
    else
        log_error "Backend health check failed"
    fi
    
    # Check nginx proxy
    if curl -sf http://localhost:8080/api/health &> /dev/null; then
        log_success "Nginx proxy is working (port 8080)"
    else
        log_error "Nginx proxy health check failed"
    fi
    
    # Check frontend
    if curl -sf http://localhost:8080 &> /dev/null; then
        log_success "Frontend is accessible (port 8080)"
    else
        log_error "Frontend accessibility check failed"
    fi
    
    # Check Telegram API Server
    if curl -sf http://localhost:8081 &> /dev/null; then
        log_success "Telegram Bot API Server is running (port 8081)"
    else
        log_warning "Telegram Bot API Server check failed"
    fi
    
    echo ""
    log_info "System Resources:"
    free -h | head -2
    df -h / | tail -1
}

# Display final information
display_info() {
    echo ""
    echo "🎉 TeleWeb Production Start Complete!"
    echo "====================================="
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://$(hostname -I | awk '{print $1}'):8080"
    echo "   Backend API: http://$(hostname -I | awk '{print $1}'):3001/api"
    echo "   Health Check: http://$(hostname -I | awk '{print $1}'):8080/api/health"
    echo "   Telegram Bot API: http://$(hostname -I | awk '{print $1}'):8081"
    echo ""
    echo "📊 Management Commands:"
    echo "   PM2 Status: pm2 status"
    echo "   PM2 Logs: pm2 logs"
    echo "   PM2 Restart: pm2 restart all"
    echo "   Check Services: ./check-services.sh"
    echo ""
    echo "📋 Important Files:"
    echo "   Logs: $LOG_DIR"
    echo "   Config: $PROJECT_DIR/.env"
    echo "   Nginx: $NGINX_CONFIG"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   Backend logs: pm2 logs teleweb-backend"
    echo "   Bot logs: pm2 logs teleweb-bot"
    echo "   Telegram API logs: tail -f /home/teleweb/logs/telegram-bot-api.log"
    echo "   Telegram API status: ./scripts/telegram-api-server.sh status"
    echo "   Nginx logs: tail -f /var/log/nginx/error.log"
    echo "   System logs: journalctl -f"
}

# Main execution
main() {
    echo ""
    log_info "Starting TeleWeb production deployment..."
    
    check_sudo
    preflight_checks
    setup_directories
    setup_environment
    install_dependencies
    build_applications
    setup_database
    setup_nginx
    start_services
    monitor_services
    display_info
    
    echo ""
    log_success "🎉 TeleWeb is now running in production mode!"
}

# Error handling
trap 'log_error "Script failed at line $LINENO. Exit code: $?"' ERR

# Run main function
main "$@" 