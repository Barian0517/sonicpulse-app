const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection from a plugin:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception from a plugin:', err);
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
            URL: URL
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

const PORT = 30001;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`MusicFree Plugin Server started on http://127.0.0.1:${PORT}`);
});
