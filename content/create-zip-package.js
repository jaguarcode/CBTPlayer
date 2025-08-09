const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createZipPackage() {
  const zip = new JSZip();
  const sourceDir = path.join(__dirname, 'sample-package');
  const outputFile = path.join(__dirname, 'sample-package.zip');
  
  console.log('Creating ZIP package from:', sourceDir);
  console.log('Output file:', outputFile);
  
  // Read manifest
  const manifestPath = path.join(sourceDir, 'manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  
  // Add manifest to ZIP
  zip.file('manifest.json', manifestContent);
  
  // Process each track and add files
  for (const track of manifest.tracks) {
    console.log(`Processing track: ${track.id} (${track.type})`);
    
    for (const item of track.items) {
      // Get relative path from manifest
      const relativePath = item.file;
      const fullPath = path.join(sourceDir, relativePath);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        zip.file(relativePath, content);
        console.log(`  Added: ${relativePath}`);
      } else {
        console.warn(`  File not found: ${fullPath}`);
      }
    }
  }
  
  // Generate ZIP file
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  fs.writeFileSync(outputFile, buffer);
  
  const stats = fs.statSync(outputFile);
  console.log(`\nZIP package created successfully!`);
  console.log(`File: ${outputFile}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

createZipPackage().catch(console.error);