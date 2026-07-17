import React, { useState, useEffect } from 'react';
import { Compass, Mic2, Disc3, ListMusic, Heart, DownloadCloud, Play, Pause, Search, Star, Download, PlayCircle, Loader2, MoreHorizontal } from 'lucide-react';
import { NavidromeProvider } from '@/providers/NavidromeProvider';
import { Track, Album, Artist, Playlist } from '@/providers/MusicProvider';
import { TrackList } from './TrackList';
import { ExplorePage } from './ExplorePage';
import { offlineManager } from '@/providers/OfflineManager';
import { AlbumDetailsView } from './AlbumDetailsView';
import { ArtistDetailsView } from './ArtistDetailsView';
import { PlaylistDetailsView } from './PlaylistDetailsView';
import { useTranslation } from '@/providers/I18nProvider';

type NavTab = 'explore' | 'artists' | 'albums' | 'playlists' | 'favorites' | 'downloads';

export const NavidromeView: React.FC<{
    provider: NavidromeProvider;
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
    const [artists, setArtists] = useState<Artist[]>([]);
    const [indexes, setIndexes] = useState<{ index: string, artists: Artist[] }[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [tracks, setTracks] = useState<Track[]>([]);

    // States for detailed views
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    // Playlist Context Menu State
    const [menuPlaylistId, setMenuPlaylistId] = useState<string | null>(null);

    // States for Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ artists: Artist[], tracks: Track[], albums: Album[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

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
        try {
            const list = await provider.getPlaylists();
            setPlaylists(list);
        } catch (e) {
            console.error("Failed to fetch playlists:", e);
        }
    };

    const handleRenamePlaylist = async (id: string, oldName: string) => {
        const newName = prompt('請輸入新的播放清單名稱 (Enter new playlist name):', oldName);
        if (newName && newName !== oldName) {
            try {
                await provider.updatePlaylist(id, newName);
                fetchPlaylists(); // Refresh
            } catch (e) {
                console.error(e);
                alert('重新命名失敗 (Failed to rename)');
            }
        }
    };

    const handleDeletePlaylist = async (id: string) => {
        if (confirm('確定要刪除這個播放清單嗎？(Are you sure you want to delete this playlist?)')) {
            try {
                await provider.deletePlaylist(id);
                fetchPlaylists(); // Refresh
            } catch (e) {
                console.error(e);
                alert('刪除失敗 (Failed to delete)');
            }
        }
    };

    const fetchTabContent = async (tab: NavTab) => {
        setIsLoading(true);
        try {
            switch (tab) {
                case 'artists':
                    const idxs = await provider.getIndexes();
                    setIndexes(idxs);
                    break;
                case 'albums':
                    const topAlbums = await provider.getTopAlbums();
                    setAlbums(topAlbums);
                    break;
                case 'playlists':
                    await fetchPlaylists();
                    break;
                case 'favorites':
                    const fav = await provider.getStarred();
                    setTracks(fav.tracks || []);
                    break;
                case 'downloads':
                    const downloaded = offlineManager.getDownloadedTracks();
                    setTracks(downloaded);
                    break;
            }
        } catch (e) {
            console.error("Failed to load tab content", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const handleReload = (e: any) => {
            if (e.detail === 'navidrome' || !e.detail) {
                if (activeTab !== 'explore') {
                    fetchTabContent(activeTab);
                }
            }
        };
        window.addEventListener('sonicpulse-reload-source', handleReload);
        window.addEventListener('sonicpulse-liked-songs-updated', handleReload);
        return () => {
            window.removeEventListener('sonicpulse-reload-source', handleReload);
            window.removeEventListener('sonicpulse-liked-songs-updated', handleReload);
        };
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'explore') {
            fetchTabContent(activeTab);
        }
    }, [activeTab]);

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-transparent text-white rounded-tl-2xl overflow-hidden relative">
            {/* Inner Sidebar for Navidrome */}
            <div className="w-full h-auto md:w-56 bg-[#050508]/40 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/10 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-2 md:p-5 gap-2 md:gap-2 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)] hide-scrollbar shrink-0 items-center md:items-stretch">
                <div className="flex items-center md:block shrink-0 gap-2 md:gap-0">
                    <h3 className="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-2">{t('navidrome.library')}</h3>
                    
                    <NavButton active={activeTab === 'explore' && !selectedAlbum && !selectedArtist} onClick={() => handleTabClick('explore')} icon={<Compass size={18} />} label={t('navidrome.explore')} />
                    <NavButton active={activeTab === 'favorites' && !selectedAlbum && !selectedArtist} onClick={() => handleTabClick('favorites')} icon={<Heart size={18} />} label={t('navidrome.favorites')} />
                    <NavButton active={activeTab === 'playlists' && !selectedAlbum && !selectedArtist} onClick={() => handleTabClick('playlists')} icon={<ListMusic size={18} />} label={t('navidrome.playlists')} />
                </div>
                
                <div className="flex items-center md:block shrink-0 gap-2 md:gap-0">
                    <h3 className="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 md:mt-6 px-2">{t('navidrome.music')}</h3>
                    <NavButton active={activeTab === 'albums' && !selectedAlbum && !selectedArtist} onClick={() => handleTabClick('albums')} icon={<Disc3 size={18} />} label={t('navidrome.albums')} />
                    <NavButton active={activeTab === 'artists' && !selectedArtist && !selectedArtist} onClick={() => handleTabClick('artists')} icon={<Mic2 size={18} />} label={t('navidrome.artists')} />
                </div>
                
                <div className="flex items-center md:block shrink-0 gap-2 md:gap-0">
                    <h3 className="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 md:mt-6 px-2">{t('navidrome.offline')}</h3>
                    <NavButton active={activeTab === 'downloads' && !selectedAlbum && !selectedArtist} onClick={() => handleTabClick('downloads')} icon={<DownloadCloud size={18} />} label={t('navidrome.downloads')} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 relative flex flex-col">
                {/* Search Bar */}
                <div className="mb-6 shrink-0">
                    <div className="relative w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={t('navidrome.searchPlaceholder')} 
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (e.target.value.trim().length > 0) {
                                    setSelectedAlbum(null);
                                    setSelectedArtist(null);
                                }
                            }}
                            className="w-full bg-white/5 border border-white/5 rounded-full py-2.5 pl-12 pr-6 text-sm focus:outline-none focus:bg-white/10 transition-all placeholder-gray-500" 
                        />
                    </div>
                </div>

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                    </div>
                )}

                {/* Sub-views take precedence over tabs and search results */}
                {selectedAlbum ? (
                    <AlbumDetailsView 
                        album={selectedAlbum} 
                        provider={provider} 
                        onBack={() => setSelectedAlbum(null)} 
                        onPlayTrack={onPlayTrack} 
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                        currentTrackId={currentTrackId} 
                        isPlaying={isPlaying} 
                    />
                ) : selectedArtist ? (
                    <ArtistDetailsView 
                        artist={selectedArtist} 
                        provider={provider} 
                        onBack={() => setSelectedArtist(null)} 
                        onAlbumClick={(album) => setSelectedAlbum(album)} 
                    />
                ) : isSearching ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : searchResults ? (
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-6">{t('navidrome.searchResults')}</h2>
                        {searchResults.artists.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-500 border-b border-white/10 pb-2 mb-4">{t('navidrome.artists')}</h3>
                                <div className="grid grid-cols-5 gap-4">
                                    {searchResults.artists.map(artist => (
                                        <div key={artist.id} className="flex flex-col items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group" onClick={() => setSelectedArtist(artist)}>
                                            <div className="w-24 h-24 rounded-full bg-white/10 mb-3 overflow-hidden flex items-center justify-center relative">
                                                {artist.coverUrl ? (
                                                    <img src={artist.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <Mic2 size={32} className="text-gray-500" />
                                                )}
                                            </div>
                                            <h4 className="font-bold text-sm text-center line-clamp-2">{artist.name}</h4>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {searchResults.albums.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-500 border-b border-white/10 pb-2 mb-4">{t('navidrome.albums')}</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    {searchResults.albums.map(album => (
                                        <div key={album.id} className="bg-white/5 p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group" onClick={() => setSelectedAlbum(album)}>
                                            <div className="aspect-square bg-white/10 rounded-lg overflow-hidden mb-3 relative">
                                                {album.coverUrl ? (
                                                    <img src={album.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <Disc3 className="w-full h-full p-8 text-gray-600" />
                                                )}
                                            </div>
                                            <h4 className="font-bold text-sm truncate">{album.name}</h4>
                                            <p className="text-xs text-gray-400 truncate">{album.artist}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {searchResults.tracks.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-500 border-b border-white/10 pb-2 mb-4">Tracks</h3>
                                <TrackList 
                                    tracks={searchResults.tracks} 
                                    provider={provider} 
                                    currentTrackId={currentTrackId} 
                                    isPlaying={isPlaying} 
                                    onPlayTrack={onPlayTrack} 
                                    onPlayNow={onPlayNow}
                                    onPlayNext={onPlayNext}
                                    onAddToQueue={onAddToQueue}
                                />
                            </div>
                        )}
                        {searchResults.artists.length === 0 && searchResults.albums.length === 0 && searchResults.tracks.length === 0 && (
                            <div className="text-gray-500">No results found.</div>
                        )}
                    </div>
                ) : selectedPlaylist ? (
                    <div className="w-full h-full pb-24">
                        <PlaylistDetailsView 
                            playlist={selectedPlaylist} 
                            provider={provider} 
                            onBack={() => setSelectedPlaylist(null)} 
                            onPlayTrack={onPlayTrack}
                            onPlayNow={onPlayNow}
                            onPlayNext={onPlayNext}
                            onAddToQueue={onAddToQueue}
                            currentTrackId={currentTrackId}
                            isPlaying={isPlaying}
                        />
                    </div>
                ) : (
                    <>
                        {activeTab === 'explore' && <ExplorePage provider={provider} onPlayTrack={onPlayTrack} onPlayNow={onPlayNow} onPlayNext={onPlayNext} onAddToQueue={onAddToQueue} />}
                
                {activeTab === 'favorites' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Heart className="text-red-500" /> Favorites</h2>
                        <TrackList 
                            tracks={tracks} 
                            provider={provider} 
                            currentTrackId={currentTrackId} 
                            isPlaying={isPlaying} 
                            onPlayTrack={onPlayTrack} 
                            onPlayNow={onPlayNow}
                            onPlayNext={onPlayNext}
                            onAddToQueue={onAddToQueue}
                        />
                    </div>
                )}

                {activeTab === 'playlists' && (
                    <div onClick={() => setMenuPlaylistId(null)}>
                        <h2 className="text-2xl font-bold mb-6">Playlists</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {playlists.map(pl => (
                                <div key={pl.id} className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group flex items-center gap-4 relative" onClick={() => setSelectedPlaylist(pl)}>
                                    <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center shrink-0">
                                        <ListMusic size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate">{pl.name}</h4>
                                        <p className="text-xs text-gray-400">{pl.trackCount} tracks</p>
                                    </div>
                                    <button 
                                        className="p-2 hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuPlaylistId(pl.id);
                                        }}
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>

                                    {/* Context Menu */}
                                    {menuPlaylistId === pl.id && (
                                        <div className="absolute top-12 right-4 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-[fadeIn_0.1s_ease-out]">
                                            <button 
                                                className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors text-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuPlaylistId(null);
                                                    handleRenamePlaylist(pl.id, pl.name);
                                                }}
                                            >
                                                重新命名 (Rename)
                                            </button>
                                            <button 
                                                className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors text-red-400 text-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuPlaylistId(null);
                                                    handleDeletePlaylist(pl.id);
                                                }}
                                            >
                                                刪除 (Delete)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'albums' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Albums</h2>
                        <div className="grid grid-cols-4 gap-4">
                            {albums.map(album => (
                                <div key={album.id} className="bg-white/5 p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group" onClick={() => setSelectedAlbum(album)}>
                                    <div className="aspect-square bg-white/10 rounded-lg overflow-hidden mb-3 relative">
                                        {album.coverUrl ? (
                                            <img src={album.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <Disc3 className="w-full h-full p-8 text-gray-600" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <PlayCircle size={48} className="text-white drop-shadow-lg" />
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-sm truncate">{album.name}</h4>
                                    <p className="text-xs text-gray-400 truncate">{album.artist}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'artists' && (
                    <div className="flex h-full w-full relative">
                        <div className="flex-1 pr-12 pb-12">
                            <h2 className="text-2xl font-bold mb-6">Artists</h2>
                            {indexes.map(group => (
                                <div key={group.index} id={`artist-group-${group.index}`} className="mb-8">
                                    <h3 className="text-xl font-bold text-gray-500 border-b border-white/10 pb-2 mb-4">{group.index}</h3>
                                    <div className="grid grid-cols-5 gap-4">
                                        {group.artists.map(artist => (
                                            <div key={artist.id} className="flex flex-col items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group" onClick={() => setSelectedArtist(artist)}>
                                                <div className="w-24 h-24 rounded-full bg-white/10 mb-3 overflow-hidden flex items-center justify-center relative">
                                                    {artist.coverUrl ? (
                                                        <img src={artist.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    ) : (
                                                        <Mic2 size={32} className="text-gray-500" />
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-sm text-center line-clamp-2">{artist.name}</h4>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* A-Z Jump Bar */}
                        <div className="w-8 fixed right-8 top-32 bottom-32 flex flex-col items-center justify-center gap-1 z-20">
                            {indexes.map(group => (
                                <button 
                                    key={`jump-${group.index}`}
                                    onClick={() => {
                                        const el = document.getElementById(`artist-group-${group.index}`);
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="text-[10px] font-bold text-gray-500 hover:text-white hover:scale-150 transition-all w-6 h-6 flex items-center justify-center rounded-full hover:bg-purple-500/20"
                                >
                                    {group.index}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'downloads' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><DownloadCloud className="text-blue-500" /> Downloads</h2>
                        <p className="text-sm text-gray-400">Offline tracks will appear here.</p>
                        {/* We will populate this from OfflineManager soon */}
                        <TrackList tracks={tracks} provider={provider} currentTrackId={currentTrackId} isPlaying={isPlaying} onPlayTrack={onPlayTrack} />
                    </div>
                )}
                    </>
                )}
            </div>
        </div>
    );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-full md:rounded-xl transition-all duration-300 text-xs md:text-sm font-medium border ${
            active ? 'bg-purple-500/20 text-purple-200 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] md:translate-x-1' : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:border-white/10'
        }`}
    >
        {icon}
        <span className="hidden md:inline">{label}</span>
    </button>
);
