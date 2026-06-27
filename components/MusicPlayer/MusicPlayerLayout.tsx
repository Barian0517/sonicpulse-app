import React, { useState, useEffect, useRef } from 'react';
import { Settings, Music2, Disc, PlaySquare, Search, Library, FolderOpen, Play, Pause, SkipBack, SkipForward, Server, ChevronLeft } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { LocalProvider } from '../../providers/LocalProvider';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { NeteaseProvider } from '../../providers/NeteaseProvider';
import { Track, Album } from '../../providers/MusicProvider';
import { NavidromeView } from './NavidromeView';
import { NeteaseView } from './NeteaseView';

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
    const [activeSource, setActiveSource] = useState<'local' | 'navidrome' | 'netease' | 'settings'>('local');
    const [localProvider] = useState(() => new LocalProvider());
    const [naviProvider] = useState(() => new NavidromeProvider());
    const [neteaseProvider] = useState(() => new NeteaseProvider());
    
    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Timeline Seek State
    const [localSeek, setLocalSeek] = useState<number | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset state when closed
    useEffect(() => {
        if (!isOpen) {
            setActiveSource('local');
        }
    }, [isOpen]);

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
            alert("Failed to load folder: " + (e.message || String(e)));
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
            alert("Invalid Netease Server URL");
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
            alert("Failed to connect to Navidrome: " + (e.message || String(e)));
        }
        setIsHoveringTimeline(false);
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
            console.error("Failed to get stream URL:", e);
            alert(`無法取得這首歌曲的播放連結: ${e.message}`);
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

    const playNow = (tracksToPlay: Track[], startIndex: number = 0) => {
        if (tracksToPlay.length === 0) return;
        setQueue(tracksToPlay);
        setQueueIndex(startIndex);
        playTrackUrl(tracksToPlay[startIndex]);
    };

    const playNext = (tracksToInsert: Track[]) => {
        if (tracksToInsert.length === 0) return;
        if (queue.length === 0) {
            playNow(tracksToInsert, 0);
            return;
        }
        setQueue(prev => {
            const newQueue = [...prev];
            newQueue.splice(queueIndex + 1, 0, ...tracksToInsert);
            return newQueue;
        });
        alert(`已將 ${tracksToInsert.length} 首歌曲加入下一首播放`);
    };

    const addToQueue = (tracksToAdd: Track[]) => {
        if (tracksToAdd.length === 0) return;
        if (queue.length === 0) {
            playNow(tracksToAdd, 0);
            return;
        }
        setQueue(prev => [...prev, ...tracksToAdd]);
        alert(`已將 ${tracksToAdd.length} 首歌曲加入播放序列`);
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
                        onClick={() => setActiveSource('local')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'local' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Library size={20} />
                        <span className="text-[10px] font-medium">Local</span>
                    </button>
                    
                    <button 
                         onClick={() => setActiveSource('navidrome')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'navidrome' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Server size={20} />
                        <span className="text-[10px] font-medium">Navidrome</span>
                    </button>
                    
                    <button 
                         onClick={() => setActiveSource('netease')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'netease' ? 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Disc size={20} />
                        <span className="text-[10px] font-medium">網易雲</span>
                    </button>
                </div>

                <div className="w-full flex flex-col items-center gap-4 mt-auto">
                    <button 
                         onClick={() => setActiveSource('settings')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'settings' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Settings size={20} />
                        <span className="text-[10px] font-medium">Settings</span>
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
                            <h2 className="text-xl font-bold">Local Music Library</h2>
                            <p className="text-sm text-gray-400 max-w-sm text-center">Scan a folder on your computer to build your local music library.</p>
                            <button onClick={handleSelectLocalFolder} className="mt-4 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all active:scale-95">
                                Select Folder
                            </button>
                        </div>
                    )}

                    {activeSource === 'local' && isLocalReady && (
                        <div className="p-8 pb-32 w-full">
                            <h2 className="text-2xl font-bold mb-6 tracking-wide drop-shadow-md">Local Tracks</h2>
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
                            <h2 className="text-xl font-bold">Connect to Navidrome</h2>
                            <input type="text" placeholder="Server URL (e.g. http://localhost:4533)" value={naviUrl} onChange={e => setNaviUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="text" placeholder="Username" value={naviUser} onChange={e => setNaviUser(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="password" placeholder="Password" value={naviPass} onChange={e => setNaviPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <button onClick={handleConnectNavi} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all">
                                Connect
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
                            <h2 className="text-xl font-bold">Connect to Netease API</h2>
                            <p className="text-sm text-gray-400 text-center mb-2">Provide a NeteaseCloudMusicApi URL</p>
                            <input type="text" placeholder="Server URL (e.g. https://netease...vercel.app)" value={neteaseUrl} onChange={e => setNeteaseUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <button onClick={handleConnectNetease} className="w-full mt-2 bg-red-600 hover:bg-red-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">
                                Connect
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

                    {activeSource === 'settings' && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8">
                            <div className="w-full max-w-md bg-white/5 p-8 rounded-2xl border border-white/10">
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="text-purple-500" /> Settings</h2>
                                
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Library size={20} className="text-blue-400" /> Local Library</h3>
                                    <p className="text-sm text-gray-400 mb-4">Current folder: {localStorage.getItem('local_music_folder') || 'Not set'}</p>
                                    <button onClick={handleSelectLocalFolder} className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg font-bold text-sm transition-all">
                                        Change Folder
                                    </button>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Server size={20} className="text-green-400" /> Navidrome Server</h3>
                                    <div className="flex flex-col gap-3">
                                        <input type="text" placeholder="Server URL (e.g. http://localhost:4533)" value={naviUrl} onChange={e => setNaviUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                                        <input type="text" placeholder="Username" value={naviUser} onChange={e => setNaviUser(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                                        <input type="password" placeholder="Password" value={naviPass} onChange={e => setNaviPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                                        <button onClick={handleConnectNavi} className="mt-2 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all">
                                            Save & Connect
                                        </button>
                                    </div>
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
                        <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{currentTrack?.title || "No track playing"}</h4>
                            <p className="text-xs text-gray-400 truncate">{currentTrack?.artist || "-"}</p>
                        </div>
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
                       <button onClick={onToggleLyrics} className={`${isLyricsEnabled ? 'text-purple-400 font-bold' : 'hover:text-white'} transition-colors`}>Lyrics</button>
                       <div className="flex items-center gap-2 group w-24">
                           <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChangeUi} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400" />
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
