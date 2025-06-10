#!/bin/bash

echo "🔧 Fixing Bot Build Structure"
echo "============================"

cd /home/teleweb/bot

echo "1️⃣ Current build structure:"
echo "$(find dist -name "*.js" | head -5)"

echo ""
echo "2️⃣ Creating proper structure for PM2..."

# Check if the compiled file exists
if [ -f "dist/bot/src/index.js" ]; then
    echo "✅ Found compiled bot at dist/bot/src/index.js"
    
    # Create symlink or copy to expected location
    echo "📁 Creating dist/index.js symlink..."
    rm -f dist/index.js
    ln -s bot/src/index.js dist/index.js
    
    echo "✅ Symlink created: dist/index.js -> bot/src/index.js"
    
elif [ -f "src/index.ts" ]; then
    echo "⚠️  Compiled file not found, rebuilding..."
    
    # Clean and rebuild
    rm -rf dist/
    npm run build
    
    if [ -f "dist/bot/src/index.js" ]; then
        echo "✅ Build successful, creating symlink..."
        ln -s bot/src/index.js dist/index.js
    else
        echo "❌ Build failed or unexpected output structure"
        echo "📋 Available files in dist:"
        find dist -name "*.js" 2>/dev/null || echo "No JS files found"
        exit 1
    fi
else
    echo "❌ Source file src/index.ts not found"
    exit 1
fi

echo ""
echo "3️⃣ Verifying structure:"
if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js exists"
    echo "📋 File info:"
    ls -la dist/index.js
else
    echo "❌ dist/index.js still missing"
    exit 1
fi

echo ""
echo "4️⃣ Testing PM2 configuration..."
cd /home/teleweb

# Test PM2 config
echo "🧪 Testing PM2 config:"
pm2 delete teleweb-bot 2>/dev/null || echo "No existing bot process"

echo "🚀 Starting bot with PM2..."
pm2 start ecosystem.config.js --only teleweb-bot

sleep 3

echo ""
echo "📊 PM2 Status:"
pm2 list | grep teleweb-bot

echo ""
echo "🎉 Bot Build Fix Complete!"
echo "========================="
echo ""
echo "✅ If bot shows 'online' status, the fix worked!"
echo "❌ If bot shows 'error' status, check logs: pm2 logs teleweb-bot" 