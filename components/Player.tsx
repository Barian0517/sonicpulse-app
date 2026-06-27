import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, ChevronDown, Maximize2, SkipBack, SkipForward, List, ArrowLeft, X } from 'lucide-react';

interface PlayerProps {
  fileName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  
  playlist?: {name: string, url: string, track?: any}[];
  currentIndex?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSelectTrack?: (index: number) => void;
  
  isRoamingMode?: boolean;
  onToggleRoaming?: (isRoaming: boolean) => void;
  onStartRoaming?: (track: any) => void;
  onLikeTrack?: (track: any) => void;
  isLiked?: boolean;
}

import { Compass, Heart as HeartIcon, Plus } from 'lucide-react';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Player: React.FC<PlayerProps> = ({
  fileName,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  playlist = [],
  currentIndex = -1,
  onNext,
  onPrev,
  onSelectTrack,
  isRoamingMode = false,
  onToggleRoaming,
  onStartRoaming,
  onLikeTrack,
  isLiked = false
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [localSeek, setLocalSeek] = useState<number | null>(null);
  const lastVolumeRef = useRef<number>(0.5);

  // Sync volume with parent, but only if not actively dragging (handled by localVolume updating immediately)
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // Reset showPlaylist when minimized
  useEffect(() => {
    if (isMinimized) {
      setShowPlaylist(false);
    }
  }, [isMinimized]);

  // Click outside to minimize
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isMinimized && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMinimized(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMinimized]);

  useEffect(() => {
    if (volume > 0) lastVolumeRef.current = volume;
  }, [volume]);

  const handleMuteToggle = () => {
    if (localVolume > 0) {
        setLocalVolume(0);
        onVolumeChange(0);
    } else {
        const restore = lastVolumeRef.current || 0.5;
        setLocalVolume(restore);
        onVolumeChange(restore);
    }
  };

  const handleVolumeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setLocalVolume(v);
      onVolumeChange(v);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    
    const updateSeek = (clientX: number) => {
        const x = clientX - rect.left;
        const percentage = Math.min(Math.max(x / rect.width, 0), 1);
        setLocalSeek(percentage * duration);
    };
    
    updateSeek(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
        updateSeek(moveEvent.clientX);
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        const finalX = upEvent.clientX - rect.left;
        const percentage = Math.min(Math.max(finalX / rect.width, 0), 1);
        onSeek(percentage * duration);
        setLocalSeek(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const displayTime = localSeek !== null ? localSeek : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const currentTrackObj = playlist[currentIndex]?.track;

  // Render Animated EQ Bars when playing
  const renderEQBars = () => (
    <div className="flex items-end gap-0.5 h-3 opacity-80">
        <div className={`w-0.5 bg-purple-400 rounded-full ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{ height: isPlaying ? '100%' : '20%' }} />
        <div className={`w-0.5 bg-purple-400 rounded-full ${isPlaying ? 'animate-[bounce_1.2s_infinite_0.1s]' : 'h-1'}`} style={{ height: isPlaying ? '70%' : '20%' }} />
        <div className={`w-0.5 bg-purple-400 rounded-full ${isPlaying ? 'animate-[bounce_0.9s_infinite_0.2s]' : 'h-1'}`} style={{ height: isPlaying ? '90%' : '20%' }} />
    </div>
  );

  const containerStyle = {
    width: isMinimized ? '280px' : 'min(640px, calc(100vw - 32px))',
    height: isMinimized ? '56px' : (showPlaylist ? '380px' : '330px'),
    borderRadius: isMinimized ? '28px' : '32px',
  };

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Morphing Container */}
      <div 
        style={containerStyle}
        className={`transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] relative overflow-hidden group/player 
          bg-[#130b24]/90 backdrop-blur-2xl border border-white/10 border-t-purple-500/20 
          shadow-[0_20px_60px_-15px_rgba(168,85,247,0.3)] 
          ${isMinimized ? 'hover:bg-[#1a0f30]/95 hover:border-purple-500/40 hover:scale-105 cursor-pointer' : ''}
        `}
        onClick={() => { if (isMinimized) setIsMinimized(false); }}
      >

        {/* ================= MINIMIZED VIEW ================= */}
        <div className={`absolute inset-0 flex items-center justify-between px-2 transition-all duration-500 ${isMinimized ? 'opacity-100 delay-300 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'}`}>
            {/* Subtle glow inside */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="flex items-center gap-3">
                {/* Cover Art Mini */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden relative z-10 border border-white/10 shadow-inner">
                    <div className={`absolute inset-0 transition-transform duration-[4s] ease-linear ${isPlaying ? 'rotate-180 animate-[spin_4s_linear_infinite]' : ''}`}>
                        {currentTrackObj?.coverUrl ? (
                            <img src={currentTrackObj.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                            <Music size={16} className="text-white/80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                    </div>
                    {currentTrackObj?.coverUrl && <div className="absolute w-2 h-2 rounded-full bg-[#130b24] shadow-inner" />}
                </div>
                
                <div className="flex flex-col relative z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-bold max-w-[130px] truncate">{currentTrackObj?.title || fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {renderEQBars()}
                        <span className="text-[10px] text-purple-400/80 font-medium tracking-wider">
                            {isPlaying ? currentTrackObj?.artist || 'NOW PLAYING' : 'PAUSED'}
                        </span>
                    </div>
                </div>
            </div>
            
            <Maximize2 size={16} className="text-purple-400 opacity-0 group-hover/player:opacity-100 transition-all translate-x-2 group-hover/player:-translate-x-2 duration-300 mr-2" />
        </div>

        {/* ================= EXPANDED VIEW ================= */}
        <div className={`absolute inset-0 p-6 flex flex-col transition-all duration-500 ${!isMinimized ? 'opacity-100 delay-300 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-105'}`}>
            
            {/* Subtle Ambient Background Glow */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/10 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50 transition-opacity duration-700" />

            {/* Header Controls */}
            <div className="flex justify-between items-center relative z-10 h-6 shrink-0">
                <div className="flex items-center gap-2 w-24">
                    {showPlaylist ? (
                        <button onClick={(e) => { e.stopPropagation(); setShowPlaylist(false); }} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 group/back">
                            <ArrowLeft size={16} className="group-hover/back:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">Back</span>
                        </button>
                    ) : (
                        <span className="text-[10px] font-black text-purple-400/80 uppercase tracking-[0.2em] flex items-center gap-2">
                            {renderEQBars()}
                            {isPlaying ? "PLAYING" : "PAUSED"}
                        </span>
                    )}
                </div>
                
                {/* Center Toggle Switch */}
                <div className="flex items-center bg-black/40 rounded-full p-1 border border-white/5 shadow-inner" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={() => onToggleRoaming && onToggleRoaming(false)}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all duration-300 ${!isRoamingMode ? 'bg-white/10 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        序列
                    </button>
                    <button 
                        onClick={() => onToggleRoaming && onToggleRoaming(true)}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all duration-300 ${isRoamingMode ? 'bg-purple-500/30 text-purple-200 shadow-md border border-purple-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        漫遊
                    </button>
                </div>

                <div className="flex items-center justify-end gap-1 w-24">
                    {!showPlaylist && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowPlaylist(true); }}
                            className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors active:scale-90"
                            title="Playlist"
                        >
                            <List size={18} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                        className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors active:scale-90"
                        title="Minimize"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>

            <div className="relative flex-1 mt-6">
                {/* PLAYER VIEW */}
                <div className={`absolute inset-0 flex flex-col justify-between transition-all duration-500 ${!showPlaylist ? 'opacity-100 pointer-events-auto scale-100 delay-200' : 'opacity-0 pointer-events-none scale-95'}`}>
                    <div className="flex items-center gap-6">
                        {/* Cover Art */}
                        <div className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/10 group/cover">
                            {currentTrackObj?.coverUrl ? (
                                <img src={currentTrackObj.coverUrl} className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'} group-hover/cover:scale-110`} />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center">
                                    <Music size={32} className="text-purple-500/50" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        </div>

                        {/* Info & Actions */}
                        <div className="flex-1 min-w-0 flex justify-between items-end">
                            <div className="flex flex-col justify-center min-w-0 flex-1 pr-4">
                                <h3 className="text-white font-extrabold text-2xl truncate leading-tight mb-1 tracking-tight">{currentTrackObj?.title || fileName || "Unknown Track"}</h3>
                                <p className="text-purple-300/60 text-sm font-medium truncate">{currentTrackObj?.artist || (playlist.length > 0 ? "Playlist Track" : "Local File")}</p>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pb-1 shrink-0">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if (currentTrackObj && onLikeTrack) onLikeTrack(currentTrackObj); }}
                                    className={`p-2.5 rounded-full border transition-all group/btn active:scale-95 ${isLiked ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'bg-white/5 border-white/5 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 text-gray-400'}`}
                                    title={isLiked ? "取消紅心" : "收藏到紅心"}
                                >
                                    <HeartIcon size={16} className={isLiked ? "fill-current" : "group-hover/btn:scale-110 transition-transform"} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if (currentTrackObj && onStartRoaming) onStartRoaming(currentTrackObj); }}
                                    className={`p-2.5 rounded-full transition-all group/btn active:scale-95 ${isRoamingMode ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-white/5 border border-white/5 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-400 text-gray-400'}`}
                                    title="開啟漫遊"
                                >
                                    <Compass size={16} className={`transition-transform ${isRoamingMode ? 'animate-[spin_4s_linear_infinite]' : 'group-hover/btn:rotate-45'}`} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="p-2.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all group/btn active:scale-95"
                                    title="加入歌單"
                                >
                                    <Plus size={16} className="group-hover/btn:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Progress */}
                    <div className="flex flex-col gap-2">
                        <div 
                            ref={progressBarRef}
                            className="w-full h-2 bg-white/5 rounded-full cursor-pointer relative group/timeline overflow-hidden flex items-center"
                            onMouseDown={handleProgressMouseDown}
                        >
                            <div className="absolute inset-y-0 left-0 w-full bg-white/5 pointer-events-none" />
                            <div 
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full pointer-events-none"
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover/timeline:opacity-100 scale-50 group-hover/timeline:scale-100 transition-all duration-300 translate-x-1/2" />
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-medium text-gray-500 font-mono tracking-wider">
                            <span className="text-purple-400/80">{formatTime(displayTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Main Playback Controls Row */}
                    <div className="flex items-center relative h-[72px]">
                        {/* Volume Control (Bottom Left) */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center group/vol z-20">
                            <button onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }} className="text-gray-400 hover:text-purple-400 transition-colors active:scale-90 p-2 z-10 relative bg-[#130b24] rounded-full">
                                {localVolume <= 0.001 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                            <div className="w-0 opacity-0 transition-all duration-500 ease-out delay-[3000ms] group-hover/vol:w-24 group-hover/vol:opacity-100 group-hover/vol:delay-0 overflow-hidden flex items-center absolute left-8 pl-1 origin-left">
                                <input 
                                    type="range" min="0" max="1" step="0.01" value={localVolume}
                                    onChange={handleVolumeInput}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500 hover:bg-white/20 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Centered Play Controls */}
                        <div className="flex-1 flex items-center justify-center gap-8">
                            <button onClick={(e) => { e.stopPropagation(); if(onPrev) onPrev(); }} className="text-gray-400 hover:text-white transition-all transform active:scale-75 hover:scale-110 p-2">
                                <SkipBack size={28} fill="currentColor" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                                className="w-[72px] h-[72px] rounded-full bg-white text-[#130b24] flex items-center justify-center shadow-[0_10px_30px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105 active:scale-95 border border-white/20 hover:bg-gray-200 z-10"
                            >
                                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if(onNext) onNext(); }} className="text-gray-400 hover:text-white transition-all transform active:scale-75 hover:scale-110 p-2">
                                <SkipForward size={28} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* PLAYLIST VIEW */}
                <div className={`absolute inset-0 flex flex-col transition-all duration-500 ${showPlaylist ? 'opacity-100 pointer-events-auto scale-100 delay-200' : 'opacity-0 pointer-events-none scale-105'}`}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1 -mx-2 px-2">
                        {playlist.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                                <List size={48} className="opacity-20" />
                                <p className="text-sm font-medium">Playlist is empty</p>
                            </div>
                        )}
                        {playlist.map((item, idx) => (
                            <div 
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); if(onSelectTrack) onSelectTrack(idx); }}
                                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 group/item border ${idx === currentIndex ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'bg-transparent border-transparent hover:bg-white/5 text-gray-300'}`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center shrink-0 relative shadow-inner">
                                    {item.track?.coverUrl ? (
                                        <img src={item.track.coverUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Music size={16} className="text-gray-500" />
                                    )}
                                    {idx === currentIndex && isPlaying && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="flex items-end gap-0.5 h-3">
                                                <div className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite]" style={{ height: '100%' }} />
                                                <div className="w-0.5 bg-white rounded-full animate-[bounce_1.2s_infinite_0.1s]" style={{ height: '70%' }} />
                                                <div className="w-0.5 bg-white rounded-full animate-[bounce_0.9s_infinite_0.2s]" style={{ height: '90%' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold truncate ${idx === currentIndex ? 'text-white' : 'group-hover/item:text-white transition-colors'}`}>{item.track?.title || item.name}</h4>
                                    <p className="text-xs text-purple-300/40 truncate">{item.track?.artist || 'Unknown Artist'}</p>
                                </div>
                                <div className="text-xs text-purple-400/60 font-mono">
                                    {item.track?.duration ? formatTime(item.track.duration) : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Player;