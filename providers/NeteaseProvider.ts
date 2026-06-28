import { MusicProvider, Track, Artist, Album, Playlist } from './MusicProvider';

export class NeteaseProvider implements MusicProvider {
    name = 'Netease Cloud Music';
    private serverUrl: string = '';
    private cookie: string = '';

    constructor() {
        let savedUrl = localStorage.getItem('netease_server_url');
        
        // Force correction if running on external network but URL is local
        const isExternalClient = window.location.hostname !== 'tauri.localhost' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (!savedUrl || savedUrl.includes('vercel.app') || (isExternalClient && (savedUrl.includes('127.0.0.1') || savedUrl.includes('localhost')))) {
            savedUrl = `http://${window.location.hostname === 'tauri.localhost' || window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:30000`;
            localStorage.setItem('netease_server_url', savedUrl);
        }
        this.serverUrl = savedUrl;
        this.cookie = localStorage.getItem('netease_cookie') || '';

        
        // Ensure trailing slash is removed
        if (this.serverUrl.endsWith('/')) {
            this.serverUrl = this.serverUrl.slice(0, -1);
        }
    }

    setCookie(cookie: string) {
        this.cookie = cookie;
    }

    setServerUrl(url: string) {
        this.serverUrl = url;
        if (this.serverUrl.endsWith('/')) {
            this.serverUrl = this.serverUrl.slice(0, -1);
        }
    }

    private async request(endpoint: string, params: Record<string, any> = {}) {
        if (!this.serverUrl) throw new Error("Netease Server URL is not configured");

        const url = new URL(`${this.serverUrl}${endpoint}`);
        
        // Add timestamp to prevent caching
        url.searchParams.append('timestamp', Date.now().toString());
        
        // Add cookie if exists
        if (this.cookie) {
            // Netease API usually accepts cookie in POST body or as query param, 
            // but for GET requests we can pass it as a query param 'cookie' if the wrapper supports it,
            // or we use POST for everything if we need to pass cookie safely.
            // Wait, NeteaseCloudMusicApi supports cookie in query for most routes.
            // Let's pass it in the query or body depending on the method.
            // For simplicity with fetch, let's use POST for requests with cookies if possible, 
            // but the Vercel API might expect POST / GET interchangeably.
            // Actually, we can just send it as a 'cookie' parameter.
        }

        const bodyParams = new URLSearchParams();
        if (this.cookie) {
            bodyParams.append('cookie', this.cookie);
        }

        for (const [key, value] of Object.entries(params)) {
            if (key !== 'cookie') {
                bodyParams.append(key, value?.toString() || '');
            }
        }

        try {
            const res = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: bodyParams.toString()
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const code = data.code ?? data.data?.code;
            if (code !== 200 && code !== 800 && code !== 801 && code !== 802 && code !== 803) {
                console.warn(`Netease API returned code ${code}:`, data);
            }
            return data;
        } catch (err) {
            console.error(`[Netease API Error] ${endpoint}:`, err);
            throw err;
        }
    }

    private formatTrack(song: any): Track {
        const artists = song.ar || song.artists || [];
        const album = song.al || song.album || {};
        
        return {
            id: String(song.id),
            title: song.name,
            artist: artists.map((a: any) => a.name).join(', '),
            album: album.name || '',
            duration: Math.floor((song.dt || song.duration || 0) / 1000),
            coverUrl: album.picUrl ? `${album.picUrl}?param=500y500` : undefined,
            source: 'netease',
            format: 'mp3',
        } as any;
        // We will update the Track type later to include 'netease'.
    }

    private formatAlbum(album: any): Album {
        return {
            id: String(album.id),
            name: album.name,
            artist: (album.artists || []).map((a: any) => a.name).join(', '),
            artistId: album.artist?.id ? String(album.artist.id) : undefined,
            coverUrl: album.picUrl ? `${album.picUrl}?param=500y500` : undefined,
            year: album.publishTime ? new Date(album.publishTime).getFullYear() : undefined,
            songCount: album.size,
        };
    }

    private formatArtist(artist: any): Artist {
        return {
            id: String(artist.id),
            name: artist.name,
            albumCount: artist.albumSize,
            coverUrl: artist.picUrl || artist.img1v1Url,
        };
    }

    async search(query: string): Promise<{ artists: Artist[], tracks: Track[], albums: Album[] }> {
        // Search Songs
        const songRes = await this.request('/cloudsearch', { keywords: query, type: 1, limit: 30 });
        const tracks = (songRes.result?.songs || []).map((s: any) => this.formatTrack(s));

        // Search Albums
        const albumRes = await this.request('/cloudsearch', { keywords: query, type: 10, limit: 10 });
        const albums = (albumRes.result?.albums || []).map((a: any) => this.formatAlbum(a));

        // Search Artists
        const artistRes = await this.request('/cloudsearch', { keywords: query, type: 100, limit: 10 });
        const artists = (artistRes.result?.artists || []).map((a: any) => this.formatArtist(a));

        return { artists, tracks, albums };
    }

    async getTopAlbums(): Promise<Album[]> {
        const res = await this.request('/album/newest');
        return (res.albums || []).map((a: any) => this.formatAlbum(a));
    }

    async getIndexes(): Promise<{ index: string, artists: Artist[] }[]> {
        const res = await this.request('/top/artists', { limit: 50 });
        return [{
            index: 'Top Artists',
            artists: (res.artists || []).map((a: any) => this.formatArtist(a))
        }];
    }

    async getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }> {
        const res = await this.request('/artist/detail', { id });
        const artist = this.formatArtist(res.data?.artist || {});

        const albumRes = await this.request('/artist/album', { id, limit: 50 });
        const albums = (albumRes.hotAlbums || []).map((a: any) => this.formatAlbum(a));

        return { artist, albums };
    }

    async getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }> {
        const res = await this.request('/album', { id });
        const album = this.formatAlbum(res.album || {});
        const tracks = (res.songs || []).map((s: any) => this.formatTrack(s));
        return { album, tracks };
    }

    async getSong(id: string): Promise<Track> {
        const res = await this.request('/song/detail', { ids: id });
        if (res.songs && res.songs.length > 0) {
            return this.formatTrack(res.songs[0]);
        }
        throw new Error("Song not found");
    }

    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        if (type === 'track') {
            await this.request('/like', { id, like: star });
        }
    }

    async setRating(id: string, rating: number): Promise<void> {
        // Netease doesn't support 5-star ratings, only like/unlike
    }

    async getStarred(): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> {
        const uid = localStorage.getItem('netease_uid');
        if (!uid) return { artists: [], albums: [], tracks: [] };

        // Get Liked Songs
        const likeRes = await this.request('/likelist', { uid });
        const trackIds = likeRes.ids || [];
        
        let tracks: Track[] = [];
        if (trackIds.length > 0) {
            // Netease limits song/detail to ~1000 per request, we'll fetch first 100 for performance
            const idsStr = trackIds.slice(0, 100).join(',');
            const songRes = await this.request('/song/detail', { ids: idsStr });
            const fetchedTracks = (songRes.songs || []).map((s: any) => this.formatTrack(s));
            
            // Re-order tracks to match the exact trackIds order (newest first from /likelist)
            const trackMap = new Map<string, Track>();
            fetchedTracks.forEach((t: Track) => trackMap.set(t.id, t));
            
            tracks = trackIds.slice(0, 100)
                .map((id: any) => trackMap.get(String(id)))
                .filter((t: Track | undefined): t is Track => t !== undefined);
        }

        return { artists: [], albums: [], tracks };
    }

    async getPlaylists(): Promise<Playlist[]> {
        const uid = localStorage.getItem('netease_uid');
        if (!uid) return [];

        const res = await this.request('/user/playlist', { uid, limit: 100 });
        return (res.playlist || []).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            trackCount: p.trackCount,
            coverUrl: p.coverImgUrl ? `${p.coverImgUrl}?param=300y300` : undefined,
        }));
    }

    async createPlaylist(name: string): Promise<Playlist> {
        const res = await this.request('/playlist/create', { name });
        return {
            id: String(res.id),
            name: res.playlist?.name || name,
            trackCount: 0,
            coverUrl: res.playlist?.coverImgUrl
        };
    }

    async updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: number[]): Promise<void> {
        // Note: Netease uses track ID for removal, not index
        if (tracksToAdd && tracksToAdd.length > 0) {
            await this.request('/playlist/tracks', { op: 'add', pid: id, tracks: tracksToAdd.join(',') });
        }
    }

    async deletePlaylist(id: string): Promise<void> {
        await this.request('/playlist/delete', { id });
    }

    async getTopSongs(artistId: string): Promise<Track[]> {
        const res = await this.request('/artist/top/song', { id: artistId });
        return (res.songs || []).map((s: any) => this.formatTrack(s));
    }

    async getSimilarSongs(songId: string): Promise<Track[]> {
        const res = await this.request('/simi/song', { id: songId });
        return (res.songs || []).map((s: any) => this.formatTrack(s));
    }

    async likeSong(songId: string, like: boolean = true): Promise<boolean> {
        try {
            const res = await this.request('/like', { id: songId, like });
            return res.code === 200;
        } catch (e) {
            console.error("Failed to like/unlike song:", e);
            return false;
        }
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const res = await this.request('/playlist/track/all', { id: playlistId, limit: 1000 });
        return (res.songs || []).map((s: any) => this.formatTrack(s));
    }

    async getAlbumTracks(albumId: string): Promise<Track[]> {
        const res = await this.getAlbum(albumId);
        return res.tracks;
    }

    async getTracks(): Promise<Track[]> {
        // Return daily recommendations if logged in, otherwise return new songs
        try {
            const res = await this.request('/recommend/songs');
            return (res.data?.dailySongs || []).map((s: any) => this.formatTrack(s));
        } catch {
            const res = await this.request('/personalized/newsong');
            return (res.result || []).map((s: any) => this.formatTrack(s.song));
        }
    }

    async getStreamUrl(trackId: string, options?: { maxBitrate?: number, format?: string }): Promise<string> {
        const levels = ['lossless', 'exhigh', 'higher', 'standard'];
        
        for (const level of levels) {
            try {
                const res = await this.request('/song/url/v1', { id: trackId, level });
                if (res.data && res.data.length > 0 && res.data[0].url) {
                    return res.data[0].url.replace(/^http:/, 'https:');
                }
            } catch (e) {
                console.warn(`Failed to get Netease stream URL for level ${level}:`, e);
            }
        }
        
        throw new Error("Stream URL not found or VIP required");
    }

    async getCoverArt(trackId: string): Promise<string | undefined> {
        const track = await this.getSong(trackId);
        return track.coverUrl;
    }

    async downloadTrack(trackId: string): Promise<void> {
        // Unimplemented for Netease due to potential VIP/DRM restrictions 
        // and browser download limitations without a local proxy.
        console.warn("Download not supported for Netease yet");
    }

    async getLyrics(track: Track): Promise<string | null> {
        const res = await this.request('/lyric', { id: track.id });
        if (res.lrc && res.lrc.lyric) {
            return res.lrc.lyric;
        }
        return null;
    }

    // Netease Specific Methods
    
    async getLoginQrKey(): Promise<string> {
        const res = await this.request('/login/qr/key');
        return res.data.unikey;
    }

    async getLoginQrImage(key: string): Promise<string> {
        const res = await this.request('/login/qr/create', { key, qrimg: true });
        return res.data.qrimg; // Base64 image
    }

    async checkLoginQr(key: string): Promise<{ code: number, message: string, cookie?: string }> {
        const res = await this.request('/login/qr/check', { key });
        return {
            code: res.code,
            message: res.message,
            cookie: res.cookie
        };
    }

    async getLoginStatus(cookie?: string): Promise<any> {
        const res = await this.request('/login/status', { cookie: cookie || this.cookie });
        return res.data || res;
    }
}
