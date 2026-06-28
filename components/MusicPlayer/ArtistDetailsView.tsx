import React, { useState, useEffect } from 'react';
import { ArrowLeft, PlayCircle, Loader2, Mic2 } from 'lucide-react';
import { MusicProvider, Album, Artist } from '../../providers/MusicProvider';
import { useTranslation } from '../../providers/I18nProvider';

export const ArtistDetailsView: React.FC<{
    artist: Artist;
    provider: MusicProvider;
    onBack: () => void;
    onAlbumClick: (album: Album) => void;
}> = ({ artist, provider, onBack, onAlbumClick }) => {
    const [albums, setAlbums] = useState<Album[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { t } = useTranslation();

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const details = await provider.getArtist(artist.id);
                setAlbums(details.albums);
            } catch (e) {
                console.error("Failed to load artist details", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [artist.id, provider]);

    return (
        <div className="flex flex-col h-full relative">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 w-max transition-colors">
                <ArrowLeft size={20} /> {t('common.back')}
            </button>

            <div className="flex items-end gap-6 mb-8">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-white/10 shrink-0 shadow-xl flex items-center justify-center">
                    {artist.coverUrl ? (
                        <img src={artist.coverUrl} className="w-full h-full object-cover" />
                    ) : (
                        <Mic2 size={48} className="text-gray-600" />
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold text-white">{artist.name}</h1>
                    <div className="text-gray-400 flex items-center gap-2 text-sm">
                        <span>{t('artist.albumCount', { count: artist.albumCount || albums.length })}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : (
                    <div>
                        <h2 className="text-xl font-bold mb-4">{t('artist.albums')}</h2>
                        <div className="grid grid-cols-4 gap-4">
                            {albums.map(album => (
                                <div key={album.id} className="bg-white/5 p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group" onClick={() => onAlbumClick(album)}>
                                    <div className="aspect-square bg-white/10 rounded-lg overflow-hidden mb-3 relative">
                                        {album.coverUrl ? (
                                            <img src={album.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                <Mic2 className="text-gray-600" size={32} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <PlayCircle size={48} className="text-white drop-shadow-lg" />
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-sm truncate">{album.name}</h4>
                                    <p className="text-xs text-gray-400 truncate">{album.year || ''}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
