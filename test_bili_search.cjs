const axios = require('axios');

async function testSearch() {
    try {
        const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
            params: {
                search_type: 'video',
                keyword: '周杰伦',
                page: 1
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });
        console.log("Search Res code:", res.data.code);
        console.log("Search Res data keys:", res.data.data ? Object.keys(res.data.data) : 'null');
        if (res.data.data && res.data.data.result) {
            console.log("Results length:", res.data.data.result.length);
        } else {
            console.log("Full data:", JSON.stringify(res.data.data));
            console.log("Full message:", res.data.message);
        }
    } catch (e) {
        console.error("Search failed:", e.message);
    }
}
testSearch();
