const axios = require('axios');

async function testApi() {
    try {
        const bvid = 'BV1sK4y1N7c3'; 
        const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
        const cid = viewRes.data.data.cid;
        
        const playRes = await axios.get(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`);
        
        const audioUrl = playRes.data.data.dash.audio[0].baseUrl;
        console.log("Audio URL:", audioUrl.slice(0, 50) + "...");

        const streamRes = await axios.get(audioUrl, {
            headers: {
                'Referer': 'https://www.bilibili.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            // Just request a small chunk to check headers
            headers: {
                'Range': 'bytes=0-100',
                'Referer': 'https://www.bilibili.com',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        console.log("Stream status:", streamRes.status);
    } catch (e) {
        console.error("Stream Error", e.response ? e.response.status : e.message);
    }
}

testApi();
