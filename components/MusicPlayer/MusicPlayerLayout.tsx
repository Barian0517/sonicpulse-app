import React, { useState, useEffect, useRef } from 'react';
import { Settings, Music2, Disc, PlaySquare, Search, Library, FolderOpen, Play, Pause, SkipBack, SkipForward, Server, ChevronLeft, Heart, RefreshCw, Plug } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { LocalProvider } from '../../providers/LocalProvider';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { NeteaseProvider } from '../../providers/NeteaseProvider';
import { MusicFreeProvider } from '../../providers/MusicFreeProvider';
import { Track, Album } from '../../providers/MusicProvider';
import { NavidromeView } from './NavidromeView';
import { NeteaseView } from './NeteaseView';
import { MusicFreeView } from './MusicFreeView';
import { useTranslation, Language } from '../../providers/I18nProvider';

export const MusicPlayerLayout: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    playbackState: { isPlaying: boolean; progress: number; duration: number; volume: number; };
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    onVolumeChange: (volume: number) => void;
    onPlay: (url: string, title: string, coverUrl?: string, track?: Track) => void;
    onQueueUpdate?: (queue: Track[], currentIndex: number) => void;
    isLyricsEnabled?: boolean;
    onToggleLyrics?: () => void;
}> = ({ isOpen, onClose, playbackState, onTogglePlay, onSeek, onVolumeChange, onPlay, onQueueUpdate, isLyricsEnabled, onToggleLyrics }) => {
    const [activeSource, setActiveSource] = useState<'local' | 'navidrome' | 'netease' | 'musicfree' | 'settings'>('local');
    const [localProvider] = useState(() => new LocalProvider());
    const [naviProvider] = useState(() => new NavidromeProvider());
    const [neteaseProvider] = useState(() => new NeteaseProvider());
    const [musicFreeProvider] = useState(() => new MusicFreeProvider());
    
    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Settings Tab State
    const [activeSettingsTab, setActiveSettingsTab] = useState<'basic' | 'storage' | 'server'>('basic');
    
    // Timeline Seek State
    const [localSeek, setLocalSeek] = useState<number | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { t, language, setLanguage } = useTranslation();

    const handleSourceClick = (source: 'local' | 'navidrome' | 'netease' | 'musicfree' | 'settings') => {
        if (activeSource === source) {
            // Dispatch reload event for the active view to catch
            window.dispatchEvent(new CustomEvent('sonicpulse-reload-source', { detail: source }));
        } else {
            setActiveSource(source);
        }
    };

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // Ensure we don't close if they clicked the toggle button in App.tsx (we assume that's handled, but clicking the button will fire outside anyway)
                // Actually, the open button stops propagation or we just close it and let it open again.
                // It's safer to use a custom event or check if the click is on the Music icon, but standard practice is just onClose.
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const [tracks, setTracks] = useState<Track[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
    const [isCurrentTrackLiked, setIsCurrentTrackLiked] = useState(false);

    useEffect(() => {
        const checkLikedStatus = () => {
            if (!currentTrack) {
                setIsCurrentTrackLiked(false);
                return;
            }
            if (currentTrack.source === 'netease') {
                const likedSet = new Set((window as any).__sonicpulse_liked_ids || []);
                setIsCurrentTrackLiked(likedSet.has(currentTrack.id));
            } else {
                setIsCurrentTrackLiked(currentTrack.isStarred || false);
            }
        };
        checkLikedStatus();
        window.addEventListener('sonicpulse-liked-songs-updated', checkLikedStatus);
        return () => window.removeEventListener('sonicpulse-liked-songs-updated', checkLikedStatus);
    }, [currentTrack]);

    const handleToggleLike = async () => {
        if (!currentTrack) return;
        const currentStatus = isCurrentTrackLiked;
        setIsCurrentTrackLiked(!currentStatus); // Optimistic UI
        
        try {
            if (currentTrack.source === 'netease') {
                const ok = await neteaseProvider.likeSong(currentTrack.id, !currentStatus);
                if (ok) {
                    window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: !currentStatus ? "已加入紅心歌曲" : "已取消紅心" }));
                    const ids = new Set((window as any).__sonicpulse_liked_ids || []);
                    if (!currentStatus) ids.add(currentTrack.id);
                    else ids.delete(currentTrack.id);
                    (window as any).__sonicpulse_liked_ids = Array.from(ids);
                    window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated'));
                } else {
                    window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "操作失敗" }));
                    setIsCurrentTrackLiked(currentStatus); // Revert
                }
            } else if (currentTrack.source === 'musicfree') {
                await musicFreeProvider.toggleStarTrack(currentTrack);
                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: !currentStatus ? "已加入紅心歌曲" : "已取消紅心" }));
                const ids = new Set((window as any).__sonicpulse_liked_ids || []);
                if (!currentStatus) ids.add(currentTrack.id);
                else ids.delete(currentTrack.id);
                (window as any).__sonicpulse_liked_ids = Array.from(ids);
                window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated'));
            } else {
                const provider = currentTrack.source === 'local' ? localProvider : naviProvider;
                await provider.star(currentTrack.id, 'track', !currentStatus);
                setCurrentTrack(prev => prev ? { ...prev, isStarred: !currentStatus } : prev);
                // Also update in queue if necessary, but this is fine for now
            }
        } catch (e) {
            console.error(e);
            setIsCurrentTrackLiked(currentStatus);
        }
    };

    // Queue State
    const [queue, setQueue] = useState<Track[]>([]);
    const [queueIndex, setQueueIndex] = useState(-1);

    // Navidrome Settings State
    const [naviUrl, setNaviUrl] = useState(localStorage.getItem('navidrome_url') || '');
    const [naviUser, setNaviUser] = useState(localStorage.getItem('navidrome_user') || '');
    const [naviPass, setNaviPass] = useState(localStorage.getItem('navidrome_pass') || '');
    const [isNaviReady, setIsNaviReady] = useState(false);

    // Netease Settings State
    const [neteaseUrl, setNeteaseUrl] = useState(localStorage.getItem('netease_server_url') || 'https://netease-cloud-music-api-v3.vercel.app');
    const [isNeteaseReady, setIsNeteaseReady] = useState(!!localStorage.getItem('netease_server_url'));

    // MusicFree Settings State
    const [musicFreePluginDir, setMusicFreePluginDir] = useState('');

    useEffect(() => {
        // Fetch current musicfree config
        fetch('http://127.0.0.1:30001/config')
            .then(r => r.json())
            .then(data => {
                if (data.pluginDir) setMusicFreePluginDir(data.pluginDir);
            }).catch(e => console.error("Failed to fetch musicfree config"));
    }, []);

    useEffect(() => {
        const loadSaved = async () => {
            const savedFolder = localStorage.getItem('local_music_folder');
            if (savedFolder) {
                try {
                    await localProvider.init(savedFolder);
                    setIsLocalReady(true);
                    const allTracks = await localProvider.getTracks();
                    setTracks(allTracks);
                } catch (e) {
                    console.error("Failed to auto-load local folder", e);
                }
            }

            const savedNavi = localStorage.getItem('navidrome_creds');
            if (savedNavi) {
                try {
                    const { url, user, pass } = JSON.parse(savedNavi);
                    setNaviUrl(url);
                    setNaviUser(user);
                    setNaviPass(pass);
                    
                    naviProvider.init(url, user, pass);
                    const initialTracks = await naviProvider.getTracks();
                    setIsNaviReady(true);
                    setTracks(initialTracks);
                    if (activeSource === 'local' && !savedFolder) {
                        setActiveSource('navidrome');
                    }
                } catch (e) {
                    console.error("Failed to auto-connect Navidrome", e);
                }
            }
        };
        loadSaved();
    }, [localProvider, naviProvider]);

    // Playback state is now fully controlled by App.tsx, so we don't need local listeners.
    const { isPlaying, progress, volume } = playbackState;

    const [isLocalReady, setIsLocalReady] = useState(false);

    const handleSelectLocalFolder = async () => {
        try {
            const selected = await open({ directory: true });
            if (selected && !Array.isArray(selected)) {
                await localProvider.init(selected);
                setIsLocalReady(true);
                localStorage.setItem('local_music_folder', selected);
                const allTracks = await localProvider.getTracks();
                const allAlbums = await localProvider.getTopAlbums();
                setTracks(allTracks);
                setAlbums(allAlbums);
            }
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "Failed to load folder: " + (e.message || String(e)) }));
        }
    };

    const handleConnectNetease = async () => {
        try {
            const url = new URL(neteaseUrl);
            localStorage.setItem('netease_server_url', url.toString());
            // Force re-create provider or update its URL internally. For now, reload to apply since it's read in constructor.
            // Better: update the provider's serverUrl directly, but we can't access private fields.
            // So we just set local storage and reload window.
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "Invalid Netease Server URL" }));
        }
    };

    const handleConnectNavi = async () => {
        try {
            naviProvider.init(naviUrl, naviUser, naviPass);
            // Verify by fetching random tracks
            const initialTracks = await naviProvider.getTracks();
            setIsNaviReady(true);
            setTracks(initialTracks);
            localStorage.setItem('navidrome_creds', JSON.stringify({ url: naviUrl, user: naviUser, pass: naviPass }));
            setTracks(initialTracks);
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "Failed to connect to Navidrome: " + (e.message || String(e)) }));
        }
        setIsHoveringTimeline(false);
    };

    const handleSelectMusicFreeFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false
            });
            if (selected && typeof selected === 'string') {
                const res = await fetch('http://127.0.0.1:30001/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pluginDir: selected })
                });
                if (res.ok) {
                    setMusicFreePluginDir(selected);
                    window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "MusicFree 插件目錄已更新" }));
                    window.dispatchEvent(new CustomEvent('sonicpulse-reload-source', { detail: 'musicfree' }));
                }
            }
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: "操作失敗" }));
        }
    };

    const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault(); // Prevent text selection
        if (!timelineRef.current) return;
        const dur = currentTrack?.duration || playbackState.duration;
        if (!dur) return;

        const rect = timelineRef.current.getBoundingClientRect();
        
        const updateSeek = (clientX: number) => {
            const x = clientX - rect.left;
            const percentage = Math.min(Math.max(x / rect.width, 0), 1);
            setLocalSeek(percentage * dur);
        };
        
        updateSeek(e.clientX);
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            updateSeek(moveEvent.clientX);
        };
        
        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            const finalX = upEvent.clientX - rect.left;
            const percentage = Math.min(Math.max(finalX / rect.width, 0), 1);
            onSeek(percentage * dur);
            setLocalSeek(null);
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const playTrackUrl = async (track: Track) => {
        setCurrentTrack(track);
        let url = track.streamUrl || '';
        
        try {
            if (track.source === 'local') {
                url = convertFileSrc(url);
            } else if (track.source === 'navidrome') {
                url = await naviProvider.getStreamUrl(track.id);
            } else if (track.source === 'netease') {
                url = await neteaseProvider.getStreamUrl(track.id);
            }
        } catch (e: any) {
            console.error("Play error:", e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `無法取得這首歌曲的播放連結: ${e.message}` }));
            return;
        }

        onPlay(url, `${track.title} ${track.artist ? `by ${track.artist}` : ''}`, track.coverUrl, track);
        
        if (!track.coverUrl) {
            const provider = track.source === 'local' ? localProvider : (track.source === 'netease' ? neteaseProvider : naviProvider);
            const cover = await provider.getCoverArt(track.id);
            if (cover) {
                setCurrentTrack(prev => prev?.id === track.id ? { ...prev, coverUrl: cover } : prev);
                setQueue(prev => prev.map(t => t.id === track.id ? { ...t, coverUrl: cover } : t));
            }
        }
    };

    const playInsertNextAndPlay = (tracksToInsert: Track[], targetPlayIndex: number = 0) => {
        if (tracksToInsert.length === 0) return;
        if (queue.length === 0) {
            setQueue(tracksToInsert);
            setQueueIndex(targetPlayIndex);
            playTrackUrl(tracksToInsert[targetPlayIndex]);
            return;
        }
        
        // Find the index to insert at
        const insertAt = queueIndex >= 0 ? queueIndex + 1 : queue.length;
        
        setQueue(prev => {
            const newQueue = [...prev];
            newQueue.splice(insertAt, 0, ...tracksToInsert);
            return newQueue;
        });
        
        const newQueueIndex = insertAt + targetPlayIndex;
        setQueueIndex(newQueueIndex);
        playTrackUrl(tracksToInsert[targetPlayIndex]);
    };

    const playNow = (tracksToPlay: Track[], startIndex: number = 0) => {
        playInsertNextAndPlay(tracksToPlay, startIndex);
    };

    const playNext = (tracksToInsert: Track[]) => {
        if (tracksToInsert.length === 0) return;
        if (queue.length === 0) {
            playNow(tracksToInsert, 0);
            return;
        }
        const insertIdx = queueIndex + 1;
        setQueue(prev => {
            const newQueue = [...prev];
            newQueue.splice(insertIdx, 0, ...tracksToInsert);
            return newQueue;
        });
        if (onQueueUpdate) {
            onQueueUpdate([
                ...queue.slice(0, insertIdx),
                ...tracksToInsert,
                ...queue.slice(insertIdx)
            ], Math.min(queueIndex, insertIdx));
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `已將 ${tracksToInsert.length} 首歌曲加入下一首播放` }));
        }
    };

    const addToQueue = (tracksToAdd: Track[]) => {
        if (tracksToAdd.length === 0) return;
        if (queue.length === 0) {
            playNow(tracksToAdd, 0);
            return;
        }
        setQueue(prev => [...prev, ...tracksToAdd]);
        if (onQueueUpdate) {
            onQueueUpdate([...queue, ...tracksToAdd], queueIndex);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `已將 ${tracksToAdd.length} 首歌曲加入播放序列` }));
        }
    };

    const handleNext = () => {
        if (queue.length === 0 || queueIndex < 0) return;
        if (queueIndex + 1 < queue.length) {
            const nextIdx = queueIndex + 1;
            setQueueIndex(nextIdx);
            playTrackUrl(queue[nextIdx]);
        }
    };

    const handlePrev = () => {
        if (queue.length === 0 || queueIndex < 0) return;
        if (playbackState.progress > 3) {
            // Restart current track if played for more than 3 seconds
            onSeek(0);
        } else if (queueIndex > 0) {
            const prevIdx = queueIndex - 1;
            setQueueIndex(prevIdx);
            playTrackUrl(queue[prevIdx]);
        }
    };

    useEffect(() => {
        if (onQueueUpdate) {
            onQueueUpdate(queue, queueIndex);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue, queueIndex]);

    useEffect(() => {
        const onTrackEnded = () => handleNext();
        const onExtPlayNext = () => handleNext();
        const onExtPlayPrev = () => handlePrev();
        const onExtPlayIndex = (e: any) => {
            if (e.detail !== undefined && e.detail >= 0 && e.detail < queue.length) {
                setQueueIndex(e.detail);
                playTrackUrl(queue[e.detail]);
            }
        };

        window.addEventListener('sonicpulse-track-ended', onTrackEnded);
        window.addEventListener('sonicpulse-play-next', onExtPlayNext);
        window.addEventListener('sonicpulse-play-prev', onExtPlayPrev);
        window.addEventListener('sonicpulse-play-index', onExtPlayIndex);
        return () => {
            window.removeEventListener('sonicpulse-track-ended', onTrackEnded);
            window.removeEventListener('sonicpulse-play-next', onExtPlayNext);
            window.removeEventListener('sonicpulse-play-prev', onExtPlayPrev);
            window.removeEventListener('sonicpulse-play-index', onExtPlayIndex);
        };
    }, [queue, queueIndex]);

    // Keep playTrack for backward compatibility with old views, mapping it to playNow
    const playTrack = async (track: Track) => {
        playNow([track], 0);
    };

    const togglePlay = () => {
        if (!currentTrack) return;
        onTogglePlay();
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!currentTrack) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        onSeek(ratio * (currentTrack.duration || playbackState.duration));
    };

    const handleVolumeChangeUi = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        onVolumeChange(val);
    };

    return (
        <div 
            ref={containerRef}
            className={`fixed inset-y-0 left-0 w-[1000px] max-w-[90vw] text-white flex z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isOpen ? 'translate-x-0 shadow-[30px_0_80px_rgba(0,0,0,0.8)]' : '-translate-x-full shadow-none pointer-events-none'
            }`}
        >
            {/* Sidebar */}
            <div className="w-20 bg-[#050508]/80 backdrop-blur-3xl border-r border-white/10 flex flex-col items-center py-6 gap-6 shrink-0 relative z-20">
                <div className="flex-1 w-full flex flex-col items-center gap-4 mt-8">
                    <button 
                        onClick={() => handleSourceClick('local')}
                        className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'local' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <div className="relative w-5 h-5 flex items-center justify-center">
                            <Library size={20} className={`absolute transition-opacity duration-300 ${activeSource === 'local' ? 'group-hover:opacity-0' : 'opacity-100'}`} />
                            {activeSource === 'local' && (
                                <RefreshCw size={18} className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-[spin_3s_linear_infinite]" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{t('sidebar.local')}</span>
                    </button>
                    
                    <button 
                         onClick={() => handleSourceClick('navidrome')}
                        className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'navidrome' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <div className="relative w-5 h-5 flex items-center justify-center">
                            <Server size={20} className={`absolute transition-opacity duration-300 ${activeSource === 'navidrome' ? 'group-hover:opacity-0' : 'opacity-100'}`} />
                            {activeSource === 'navidrome' && (
                                <RefreshCw size={18} className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-[spin_3s_linear_infinite]" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{t('sidebar.navidrome')}</span>
                    </button>
                    
                    <button 
                         onClick={() => handleSourceClick('netease')}
                        className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'netease' ? 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <div className="relative w-5 h-5 flex items-center justify-center">
                            <Disc size={20} className={`absolute transition-opacity duration-300 ${activeSource === 'netease' ? 'group-hover:opacity-0' : 'opacity-100'}`} />
                            {activeSource === 'netease' && (
                                <RefreshCw size={18} className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-[spin_3s_linear_infinite]" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{t('sidebar.netease')}</span>
                    </button>

                    <button 
                         onClick={() => handleSourceClick('musicfree')}
                        className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'musicfree' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <div className="relative w-5 h-5 flex items-center justify-center">
                            <Plug size={20} className={`absolute transition-opacity duration-300 ${activeSource === 'musicfree' ? 'group-hover:opacity-0' : 'opacity-100'}`} />
                            {activeSource === 'musicfree' && (
                                <RefreshCw size={18} className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-[spin_3s_linear_infinite]" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{t('sidebar.musicfree')}</span>
                    </button>
                </div>

                <div className="w-full flex flex-col items-center gap-4 mt-auto">
                    <button 
                         onClick={() => setActiveSource('settings')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'settings' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Settings size={20} />
                        <span className="text-[10px] font-medium">{t('sidebar.settings')}</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-[#0a0a0f]/90 backdrop-blur-2xl relative overflow-hidden border-r border-white/10">
                {/* Atmospheric Glows */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] -z-10 pointer-events-none" />

                {/* Collapse Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-[60] p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white border border-white/5 hover:border-white/20 transition-all shadow-xl active:scale-95 group backdrop-blur-md"
                    title="收起選單 (Collapse)"
                >
                    <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="flex-1 overflow-y-auto relative z-0 flex custom-scrollbar">
                    {activeSource === 'local' && !isLocalReady && (
                        <div className="flex flex-col items-center justify-center w-full h-full gap-4 opacity-70 hover:opacity-100 transition-opacity">
                            <FolderOpen size={48} className="text-purple-500 mb-2" />
                            <h2 className="text-xl font-bold">{t('settings.localLibrary')}</h2>
                            <p className="text-sm text-gray-400 max-w-sm text-center">{t('settings.scanPrompt')}</p>
                            <button onClick={handleSelectLocalFolder} className="mt-4 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all active:scale-95">
                                {t('settings.selectFolder')}
                            </button>
                        </div>
                    )}

                    {activeSource === 'local' && isLocalReady && (
                        <div className="p-8 pb-32 w-full">
                            <h2 className="text-2xl font-bold mb-6 tracking-wide drop-shadow-md">{t('local.localTracks')}</h2>
                            <div className="flex flex-col gap-2">
                                {tracks.map(track => (
                                    <div 
                                        key={track.id} 
                                        className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 border ${currentTrack?.id === track.id ? 'bg-purple-500/20 border-purple-500/40 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-gray-300'}`}
                                        onClick={() => playTrack(track)}
                                    >
                                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                                            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-gray-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm truncate text-white">{track.title}</div>
                                            <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 w-16 text-right">
                                            {formatTime(track.duration)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSource === 'navidrome' && !isNaviReady && (
                        <div className="flex flex-col items-center justify-center w-full h-full gap-4 max-w-sm mx-auto">
                            <Server size={48} className="text-purple-500 mb-2" />
                            <h2 className="text-xl font-bold">{t('settings.connectToNavidrome')}</h2>
                            <input type="text" placeholder={t('settings.serverUrl')} value={naviUrl} onChange={e => setNaviUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="text" placeholder={t('settings.username')} value={naviUser} onChange={e => setNaviUser(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="password" placeholder={t('settings.password')} value={naviPass} onChange={e => setNaviPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <button onClick={handleConnectNavi} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all">
                                {t('settings.connect')}
                            </button>
                        </div>
                    )}

                    {activeSource === 'navidrome' && isNaviReady && (
                        <div className="w-full h-full pb-24">
                            <NavidromeView 
                                provider={naviProvider} 
                                onPlayTrack={playTrack}
                                onPlayNow={playNow}
                                onPlayNext={playNext}
                                onAddToQueue={addToQueue}
                                currentTrackId={currentTrack?.id} 
                                isPlaying={isPlaying} 
                            />
                        </div>
                    )}

                    {activeSource === 'netease' && !isNeteaseReady && (
                        <div className="flex flex-col items-center justify-center w-full h-full gap-4 max-w-sm mx-auto">
                            <Disc size={48} className="text-red-500 mb-2" />
                            <h2 className="text-xl font-bold">{t('settings.connectToNetease')}</h2>
                            <p className="text-sm text-gray-400 text-center mb-2">{t('settings.neteasePrompt')}</p>
                            <input type="text" placeholder={t('settings.neteaseUrlPlaceholder')} value={neteaseUrl} onChange={e => setNeteaseUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <button onClick={handleConnectNetease} className="w-full mt-2 bg-red-600 hover:bg-red-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">
                                {t('settings.connect')}
                            </button>
                        </div>
                    )}

                    {activeSource === 'netease' && isNeteaseReady && (
                        <div className="w-full h-full pb-24">
                            <NeteaseView 
                                provider={neteaseProvider} 
                                onPlayTrack={playTrack}
                                onPlayNow={playNow}
                                onPlayNext={playNext}
                                onAddToQueue={addToQueue}
                                currentTrackId={currentTrack?.id} 
                                isPlaying={isPlaying} 
                            />
                        </div>
                    )}

                    {activeSource === 'musicfree' && (
                        <div className="w-full h-full pb-24">
                            <MusicFreeView 
                                provider={musicFreeProvider} 
                                onPlayTrack={playTrack}
                                onPlayNow={playNow}
                                currentTrackId={currentTrack?.id} 
                                isPlaying={isPlaying} 
                            />
                        </div>
                    )}

                    {activeSource === 'settings' && (
                        <div className="w-full h-full flex flex-col p-8 pb-32">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 ml-2"><Settings className="text-purple-500" size={28} /> {t('settings.title')}</h2>
                            <div className="flex flex-1 overflow-hidden bg-[#0d0d14]/80 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
                                {/* Settings Sidebar */}
                                <div className="w-64 border-r border-white/10 flex flex-col p-4 gap-2 bg-black/20">
                                    <button 
                                        onClick={() => setActiveSettingsTab('basic')}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'basic' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                                    >
                                        🌐 {t('settings.tabs.basic')}
                                    </button>
                                    <button 
                                        onClick={() => setActiveSettingsTab('storage')}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'storage' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                                    >
                                        <FolderOpen size={18} /> {t('settings.tabs.storage')}
                                    </button>
                                    <button 
                                        onClick={() => setActiveSettingsTab('server')}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSettingsTab === 'server' ? 'bg-green-600/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                                    >
                                        <Server size={18} /> {t('settings.tabs.server')}
                                    </button>
                                </div>
                                {/* Settings Content */}
                                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
                                    {/* Decorative glow */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
                                    
                                    {activeSettingsTab === 'basic' && (
                                        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🌐 {t('settings.language')}</h3>
                                                <select 
                                                    value={language}
                                                    onChange={(e) => setLanguage(e.target.value as Language)}
                                                    className="bg-[#151520] border border-white/20 text-white text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full p-3 outline-none cursor-pointer transition-colors shadow-sm"
                                                >
                                                    <option value="zh-TW" className="bg-[#151520] text-white">繁體中文</option>
                                                    <option value="zh-CN" className="bg-[#151520] text-white">简体中文</option>
                                                    <option value="ja" className="bg-[#151520] text-white">日本語</option>
                                                    <option value="en" className="bg-[#151520] text-white">English</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {activeSettingsTab === 'storage' && (
                                        <div className="max-w-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Library size={20} className="text-blue-400" /> {t('settings.localLibrary')}</h3>
                                                <p className="text-sm text-gray-400 mb-5 bg-black/20 p-3 rounded-lg border border-white/5 font-mono">{t('settings.currentFolder', { folder: localStorage.getItem('local_music_folder') || t('settings.notSet') })}</p>
                                                <button onClick={handleSelectLocalFolder} className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10 hover:shadow-lg active:scale-95">
                                                    {t('settings.changeFolder')}
                                                </button>
                                            </div>
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plug size={20} className="text-purple-400" /> {t('settings.musicFreePlugin')}</h3>
                                                <p className="text-sm text-gray-400 mb-5 break-all bg-black/20 p-3 rounded-lg border border-white/5 font-mono">{t('settings.currentFolder', { folder: musicFreePluginDir || t('settings.musicFreePluginDir') })}</p>
                                                <button onClick={handleSelectMusicFreeFolder} className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10 hover:shadow-lg active:scale-95">
                                                    {t('settings.changeFolder')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {activeSettingsTab === 'server' && (
                                        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Server size={20} className="text-green-400" /> {t('settings.navidromeServer')}</h3>
                                                <div className="flex flex-col gap-4">
                                                    <input type="text" placeholder={t('settings.serverUrl')} value={naviUrl} onChange={e => setNaviUrl(e.target.value)} className="w-full bg-[#151520] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500/50 outline-none transition-colors shadow-sm" />
                                                    <input type="text" placeholder={t('settings.username')} value={naviUser} onChange={e => setNaviUser(e.target.value)} className="w-full bg-[#151520] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500/50 outline-none transition-colors shadow-sm" />
                                                    <input type="password" placeholder={t('settings.password')} value={naviPass} onChange={e => setNaviPass(e.target.value)} className="w-full bg-[#151520] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500/50 outline-none transition-colors shadow-sm" />
                                                    <div className="pt-2">
                                                        <button onClick={handleConnectNavi} className="bg-green-600/80 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all active:scale-95">
                                                            {t('settings.saveAndConnect')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Player */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#0a0a0f]/60 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex items-center px-8 gap-8 z-20">
                    <div className="flex items-center gap-4 w-1/3 shrink-0 min-w-0">
                        <div className="w-14 h-14 bg-white/10 rounded-xl overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                            {currentTrack?.coverUrl ? (
                                <img src={currentTrack.coverUrl} className="w-full h-full object-cover" />
                            ) : (
                                <Music2 size={24} className="text-gray-600" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                            <h4 className="font-bold text-sm text-white truncate">{currentTrack?.title || t('player.noTrackPlaying')}</h4>
                            <p className="text-xs text-gray-400 truncate">{currentTrack?.artist || "-"}</p>
                        </div>
                        {currentTrack && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}
                                className={`p-2 transition-colors active:scale-95 ${isCurrentTrackLiked ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}
                                title={isCurrentTrackLiked ? t('player.cancelLike') : t('player.addLike')}
                            >
                                <Heart size={20} className={isCurrentTrackLiked ? "fill-current" : ""} />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-6">
                            <button onClick={handlePrev} className="text-gray-500 hover:text-white transition-colors"><SkipBack size={20} fill="currentColor" /></button>
                            <button onClick={onTogglePlay} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                            </button>
                            <button onClick={handleNext} className="text-gray-500 hover:text-white transition-colors"><SkipForward size={20} fill="currentColor" /></button>
                        </div>
                        <div className="w-full max-w-md flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                            <span className="w-8 text-right">{formatTime(localSeek !== null ? localSeek : progress)}</span>
                            <div 
                                ref={timelineRef}
                                className="flex-1 h-3 flex items-center cursor-pointer group/timeline" 
                                onMouseDown={handleTimelineMouseDown}
                                onMouseEnter={() => setIsHoveringTimeline(true)}
                                onMouseLeave={() => setIsHoveringTimeline(false)}
                            >
                                <div className={`w-full bg-white/10 rounded-full transition-all duration-200 ${isHoveringTimeline || localSeek !== null ? 'h-2' : 'h-1'}`}>
                                    <div className={`relative h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] ${localSeek !== null ? '' : 'transition-all duration-100 ease-linear'}`} style={{ width: `${(currentTrack?.duration || playbackState.duration) ? ((localSeek !== null ? localSeek : progress) / (currentTrack?.duration || playbackState.duration)) * 100 : 0}%` }}>
                                        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/timeline:opacity-100 ${localSeek !== null ? '!opacity-100' : ''} transition-opacity translate-x-1/2`} />
                                    </div>
                                </div>
                            </div>
                            <span className="w-8">{formatTime(currentTrack?.duration || playbackState.duration || 0)}</span>
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-end items-center shrink-0 text-gray-400 text-sm gap-4">
                       <button onClick={onToggleLyrics} className={`${isLyricsEnabled ? 'text-purple-400 font-bold' : 'hover:text-white'} transition-colors`}>{t('player.lyrics')}</button>
                       <div className="flex items-center gap-2 group w-24">
                           <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChangeUi} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400" />
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
