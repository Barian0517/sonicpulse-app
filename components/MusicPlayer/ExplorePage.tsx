import React, { useState, useEffect } from 'react';
import { MusicProvider, Track } from '../../providers/MusicProvider';
import { TrackList } from './TrackList';
import { Heart, Play, Music } from 'lucide-react';
import { useTranslation } from '../../providers/I18nProvider';

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
    const [neteaseRecommendations, setNeteaseRecommendations] = useState<Track[]>([]);
    const { t } = useTranslation();

    // Trigger re-render when liked songs update
    const [, forceUpdate] = useState({});
    useEffect(() => {
        const handleUpdate = () => forceUpdate({});
        window.addEventListener('sonicpulse-liked-songs-updated', handleUpdate);
        return () => window.removeEventListener('sonicpulse-liked-songs-updated', handleUpdate);
    }, []);

    useEffect(() => {
        // Here we ideally want to fetch 'recently played', 'most played', 'random'
        // But provider.getTracks() or similar methods need options for these.
        // Let's assume we can fetch random tracks for now or use the generic getTracks
        const fetchExplore = async () => {
            try {
                if (provider.name === 'Netease Cloud Music') {
                    // Try to fetch liked songs and similar
                    try {
                        const liked = await provider.getStarred();
                        if (liked.tracks && liked.tracks.length > 0) {
                            const randomIndex = Math.floor(Math.random() * liked.tracks.length);
                            const randomLiked = liked.tracks[randomIndex];
                            const similar = await (provider as any).getSimilarSongs(randomLiked.id);
                            
                            // Try to shuffle similar songs if there are many
                            const shuffledSimilar = [...similar].sort(() => 0.5 - Math.random());
                            setNeteaseRecommendations([randomLiked, ...shuffledSimilar.slice(0, 5)]);
                        }
                    } catch(e) { console.error("Failed to fetch netease recommendations", e); }
                }

                // To properly implement Explore, we need specific Subsonic API calls like getRandomSongs, getTopSongs, etc.
                // We will just use getTracks for now and pretend for the UI placeholder.
                const random = await provider.getTracks(); // TODO: Add 'type=random' support to NavidromeProvider
                const shuffledRandom = [...random].sort(() => 0.5 - Math.random());
                setRandomTracks(shuffledRandom.slice(0, 10));
            } catch (e) {
                console.error(e);
            }
        };
        fetchExplore();
    }, [provider]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">{t('explore.recommendedForYou')}</h2>
                <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-2xl p-8 border border-white/5">
                    <h3 className="text-xl font-bold mb-2 text-white">{t('explore.dailyMix')}</h3>
                    <p className="text-sm text-gray-400 mb-6">{t('explore.dailyMixDesc')}</p>
                    <button className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-purple-500/30 transition-all active:scale-95">
                        {t('explore.playMix')}
                    </button>
                </div>
            </div>

            {neteaseRecommendations.length > 0 && (
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold text-white">{t('explore.likedAndSimilar')}</h2>
                        <button 
                            onClick={() => onPlayNow && onPlayNow(neteaseRecommendations)}
                            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                        >
                            <Play size={12} fill="currentColor" />
                            {t('explore.playAll')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {neteaseRecommendations.map((track, idx) => (
                            <div 
                                key={track.id + '-' + idx} 
                                className="group flex items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors relative"
                                onClick={() => onPlayNow && onPlayNow([track])}
                            >
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 shadow-md">
                                    {track.coverUrl ? (
                                        <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                            <Music size={24} className="text-gray-500" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play size={24} className="text-white" fill="currentColor" />
                                    </div>
                                </div>
                                
                                <div className="ml-4 flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="text-sm font-bold text-white truncate mb-1">{track.title}</h4>
                                    <div className="flex items-center gap-2">
                                        {((window as any).__sonicpulse_liked_ids || []).includes(track.id) && <Heart size={12} className="text-red-500 fill-red-500 shrink-0" />}
                                        <span className="text-[10px] text-[#e8b548] border border-[#e8b548]/30 px-1 rounded uppercase tracking-wider shrink-0 font-bold bg-[#e8b548]/10">{t('explore.hqMaster')}</span>
                                        <span className="text-xs text-gray-400 truncate">{track.artist}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-2xl font-bold mb-4">{t('explore.randomDiscovery')}</h2>
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
