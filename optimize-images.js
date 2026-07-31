const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = __dirname;
const exts = ['.png', '.jpg', '.jpeg'];

async function optimizeImages() {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (exts.includes(ext)) {
            const inputPath = path.join(dir, file);
            const outputName = path.basename(file, path.extname(file)) + '.webp';
            const outputPath = path.join(dir, outputName);
            
            console.log(`Processing: ${file}...`);
            try {
                await sharp(inputPath)
                    .webp({ quality: 80 }) // 80% quality is a great balance of size/quality
                    .toFile(outputPath);
                
                const statsOriginal = fs.statSync(inputPath);
                const statsNew = fs.statSync(outputPath);
                console.log(`✅ Saved ${outputName} | ${(statsOriginal.size / 1024 / 1024).toFixed(2)}MB -> ${(statsNew.size / 1024 / 1024).toFixed(2)}MB`);
            } catch (err) {
                console.error(`❌ Failed to process ${file}:`, err.message);
            }
        }
    }
}

optimizeImages().then(() => console.log('Optimization complete.'));
