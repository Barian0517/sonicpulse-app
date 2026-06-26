import React, { useState, useEffect } from 'react';
import { Music2, Play, Heart, DownloadCloud, CheckCircle2, Star, MoreHorizontal, Plus } from 'lucide-react';
import { Track, Playlist } from '../../providers/MusicProvider';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { offlineManager } from '../../providers/OfflineManager';

export const TrackList: React.FC<{
    tracks: Track[];
    provider: NavidromeProvider;
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

        tracks.forEach(t => {
            initialStar[t.id] = t.isStarred || false;
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
    }, [tracks]);

    const handleToggleStar = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        const current = starredStatus[track.id];
        // Optimistic UI update
        setStarredStatus(prev => ({ ...prev, [track.id]: !current }));
        try {
            await provider.star(track.id, 'track', !current);
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

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
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
                            if (onPlayNow) onPlayNow(tracks, idx);
                            else onPlayTrack(track);
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
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 truncate">{track.artist}</span>
                                {track.format && <span className="text-[9px] uppercase bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{track.format}</span>}
                                {track.bitrate && <span className="text-[9px] uppercase bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{track.bitrate} kbps</span>}
                            </div>
                        </div>

                        {/* Interactive Actions */}
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={(e) => handleToggleStar(e, track)} className={`hover:scale-110 transition-transform ${isStarred ? 'text-red-500' : 'text-gray-600 hover:text-white'}`} title={isStarred ? "Remove from Favorites" : "Add to Favorites"}>
                                <Heart size={16} fill={isStarred ? "currentColor" : "none"} />
                            </button>

                            <button onClick={(e) => handleDownload(e, track)} className={`hover:scale-110 transition-transform ${isDownloaded ? 'text-green-500' : isDownloading ? 'text-blue-400 animate-bounce' : 'text-gray-600 hover:text-white'}`} title={isDownloaded ? "Downloaded" : "Download for Offline Play"}>
                                {isDownloaded ? <CheckCircle2 size={16} /> : <DownloadCloud size={16} />}
                            </button>
                            
                            <button onClick={(e) => handleContextMenu(e, track)} className="text-gray-600 hover:text-white hover:scale-110 transition-transform p-1">
                                <MoreHorizontal size={16} />
                            </button>

                            <div className="text-xs text-gray-500 w-12 text-right">
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
                    style={{ left: Math.min(menuPosition.x, window.innerWidth - 200), top: Math.min(menuPosition.y, window.innerHeight - 300) }}
                    onClick={e => e.stopPropagation()}
                >
                    {!showPlaylists ? (
                        <>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const idx = tracks.findIndex(t => t.id === menuTrackId);
                                if (onPlayNow && idx !== -1) onPlayNow(tracks, idx);
                                else {
                                    const t = tracks.find(t => t.id === menuTrackId);
                                    if (t) onPlayTrack(t);
                                }
                                setMenuTrackId(null);
                            }}>
                                <Play size={16} /> 播放 (Play)
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t && onPlayNext) {
                                    onPlayNext([t]);
                                    setMenuTrackId(null);
                                }
                            }}>
                                <Play size={16} className="rotate-90" /> 下一首播放 (Play Next)
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t && onAddToQueue) {
                                    onAddToQueue([t]);
                                    setMenuTrackId(null);
                                }
                            }}>
                                <Plus size={16} /> 加入播放序列 (Add to Queue)
                            </button>
                            <div className="h-px bg-white/10 my-1"></div>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => setShowPlaylists(true)}>
                                <Heart size={16} /> 收藏到播放清單...
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                                const t = tracks.find(t => t.id === menuTrackId);
                                if (t) handleDownload({ stopPropagation: ()=>{} } as any, t);
                                setMenuTrackId(null);
                            }}>
                                <DownloadCloud size={16} /> 下載 (Download)
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
                                        <MoreHorizontal size={16} /> 從播放清單移除
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="max-h-64 overflow-y-auto">
                            <div className="px-4 py-2 text-xs text-gray-500 font-bold border-b border-white/10 mb-1">加入到播放清單</div>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 text-purple-400 transition-colors" onClick={async () => {
                                const name = prompt("輸入新播放清單名稱:");
                                if (name && name.trim()) {
                                    try {
                                        const pl = await provider.createPlaylist(name.trim());
                                        await provider.updatePlaylist(pl.id, undefined, [menuTrackId!]);
                                        alert("成功建立並加入播放清單!");
                                        setMenuTrackId(null);
                                        provider.getPlaylists().then(setPlaylists);
                                    } catch (e) { alert("建立失敗"); }
                                }
                            }}>
                                <Plus size={16} /> 新建播放清單...
                            </button>
                            {playlists.map(pl => (
                                <button key={pl.id} className="w-full text-left px-4 py-2 hover:bg-white/10 truncate transition-colors" onClick={async () => {
                                    try {
                                        await provider.updatePlaylist(pl.id, undefined, [menuTrackId!]);
                                        alert(`已加入到 ${pl.name}`);
                                        setMenuTrackId(null);
                                    } catch (e) { alert("加入失敗"); }
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
