const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');

if (!fs.existsSync(src)) {
    fs.mkdirSync(src);
}

const itemsToMove = [
    'components', 'locales', 'providers', 'services', 'utils',
    'types.ts', 'translations.ts', 'translations.txt',
    'App.tsx', 'index.tsx', 'index.html', 'jukebox.html'
];

for (const item of itemsToMove) {
    const srcPath = path.join(root, item);
    const destPath = path.join(src, item);
    if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${item} to src/`);
    }
}

// Recursively update imports in src/
function updateImports(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            updateImports(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            // Fix HTML script path
            if (fullPath.endsWith('jukebox.html')) {
                content = content.replace('src="/src/jukebox/main.tsx"', 'src="/jukebox/main.tsx"');
                content = content.replace('src="/jukebox/main.tsx"', 'src="/jukebox/main.tsx"'); // ensure no /src/
            }
            if (fullPath.endsWith('index.html')) {
                 content = content.replace('src="/src/index.tsx"', 'src="/index.tsx"');
                 content = content.replace('src="/index.tsx"', 'src="/index.tsx"'); 
            }

            // Safely resolve relative imports
            content = content.replace(/(?:import|from)\s*\(?['"](\.\.\/[^'"]+)['"]\)?/g, (match, p1) => {
                const absoluteTarget = path.resolve(path.dirname(fullPath), p1);
                if (absoluteTarget.startsWith(src)) {
                    const relativeToSrc = path.relative(src, absoluteTarget).replace(/\\/g, '/');
                    return match.replace(p1, '@/' + relativeToSrc);
                }
                return match;
            });

            // Same for ./ just in case it's cleaner
            // Actually, we don't need to change ./

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated imports in ${fullPath}`);
            }
        }
    }
}

updateImports(src);

// Update vite.config.ts
const viteConfigPath = path.join(root, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
    let vite = fs.readFileSync(viteConfigPath, 'utf8');
    vite = vite.replace("alias: {\n          '@': path.resolve(__dirname, '.'),\n        }", "alias: {\n          '@': path.resolve(__dirname, 'src'),\n        }");
    
    if (!vite.includes("root: 'src'")) {
        vite = vite.replace("server: {", "root: 'src',\n      server: {");
    }
    
    vite = vite.replace("'index.html'", "'src/index.html'");
    vite = vite.replace("'jukebox.html'", "'src/jukebox.html'");
    fs.writeFileSync(viteConfigPath, vite, 'utf8');
    console.log("Updated vite.config.ts");
}

// Update tsconfig.json
const tsconfigPath = path.join(root, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
    let tsconfig = fs.readFileSync(tsconfigPath, 'utf8');
    tsconfig = tsconfig.replace('"@/*": [\n        "./*"\n      ]', '"@/*": [\n        "./src/*"\n      ]');
    fs.writeFileSync(tsconfigPath, tsconfig, 'utf8');
    console.log("Updated tsconfig.json");
}

console.log("Done!");
