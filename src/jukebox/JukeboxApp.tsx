import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Compass, Mic2, Disc3, ListMusic, Heart, DownloadCloud, Play, Pause, Search, Star, Download, PlayCircle, Loader2, MoreHorizontal, X, SkipBack, SkipForward, Settings, Trash2, Library, Music2, ListVideo } from 'lucide-react';
import { Track } from '../../providers/MusicProvider';
import { NeteaseProvider } from '../../providers/NeteaseProvider';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { MusicFreeProvider } from '../../providers/MusicFreeProvider';

import { NeteaseView } from '../../components/MusicPlayer/NeteaseView';
import { NavidromeView } from '../../components/MusicPlayer/NavidromeView';
import { MusicFreeView } from '../../components/MusicPlayer/MusicFreeView';

const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const JukeboxApp: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    
    const [hostState, setHostState] = useState<any>({
        isPlaying: false,
        progress: 0,
        duration: 0,
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        permissions: {
            allowPlayNext: true,
            allowControl: true,
            allowCutSong: true,
            allowModifyQueue: true,
            personalMode: false,
            allowedSources: []
        },
        personalData: {}
    });

    const [activeSource, setActiveSource] = useState<string>('');
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Track[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchCallbacks = useRef<Record<string, (results: Track[]) => void>>({});

    // Providers
    const [neteaseProvider, setNeteaseProvider] = useState<NeteaseProvider | null>(null);
    const [naviProvider, setNaviProvider] = useState<NavidromeProvider | null>(null);
    const [musicFreeProvider, setMusicFreeProvider] = useState<MusicFreeProvider | null>(null);

    const hasFetchedPersonalDataRef = useRef(false);

    useEffect(() => {
        const wsPort = localStorage.getItem('jukebox_ws_port');
        const wsUrl = wsPort ? `http://${window.location.hostname}:${wsPort}` : undefined;
        
        // Proxy for CORS and Firewall issues on Jukebox Web
        const originalFetch = window.fetch;
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
            
            const isProxyNeeded = url.includes(':30000') || url.includes(':30001') || url.includes('/rest/') || url.includes('navidrome');
            
            if (isProxyNeeded && wsPort) {
                const proxyUrl = `http://${window.location.hostname}:${wsPort}/api/proxy`;
                if (!init || init.method === 'GET' || !init.method) {
                    return originalFetch(`${proxyUrl}?url=${encodeURIComponent(url)}`, init);
                } else {
                    const response = await originalFetch(proxyUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url,
                            method: init.method,
                            headers: init.headers || {},
                            body: init.body
                        })
                    });
                    
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        return new Response(buffer, {
                            status: response.status,
                            headers: new Headers({ 'Content-Type': 'application/json' }) // Fallback, real headers not preserved natively but usually fine
                        });
                    }
                }
            }
            return originalFetch(input, init);
        };

        const newSocket = io(wsUrl);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnected(true);
            newSocket.emit('client_command', { type: 'get_personal_data' });
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
        });

        newSocket.on('state_update', (state) => {
            setHostState(prev => ({...prev, ...state}));
            if (state.permissions?.personalMode && !hasFetchedPersonalDataRef.current) {
                // Personal mode turned on! Fetch data
                hasFetchedPersonalDataRef.current = true;
                newSocket.emit('client_command', { type: 'get_personal_data' });
            } else if (!state.permissions?.personalMode) {
                hasFetchedPersonalDataRef.current = false;
            }
        });

        newSocket.on('personal_data', (data) => {
            setHostState(prev => ({...prev, personalData: data}));
            
            // Init Providers
            const np = new NeteaseProvider();
            if (data.neteaseUrl) {
                np.setServerUrl(data.neteaseUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname));
            }
            if (data.neteaseCookie) {
                localStorage.setItem('netease_cookie', data.neteaseCookie);
                np.setCookie(data.neteaseCookie);
            }
            if (data.neteaseUid) localStorage.setItem('netease_uid', data.neteaseUid);
            setNeteaseProvider(np);

            const nv = new NavidromeProvider();
            if (data.navidromeUrl) {
                nv.init(data.navidromeUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname), data.navidromeUser || '', data.navidromePass || '');
                setNaviProvider(nv);
            }

            const mf = new MusicFreeProvider();
            setMusicFreeProvider(mf);
        });

        newSocket.on('host_search_results', (data: { reqId: string, results: Track[] }) => {
            if (searchCallbacks.current[data.reqId]) {
                searchCallbacks.current[data.reqId](data.results);
                delete searchCallbacks.current[data.reqId];
            }
        });

        return () => {
            window.fetch = originalFetch;
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
        
        const promise = new Promise<Track[]>((resolve) => {
            searchCallbacks.current[reqId] = resolve;
        });

        socket.emit('client_command', {
            type: 'search',
            source: activeSource,
            query: searchQuery,
            reqId
        });

        promise.then(results => {
            setSearchResults(results);
            setIsSearching(false);
        }).catch(() => setIsSearching(false));
    };

    const handlePlayTrack = (track: Track) => {
        if (!socket) return;
        socket.emit('client_command', { type: 'host_play_track', track });
    };

    const handlePlayAll = (tracks: Track[]) => {
        if (!socket || tracks.length === 0) return;
        socket.emit('client_command', { type: 'host_play_now', tracks });
    };

    const handleControl = (type: string, data?: any) => {
        if (!socket || !hostState.permissions.allowControl) return;
        socket.emit('client_command', { type, ...data });
    };

    if (!connected) {
        return (
            <div className="h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center font-sans">
                <Loader2 size={48} className="animate-spin text-purple-500 mb-6" />
                <h1 className="text-2xl font-bold mb-2">Connecting to 櫻撥放器 sakura player Host...</h1>
                <p className="text-gray-400">Please make sure the host is running and you are on the same network.</p>
            </div>
        );
    }

    const renderSourceIcon = (source: string) => {
        switch (source) {
            case 'netease': return <Disc3 size={20} />;
            case 'navidrome': return <ListMusic size={20} />;
            case 'musicfree': return <DownloadCloud size={20} />;
            case 'local': return <Mic2 size={20} />;
            default: return <Music2 size={20} />;
        }
    };

    const renderSourceName = (source: string) => {
        switch (source) {
            case 'netease': return '網易雲';
            case 'navidrome': return 'Navidrome';
            case 'musicfree': return '外掛 (MusicFree)';
            case 'local': return '本機音樂';
            default: return source;
        }
    };

    // Personal Mode full view rendering
    const renderPersonalModeView = () => {
        if (!hostState.permissions.personalMode) return null;
        
        if (activeSource === 'netease' && neteaseProvider) {
            return (
                <NeteaseView 
                    provider={neteaseProvider}
                    onPlayTrack={handlePlayTrack}
                    onPlayNow={handlePlayAll}
                    onPlayNext={(tracks) => socket?.emit('client_command', { type: 'insert_next', track: tracks[0] })}
                    onAddToQueue={(tracks) => socket?.emit('client_command', { type: 'insert_last', track: tracks[0] })}
                    currentTrackId={hostState.currentTrack?.id}
                    isPlaying={hostState.isPlaying}
                    
                />
            );
        } else if (activeSource === 'navidrome' && naviProvider) {
            return (
                <NavidromeView 
                    provider={naviProvider}
                    onPlayTrack={handlePlayTrack}
                    onPlayNow={handlePlayAll}
                    onPlayNext={(tracks) => socket?.emit('client_command', { type: 'insert_next', track: tracks[0] })}
                    onAddToQueue={(tracks) => socket?.emit('client_command', { type: 'insert_last', track: tracks[0] })}
                    currentTrackId={hostState.currentTrack?.id}
                    isPlaying={hostState.isPlaying}
                />
            );
        } else if (activeSource === 'musicfree' && musicFreeProvider) {
            return (
                <MusicFreeView 
                    provider={musicFreeProvider}
                    onPlayTrack={handlePlayTrack}
                    onPlayNow={handlePlayAll}
                    onPlayNext={(tracks) => socket?.emit('client_command', { type: 'insert_next', track: tracks[0] })}
                    onAddToQueue={(tracks) => socket?.emit('client_command', { type: 'insert_last', track: tracks[0] })}
                    currentTrackId={hostState.currentTrack?.id}
                    isPlaying={hostState.isPlaying}
                    
                />
            );
        }
        return null;
    };

    return (
        <div className="h-screen bg-[#0a0a0f] text-white flex flex-col md:flex-row overflow-hidden font-sans">
            {/* Sidebar / Top Nav */}
            <div className="w-full h-auto md:w-64 md:h-full bg-[#12121c] border-b md:border-b-0 md:border-r border-white/5 flex flex-col z-20 shrink-0 transition-all duration-300">
                <div className="h-14 md:h-16 flex items-center justify-between md:justify-start px-4 md:px-6 shrink-0 border-b border-white/5">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                            <Play fill="white" size={16} className="ml-1" />
                        </div>
                        <span className="ml-3 font-bold text-lg tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">櫻撥放器 sakura player</span>
                    </div>
                    {/* Mobile Settings Button */}
                    <button onClick={() => setIsSettingsOpen(true)} className="md:hidden text-gray-400 hover:text-white p-2">
                        <Settings size={20} />
                    </button>
                </div>
                
                <div className="w-full overflow-x-auto md:flex-1 md:overflow-y-auto py-2 md:py-4 custom-scrollbar flex flex-row md:flex-col gap-2 md:gap-1 px-2 md:px-4 hide-scrollbar">
                    {hostState.permissions.allowedSources.map(source => (
                        <button
                            key={source}
                            onClick={() => { setActiveSource(source); setSearchResults([]); setSearchQuery(''); }}
                            className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-2 md:p-3 rounded-xl transition-all whitespace-nowrap group ${
                                activeSource === source 
                                    ? 'bg-gradient-to-r from-purple-500/20 to-transparent text-purple-400 font-bold relative overflow-hidden' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {activeSource === source && (
                                <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                            )}
                            {activeSource === source && (
                                <div className="md:hidden absolute bottom-0 left-0 right-0 h-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                            )}
                            <div className={`${activeSource === source ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'} transition-colors`}>
                                {renderSourceIcon(source)}
                            </div>
                            <span>{renderSourceName(source)}</span>
                        </button>
                    ))}
                    
                    {/* Desktop Settings Button */}
                    <div className="mt-auto hidden md:block pt-4">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group"
                        >
                            <Settings size={20} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
                            <span>點歌機設定</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 relative pb-16 md:pb-24">
                {/* Search Bar - only show if not in personal mode full view */}
                {!hostState.permissions.personalMode && (
                    <div className="p-3 md:p-8 shrink-0 relative z-10 flex flex-row items-center gap-2 md:gap-4">
                        <div className="flex-1 relative group w-full max-w-2xl mx-auto md:mx-0 md:ml-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-400 group-focus-within:text-purple-400 transition-colors md:w-5 md:h-5" />
                            </div>
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder={`在 ${renderSourceName(activeSource)} 中搜尋...`}
                                className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 md:py-4 pl-10 md:pl-12 pr-4 text-sm md:text-base text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all shadow-inner"
                            />
                        </div>
                        <button 
                            onClick={handleSearch}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 md:px-8 py-2.5 md:py-4 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] whitespace-nowrap shrink-0 md:mr-auto"
                        >
                            <span className="hidden md:inline">搜尋</span>
                            <Search size={18} className="md:hidden" />
                        </button>
                    </div>
                )}

                {/* Content Area */}
                {hostState.permissions.personalMode ? (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {renderPersonalModeView()}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                        <div className="max-w-6xl mx-auto">
                            {isSearching ? (
                                <div className="flex flex-col items-center justify-center h-64 text-purple-400">
                                    <Loader2 size={40} className="animate-spin mb-4" />
                                    <p>搜尋中...</p>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl md:text-2xl font-bold">搜尋結果</h2>
                                        <button 
                                            onClick={() => handlePlayAll(searchResults)}
                                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                        >
                                            <Play size={16} fill="currentColor" /> 播放全部
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {searchResults.map((track, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => handlePlayTrack(track)}
                                                className="group flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/5"
                                            >
                                                <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden shrink-0 relative shadow-sm group-hover:shadow-md">
                                                    {track.coverUrl ? (
                                                        <img src={track.coverUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-gray-600" /></div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Play fill="white" size={20} className="ml-1 drop-shadow-md" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-gray-200 group-hover:text-white truncate">{track.title}</div>
                                                    <div className="text-sm text-gray-500 truncate">{track.artist} {track.album ? `· ${track.album}` : ''}</div>
                                                </div>
                                                <div className="text-xs text-gray-600 font-mono hidden sm:block w-12 text-right">
                                                    {formatTime(track.duration)}
                                                </div>
                                                <div className="flex gap-1 md:gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hostState.permissions.allowPlayNext && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); socket?.emit('client_command', { type: 'insert_next', track }); }}
                                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                                title="從下一首插入"
                                                            >
                                                                <ListMusic size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); socket?.emit('client_command', { type: 'insert_last', track }); }}
                                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                                title="加入歌單最後"
                                                            >
                                                                <MoreHorizontal size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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

            {/* Bottom Player */}
            <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 bg-[#0a0a0f]/80 backdrop-blur-3xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex items-center px-2 md:px-8 gap-2 md:gap-8 z-50">
                {/* Left: Track Info */}
                <div className="flex items-center gap-2 md:gap-4 flex-1 md:w-1/3 min-w-0 shrink">
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-white/10 rounded-lg md:rounded-xl overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                        {hostState.currentTrack?.coverUrl ? (
                            <img src={hostState.currentTrack.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                            <Music2 size={24} className="text-gray-600" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1 md:pr-2">
                        <h4 className="font-bold text-xs md:text-sm text-white truncate">{hostState.currentTrack?.title || "沒有正在播放的歌曲"}</h4>
                        <p className="text-[10px] md:text-xs text-gray-400 truncate">{hostState.currentTrack?.artist || "-"}</p>
                    </div>
                </div>
                
                {/* Middle: Controls */}
                <div className="shrink-0 md:flex-1 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3 md:gap-6">
                        <button onClick={() => handleControl('prev')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white transition-colors disabled:opacity-30"><SkipBack size={18} fill="currentColor" className="md:w-5 md:h-5" /></button>
                        <button onClick={() => handleControl('toggle_play')} disabled={!hostState.permissions.allowControl} className="w-8 h-8 md:w-10 md:h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50">
                            {hostState.isPlaying ? <Pause size={16} fill="currentColor" className="md:w-5 md:h-5" /> : <Play size={16} fill="currentColor" className="ml-1 md:w-5 md:h-5" />}
                        </button>
                        <button onClick={() => handleControl('next')} disabled={!hostState.permissions.allowControl} className="text-gray-500 hover:text-white transition-colors disabled:opacity-30"><SkipForward size={18} fill="currentColor" className="md:w-5 md:h-5" /></button>
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

                {/* Right: Actions */}
                <div className="shrink-0 md:w-1/3 flex justify-end items-center gap-2 md:gap-4">
                    {hostState.currentTrack && hostState.permissions.personalMode && (
                        <button 
                            onClick={() => socket?.emit('client_command', { type: 'toggle_heart', trackId: hostState.currentTrack?.id })}
                            className="p-1.5 md:p-2 transition-colors active:scale-95 text-gray-500 hover:text-white"
                            title="切換紅心"
                        >
                            <Heart size={18} className="md:w-5 md:h-5" />
                        </button>
                    )}
                    <button 
                        onClick={() => socket?.emit('client_command', { type: 'toggle_roaming' })}
                        className={`p-1.5 md:p-2 transition-colors hidden sm:block ${hostState.permissions.allowControl ? 'hover:text-white text-gray-400' : 'opacity-30 text-gray-500'}`}
                        disabled={!hostState.permissions.allowControl}
                        title="開啟/關閉主機漫遊"
                    >
                        <Compass size={18} className="md:w-5 md:h-5" />
                    </button>
                    <button 
                        onClick={() => setIsQueueOpen(!isQueueOpen)}
                        className={`p-1.5 md:p-2 transition-colors ${isQueueOpen ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
                        title="播放序列"
                    >
                        <ListVideo size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {/* Queue Panel Overlay */}
            {isQueueOpen && (
                <div className="absolute top-0 right-0 bottom-16 md:bottom-24 w-full sm:w-80 bg-[#12121c]/95 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col z-40 animate-in slide-in-from-right duration-300">
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
                            <div 
                                key={i} 
                                onClick={() => hostState.permissions.allowCutSong && socket?.emit('client_command', { type: 'play_queue_index', index: i })}
                                className={`flex items-center gap-3 p-2 rounded-lg group ${hostState.queueIndex === i ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5'} ${hostState.permissions.allowCutSong ? 'cursor-pointer' : ''}`}
                            >
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


            {/* Settings Modal (Simplified, no playback settings here since host handles it) */}
            {isSettingsOpen && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#12121c] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="font-bold flex items-center gap-2"><Settings size={18} className="text-gray-400" /> 點歌機設定</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={16} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-400 text-sm mb-4">主機已接管點擊單曲與播放全部的行為設定。您可以至主機端介面調整預設行為。</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
