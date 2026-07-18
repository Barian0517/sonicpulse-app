const axios = require('axios');
const fs = require('fs');

const configPath = require('path').join(__dirname, 'bilibili-config.json');
let state = {};
try {
    state = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error("No config found");
    process.exit(1);
}

const biliJct = state.cookie.split(';').find(s => s.trim().startsWith('bili_jct='))?.split('=')[1] || '';

let fullCookie = state.cookie || '';
if (state.buvid3 && !fullCookie.includes('buvid3=')) fullCookie += `; buvid3=${state.buvid3}`;
if (state.buvid4 && !fullCookie.includes('buvid4=')) fullCookie += `; buvid4=${state.buvid4}`;

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/video/BV1p441117A1/',
    'Origin': 'https://www.bilibili.com',
    'Cookie': fullCookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"'
};

async function testLike() {
    try {
        console.log("Cookie:", fullCookie);
        console.log("CSRF:", biliJct);
        const result = await axios.post('https://api.bilibili.com/x/web-interface/archive/like', new URLSearchParams({
            bvid: 'BV1p441117A1', // Just a random valid video (or invalid doesn't matter, it should give -400, not -403)
            like: 1,
            csrf: biliJct
        }).toString(), { headers });
        console.log("Like Response:", result.data);
    } catch (e) {
        console.error("Like Error:", e.response ? e.response.data : e.message);
    }
}

testLike();
