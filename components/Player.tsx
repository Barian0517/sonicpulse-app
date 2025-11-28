import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, ChevronDown, Maximize2 } from 'lucide-react';

interface PlayerProps {
  fileName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
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
  onVolumeChange
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
      // Restore to last known volume, or default to 0.5
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
          {/* Animated Icon */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 animate-[spin_4s_linear_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
            <Music size={14} className="text-white" />
          </div>
          
          {/* Info */}
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
      {/* Player Container */}
      <div className="mx-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl shadow-blue-900/20 flex flex-col gap-4 relative overflow-hidden group">
        
        {/* Minimize Button */}
        <button 
           onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
           className="absolute top-3 right-3 text-gray-500 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors z-50"
        >
           <ChevronDown size={18} />
        </button>

        {/* Animated Glow Background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />

        {/* Top Row: Info & Controls */}
        <div className="flex items-center gap-4 pr-6">
          
          {/* Album Art Placeholder */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center shrink-0 animate-[spin_10s_linear_infinite] shadow-lg shadow-black/50" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
            <Music size={24} className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]" />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-white font-bold text-sm truncate pr-2">{fileName || "Unknown Track"}</h3>
            <p className="text-blue-400 text-xs font-mono tracking-wider">Local Audio</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
             {/* Volume */}
             <div className="flex items-center gap-2 group/vol relative">
                <button 
                  onClick={handleMuteToggle}
                  className="text-gray-400 hover:text-white transition-all transform hover:scale-110 active:scale-95"
                  title={volume === 0 ? "Unmute" : "Mute"}
                >
                  {volume <= 0.001 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                
                {/* Volume Slider (Expand on hover) */}
                <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 flex items-center">
                   <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="w-20 h-4 bg-transparent cursor-pointer tech-slider"
                   />
                </div>
             </div>

             {/* Play/Pause */}
             <button 
                onClick={onTogglePlay}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 transition-all transform hover:scale-105 active:scale-95 border border-white/10"
             >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
             </button>
          </div>
        </div>

        {/* Bottom Row: Progress */}
        <div className="flex items-center gap-3 text-xs font-mono text-gray-400 mt-1">
            <span className="w-10 text-right">{formatTime(displayTime)}</span>
            
            <div 
              ref={progressBarRef}
              className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative group/progress transition-all hover:h-2"
              onClick={handleProgressClick}
            >
               {/* Buffer/Background */}
               <div className="absolute inset-0 rounded-full bg-white/5"></div>
               
               {/* Fill */}
               <div 
                 className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                 style={{ width: `${progressPercent}%` }}
               >
                  {/* Handle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover/progress:opacity-100 transition-opacity transform scale-125 pointer-events-none" />
               </div>
            </div>

            <span className="w-10">{formatTime(duration)}</span>
        </div>

      </div>
    </div>
  );
};

export default Player;