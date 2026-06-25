export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number; // in seconds
    coverUrl?: string; // URL or data URI
    streamUrl?: string; // Local file path or API stream URL
    source: 'local' | 'navidrome';
}

export interface Album {
    id: string;
    name: string;
    artist: string;
    coverUrl?: string;
    year?: number;
}

export interface Playlist {
    id: string;
    name: string;
    trackCount: number;
    coverUrl?: string;
}

export interface MusicProvider {
    name: string;
    
    // Core methods
    search(query: string): Promise<{ tracks: Track[], albums: Album[] }>;
    
    // Browsing
    getTopAlbums(): Promise<Album[]>;
    getPlaylists(): Promise<Playlist[]>;
    
    // Detailed retrieval
    getAlbumTracks(albumId: string): Promise<Track[]>;
    getPlaylistTracks(playlistId: string): Promise<Track[]>;
    getTracks(): Promise<Track[]>; // All tracks (mostly useful for local)

    // Playback
    getStreamUrl(trackId: string): Promise<string>;
    getCoverArt(trackId: string): Promise<string | undefined>;
    
    // Lyrics
    getLyrics(trackId: string): Promise<string | null>;
}
