import { Track, Album, Artist, Playlist, MusicProvider } from './MusicProvider';

export class MusicFreeProvider implements MusicProvider {
    name = 'MusicFree';
    isReady = true;
    
    // We store the selected plugin ID here
    pluginId: string = '';

    setPlugin(id: string) {
        this.pluginId = id;
    }

    private async callPlugin(method: string, args: any[] = []): Promise<any> {
        if (!this.pluginId) throw new Error("No plugin selected");
        
        const res = await fetch('http://127.0.0.1:30001/plugin/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: this.pluginId,
                method,
                args
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Failed to call ${method}`);
        }
        
        const data = await res.json();
        return data.data;
    }

    async getPlugins(): Promise<any[]> {
        const res = await fetch(`http://127.0.0.1:30001/plugins`);
        if (!res.ok) throw new Error('Failed to fetch plugins');
        return await res.json();
    }

    async installNetworkPlugin(url: string): Promise<any> {
        const res = await fetch(`http://127.0.0.1:30001/plugin/install/url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error('Failed to install plugin');
        return await res.json();
    }

    async installLocalPlugin(filePath: string): Promise<any> {
        const res = await fetch(`http://127.0.0.1:30001/plugin/install/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
        if (!res.ok) throw new Error('Failed to install plugin');
        return await res.json();
    }

    async uninstallPlugin(id: string): Promise<any> {
        const res = await fetch(`http://127.0.0.1:30001/plugin/uninstall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error('Failed to uninstall plugin');
        return await res.json();
    }

    async saveVariables(id: string, variables: Record<string, string>): Promise<any> {
        const res = await fetch(`http://127.0.0.1:30001/plugin/variables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, variables })
        });
        if (!res.ok) throw new Error('Failed to save variables');
        return await res.json();
    }

    async search(query: string): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> {
        // search(query: string, page: number, type: 'music' | 'album' | 'artist')
        const result = await this.callPlugin('search', [query, 1, 'music']);
        
        let tracks: Track[] = [];
        if (result && result.data && Array.isArray(result.data)) {
            tracks = result.data.map((item: any) => ({
                id: String(item.id),
                title: item.title,
                artist: item.artist,
                album: item.album,
                duration: item.duration || 0,
                coverUrl: item.artwork || item.pic || item.cover,
                source: 'musicfree',
                pluginItem: item,
                _pluginId: this.pluginId
            }));
        }
        
        return { artists: [], albums: [], tracks };
    }

    async searchAll(query: string, pluginIds: string[]): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> {
        const promises = pluginIds.map(async id => {
            try {
                const res = await fetch(`http://127.0.0.1:30001/plugin/call`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id,
                        method: 'search',
                        args: [query, 1, 'music']
                    })
                });
                if (!res.ok) return [];
                const data = await res.json();
                if (data && data.data && data.data.data && Array.isArray(data.data.data)) {
                    return data.data.data.map((item: any) => ({
                        id: String(item.id),
                        title: item.title,
                        artist: item.artist,
                        album: item.album,
                        duration: item.duration || 0,
                        coverUrl: item.artwork || item.pic || item.cover,
                        source: 'musicfree',
                        pluginItem: item,
                        _pluginId: id
                    }));
                }
                return [];
            } catch (e) {
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allTracks = results.flat() as Track[];

        // Scoring algorithm:
        // 1. Exact title match gets a huge boost
        // 2. Exact artist match gets a boost
        // 3. Fallback to original order from the plugin (usually sorted by relevance)
        const qLower = query.toLowerCase();
        
        allTracks.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            
            const titleA = String(a.title || '').toLowerCase();
            const titleB = String(b.title || '').toLowerCase();
            const artistA = String(a.artist || '').toLowerCase();
            const artistB = String(b.artist || '').toLowerCase();
            
            if (titleA === qLower) scoreA += 100;
            else if (titleA.includes(qLower)) scoreA += 50;
            
            if (titleB === qLower) scoreB += 100;
            else if (titleB.includes(qLower)) scoreB += 50;

            if (artistA === qLower) scoreA += 80;
            else if (artistA.includes(qLower)) scoreA += 40;

            if (artistB === qLower) scoreB += 80;
            else if (artistB.includes(qLower)) scoreB += 40;

            return scoreB - scoreA;
        });

        // Deduplicate slightly by ID and title to avoid overwhelming exact duplicates
        const seen = new Set();
        const uniqueTracks = allTracks.filter(t => {
            const key = `${t.id}-${t.title}-${t.artist}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { artists: [], albums: [], tracks: uniqueTracks };
    }

    async getStreamUrl(trackId: string, trackInfo?: any): Promise<string> {
        // getMediaSource(musicItem, quality)
        const quality = 'standard';
        
        // We need the raw item to get media source in MusicFree. 
        // We attached it to the track object during search!
        if (!trackInfo || !trackInfo.pluginItem) {
            // fallback: fake a musicItem with just id
            trackInfo = { pluginItem: { id: trackId } };
        }
        
        // If trackInfo has _pluginId, temporarily set it to call the correct plugin
        const originalId = this.pluginId;
        if (trackInfo._pluginId) this.pluginId = trackInfo._pluginId;
        
        try {
            const res = await this.callPlugin('getMediaSource', [trackInfo.pluginItem, quality]);
            if (res && res.url) {
                return res.url;
            }
        } finally {
            this.pluginId = originalId;
        }
        throw new Error("Could not get stream URL");
    }

    async getLyric(trackId: string, trackInfo?: any): Promise<{ rawLrc: string, lrc?: string }> {
        if (!trackInfo || !trackInfo.pluginItem) {
            trackInfo = { pluginItem: { id: trackId } };
        }
        
        const originalId = this.pluginId;
        if (trackInfo._pluginId) this.pluginId = trackInfo._pluginId;

        try {
            const res = await this.callPlugin('getLyric', [trackInfo.pluginItem]);
            if (res) {
                return { rawLrc: res.lrc || res.rawLrc || '' };
            }
        } finally {
            this.pluginId = originalId;
        }
        return { rawLrc: '' };
    }

    // Unimplemented MusicProvider methods
    async getTracks(): Promise<Track[]> { return []; }
    async getAlbums(): Promise<Album[]> { return []; }
    async getArtists(): Promise<Artist[]> { return []; }
    async getPlaylists(): Promise<Playlist[]> { return []; }
    async getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }> { throw new Error('Not implemented'); }
    async getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }> { throw new Error('Not implemented'); }
    async getTopAlbums(): Promise<Album[]> { return []; }
    async getIndexes(): Promise<{ index: string, artists: Artist[] }[]> { return []; }
    async getSong(id: string): Promise<Track> { 
        const res = await this.getStarred();
        const track = res.tracks.find(t => t.id === id);
        if (track) return track;
        throw new Error('Not implemented'); 
    }
    
    private getStorageKey(): string {
        return `sonicpulse_musicfree_favorites`;
    }

    async star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void> {
        if (type !== 'track') return;
        // In order to save a track, we need its full data.
        // Wait, star only takes an ID. If we don't have the track object, we can't save its metadata easily.
        // Let's assume App.tsx will pass the track object inside localStorage manually? 
        // No, MusicProvider interface's star() only takes ID.
        // I will implement a custom way or just handle it in MusicFreeView/App.
    }
    async setRating(id: string, rating: number): Promise<void> {}
    async createPlaylist(name: string): Promise<Playlist> { throw new Error('Not implemented'); }
    async updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: number[]): Promise<void> {}
    async deletePlaylist(id: string): Promise<void> {}
    async getPlaylistTracks(playlistId: string): Promise<Track[]> { return []; }
    async getAlbumTracks(albumId: string): Promise<Track[]> { return []; }
    async getCoverArt(trackId: string): Promise<string | undefined> { return undefined; }
    async downloadTrack(trackId: string): Promise<void> {}
    async getLyrics(track: Track): Promise<string | null> {
        const res = await this.getLyric(track.id, { pluginItem: (track as any).pluginItem });
        return res.rawLrc || null;
    }
    async getStarred(): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }> { 
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (raw) {
                return { artists: [], albums: [], tracks: JSON.parse(raw) };
            }
        } catch (e) {
            console.error("Failed to parse musicfree favorites", e);
        }
        return { artists: [], albums: [], tracks: [] }; 
    }
    
    // Custom method to save full track since star() only takes ID
    async toggleStarTrack(track: Track): Promise<boolean> {
        const { tracks } = await this.getStarred();
        const idx = tracks.findIndex(t => t.id === track.id);
        let isStarred = false;
        if (idx >= 0) {
            tracks.splice(idx, 1);
            isStarred = false;
        } else {
            tracks.push(track);
            isStarred = true;
        }
        localStorage.setItem(this.getStorageKey(), JSON.stringify(tracks));
        return isStarred;
    }
}
