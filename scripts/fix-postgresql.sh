#!/bin/bash

# TeleWeb PostgreSQL Setup and Fix Script
# This script installs and configures PostgreSQL for native development

set -e  # Exit on any error

echo "🔧 TeleWeb PostgreSQL Setup & Fix Script"

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
    print_error ".env file not found. Please create it first"
    exit 1
fi

# Load environment variables
source .env

# Validate required variables
if [ -z "$POSTGRES_PASSWORD" ]; then
    print_error "POSTGRES_PASSWORD not found in .env"
    exit 1
fi

print_status "Installing PostgreSQL..."
apt update
apt install -y postgresql postgresql-contrib

print_status "Starting PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql

print_status "Configuring PostgreSQL..."

# Create user and database
sudo -u postgres psql << EOF
-- Create user 'root' if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN
        CREATE USER root WITH PASSWORD '${POSTGRES_PASSWORD}' CREATEDB SUPERUSER;
    ELSE
        ALTER USER root WITH PASSWORD '${POSTGRES_PASSWORD}' CREATEDB SUPERUSER;
    END IF;
END
\$\$;

-- Create database 'teleweb' if not exists
SELECT 'CREATE DATABASE teleweb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'teleweb')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE teleweb TO root;

-- Show created user and database
\du root
\l teleweb
EOF

print_status "Configuring PostgreSQL for local connections..."

# Find PostgreSQL version and configuration directory
PG_VERSION=$(ls /etc/postgresql/ | head -1)
PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"
PG_HBA_FILE="$PG_CONF_DIR/pg_hba.conf"

print_status "Found PostgreSQL version: $PG_VERSION"
print_status "Configuration directory: $PG_CONF_DIR"

# Check if config file exists
if [ ! -f "$PG_HBA_FILE" ]; then
    print_error "pg_hba.conf not found at $PG_HBA_FILE"
    exit 1
fi

# Backup original pg_hba.conf
cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup"
print_success "Backed up pg_hba.conf"

# Add local connection rules if they don't exist
if ! grep -q "TeleWeb local connections" "$PG_HBA_FILE"; then
    print_status "Adding TeleWeb connection rules to pg_hba.conf"
    cat >> "$PG_HBA_FILE" << EOF

# TeleWeb local connections
local   teleweb         root                                    md5
host    teleweb         root            127.0.0.1/32            md5
host    teleweb         root            ::1/128                 md5
EOF
    print_success "Added connection rules to pg_hba.conf"
else
    print_status "TeleWeb connection rules already exist in pg_hba.conf"
fi

# Restart PostgreSQL to apply changes
systemctl restart postgresql

print_status "Testing database connection..."
sleep 3

# Test connection with the exact command from the script
if psql -U root -d teleweb -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Database connection successful!"
else
    print_warning "Testing with password authentication..."
    export PGPASSWORD="$POSTGRES_PASSWORD"
    if psql -U root -h localhost -d teleweb -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful with password!"
        
        # Update .env to use host connection
        sed -i 's|DATABASE_URL="postgresql://root:teleweb_password@localhost:5432/teleweb"|DATABASE_URL="postgresql://root:'"$POSTGRES_PASSWORD"'@localhost:5432/teleweb"|' .env
        print_success "Updated DATABASE_URL in .env"
    else
        print_error "Database connection still failed"
        
        # Show detailed connection info
        echo ""
        print_status "Database Connection Details:"
        echo "   Host: localhost"
        echo "   Port: 5432"
        echo "   Database: teleweb"
        echo "   User: root"
        echo "   Password: $POSTGRES_PASSWORD"
        echo ""
        print_status "PostgreSQL Status:"
        systemctl status postgresql --no-pager -l
        echo ""
        print_status "PostgreSQL Log (last 10 lines):"
        tail -n 10 /var/log/postgresql/postgresql-*-main.log 2>/dev/null || echo "No logs found"
        
        exit 1
    fi
fi

print_success "PostgreSQL setup completed successfully!"
echo ""
echo "📊 Database Information:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: teleweb"
echo "   User: root"
echo "   Connection: postgresql://root:****@localhost:5432/teleweb"
echo ""
echo "🧪 Test connection manually:"
echo "   psql -U root -h localhost -d teleweb"
echo ""

# Show users and databases
print_status "Current PostgreSQL users and databases:"
sudo -u postgres psql -c "\du"
sudo -u postgres psql -c "\l"

print_success "You can now run ./scripts/dev-start-native.sh again!" 