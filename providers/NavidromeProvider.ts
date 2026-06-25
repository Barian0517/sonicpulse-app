import MD5 from 'crypto-js/md5';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { MusicProvider, Track, Album, Playlist } from './MusicProvider';

export class NavidromeProvider implements MusicProvider {
    name = 'Navidrome';
    private serverUrl = '';
    private username = '';
    private password = ''; // plain password for hashing
    private client = 'SonicPulse';
    private version = '1.16.1';

    init(serverUrl: string, username: string, password: string) {
        this.serverUrl = serverUrl.replace(/\/$/, ''); // remove trailing slash
        this.username = username;
        this.password = password;
    }

    private getAuthParams(): string {
        const salt = Math.random().toString(36).substring(2, 15);
        const token = MD5(this.password + salt).toString();
        return `u=${encodeURIComponent(this.username)}&t=${token}&s=${salt}&v=${this.version}&c=${this.client}&f=json`;
    }

    private async fetchApi(endpoint: string, params: Record<string, string> = {}): Promise<any> {
        if (!this.serverUrl) throw new Error("Navidrome not configured");
        
        const urlParams = new URLSearchParams(params).toString();
        const fullUrl = `${this.serverUrl}/rest/${endpoint}?${this.getAuthParams()}${urlParams ? '&' + urlParams : ''}`;
        
        const res = await tauriFetch(fullUrl, { method: 'GET' });
        const json = await res.json();
        
        if (json['subsonic-response']?.status === 'failed') {
            throw new Error(json['subsonic-response'].error?.message || "Subsonic API Error");
        }
        return json['subsonic-response'];
    }

    async search(query: string): Promise<{ tracks: Track[]; albums: Album[]; }> {
        const res = await this.fetchApi('search3', { query, songCount: '20', albumCount: '10' });
        const result = res.searchResult3;
        
        const tracks: Track[] = (result?.song || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            source: 'navidrome'
        }));

        const albums: Album[] = (result?.album || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            artist: a.artist,
            year: a.year
        }));

        return { tracks, albums };
    }

    async getTopAlbums(): Promise<Album[]> {
        const res = await this.fetchApi('getAlbumList', { type: 'newest', size: '20' });
        const albums = res.albumList?.album || [];
        return albums.map((a: any) => ({
            id: a.id,
            name: a.name,
            artist: a.artist,
            year: a.year
        }));
    }

    async getPlaylists(): Promise<Playlist[]> {
        const res = await this.fetchApi('getPlaylists');
        const playlists = res.playlists?.playlist || [];
        return playlists.map((p: any) => ({
            id: p.id,
            name: p.name,
            trackCount: p.songCount,
        }));
    }

    async getAlbumTracks(albumId: string): Promise<Track[]> {
        const res = await this.fetchApi('getAlbum', { id: albumId });
        const songs = res.album?.song || [];
        return songs.map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            source: 'navidrome'
        }));
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const res = await this.fetchApi('getPlaylist', { id: playlistId });
        const songs = res.playlist?.entry || [];
        return songs.map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            source: 'navidrome'
        }));
    }

    async getTracks(): Promise<Track[]> {
        // Fetch 50 random songs as default tracklist
        try {
            const res = await this.fetchApi('getRandomSongs', { size: '50' });
            const songs = res.randomSongs?.song || [];
            return songs.map((s: any) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                album: s.album,
                duration: s.duration,
                source: 'navidrome'
            }));
        } catch {
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        return `${this.serverUrl}/rest/stream?id=${trackId}&${this.getAuthParams()}`;
    }

    async getCoverArt(trackId: string): Promise<string | undefined> {
        return `${this.serverUrl}/rest/getCoverArt?id=${trackId}&size=300&${this.getAuthParams()}`;
    }

    async getLyrics(trackId: string): Promise<string | null> {
        try {
            const res = await this.fetchApi('getLyrics', { id: trackId });
            return res.lyrics?.value || null;
        } catch {
            return null;
        }
    }
}
