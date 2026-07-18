import { MusicProvider, Track, Artist, Album, Playlist } from './MusicProvider';

const host = !!(window as any).__TAURI_INTERNALS__ || window.location.hostname.endsWith('localhost') || window.location.hostname === '127.0.0.1' ? '127.0.0.1' : window.location.hostname;
const BACKEND_URL = `http://${host}:30001/api/bilibili`;

export class BilibiliProvider implements MusicProvider {
    name = 'Bilibili';

    private async request(path: string, params: Record<string, any> = {}, method: string = 'GET') {
        let url = `${BACKEND_URL}${path}`;
        let body = undefined;
        if (method === 'GET') {
            const query = new URLSearchParams(params).toString();
            if (query) url += `?${query}`;
        } else {
            body = JSON.stringify(params);
        }
        
        const res = await fetch(url, {
            method,
            headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
            body
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    }

    async getPlaylists(): Promise<Playlist[]> {
        const res = await this.request('/fav/folders');
        if (res.folders) {
            return res.folders.map((f: any) => ({
                id: String(f.id),
                name: f.title,
                trackCount: f.media_count,
                coverUrl: ''
            }));
        }
        return [];
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const res = await this.request('/fav/videos', { mediaId: playlistId, page: 1 });
        return res.tracks || [];
    }

    async getStarred(): Promise<{ tracks: Track[], albums: Album[], artists: Artist[] }> {
        const res = await this.request('/like/videos', { page: 1 });
        return { tracks: res.tracks || [], albums: [], artists: [] };
    }

    async search(query: string, page: number = 1): Promise<{ artists: Artist[], tracks: Track[], albums: Album[] }> {
        const res = await this.request('/search', { query, page });
        return { artists: [], albums: [], tracks: res.tracks || [] };
    }

    async getRecommendVideos(): Promise<Track[]> {
        const res = await this.request('/recommend');
        return res.tracks || [];
    }

    async getSong(id: string): Promise<Track> {
        const res = await this.request('/song', { id });
        if (res.track) return res.track;
        throw new Error("Track not found");
    }

    async getStreamUrl(trackId: string): Promise<string> {
        return `${BACKEND_URL}/stream?id=${encodeURIComponent(trackId)}`;
    }

    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        if (type === 'track') {
            await this.request('/star', { id, star }, 'POST');
        }
    }

    async checkHasLike(bvid: string): Promise<boolean> {
        const res = await this.request('/check_like', { id: bvid });
        return res.hasLike || false;
    }

    // Login logic
    async getLoginQR() {
        return await this.request('/login/qr');
    }

    async pollLoginQR(qrcodeKey: string) {
        const data = await this.request('/login/poll', { qrcode_key: qrcodeKey });
        return { data };
    }

    async setCookieFromUrl(url: string) {
        try {
            await this.request('/login/cookie', { url }, 'POST');
            localStorage.setItem('bilibili_cookie', 'managed_by_backend');
            return true;
        } catch(e) {
            return false;
        }
    }

    async logout() {
        await this.request('/logout', {}, 'POST');
        localStorage.removeItem('bilibili_cookie');
    }

    // Unimplemented but required
    async getTopAlbums(): Promise<Album[]> { return []; }
    async getIndexes(): Promise<{ index: string, artists: Artist[] }[]> { return []; }
    async getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }> { throw new Error('Not implemented'); }
    async getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }> { throw new Error('Not implemented'); }
    async getTracks(): Promise<Track[]> { return []; }
    async downloadTrack(trackId: string): Promise<void> {}
    async getLyrics(track: Track): Promise<string | null> { return null; }
    
    async createPlaylist(name: string): Promise<Playlist> {
        const res = await this.request('/fav/folder/add', { name }, 'POST');
        return {
            id: String(res.id),
            name: name,
            trackCount: 0,
            coverUrl: ''
        };
    }
    
    async updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: any[]): Promise<void> {
        if (tracksToAdd && tracksToAdd.length > 0) {
            await this.request('/fav/folder/add_tracks', { id, tracks: tracksToAdd }, 'POST');
        }
        if (tracksToRemove && tracksToRemove.length > 0) {
            await this.request('/fav/folder/del_tracks', { id, tracks: tracksToRemove }, 'POST');
        }
    }
    
    async deletePlaylist(id: string): Promise<void> {
        await this.request('/fav/folder/del', { id }, 'POST');
    }
    
    async getAlbumTracks(albumId: string): Promise<Track[]> { return []; }
    async getCoverArt(trackId: string): Promise<string | undefined> { return undefined; }
    async setRating(id: string, rating: number): Promise<void> {}
}
