#!/bin/bash

# Simple database connection test for TeleWeb

cd /home/teleweb

# Load environment variables
source .env

echo "Testing database connection..."
echo "User: $POSTGRES_USER"
echo "Database: $POSTGRES_DB" 
echo "Host: localhost"
echo "Port: 5432"

# Set password
export PGPASSWORD="$POSTGRES_PASSWORD"

# Test connection (disable history expansion to avoid ! issues)
set +H
psql -U root -h localhost -d teleweb -c "SELECT 'Database connection successful' as result;" 2>/dev/null
set -H

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed"
    echo "Trying to reload PostgreSQL configuration..."
    sudo systemctl reload postgresql
    echo "PostgreSQL status:"
    sudo systemctl status postgresql --no-pager
fi 