import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Search, Music2, Play, Pause, SkipBack, SkipForward, Disc, Server, Plug, MoreVertical } from 'lucide-react';
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
        permissions: {
            allowPlayNext: boolean;
            allowControl: boolean;
            allowedSources: string[];
        }
    }>({
        isPlaying: false,
        progress: 0,
        duration: 0,
        currentTrack: null,
        queue: [],
        permissions: { allowPlayNext: true, allowControl: true, allowedSources: ['netease', 'navidrome', 'musicfree'] }
    });

    const [activeSource, setActiveSource] = useState<string>('netease');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Track[]>([]);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Keep track of search promises
    const searchCallbacks = useRef<{ [key: string]: (results: Track[]) => void }>({});

    useEffect(() => {
        // Connect to the same host/port serving this page, or use wsPort param if provided
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
            setHostState(state);
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

    // Ensure active source is allowed
    useEffect(() => {
        if (hostState.permissions.allowedSources.length > 0 && !hostState.permissions.allowedSources.includes(activeSource)) {
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

    const handleAddQueue = (track: Track) => {
        if (!socket) return;
        socket.emit('client_command', { type: 'add_to_queue', track });
        setActiveMenu(null);
    };

    const handlePlayNext = (track: Track) => {
        if (!socket || !hostState.permissions.allowPlayNext) return;
        socket.emit('client_command', { type: 'play_next', track });
        setActiveMenu(null);
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
        return <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">Connecting to Host...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden font-sans">
            {/* Top Bar */}
            <div className="h-16 bg-white/5 border-b border-white/10 flex items-center px-6 gap-4">
                <Music2 className="text-purple-500" />
                <h1 className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">SonicPulse Jukebox</h1>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-20 md:w-64 bg-white/5 border-r border-white/10 flex flex-col p-4 gap-2">
                    {hostState.permissions.allowedSources.includes('netease') && (
                        <button 
                            onClick={() => {setActiveSource('netease'); setSearchResults([]);}}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSource === 'netease' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Disc size={20} /> <span className="hidden md:inline">網易雲</span>
                        </button>
                    )}
                    {hostState.permissions.allowedSources.includes('navidrome') && (
                        <button 
                            onClick={() => {setActiveSource('navidrome'); setSearchResults([]);}}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSource === 'navidrome' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Server size={20} /> <span className="hidden md:inline">Navidrome</span>
                        </button>
                    )}
                    {hostState.permissions.allowedSources.includes('musicfree') && (
                        <button 
                            onClick={() => {setActiveSource('musicfree'); setSearchResults([]);}}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeSource === 'musicfree' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Plug size={20} /> <span className="hidden md:inline">插件</span>
                        </button>
                    )}
                </div>

                {/* Search Area */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
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
                        <button onClick={handleSearch} disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 transition-all">
                            搜尋
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isSearching ? (
                            <div className="text-center py-10 text-gray-400">搜尋中...</div>
                        ) : searchResults.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {searchResults.map((track, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group">
                                        <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                                            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-gray-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleAddQueue(track)}>
                                            <div className="font-bold text-sm truncate">{track.title}</div>
                                            <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                        </div>
                                        
                                        <div className="relative">
                                            <button onClick={() => setActiveMenu(activeMenu === track.id ? null : track.id)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all">
                                                <MoreVertical size={16} />
                                            </button>
                                            
                                            {activeMenu === track.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                                                    <div className="absolute right-0 mt-2 w-48 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                        <button onClick={() => handleAddQueue(track)} className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors">
                                                            加入序列最後 (預設)
                                                        </button>
                                                        {hostState.permissions.allowPlayNext && (
                                                            <button onClick={() => handlePlayNext(track)} className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors text-purple-400">
                                                                插播 (加入到下一首)
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500">輸入關鍵字開始點歌</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Player */}
            <div className="h-24 bg-[#0a0a0f]/80 backdrop-blur-xl border-t border-white/10 flex items-center px-4 md:px-8 gap-4 md:gap-8 relative z-20">
                <div className="flex items-center gap-4 w-1/3 shrink-0 min-w-0">
                    <div className="w-14 h-14 bg-white/10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                        {hostState.currentTrack?.coverUrl ? (
                            <img src={hostState.currentTrack.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                            <Music2 size={24} className="text-gray-600" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-white truncate">{hostState.currentTrack?.title || '未播放'}</h4>
                        <p className="text-xs text-gray-400 truncate">{hostState.currentTrack?.artist || '-'}</p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-6">
                        <button onClick={() => handleControl('prev')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors"><SkipBack size={20} fill="currentColor" /></button>
                        <button onClick={() => handleControl('toggle_play')} disabled={!hostState.permissions.allowControl} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-transform">
                            {hostState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={() => handleControl('next')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors"><SkipForward size={20} fill="currentColor" /></button>
                    </div>
                    <div className="w-full max-w-md flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                        <span className="w-8 text-right">{formatTime(hostState.progress)}</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                            if (!hostState.permissions.allowControl) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const perc = (e.clientX - rect.left) / rect.width;
                            handleControl('seek', { time: perc * hostState.duration });
                        }}>
                            <div className="h-full bg-purple-500 transition-all duration-100 ease-linear" style={{ width: `${(hostState.progress / (hostState.duration || 1)) * 100}%` }} />
                        </div>
                        <span className="w-8">{formatTime(hostState.duration)}</span>
                    </div>
                </div>

                <div className="w-1/3 flex justify-end shrink-0 text-xs text-gray-500">
                    序列: {hostState.queue.length} 首
                </div>
            </div>
        </div>
    );
};
