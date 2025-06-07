#!/bin/bash

# TeleWeb Database Fix Script
# This script fixes common PostgreSQL issues when switching from Docker to native

set -e

echo "🔧 TeleWeb Database Fix Script"
echo "=============================="

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Restart PostgreSQL
print_status "Step 1: Restarting PostgreSQL service..."
systemctl stop postgresql || true
sleep 2
systemctl start postgresql
sleep 3

if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL service restarted"
else
    print_error "Failed to restart PostgreSQL"
    exit 1
fi

# Step 2: Check if PostgreSQL is listening
print_status "Step 2: Checking PostgreSQL port..."
sleep 3
if ss -tuln | grep -q ":5432 "; then
    print_success "PostgreSQL is listening on port 5432"
else
    print_warning "PostgreSQL not listening on 5432, trying to configure..."
    
    # Enable PostgreSQL to listen on all addresses
    PG_VERSION=$(ls /etc/postgresql/ | head -1)
    PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
    
    if [ -f "$PG_CONFIG" ]; then
        # Backup config
        cp "$PG_CONFIG" "$PG_CONFIG.backup"
        
        # Enable listening on all addresses
        sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONFIG"
        sed -i "s/#port = 5432/port = 5432/" "$PG_CONFIG"
        
        print_status "Updated PostgreSQL configuration"
        systemctl restart postgresql
        sleep 5
    fi
fi

# Step 3: Configure authentication
print_status "Step 3: Configuring PostgreSQL authentication..."
PG_VERSION=$(ls /etc/postgresql/ | head -1)
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_HBA" ]; then
    # Backup pg_hba.conf
    cp "$PG_HBA" "$PG_HBA.backup"
    
    # Add trust authentication for local connections
    if ! grep -q "local   all   root" "$PG_HBA"; then
        echo "local   all   root                                trust" >> "$PG_HBA"
    fi
    
    if ! grep -q "host    all   root   127.0.0.1/32" "$PG_HBA"; then
        echo "host    all   root   127.0.0.1/32          trust" >> "$PG_HBA"
    fi
    
    print_status "Updated authentication configuration"
    systemctl reload postgresql
    sleep 2
fi

# Step 4: Create root user if not exists
print_status "Step 4: Setting up root user..."
sudo -u postgres psql -c "CREATE USER root SUPERUSER CREATEDB CREATEROLE;" 2>/dev/null || print_warning "Root user may already exist"
sudo -u postgres psql -c "ALTER USER root PASSWORD 'teleweb_password';" 2>/dev/null || true

# Step 5: Create teleweb database
print_status "Step 5: Creating teleweb database..."
sudo -u postgres psql -c "CREATE DATABASE teleweb OWNER root;" 2>/dev/null || print_warning "Database may already exist"

# Step 6: Test connections
print_status "Step 6: Testing database connections..."

# Test postgres user
if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "postgres user connection: OK"
else
    print_error "postgres user connection: FAILED"
fi

# Test root user
if psql -U root -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "root user connection: OK"
else
    print_error "root user connection: FAILED"
fi

# Test teleweb database
if psql -U root -d teleweb -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "teleweb database connection: OK"
else
    print_error "teleweb database connection: FAILED"
fi

# Step 7: Update .env file
print_status "Step 7: Updating .env configuration..."
cd /home/teleweb

if [ -f ".env" ]; then
    # Backup .env
    cp .env .env.backup
    
    # Update DATABASE_URL for native PostgreSQL
    sed -i 's|DATABASE_URL="postgresql://.*|DATABASE_URL="postgresql://root:teleweb_password@localhost:5432/teleweb"|' .env
    
    print_success ".env updated with native PostgreSQL settings"
else
    print_error ".env file not found"
fi

# Step 8: Test Prisma connection
print_status "Step 8: Testing Prisma connection..."
cd /home/teleweb/backend

if npx prisma db pull >/dev/null 2>&1; then
    print_success "Prisma can connect to database"
else
    print_warning "Prisma connection test failed, but this may be normal for empty database"
fi

echo ""
print_success "🎉 Database fix completed!"
echo ""
print_status "Next steps:"
echo "  1. Run: cd /home/teleweb/backend && npx prisma migrate dev"
echo "  2. Run: ./scripts/dev-start-native.sh"
echo ""
print_status "If issues persist, check:"
echo "  - PostgreSQL logs: tail -f /var/log/postgresql/postgresql-*-main.log"
echo "  - Run debug script: ./scripts/debug-database.sh" 