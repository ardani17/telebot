#!/bin/bash

# TeleWeb Development Stop Script
# This script stops all development services

set -e

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

# Function to stop service by PID file
stop_service() {
    local name=$1
    local pidfile="logs/${name}.pid"

    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if ps -p $pid > /dev/null 2>&1; then
            print_status "Stopping $name service (PID: $pid)..."
            kill $pid
            
            # Wait for graceful shutdown
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                print_warning "Force killing $name service..."
                kill -9 $pid
            fi
            
            print_success "$name service stopped"
        else
            print_warning "$name service was not running"
        fi
        
        rm -f "$pidfile"
    else
        print_warning "No PID file found for $name service"
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ ! -z "$pids" ]; then
        print_status "Killing $service_name processes on port $port..."
        echo $pids | xargs kill -9 2>/dev/null || true
        print_success "$service_name processes on port $port stopped"
    fi
}

print_status "TeleWeb Development Environment Stop"
print_status "====================================="

# Stop services by PID files first
stop_service "Backend"
stop_service "Bot"
stop_service "Frontend"

# Kill any remaining processes on known ports
kill_port "3001" "Backend"
kill_port "3000" "Frontend (Vite)"
kill_port "8081" "Bot"

# Kill any Node.js processes that might be related to our services
print_status "Cleaning up remaining Node.js processes..."

# Find and kill ts-node-dev processes (bot)
local bot_pids=$(pgrep -f "ts-node-dev.*src/index.ts" 2>/dev/null || true)
if [ ! -z "$bot_pids" ]; then
    print_status "Stopping bot processes..."
    echo $bot_pids | xargs kill -9 2>/dev/null || true
fi

# Find and kill nest processes (backend)
local backend_pids=$(pgrep -f "nest start --watch" 2>/dev/null || true)
if [ ! -z "$backend_pids" ]; then
    print_status "Stopping backend processes..."
    echo $backend_pids | xargs kill -9 2>/dev/null || true
fi

# Find and kill vite processes (frontend)
local frontend_pids=$(pgrep -f "vite" 2>/dev/null || true)
if [ ! -z "$frontend_pids" ]; then
    print_status "Stopping frontend processes..."
    echo $frontend_pids | xargs kill -9 2>/dev/null || true
fi

# Clean up log files if requested
read -p "Remove log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Removing log files..."
    rm -f logs/*.log
    rm -f logs/*.pid
    print_success "Log files removed"
fi

print_success "All services stopped successfully!"
print_status ""
print_status "To start services again, run: ./scripts/dev-start.sh"
