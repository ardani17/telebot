#!/bin/bash

# Telegram Bot API Server Script (Native Binary)
# This script manages the local Telegram Bot API server for TeleWeb using native binary

set -e

echo "🤖 Telegram Bot API Server Manager (Native)"
echo "==========================================="

# Configuration
PROJECT_DIR="/home/teleweb"
DATA_DIR="/home/teleweb/backend/data-bot-api"
LOG_DIR="/home/teleweb/logs"
API_SERVER_PORT=8081
API_SERVER_HOST="0.0.0.0"
TELEGRAM_API_BINARY="/usr/local/bin/telegram-bot-api"
PID_FILE="/var/run/telegram-bot-api.pid"

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

# Load environment variables
load_env() {
    if [ -f "$PROJECT_DIR/.env" ]; then
        source "$PROJECT_DIR/.env"
        log_success "Environment variables loaded"
        
        # Override DATA_DIR if BOT_API_DATA_PATH is set
        if [ -n "$BOT_API_DATA_PATH" ]; then
            DATA_DIR="$BOT_API_DATA_PATH"
            log_info "Using data directory from .env: $DATA_DIR"
        fi
        
        # Override port if HTTP_PORT is set
        if [ -n "$HTTP_PORT" ]; then
            API_SERVER_PORT="$HTTP_PORT"
            log_info "Using port from .env: $API_SERVER_PORT"
        fi
    else
        log_error ".env file not found in $PROJECT_DIR"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if bot token is set
    if [ -z "$BOT_TOKEN" ]; then
        log_error "BOT_TOKEN not found in environment variables"
        exit 1
    fi
    
    # Check if API credentials are set
    if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ]; then
        log_error "TELEGRAM_API_ID or TELEGRAM_API_HASH not found in environment variables"
        log_info "Get these from https://my.telegram.org/apps"
        exit 1
    fi
    
    # Check if telegram-bot-api binary exists
    if [ ! -f "$TELEGRAM_API_BINARY" ]; then
        log_error "Telegram Bot API binary not found at $TELEGRAM_API_BINARY"
        log_info "Please install telegram-bot-api binary first"
        exit 1
    fi
    
    # Check if binary is executable
    if [ ! -x "$TELEGRAM_API_BINARY" ]; then
        log_error "Telegram Bot API binary is not executable"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p "$DATA_DIR"
    mkdir -p "$LOG_DIR"
    
    # Create specific data directory for bot token
    BOT_DATA_DIR="$DATA_DIR/$BOT_TOKEN"
    mkdir -p "$BOT_DATA_DIR"
    
    # Set proper permissions
    chmod -R 755 "$DATA_DIR"
    chmod -R 755 "$LOG_DIR"
    
    log_success "Directories created: $DATA_DIR"
}

# Check if API server is running
check_api_server() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_success "Telegram Bot API server is running (PID: $pid)"
            return 0
        else
            log_warning "PID file exists but process not running, cleaning up"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        # Check by process name as fallback
        if pgrep -f "telegram-bot-api" > /dev/null; then
            log_warning "Telegram Bot API server running but no PID file found"
            return 0
        else
            log_warning "Telegram Bot API server is not running"
            return 1
        fi
    fi
}

# Start API server
start_api_server() {
    log_info "Starting Telegram Bot API server..."
    
    # Check if already running
    if check_api_server; then
        log_warning "Telegram Bot API server is already running"
        return 0
    fi
    
    # Stop any existing process
    stop_api_server
    
    # Create log file
    local log_file="$LOG_DIR/telegram-bot-api.log"
    mkdir -p "$LOG_DIR"
    
    # Start the server in background
    nohup "$TELEGRAM_API_BINARY" \
        --local \
        --api-id="$TELEGRAM_API_ID" \
        --api-hash="$TELEGRAM_API_HASH" \
        --http-port="$API_SERVER_PORT" \
        --dir="$DATA_DIR" \
        --temp-dir="$DATA_DIR/temp" \
        --verbosity=1 \
        --max-webhook-connections=1000 \
        --max-connections=1000 \
        > "$log_file" 2>&1 &
    
    local pid=$!
    echo $pid > "$PID_FILE"
    
    log_success "Telegram Bot API server started with PID: $pid"
    log_info "Log file: $log_file"
    
    # Wait for server to be ready
    log_info "Waiting for API server to be ready..."
    sleep 5
    
    # Check if process is still running
    if ps -p "$pid" > /dev/null 2>&1; then
        log_success "Process is running"
        
        # Test if server is responding
        local retries=0
        while [ $retries -lt 10 ]; do
            if curl -sf "http://localhost:$API_SERVER_PORT/bot$BOT_TOKEN/getMe" &> /dev/null; then
                log_success "API server is responding correctly"
                return 0
            fi
            retries=$((retries + 1))
            sleep 2
        done
        
        log_warning "API server started but not responding to requests yet"
    else
        log_error "Process died immediately after starting"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Stop API server
stop_api_server() {
    log_info "Stopping Telegram Bot API server..."
    
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_info "Stopping process with PID: $pid"
            kill "$pid"
            
            # Wait for graceful shutdown
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                log_warning "Process not responding, force killing..."
                kill -9 "$pid"
            fi
            
            log_success "Process stopped"
        else
            log_warning "PID file exists but process not running"
        fi
        
        rm -f "$PID_FILE"
    else
        # Kill by process name as fallback
        local pids=$(pgrep -f "telegram-bot-api" || true)
        if [ -n "$pids" ]; then
            log_info "Killing telegram-bot-api processes: $pids"
            kill $pids 2>/dev/null || true
            sleep 2
            pkill -9 -f "telegram-bot-api" 2>/dev/null || true
        fi
    fi
    
    log_success "Telegram Bot API server stopped"
}

# Restart API server
restart_api_server() {
    log_info "Restarting Telegram Bot API server..."
    stop_api_server
    sleep 2
    start_api_server
}

# Show status
show_status() {
    log_info "Telegram Bot API Server Status (Native)"
    echo "========================================"
    
    if check_api_server; then
        echo "🟢 Status: RUNNING"
        
        # Show process info
        echo ""
        log_info "Process Information:"
        if [ -f "$PID_FILE" ]; then
            local pid=$(cat "$PID_FILE")
            ps -p "$pid" -o pid,ppid,cmd --no-headers 2>/dev/null || echo "Process info unavailable"
        fi
        
        # Show API info
        echo ""
        log_info "API Information:"
        echo "   Local API URL: http://localhost:$API_SERVER_PORT"
        echo "   Bot API URL: http://localhost:$API_SERVER_PORT/bot$BOT_TOKEN"
        echo "   Data Directory: $DATA_DIR"
        echo "   Binary Path: $TELEGRAM_API_BINARY"
        echo "   PID File: $PID_FILE"
        
        # Show listening port
        echo ""
        log_info "Network Information:"
        netstat -tlnp 2>/dev/null | grep ":$API_SERVER_PORT " || echo "Port $API_SERVER_PORT not found in netstat"
        
        # Test API
        echo ""
        log_info "API Test:"
        if curl -sf "http://localhost:$API_SERVER_PORT/bot$BOT_TOKEN/getMe" | jq -r '.result.username' 2>/dev/null; then
            echo "✅ API is responding"
        else
            echo "❌ API test failed"
        fi
        
    else
        echo "🔴 Status: STOPPED"
    fi
    
    echo ""
    log_info "Logs (last 10 lines):"
    local log_file="$LOG_DIR/telegram-bot-api.log"
    if [ -f "$log_file" ]; then
        tail -10 "$log_file"
    else
        echo "No log file found at $log_file"
    fi
}

# Show logs
show_logs() {
    local lines=${1:-50}
    log_info "Showing last $lines lines of logs..."
    
    local log_file="$LOG_DIR/telegram-bot-api.log"
    if [ -f "$log_file" ]; then
        tail -n $lines -f "$log_file"
    else
        log_error "Log file not found at $log_file"
    fi
}

# Test API
test_api() {
    log_info "Testing Telegram Bot API..."
    
    if ! check_api_server; then
        log_error "API server is not running"
        exit 1
    fi
    
    echo ""
    log_info "Testing getMe endpoint:"
    local response=$(curl -sf "http://localhost:$API_SERVER_PORT/bot$BOT_TOKEN/getMe")
    
    if [ $? -eq 0 ]; then
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        log_success "API test successful"
    else
        log_error "API test failed"
        exit 1
    fi
}

# Update server
update_server() {
    log_info "Binary update not supported in native mode"
    log_info "Please update telegram-bot-api binary manually"
    log_info "Current binary: $TELEGRAM_API_BINARY"
}

# Setup systemd service
setup_systemd() {
    log_info "Setting up systemd service..."
    
    # Create systemd service file
    cat > /tmp/telegram-bot-api.service << EOF
[Unit]
Description=Telegram Bot API Server (Native)
After=network.target

[Service]
Type=forking
PIDFile=$PID_FILE
ExecStart=$PROJECT_DIR/scripts/telegram-api-server.sh start
ExecStop=$PROJECT_DIR/scripts/telegram-api-server.sh stop
ExecReload=$PROJECT_DIR/scripts/telegram-api-server.sh restart
Restart=always
RestartSec=10
User=root
Group=root
WorkingDirectory=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    # Install service
    sudo mv /tmp/telegram-bot-api.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable telegram-bot-api.service
    
    log_success "Systemd service created and enabled"
    log_info "Use 'sudo systemctl start telegram-bot-api' to start via systemd"
}

# Show help
show_help() {
    echo "Telegram Bot API Server Manager (Native Binary)"
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start      Start the API server"
    echo "  stop       Stop the API server"
    echo "  restart    Restart the API server"
    echo "  status     Show server status"
    echo "  logs       Show server logs (optional: number of lines)"
    echo "  test       Test API connectivity"
    echo "  update     Show update instructions"
    echo "  setup      Setup systemd service"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start the server"
    echo "  $0 logs 100                 # Show last 100 log lines"
    echo "  $0 status                   # Check server status"
    echo ""
    echo "Configuration:"
    echo "  Binary: $TELEGRAM_API_BINARY"
    echo "  PID File: $PID_FILE"
    echo "  Data Dir: $DATA_DIR (from BOT_API_DATA_PATH)"
    echo "  Port: $API_SERVER_PORT (from HTTP_PORT)"
}

# Main function
main() {
    cd "$PROJECT_DIR"
    load_env
    
    case "${1:-status}" in
        start)
            check_prerequisites
            setup_directories
            start_api_server
            ;;
        stop)
            stop_api_server
            ;;
        restart)
            check_prerequisites
            restart_api_server
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-50}"
            ;;
        test)
            test_api
            ;;
        update)
            update_server
            ;;
        setup)
            setup_systemd
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 