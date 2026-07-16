const axios = require('axios');

async function testApi() {
    try {
        const bvid = 'BV1sK4y1N7c3'; 
        const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
        const cid = viewRes.data.data.cid;
        
        const playRes = await axios.get(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=0`); // fnval=0 for mp4/flv
        
        console.log("PlayRes keys:", Object.keys(playRes.data.data || {}));
        if (playRes.data.data && playRes.data.data.durl) {
             console.log("Found durl! url:", playRes.data.data.durl[0].url);
        } else {
             console.log(playRes.data.data);
        }
    } catch (e) {
        console.error("Error", e);
    }
}

testApi();
