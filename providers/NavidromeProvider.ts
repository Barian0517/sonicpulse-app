import MD5 from 'crypto-js/md5';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { MusicProvider, Track, Album, Playlist, Artist } from './MusicProvider';
import { offlineManager } from './OfflineManager';

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

    private getAuthParams(staticSalt?: string): string {
        const salt = staticSalt || Math.random().toString(36).substring(2, 15);
        const token = MD5(this.password + salt).toString();
        return `u=${encodeURIComponent(this.username)}&t=${token}&s=${salt}&v=${this.version}&c=${this.client}&f=json`;
    }

    private getCoverUrl(coverArtId?: string): string | undefined {
        if (!coverArtId) return undefined;
        return `${this.serverUrl}/rest/getCoverArt?id=${coverArtId}&size=300&${this.getAuthParams('static-cover-salt')}`;
    }

    private async fetchApi(endpoint: string, params: Record<string, string | string[] | number | undefined> = {}): Promise<any> {
        if (!this.serverUrl) throw new Error("Navidrome not configured");
        
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                value.forEach(v => searchParams.append(key, String(v)));
            } else {
                searchParams.append(key, String(value));
            }
        }
        const urlParams = searchParams.toString();
        const fullUrl = `${this.serverUrl}/rest/${endpoint}?${this.getAuthParams()}${urlParams ? '&' + urlParams : ''}`;
        
        const res = await tauriFetch(fullUrl, { method: 'GET' });
        const json = await res.json();
        
        if (json['subsonic-response']?.status === 'failed') {
            throw new Error(json['subsonic-response'].error?.message || "Subsonic API Error");
        }
        return json['subsonic-response'];
    }

    async search(query: string): Promise<{ artists: Artist[], tracks: Track[]; albums: Album[]; }> {
        const res = await this.fetchApi('search3', { query, artistCount: '10', songCount: '20', albumCount: '10' });
        const result = res.searchResult3;
        
        const artists: Artist[] = (result?.artist || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            albumCount: a.albumCount,
        }));

        const tracks: Track[] = (result?.song || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            source: 'navidrome',
            genre: s.genre,
            bitrate: s.bitRate,
            year: s.year,
            format: s.suffix,
            isStarred: !!s.starred,
            rating: s.rating,
            coverUrl: this.getCoverUrl(s.coverArt || s.id)
        }));

        const albums: Album[] = (result?.album || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            artist: a.artist,
            artistId: a.artistId,
            year: a.year,
            songCount: a.songCount,
            duration: a.duration,
            coverUrl: this.getCoverUrl(a.coverArt || a.id)
        }));

        return { artists, tracks, albums };
    }

    async getIndexes(): Promise<{ index: string, artists: Artist[] }[]> {
        const res = await this.fetchApi('getIndexes');
        const indices = res.indexes?.index || [];
        return indices.map((idx: any) => ({
            index: idx.name,
            artists: (idx.artist || []).map((a: any) => ({
                id: a.id,
                name: a.name,
                albumCount: a.albumCount
            }))
        }));
    }

    async getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }> {
        const res = await this.fetchApi('getArtist', { id });
        const artist = res.artist;
        if (!artist) throw new Error("Artist not found");
        
        return {
            artist: { id: artist.id, name: artist.name, albumCount: artist.albumCount },
            albums: (artist.album || []).map((a: any) => ({
                id: a.id,
                name: a.name,
                artist: a.artist,
                artistId: a.artistId,
                year: a.year,
                songCount: a.songCount,
                duration: a.duration,
                coverUrl: this.getCoverUrl(a.coverArt || a.id)
            }))
        };
    }

    async getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }> {
        const res = await this.fetchApi('getAlbum', { id });
        const a = res.album;
        if (!a) throw new Error("Album not found");
        
        return {
            album: {
                id: a.id,
                name: a.name,
                artist: a.artist,
                artistId: a.artistId,
                year: a.year,
                songCount: a.songCount,
                duration: a.duration,
                coverUrl: this.getCoverUrl(a.coverArt || a.id)
            },
            tracks: (a.song || []).map((s: any) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                album: s.album,
                duration: s.duration,
                source: 'navidrome',
                genre: s.genre,
                bitrate: s.bitRate,
                year: s.year,
                format: s.suffix,
                isStarred: !!s.starred,
                rating: s.rating,
                coverUrl: this.getCoverUrl(s.coverArt || s.id)
            }))
        };
    }

    async getSong(id: string): Promise<Track> {
        const res = await this.fetchApi('getSong', { id });
        const s = res.song;
        if (!s) throw new Error("Song not found");
        return {
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            source: 'navidrome',
            genre: s.genre,
            bitrate: s.bitRate,
            year: s.year,
            format: s.suffix,
            isStarred: !!s.starred,
            rating: s.rating,
            coverUrl: this.getCoverUrl(s.coverArt || s.id)
        };
    }

    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        const endpoint = star ? 'star' : 'unstar';
        // The API uses id (track), albumId, or artistId based on type. Wait, the docs say:
        // id: A string to star. Multiple parameters allowed. (for song/album/artist depending on sub-parameters, actually it's just 'id' for song, 'albumId' for album, 'artistId' for artist)
        const params: Record<string, string> = {};
        if (type === 'track') params.id = id;
        else if (type === 'album') params.albumId = id;
        else if (type === 'artist') params.artistId = id;
        await this.fetchApi(endpoint, params);
    }

    async setRating(id: string, rating: number): Promise<void> {
        await this.fetchApi('setRating', { id, rating: rating.toString() });
    }

    async getStarred(): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> {
        const res = await this.fetchApi('getStarred2');
        const starred = res.starred2;
        if (!starred) return { artists: [], albums: [], tracks: [] };
        
        return {
            artists: (starred.artist || []).map((a: any) => ({ id: a.id, name: a.name, coverUrl: this.getCoverUrl(a.coverArt || a.id) })),
            albums: (starred.album || []).map((a: any) => ({ id: a.id, name: a.name, artist: a.artist, coverUrl: this.getCoverUrl(a.coverArt || a.id) })),
            tracks: (starred.song || []).map((s: any) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                album: s.album,
                duration: s.duration,
                source: 'navidrome',
                isStarred: true,
                rating: s.rating,
                coverUrl: this.getCoverUrl(s.coverArt || s.id)
            }))
        };
    }

    async getTopAlbums(): Promise<Album[]> {
        const res = await this.fetchApi('getAlbumList', { type: 'newest', size: '20' });
        const albums = res.albumList?.album || [];
        return albums.map((a: any) => ({
            id: a.id,
            name: a.name,
            artist: a.artist,
            year: a.year,
            coverUrl: this.getCoverUrl(a.coverArt || a.id)
        }));
    }

    async getPlaylists(): Promise<Playlist[]> {
        const res = await this.fetchApi('getPlaylists');
        const playlists = res.playlists?.playlist || [];
        return playlists.map((p: any) => ({
            id: p.id,
            name: p.name,
            trackCount: p.songCount,
            coverUrl: this.getCoverUrl(p.coverArt || p.id)
        }));
    }

    async createPlaylist(name: string): Promise<Playlist> {
        const res = await this.fetchApi('createPlaylist', { name });
        return { id: res.playlist.id, name: res.playlist.name, trackCount: res.playlist.songCount || 0 };
    }

    async updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: number[]): Promise<void> {
        const params: Record<string, any> = { playlistId: id };
        if (name) params.name = name;
        if (tracksToAdd && tracksToAdd.length > 0) {
            params.songIdToAdd = tracksToAdd;
        }
        if (tracksToRemove && tracksToRemove.length > 0) {
            params.songIndexToRemove = tracksToRemove;
        }
        await this.fetchApi('updatePlaylist', params);
    }

    async deletePlaylist(id: string): Promise<void> {
        await this.fetchApi('deletePlaylist', { id });
    }

    async getAlbumTracks(albumId: string): Promise<Track[]> {
        const { tracks } = await this.getAlbum(albumId);
        return tracks;
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
            source: 'navidrome',
            genre: s.genre,
            bitrate: s.bitRate,
            year: s.year,
            format: s.suffix,
            isStarred: !!s.starred,
            rating: s.rating,
            coverUrl: this.getCoverUrl(s.coverArt || s.id)
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
                source: 'navidrome',
                genre: s.genre,
                bitrate: s.bitRate,
                year: s.year,
                format: s.suffix,
                isStarred: !!s.starred,
                rating: s.rating,
                coverUrl: this.getCoverUrl(s.coverArt || s.id)
            }));
        } catch {
            return [];
        }
    }

    async getStreamUrl(trackId: string, options?: { maxBitrate?: number, format?: string }): Promise<string> {
        const offlineUrl = offlineManager.getOfflineStreamUrl(trackId);
        if (offlineUrl) return offlineUrl;

        let url = `${this.serverUrl}/rest/stream?id=${trackId}&${this.getAuthParams()}`;
        if (options?.maxBitrate) url += `&maxBitRate=${options.maxBitrate}`;
        if (options?.format) url += `&format=${options.format}`;
        return url;
    }

    async downloadTrack(trackId: string): Promise<void> {
        const track = await this.getSong(trackId);
        let url = `${this.serverUrl}/rest/stream?id=${trackId}&${this.getAuthParams()}`;
        
        // Let's assume original format if possible, or fallback to mp3
        const filename = `${track.title} - ${track.artist}.${track.format || 'mp3'}`;
        await offlineManager.downloadTrack(url, track, filename);
    }

    async getCoverArt(trackId: string): Promise<string | undefined> {
        return this.getCoverUrl(trackId);
    }

    async getLyrics(track: Track): Promise<string | null> {
        try {
            // First try the modern OpenSubsonic getLyricsBySongId
            try {
                const res = await this.fetchApi('getLyricsBySongId', { id: track.id });
                
                // OpenSubsonic can return either 'lyrics' or 'structuredLyrics' depending on version/server
                const list = res.lyricsList?.lyrics || res.lyricsList?.structuredLyrics;
                
                if (list && list.length > 0) {
                    // Find synced lyrics if possible, otherwise use the first one
                    const match = list.find((l: any) => l.synced) || list[0];
                    if (match?.value) return match.value;
                    
                    // If it returns structured lines instead of a single value string
                    if (match?.line && Array.isArray(match.line)) {
                        // Reconstruct LRC from structured lines
                        return match.line.map((l: any) => {
                            const totalMs = l.start || 0;
                            const min = Math.floor(totalMs / 60000);
                            const sec = Math.floor((totalMs % 60000) / 1000);
                            const ms = Math.floor((totalMs % 1000) / 10);
                            return `[${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]${l.value || ''}`;
                        }).join('\n');
                    }
                }
            } catch {
                // Ignore and fallback to legacy getLyrics
            }

            // Fallback to legacy getLyrics by artist/title
            if (!track.artist || !track.title) return null;
            const res = await this.fetchApi('getLyrics', { artist: track.artist, title: track.title });
            return res.lyrics?.value || null;
        } catch {
            return null;
        }
    }
}
