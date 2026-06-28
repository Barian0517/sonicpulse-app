import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Search, Music2, Play, Pause, SkipBack, SkipForward, Disc, Server, Plug, Settings, Library, Heart, Compass, ListVideo, Trash2, X } from 'lucide-react';
import { Track } from '../../providers/MusicProvider';

export const JukeboxApp: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    
    // Host State
    const [hostState, setHostState] = useState<{
        isPlaying: boolean;
        progress: number;
        duration: number;
        currentTrack: Track | null;
        queue: Track[];
        queueIndex: number;
        permissions: {
            allowPlayNext: boolean;
            allowControl: boolean;
            allowCutSong: boolean;
            allowModifyQueue: boolean;
            personalMode: boolean;
            allowedSources: string[];
        }
    }>({
        isPlaying: false,
        progress: 0,
        duration: 0,
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        permissions: { 
            allowPlayNext: true, allowControl: true, allowCutSong: true, allowModifyQueue: true, personalMode: true, 
            allowedSources: ['netease', 'navidrome', 'musicfree'] 
        }
    });

    const [activeSource, setActiveSource] = useState<string>('netease');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Track[]>([]);
    
    // Play behaviors
    const [playSingleBehavior, setPlaySingleBehavior] = useState<'insert_next' | 'insert_last' | 'play_track'>(
        localStorage.getItem('jukebox_play_single') as any || 'insert_next'
    );
    const [playAllBehavior, setPlayAllBehavior] = useState<'insert_next' | 'insert_last' | 'play_track'>(
        localStorage.getItem('jukebox_play_all') as any || 'insert_last'
    );

    // Queue Panel
    const [isQueueOpen, setIsQueueOpen] = useState(false);

    const searchCallbacks = useRef<{ [key: string]: (results: Track[]) => void }>({});

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const wsPort = params.get('wsPort');
        const wsUrl = wsPort ? `http://${window.location.hostname}:${wsPort}` : undefined;
        
        const newSocket = io(wsUrl);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
        });

        newSocket.on('state_update', (state) => {
            setHostState(prev => ({...prev, ...state}));
        });

        newSocket.on('host_search_results', (data: { reqId: string, results: Track[] }) => {
            if (searchCallbacks.current[data.reqId]) {
                searchCallbacks.current[data.reqId](data.results);
                delete searchCallbacks.current[data.reqId];
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (hostState.permissions.allowedSources.length > 0 && 
            !hostState.permissions.allowedSources.includes(activeSource) && 
            activeSource !== 'settings') {
            setActiveSource(hostState.permissions.allowedSources[0]);
        }
    }, [hostState.permissions.allowedSources, activeSource]);

    const handleSearch = () => {
        if (!searchQuery.trim() || !socket) return;
        setIsSearching(true);
        const reqId = Date.now().toString();
        
        searchCallbacks.current[reqId] = (results) => {
            setSearchResults(results);
            setIsSearching(false);
        };

        socket.emit('client_command', {
            type: 'search',
            reqId,
            source: activeSource,
            query: searchQuery
        });
    };

    const handleTrackAction = (track: Track, type: 'single' | 'all') => {
        if (!socket) return;
        const behavior = type === 'single' ? playSingleBehavior : playAllBehavior;
        
        if (behavior === 'play_track' && hostState.permissions.allowCutSong) {
            socket.emit('client_command', { type: 'play_track', track });
        } else if (behavior === 'insert_next' && hostState.permissions.allowPlayNext) {
            socket.emit('client_command', { type: 'insert_next', track });
        } else if (behavior === 'insert_last' && hostState.permissions.allowPlayNext) {
            socket.emit('client_command', { type: 'insert_last', track });
        }
    };

    const handlePlayAll = () => {
        if (!socket || searchResults.length === 0) return;
        // Simple implementation: insert the first track with chosen behavior, and the rest as insert_last?
        // Actually, playAll behavior usually means taking the whole list. We can just send them one by one.
        searchResults.forEach((track, i) => {
            if (i === 0) handleTrackAction(track, 'all');
            else if (hostState.permissions.allowPlayNext) socket.emit('client_command', { type: 'insert_last', track });
        });
    };

    const handleControl = (type: string, data?: any) => {
        if (!socket || !hostState.permissions.allowControl) return;
        socket.emit('client_command', { type, ...data });
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "0:00";
        if (time > 10000) time = Math.floor(time / 1000);
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!connected) {
        return <div className="fixed inset-0 bg-[#0a0a0f] text-white flex items-center justify-center font-bold">Connecting to SonicPulse Host...</div>;
    }

    return (
        <div className="fixed inset-y-0 left-0 w-full h-full text-white flex overflow-hidden bg-[#0a0a0f]/90 backdrop-blur-2xl">
            {/* Atmospheric Glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] -z-10 pointer-events-none" />

            {/* Sidebar */}
            <div className="w-20 bg-[#050508]/80 backdrop-blur-3xl border-r border-white/10 flex flex-col items-center py-6 gap-6 shrink-0 relative z-20">
                <div className="flex-1 w-full flex flex-col items-center gap-4 mt-8">
                    {hostState.permissions.personalMode && (
                        <button 
                            onClick={() => setActiveSource('local')}
                            className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'local' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                        >
                            <Library size={20} />
                            <span className="text-[10px] font-medium">我的</span>
                        </button>
                    )}
                    
                    {hostState.permissions.allowedSources.includes('navidrome') && (
                        <button 
                             onClick={() => setActiveSource('navidrome')}
                            className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'navidrome' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                        >
                            <Server size={20} />
                            <span className="text-[10px] font-medium">Navi</span>
                        </button>
                    )}
                    
                    {hostState.permissions.allowedSources.includes('netease') && (
                        <button 
                             onClick={() => setActiveSource('netease')}
                            className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'netease' ? 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                        >
                            <Disc size={20} />
                            <span className="text-[10px] font-medium">網易雲</span>
                        </button>
                    )}

                    {hostState.permissions.allowedSources.includes('musicfree') && (
                        <button 
                             onClick={() => setActiveSource('musicfree')}
                            className={`group w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'musicfree' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                        >
                            <Plug size={20} />
                            <span className="text-[10px] font-medium">外掛</span>
                        </button>
                    )}
                </div>

                <div className="w-full flex flex-col items-center gap-4 mt-auto">
                    <button 
                         onClick={() => setActiveSource('settings')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${activeSource === 'settings' ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border hover:border-white/10'}`}
                    >
                        <Settings size={20} />
                        <span className="text-[10px] font-medium">設定</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative z-10 overflow-hidden pb-24">
                {activeSource === 'settings' ? (
                    <div className="p-8 pb-32 max-w-2xl overflow-y-auto h-full">
                        <h2 className="text-2xl font-bold mb-6 tracking-wide drop-shadow-md flex items-center gap-2"><Settings size={24} className="text-purple-400"/> 點歌機設定</h2>
                        
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner flex flex-col gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">「點擊單曲」行為</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                        <input type="radio" name="playSingle" value="insert_next" checked={playSingleBehavior === 'insert_next'} onChange={() => { setPlaySingleBehavior('insert_next'); localStorage.setItem('jukebox_play_single', 'insert_next'); }} className="accent-purple-500" />
                                        依序插入下一首 (不切歌)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                        <input type="radio" name="playSingle" value="insert_last" checked={playSingleBehavior === 'insert_last'} onChange={() => { setPlaySingleBehavior('insert_last'); localStorage.setItem('jukebox_play_single', 'insert_last'); }} className="accent-purple-500" />
                                        加入序列最後 (不切歌)
                                    </label>
                                    <label className={`flex items-center gap-2 text-sm text-gray-300 ${hostState.permissions.allowCutSong ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                        <input type="radio" name="playSingle" value="play_track" disabled={!hostState.permissions.allowCutSong} checked={playSingleBehavior === 'play_track'} onChange={() => { setPlaySingleBehavior('play_track'); localStorage.setItem('jukebox_play_single', 'play_track'); }} className="accent-purple-500" />
                                        立即播放 (強制切歌)
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">「播放全部」行為</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                        <input type="radio" name="playAll" value="insert_next" checked={playAllBehavior === 'insert_next'} onChange={() => { setPlayAllBehavior('insert_next'); localStorage.setItem('jukebox_play_all', 'insert_next'); }} className="accent-purple-500" />
                                        依序插入下一首 (不切歌)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                        <input type="radio" name="playAll" value="insert_last" checked={playAllBehavior === 'insert_last'} onChange={() => { setPlayAllBehavior('insert_last'); localStorage.setItem('jukebox_play_all', 'insert_last'); }} className="accent-purple-500" />
                                        加入序列最後 (不切歌)
                                    </label>
                                    <label className={`flex items-center gap-2 text-sm text-gray-300 ${hostState.permissions.allowCutSong ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                        <input type="radio" name="playAll" value="play_track" disabled={!hostState.permissions.allowCutSong} checked={playAllBehavior === 'play_track'} onChange={() => { setPlayAllBehavior('play_track'); localStorage.setItem('jukebox_play_all', 'play_track'); }} className="accent-purple-500" />
                                        立即播放 (強制切歌)
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col p-6 overflow-hidden">
                        <div className="flex gap-4 mb-6">
                            <div className="relative flex-1 max-w-xl">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input 
                                    type="text"
                                    placeholder="搜尋歌曲..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 text-sm focus:border-purple-500/50 outline-none transition-colors"
                                />
                            </div>
                            <button onClick={handleSearch} disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 transition-all shadow-lg active:scale-95">
                                搜尋
                            </button>
                            <button onClick={handlePlayAll} disabled={searchResults.length === 0} className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 transition-all active:scale-95 ml-auto border border-white/5">
                                播放全部
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isSearching ? (
                                <div className="text-center py-10 text-gray-400 font-mono animate-pulse">Searching...</div>
                            ) : searchResults.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {searchResults.map((track, i) => (
                                        <div 
                                            key={i} 
                                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer group"
                                            onClick={() => handleTrackAction(track, 'single')}
                                        >
                                            <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                                {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-gray-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm truncate text-white group-hover:text-purple-300 transition-colors">{track.title}</div>
                                                <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-50">
                                    <Music2 size={48} className="text-gray-500 mb-4" />
                                    <p className="text-gray-400">輸入關鍵字開始點歌</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Queue Panel Overlay */}
            {isQueueOpen && (
                <div className="absolute top-0 right-0 bottom-24 w-80 bg-[#12121c]/95 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col z-40 animate-in slide-in-from-right duration-300">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><ListVideo size={18} className="text-purple-400"/> 播放序列 ({hostState.queue.length})</h3>
                        <div className="flex gap-2">
                            {hostState.permissions.allowModifyQueue && (
                                <button onClick={() => socket?.emit('client_command', { type: 'clear_queue' })} className="p-2 hover:bg-white/10 rounded-full text-red-400 transition-colors" title="清空">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <button onClick={() => setIsQueueOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-1">
                        {hostState.queue.map((track, i) => (
                            <div key={i} className={`flex items-center gap-3 p-2 rounded-lg group ${hostState.queueIndex === i ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm truncate ${hostState.queueIndex === i ? 'text-purple-300 font-bold' : 'text-gray-200'}`}>{track.title}</div>
                                    <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                </div>
                                {hostState.permissions.allowModifyQueue && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); socket?.emit('client_command', { type: 'remove_queue_item', index: i }); }}
                                        className="p-1.5 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded-md transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom Player */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#0a0a0f]/60 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex items-center px-4 md:px-8 gap-4 md:gap-8 z-50">
                <div className="flex items-center gap-4 w-1/3 shrink-0 min-w-0">
                    <div className="w-14 h-14 bg-white/10 rounded-xl overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                        {hostState.currentTrack?.coverUrl ? (
                            <img src={hostState.currentTrack.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                            <Music2 size={24} className="text-gray-600" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pr-2 hidden sm:block">
                        <h4 className="font-bold text-sm text-white truncate">{hostState.currentTrack?.title || "沒有正在播放的歌曲"}</h4>
                        <p className="text-xs text-gray-400 truncate">{hostState.currentTrack?.artist || "-"}</p>
                    </div>
                    {hostState.currentTrack && hostState.permissions.personalMode && (
                        <button 
                            onClick={() => socket?.emit('client_command', { type: 'toggle_heart', trackId: hostState.currentTrack?.id })}
                            className="p-2 transition-colors active:scale-95 text-gray-500 hover:text-white"
                            title="切換紅心"
                        >
                            <Heart size={20} />
                        </button>
                    )}
                </div>
                
                <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-6">
                        <button onClick={() => handleControl('prev')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white transition-colors disabled:opacity-30"><SkipBack size={20} fill="currentColor" /></button>
                        <button onClick={() => handleControl('toggle_play')} disabled={!hostState.permissions.allowControl} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50">
                            {hostState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={() => handleControl('next')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white transition-colors disabled:opacity-30"><SkipForward size={20} fill="currentColor" /></button>
                    </div>
                    <div className="w-full max-w-md flex items-center gap-3 text-[10px] text-gray-400 font-mono hidden md:flex">
                        <span className="w-8 text-right">{formatTime(hostState.progress)}</span>
                        <div className="flex-1 h-3 flex items-center">
                            <div className="w-full bg-white/10 rounded-full h-1">
                                <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ width: `${hostState.duration ? (hostState.progress / hostState.duration) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                        <span className="w-8">{formatTime(hostState.duration)}</span>
                    </div>
                </div>

                <div className="w-1/3 flex justify-end items-center shrink-0 gap-4">
                    <button 
                        onClick={() => socket?.emit('client_command', { type: 'toggle_roaming' })}
                        className={`p-2 transition-colors ${hostState.permissions.allowControl ? 'hover:text-white text-gray-400' : 'opacity-30 text-gray-500'}`}
                        disabled={!hostState.permissions.allowControl}
                        title="開啟/關閉主機漫遊"
                    >
                        <Compass size={20} />
                    </button>
                    <button 
                        onClick={() => setIsQueueOpen(!isQueueOpen)}
                        className={`p-2 transition-colors ${isQueueOpen ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
                        title="播放序列"
                    >
                        <ListVideo size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
