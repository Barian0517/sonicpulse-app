import React, { useState, useEffect } from 'react';
import { Search, Heart, Play, Loader2, QrCode, Globe, Tv, Folder } from 'lucide-react';
import { BilibiliProvider } from '../../providers/BilibiliProvider';
import { Track, Album, Artist, Playlist } from '../../providers/MusicProvider';
import { TrackList } from './TrackList';
import { PlaylistDetailsView } from './PlaylistDetailsView';
import QRCode from 'react-qr-code';

type NavTab = 'search' | 'favorites' | 'playlists' | 'login';

export const BilibiliView: React.FC<{
    provider: BilibiliProvider;
    onPlayTrack: (track: Track) => void;
    onPlayNow: (tracks: Track[], startIndex?: number) => void;
    onPlayNext: (tracks: Track[]) => void;
    onAddToQueue: (tracks: Track[]) => void;
    currentTrackId?: string;
    isPlaying: boolean;
}> = ({ provider, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue, currentTrackId, isPlaying }) => {
    const [activeTab, setActiveTab] = useState<NavTab>('search');
    const [isLoading, setIsLoading] = useState(false);

    // States for different views
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [tracks, setTracks] = useState<Track[]>([]);
    
    // Detailed views
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ artists: Artist[], tracks: Track[], albums: Album[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Login State
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('bilibili_cookie'));
    const [qrUrl, setQrUrl] = useState<string>('');
    const [qrKey, setQrKey] = useState<string>('');
    const [qrStatus, setQrStatus] = useState<string>('');
    const [qrErrorLog, setQrErrorLog] = useState<string>('');

    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (searchQuery.trim().length > 1) {
                setIsSearching(true);
                try {
                    const res = await provider.search(searchQuery.trim());
                    setSearchResults(res);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults(null);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchQuery, provider]);

    const handleTabClick = (tab: NavTab) => {
        setSelectedPlaylist(null);
        setSearchQuery('');
        setActiveTab(tab);
    };

    const [playlistsError, setPlaylistsError] = useState<string>('');

    const fetchPlaylists = async () => {
        if (!isLoggedIn) return;
        setPlaylistsError('');
        try {
            const list = await provider.getPlaylists();
            setPlaylistsError(`Provider UID: ${(provider as any).uid}, List length: ${list.length}`);
            setPlaylists(list);
        } catch (e: any) {
            console.error("Failed to fetch bilibili playlists:", e);
            setPlaylistsError(e.message || String(e));
        }
    };

    useEffect(() => {
        const loadTab = () => {
            if (activeTab === 'playlists') {
                fetchPlaylists();
            } else if (activeTab === 'favorites') {
                setIsLoading(true);
                provider.getStarred().then(res => {
                    setTracks(res.tracks);
                }).catch(e => console.error(e)).finally(() => setIsLoading(false));
            } else if (activeTab === 'login' && !isLoggedIn) {
                startLoginFlow();
            }
        };
        
        loadTab();
    }, [activeTab, isLoggedIn]);

    const startLoginFlow = async () => {
        try {
            setQrStatus('產生 QR Code 中...');
            setQrErrorLog('');
            const res = await provider.getLoginQR();
            if (res && res.url) {
                setQrUrl(res.url);
                setQrKey(res.qrcode_key);
                setQrStatus('請使用 Bilibili App 掃描登入');
            } else {
                setQrStatus('產生 QR Code 失敗');
                setQrErrorLog(JSON.stringify(res));
            }
        } catch (e: any) {
            console.error(e);
            setQrStatus('產生 QR Code 失敗');
            setQrErrorLog(e.message || String(e));
        }
    };

    useEffect(() => {
        if (qrKey && activeTab === 'login' && !isLoggedIn) {
            const interval = setInterval(async () => {
                try {
                    const res = await provider.pollLoginQR(qrKey);
                    const data = res.data;
                    
                    if (data.code === 86101) {
                        setQrStatus('請使用 Bilibili App 掃描登入');
                    } else if (data.code === 86090) {
                        setQrStatus('已掃描，請在手機上確認登入');
                    } else if (data.code === 86038) {
                        setQrStatus('QR Code 已過期，請重新整理');
                        clearInterval(interval);
                    } else if (data.code === 0) {
                        setQrStatus('登入成功！');
                        clearInterval(interval);
                        if (data.url) {
                            const success = provider.setCookieFromUrl(data.url);
                            if (success) {
                                setIsLoggedIn(true);
                                setActiveTab('search');
                                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: 'Bilibili 登入成功' }));
                            }
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [qrKey, activeTab, isLoggedIn]);

    const handleLogout = () => {
        provider.logout();
        setIsLoggedIn(false);
        setActiveTab('login');
        window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '已登出 Bilibili' }));
    };

    return (
        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Sidebar / Top Nav */}
            <div className="w-full h-auto md:w-64 bg-white/5 border-b md:border-b-0 md:border-r border-white/10 flex flex-col flex-shrink-0 z-10">
                <div className="p-2 md:p-4 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="搜尋 Bilibili 影片..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#fb7299]/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar md:flex-1 hide-scrollbar px-2 md:px-0 pb-2 md:pb-0 gap-2 md:gap-0 items-center md:items-stretch">
                    <div className="flex md:block md:px-3 md:mb-6 shrink-0 gap-2 md:gap-0">
                        <h3 className="hidden md:block px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">探索與收藏</h3>
                        
                        <button onClick={() => handleTabClick('search')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'search' ? 'bg-[#fb7299]/20 text-[#fb7299]' : 'hover:bg-white/5 text-gray-300'}`}>
                            <Tv size={18} />
                            <span className="hidden md:inline">影片搜尋</span>
                            <span className="md:hidden">搜尋</span>
                        </button>

                        <button onClick={() => handleTabClick('favorites')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'favorites' ? 'bg-[#fb7299]/20 text-[#fb7299]' : 'hover:bg-white/5 text-gray-300'}`}>
                            <Heart size={18} />
                            <span className="hidden md:inline">喜歡的影片</span>
                            <span className="md:hidden">喜歡</span>
                        </button>

                        <button onClick={() => handleTabClick('playlists')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'playlists' ? 'bg-[#fb7299]/20 text-[#fb7299]' : 'hover:bg-white/5 text-gray-300'}`}>
                            <Folder size={18} />
                            <span className="hidden md:inline">收藏夾</span>
                            <span className="md:hidden">收藏</span>
                        </button>
                    </div>
                    
                    <div className="flex md:block md:px-3 md:mb-6 md:mt-auto md:pt-6 shrink-0 ml-auto md:ml-0">
                        {!isLoggedIn ? (
                            <button onClick={() => handleTabClick('login')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'login' ? 'bg-[#fb7299]/20 text-[#fb7299]' : 'hover:bg-white/5 text-gray-300'}`}>
                                <QrCode size={18} />
                                登入 Bilibili
                            </button>
                        ) : (
                            <button onClick={handleLogout} className="whitespace-nowrap flex items-center justify-between px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors hover:bg-white/5 text-gray-300 group">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#fb7299]/20 flex items-center justify-center">
                                        <span className="text-[#fb7299] text-[10px] md:text-xs">Me</span>
                                    </div>
                                    <span className="hidden md:inline">已登入</span>
                                </div>
                                <span className="hidden md:inline text-xs text-gray-500 opacity-0 group-hover:opacity-100">登出</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-black/20">
                {searchQuery ? (
                    <div className="p-8">
                        <h2 className="text-2xl font-bold mb-6">「{searchQuery}」的搜尋結果</h2>
                        {isSearching ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#fb7299]" size={32} /></div>
                        ) : searchResults ? (
                            <div className="space-y-8">
                                {searchResults.tracks.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-bold mb-4">影片列表</h3>
                                        <TrackList 
                                            tracks={searchResults.tracks} 
                                            provider={provider as any} 
                                            onPlayTrack={onPlayTrack} 
                                            onPlayNow={onPlayNow}
                                            onPlayNext={onPlayNext}
                                            onAddToQueue={onAddToQueue}
                                            currentTrackId={currentTrackId} 
                                            isPlaying={isPlaying} 
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">找不到任何影片</div>
                        )}
                    </div>
                ) : selectedPlaylist ? (
                    <PlaylistDetailsView
                        playlist={selectedPlaylist}
                        provider={provider as any}
                        onBack={() => setSelectedPlaylist(null)}
                        onPlayTrack={onPlayTrack}
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                        currentTrackId={currentTrackId}
                        isPlaying={isPlaying}
                    />
                ) : activeTab === 'search' ? (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                        <Tv size={64} className="text-[#fb7299]/50 mb-6" />
                        <h2 className="text-2xl font-bold mb-2">Bilibili 影片搜尋</h2>
                        <p className="text-gray-400 max-w-md">
                            在左上角輸入關鍵字即可搜尋 Bilibili 上的影片並作為音樂播放。登入後可瀏覽您的收藏與喜歡的影片。
                        </p>
                    </div>
                ) : activeTab === 'playlists' ? (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold">收藏夾</h2>
                        </div>
                        {playlists.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                {isLoggedIn ? '找不到任何收藏夾' : '請先登入以查看收藏夾'}
                                {playlistsError && (
                                    <div className="mt-4 text-sm text-red-400 bg-red-400/10 p-4 rounded-lg max-w-md break-all">
                                        Debug: {playlistsError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {playlists.map(playlist => (
                                    <div 
                                        key={playlist.id} 
                                        className="group bg-white/5 hover:bg-white/10 p-4 rounded-xl transition-all cursor-pointer"
                                        onClick={() => setSelectedPlaylist(playlist)}
                                    >
                                        <div className="aspect-square bg-white/5 rounded-lg mb-4 flex items-center justify-center relative shadow-lg">
                                            <Folder size={40} className="text-gray-600" />
                                        </div>
                                        <h3 className="font-bold truncate text-gray-100">{playlist.name}</h3>
                                        <p className="text-sm text-gray-400 truncate">{playlist.trackCount} 影片</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'favorites' ? (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold flex items-center gap-3">
                                <Heart className="text-[#fb7299]" fill="currentColor" /> 喜歡的影片
                            </h2>
                            {tracks.length > 0 && (
                                <button 
                                    onClick={() => onPlayNow(tracks)}
                                    className="bg-[#fb7299] hover:bg-[#fb7299]/80 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(251,114,153,0.3)]"
                                >
                                    <Play fill="currentColor" size={18} />
                                    全部播放
                                </button>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#fb7299]" size={32} /></div>
                        ) : tracks.length > 0 ? (
                            <TrackList 
                                tracks={tracks} 
                                provider={provider as any} 
                                onPlayTrack={onPlayTrack} 
                                onPlayNow={onPlayNow}
                                onPlayNext={onPlayNext}
                                onAddToQueue={onAddToQueue}
                                currentTrackId={currentTrackId} 
                                isPlaying={isPlaying} 
                            />
                        ) : (
                            <div className="text-center py-20 text-gray-400">
                                {isLoggedIn ? '您還沒有喜歡的影片' : '請先登入以查看喜歡的影片'}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'login' ? (
                    <div className="flex flex-col items-center justify-center h-full p-8">
                        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center max-w-sm w-full">
                            <div className="w-16 h-16 bg-[#fb7299]/20 rounded-full flex items-center justify-center mb-6">
                                <QrCode size={32} className="text-[#fb7299]" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">登入 Bilibili</h2>
                            <p className="text-sm text-gray-400 mb-8">
                                {qrStatus}
                            </p>
                            
                            <div className="bg-white p-4 rounded-xl mb-6 flex flex-col items-center justify-center">
                                {qrUrl ? (
                                    <QRCode value={qrUrl} size={192} />
                                ) : (
                                    <Globe className="text-gray-300 mb-4" size={48} />
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-3 w-full">
                                <button 
                                    onClick={startLoginFlow}
                                    className="text-sm text-gray-400 hover:text-white transition-colors py-2"
                                >
                                    重新產生 QR Code
                                </button>
                                {qrErrorLog && (
                                    <div className="mt-4 text-xs text-red-400 bg-red-400/10 p-3 rounded-lg max-w-sm w-full break-all text-left overflow-y-auto max-h-32">
                                        <p className="font-bold mb-1">Debug Log:</p>
                                        {qrErrorLog}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
