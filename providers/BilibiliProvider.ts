import { MusicProvider, Track, Artist, Album, Playlist } from './MusicProvider';

export class BilibiliProvider implements MusicProvider {
    name = 'Bilibili';
    private cookie: string = '';
    private uid: string = '';
    private buvid3: string = '';
    
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
            const res = await fetch('http://127.0.0.1:30001/plugin/proxy?url=https%3A%2F%2Fapi.bilibili.com%2Fx%2Ffrontend%2Ffinger%2Fspi');
            const data = await res.json();
            if (data.data?.b_3) {
                this.buvid3 = data.data.b_3;
            }
        } catch (e) {
            console.error("Failed to fetch buvid", e);
        }
    }

    // Proxy request using plugin-server to bypass browser CORS if needed
    private async request(url: string, params: any = {}, useCookie: boolean = true) {
        const query = new URLSearchParams(params).toString();
        const fullUrl = `${url}${query ? '?' + query : ''}`;
        
        const headers = useCookie ? this.headers : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com'
        };

        const proxyUrl = `http://${window.location.hostname === 'tauri.localhost' || window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:30001/plugin/proxy?url=${encodeURIComponent(fullUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
        
        const res = await fetch(proxyUrl);
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

    private formatDuration(durationStr: string): number {
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
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
        const searchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://search.bilibili.com',
            'Referer': 'https://search.bilibili.com/',
            'Cookie': this.cookie ? (this.cookie.includes('buvid3') ? this.cookie : `${this.cookie}; buvid3=${this.buvid3}`) : `buvid3=${this.buvid3}`
        };

        const params = {
            search_type: 'video',
            keyword: query,
            page: page,
            page_size: 20
        };

        const queryStr = new URLSearchParams(params as any).toString();
        const url = `https://api.bilibili.com/x/web-interface/search/type?${queryStr}`;
        const proxyUrl = `http://${window.location.hostname === 'tauri.localhost' || window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:30001/plugin/proxy?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(searchHeaders))}`;

        try {
            const res = await fetch(proxyUrl);
            const data = await res.json();
            if (data.code === 0 && data.data && data.data.result) {
                const tracks = data.data.result.map((item: any) => {
                    let title = item.title ? item.title.replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "") : "";
                    
                    let duration = item.duration || 0;
                    if (typeof duration === 'string') {
                        const dur = duration.split(":");
                        duration = dur.reduce((prev, curr) => 60 * prev + +curr, 0);
                    }
                    
                    let cover = item.pic || item.cover;
                    if (cover && cover.startsWith('//')) cover = `https:${cover}`;
                    
                    return {
                        id: String(item.bvid || item.aid),
                        title,
                        artist: item.author || '',
                        album: item.bvid || item.aid,
                        duration: this.formatDuration(duration),
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

        // Fetch play url with fnval=1 to force standard MP4 which is fully compatible with howler.js on Web/HTML5 without DASH parsing
        const playRes = await this.request('https://api.bilibili.com/x/player/playurl', {
            bvid,
            cid,
            fnval: 1
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

    // Liked Videos
    async getStarred(): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> {
        if (!this.uid) return { artists: [], albums: [], tracks: [] };
        
        try {
            const res = await this.request('https://api.bilibili.com/x/space/like/video', {
                vmid: this.uid,
                pn: 1,
                ps: 30
            });
            
            const list = res.data?.list || [];
            // The item format slightly differs, so we handle it
            const tracks = list.map((item: any) => ({
                id: String(item.bvid),
                title: item.title,
                artist: item.owner?.name || 'Bilibili',
                album: 'Liked Video',
                duration: item.duration,
                coverUrl: item.pic,
                source: 'bilibili',
                format: 'm4a',
            }));
            
            return { artists: [], albums: [], tracks };
        } catch (e) {
            console.error("Failed to get starred videos", e);
            return { artists: [], albums: [], tracks: [] };
        }
    }

    // Like / Unlike
    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        if (type === 'track') {
            // Need csrf/bili_jct
            const biliJct = this.cookie.split(';').find(s => s.includes('bili_jct'))?.split('=')[1] || '';
            if (!biliJct) throw new Error("Not logged in");

            await this.request('https://api.bilibili.com/x/web-interface/archive/like', {
                bvid: id,
                like: star ? 1 : 2,
                csrf: biliJct
            });
        }
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
            duration: item.duration,
            coverUrl: item.pic,
            source: 'bilibili',
            format: 'm4a',
        };
    }

    // Favorites / Folders (Playlists)
    async getPlaylists(): Promise<Playlist[]> {
        console.log("Bilibili getPlaylists called. UID:", this.uid);
        if (!this.uid) return [];
        
        try {
            const res = await this.request('https://api.bilibili.com/x/v3/fav/folder/created/list-all', {
                up_mid: this.uid
            });
            console.log("Bilibili getPlaylists response:", res);
            
            const list = res.data?.list || [];
            return list.map((f: any) => ({
                id: String(f.id),
                name: f.title,
                trackCount: f.media_count,
            }));
        } catch (e) {
            console.error("Failed to get bilibili playlists", e);
            return [];
        }
    }

    // Get Playlist Tracks
    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        try {
            const res = await this.request('https://api.bilibili.com/x/v3/fav/resource/list', {
                media_id: playlistId,
                pn: 1,
                ps: 20
            });
            
            const list = res.data?.medias || [];
            return list.map((item: any) => ({
                id: String(item.bvid),
                title: item.title,
                artist: item.upper?.name || 'Bilibili',
                album: 'Favorite',
                duration: item.duration,
                coverUrl: item.cover,
                source: 'bilibili',
                format: 'm4a',
            }));
        } catch (e) {
            console.error("Failed to get playlist tracks", e);
            return [];
        }
    }
}
