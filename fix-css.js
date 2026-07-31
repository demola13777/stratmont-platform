const fs = require('fs');
const path = require('path');

const dir = __dirname;
const cssFiles = ['design-system.css', 'style.css'];

for (const file of cssFiles) {
    let content = fs.readFileSync(path.join(dir, file), 'utf-8');
    
    // Replace transition: all with targeted transitions
    content = content.replace(/transition:\s*all\s*var\(--transition-normal\);/g, 'transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-normal);');
    content = content.replace(/transition:\s*all\s*0\.3s\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\);/g, 'transition: background-color 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);');
    content = content.replace(/transition:\s*all\s*0\.4s\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\);/g, 'transition: background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), color 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);');

    // Add color-scheme to :root if not present in design-system.css
    if (file === 'design-system.css' && !content.includes('color-scheme: light dark;')) {
        content = content.replace(/:root\s*\{/, ':root {\n  color-scheme: light dark;\n');
    }
    
    fs.writeFileSync(path.join(dir, file), content, 'utf-8');
    console.log(`Fixed CSS transitions in ${file}`);
}
