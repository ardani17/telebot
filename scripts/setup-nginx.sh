#!/bin/bash

echo "🔧 Setting up Nginx for TeleWeb..."

# Remove default nginx config if exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "🗑️ Removing default nginx configuration..."
    rm -f /etc/nginx/sites-enabled/default
fi

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx
    
    # Check nginx status
    echo "📊 Nginx status:"
    systemctl status nginx --no-pager -l
    
    echo ""
    echo "🌍 TeleWeb is now accessible at:"
    echo "   Frontend: http://YOUR_SERVER_IP/"
    echo "   API Docs: http://YOUR_SERVER_IP/api/docs"
    echo ""
    echo "💡 If accessing locally, try:"
    echo "   curl -I http://localhost/"
    echo ""
    
else
    echo "❌ Nginx configuration has errors. Please check the configuration."
    nginx -t
    exit 1
fi 