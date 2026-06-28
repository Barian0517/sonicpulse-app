const fs = require('fs');
let c = fs.readFileSync('providers/MusicFreeProvider.ts', 'utf8');
const replacement = '`http://${window.location.hostname === \\'tauri.localhost\\' ? \\'127.0.0.1\\' : window.location.hostname}:30001';
c = c.replace(/'http:\/\/:30001/g, replacement);
c = c.replace(/`http:\/\/:30001/g, replacement);
fs.writeFileSync('providers/MusicFreeProvider.ts', c);
