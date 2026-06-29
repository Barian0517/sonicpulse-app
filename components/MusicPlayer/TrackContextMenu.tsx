import React, { useState, useEffect } from 'react';
import { Play, Heart, DownloadCloud, Plus, MoreHorizontal } from 'lucide-react';
import { MusicProvider, Track, Playlist } from '../../providers/MusicProvider';
import { useTranslation } from '../../providers/I18nProvider';

export const TrackContextMenu: React.FC<{
    track: Track | null;
    position: { x: number, y: number } | null;
    provider: MusicProvider;
    onClose: () => void;
    onPlayTrack?: (track: Track) => void;
    onPlayNext?: (tracks: Track[]) => void;
    onAddToQueue?: (tracks: Track[]) => void;
    onRemoveFromPlaylist?: (track: Track) => void;
    onDownload?: (track: Track) => void;
}> = ({ track, position, provider, onClose, onPlayTrack, onPlayNext, onAddToQueue, onRemoveFromPlaylist, onDownload }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [showPlaylists, setShowPlaylists] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (track && position) {
            provider.getPlaylists().then(setPlaylists).catch(console.error);
            setShowPlaylists(false);
        }
    }, [track, position, provider]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (track) onClose();
        };
        window.addEventListener('click', handleClickOutside);
        // Also listen for contextmenu globally to close this one if clicking somewhere else
        window.addEventListener('contextmenu', handleClickOutside);
        return () => {
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('contextmenu', handleClickOutside);
        };
    }, [track, onClose]);

    if (!track || !position) return null;

    return (
        <div 
            className="fixed z-50 bg-[#151520] border border-white/10 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-xl text-sm"
            style={{ left: Math.max(10, position.x - 220), top: Math.min(position.y, window.innerHeight - 300) }}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.stopPropagation()}
        >
            {!showPlaylists ? (
                <>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                        if (onPlayTrack) onPlayTrack(track);
                        onClose();
                    }}>
                        <Play size={16} /> {t('player.play')}
                    </button>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                        if (onPlayNext) onPlayNext([track]);
                        onClose();
                    }}>
                        <Play size={16} className="rotate-90" /> {t('player.playNext')}
                    </button>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                        if (onAddToQueue) onAddToQueue([track]);
                        onClose();
                    }}>
                        <Plus size={16} /> {t('player.addToQueue')}
                    </button>
                    <div className="h-px bg-white/10 my-1"></div>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => setShowPlaylists(true)}>
                        <Heart size={16} /> {t('player.saveToPlaylist')}
                    </button>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => {
                        if (onDownload) onDownload(track);
                        onClose();
                    }}>
                        <DownloadCloud size={16} /> {t('player.download')}
                    </button>
                    {onRemoveFromPlaylist && (
                        <>
                            <div className="h-px bg-white/10 my-1"></div>
                            <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 text-red-400 transition-colors" onClick={() => {
                                onRemoveFromPlaylist(track);
                                onClose();
                            }}>
                                <MoreHorizontal size={16} /> {t('player.removeFromPlaylist')}
                            </button>
                        </>
                    )}
                </>
            ) : (
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="px-4 py-2 text-xs text-gray-500 font-bold border-b border-white/10 mb-1">{t('player.addToPlaylist')}</div>
                    <button className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-3 text-purple-400 transition-colors" onClick={async () => {
                        const name = prompt(t('player.newPlaylistPrompt'));
                        if (name && name.trim()) {
                            try {
                                const pl = await provider.createPlaylist(name.trim());
                                await provider.updatePlaylist(pl.id, undefined, [track.id]);
                                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.createPlaylistSuccess') || "成功建立並加入播放清單!" }));
                                onClose();
                            } catch (e) { window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.createPlaylistFailed') || "建立失敗" })); }
                        }
                    }}>
                        <Plus size={16} /> {t('player.newPlaylist')}
                    </button>
                    {playlists.map(pl => (
                        <button key={pl.id} className="w-full text-left px-4 py-2 hover:bg-white/10 truncate transition-colors block" onClick={async () => {
                            try {
                                await provider.updatePlaylist(pl.id, undefined, [track.id]);
                                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.addedToPlaylist', { name: pl.name }) || `已加入到 ${pl.name}` }));
                                onClose();
                            } catch (e) { window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: t('player.addToPlaylistFailed') || "加入失敗" })); }
                        }}>
                            {pl.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
