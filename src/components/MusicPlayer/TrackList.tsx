import React, { useState, useEffect } from 'react';
import { Music2, Play, Heart, DownloadCloud, CheckCircle2, Star, MoreHorizontal, Plus } from 'lucide-react';
import { MusicProvider, Track, Playlist } from '@/providers/MusicProvider';
import { offlineManager } from '@/providers/OfflineManager';
import { useTranslation } from '@/providers/I18nProvider';

export const TrackList: React.FC<{
    tracks: Track[];
    provider: MusicProvider;
    onPlayTrack: (track: Track) => void;
    onPlayNow?: (tracks: Track[], startIndex?: number) => void;
    onPlayNext?: (tracks: Track[]) => void;
    onAddToQueue?: (tracks: Track[]) => void;
    onRemoveFromPlaylist?: (track: Track, index: number) => void;
    currentTrackId?: string;
    isPlaying?: boolean;
}> = ({ tracks, provider, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue, onRemoveFromPlaylist, currentTrackId, isPlaying }) => {
    // Keep local states for star/rating/download to update UI immediately
    const [starredStatus, setStarredStatus] = useState<Record<string, boolean>>({});
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [downloadStatus, setDownloadStatus] = useState<Record<string, 'none' | 'downloading' | 'downloaded'>>({});
    
    // Context Menu State
    const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [showPlaylists, setShowPlaylists] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        // Fetch playlists for the "Add to Playlist" sub-menu
        provider.getPlaylists().then(setPlaylists).catch(console.error);
        
        const handleClickOutside = () => {
            setMenuTrackId(null);
            setShowPlaylists(false);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [provider]);

    useEffect(() => {
        // Initialize state from track data
        const initialStar: Record<string, boolean> = {};
        const initialRating: Record<string, number> = {};
        const initialDownload: Record<string, 'none' | 'downloading' | 'downloaded'> = {};

        // Sync with Netease global liked ids if applicable
        const likedSet = new Set((window as any).__sonicpulse_liked_ids || []);
        const isNetease = provider.name === 'Netease Cloud Music';

        tracks.forEach(t => {
            initialStar[t.id] = isNetease ? likedSet.has(t.id) : (t.isStarred || false);
            initialRating[t.id] = t.rating || 0;
            if (offlineManager.isDownloaded(t.id)) {
                initialDownload[t.id] = 'downloaded';
            } else {
                initialDownload[t.id] = 'none';
            }
        });
        setStarredStatus(initialStar);
        setRatings(initialRating);
        setDownloadStatus(initialDownload);
    }, [tracks, provider]);

    useEffect(() => {
        const syncLikedSongs = () => {
            if (provider.name !== 'Netease Cloud Music') return;
            const likedSet = new Set((window as any).__sonicpulse_liked_ids || []);
            setStarredStatus(prev => {
                const next = { ...prev };
                tracks.forEach(t => {
                    next[t.id] = likedSet.has(t.id);
                });
                return next;
            });
        };
        window.addEventListener('sonicpulse-liked-songs-updated', syncLikedSongs);
        return () => window.removeEventListener('sonicpulse-liked-songs-updated', syncLikedSongs);
    }, [tracks, provider]);

    const handleToggleStar = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        const current = starredStatus[track.id];
        // Optimistic UI update
        setStarredStatus(prev => ({ ...prev, [track.id]: !current }));
        try {
            if (provider.name === 'Netease Cloud Music') {
                const ok = await (provider as any).likeSong(track.id, !current);
                if (ok) {
                    window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: !current ? t('player.addLike') : t('player.cancelLike') }));
                    
                    // Update global cache
                    const ids = new Set((window as any).__sonicpulse_liked_ids || []);
                    if (!current) ids.add(track.id);
                    else ids.delete(track.id);
                    (window as any).__sonicpulse_liked_ids = Array.from(ids);
                    
                    window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated'));
                } else {
                    window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('common.error') || "加入紅心失敗" }));
                    setStarredStatus(prev => ({ ...prev, [track.id]: current })); // Revert
                }
            } else {
                await provider.star(track.id, 'track', !current);
            }
        } catch (err) {
            console.error("Failed to star", err);
            // Revert on failure
            setStarredStatus(prev => ({ ...prev, [track.id]: current }));
        }
    };

    const handleSetRating = async (e: React.MouseEvent, track: Track, rating: number) => {
        e.stopPropagation();
        const current = ratings[track.id];
        setRatings(prev => ({ ...prev, [track.id]: rating }));
        try {
            await provider.setRating(track.id, rating);
        } catch (err) {
            console.error("Failed to set rating", err);
            setRatings(prev => ({ ...prev, [track.id]: current }));
        }
    };

    const handleDownload = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        if (downloadStatus[track.id] === 'downloaded' || downloadStatus[track.id] === 'downloading') return;
        
        setDownloadStatus(prev => ({ ...prev, [track.id]: 'downloading' }));
        try {
            await provider.downloadTrack(track.id);
            setDownloadStatus(prev => ({ ...prev, [track.id]: 'downloaded' }));
        } catch (err) {
            console.error("Failed to download", err);
            setDownloadStatus(prev => ({ ...prev, [track.id]: 'none' }));
        }
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "0:00";
        if (time > 10000) time = Math.floor(time / 1000);
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleContextMenu = (e: React.MouseEvent, track: Track) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuTrackId(track.id);
        setMenuPosition({ x: e.clientX, y: e.clientY });
        setShowPlaylists(false);
    };

    return (
        <div className="flex flex-col gap-2 relative">
            {tracks.map((track, idx) => {
                const isCurrent = currentTrackId === track.id;
                const isDownloaded = downloadStatus[track.id] === 'downloaded';
                const isDownloading = downloadStatus[track.id] === 'downloading';
                const isStarred = starredStatus[track.id];
                const rating = ratings[track.id] || 0;

                return (
                    <div 
                        key={track.id} 
                        className={`group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${isCurrent ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'hover:bg-white/5 text-gray-300'}`}
                        onClick={() => {
                            onPlayTrack(track);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, track)}
                    >
                        <div className="w-10 h-10 bg-white/10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-gray-500" />}
                            
                            {/* Overlay Play Icon on Hover */}
                            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                {isCurrent && isPlaying ? (
                                    <div className="flex gap-1">
                                        <div className="w-1 h-3 bg-purple-400 animate-pulse"></div>
                                        <div className="w-1 h-3 bg-purple-400 animate-pulse delay-75"></div>
                                        <div className="w-1 h-3 bg-purple-400 animate-pulse delay-150"></div>
                                    </div>
                                ) : (
                                    <Play size={16} className="text-white ml-1" fill="currentColor" />
                                )}
                            </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className={`font-bold text-sm truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>{track.title}</div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-[10px] md:text-xs text-gray-500 truncate">{track.artist}</span>
                                {track.format && <span className="text-[9px] uppercase bg-white/10 px-1 md:px-1.5 py-0.5 rounded text-gray-400 hidden sm:inline-block">{track.format}</span>}
                                {track.bitrate && <span className="text-[9px] uppercase bg-white/10 px-1 md:px-1.5 py-0.5 rounded text-gray-400 hidden sm:inline-block">{track.bitrate} kbps</span>}
                            </div>
                        </div>

                        {/* Interactive Actions */}
                        <div className="hidden md:flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {/* 5-Star Rating (Hover to reveal full 5 stars, otherwise show average/current if rated, but here we just show an interactive 5-star row) */}
                            <div className="flex items-center gap-0.5">
                                {[1,2,3,4,5].map(r => (
                                    <Star 
                                        key={r}
                                        size={14} 
                                        onClick={(e) => handleSetRating(e, track, rating === r ? 0 : r)}
                                        className={`cursor-pointer transition-colors hover:text-yellow-400 hover:scale-125 ${rating >= r ? 'text-yellow-500' : 'text-gray-600'} ${rating >= r ? 'fill-yellow-500' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Always visible actions or indicators */}
                        <div className="flex items-center gap-1 md:gap-3 shrink-0">
                            <button onClick={(e) => handleToggleStar(e, track)} className={`p-1.5 md:p-0 hover:scale-110 transition-transform ${isStarred ? 'text-red-500' : 'text-gray-600 hover:text-white'}`} title={isStarred ? t('player.cancelLike') : t('player.addLike')}>
                                <Heart size={16} fill={isStarred ? "currentColor" : "none"} />
                            </button>

                            <button onClick={(e) => handleDownload(e, track)} className={`p-1.5 md:p-0 hidden sm:block hover:scale-110 transition-transform ${isDownloaded ? 'text-green-500' : isDownloading ? 'text-blue-400 animate-bounce' : 'text-gray-600 hover:text-white'}`} title={isDownloaded ? t('player.downloaded') : t('player.downloadForOffline')}>
                                {isDownloaded ? <CheckCircle2 size={16} /> : <DownloadCloud size={16} />}
                            </button>
                            
                            <button onClick={(e) => handleContextMenu(e, track)} className="text-gray-600 hover:text-white hover:scale-110 transition-transform p-1.5 md:p-1">
                                <MoreHorizontal className="w-[18px] h-[18px] md:w-4 md:h-4" />
                            </button>

                            <div className="text-xs text-gray-500 w-12 text-right hidden sm:block">
                                {formatTime(track.duration)}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Context Menu Dropdown */}
            {menuTrackId && (
                <div 
                    className="fixed z-50 bg-[#151520] border border-white/10 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-xl text-sm"
                    style={{ left: Math.max(10, menuPosition.x - 220), top: Math.min(menuPosition.y, window.innerHeight - 300) }}
                    onClick={e => e.stopPropagation()}
                >
                    {!showPlaylists ? (
                        <>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t) onPlayTrack(t);
                                setMenuTrackId(null);
                            }}>
                                <Play size={16} /> {t('player.play')}
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t && onPlayNext) {
                                    onPlayNext([t]);
                                    setMenuTrackId(null);
                                }
                            }}>
                                <Play size={16} className="rotate-90" /> {t('player.playNext')}
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t && onAddToQueue) {
                                    onAddToQueue([t]);
                                    setMenuTrackId(null);
                                }
                            }}>
                                <Plus size={16} /> {t('player.addToQueue')}
                            </button>
                            <div className="h-px bg-white/10 my-1"></div>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => setShowPlaylists(true)}>
                                <Heart size={16} /> {t('player.saveToPlaylist')}
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t) handleDownload({ stopPropagation: ()=>{} } as any, t);
                                setMenuTrackId(null);
                            }}>
                                <DownloadCloud size={16} /> {t('player.download')}
                            </button>
                            {onRemoveFromPlaylist && (
                                <>
                                    <div className="h-px bg-white/10 my-1"></div>
                                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 text-red-400 transition-colors" onClick={() => {
                                        const idx = tracks.findIndex(t => t.id === menuTrackId);
                                        const t = tracks[idx];
                                        if (t && idx !== -1) {
                                            onRemoveFromPlaylist(t, idx);
                                        }
                                        setMenuTrackId(null);
                                    }}>
                                        <MoreHorizontal size={16} /> {t('player.removeFromPlaylist')}
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="max-h-64 overflow-y-auto">
                            <div className="px-4 py-2 text-xs text-gray-500 font-bold border-b border-white/10 mb-1">{t('player.addToPlaylist')}</div>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 text-purple-400 transition-colors" onClick={async () => {
                                const name = prompt(t('player.newPlaylistPrompt'));
                                if (name && name.trim()) {
                                    try {
                                        const pl = await provider.createPlaylist(name.trim());
                                        await provider.updatePlaylist(pl.id, undefined, [menuTrackId!]);
                                        window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.createPlaylistSuccess') || "成功建立並加入播放清單!" }));
                                        setMenuTrackId(null);
                                        provider.getPlaylists().then(setPlaylists);
                                    } catch (e) { window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.createPlaylistFailed') || "建立失敗" })); }
                                }
                            }}>
                                <Plus size={16} /> {t('player.newPlaylist')}
                            </button>
                            {playlists.map(pl => (
                                <button key={pl.id} className="w-full text-left px-4 py-2 hover:bg-white/10 truncate transition-colors" onClick={async () => {
                                    try {
                                        await provider.updatePlaylist(pl.id, undefined, [menuTrackId!]);
                                        window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.addedToPlaylist', { name: pl.name }) || `已加入到 ${pl.name}` }));
                                        setMenuTrackId(null);
                                    } catch (e) { window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.addToPlaylistFailed') || "加入失敗" })); }
                                }}>
                                    {pl.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
