const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const directories = [
  path.join(__dirname, 'src', 'images'),
  path.join(__dirname, 'src', 'images', 'volunt_fotos')
];

async function optimizeImages() {
  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
      
      const filePath = path.join(dir, file);
      const outputFilePath = path.join(dir, `${path.basename(file, ext)}.webp`);
      
      const stats = fs.statSync(filePath);
      if (stats.size > 500 * 1024) { // over 500KB
        console.log(`Optimizing: ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        await sharp(filePath)
          .webp({ quality: 80 })
          .toFile(outputFilePath);
        
        fs.unlinkSync(filePath); // remove original
      }
    }
  }
}

optimizeImages().then(() => console.log('Done optimizing huge images.'));