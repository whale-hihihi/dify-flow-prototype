const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function testFolderDelete() {
  console.log('Starting folder delete test...');

  try {
    // Get first non-default folder
    const folder = await prisma.folder.findFirst({
      where: { isDefault: false },
      include: { _count: { select: { assets: true } } }
    });

    if (!folder) {
      console.log('No non-default folders found. Creating test folder...');
      // You can create a test folder here if needed
      return;
    }

    console.log(`Found folder: ${folder.name} with ${folder._count.assets} assets`);

    // Get assets in folder
    const assets = await prisma.asset.findMany({
      where: { folderId: folder.id }
    });

    console.log(`Assets in folder: ${assets.length}`);

    for (const asset of assets) {
      console.log(`\nProcessing asset: ${asset.filename}`);
      console.log(`  File path: ${asset.filePath}`);
      console.log(`  Asset ID: ${asset.id}`);

      // Check if file exists
      const filePath = path.resolve('./uploads', path.basename(asset.filePath));
      console.log(`  Resolved path: ${filePath}`);
      console.log(`  File exists: ${fs.existsSync(filePath)}`);

      // Check related TaskItems
      const taskItems = await prisma.taskItem.findMany({
        where: {
          OR: [
            { sourceAssetId: asset.id },
            { resultAssetId: asset.id }
          ]
        }
      });
      console.log(`  Related TaskItems: ${taskItems.length}`);
    }

    console.log('\nTest completed. Run actual delete to see what happens.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFolderDelete();
