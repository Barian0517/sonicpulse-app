const axios = require('axios');

async function testApi() {
    try {
        const bvid = 'BV1sK4y1N7c3'; // Just a sample BVID
        const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
        console.log("View:", viewRes.data.data?.cid);
        
        const cid = viewRes.data.data.cid;
        
        const playRes = await axios.get(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`);
        console.log("Play URL code:", playRes.data.code);
        
        if (playRes.data.data && playRes.data.data.dash && playRes.data.data.dash.audio) {
            console.log("Has audio:", playRes.data.data.dash.audio.length);
        } else {
            console.log("No audio array found, data:", Object.keys(playRes.data.data || {}));
            if (playRes.data.data && playRes.data.data.durl) {
                 console.log("Found durl instead! url:", playRes.data.data.durl[0].url);
            }
        }
    } catch (e) {
        console.error("Error", e);
    }
}

testApi();
