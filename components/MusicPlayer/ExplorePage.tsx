import React, { useState, useEffect } from 'react';
import { MusicProvider, Track } from '../../providers/MusicProvider';
import { TrackList } from './TrackList';

export const ExplorePage: React.FC<{
    provider: MusicProvider;
    onPlayTrack: (track: Track) => void;
    onPlayNow?: (tracks: Track[], startIndex?: number) => void;
    onPlayNext?: (tracks: Track[]) => void;
    onAddToQueue?: (tracks: Track[]) => void;
}> = ({ provider, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue }) => {
    const [recentTracks, setRecentTracks] = useState<Track[]>([]);
    const [frequentTracks, setFrequentTracks] = useState<Track[]>([]);
    const [randomTracks, setRandomTracks] = useState<Track[]>([]);

    useEffect(() => {
        // Here we ideally want to fetch 'recently played', 'most played', 'random'
        // But provider.getTracks() or similar methods need options for these.
        // Let's assume we can fetch random tracks for now or use the generic getTracks
        const fetchExplore = async () => {
            try {
                // To properly implement Explore, we need specific Subsonic API calls like getRandomSongs, getTopSongs, etc.
                // We will just use getTracks for now and pretend for the UI placeholder.
                const random = await provider.getTracks(); // TODO: Add 'type=random' support to NavidromeProvider
                setRandomTracks(random.slice(0, 10));
            } catch (e) {
                console.error(e);
            }
        };
        fetchExplore();
    }, [provider]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">Recommended for You</h2>
                <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-2xl p-8 border border-white/5">
                    <h3 className="text-xl font-bold mb-2 text-white">Daily Mix</h3>
                    <p className="text-sm text-gray-400 mb-6">A personalized mix of tracks based on your listening history.</p>
                    <button className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-purple-500/30 transition-all active:scale-95">
                        Play Mix
                    </button>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">Random Discovery</h2>
                <TrackList 
                    tracks={randomTracks} 
                    provider={provider} 
                    onPlayTrack={onPlayTrack} 
                    onPlayNow={onPlayNow}
                    onPlayNext={onPlayNext}
                    onAddToQueue={onAddToQueue}
                />
            </div>
        </div>
    );
};
