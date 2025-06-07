#!/bin/bash

# TeleWeb Backend Restart Script
echo "🔄 Restarting TeleWeb Backend..."

# Get the process ID of the backend
BACKEND_PID=$(pgrep -f "npm run start:dev")

if [ ! -z "$BACKEND_PID" ]; then
    echo "🛑 Stopping backend process $BACKEND_PID..."
    kill $BACKEND_PID
    sleep 3
    
    # Force kill if still running
    if ps -p $BACKEND_PID > /dev/null; then
        echo "💀 Force killing backend process..."
        kill -9 $BACKEND_PID
        sleep 2
    fi
fi

# Change to backend directory
cd /home/teleweb/backend

# Start backend in background
echo "🚀 Starting backend..."
npm run start:dev > /tmp/teleweb-backend.log 2>&1 &

BACKEND_PID=$!
echo "📋 Backend started with PID: $BACKEND_PID"

# Wait a moment for startup
sleep 5

# Check if it's running
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend is running successfully!"
    echo "📄 Logs: tail -f /tmp/teleweb-backend.log"
else
    echo "❌ Backend failed to start. Check logs:"
    tail -n 20 /tmp/teleweb-backend.log
fi 