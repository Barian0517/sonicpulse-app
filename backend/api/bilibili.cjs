const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

const isPkg = typeof process.pkg !== 'undefined';
const projectRoot = path.join(__dirname, '../../');
const dataDir = isPkg ? path.join(os.homedir(), '.sonicpulse') : projectRoot;

if (isPkg && !fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch(e) {}
}

const configPath = path.join(dataDir, 'bilibili-config.json');

let state = {
    cookie: '',
    uid: '',
    buvid3: '',
    buvid4: '',
    wbiImgKey: '',
    wbiSubKey: '',
    wbiTimestamp: 0
};

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            state = { ...state, ...data };
        } catch (e) {}
    }
}

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(state, null, 2), 'utf8');
}

loadConfig();

// Headers generator
function getHeaders(useCookie = true) {
    let fullCookie = state.cookie || '';
    if (state.buvid3 && !fullCookie.includes('buvid3=')) {
        fullCookie = fullCookie ? `${fullCookie}; buvid3=${state.buvid3}` : `buvid3=${state.buvid3}`;
    }
    if (state.buvid4 && !fullCookie.includes('buvid4=')) {
        fullCookie = fullCookie ? `${fullCookie}; buvid4=${state.buvid4}` : `buvid4=${state.buvid4}`;
    }
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com'
    };
    if (useCookie && fullCookie) {
        headers['Cookie'] = fullCookie;
    }
    return headers;
}

// Buvid initialization
async function initBuvid() {
    try {
        const res = await axios.get('https://api.bilibili.com/x/frontend/finger/spi', { headers: getHeaders(false) });
        if (res.data?.data?.b_3) {
            state.buvid3 = res.data.data.b_3;
            state.buvid4 = res.data.data.b_4;
            saveConfig();
        }
        
        // Activate buvid
        const htmlRes = await axios.get('https://space.bilibili.com/1/dynamic', { headers: getHeaders(false) });
        const spmMatch = htmlRes.data.match(/<meta name="spm_prefix" content="([^"]+?)">/);
        if (spmMatch && spmMatch[1]) {
            const spmPrefix = spmMatch[1];
            const rand_png_end = Buffer.from(Array.from({length: 40}, () => Math.floor(Math.random() * 256))).toString('base64');
            const jsonData = JSON.stringify({
                '3064': 1,
                '39c8': `${spmPrefix}.fp.risk`,
                '3c43': {
                    'adca': 'Windows',
                    'bfe9': rand_png_end.substring(rand_png_end.length - 50)
                }
            });
            
            await axios.post('https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi', { payload: jsonData }, {
                headers: { ...getHeaders(false), 'Content-Type': 'application/json' }
            });
        }
    } catch (e) {
        console.error("Failed to fetch or activate buvid", e.message);
    }
}

// Wbi Signature
function getMixinKey(orig) {
    const mixinKeyEncTab = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ];
    let temp = '';
    for (let i = 0; i < mixinKeyEncTab.length; i++) {
        temp += orig.charAt(mixinKeyEncTab[i]);
    }
    return temp.substring(0, 32);
}

async function getWbiKeys() {
    const now = Date.now();
    if (state.wbiImgKey && state.wbiSubKey && (now - state.wbiTimestamp < 12 * 60 * 60 * 1000)) {
        return { imgKey: state.wbiImgKey, subKey: state.wbiSubKey };
    }

    const res = await axios.get('https://api.bilibili.com/x/web-interface/nav', { headers: getHeaders() });
    if (res.data?.data?.wbi_img) {
        const imgUrl = res.data.data.wbi_img.img_url;
        const subUrl = res.data.data.wbi_img.sub_url;
        state.wbiImgKey = imgUrl.substring(imgUrl.lastIndexOf('/') + 1).split('.')[0];
        state.wbiSubKey = subUrl.substring(subUrl.lastIndexOf('/') + 1).split('.')[0];
        state.wbiTimestamp = now;
        saveConfig();
        return { imgKey: state.wbiImgKey, subKey: state.wbiSubKey };
    }
    throw new Error('Failed to fetch wbi keys');
}

async function signWbi(params) {
    const keys = await getWbiKeys();
    const mixinKey = getMixinKey(keys.imgKey + keys.subKey);
    const currTime = Math.round(Date.now() / 1000);
    const newParams = { ...params, wts: currTime };
    
    const sortedKeys = Object.keys(newParams).sort();
    const query = [];
    const chrFilter = /[!'()*]/g;
    
    for (const key of sortedKeys) {
        const val = String(newParams[key]).replace(chrFilter, '');
        query.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
    
    const queryStr = query.join('&');
    const wbiSign = crypto.createHash('md5').update(queryStr + mixinKey).digest('hex');
    newParams.w_rid = wbiSign;
    return newParams;
}

// Helper formatting
function formatDuration(durationRaw) {
    if (typeof durationRaw === 'number') return durationRaw;
    if (!durationRaw || typeof durationRaw !== 'string') return 0;
    const parts = durationRaw.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return Number(durationRaw) || 0;
}

function formatTrack(item) {
    let title = (item.title || "").replace(/<[^>]+>/g, '').replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "");
    let cover = item.pic || item.cover;
    if (cover && cover.startsWith('//')) cover = `https:${cover}`;
    
    return {
        id: String(item.bvid || item.aid),
        title: title,
        artist: item.author || item.owner?.name || item.upper?.name || 'Bilibili',
        album: String(item.bvid || item.aid),
        duration: formatDuration(item.duration),
        coverUrl: cover,
        source: 'bilibili',
        format: 'm4a',
        genre: String(item.id || item.cid || '')
    };
}

// ----- API Routes -----

router.get('/status', (req, res) => {
    res.json({ loggedIn: !!state.cookie, uid: state.uid });
});

router.post('/login/cookie', (req, res) => {
    const { url } = req.body;
    try {
        const urlObj = new URL(url);
        const sessdata = urlObj.searchParams.get('SESSDATA');
        const biliJct = urlObj.searchParams.get('bili_jct');
        const dedeUserId = urlObj.searchParams.get('DedeUserID');
        
        if (sessdata && dedeUserId) {
            state.cookie = `SESSDATA=${sessdata}; bili_jct=${biliJct}; DedeUserID=${dedeUserId}`;
            state.uid = dedeUserId;
            saveConfig();
            return res.json({ success: true, uid: state.uid });
        }
    } catch (e) {}
    res.status(400).json({ error: 'Invalid URL' });
});

router.post('/logout', (req, res) => {
    state.cookie = '';
    state.uid = '';
    saveConfig();
    res.json({ success: true });
});

router.get('/login/qr', async (req, res) => {
    try {
        const result = await axios.get('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
        res.json(result.data.data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/login/poll', async (req, res) => {
    try {
        const result = await axios.get(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${req.query.qrcode_key}`);
        res.json(result.data.data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/search', async (req, res) => {
    if (!state.buvid3) await initBuvid();
    let params = {
        context: "", page: req.query.page || 1, order: "", page_size: 20,
        keyword: req.query.query, duration: "", tids_1: "", tids_2: "",
        __refresh__: true, _extra: "", highlight: 1, single_column: 0,
        platform: "pc", from_source: "", search_type: "video", dynamic_offset: 0
    };
    try {
        params = await signWbi(params);
        const searchHeaders = { ...getHeaders(), 'Origin': 'https://search.bilibili.com' };
        const result = await axios.get('https://api.bilibili.com/x/web-interface/wbi/search/type', { params, headers: searchHeaders });
        if (result.data.code === 0 && result.data.data?.result) {
            res.json({ tracks: result.data.data.result.map(formatTrack) });
        } else {
            res.json({ tracks: [] });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/recommend', async (req, res) => {
    try {
        const result = await axios.get('https://api.bilibili.com/x/web-interface/index/top/feed/rcmd?fresh_type=3&version=1&ps=14', { headers: getHeaders() });
        if (result.data.code === 0 && result.data.data?.item) {
            res.json({ tracks: result.data.data.item.map(formatTrack) });
        } else res.json({ tracks: [] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/fav/folders', async (req, res) => {
    if (!state.uid) return res.json({ folders: [] });
    try {
        const result = await axios.get(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${state.uid}`, { headers: getHeaders() });
        if (result.data.code === 0 && result.data.data?.list) {
            res.json({ folders: result.data.data.list });
        } else res.json({ folders: [] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/fav/videos', async (req, res) => {
    try {
        const params = {
            media_id: req.query.mediaId, pn: req.query.page || 1, ps: 20,
            keyword: '', order: 'mtime', type: 0, tid: 0, platform: 'web'
        };
        const result = await axios.get('https://api.bilibili.com/x/v3/fav/resource/list', { params, headers: getHeaders() });
        if (result.data.code === 0 && result.data.data?.medias) {
            res.json({ tracks: result.data.data.medias.map(formatTrack) });
        } else res.json({ tracks: [] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/like/videos', async (req, res) => {
    if (!state.uid) return res.json({ tracks: [] });
    try {
        const result = await axios.get(`https://api.bilibili.com/x/space/like/video?vmid=${state.uid}&pn=${req.query.page || 1}&ps=30`, { headers: getHeaders() });
        if (result.data.code === 0 && result.data.data?.list) {
            res.json({ tracks: result.data.data.list.map(formatTrack) });
        } else res.json({ tracks: [] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/song', async (req, res) => {
    try {
        const result = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${req.query.id}`, { headers: getHeaders() });
        if (result.data.code === 0 && result.data.data) {
            res.json({ track: formatTrack(result.data.data) });
        } else res.status(404).json({ error: 'Not found' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/stream', async (req, res) => {
    try {
        const bvid = req.query.id;
        const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: getHeaders() });
        if (!viewRes.data?.data?.cid) throw new Error("Could not find video cid");
        const cid = viewRes.data.data.cid;

        const playRes = await axios.get(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`, { headers: getHeaders() });
        let rawUrl = '';
        if (playRes.data?.data?.dash?.audio?.length > 0) {
            const audios = playRes.data.data.dash.audio.sort((a, b) => b.id - a.id);
            rawUrl = audios[0].baseUrl;
        } else if (playRes.data?.data?.durl?.length > 0) {
            rawUrl = playRes.data.data.durl[0].url;
        } else {
            throw new Error("No audio stream found");
        }

        // Instead of returning the raw URL, we proxy it ourselves!
        // This is safe since we are in Node.js
        const hostUrl = rawUrl.substring(rawUrl.indexOf("/") + 2);
        const proxyHeaders = {
            'Referer': `https://www.bilibili.com/video/${bvid}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Host': hostUrl.substring(0, hostUrl.indexOf("/")),
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };

        const range = req.headers.range;
        if (range) proxyHeaders['Range'] = range;

        const streamRes = await axios({
            url: rawUrl,
            method: 'GET',
            headers: proxyHeaders,
            responseType: 'stream',
            validateStatus: () => true
        });

        res.status(streamRes.status);
        for (const [key, value] of Object.entries(streamRes.headers)) {
            if (key.toLowerCase() !== 'transfer-encoding') {
                try { res.setHeader(key, value); } catch(e) {}
            }
        }
        streamRes.data.pipe(res);

    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/star', async (req, res) => {
    try {
        if (!state.buvid3) await initBuvid();

        const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';
        if (!biliJct) throw new Error("Not logged in");

        let params = { bvid: req.body.id, like: req.body.star ? 1 : 2, csrf: biliJct };
        params = await signWbi(params);

        const result = await axios.post('https://api.bilibili.com/x/web-interface/archive/like', new URLSearchParams(params).toString(), {
            headers: { 
                ...getHeaders(), 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `https://www.bilibili.com/video/${req.body.id}`
            }
        });

        if (result.data.code === 0 || result.data.code === 65006) {
            res.json({ success: true });
        } else if (result.data.code === -403) {
            res.status(403).json({ error: "B站風控攔截 (帳號異常)，請稍後再試或在官方網頁操作" });
        } else {
            res.status(400).json({ error: result.data.message });
        }
    } catch(e) { 
        res.status(500).json({ error: e.response?.data?.message || e.message }); 
    }
});

router.post('/fav/folder/add', async (req, res) => {
    try {
        const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';
        if (!biliJct) throw new Error("Not logged in");

        const result = await axios.post('https://api.bilibili.com/x/v3/fav/folder/add', new URLSearchParams({
            title: req.body.name,
            intro: '',
            privacy: 1,
            cover: '',
            csrf: biliJct
        }).toString(), {
            headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (result.data.code === 0 && result.data.data) {
            res.json({ id: result.data.data.id });
        } else res.status(400).json({ error: result.data.message });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/fav/folder/del', async (req, res) => {
    try {
        const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';
        if (!biliJct) throw new Error("Not logged in");

        await axios.post('https://api.bilibili.com/x/v3/fav/folder/del', new URLSearchParams({
            media_ids: req.body.id,
            csrf: biliJct
        }).toString(), {
            headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/fav/folder/add_tracks', async (req, res) => {
    try {
        const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';
        if (!biliJct) throw new Error("Not logged in");

        const { id, tracks } = req.body;
        for (const bvid of tracks) {
            const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: getHeaders() });
            if (viewRes.data?.data?.aid) {
                await axios.post('https://api.bilibili.com/x/v3/fav/resource/deal', new URLSearchParams({
                    rid: viewRes.data.data.aid,
                    type: 2,
                    add_media_ids: id,
                    del_media_ids: '',
                    csrf: biliJct
                }).toString(), {
                    headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/fav/folder/del_tracks', async (req, res) => {
    try {
        const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';
        if (!biliJct) throw new Error("Not logged in");

        const { id, tracks } = req.body;
        for (const bvid of tracks) {
            const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: getHeaders() });
            if (viewRes.data?.data?.aid) {
                await axios.post('https://api.bilibili.com/x/v3/fav/resource/deal', new URLSearchParams({
                    rid: viewRes.data.data.aid,
                    type: 2,
                    add_media_ids: '',
                    del_media_ids: id,
                    csrf: biliJct
                }).toString(), {
                    headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/check_like', async (req, res) => {
    if (!state.uid) return res.json({ hasLike: false });
    try {
        const result = await axios.get(`https://api.bilibili.com/x/web-interface/archive/has_like?bvid=${req.query.id}`, { headers: getHeaders() });
        res.json({ hasLike: result.data.code === 0 && result.data.data === 1 });
    } catch(e) { res.json({ hasLike: false }); }
});

module.exports = router;
