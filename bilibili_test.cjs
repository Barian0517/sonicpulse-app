const axios = require('axios');

async function testApi() {
    console.log("Generating QR Code...");
    const res = await axios.get('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
    });
    console.log(res.data);
}

testApi();
