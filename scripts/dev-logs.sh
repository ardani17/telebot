#!/bin/bash

# TeleWeb Development Logs Script
# This script shows logs from all development services

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

# Check if logs directory exists
if [ ! -d "logs" ]; then
    print_error "Logs directory not found. Are the services running?"
    exit 1
fi

# Function to show menu
show_menu() {
    echo -e "${BLUE}TeleWeb Development Logs${NC}"
    echo "=========================="
    echo "1. View all logs (combined)"
    echo "2. View backend logs only"
    echo "3. View bot logs only"
    echo "4. View logs with live monitoring"
    echo "5. View last 50 lines of all logs"
    echo "6. Clear all logs"
    echo "7. Check service status"
    echo "8. Exit"
    echo
}

# Function to check service status
check_service_status() {
    print_status "Service Status Check"
    print_status "===================="
    
    # Check Backend
    if [ -f "logs/Backend.pid" ]; then
        local backend_pid=$(cat "logs/Backend.pid")
        if ps -p $backend_pid > /dev/null 2>&1; then
            print_success "Backend: Running (PID: $backend_pid)"
        else
            print_error "Backend: Not running (stale PID file)"
        fi
    else
        print_warning "Backend: No PID file found"
    fi
    
    # Check Bot
    if [ -f "logs/Bot.pid" ]; then
        local bot_pid=$(cat "logs/Bot.pid")
        if ps -p $bot_pid > /dev/null 2>&1; then
            print_success "Bot: Running (PID: $bot_pid)"
        else
            print_error "Bot: Not running (stale PID file)"
        fi
    else
        print_warning "Bot: No PID file found"
    fi
    
    # Check ports
    echo
    print_status "Port Status:"
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_success "Port 3001 (Backend): In use"
    else
        print_warning "Port 3001 (Backend): Free"
    fi
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_success "Port 3000: In use"
    else
        print_warning "Port 3000: Free"
    fi
    
    echo
}

# Function to view logs
view_logs() {
    local log_type=$1
    
    case $log_type in
        "all")
            print_status "Showing all logs (Press Ctrl+C to exit)..."
            if command -v multitail &> /dev/null; then
                multitail -c -s 2 \
                    -cT ANSI \
                    -ci green "logs/backend.log" \
                    -ci blue "logs/bot.log"
            else
                tail -f logs/*.log
            fi
            ;;
        "backend")
            if [ -f "logs/backend.log" ]; then
                print_status "Showing backend logs (Press Ctrl+C to exit)..."
                tail -f logs/backend.log
            else
                print_error "Backend log file not found"
            fi
            ;;
        "bot")
            if [ -f "logs/bot.log" ]; then
                print_status "Showing bot logs (Press Ctrl+C to exit)..."
                tail -f logs/bot.log
            else
                print_error "Bot log file not found"
            fi
            ;;
        "live")
            print_status "Live monitoring all logs (Press Ctrl+C to exit)..."
            if command -v multitail &> /dev/null; then
                multitail -c -s 2 \
                    -cT ANSI \
                    -ci green -l "tail -f logs/backend.log" \
                    -ci blue -l "tail -f logs/bot.log"
            else
                print_warning "multitail not available, using basic tail"
                tail -f logs/*.log
            fi
            ;;
        "last50")
            print_status "Last 50 lines from all logs:"
            echo
            if [ -f "logs/backend.log" ]; then
                echo -e "${GREEN}=== Backend Logs (last 50) ===${NC}"
                tail -50 logs/backend.log
                echo
            fi
            if [ -f "logs/bot.log" ]; then
                echo -e "${BLUE}=== Bot Logs (last 50) ===${NC}"
                tail -50 logs/bot.log
                echo
            fi
            ;;
    esac
}

# Function to clear logs
clear_logs() {
    read -p "Are you sure you want to clear all logs? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Clearing all log files..."
        rm -f logs/*.log
        print_success "All log files cleared"
    else
        print_status "Log clearing cancelled"
    fi
}

# Main script
while true; do
    show_menu
    read -p "Choose an option (1-8): " choice
    echo
    
    case $choice in
        1)
            view_logs "all"
            ;;
        2)
            view_logs "backend"
            ;;
        3)
            view_logs "bot"
            ;;
        4)
            view_logs "live"
            ;;
        5)
            view_logs "last50"
            echo
            read -p "Press Enter to continue..."
            ;;
        6)
            clear_logs
            echo
            read -p "Press Enter to continue..."
            ;;
        7)
            check_service_status
            echo
            read -p "Press Enter to continue..."
            ;;
        8)
            print_status "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option. Please choose 1-8."
            echo
            read -p "Press Enter to continue..."
            ;;
    esac
    
    clear
done 