#!/bin/bash

# Script untuk menambahkan user dan memberikan akses fitur OCR
# Add User with OCR Access Script for TeleWeb

set -e

echo "🔑 Adding User and Granting OCR Access..."

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
USERNAME="admin"

print_status "Adding user $TELEGRAM_ID and granting OCR access..."

cd backend

# Node.js script untuk menambahkan user dan memberikan akses OCR
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addUserAndGrantOCR() {
  try {
    console.log('🔍 Adding/updating user in database...');
    
    const telegramId = '$TELEGRAM_ID';
    const name = '$USER_NAME';
    const username = '$USERNAME';
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramId },
      include: { 
        featureAccess: { 
          include: { feature: true } 
        } 
      }
    });
    
    if (user) {
      console.log('✅ User already exists:', user.name + ' (' + user.telegramId + ')');
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          telegramId: telegramId,
          name: name,
          username: username,
          role: 'USER',
          isActive: true,
        },
        include: { 
          featureAccess: { 
            include: { feature: true } 
          } 
        }
      });
      console.log('✅ New user created:', user.name + ' (' + user.telegramId + ')');
    }
    
    // Check if OCR feature exists
    const ocrFeature = await prisma.feature.findUnique({
      where: { name: 'ocr' }
    });
    
    if (!ocrFeature) {
      console.log('❌ OCR feature not found in database');
      console.log('   Running database seed to create features...');
      return;
    }
    
    console.log('✅ OCR feature found:', ocrFeature.description);
    
    // Check if user already has OCR access
    const existingAccess = await prisma.userFeatureAccess.findUnique({
      where: {
        userId_featureId: {
          userId: user.id,
          featureId: ocrFeature.id,
        },
      },
    });
    
    if (existingAccess) {
      console.log('✅ User already has OCR access');
    } else {
      // Find admin user to grant access
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
      });
      
      if (!adminUser) {
        console.log('⚠️  No admin found, using self-grant');
        // Grant access using the user itself
        await prisma.userFeatureAccess.create({
          data: {
            userId: user.id,
            featureId: ocrFeature.id,
            grantedBy: user.id,
          },
        });
      } else {
        // Grant access by admin
        await prisma.userFeatureAccess.create({
          data: {
            userId: user.id,
            featureId: ocrFeature.id,
            grantedBy: adminUser.id,
          },
        });
      }
      
      console.log('🎉 OCR access granted successfully!');
    }
    
    // Show final user status
    const finalUser = await prisma.user.findUnique({
      where: { telegramId: telegramId },
      include: { 
        featureAccess: { 
          include: { feature: true } 
        } 
      }
    });
    
    console.log('');
    console.log('📊 Final User Status:');
    console.log('   ID: ' + finalUser.id);
    console.log('   Telegram ID: ' + finalUser.telegramId);
    console.log('   Name: ' + finalUser.name);
    console.log('   Username: ' + finalUser.username);
    console.log('   Role: ' + finalUser.role);
    console.log('   Active: ' + finalUser.isActive);
    console.log('   Features: ' + finalUser.featureAccess.length);
    
    finalUser.featureAccess.forEach(access => {
      console.log('     - ' + access.feature.name + ': ' + access.feature.description);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.\$disconnect();
  }
}

addUserAndGrantOCR();
"

if [ $? -eq 0 ]; then
    print_success "User $TELEGRAM_ID has been added/updated with OCR access!"
    echo ""
    echo "🧪 Test OCR Feature:"
    echo "   1. Send an image to the bot"
    echo "   2. Use command: /ocr or select OCR from menu"
    echo "   3. Bot should process the image and extract text"
    echo ""
else
    print_error "Failed to add user or grant OCR access"
    print_status "Try running database seed first:"
    echo "   cd backend && npx prisma db seed"
fi

cd .. 