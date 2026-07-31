const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const cssFiles = fs.readdirSync(dir).filter(f => f.endsWith('.css'));
const allFiles = [...htmlFiles, ...cssFiles];

for (const file of allFiles) {
    let content = fs.readFileSync(path.join(dir, file), 'utf-8');
    
    // Replace .png, .jpg, .jpeg with .webp
    content = content.replace(/\.png/g, '.webp')
                     .replace(/\.jpg/g, '.webp')
                     .replace(/\.jpeg/g, '.webp');
    
    // Specifically target the hero image in index.html for LCP prioritization
    if (file === 'index.html') {
        content = content.replace(
            /<img src="real-estate\.webp" alt="Corporate Building" class="main-image">/g,
            '<img src="real-estate.webp" alt="Corporate Building" class="main-image" fetchpriority="high" decoding="async">'
        );
    }
    
    fs.writeFileSync(path.join(dir, file), content, 'utf-8');
    console.log(`Updated references in ${file}`);
}
