import { MusicProvider, Track, Artist, Album, Playlist } from './MusicProvider';
import md5 from 'crypto-js/md5';

export class BilibiliProvider implements MusicProvider {
    name = 'Bilibili';
    private cookie: string = '';
    private uid: string = '';
    private buvid3: string = '';
    private buvid4: string = '';
    private wbiImgKey: string = '';
    private wbiSubKey: string = '';
    private wbiTimestamp: number = 0;

    private async _fetch(url: string, options: any = {}) {
        const useTauri = !!(window as any).__TAURI_INTERNALS__;
        if (useTauri) {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const res = await tauriFetch(url, {
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body
            });
            // Polyfill .json() and .text() if needed, but Tauri fetch returns a standard Response
            return res;
        } else {
            const host = window.location.hostname.endsWith('localhost') || window.location.hostname === '127.0.0.1' ? '127.0.0.1' : window.location.hostname;
            const headersStr = options.headers ? encodeURIComponent(JSON.stringify(options.headers)) : '';
            const proxyUrl = `http://${host}:30001/plugin/proxy?url=${encodeURIComponent(url)}${headersStr ? '&headers=' + headersStr : ''}`;
            return fetch(proxyUrl, options);
        }
    }
    
    // Headers used for general Bilibili API requests
    private get headers() {
        let fullCookie = this.cookie || '';
        if (this.buvid3 && !fullCookie.includes('buvid3=')) {
            fullCookie = fullCookie ? `${fullCookie}; buvid3=${this.buvid3}` : `buvid3=${this.buvid3}`;
        }
        
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Cookie': fullCookie,
            'Referer': 'https://www.bilibili.com'
        };
    }

    constructor() {
        this.uid = localStorage.getItem('bilibili_uid') || '';
        this.cookie = localStorage.getItem('bilibili_cookie') || '';
        this.initBuvid();
    }

    private async initBuvid() {
        try {
            const res = await this._fetch('https://api.bilibili.com/x/frontend/finger/spi');
            const data = await res.json();
            if (data.data?.b_3) {
                this.buvid3 = data.data.b_3;
                this.buvid4 = data.data.b_4;
            }
            
            // buvid activate
            const reqHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' };
            const htmlRes = await this._fetch('https://space.bilibili.com/1/dynamic', { headers: reqHeaders });
            const htmlText = await htmlRes.text();
            const spmMatch = htmlText.match(/<meta name="spm_prefix" content="([^"]+?)">/);
            if (spmMatch && spmMatch[1]) {
                const spmPrefix = spmMatch[1];
                const rand_png_end = btoa(Array.from({length: 40}, () => String.fromCharCode(Math.floor(Math.random() * 256))).join(''));
                const jsonData = JSON.stringify({
                    '3064': 1,
                    '39c8': `${spmPrefix}.fp.risk`,
                    '3c43': {
                        'adca': 'Windows',
                        'bfe9': rand_png_end.substring(rand_png_end.length - 50)
                    }
                });
                
                const activateUrl = `https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi`;
                const activateHeaders = { ...reqHeaders, 'Content-Type': 'application/json' };
                await this._fetch(activateUrl, {
                    method: 'POST',
                    headers: activateHeaders,
                    body: JSON.stringify({ payload: jsonData })
                });
            }
        } catch (e) {
            console.error("Failed to fetch or activate buvid", e);
        }
    }

    // Wbi Signature Implementation
    private getMixinKey(orig: string) {
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

    private async getWbiKeys(): Promise<{imgKey: string, subKey: string}> {
        const now = Date.now();
        if (this.wbiImgKey && this.wbiSubKey && (now - this.wbiTimestamp < 12 * 60 * 60 * 1000)) {
            return { imgKey: this.wbiImgKey, subKey: this.wbiSubKey };
        }

        const data = await this.request('https://api.bilibili.com/x/web-interface/nav');
        if (data && data.data && data.data.wbi_img) {
            const imgUrl = data.data.wbi_img.img_url;
            const subUrl = data.data.wbi_img.sub_url;
            this.wbiImgKey = imgUrl.substring(imgUrl.lastIndexOf('/') + 1).split('.')[0];
            this.wbiSubKey = subUrl.substring(subUrl.lastIndexOf('/') + 1).split('.')[0];
            this.wbiTimestamp = now;
            return { imgKey: this.wbiImgKey, subKey: this.wbiSubKey };
        }
        throw new Error('Failed to fetch wbi keys');
    }

    private async signWbi(params: Record<string, any>): Promise<Record<string, any>> {
        const keys = await this.getWbiKeys();
        const mixinKey = this.getMixinKey(keys.imgKey + keys.subKey);
        const currTime = Math.round(Date.now() / 1000);
        const newParams: Record<string, any> = { ...params, wts: currTime };
        
        const sortedKeys = Object.keys(newParams).sort();
        const query: string[] = [];
        const chrFilter = /[!'()*]/g;
        
        for (const key of sortedKeys) {
            const val = String(newParams[key]).replace(chrFilter, '');
            query.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
        
        const queryStr = query.join('&');
        const wbiSign = md5(queryStr + mixinKey).toString();
        newParams.w_rid = wbiSign;
        return newParams;
    }

    // Proxy request using plugin-server to bypass browser CORS if needed
    private async request(url: string, params: any = {}, useCookie: boolean = true) {
        const query = new URLSearchParams(params).toString();
        const fullUrl = `${url}${query ? '?' + query : ''}`;
        
        const headers = useCookie ? this.headers : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com'
        };

        const res = await this._fetch(fullUrl, { headers });
        
        if (!res.ok) throw new Error(`Bilibili API Error: ${res.statusText}`);
        return await res.json();
    }

    // Unimplemented but required by interface
    async getTopAlbums(): Promise<Album[]> { return []; }
    async getIndexes(): Promise<{ index: string, artists: Artist[] }[]> { return []; }
    async getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }> { throw new Error('Not implemented'); }
    async getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }> { throw new Error('Not implemented'); }
    async getTracks(): Promise<Track[]> { return []; }
    async downloadTrack(trackId: string): Promise<void> {}
    async getLyrics(track: Track): Promise<string | null> { return null; }
    async createPlaylist(name: string): Promise<Playlist> { throw new Error('Not implemented'); }
    async updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: number[]): Promise<void> {}
    async deletePlaylist(id: string): Promise<void> {}
    async getAlbumTracks(albumId: string): Promise<Track[]> { return []; }
    async getCoverArt(trackId: string): Promise<string | undefined> { return undefined; }
    async setRating(id: string, rating: number): Promise<void> {}

    // Implement MusicProvider methods using new Bilibili API methods
    async getPlaylists(): Promise<Playlist[]> {
        const folders = await this.getFavFolders();
        return folders.map(f => ({
            id: String(f.id),
            name: f.title,
            trackCount: f.media_count,
            coverUrl: ''
        }));
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        return await this.getFavVideos(playlistId);
    }

    async getStarred(): Promise<{ tracks: Track[], albums: Album[], artists: Artist[] }> {
        const tracks = await this.getLikedVideos();
        return { tracks, albums: [], artists: [] };
    }

    // QR Code Login API
    async getLoginQR() {
        const res = await this.request('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
        return res.data; // { url, qrcode_key }
    }

    async pollLoginQR(qrcodeKey: string) {
        const res = await this.request('https://passport.bilibili.com/x/passport-login/web/qrcode/poll', { qrcode_key: qrcodeKey });
        return res; // code 0 is success, 86101 not scanned, 86090 scanned, 86038 expired
    }

    setCookieFromUrl(url: string) {
        // url is something like https://passport.bilibili.com/web/sso/exchange_cookie?SESSDATA=xxxx&bili_jct=yyyy&DedeUserID=zzzz
        try {
            const urlObj = new URL(url);
            const sessdata = urlObj.searchParams.get('SESSDATA');
            const biliJct = urlObj.searchParams.get('bili_jct');
            const dedeUserId = urlObj.searchParams.get('DedeUserID');
            
            if (sessdata && dedeUserId) {
                this.cookie = `SESSDATA=${sessdata}; bili_jct=${biliJct}; DedeUserID=${dedeUserId}`;
                this.uid = dedeUserId;
                localStorage.setItem('bilibili_cookie', this.cookie);
                localStorage.setItem('bilibili_uid', this.uid);
                return true;
            }
        } catch (e) {
            console.error("Failed to parse bilibili login url", e);
        }
        return false;
    }

    logout() {
        this.cookie = '';
        this.uid = '';
        localStorage.removeItem('bilibili_cookie');
        localStorage.removeItem('bilibili_uid');
    }

    private formatDuration(durationRaw: any): number {
        if (typeof durationRaw === 'number') return durationRaw;
        if (!durationRaw || typeof durationRaw !== 'string') return 0;
        const parts = durationRaw.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return Number(durationRaw) || 0;
    }

    private formatTrack(item: any): Track {
        return {
            id: String(item.bvid),
            title: item.title.replace(/<[^>]+>/g, ''), // Strip html tags
            artist: item.author || 'Bilibili',
            album: 'Bilibili Video',
            duration: this.formatDuration(item.duration),
            coverUrl: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
            source: 'bilibili',
            format: 'm4a',
            // Save cid for later playurl fetching
            genre: String(item.id || item.cid || ''),
        };
    }

    // Search
    // Search natively bypassing WAF with correct headers
    async search(query: string, page: number = 1): Promise<{ artists: Artist[], tracks: Track[], albums: Album[] }> {
        if (!this.buvid3 || !this.buvid4) await this.initBuvid();
        
        const searchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://search.bilibili.com',
            'Referer': 'https://search.bilibili.com/',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'Cookie': `buvid3=${this.buvid3};buvid4=${this.buvid4}${this.cookie ? ';' + this.cookie : ''}`
        };

        let params: any = {
            context: "",
            page: page,
            order: "",
            page_size: 20,
            keyword: query,
            duration: "",
            tids_1: "",
            tids_2: "",
            __refresh__: true,
            _extra: "",
            highlight: 1,
            single_column: 0,
            platform: "pc",
            from_source: "",
            search_type: "video",
            dynamic_offset: 0
        };

        params = await this.signWbi(params);
        const queryStr = new URLSearchParams(params).toString();
        const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${queryStr}`;

        try {
            const res = await this._fetch(url, { headers: searchHeaders });
            const data = await res.json();
            if (data.code === 0 && data.data && data.data.result) {
                const tracks = data.data.result.map((item: any) => {
                    let title = item.title ? item.title.replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "") : "";
                    
                    let cover = item.pic || item.cover;
                    if (cover && cover.startsWith('//')) cover = `https:${cover}`;
                    
                    return {
                        id: String(item.bvid || item.aid),
                        title,
                        artist: item.author || '',
                        album: String(item.bvid || item.aid),
                        duration: this.formatDuration(item.duration),
                        coverUrl: cover,
                        source: 'bilibili'
                    };
                });
                return { artists: [], albums: [], tracks };
            }
        } catch (e) {
            console.error('Bilibili native search error:', e);
        }

        return { artists: [], tracks: [], albums: [] };
    }

    // --- New Bilibili Specific API Methods ---

    async getRecommendVideos(): Promise<Track[]> {
        try {
            const res = await this.request('https://api.bilibili.com/x/web-interface/index/top/feed/rcmd', { fresh_type: 3, version: 1, ps: 14 });
            if (res.code === 0 && res.data && res.data.item) {
                return res.data.item.map((item: any) => ({
                    id: String(item.bvid),
                    title: item.title,
                    artist: item.owner?.name || '',
                    album: String(item.bvid),
                    duration: this.formatDuration(item.duration),
                    coverUrl: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
                    source: 'bilibili'
                }));
            }
        } catch (e) {
            console.error('Bilibili recommend error:', e);
        }
        return [];
    }

    async getFavFolders(): Promise<any[]> {
        if (!this.uid) return [];
        try {
            const res = await this.request('https://api.bilibili.com/x/v3/fav/folder/created/list-all', { up_mid: this.uid });
            if (res.code === 0 && res.data && res.data.list) {
                return res.data.list;
            }
        } catch (e) {
            console.error('Bilibili getFavFolders error:', e);
        }
        return [];
    }

    async getFavVideos(mediaId: string, page: number = 1): Promise<Track[]> {
        try {
            const res = await this.request('https://api.bilibili.com/x/v3/fav/resource/list', {
                media_id: mediaId,
                pn: page,
                ps: 20,
                keyword: '',
                order: 'mtime',
                type: 0,
                tid: 0,
                platform: 'web'
            });
            if (res.code === 0 && res.data && res.data.medias) {
                return res.data.medias.map((item: any) => ({
                    id: String(item.bvid),
                    title: item.title,
                    artist: item.upper?.name || '',
                    album: String(item.bvid),
                    duration: this.formatDuration(item.duration),
                    coverUrl: item.cover.startsWith('//') ? `https:${item.cover}` : item.cover,
                    source: 'bilibili'
                }));
            }
        } catch (e) {
            console.error('Bilibili getFavVideos error:', e);
        }
        return [];
    }

    async getLikedVideos(page: number = 1): Promise<Track[]> {
        if (!this.uid) return [];
        try {
            const res = await this.request('https://api.bilibili.com/x/space/like/video', {
                vmid: this.uid,
                pn: page,
                ps: 30
            });
            if (res.code === 0 && res.data && res.data.list) {
                return res.data.list.map((item: any) => ({
                    id: String(item.bvid),
                    title: item.title,
                    artist: item.owner?.name || '',
                    album: String(item.bvid),
                    duration: this.formatDuration(item.duration),
                    coverUrl: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
                    source: 'bilibili'
                }));
            }
        } catch (e) {
            console.error('Bilibili getLikedVideos error:', e);
        }
        return [];
    }

    // Stream URL
    async getStreamUrl(trackId: string): Promise<string> {
        let bvid = trackId;
        let cid = '';

        // Fetch cid first
        const viewRes = await this.request('https://api.bilibili.com/x/web-interface/view', { bvid });
        if (viewRes.data && viewRes.data.cid) {
            cid = String(viewRes.data.cid);
        } else {
            throw new Error("Could not find video cid");
        }

        // Fetch play url with fnval=16 to request DASH format, which separates audio and video streams
        const playRes = await this.request('https://api.bilibili.com/x/player/playurl', {
            bvid,
            cid,
            fnval: 16
        });

        console.log("Bilibili playurl response:", playRes);

        if (playRes.data && playRes.data.dash && playRes.data.dash.audio && playRes.data.dash.audio.length > 0) {
            // Sort by highest audio quality
            const audios = playRes.data.dash.audio.sort((a: any, b: any) => b.id - a.id);
            const rawUrl = audios[0].baseUrl;
            const hostUrl = rawUrl.substring(rawUrl.indexOf("/") + 2);
            const proxyHeaders = {
                'Referer': `https://www.bilibili.com/video/${bvid}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Host': hostUrl.substring(0, hostUrl.indexOf("/")),
                'Accept': '*/*',
                'Connection': 'keep-alive'
            };
            return `http://${window.location.hostname === 'tauri.localhost' || window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:30001/plugin/proxy?url=${encodeURIComponent(rawUrl)}&headers=${encodeURIComponent(JSON.stringify(proxyHeaders))}`;
        }

        if (playRes.data && playRes.data.durl && playRes.data.durl.length > 0) {
            const rawUrl = playRes.data.durl[0].url;
            console.log("Bilibili raw durl:", rawUrl);
            const hostUrl = rawUrl.substring(rawUrl.indexOf("/") + 2);
            const proxyHeaders = {
                'Referer': `https://www.bilibili.com/video/${bvid}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Host': hostUrl.substring(0, hostUrl.indexOf("/")),
                'Accept': '*/*',
                'Connection': 'keep-alive'
            };
            const proxyUrl = `http://${window.location.hostname === 'tauri.localhost' || window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:30001/plugin/proxy?url=${encodeURIComponent(rawUrl)}&headers=${encodeURIComponent(JSON.stringify(proxyHeaders))}`;
            return proxyUrl;
        }

        throw new Error("Could not find audio stream in Bilibili response");
    }

    // Single Song
    async getSong(id: string): Promise<Track> {
        const viewRes = await this.request('https://api.bilibili.com/x/web-interface/view', { bvid: id });
        const item = viewRes.data;
        return {
            id: String(item.bvid),
            title: item.title,
            artist: item.owner?.name || 'Bilibili',
            album: 'Bilibili Video',
            duration: this.formatDuration(item.duration),
            coverUrl: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
            source: 'bilibili'
        };
    }

    // Like / Unlike
    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        if (type === 'track') {
            const biliJct = this.cookie.split(';').find(s => s.includes('bili_jct'))?.split('=')[1] || '';
            if (!biliJct) throw new Error("Not logged in");

            await this.request('https://api.bilibili.com/x/web-interface/archive/like', {
                bvid: id,
                like: star ? 1 : 2,
                csrf: biliJct
            });
        }
    }
}
