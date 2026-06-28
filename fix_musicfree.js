import fs from 'fs';

let c = fs.readFileSync('providers/MusicFreeProvider.ts', 'utf8');

c = c.replace(/'http:\/\/:30001([^']*)'/g, "`http://${window.location.hostname === 'tauri.localhost' ? '127.0.0.1' : window.location.hostname}:30001$1`");

c = c.replace(/`http:\/\/:30001([^`]*)`/g, "`http://${window.location.hostname === 'tauri.localhost' ? '127.0.0.1' : window.location.hostname}:30001$1`");

fs.writeFileSync('providers/MusicFreeProvider.ts', c);
