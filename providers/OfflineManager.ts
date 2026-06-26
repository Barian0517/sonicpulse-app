import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Track } from './MusicProvider';

export interface OfflineTrackData {
    path: string;
    track: Track;
}

export class OfflineManager {
    private downloadedTracks: Set<string> = new Set();
    private trackCache: Map<string, OfflineTrackData> = new Map();

    async init() {
        // Load the set of downloaded tracks from local storage
        const cached = localStorage.getItem('offline_tracks_data');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                Object.entries(parsed).forEach(([id, data]) => {
                    this.downloadedTracks.add(id);
                    this.trackCache.set(id, data as OfflineTrackData);
                });
            } catch (e) {
                console.error("Failed to parse offline track cache");
            }
        }
    }

    private saveCache() {
        const obj = Object.fromEntries(this.trackCache);
        localStorage.setItem('offline_tracks_data', JSON.stringify(obj));
    }

    isDownloaded(trackId: string): boolean {
        return this.downloadedTracks.has(trackId);
    }

    getDownloadedTracks(): Track[] {
        return Array.from(this.trackCache.values()).map(d => d.track);
    }

    async downloadTrack(url: string, track: Track, fileName: string): Promise<string> {
        try {
            // Add extension if missing
            if (!fileName.includes('.')) fileName += '.mp3';

            const savedPath: string = await invoke('download_file', {
                url,
                albumName: track.album,
                fileName
            });

            this.downloadedTracks.add(track.id);
            this.trackCache.set(track.id, { path: savedPath, track });
            this.saveCache();

            return savedPath;
        } catch (e) {
            console.error("Failed to download track", e);
            throw e;
        }
    }

    getOfflineStreamUrl(trackId: string): string | undefined {
        const data = this.trackCache.get(trackId);
        if (data && data.path) {
            return convertFileSrc(data.path);
        }
        return undefined;
    }
}

export const offlineManager = new OfflineManager();
