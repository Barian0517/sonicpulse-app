import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Shuffle, Plus, ListPlus, Loader2 } from 'lucide-react';
import { MusicProvider, Track, Playlist } from '@/providers/MusicProvider';
import { TrackList } from './TrackList';
import { useTranslation } from '@/providers/I18nProvider';

export const PlaylistDetailsView: React.FC<{
    playlist: Playlist;
    provider: MusicProvider;
    onBack: () => void;
    onPlayTrack: (track: Track) => void;
    onPlayNow?: (tracks: Track[], startIndex?: number) => void;
    onPlayNext?: (tracks: Track[]) => void;
    onAddToQueue?: (tracks: Track[]) => void;
    currentTrackId?: string;
    isPlaying: boolean;
}> = ({ playlist, provider, onBack, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue, currentTrackId, isPlaying }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { t } = useTranslation();

    useEffect(() => {
        loadTracks();
    }, [playlist.id]);

    const loadTracks = async () => {
        setIsLoading(true);
        try {
            const list = await provider.getPlaylistTracks(playlist.id);
            setTracks(list);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveFromPlaylist = async (track: Track, index: number) => {
        try {
            await provider.updatePlaylist(playlist.id, undefined, undefined, [index]);
            // Reload tracks after removal
            loadTracks();
        } catch (e) {
            console.error('Failed to remove track from playlist', e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('common.error') || '移除失敗' }));
        }
    };

    return (
        <div className="flex flex-col h-full animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-start gap-6 p-6 pb-2 shrink-0">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-3xl font-black mb-2">{playlist.name}</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">
                        {t('playlist.trackCount', { count: tracks.length })}
                    </p>
                    <div className="flex items-center gap-3">
                        <button 
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 active:scale-95"
                            onClick={() => {
                                if (tracks.length > 0) {
                                    if (onPlayNow) onPlayNow(tracks, 0);
                                    else onPlayTrack(tracks[0]);
                                }
                            }}
                        >
                            <Play size={18} fill="currentColor" /> {t('netease.playAll')}
                        </button>
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all"
                            onClick={() => {
                                if (tracks.length > 0) {
                                    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                                    if (onPlayNow) onPlayNow(shuffled, 0);
                                    else onPlayTrack(shuffled[0]);
                                }
                            }}
                            title={t('player.shuffle')}
                        >
                            <Shuffle size={18} />
                        </button>
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all"
                            onClick={() => {
                                if (tracks.length > 0 && onAddToQueue) {
                                    onAddToQueue(tracks);
                                }
                            }}
                            title={t('player.addToQueue')}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : (
                    <TrackList 
                        tracks={tracks} 
                        provider={provider} 
                        onPlayTrack={onPlayTrack} 
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                        onRemoveFromPlaylist={handleRemoveFromPlaylist}
                        currentTrackId={currentTrackId} 
                        isPlaying={isPlaying} 
                    />
                )}
            </div>
        </div>
    );
};
