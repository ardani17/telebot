#!/bin/bash

echo "🔍 TeleWeb Database Debug Script"
echo "================================"

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

echo ""
print_status "1. Checking PostgreSQL Service Status..."
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL service is active"
else
    print_error "PostgreSQL service is not active"
    print_status "Attempting to start PostgreSQL..."
    systemctl start postgresql
    sleep 3
    if systemctl is-active --quiet postgresql; then
        print_success "PostgreSQL started successfully"
    else
        print_error "Failed to start PostgreSQL"
    fi
fi

echo ""
print_status "2. Checking PostgreSQL Processes..."
POSTGRES_PROCESSES=$(ps aux | grep postgres | grep -v grep | wc -l)
if [ $POSTGRES_PROCESSES -gt 0 ]; then
    print_success "Found $POSTGRES_PROCESSES PostgreSQL processes running"
    ps aux | grep postgres | grep -v grep | head -3
else
    print_error "No PostgreSQL processes found"
fi

echo ""
print_status "3. Checking PostgreSQL Port (5432)..."
if ss -tuln | grep -q ":5432 "; then
    print_success "PostgreSQL is listening on port 5432"
    ss -tuln | grep 5432
else
    print_error "PostgreSQL is NOT listening on port 5432"
    print_status "Checking if PostgreSQL is running on different port..."
    ss -tuln | grep postgres || echo "No PostgreSQL ports found"
fi

echo ""
print_status "4. Checking PostgreSQL Configuration..."
PG_VERSION=$(ls /etc/postgresql/ 2>/dev/null | head -1)
if [ ! -z "$PG_VERSION" ]; then
    print_success "PostgreSQL version $PG_VERSION found"
    PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
    if [ -f "$PG_CONFIG" ]; then
        print_status "Config file: $PG_CONFIG"
        grep -E "^(listen_addresses|port)" $PG_CONFIG || echo "Default settings (commented out)"
    fi
else
    print_error "PostgreSQL configuration not found"
fi

echo ""
print_status "5. Testing Database Connections..."

# Test as postgres user
print_status "Testing connection as postgres user..."
if sudo -u postgres psql -c "SELECT version();" >/dev/null 2>&1; then
    print_success "postgres user can connect"
    POSTGRES_VERSION=$(sudo -u postgres psql -c "SELECT version();" -t | head -1)
    echo "   $POSTGRES_VERSION"
else
    print_error "postgres user cannot connect"
fi

# Test as root user
print_status "Testing connection as root user..."
if psql -U root -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "root user can connect to postgres database"
else
    print_error "root user cannot connect to postgres database"
fi

# Test teleweb database
print_status "Testing teleweb database..."
if psql -U root -d teleweb -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "root user can connect to teleweb database"
else
    print_error "root user cannot connect to teleweb database"
    print_status "Checking if teleweb database exists..."
    if sudo -u postgres psql -c "\l" | grep -q "teleweb"; then
        print_warning "teleweb database exists but root cannot access it"
    else
        print_error "teleweb database does not exist"
    fi
fi

echo ""
print_status "6. Checking .env Database Configuration..."
if [ -f "/home/teleweb/.env" ]; then
    print_success ".env file found"
    grep "DATABASE_URL" /home/teleweb/.env || print_warning "DATABASE_URL not found in .env"
else
    print_error ".env file not found"
fi

echo ""
print_status "7. PostgreSQL Log Check..."
PG_LOG="/var/log/postgresql/postgresql-${PG_VERSION:-14}-main.log"
if [ -f "$PG_LOG" ]; then
    print_status "Recent PostgreSQL log entries:"
    tail -10 "$PG_LOG" 2>/dev/null || print_warning "Cannot read PostgreSQL log"
else
    print_warning "PostgreSQL log file not found at $PG_LOG"
fi

echo ""
print_status "8. Recommended Actions:"
echo "   - If PostgreSQL is not listening on 5432, check postgresql.conf"
echo "   - If root user cannot connect, check pg_hba.conf authentication"
echo "   - If teleweb database doesn't exist, create it"
echo "   - Verify DATABASE_URL in .env matches actual setup"

echo ""
print_status "Debug completed. Check the results above for issues." 