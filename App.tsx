
import React, { useState, useRef, useEffect } from 'react';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import Player from './components/Player';
import ParticleOverlay from './components/ParticleOverlay';
import { VisualizerConfig, VisualizerShape, VisualizerDirection, VisualizerStyle, SymmetryMode, AudioSourceState, VisualizerMaterial, VisualizerParticleEffect } from './types';
import { translations, Language } from './translations';
import { Maximize2, Minimize2, Eye, Circle } from 'lucide-react';

// Fix for missing WebCodecs types
declare global {
  class AudioEncoder {
    constructor(init: { output: (chunk: any, meta: any) => void, error: (e: any) => void });
    configure(config: any): void;
    encode(data: any): void;
    flush(): Promise<void>;
    close(): void;
  }
  
  class AudioData {
    constructor(init: any);
    close(): void;
  }
}

// Default Configuration
const DEFAULT_CONFIG: VisualizerConfig = {
  shape: VisualizerShape.Circle,
  direction: VisualizerDirection.OutUp,
  style: VisualizerStyle.Line,
  material: VisualizerMaterial.Standard,
  barCount: 128,
  barWidth: 4,
  barLengthScale: 1.5,
  symmetry: SymmetryMode.CenterOut,
  startAngle: 270, // Top
  radius: 150,
  linearGap: 2,
  centerX: 50,
  centerY: 50,
  shakeFactor: 10,
  colorMode: 'dual',
  colorStart: '#00ffff',
  colorEnd: '#ff00ff',
  smoothing: 0.85,
  backgroundImage: null,
  bgShakeIntensity: 0,
  bgShakeSmoothing: 0.5,
  bgVignette: 0,
  bgFloatSpeed: 0,
  bgScale: 1,
  bgPositionX: 50,
  bgPositionY: 50,
  bgRotation: 0,
  
  // Particles
  particleEffect: VisualizerParticleEffect.None,
  particleCount: 100,
  particleSpeed: 1,
  particleSize: 1,
};

const STORAGE_KEY_CONFIG = 'sonicpulse_config';
const STORAGE_KEY_LANG = 'sonicpulse_lang';

const App: React.FC = () => {
  // Load config from local storage or use default
  const [config, setConfig] = useState<VisualizerConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        // Merge with default to ensure all keys exist if schema changes
        const parsed = JSON.parse(saved);
        // Safety check for dangerous values that might freeze the app
        if (parsed.barCount > 1000 && parsed.shape === VisualizerShape.Sphere) {
             parsed.barCount = 1000;
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn("Failed to load saved config:", e);
    }
    return DEFAULT_CONFIG;
  });

  const [audioState, setAudioState] = useState<AudioSourceState>({ 
    isPlaying: false, 
    mode: 'file',
    monitorAudio: false,
    volume: 0.7
  });

  // Player State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // UI State
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [isGlobalMute, setIsGlobalMute] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAutoRender, setIsAutoRender] = useState(false); // Track if recording was started by "Render"
  const [recordingTime, setRecordingTime] = useState(0); // Timer in seconds
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null); // For capturing audio output

  // Load language from local storage or use default
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved && (saved === 'en' || saved === 'zh' || saved === 'ja')) {
        return saved as Language;
      }
    } catch (e) {}
    return 'en';
  });

  const t = translations[language];
  
  // Persist config changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }, [config]);

  // Persist language changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, language);
  }, [language]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Recording Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null); // Global Mute
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Hidden video ref for maintaining system audio stream lifecycle
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize Audio Context once
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Master Gain for Global Mute
      const masterGain = audioContextRef.current.createGain();
      masterGain.connect(audioContextRef.current.destination);
      masterGainRef.current = masterGain;

      const analyser = audioContextRef.current.createAnalyser();
      // Maximize FFT size to support high bar counts (max is 32768)
      analyser.fftSize = 32768; 
      analyserRef.current = analyser;

      // Global Gain for monitoring/volume
      const gain = audioContextRef.current.createGain();
      gain.gain.value = audioState.volume || 1.0;
      gainNodeRef.current = gain;
      
      // Recording Destination
      const dest = audioContextRef.current.createMediaStreamDestination();
      destRef.current = dest;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    // Apply initial mute state
    if (masterGainRef.current) {
        masterGainRef.current.gain.value = isGlobalMute ? 0 : 1;
    }
  };

  // Handle Global Mute
  useEffect(() => {
     if (masterGainRef.current) {
         // Smooth transition
         const now = audioContextRef.current?.currentTime || 0;
         masterGainRef.current.gain.setTargetAtTime(isGlobalMute ? 0 : 1, now, 0.1);
     }
  }, [isGlobalMute]);

  const cleanupAudio = () => {
    // Disconnect old source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    // Pause audio file
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    // Stop tracks on hidden video stream (System/Mic)
    if (hiddenVideoRef.current && hiddenVideoRef.current.srcObject) {
      const stream = hiddenVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      hiddenVideoRef.current.srcObject = null;
    }
    
    // Disconnect monitor gain from destination
    if (gainNodeRef.current) {
       gainNodeRef.current.disconnect();
    }
    
    setCurrentTime(0);
    setDuration(0);
  };

  const handleMonitorToggle = (enabled: boolean) => {
    setAudioState(prev => ({ ...prev, monitorAudio: enabled }));
    if (!audioContextRef.current || !gainNodeRef.current || !masterGainRef.current) return;

    if (enabled) {
      // Connect Gain -> Master Gain -> Destination
      gainNodeRef.current.connect(masterGainRef.current);
    } else {
      // Disconnect Gain -> Master Gain
      gainNodeRef.current.disconnect(masterGainRef.current);
    }
  };

  const handleStartMic = async () => {
    try {
      cleanupAudio();
      initAudioContext();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          } 
      });

      setupStream(stream, 'mic');
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied or error occurred.");
    }
  };

  const handleStartSystem = async () => {
    try {
      cleanupAudio();
      initAudioContext();

      // displaySurface: 'browser' tries to prefer tab sharing which is often better for audio
      // @ts-ignore
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Crucial Check: Did they share audio?
      if (stream.getAudioTracks().length === 0) {
        alert("No audio track found! Please ensure you check the 'Share Audio' box in the screen sharing dialog.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      setupStream(stream, 'system');
    } catch (err) {
      console.error("System Audio Error:", err);
    }
  };

  const setupStream = (stream: MediaStream, mode: 'mic' | 'system') => {
      if (!audioContextRef.current || !analyserRef.current || !gainNodeRef.current || !destRef.current) return;

      // 1. Hook stream to hidden video to keep it alive (Chrome requirement)
      if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          hiddenVideoRef.current.muted = true; // Mute element so it doesn't double play
          hiddenVideoRef.current.play().catch(console.error);
      }

      // 2. Create Source
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // 3. Connect: Source -> Analyser -> Gain -> (Destination is handled by Monitor toggle)
      source.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      
      // Connect to recording destination as well (Always record raw input)
      source.connect(destRef.current);
      
      sourceRef.current = source;
      setAudioState(prev => ({ ...prev, isPlaying: true, mode, monitorAudio: false })); // Reset monitor to off to prevent feedback
      
      // Ensure monitor is disconnected initially
      gainNodeRef.current.disconnect();

      // Cleanup when stream ends (user clicks Stop Sharing)
      stream.getTracks()[0].onended = () => {
          cleanupAudio();
          setAudioState(prev => ({ ...prev, isPlaying: false }));
      };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cleanupAudio();
    initAudioContext();

    if (audioElementRef.current && audioContextRef.current && analyserRef.current && gainNodeRef.current && masterGainRef.current && destRef.current) {
      const url = URL.createObjectURL(file);
      audioElementRef.current.src = url;
      audioElementRef.current.load();
      audioElementRef.current.play()
        .then(() => setAudioState(prev => ({ ...prev, isPlaying: true })))
        .catch(e => console.error("Play error:", e));

      const source = audioContextRef.current.createMediaElementSource(audioElementRef.current);
      
      // File Audio Connections:
      // 1. Source -> Analyser -> Gain -> MasterGain -> Speakers
      source.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(masterGainRef.current); // Always on for files
      
      // 2. Source -> Record Destination (Clean audio for recording)
      source.connect(destRef.current);

      sourceRef.current = source;
      setAudioState(prev => ({ ...prev, mode: 'file', fileName: file.name, monitorAudio: true }));
    }
  };

  const handleOutputDeviceChange = async (deviceId: string) => {
    if (!audioContextRef.current) return;
    
    // For Audio Element (Files)
    if (audioElementRef.current && 'setSinkId' in audioElementRef.current) {
         try {
             // @ts-ignore
             await audioElementRef.current.setSinkId(deviceId);
         } catch (e) {
             console.error("Failed to set sinkId on audio element", e);
         }
    }
    
    // For Web Audio Context (Mic/System Monitor)
    // @ts-ignore
    if ('setSinkId' in audioContextRef.current) {
        try {
            // @ts-ignore
            await audioContextRef.current.setSinkId(deviceId);
        } catch (e) {
            console.error("Failed to set sinkId on AudioContext", e);
        }
    }
    
    setAudioState(prev => ({ ...prev, sinkId: deviceId }));
  };

  // Recording Logic
  const handleStartRecording = () => {
    if (!canvasRef.current || !destRef.current) return;
    
    const canvasStream = canvasRef.current.captureStream(60); // 60 FPS
    const audioStream = destRef.current.stream;
    
    // Combine Video and Audio tracks
    const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
    ];
    
    const combinedStream = new MediaStream(combinedTracks);
    
    // Check supported types
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps
    });
    
    recordedChunksRef.current = [];
    
    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
        }
    };
    
    recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `sonicpulse_recording_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        setIsRecording(false);
        setIsAutoRender(false);
    };
    
    recorder.start();
    setIsRecording(true);
    mediaRecorderRef.current = recorder;
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
  };

  // Auto Render Logic (Real-time playback + Record)
  const handleAutoRender = () => {
      if (audioState.mode !== 'file' || !audioElementRef.current) return;
      
      // 1. Reset Audio to Start
      audioElementRef.current.currentTime = 0;
      setCurrentTime(0);
      
      // 2. Start Recording
      handleStartRecording();
      setIsAutoRender(true);
      
      // 3. Play Audio
      audioElementRef.current.play()
        .then(() => setAudioState(prev => ({ ...prev, isPlaying: true })))
        .catch(e => console.error("Auto render play error:", e));
  };

  // Player Controls
  const togglePlay = () => {
    if (audioElementRef.current) {
      if (audioElementRef.current.paused) {
        audioElementRef.current.play();
        setAudioState(prev => ({ ...prev, isPlaying: true }));
      } else {
        audioElementRef.current.pause();
        setAudioState(prev => ({ ...prev, isPlaying: false }));
      }
    }
  };

  const handleSeek = (time: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (vol: number) => {
     setAudioState(prev => ({ ...prev, volume: vol }));
     if (gainNodeRef.current) {
       gainNodeRef.current.gain.value = vol;
     }
  };

  // Bind Audio Element Events
  useEffect(() => {
    const el = audioElementRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => setDuration(el.duration);
    
    const onEnded = () => {
        setAudioState(prev => ({ ...prev, isPlaying: false }));
        // Auto stop recording if in auto-render mode
        if (isAutoRender && mediaRecorderRef.current?.state === 'recording') {
            handleStopRecording();
        }
    };
    
    const onPlay = () => setAudioState(prev => ({ ...prev, isPlaying: true }));
    const onPause = () => setAudioState(prev => ({ ...prev, isPlaying: false }));

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [isAutoRender]); // Re-bind if isAutoRender changes (captured in closure)

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">
      {/* Hidden Video for Stream Keep-Alive */}
      <video ref={hiddenVideoRef} className="hidden" playsInline muted />
      
      {/* Audio Element for File Playback */}
      <audio ref={audioElementRef} className="hidden" crossOrigin="anonymous" />
      
      {/* Atmospheric Particles Overlay */}
      <ParticleOverlay 
          effect={config.particleEffect} 
          count={config.particleCount} 
          speed={config.particleSpeed}
          size={config.particleSize}
      />

      {/* Visualizer (Now handles background internally) */}
      <Visualizer ref={canvasRef} analyser={analyserRef.current} config={config} />

      {/* UI Overlay */}
      <div className={`transition-opacity duration-300 ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <Controls 
            config={config} 
            setConfig={setConfig}
            audioState={audioState}
            onFileSelect={handleFileSelect}
            onStartMic={handleStartMic}
            onStartSystem={handleStartSystem}
            onOutputDeviceChange={handleOutputDeviceChange}
            onToggleMonitor={handleMonitorToggle}
            language={language}
            setLanguage={setLanguage}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onRenderVideo={handleAutoRender} 
            isUIHidden={isUIHidden}
            onToggleUI={() => setIsUIHidden(!isUIHidden)}
            isGlobalMute={isGlobalMute}
            onToggleGlobalMute={() => setIsGlobalMute(!isGlobalMute)}
          />
      </div>
      
      {/* Recording Status / Timer (Top Right) */}
      {isRecording && (
          <div className="absolute top-4 right-16 z-50 flex items-center gap-3 bg-red-900/40 backdrop-blur-md border border-red-500/30 text-white px-4 py-2 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Circle size={10} fill="currentColor" className="text-red-500" />
              <span className="text-sm font-mono font-bold tracking-widest">{formatTimer(recordingTime)}</span>
          </div>
      )}

      {/* Show UI Trigger (Visible when UI is hidden) */}
      {isUIHidden && (
          <div className="absolute top-4 left-4 z-50">
               <button 
                  onClick={() => setIsUIHidden(false)}
                  className="p-2 bg-black/40 text-white/50 hover:text-white rounded-full backdrop-blur-md transition-all border border-white/5 hover:border-white/20 hover:scale-110 active:scale-95 shadow-xl"
               >
                  <Eye size={24} />
               </button>
          </div>
      )}
      
      {/* File Player Overlay */}
      <div className={`transition-opacity duration-300 ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {audioState.mode === 'file' && audioState.fileName && (
             <Player 
                fileName={audioState.fileName}
                isPlaying={audioState.isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={audioState.volume || 0.7}
                onTogglePlay={togglePlay}
                onSeek={handleSeek}
                onVolumeChange={handleVolumeChange}
             />
          )}
      </div>
      
      {/* Fullscreen Toggle */}
      {!isUIHidden && (
          <button 
            onClick={toggleFullscreen}
            className="absolute bottom-4 right-4 z-50 p-3 bg-black/40 text-white rounded-full hover:bg-black/80 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 border border-white/10 hover:border-white/30 group"
          >
            {isFullscreen ? <Minimize2 size={20} className="group-hover:text-blue-400 transition-colors" /> : <Maximize2 size={20} className="group-hover:text-blue-400 transition-colors" />}
          </button>
      )}

      {/* Intro Overlay */}
      {!audioState.isPlaying && audioState.mode !== 'file' && !isUIHidden && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
             <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10 text-white/70 animate-pulse">
                {t.overlay}
             </div>
        </div>
      )}
    </div>
  );
};

export default App;
