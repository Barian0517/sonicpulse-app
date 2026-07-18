const fs = require('fs');
const path = require('path');
const tmpPath = require('os').tmpdir();
if (!fs.existsSync(path.resolve(tmpPath, 'anonymous_token'))) {
    fs.writeFileSync(path.resolve(tmpPath, 'anonymous_token'), '', 'utf-8');
}

const { serveNcmApi } = require('NeteaseCloudMusicApi/server');

async function startServer() {
    try {
        await serveNcmApi({
            port: 30000,
            host: '0.0.0.0',
            checkVersion: false
        });
        console.log("Local Netease API started on http://127.0.0.1:30000");
    } catch (e) {
        console.error("Failed to start Netease API:", e);
    }
}

module.exports = startServer;
