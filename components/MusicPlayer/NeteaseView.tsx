import React, { useState, useEffect } from 'react';
import { Compass, Mic2, Disc3, ListMusic, Heart, DownloadCloud, Play, Pause, Search, Star, Download, PlayCircle, Loader2, MoreHorizontal, QrCode, ArrowLeft, LogOut, Globe } from 'lucide-react';
import { NeteaseProvider } from '../../providers/NeteaseProvider';
import { Track, Album, Artist, Playlist } from '../../providers/MusicProvider';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { TrackList } from './TrackList';
import { ExplorePage } from './ExplorePage';
import { AlbumDetailsView } from './AlbumDetailsView';
import { ArtistDetailsView } from './ArtistDetailsView';
import { PlaylistDetailsView } from './PlaylistDetailsView';
import { useTranslation } from '../../providers/I18nProvider';

type NavTab = 'explore' | 'artists' | 'albums' | 'playlists' | 'favorites' | 'login';

export const NeteaseView: React.FC<{
    provider: NeteaseProvider;
    onPlayTrack: (track: Track) => void;
    onPlayNow: (tracks: Track[], startIndex?: number) => void;
    onPlayNext: (tracks: Track[]) => void;
    onAddToQueue: (tracks: Track[]) => void;
    currentTrackId?: string;
    isPlaying: boolean;
}> = ({ provider, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue, currentTrackId, isPlaying }) => {
    const [activeTab, setActiveTab] = useState<NavTab>('explore');
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();

    // States for different views
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [tracks, setTracks] = useState<Track[]>([]);
    
    // Detailed views
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ artists: Artist[], tracks: Track[], albums: Album[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Login State
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('netease_cookie'));
    const [qrImage, setQrImage] = useState<string>('');
    const [qrKey, setQrKey] = useState<string>('');
    const [qrStatus, setQrStatus] = useState<string>('');

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
        setSelectedAlbum(null);
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setSearchQuery('');
        setActiveTab(tab);
    };

    const fetchPlaylists = async () => {
        if (!isLoggedIn) return;
        try {
            const list = await provider.getPlaylists();
            setPlaylists(list);
        } catch (e) {
            console.error("Failed to fetch playlists:", e);
        }
    };

    const createPlaylist = async (name: string) => {
        try {
            const pl = await provider.createPlaylist(name);
            setPlaylists(prev => [pl, ...prev]);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('netease.playlistCreated') }));
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('netease.createPlaylistFailed') + e.message }));
        }
    };

    const deletePlaylist = async (id: string) => {
        try {
            await provider.deletePlaylist(id);
            setPlaylists(prev => prev.filter(p => p.id !== id));
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('netease.playlistDeleted') }));
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('netease.deletePlaylistFailed') + e.message }));
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
        
        const handleLikedUpdate = () => {
            if (activeTab === 'favorites') loadTab();
        };
        
        const handleReload = (e: any) => {
            if (e.detail === 'netease') {
                loadTab();
            }
        };

        window.addEventListener('sonicpulse-liked-songs-updated', handleLikedUpdate);
        window.addEventListener('sonicpulse-reload-source', handleReload);
        return () => {
            window.removeEventListener('sonicpulse-liked-songs-updated', handleLikedUpdate);
            window.removeEventListener('sonicpulse-reload-source', handleReload);
        };
    }, [activeTab, isLoggedIn]);

    const startLoginFlow = async () => {
        try {
            setQrStatus(t('netease.generatingQr'));
            const key = await provider.getLoginQrKey();
            setQrKey(key);
            const img = await provider.getLoginQrImage(key);
            setQrImage(img);
            setQrStatus(t('netease.scanQrPrompt'));
        } catch (e) {
            console.error(e);
            setQrStatus(t('netease.generateQrFailed'));
        }
    };

    const startWebLogin = async () => {
        setQrStatus(t('netease.webLoginPrompt'));
        setQrImage('');
        
        try {
            const webview = new WebviewWindow('netease-login', {
                url: 'https://music.163.com/#/login',
                title: t('netease.webLoginTitle'),
                width: 800,
                height: 600,
            });

            webview.once('tauri://created', () => {
                const pollInterval = setInterval(async () => {
                    try {
                        const cookies: string[] = await invoke('get_webview_cookies', { windowLabel: 'netease-login' });
                        const musicU = cookies.find(c => c.startsWith('MUSIC_U='));
                        if (musicU) {
                            clearInterval(pollInterval);
                            webview.close();
                            
                            const cookieString = cookies.join('; ');
                            localStorage.setItem('netease_cookie', cookieString);
                            provider.setCookie(cookieString);
                            setQrStatus(t('netease.loginSuccess'));
                            setIsLoggedIn(true);
                            
                            const status = await provider.getLoginStatus();
                            if (status?.profile?.userId) {
                                localStorage.setItem('netease_uid', String(status.profile.userId));
                            }
                            fetchPlaylists();
                            setActiveTab('explore');
                        }
                    } catch (e) {
                        // ignore errors if window is closed or not ready
                    }
                }, 2000);

                webview.onCloseRequested(() => {
                    clearInterval(pollInterval);
                    if (!localStorage.getItem('netease_cookie')) {
                        setQrStatus(t('netease.loginCancelled'));
                    }
                });
            });

            webview.once('tauri://error', (e) => {
                console.error(e);
                setQrStatus(t('netease.openWindowFailed'));
            });
        } catch (e) {
            console.error(e);
            setQrStatus(t('netease.openWindowFailed'));
        }
    };

    useEffect(() => {
        if (qrKey && activeTab === 'login' && !isLoggedIn) {
            const interval = setInterval(async () => {
                try {
                    const res = await provider.checkLoginQr(qrKey);
                    if (res.code === 800) {
                        setQrStatus(t('netease.qrExpired'));
                        clearInterval(interval);
                    } else if (res.code === 802) {
                        setQrStatus(t('netease.waitingConfirm'));
                    } else if (res.code === 803) {
                        setQrStatus(t('netease.loginSuccess'));
                        clearInterval(interval);
                        if (res.cookie) {
                            localStorage.setItem('netease_cookie', res.cookie);
                            // Optionally fetch login status to get user id
                            const status = await provider.getLoginStatus(res.cookie);
                            if (status?.profile?.userId) {
                                localStorage.setItem('netease_uid', String(status.profile.userId));
                            }
                            setIsLoggedIn(true);
                            setActiveTab('explore');
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
        localStorage.removeItem('netease_cookie');
        localStorage.removeItem('netease_uid');
        provider.setCookie('');
        setIsLoggedIn(false);
        setActiveTab('login');
        window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('netease.logoutSuccess') }));
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
                            placeholder={t('netease.searchPlaceholder')} 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar md:flex-1 hide-scrollbar px-2 md:px-0 pb-2 md:pb-0 gap-2 md:gap-0 items-center md:items-stretch">
                    <div className="flex md:block md:px-3 md:mb-6 shrink-0">
                        <h3 className="hidden md:block px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('netease.browse')}</h3>
                        <button onClick={() => handleTabClick('explore')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'explore' ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/5 text-gray-300'}`}>
                            <Compass size={18} />
                            <span className="hidden md:inline">{t('netease.dailyRecommendation')}</span>
                            <span className="md:hidden">探索</span>
                        </button>
                    </div>

                    <div className="flex md:block md:px-3 md:mb-6 shrink-0 gap-2 md:gap-0">
                        <h3 className="hidden md:block px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('netease.myMusicLibrary')}</h3>
                        <button onClick={() => handleTabClick('playlists')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'playlists' ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/5 text-gray-300'}`}>
                            <ListMusic size={18} />
                            <span className="hidden md:inline">{t('netease.myPlaylists')}</span>
                            <span className="md:hidden">歌單</span>
                        </button>
                        <button onClick={() => handleTabClick('favorites')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'favorites' ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/5 text-gray-300'}`}>
                            <Heart size={18} />
                            <span className="hidden md:inline">{t('netease.myFavorites')}</span>
                            <span className="md:hidden">我的最愛</span>
                        </button>
                    </div>
                    
                    <div className="flex md:block md:px-3 md:mb-6 md:mt-auto md:pt-6 shrink-0 ml-auto md:ml-0">
                        {!isLoggedIn ? (
                            <button onClick={() => handleTabClick('login')} className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors ${activeTab === 'login' ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/5 text-gray-300'}`}>
                                <QrCode size={18} />
                                {t('netease.login')}
                            </button>
                        ) : (
                            <button onClick={handleLogout} className="whitespace-nowrap flex items-center justify-between px-3 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg text-sm font-medium transition-colors hover:bg-white/5 text-gray-300 group">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <span className="text-red-400 text-[10px] md:text-xs">Me</span>
                                    </div>
                                    <span className="hidden md:inline">{t('netease.loggedIn')}</span>
                                </div>
                                <span className="hidden md:inline text-xs text-gray-500 opacity-0 group-hover:opacity-100">{t('netease.logout')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-black/20">
                {searchQuery ? (
                    <div className="p-8">
                        <h2 className="text-2xl font-bold mb-6">{t('netease.searchResultsFor', { query: searchQuery })}</h2>
                        {isSearching ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" size={32} /></div>
                        ) : searchResults ? (
                            <div className="space-y-8">
                                {searchResults.tracks.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-bold mb-4">{t('netease.songs')}</h3>
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
                            <div className="text-center py-12 text-gray-400">{t('netease.noResults')}</div>
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
                ) : selectedAlbum ? (
                    <AlbumDetailsView
                        album={selectedAlbum}
                        provider={provider as any}
                        onBack={() => setSelectedAlbum(null)}
                        onPlayTrack={onPlayTrack}
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                        currentTrackId={currentTrackId}
                        isPlaying={isPlaying}
                    />
                ) : activeTab === 'explore' ? (
                    <ExplorePage 
                        provider={provider as any} 
                        onPlayTrack={onPlayTrack}
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                    />
                ) : activeTab === 'playlists' ? (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold">{t('netease.myPlaylists')}</h2>
                        </div>
                        {playlists.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                {isLoggedIn ? t('netease.noPlaylistsFound') : t('netease.loginToViewPlaylists')}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {playlists.map(playlist => (
                                    <div 
                                        key={playlist.id} 
                                        className="group bg-white/5 hover:bg-white/10 p-4 rounded-xl transition-all cursor-pointer"
                                        onClick={() => setSelectedPlaylist(playlist)}
                                    >
                                        <div className="aspect-square bg-white/5 rounded-lg mb-4 overflow-hidden relative shadow-lg">
                                            {playlist.coverUrl ? (
                                                <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ListMusic size={40} className="text-gray-600" />
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-bold truncate text-gray-100">{playlist.name}</h3>
                                        <p className="text-sm text-gray-400 truncate">{playlist.trackCount} tracks</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'favorites' ? (
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold flex items-center gap-3">
                                <Heart className="text-red-500" fill="currentColor" /> {t('netease.myFavorites')}
                            </h2>
                            {tracks.length > 0 && (
                                <button 
                                    onClick={() => onPlayNow(tracks)}
                                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                                >
                                    <Play fill="currentColor" size={18} />
                                    {t('netease.playAll')}
                                </button>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" size={32} /></div>
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
                                {isLoggedIn ? t('netease.noFavoritesFound') : t('netease.loginToViewFavorites')}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'login' ? (
                    <div className="flex flex-col items-center justify-center h-full p-8">
                        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center max-w-sm w-full">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                <QrCode size={32} className="text-red-400" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{t('netease.loginToNetease')}</h2>
                            <p className="text-sm text-gray-400 mb-8">
                                {qrStatus}
                            </p>
                            
                            <div className="bg-white p-4 rounded-xl mb-6 min-h-[200px] flex flex-col items-center justify-center">
                                {qrImage ? (
                                    <img src={qrImage} alt="Login QR Code" className="w-48 h-48" />
                                ) : (
                                    <Globe className="text-gray-300 mb-4" size={48} />
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-3 w-full">
                                <button 
                                    onClick={startWebLogin}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Globe size={18} />
                                    {t('netease.loginViaWeb')}
                                </button>
                                <button 
                                    onClick={startLoginFlow}
                                    className="text-sm text-gray-400 hover:text-white transition-colors py-2"
                                >
                                    {t('netease.refreshQr')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
