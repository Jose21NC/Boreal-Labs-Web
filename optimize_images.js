import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, "src", "images");

async function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      await processDirectory(filePath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        const fileContent = fs.readFileSync(filePath);
        const metadata = await sharp(fileContent).metadata();
        
        let sharpObj = sharp(fileContent);

        // Resize if width > 1200 maintaining aspect ratio
        if (metadata.width > 1200) {
            sharpObj = sharpObj.resize({ width: 1200, withoutEnlargement: true });
        }

        const outPath = filePath.replace(ext, ".webp");
        await sharpObj.webp({ quality: 80 }).toFile(outPath);
        
        console.log(`Optimized: ${file} -> ${path.basename(outPath)}`);
        
        // Remove old file
        fs.unlinkSync(filePath);
      }
    }
  }
}

processDirectory(imagesDir).then(() => console.log("Done iterating."));
