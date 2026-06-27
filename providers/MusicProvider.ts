export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number; // in seconds
    coverUrl?: string; // URL or data URI
    streamUrl?: string; // Local file path or API stream URL
    source: 'local' | 'navidrome' | 'netease' | 'musicfree';
    genre?: string;
    bitrate?: number;
    year?: number;
    format?: string;
    isStarred?: boolean;
    rating?: number; // 1-5
}

export interface Artist {
    id: string;
    name: string;
    albumCount?: number;
    coverUrl?: string;
}

export interface Album {
    id: string;
    name: string;
    artist: string;
    artistId?: string;
    coverUrl?: string;
    year?: number;
    songCount?: number;
    duration?: number;
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
    search(query: string): Promise<{ artists: Artist[], tracks: Track[], albums: Album[] }>;
    
    // Browsing & Hierarchy
    getTopAlbums(): Promise<Album[]>;
    getIndexes(): Promise<{ index: string, artists: Artist[] }[]>;
    getArtist(id: string): Promise<{ artist: Artist, albums: Album[] }>;
    getAlbum(id: string): Promise<{ album: Album, tracks: Track[] }>;
    getSong(id: string): Promise<Track>;
    
    // Personalization
    star(id: string, type: 'track' | 'album' | 'artist', star: boolean): Promise<void>;
    setRating(id: string, rating: number): Promise<void>;
    getStarred(): Promise<{ artists: Artist[], albums: Album[], tracks: Track[] }>;
    
    // Playlists
    getPlaylists(): Promise<Playlist[]>;
    createPlaylist(name: string): Promise<Playlist>;
    updatePlaylist(id: string, name?: string, tracksToAdd?: string[], tracksToRemove?: number[]): Promise<void>;
    deletePlaylist(id: string): Promise<void>;
    getPlaylistTracks(playlistId: string): Promise<Track[]>;
    
    // Detailed retrieval
    getAlbumTracks(albumId: string): Promise<Track[]>;
    getTracks(): Promise<Track[]>; // All tracks (mostly useful for local or random fetch)

    // Playback
    getStreamUrl(trackId: string, options?: { maxBitrate?: number, format?: string }): Promise<string>;
    getCoverArt(trackId: string): Promise<string | undefined>;
    
    // Offline
    downloadTrack(trackId: string): Promise<void>;
    
    // Lyrics
    getLyrics(track: Track): Promise<string | null>;
}
