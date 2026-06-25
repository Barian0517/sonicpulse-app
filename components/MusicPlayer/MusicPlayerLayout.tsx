import React, { useState, useEffect, useRef } from 'react';
import { Settings, Music2, Disc, PlaySquare, Search, Library, FolderOpen, Play, Pause, SkipBack, SkipForward, Server } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { LocalProvider } from '../../providers/LocalProvider';
import { NavidromeProvider } from '../../providers/NavidromeProvider';
import { Track, Album } from '../../providers/MusicProvider';

export const MusicPlayerLayout: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    audioElementRef: React.RefObject<HTMLAudioElement | null>;
    onPlay: (url: string, title: string, coverUrl?: string) => void;
}> = ({ isOpen, onClose, audioElementRef, onPlay }) => {
    const [activeSource, setActiveSource] = useState<'local' | 'navidrome'>('local');
    const [localProvider] = useState(() => new LocalProvider());
    const [naviProvider] = useState(() => new NavidromeProvider());

    const [isLocalReady, setIsLocalReady] = useState(false);
    const [isNaviReady, setIsNaviReady] = useState(false);

    const [tracks, setTracks] = useState<Track[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);

    // Navidrome Settings State
    const [naviUrl, setNaviUrl] = useState('');
    const [naviUser, setNaviUser] = useState('');
    const [naviPass, setNaviPass] = useState('');

    useEffect(() => {
        if (!audioElementRef.current) return;
        const audio = audioElementRef.current;
        
        const handleTimeUpdate = () => setProgress(audio.currentTime);
        const handleVolumeChange = () => setVolume(audio.volume);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false); // TODO: Auto play next

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('volumechange', handleVolumeChange);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('volumechange', handleVolumeChange);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioElementRef]);

    const handleSelectLocalFolder = async () => {
        try {
            const selected = await open({ directory: true });
            if (selected && !Array.isArray(selected)) {
                await localProvider.init(selected);
                setIsLocalReady(true);
                const allTracks = await localProvider.getTracks();
                const allAlbums = await localProvider.getTopAlbums();
                setTracks(allTracks);
                setAlbums(allAlbums);
            }
        } catch (e: any) {
            console.error(e);
            alert("Failed to load folder: " + (e.message || String(e)));
        }
    };

    const handleConnectNavi = async () => {
        try {
            naviProvider.init(naviUrl, naviUser, naviPass);
            // Verify by fetching top albums and random tracks
            const topAlbums = await naviProvider.getTopAlbums();
            const initialTracks = await naviProvider.getTracks();
            setIsNaviReady(true);
            setAlbums(topAlbums);
            setTracks(initialTracks);
        } catch (e: any) {
            console.error(e);
            alert("Failed to connect to Navidrome: " + (e.message || String(e)));
        }
    };

    const playTrack = async (track: Track) => {
        if (!audioElementRef.current) return;
        
        setCurrentTrack(track);
        let url = track.streamUrl || '';
        
        if (track.source === 'local') {
            url = convertFileSrc(url);
        } else if (track.source === 'navidrome') {
            url = await naviProvider.getStreamUrl(track.id);
        }

        // Delegate to App.tsx so it attaches to visualizer
        onPlay(url, `${track.title} ${track.artist ? `by ${track.artist}` : ''}`, track.coverUrl);
        
        // Fetch cover art async if missing
        if (!track.coverUrl) {
            const provider = track.source === 'local' ? localProvider : naviProvider;
            const cover = await provider.getCoverArt(track.id);
            if (cover) {
                setCurrentTrack(prev => prev?.id === track.id ? { ...prev, coverUrl: cover } : prev);
            }
        }
    };

    const togglePlay = () => {
        if (!audioElementRef.current || !currentTrack) return;
        if (isPlaying) audioElementRef.current.pause();
        else audioElementRef.current.play();
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioElementRef.current || !currentTrack) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioElementRef.current.currentTime = ratio * currentTrack.duration;
    };

    const handleVolumeChangeUi = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (audioElementRef.current) audioElementRef.current.volume = val;
    };

    return (
        <div 
            className={`fixed inset-y-0 left-0 w-[800px] max-w-[80vw] bg-[#0a0a0f] text-white flex z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-r border-white/5 ${
                isOpen ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : '-translate-x-full shadow-none pointer-events-none'
            }`}
        >
            {/* Sidebar */}
            <div className="w-20 bg-black/40 border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-[0_0_20px_rgba(147,51,234,0.5)] cursor-pointer" onClick={onClose}>
                    V
                </div>
                
                <div className="flex-1 w-full flex flex-col items-center gap-4 mt-8">
                    <button 
                        onClick={() => setActiveSource('local')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${activeSource === 'local' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                        <Library size={20} />
                        <span className="text-[10px] font-medium">Local</span>
                    </button>
                    
                    <button 
                         onClick={() => setActiveSource('navidrome')}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${activeSource === 'navidrome' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                        <Disc size={20} />
                        <span className="text-[10px] font-medium">Server</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-gradient-to-br from-[#0f1016] to-[#0a0a0f] relative overflow-hidden">
                <div className="h-20 px-8 flex items-center justify-between border-b border-white/5 shrink-0 z-10">
                    <div className="relative w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Search..." className="w-full bg-white/5 border border-white/5 rounded-full py-2.5 pl-12 pr-6 text-sm focus:outline-none focus:bg-white/10 transition-all placeholder-gray-500" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pb-32 custom-scrollbar relative z-0">
                    {activeSource === 'local' && !isLocalReady && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70 hover:opacity-100 transition-opacity">
                            <FolderOpen size={48} className="text-purple-500 mb-2" />
                            <h2 className="text-xl font-bold">Local Music Library</h2>
                            <p className="text-sm text-gray-400 max-w-sm text-center">Scan a folder on your computer to build your local music library.</p>
                            <button onClick={handleSelectLocalFolder} className="mt-4 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all active:scale-95">
                                Select Folder
                            </button>
                        </div>
                    )}

                    {activeSource === 'navidrome' && !isNaviReady && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 max-w-sm mx-auto">
                            <Server size={48} className="text-purple-500 mb-2" />
                            <h2 className="text-xl font-bold">Connect to Navidrome</h2>
                            <input type="text" placeholder="Server URL (e.g. http://localhost:4533)" value={naviUrl} onChange={e => setNaviUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="text" placeholder="Username" value={naviUser} onChange={e => setNaviUser(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <input type="password" placeholder="Password" value={naviPass} onChange={e => setNaviPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                            <button onClick={handleConnectNavi} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all">
                                Connect
                            </button>
                        </div>
                    )}

                    {((activeSource === 'local' && isLocalReady) || (activeSource === 'navidrome' && isNaviReady)) && (
                        <>
                            <h2 className="text-2xl font-bold mb-6">Tracks</h2>
                            <div className="flex flex-col gap-2">
                                {tracks.map(track => (
                                    <div 
                                        key={track.id} 
                                        className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${currentTrack?.id === track.id ? 'bg-purple-500/20 text-purple-200' : 'hover:bg-white/5 text-gray-300'}`}
                                        onClick={() => playTrack(track)}
                                    >
                                        <div className="w-10 h-10 bg-white/10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-gray-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm truncate text-white">{track.title}</div>
                                            <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 w-16 text-right">
                                            {formatTime(track.duration)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Bottom Player */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#050508]/90 backdrop-blur-xl border-t border-white/5 flex items-center px-6 gap-6 z-20">
                    <div className="flex items-center gap-4 w-1/3 shrink-0 min-w-0">
                        <div className="w-14 h-14 bg-white/10 rounded-xl overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                            {currentTrack?.coverUrl ? (
                                <img src={currentTrack.coverUrl} className="w-full h-full object-cover" />
                            ) : (
                                <Music2 size={24} className="text-gray-600" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{currentTrack?.title || "No track playing"}</h4>
                            <p className="text-xs text-gray-400 truncate">{currentTrack?.artist || "-"}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-6">
                            <button className="text-gray-500 hover:text-white transition-colors"><SkipBack size={20} fill="currentColor" /></button>
                            <button onClick={togglePlay} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                            </button>
                            <button className="text-gray-500 hover:text-white transition-colors"><SkipForward size={20} fill="currentColor" /></button>
                        </div>
                        <div className="w-full max-w-md flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                            <span className="w-8 text-right">{formatTime(progress)}</span>
                            <div 
                                className="flex-1 h-3 flex items-center cursor-pointer group/timeline" 
                                onClick={handleTimelineClick}
                                onMouseEnter={() => setIsHoveringTimeline(true)}
                                onMouseLeave={() => setIsHoveringTimeline(false)}
                            >
                                <div className={`w-full bg-white/10 rounded-full overflow-hidden transition-all duration-200 ${isHoveringTimeline ? 'h-2' : 'h-1'}`}>
                                    <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-100 ease-linear" style={{ width: `${currentTrack?.duration ? (progress / currentTrack.duration) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                            <span className="w-8">{formatTime(currentTrack?.duration || 0)}</span>
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-end items-center shrink-0 text-gray-400 text-sm gap-4">
                       <button className="hover:text-white transition-colors">Lyrics</button>
                       <div className="flex items-center gap-2 group w-24">
                           <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChangeUi} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400" />
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
