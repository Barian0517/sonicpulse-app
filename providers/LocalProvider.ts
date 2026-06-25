import { invoke } from '@tauri-apps/api/core';
import { MusicProvider, Track, Album, Playlist } from './MusicProvider';

interface RustTrackMetadata {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration_sec: number;
    file_path: string;
    has_cover: boolean;
}

export class LocalProvider implements MusicProvider {
    name = 'Local';
    private tracks: Track[] = [];
    private albumsMap: Map<string, Album> = new Map();
    private isScanned = false;

    async init(directory: string): Promise<void> {
        try {
            const rawTracks: RustTrackMetadata[] = await invoke('scan_local_music', { path: directory });
            
            this.tracks = rawTracks.map(raw => ({
                id: raw.id,
                title: raw.title,
                artist: raw.artist,
                album: raw.album,
                duration: raw.duration_sec,
                streamUrl: raw.file_path,
                source: 'local',
                coverUrl: undefined // fetch on demand
            }));

            // Group into albums
            this.albumsMap.clear();
            for (const track of this.tracks) {
                const albumId = track.album || 'Unknown Album';
                if (!this.albumsMap.has(albumId)) {
                    this.albumsMap.set(albumId, {
                        id: albumId,
                        name: albumId,
                        artist: track.artist,
                    });
                }
            }

            this.isScanned = true;
        } catch (e) {
            console.error("LocalProvider scan failed", e);
            throw e;
        }
    }

    async search(query: string): Promise<{ tracks: Track[]; albums: Album[]; }> {
        const lower = query.toLowerCase();
        const tracks = this.tracks.filter(t => 
            t.title.toLowerCase().includes(lower) || 
            t.artist.toLowerCase().includes(lower) || 
            t.album.toLowerCase().includes(lower)
        );
        const albums = Array.from(this.albumsMap.values()).filter(a => 
            a.name.toLowerCase().includes(lower) || 
            a.artist.toLowerCase().includes(lower)
        );
        return { tracks, albums };
    }

    async getTopAlbums(): Promise<Album[]> {
        return Array.from(this.albumsMap.values());
    }

    async getPlaylists(): Promise<Playlist[]> {
        return []; // Local playlists not implemented yet
    }

    async getAlbumTracks(albumId: string): Promise<Track[]> {
        return this.tracks.filter(t => (t.album || 'Unknown Album') === albumId);
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        return [];
    }

    async getTracks(): Promise<Track[]> {
        return this.tracks;
    }

    async getStreamUrl(trackId: string): Promise<string> {
        // Tauri requires custom protocol to load local files, e.g., tauri://localhost/
        // Wait, convertFileSrc from @tauri-apps/api/core can be used
        // But for Web Audio API context, maybe convertFileSrc works. Let's return raw path for now, App.tsx will process it.
        const track = this.tracks.find(t => t.id === trackId);
        return track?.streamUrl || '';
    }

    async getCoverArt(trackId: string): Promise<string | undefined> {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track || !track.streamUrl) return undefined;
        try {
            const base64Cover: string | null = await invoke('get_cover_art', { filePath: track.streamUrl });
            if (base64Cover) {
                // cache it
                track.coverUrl = base64Cover;
                return base64Cover;
            }
        } catch (e) {
            console.error("Failed to load cover", e);
        }
        return undefined;
    }

    async getLyrics(trackId: string): Promise<string | null> {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track || !track.streamUrl) return null;
        try {
            const lrc: string | null = await invoke('read_lrc_file', { filePath: track.streamUrl });
            return lrc;
        } catch (e) {
            console.error("Failed to load LRC", e);
        }
        return null;
    }
}
