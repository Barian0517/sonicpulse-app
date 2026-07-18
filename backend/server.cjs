const express = require('express');
const cors = require('cors');
const os = require('os');
const http = require('http');

// Prevent unhandled errors from crashing the server
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err instanceof Error ? err.message : err);
});

const app = express();
app.use(cors());
// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Parse text/raw bodies
app.use(express.text({ type: 'text/plain', limit: '50mb' }));

app.get('/ip', (req, res) => {
    const interfaces = os.networkInterfaces();
    let ips = [];
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                ips.push(alias.address);
            }
        }
    }
    let defaultIp = ips.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.') || ip.match(/^172\.(1[6-9]|2\d|3[0-1])\./)) || ips[0] || '127.0.0.1';
    res.json({ ip: defaultIp, ips: ips });
});

// Legacy proxy route for compatibility with Navidrome or other plugins that might still use it
const axios = require('axios');
app.all('/plugin/proxy', async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    let customHeaders = {};
    if (req.query.headers) {
        try { customHeaders = JSON.parse(req.query.headers); } catch (e) {}
    } else if (req.body?.headers) {
        customHeaders = req.body.headers;
    }
    
    if (req.headers.range) customHeaders['range'] = req.headers.range;

    try {
        let axiosData = req.method === 'POST' || req.method === 'PUT' ? req.body : undefined;
        if (axiosData && typeof axiosData === 'object' && customHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
            axiosData = new URLSearchParams(axiosData).toString();
        }

        const proxyRes = await axios({
            method: req.method,
            url: targetUrl,
            headers: customHeaders,
            data: axiosData,
            responseType: 'stream',
            validateStatus: () => true
        });
        
        res.status(proxyRes.status);
        
        for (const [key, value] of Object.entries(proxyRes.headers)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey !== 'transfer-encoding' && !lowerKey.startsWith('access-control-')) {
                try { res.setHeader(key, value); } catch(e) {}
            }
        }
        proxyRes.data.pipe(res);
    } catch (e) {
        console.error("Proxy error:", e.message);
        res.status(500).end();
    }
});

// Mount modules
const musicfreeRouter = require('./api/musicfree.cjs');
app.use('/', musicfreeRouter);

const bilibiliRouter = require('./api/bilibili.cjs');
app.use('/api/bilibili', bilibiliRouter);

const jukeboxRouter = require('./api/jukebox.cjs');
app.use('/', jukeboxRouter);

// Start Netease Server (Runs on 30000)
require('./api/netease.cjs')();

const PORT = 30001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API Server started on http://0.0.0.0:${PORT}`);
});
