const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const router = express.Router();

let jukeboxServer = null;
let jukeboxIo = null;
let hostSocket = null;
let lastHostState = null;

// Serve the Jukebox frontend files
// Note: We assume this router is mounted at root, so /jukebox goes to dist-jukebox
router.use('/jukebox', express.static(path.join(__dirname, '../../dist-jukebox')));

router.post('/jukebox/configure', (req, res) => {
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

        const distPath = path.join(__dirname, '../../dist');
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

module.exports = router;
