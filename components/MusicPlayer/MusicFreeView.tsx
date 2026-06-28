import React, { useState, useEffect } from 'react';
import { Search, Loader2, Music2, Plug, Play, PlayCircle, MoreHorizontal, Heart, Clock, ListMusic, Settings2, ShieldCheck, Download } from 'lucide-react';
import { MusicFreeProvider } from '../../providers/MusicFreeProvider';
import { Track } from '../../providers/MusicProvider';
import { MusicFreePluginManager } from './MusicFreePluginManager';
import { useTranslation } from '../../providers/I18nProvider';

export const MusicFreeView: React.FC<{
    provider: MusicFreeProvider;
    onPlayTrack: (track: Track) => void;
    onPlayNow: (tracks: Track[], startIndex?: number) => void;
    currentTrackId?: string;
    isPlaying: boolean;
}> = ({ provider, onPlayTrack, onPlayNow, currentTrackId, isPlaying }) => {
    const [plugins, setPlugins] = useState<any[]>([]);
    const [selectedPluginId, setSelectedPluginId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Track[]>([]);
    const [activeTab, setActiveTab] = useState<'search' | 'history' | 'favorites' | 'playlists' | 'plugins'>('search');
    
    // Favorites and History states
    const [favorites, setFavorites] = useState<Track[]>([]);
    const [history, setHistory] = useState<Track[]>([]);
    const { t } = useTranslation();

    const loadPlugins = async () => {
        try {
            const list = await provider.getPlugins();
            setPlugins(list);
            if (list.length > 0 && !selectedPluginId) {
                setSelectedPluginId(list[0].id);
                provider.setPlugin(list[0].id);
            }
        } catch (e) {
            console.error("Failed to load MusicFree plugins", e);
        }
    };

    const loadFavorites = async () => {
        try {
            const res = await provider.getStarred();
            setFavorites(res.tracks || []);
        } catch (e) {
            console.error(e);
        }
    };

    const loadHistory = () => {
        try {
            const raw = localStorage.getItem('sonicpulse_musicfree_history');
            if (raw) setHistory(JSON.parse(raw));
        } catch(e) {}
    };

    useEffect(() => {
        loadPlugins();
        loadFavorites();
        loadHistory();

        const handleReload = (e: any) => {
            if (e.detail === 'musicfree') {
                loadPlugins();
                loadFavorites();
                loadHistory();
            }
        };
        const handleLikedUpdated = () => {
            loadFavorites();
        };

        window.addEventListener('sonicpulse-reload-source', handleReload);
        window.addEventListener('sonicpulse-liked-songs-updated', handleLikedUpdated);
        return () => {
            window.removeEventListener('sonicpulse-reload-source', handleReload);
            window.removeEventListener('sonicpulse-liked-songs-updated', handleLikedUpdated);
        };
    }, [provider]);

    const handlePluginChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedPluginId(id);
        provider.setPlugin(id);
        setSearchResults([]);
    };

    const performSearch = async (query: string) => {
        if (!query.trim() || !selectedPluginId) return;
        setIsSearching(true);
        try {
            if (selectedPluginId === 'all') {
                const pluginIds = plugins.map(p => p.id);
                const res = await provider.searchAll(query.trim(), pluginIds);
                setSearchResults(res.tracks || []);
            } else {
                const res = await provider.search(query.trim());
                setSearchResults(res.tracks || []);
            }
        } catch(e) {
            console.error("MusicFree search failed", e);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleToggleStar = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        try {
            const current = ((window as any).__sonicpulse_liked_ids || []).includes(track.id);
            await provider.toggleStarTrack(track);
            const ids = new Set((window as any).__sonicpulse_liked_ids || []);
            if (!current) ids.add(track.id);
            else ids.delete(track.id);
            (window as any).__sonicpulse_liked_ids = Array.from(ids);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: !current ? t('player.addLike') : t('player.cancelLike') }));
            window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated'));
            // Force re-render just to update the UI immediately
            setSearchResults([...searchResults]);
        } catch (error) {
            console.error(error);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('common.error') || "操作失敗" }));
        }
    };

    const handlePlayTrack = (trackList: Track[], idx: number) => {
        onPlayNow(trackList, idx);
        // Add to history
        const track = trackList[idx];
        try {
            const raw = localStorage.getItem('sonicpulse_musicfree_history') || '[]';
            const hist: Track[] = JSON.parse(raw);
            const newHist = [track, ...hist.filter(t => t.id !== track.id)].slice(0, 100);
            localStorage.setItem('sonicpulse_musicfree_history', JSON.stringify(newHist));
            setHistory(newHist);
        } catch(e) {}
    };

    // Auto-search when query changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (activeTab === 'search') performSearch(searchQuery);
        }, 800);
        return () => clearTimeout(timeout);
    }, [searchQuery, selectedPluginId, activeTab, plugins]);

    const formatTime = (sec: number) => {
        if (!sec) return '--:--';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderTrackList = (tracks: Track[], emptyIcon: React.ReactNode, emptyMessage: string) => {
        if (tracks.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 pb-32">
                    <div className="mb-4 opacity-20 scale-150">{emptyIcon}</div>
                    <p className="text-lg">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-2 pb-32">
                {tracks.map((track, idx) => (
                    <div 
                        key={track.id + idx}
                        className={`group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 border ${currentTrackId === track.id ? 'bg-purple-500/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                    >
                        <div 
                            className="relative w-12 h-12 bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-inner cursor-pointer"
                            onClick={() => handlePlayTrack(tracks, idx)}
                        >
                            {track.coverUrl ? (
                                <img src={track.coverUrl} className={`w-full h-full object-cover transition-transform duration-500 ${currentTrackId === track.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                            ) : (
                                <Music2 size={20} className="text-gray-500" />
                            )}
                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${currentTrackId === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                {currentTrackId === track.id && isPlaying ? (
                                    <div className="w-5 h-5 flex items-center justify-center gap-0.5">
                                        <div className="w-1 h-3 bg-purple-400 animate-pulse" />
                                        <div className="w-1 h-5 bg-purple-400 animate-pulse delay-75" />
                                        <div className="w-1 h-4 bg-purple-400 animate-pulse delay-150" />
                                    </div>
                                ) : (
                                    <Play size={20} className="text-white ml-1 shadow-lg" fill="currentColor" />
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0" onDoubleClick={() => handlePlayTrack(tracks, idx)}>
                            <div className={`font-bold text-base truncate mb-1 ${currentTrackId === track.id ? 'text-purple-300' : 'text-white group-hover:text-purple-200'} transition-colors`}>{track.title}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-purple-400 border border-purple-400/30 px-1 rounded uppercase tracking-wider shrink-0 font-bold bg-purple-400/10">MUSICFREE</span>
                                <span className="text-sm text-gray-400 truncate">{track.artist}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => handleToggleStar(e, track)} className={`hover:scale-110 transition-transform ${((window as any).__sonicpulse_liked_ids || []).includes(track.id) ? 'text-red-500' : 'text-gray-600 hover:text-white'}`} title={((window as any).__sonicpulse_liked_ids || []).includes(track.id) ? t('player.cancelLike') : t('player.addLike')}>
                                <Heart size={20} className={((window as any).__sonicpulse_liked_ids || []).includes(track.id) ? 'fill-red-500' : ''} />
                            </button>
                            <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                        <div className="text-xs font-medium text-gray-500 w-16 text-right tabular-nums">
                            {formatTime(track.duration)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-full w-full bg-transparent text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-56 bg-black/40 border-r border-white/10 flex flex-col py-6 px-4 gap-2 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 px-3 pb-6 mb-2 border-b border-white/5">
                    <Plug className="text-purple-400" size={24} />
                    <span className="font-black text-lg tracking-wide text-white">MusicFree</span>
                </div>

                <div className="flex flex-col gap-1 flex-1">
                    <button 
                        onClick={() => setActiveTab('search')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'search' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Search size={18} />
                        {t('musicfree.searchMusic')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'history' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Clock size={18} />
                        {t('musicfree.playHistory')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('favorites')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'favorites' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Heart size={18} />
                        {t('musicfree.favorites')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('playlists')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'playlists' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <ListMusic size={18} />
                        {t('musicfree.playlists')}
                    </button>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <button 
                    onClick={() => setActiveTab('plugins')}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'plugins' ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Settings2 size={18} />
                    {t('pluginManager.title')}
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-black/20 p-8">
                {activeTab === 'search' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black tracking-tight text-white/90">{t('musicfree.searchMusic')}</h2>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-4 py-2 backdrop-blur-md">
                                    <Plug size={16} className="text-gray-400 mr-2" />
                                    <select 
                                        value={selectedPluginId}
                                        onChange={handlePluginChange}
                                        className="bg-transparent text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-4"
                                    >
                                        <option value="all" className="bg-[#1e1e2e] text-purple-400 font-bold">🌟 {t('musicfree.allPlugins')}</option>
                                        {plugins.map(p => (
                                            <option key={p.id} value={p.id} className="bg-[#1e1e2e] text-white">
                                                {p.platform} (v{p.version})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative w-64">
                                    <input
                                        type="text"
                                        placeholder={t('musicfree.searchPlaceholder')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                performSearch(searchQuery);
                                            }
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all backdrop-blur-md"
                                    />
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    {isSearching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {searchResults.length > 0 ? (
                                renderTrackList(searchResults, <Search />, t('musicfree.searchResults'))
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                    {searchQuery ? (
                                        isSearching ? (
                                            <>
                                                <Loader2 size={48} className="animate-spin text-purple-500/50 mb-4" />
                                                <p className="text-lg">{t('musicfree.searching')}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Search size={48} className="mb-4 opacity-20" />
                                                <p className="text-lg">{t('musicfree.noResults')}</p>
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <Search size={48} className="mb-4 opacity-20" />
                                            <p className="text-lg">{t('musicfree.searchPrompt')}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <>
                        <h2 className="text-3xl font-black mb-8 text-white tracking-tight flex items-center gap-3">
                            <Clock className="text-purple-400" /> {t('musicfree.recentlyPlayed')}
                        </h2>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {renderTrackList(history, <Clock />, t('musicfree.noHistory'))}
                        </div>
                    </>
                )}

                {activeTab === 'favorites' && (
                    <>
                        <h2 className="text-3xl font-black mb-8 text-white tracking-tight flex items-center gap-3">
                            <Heart className="text-red-400 fill-red-400/20" /> {t('musicfree.favoriteMusic')}
                        </h2>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {renderTrackList(favorites, <Heart />, t('musicfree.noFavorites'))}
                        </div>
                    </>
                )}

                {activeTab === 'playlists' && (
                    <>
                        <h2 className="text-3xl font-black mb-8 text-white tracking-tight flex items-center gap-3">
                            <ListMusic className="text-purple-400" /> {t('musicfree.playlists')}
                        </h2>
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center text-gray-500">
                            <ShieldCheck size={48} className="mb-4 opacity-20" />
                            <p className="text-lg">{t('musicfree.playlistsWip')}</p>
                        </div>
                    </>
                )}

                {activeTab === 'plugins' && (
                    <div className="flex-1 overflow-hidden">
                        <MusicFreePluginManager provider={provider} />
                    </div>
                )}
            </div>
        </div>
    );
};
