const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

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

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection from a plugin:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception from a plugin:', err instanceof Error ? err.message : err);
});

const configPath = path.join(__dirname, 'musicfree-config.json');

function getConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {}
    }
    return { 
        pluginDir: path.join(__dirname, 'musicfree-plugin'),
        variables: {} // { "pluginId": { "music_u": "...", "source": "..." } }
    };
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// In-memory registry of loaded plugins
let plugins = {};

function loadPlugin(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const filename = path.basename(filePath);
        
        const sandbox = {
            env: {
                getUserVariables: () => {
                    const cfg = getConfig();
                    return (cfg.variables && cfg.variables[filename]) || {};
                },
                getCookie: () => "",
                getUserAgent: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                md5: (str) => crypto.createHash('md5').update(str).digest('hex')
            },
            require: function(moduleName) {
                // Map the module name to our project's node_modules
                if (moduleName === 'axios') {
                    const axiosInst = require('axios').create({
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                            'Accept': '*/*'
                        }
                    });
                    // Some plugins might use axios.default or rely on it being the module itself
                    axiosInst.default = axiosInst;
                    return axiosInst;
                }
                try {
                    return require(moduleName);
                } catch(e) {
                    console.warn(`Plugin requested module ${moduleName} which could not be loaded natively.`);
                    return null;
                }
            },
            module: { exports: {} },
            console: console,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
            Buffer: Buffer,
            process: process,
            URL: URL,
            btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
            atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
            encodeURIComponent: encodeURIComponent,
            decodeURIComponent: decodeURIComponent,
            escape: escape,
            unescape: unescape
        };
        sandbox.exports = sandbox.module.exports;
        
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { filename: filePath });
        
        const instance = sandbox.module.exports.default || sandbox.module.exports;
        return instance;
    } catch(e) {
        console.error(`Error loading plugin ${filePath}:`, e);
        return null;
    }
}

function initPlugins() {
    plugins = {};
    const cfg = getConfig();
    const dir = cfg.pluginDir;
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        files.forEach(f => {
            const fullPath = path.join(dir, f);
            const plugin = loadPlugin(fullPath);
            if (plugin && plugin.platform) {
                plugins[f] = plugin;
                console.log(`Loaded plugin: ${plugin.platform} (${f})`);
            }
        });
    } else {
        fs.mkdirSync(dir, { recursive: true });
    }
}

initPlugins();

// API: Get config
app.get('/config', (req, res) => {
    res.json(getConfig());
});

// API: Update config
app.post('/config', (req, res) => {
    const newConfig = { ...getConfig(), ...req.body };
    saveConfig(newConfig);
    initPlugins(); // Reload plugins if dir changed
    res.json({ success: true, config: newConfig });
});

// API: Get all loaded plugins
app.get('/plugins', (req, res) => {
    const list = Object.keys(plugins).map(key => {
        const p = plugins[key];
        return {
            id: key,
            platform: p.platform,
            version: p.version,
            author: p.author,
            srcUrl: p.srcUrl,
            userVariables: p.userVariables || [],
            supportedSearchType: p.supportedSearchType || ['music'],
            hasImportMusicSheet: typeof p.importMusicSheet === 'function',
            hasImportMusicItem: typeof p.importMusicItem === 'function'
        };
    });
    res.json(list);
});

// API: Install from URL
app.post('/plugin/install/url', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url);
        const code = response.data;
        if (typeof code !== 'string') throw new Error("Invalid plugin code format");
        
        const cfg = getConfig();
        if (!fs.existsSync(cfg.pluginDir)) fs.mkdirSync(cfg.pluginDir, { recursive: true });
        
        // Use hash for filename if not provided
        const filename = crypto.createHash('md5').update(url).digest('hex').substring(0, 8) + '.js';
        const dest = path.join(cfg.pluginDir, filename);
        
        fs.writeFileSync(dest, code, 'utf8');
        const plugin = loadPlugin(dest);
        if (plugin && plugin.platform) {
            plugins[filename] = plugin;
            res.json({ success: true, id: filename });
        } else {
            fs.unlinkSync(dest); // Rollback
            res.status(400).json({ error: 'Installed file is not a valid plugin' });
        }
    } catch(e) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

// API: Install from Local File
app.post('/plugin/install/local', (req, res) => {
    const { filePath } = req.body;
    try {
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        const code = fs.readFileSync(filePath, 'utf8');
        
        const cfg = getConfig();
        if (!fs.existsSync(cfg.pluginDir)) fs.mkdirSync(cfg.pluginDir, { recursive: true });
        
        const filename = path.basename(filePath);
        const dest = path.join(cfg.pluginDir, filename);
        fs.copyFileSync(filePath, dest);
        
        const plugin = loadPlugin(dest);
        if (plugin && plugin.platform) {
            plugins[filename] = plugin;
            res.json({ success: true, id: filename });
        } else {
            fs.unlinkSync(dest);
            res.status(400).json({ error: 'Copied file is not a valid plugin' });
        }
    } catch(e) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

// API: Uninstall plugin
app.post('/plugin/uninstall', (req, res) => {
    const { id } = req.body;
    const cfg = getConfig();
    const dest = path.join(cfg.pluginDir, id);
    if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
    }
    delete plugins[id];
    res.json({ success: true });
});

// API: Save Plugin Variables
app.post('/plugin/variables', (req, res) => {
    const { id, variables } = req.body;
    const cfg = getConfig();
    if (!cfg.pluginVariables) cfg.pluginVariables = {};
    cfg.pluginVariables[id] = variables;
    saveConfig(cfg);
    res.json({ success: true });
});

// API: Proxy audio stream with custom headers
app.get('/plugin/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    let customHeaders = {};
    if (req.query.headers) {
        try { customHeaders = JSON.parse(req.query.headers); } catch (e) {}
    }
    
    // Forward Range header for seeking support
    if (req.headers.range) {
        customHeaders['range'] = req.headers.range;
    }

    try {
        const proxyRes = await axios({
            method: 'get',
            url: targetUrl,
            headers: customHeaders,
            responseType: 'stream',
            validateStatus: () => true // allow any status
        });
        
        res.status(proxyRes.status);
        
        for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (key.toLowerCase() !== 'transfer-encoding') {
                try {
                    res.setHeader(key, value);
                } catch(e) {}
            }
        }
        
        proxyRes.data.pipe(res);
    } catch (e) {
        console.error("Proxy error:", e.message);
        res.status(500).end();
    }
});

// API: Call plugin method
app.post('/plugin/variables', (req, res) => {
    const { id, variables } = req.body;
    const cfg = getConfig();
    if (!cfg.variables) cfg.variables = {};
    cfg.variables[id] = variables;
    saveConfig(cfg);
    res.json({ success: true });
});

// API: Call a plugin method
app.post('/plugin/call', async (req, res) => {
    const { id, method, args } = req.body;
    
    if (!plugins[id]) {
        return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const plugin = plugins[id];
    if (typeof plugin[method] !== 'function') {
        return res.status(400).json({ error: `Method ${method} not supported by plugin` });
    }
    
    try {
        const result = await plugin[method](...(args || []));
        res.json({ success: true, data: result });
    } catch(e) {
        console.error(`Error executing ${method} on plugin ${id}:`, e);
        res.status(500).json({ error: e.message || String(e) });
    }
});

// --- Jukebox System ---
let jukeboxServer = null;
let jukeboxIo = null;
let hostSocket = null;
let lastHostState = null;

// Serve the Jukebox frontend files
app.use('/jukebox', express.static(path.join(__dirname, 'dist-jukebox')));

// Configure Jukebox API (called by Tauri Host)
app.post('/jukebox/configure', (req, res) => {
    const { enabled, port } = req.body;
    
    // Stop existing server if any
    if (jukeboxServer) {
        jukeboxServer.close();
        jukeboxServer = null;
        jukeboxIo = null;
    }

    if (enabled && port) {
        const jukeboxApp = express();
        jukeboxApp.use(cors());
        
        jukeboxApp.use(express.json({ limit: '10mb' }));

        jukeboxApp.post('/api/proxy', async (req, res) => {
            const { url, method, headers, body } = req.body;
            try {
                const response = await axios({
                    url,
                    method: method || 'GET',
                    headers: headers || {},
                    data: body,
                    responseType: 'arraybuffer',
                    validateStatus: () => true
                });
                for (const [key, value] of Object.entries(response.headers)) {
                    if (key.toLowerCase() !== 'transfer-encoding') {
                        try { res.setHeader(key, value); } catch(e) {}
                    }
                }
                res.status(response.status).send(response.data);
            } catch (e) {
                console.error("Proxy error:", e.message);
                res.status(500).json({ error: e.message });
            }
        });

        jukeboxApp.get('/api/proxy', async (req, res) => {
            const targetUrl = req.query.url;
            try {
                const response = await axios({
                    url: targetUrl,
                    method: 'GET',
                    responseType: 'stream',
                    validateStatus: () => true
                });
                for (const [key, value] of Object.entries(response.headers)) {
                    if (key.toLowerCase() !== 'transfer-encoding') {
                        try { res.setHeader(key, value); } catch(e) {}
                    }
                }
                response.data.pipe(res);
            } catch (e) {
                res.status(500).end();
            }
        });

        const distPath = path.join(__dirname, 'dist');
        jukeboxApp.use(express.static(distPath));
        
        jukeboxApp.use((req, res) => {
            if (!fs.existsSync(path.join(distPath, 'jukebox.html'))) {
                const separator = req.originalUrl.includes('?') ? '&' : '?';
                return res.redirect(`http://${req.hostname}:3000${req.originalUrl}${separator}wsPort=${port}`);
            }
            res.sendFile(path.join(distPath, 'jukebox.html'));
        });

        jukeboxServer = http.createServer(jukeboxApp);
        jukeboxIo = new Server(jukeboxServer, {
            cors: { origin: '*' }
        });

        jukeboxIo.on('connection', (socket) => {
            console.log('Jukebox client connected:', socket.id);
            
            if (lastHostState && socket !== hostSocket) {
                socket.emit('state_update', lastHostState);
            }

            socket.on('register_host', () => {
                console.log('Host registered:', socket.id);
                hostSocket = socket;
                
                socket.on('disconnect', () => {
                    if (hostSocket === socket) hostSocket = null;
                });
            });

            // Route messages from web client to host
            socket.on('client_command', (cmd) => {
                if (hostSocket) {
                    hostSocket.emit('client_command', cmd);
                } else {
                    socket.emit('error', { message: 'Host not connected' });
                }
            });

            // Route search results from host to web clients
            socket.on('host_search_results', (data) => {
                socket.broadcast.emit('host_search_results', data);
            });

            // Route state from host to all web clients
            socket.on('host_state_update', (state) => {
                hostSocket = socket; // Auto-register as host if sending state
                lastHostState = state;
                socket.broadcast.emit('state_update', state);
            });

            // Route personal data from host to web clients
            socket.on('personal_data', (data) => {
                socket.broadcast.emit('personal_data', data);
            });
        });

        try {
            jukeboxServer.listen(port, '0.0.0.0', () => {
                console.log(`Jukebox server running on http://0.0.0.0:${port}`);
            });
            res.json({ success: true, message: `Started on port ${port}` });
        } catch (e) {
            console.error('Error starting Jukebox server:', e);
            res.status(500).json({ error: e.toString() });
        }
    } else {
        res.json({ success: true, message: 'Jukebox server stopped' });
    }
});

const PORT = 30001;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`MusicFree Plugin Server started on http://127.0.0.1:${PORT}`);
});
