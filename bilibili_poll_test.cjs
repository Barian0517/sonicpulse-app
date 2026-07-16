const axios = require('axios');

async function testApi() {
    const res = await axios.get('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log("Generated:", res.data);
    const key = res.data.data.qrcode_key;
    
    // Simulate one poll
    const poll = await axios.get(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${key}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log("Poll:", poll.data);
}

testApi();
