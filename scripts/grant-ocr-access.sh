#!/bin/bash

# Grant OCR Access Script for TeleWeb
# Script untuk memberikan akses fitur OCR ke user dengan Telegram ID tertentu

set -e

echo "🔑 TeleWeb - Grant OCR Access Script"

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

# Parameters
TELEGRAM_ID="731289973"
USER_NAME="Admin User"
USERNAME="yaelahdan"

print_status "Processing Telegram ID: $TELEGRAM_ID"
print_status "Ensuring user exists and has OCR access..."

cd backend

# Step 1: Add user if not exists
print_status "Step 1: Adding user to database..."
npx ts-node scripts/add-user.ts "$TELEGRAM_ID" "$USER_NAME" "$USERNAME" "USER"

if [ $? -ne 0 ]; then
    print_error "Failed to add user"
    exit 1
fi

print_success "User added/verified successfully"

# Step 2: Create features if they don't exist
print_status "Step 2: Ensuring features exist in database..."

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createFeatures() {
  console.log('🔍 Checking features in database...');
  
  const existingFeatures = await prisma.feature.count();
  console.log('   Current features count:', existingFeatures);
  
  if (existingFeatures === 0) {
    console.log('📋 Creating features...');
    
    const features = [
      { name: 'ocr', description: 'OCR Text Recognition from Images - Extract text from images using Google Vision API' },
      { name: 'rar', description: 'Archive Extraction and Management - Extract and process ZIP, RAR, 7Z files' },
      { name: 'location', description: 'Location and GPS Processing - Process location data and coordinates' },
      { name: 'geotags', description: 'Geotag Extraction from Images - Extract GPS coordinates from image EXIF data' },
      { name: 'kml', description: 'KML File Processing - Process and convert KML/KMZ geographic files' },
      { name: 'workbook', description: 'Excel/CSV File Processing - Process spreadsheet files and data conversion' },
    ];
    
    for (const featureData of features) {
      await prisma.feature.create({
        data: {
          name: featureData.name,
          description: featureData.description,
          isEnabled: true,
        },
      });
      console.log('   ✅ Created feature:', featureData.name);
    }
  } else {
    console.log('   ✅ Features already exist');
  }
  
  await prisma.\$disconnect();
}

createFeatures().catch(console.error);
"

# Step 3: Grant OCR feature access
print_status "Step 3: Granting OCR access..."
npx ts-node scripts/grant-features.ts "$TELEGRAM_ID" "ocr"

if [ $? -ne 0 ]; then
    print_error "Failed to grant OCR access"
    exit 1
fi

print_success "OCR access granted successfully!"

# Step 4: Verify final status
print_status "Step 4: Verifying final user status..."

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: '$TELEGRAM_ID' },
      include: { 
        featureAccess: { 
          include: { feature: true } 
        } 
      }
    });
    
    if (user) {
      console.log('');
      console.log('✅ User Verification Complete:');
      console.log('   📱 Telegram ID: ' + user.telegramId);
      console.log('   👤 Name: ' + user.name);
      console.log('   🏷️  Username: ' + user.username);
      console.log('   🔰 Role: ' + user.role);
      console.log('   ✅ Active: ' + user.isActive);
      console.log('   🎯 Total Features: ' + user.featureAccess.length);
      console.log('');
      console.log('   📋 Available Features:');
      
      let hasOCR = false;
      user.featureAccess.forEach(access => {
        console.log('      - ' + access.feature.name + ': ' + access.feature.description);
        if (access.feature.name === 'ocr') {
          hasOCR = true;
        }
      });
      
      if (hasOCR) {
        console.log('');
        console.log('🎉 SUCCESS: User has OCR access!');
      } else {
        console.log('');
        console.log('❌ ERROR: User does not have OCR access!');
      }
    } else {
      console.log('❌ User not found in database');
    }
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
}

verifyUser();
"

cd ..

echo ""
print_success "Script completed!"
echo ""
echo "🧪 How to test OCR feature:"
echo "   1. Open Telegram and go to your bot"
echo "   2. Send any image with text"
echo "   3. Use command: /ocr"
echo "   4. The bot should extract text from the image"
echo ""
echo "💡 Troubleshooting:"
echo "   - Make sure the bot is running: ./scripts/dev-start-native.sh"
echo "   - Check bot logs: tail -f logs/bot.log"
echo "   - Verify Google Vision API key is configured"
echo "" 