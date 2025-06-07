const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createFeatures() {
  console.log('🌱 Creating database features...');
  
  const features = [
    { name: 'ocr', description: 'OCR Text Recognition from Images - Extract text from images using Google Vision API' },
    { name: 'rar', description: 'Archive Extraction and Management - Extract and process ZIP, RAR, 7Z files' },
    { name: 'location', description: 'Location and GPS Processing - Process location data and coordinates' },
    { name: 'geotags', description: 'Geotag Extraction from Images - Extract GPS coordinates from image EXIF data' },
    { name: 'kml', description: 'KML File Processing - Process and convert KML/KMZ geographic files' },
    { name: 'workbook', description: 'Excel/CSV File Processing - Process spreadsheet files and data conversion' },
  ];
  
  for (const featureData of features) {
    try {
      const feature = await prisma.feature.upsert({
        where: { name: featureData.name },
        update: { description: featureData.description },
        create: {
          name: featureData.name,
          description: featureData.description,
          isEnabled: true,
        },
      });
      console.log('✅ Feature created/updated:', featureData.name);
    } catch (error) {
      console.error('❌ Error creating feature', featureData.name, ':', error.message);
    }
  }
  
  // Verify features created
  const allFeatures = await prisma.feature.findMany();
  console.log('\n📊 Total features in database:', allFeatures.length);
  allFeatures.forEach(feature => {
    console.log('   -', feature.name, ':', feature.description);
  });
  
  console.log('\n🎉 Features setup completed!');
  await prisma.$disconnect();
}

createFeatures().catch(console.error); 