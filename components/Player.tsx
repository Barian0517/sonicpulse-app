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
  
  playlist?: {name: string, url: string}[];
  currentIndex?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSelectTrack?: (index: number) => void;
}

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
  onSelectTrack
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [localSeek, setLocalSeek] = useState<number | null>(null);
  const lastVolumeRef = useRef<number>(0.5);

  // Update last volume when volume changes (if not muted)
  useEffect(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [volume]);

  // Handle Mute Toggle
  const handleMuteToggle = () => {
    if (volume > 0) {
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolumeRef.current || 0.5);
    }
  };

  // Handle dragging/clicking progress bar
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(Math.max(x / rect.width, 0), 1);
    onSeek(percentage * duration);
  };

  const displayTime = localSeek !== null ? localSeek : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  // Minimized View
  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 cursor-pointer animate-[fadeIn_0.3s_ease-out]"
      >
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full pl-2 pr-6 py-2 shadow-2xl shadow-blue-900/20 flex items-center gap-3 group transition-all hover:scale-105 hover:bg-black/70 hover:border-blue-500/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 animate-[spin_4s_linear_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
            <Music size={14} className="text-white" />
          </div>
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
                <span className="text-white text-xs font-bold max-w-[150px] truncate">{fileName}</span>
                <Maximize2 size={10} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <span className="text-[10px] text-blue-400 font-mono tracking-wider animate-pulse">
               {isPlaying ? 'PLAYING' : 'PAUSED'}
             </span>
          </div>
        </div>
      </div>
    );
  }

  // Expanded View
  return (
    <div 
      className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 transition-all duration-500 ease-out transform animate-[slideInUp_0.3s_ease-out]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="mx-4 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl shadow-blue-950/40 flex flex-col gap-4 relative overflow-hidden group">
        
        {/* Top Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

        {/* Header Controls */}
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                {showPlaylist ? "Playlist" : "Now Playing"}
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    className={`p-2 rounded-full transition-all ${showPlaylist ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    {showPlaylist ? <ArrowLeft size={16} /> : <List size={16} />}
                </button>
                <button 
                    onClick={() => {
                        // We need a way to clear the audio state in App.tsx
                        // I'll assume adding an onClear prop or using existing cleanup
                        window.dispatchEvent(new CustomEvent('sonicpulse_clear_audio'));
                    }}
                    className="text-gray-500 hover:text-red-400 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>
                <button 
                    onClick={() => setIsMinimized(true)}
                    className="text-gray-500 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronDown size={18} />
                </button>
            </div>
        </div>

        {!showPlaylist ? (
            /* PLAYER VIEW */
            <div className="flex flex-col gap-5 animate-slide-right">
                <div className="flex items-center gap-6">
                    {/* Disc Animation */}
                    <div className="relative w-20 h-20 shrink-0">
                        <div className={`w-full h-full rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-4 border-white/5 flex items-center justify-center shadow-2xl animate-[spin_12s_linear_infinite]`} style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
                            <div className="w-6 h-6 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]" />
                            </div>
                        </div>
                        {/* Needle / Stylus */}
                        <div className={`absolute -top-1 -right-1 w-1 h-8 bg-blue-500/40 rounded-full origin-top transition-transform duration-500 ${isPlaying ? 'rotate-[15deg]' : 'rotate-0'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-xl truncate leading-tight mb-1">{fileName || "Unknown Track"}</h3>
                        <p className="text-blue-400/60 text-xs font-bold uppercase tracking-widest">{playlist.length > 0 ? "Playlist Track" : "Local File"}</p>
                    </div>
                </div>

                {/* Main Controls Row */}
                <div className="flex items-center justify-between px-2">
                    {/* Volume Toggle */}
                    <div className="flex items-center gap-3 group/vol">
                        <button onClick={handleMuteToggle} className="text-gray-400 hover:text-white transition-transform active:scale-90">
                            {volume <= 0.001 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input 
                            type="range" min="0" max="1" step="0.01" value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center gap-6">
                        <button onClick={onPrev} className="text-gray-400 hover:text-blue-400 transition-all transform active:scale-75">
                            <SkipBack size={28} fill="currentColor" />
                        </button>
                        <button 
                            onClick={onTogglePlay}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-[0_8px_25px_rgba(59,130,246,0.4)] transition-all transform hover:scale-105 active:scale-90 border border-white/10"
                        >
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={onNext} className="text-gray-400 hover:text-blue-400 transition-all transform active:scale-75">
                            <SkipForward size={28} fill="currentColor" />
                        </button>
                    </div>

                    {/* Spacer for layout */}
                    <div className="w-20" />
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mt-2">
                    <div 
                        ref={progressBarRef}
                        className="h-2 bg-white/5 rounded-full cursor-pointer relative group/progress overflow-hidden"
                        onClick={handleProgressClick}
                    >
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-100"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-gray-500 font-mono tracking-tighter">
                        <span>{formatTime(displayTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        ) : (
            /* PLAYLIST VIEW */
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 animate-slide-left">
                {playlist.map((track, idx) => (
                    <button 
                        key={idx}
                        onClick={() => onSelectTrack?.(idx)}
                        className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${idx === currentIndex ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        <div className="flex items-center justify-center w-6 text-xs font-mono opacity-40">
                            {idx === currentIndex && isPlaying ? (
                                <div className="flex items-end gap-0.5 h-3">
                                    <div className="w-1 bg-current animate-[musicBar_0.6s_ease-in-out_infinite]" />
                                    <div className="w-1 bg-current animate-[musicBar_0.8s_ease-in-out_infinite]" />
                                    <div className="w-1 bg-current animate-[musicBar_0.7s_ease-in-out_infinite]" />
                                </div>
                            ) : (
                                idx + 1
                            )}
                        </div>
                        <div className="flex-1 text-left truncate">
                            <div className="text-sm font-bold truncate">{track.name}</div>
                            <div className="text-[10px] opacity-60 uppercase tracking-widest font-black">Playlist Track</div>
                        </div>
                        {idx === currentIndex ? (
                             <Pause size={14} fill="currentColor" />
                        ) : (
                             <Play size={14} fill="currentColor" className="opacity-0 group-hover:opacity-100" />
                        )}
                    </button>
                ))}
            </div>
        )}
      </div>

      <style>{`
        @keyframes musicBar {
            0%, 100% { height: 20%; }
            50% { height: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Player;