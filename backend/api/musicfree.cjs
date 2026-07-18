const express = require('express');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');

const router = express.Router();

const bundledModules = {
    'cheerio': require('cheerio'),
    'dayjs': require('dayjs'),
    'he': require('he'),
    'big-integer': require('big-integer'),
    'webdav': require('webdav'),
    'crypto-js': require('crypto-js')
};

const isPkg = typeof process.pkg !== 'undefined';
// For the backend structure, the root of the project is one directory up
const projectRoot = path.join(__dirname, '../../');
const dataDir = isPkg ? path.join(os.homedir(), '.sonicpulse') : projectRoot;

if (isPkg && !fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch(e) {}
}

const defaultPluginDir = path.join(projectRoot, 'musicfree-plugin');
const userPluginDir = path.join(dataDir, 'musicfree-plugin');

if (isPkg && !fs.existsSync(userPluginDir) && fs.existsSync(defaultPluginDir)) {
    try { fs.cpSync(defaultPluginDir, userPluginDir, { recursive: true }); } catch(e) {}
}

const configPath = path.join(dataDir, 'musicfree-config.json');

function getConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {}
    }
    return { 
        pluginDir: userPluginDir,
        variables: {}
    };
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

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
                getUserAgent: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                md5: (str) => crypto.createHash('md5').update(str).digest('hex')
            },
            require: function(moduleName) {
                if (moduleName === 'axios') {
                    const axiosInst = require('axios').create({
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                            'Accept': '*/*'
                        }
                    });
                    axiosInst.default = axiosInst;
                    return axiosInst;
                }
                if (bundledModules[moduleName]) return bundledModules[moduleName];
                try {
                    return require(moduleName);
                } catch(e) {
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
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
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

router.get('/config', (req, res) => res.json(getConfig()));

router.post('/config', (req, res) => {
    const newConfig = { ...getConfig(), ...req.body };
    saveConfig(newConfig);
    initPlugins();
    res.json({ success: true, config: newConfig });
});

router.get('/plugins', (req, res) => {
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

router.post('/plugin/install/url', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url);
        let pluginsToInstall = [];
        
        if (typeof response.data === 'object' && response.data.plugins && Array.isArray(response.data.plugins)) {
            pluginsToInstall = response.data.plugins.map(p => p.url).filter(Boolean);
        } else if (typeof response.data === 'string') {
            pluginsToInstall = [url];
        } else {
            throw new Error("Invalid plugin format or unsupported subscription JSON");
        }

        const cfg = getConfig();
        if (!fs.existsSync(cfg.pluginDir)) fs.mkdirSync(cfg.pluginDir, { recursive: true });

        const results = { success: [], failed: [] };

        for (const targetUrl of pluginsToInstall) {
            try {
                let codeToInstall;
                if (targetUrl === url && typeof response.data === 'string') {
                    codeToInstall = response.data;
                } else {
                    const dlRes = await axios.get(targetUrl);
                    if (typeof dlRes.data !== 'string') throw new Error("Downloaded content is not string");
                    codeToInstall = dlRes.data;
                }

                const filename = crypto.createHash('md5').update(targetUrl).digest('hex').substring(0, 8) + '.js';
                const dest = path.join(cfg.pluginDir, filename);
                
                fs.writeFileSync(dest, codeToInstall, 'utf8');
                const plugin = loadPlugin(dest);
                
                if (plugin && plugin.platform) {
                    plugins[filename] = plugin;
                    results.success.push({ name: plugin.platform || 'Unknown', id: filename });
                } else {
                    fs.unlinkSync(dest);
                    throw new Error("Invalid plugin");
                }
            } catch (err) {
                results.failed.push({ url: targetUrl, error: err.message });
            }
        }

        if (results.success.length > 0) {
            res.json({ success: true, installed: results.success, failed: results.failed });
        } else {
            res.status(400).json({ error: 'Failed to install any plugins', details: results.failed });
        }
    } catch(e) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

router.post('/plugin/install/local', (req, res) => {
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

router.post('/plugin/uninstall', (req, res) => {
    const { id } = req.body;
    const cfg = getConfig();
    const dest = path.join(cfg.pluginDir, id);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    delete plugins[id];
    res.json({ success: true });
});

router.post('/plugin/variables', (req, res) => {
    const { id, variables } = req.body;
    const cfg = getConfig();
    if (!cfg.variables) cfg.variables = {};
    cfg.variables[id] = variables;
    saveConfig(cfg);
    res.json({ success: true });
});

router.post('/plugin/call', async (req, res) => {
    const { id, method, args } = req.body;
    
    if (!plugins[id]) return res.status(404).json({ error: 'Plugin not found' });
    
    const plugin = plugins[id];
    if (typeof plugin[method] !== 'function') return res.status(400).json({ error: `Method ${method} not supported` });
    
    try {
        const result = await plugin[method](...(args || []));
        res.json({ success: true, data: result });
    } catch(e) {
        console.error(`Error executing ${method} on plugin ${id}:`, e);
        res.status(500).json({ error: e.message || String(e) });
    }
});

module.exports = router;
