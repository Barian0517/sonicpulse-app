import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Shuffle, Plus, DownloadCloud, Loader2, Disc3, ListPlus } from 'lucide-react';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { Album, Track } from '../../providers/MusicProvider';
import { TrackList } from './TrackList';

export const AlbumDetailsView: React.FC<{
    album: Album;
    provider: NavidromeProvider;
    onBack: () => void;
    onPlayTrack: (track: Track) => void;
    onPlayNow?: (tracks: Track[], startIndex?: number) => void;
    onPlayNext?: (tracks: Track[]) => void;
    onAddToQueue?: (tracks: Track[]) => void;
    currentTrackId?: string;
    isPlaying: boolean;
}> = ({ album, provider, onBack, onPlayTrack, onPlayNow, onPlayNext, onAddToQueue, currentTrackId, isPlaying }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const details = await provider.getAlbum(album.id);
                setTracks(details.tracks);
            } catch (e) {
                console.error("Failed to load album details", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [album.id, provider]);

    return (
        <div className="flex flex-col h-full relative">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 w-max transition-colors">
                <ArrowLeft size={20} /> Back
            </button>

            <div className="flex items-end gap-6 mb-8">
                <div className="w-48 h-48 rounded-lg overflow-hidden bg-white/10 shrink-0 shadow-2xl">
                    {album.coverUrl ? (
                        <img src={album.coverUrl} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Disc3 size={64} className="text-gray-600" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold text-white">{album.name}</h1>
                    <div className="text-gray-400 flex items-center gap-2 text-sm">
                        <span className="font-bold text-white hover:underline cursor-pointer">{album.artist}</span>
                        <span>•</span>
                        <span>{album.year || 'Unknown Year'}</span>
                        <span>•</span>
                        <span>{album.songCount || tracks.length} tracks</span>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        <button 
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 active:scale-95"
                            onClick={() => {
                                if (tracks.length > 0) {
                                    if (onPlayNow) onPlayNow(tracks, 0);
                                    else onPlayTrack(tracks[0]);
                                }
                            }}
                        >
                            <Play size={18} fill="currentColor" /> 播放全部 (Play All)
                        </button>
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all"
                            onClick={() => {
                                if (tracks.length > 0) {
                                    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                                    if (onPlayNow) onPlayNow(shuffled, 0);
                                    else onPlayTrack(shuffled[0]);
                                }
                            }}
                            title="Shuffle Album"
                        >
                            <Shuffle size={18} />
                        </button>
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all"
                            onClick={() => {
                                if (tracks.length > 0 && onAddToQueue) {
                                    onAddToQueue(tracks);
                                }
                            }}
                            title="加入播放序列 (Add to Queue)"
                        >
                            <Plus size={18} />
                        </button>
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all"
                            onClick={async () => {
                                try {
                                    const pl = await provider.createPlaylist(album.name);
                                    await provider.updatePlaylist(pl.id, undefined, tracks.map(t => t.id));
                                    alert(`已建立播放清單 "${album.name}" 並加入所有歌曲！`);
                                } catch (e) {
                                    console.error(e);
                                    alert('建立播放清單失敗');
                                }
                            }}
                            title="收藏為播放清單 (Save as Playlist)"
                        >
                            <ListPlus size={18} />
                        </button>
                        {/* Download Album */}
                        <button 
                            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-all ml-auto"
                            onClick={async () => {
                                // Simple background download logic
                                for (const t of tracks) {
                                    try {
                                        await provider.downloadTrack(t.id);
                                    } catch (e) {
                                        console.error("Failed to download", t.title, e);
                                    }
                                }
                            }}
                            title="Download Entire Album"
                        >
                            <DownloadCloud size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : (
                    <TrackList 
                        tracks={tracks} 
                        provider={provider} 
                        onPlayTrack={onPlayTrack} 
                        onPlayNow={onPlayNow}
                        onPlayNext={onPlayNext}
                        onAddToQueue={onAddToQueue}
                        currentTrackId={currentTrackId} 
                        isPlaying={isPlaying} 
                    />
                )}
            </div>
        </div>
    );
};
