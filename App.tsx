import React, { useState, useRef, useEffect } from 'react';

import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import Player from './components/Player';
import ParticleOverlay from './components/ParticleOverlay';
import { LyricsOverlay } from './components/LyricsOverlay';
import { MusicPlayerLayout } from './components/MusicPlayer/MusicPlayerLayout';
import { NeteaseProvider } from './providers/NeteaseProvider';
import { VisualizerConfig, VisualizerShape, VisualizerDirection, VisualizerStyle, SymmetryMode, AudioSourceState, VisualizerMaterial, VisualizerParticleEffect } from './types';
import { Track } from './providers/MusicProvider';
import { translations, Language } from './translations';
import { Maximize2, Minimize2, Eye, Circle, X, Move, Music } from 'lucide-react';



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
  backgroundMode: 'image',
  backgroundColor: '#0a0a0a',
  backgroundImage: null,
  bgShakeIntensity: 0,
  bgShakeSmoothing: 0.5,
  bgVignette: 0,
  bgFloatSpeed: 0,
  bgScale: 1,
  bgPositionX: 50,
  bgPositionY: 50,
  bgRotation: 0,

  particleEffect: VisualizerParticleEffect.None,
  particleCount: 150,
  particleSpeed: 1,
  particleSize: 1,

  grid3D_pulseEnable: true,
  grid3D_pulseSensitivity: 0.15,
  grid3D_pulseCooldown: 60,
  grid3D_pulseStrength: 0.2,
  
  grid3D_meteorEnable: true,
  grid3D_meteorSensitivity: 0.45,
  grid3D_meteorCooldown: 241,
  grid3D_meteorStrength: 0.5,

  // Lyrics
  lyricsEnabled: false,
  lyricsBlurEnabled: true,
  lyricsBgBlurEnabled: true,
  lyricsGlowEnabled: false, // User screenshots look relatively clean, disable heavy glow by default
  lyricsStrokeEnabled: true,
  lyricsBgEnabled: true,
  lyricsArcEnabled: true,
  lyricsArcDirection: 'left',
  lyricsPositionX: 0,
  lyricsPositionY: 0,
  lyricsFontFamily: 'sans-serif',
  lyricsFontSize: 48,
  lyricsFontWeight: 'bold',
  lyricsFontStyle: 'normal',
  lyricsLetterSpacing: 4,
  lyricsColor: '#ffffff',
  lyricsOpacity: 1,
  
  lyricsStrokeColor: '#000000',
  lyricsStrokeWidth: 2,
  
  lyricsGlowColor: '#000000',
  lyricsGlowRadius: 20,
  lyricsGlowBrightness: 1,
  
  lyricsBgColor: '#000000',
  lyricsBgRadius: 12,
  lyricsBgPadding: 16,
  
  lyricsAnimEnter: 'fade',
  lyricsAnimExit: 'fade',
  lyricsAnimLoop: 'none',

  performanceMode: false,
};

const STORAGE_KEY_CONFIG = 'sonicpulse_config';
const STORAGE_KEY_LANG = 'sonicpulse_lang';
const STORAGE_KEY_MUTE = 'sonicpulse_mute';
const STORAGE_KEY_VOLUME = 'sonicpulse_volume';
const STORAGE_KEY_MONITOR = 'sonicpulse_monitor';
const STORAGE_KEY_OVERLAY_LOCKED = 'sonicpulse_overlay_locked';
const STORAGE_KEY_OVERLAY_X = 'sonicpulse_overlay_x';
const STORAGE_KEY_OVERLAY_Y = 'sonicpulse_overlay_y';
const STORAGE_KEY_OVERLAY_W = 'sonicpulse_overlay_w';
const STORAGE_KEY_OVERLAY_H = 'sonicpulse_overlay_h';

const App: React.FC = () => {
  // Separate storage for each shape
  const [configsByShape, setConfigsByShape] = useState<Record<string, VisualizerConfig>>(() => {
    try {
      const savedDictStr = localStorage.getItem('sonicpulse_configs_dict');
      if (savedDictStr) {
        return JSON.parse(savedDictStr);
      }
      // Migrate from old storage
      const oldSaved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (oldSaved) {
        const parsed = JSON.parse(oldSaved);
        const shape = parsed.shape || VisualizerShape.Circle;
        return { [shape]: { ...DEFAULT_CONFIG, ...parsed } };
      }
    } catch (e) {
      console.warn("Failed to load configs map:", e);
    }
    return {};
  });

  const [config, setConfigInternal] = useState<VisualizerConfig>(() => {
    try {
      let activeShape = localStorage.getItem('sonicpulse_active_shape') as VisualizerShape | null;
      if (!activeShape) {
         const oldSaved = localStorage.getItem(STORAGE_KEY_CONFIG);
         if (oldSaved) {
             const parsed = JSON.parse(oldSaved);
             activeShape = parsed.shape;
         }
      }
      activeShape = activeShape || VisualizerShape.Circle;
      
      const savedDictStr = localStorage.getItem('sonicpulse_configs_dict');
      if (savedDictStr) {
          const dict = JSON.parse(savedDictStr);
          if (dict[activeShape]) {
              return { ...DEFAULT_CONFIG, ...dict[activeShape], shape: activeShape };
          }
      } else {
         const oldSaved = localStorage.getItem(STORAGE_KEY_CONFIG);
         if (oldSaved) {
             const parsed = JSON.parse(oldSaved);
             return { ...DEFAULT_CONFIG, ...parsed, shape: activeShape };
         }
      }
      return { ...DEFAULT_CONFIG, shape: activeShape };
    } catch(e) {
      return DEFAULT_CONFIG;
    }
  });

  const setConfig = (newConfigOrUpdater: VisualizerConfig | ((prev: VisualizerConfig) => VisualizerConfig)) => {
      setConfigInternal(prevConfig => {
          const newConfig = typeof newConfigOrUpdater === 'function' ? newConfigOrUpdater(prevConfig) : newConfigOrUpdater;
          
          if (newConfig.shape !== prevConfig.shape) {
              // User switched shape! Load the saved config for that new shape
              const savedForNewShape = configsByShape[newConfig.shape] || { ...DEFAULT_CONFIG, shape: newConfig.shape };
              localStorage.setItem('sonicpulse_active_shape', newConfig.shape);
              return savedForNewShape;
          } else {
              // User changed a parameter within the same shape
              setConfigsByShape(prevDict => {
                  const updatedDict = { ...prevDict, [newConfig.shape]: newConfig };
                  try {
                      localStorage.setItem('sonicpulse_configs_dict', JSON.stringify(updatedDict));
                  } catch (e) {
                      console.warn("Failed to save configs dict (quota?)");
                      if (newConfig.backgroundImage) {
                          const configNoBg = { ...newConfig, backgroundImage: null };
                          const fallbackDict = { ...prevDict, [newConfig.shape]: configNoBg };
                          try { localStorage.setItem('sonicpulse_configs_dict', JSON.stringify(fallbackDict)); } catch(e) {}
                      }
                  }
                  return updatedDict;
              });
              try {
                  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
              } catch (e) {
                  if (newConfig.backgroundImage) {
                      const configNoBg = { ...newConfig, backgroundImage: null };
                      try { localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configNoBg)); } catch(e) {}
                  }
              }
              return newConfig;
          }
      });
  };

  const [audioState, setAudioState] = useState<AudioSourceState>({
    isPlaying: false,
    mode: 'file',
    monitorAudio: (() => {
      try {
        return localStorage.getItem(STORAGE_KEY_MONITOR) === 'true';
      } catch (e) { return false; }
    })(),
    volume: (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
        return saved !== null ? parseFloat(saved) : 0.7;
      } catch (e) { return 0.7; }
    })()
  });

  // Player State
  const [mainPlaylist, setMainPlaylist] = useState<{ name: string, url: string, file: File | null, track?: Track }[]>([]);
  const [mainTrackIndex, setMainTrackIndex] = useState(-1);
  
  const [roamPlaylist, setRoamPlaylist] = useState<{ name: string, url: string, file: File | null, track?: Track }[]>([]);
  const [roamTrackIndex, setRoamTrackIndex] = useState(-1);
  const [isRoamingMode, setIsRoamingMode] = useState(false);

  const playlist = isRoamingMode ? roamPlaylist : mainPlaylist;
  const currentTrackIndex = isRoamingMode ? roamTrackIndex : mainTrackIndex;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExternalQueue, setIsExternalQueue] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const fetchLikedIds = async () => {
    try {
        const provider = new NeteaseProvider();
        const res = await provider.getStarred();
        if (res.tracks) {
            const ids = new Set(res.tracks.map(t => t.id));
            setLikedIds(ids);
            (window as any).__sonicpulse_liked_ids = Array.from(ids);
            window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated', { detail: { noFetch: true } }));
        }
    } catch(e) {}
  };

  useEffect(() => {
    fetchLikedIds();
    const handleUpdate = (e: any) => {
        if (e.detail?.noFetch) return;
        fetchLikedIds();
    };
    window.addEventListener('sonicpulse-liked-songs-updated', handleUpdate);
    return () => window.removeEventListener('sonicpulse-liked-songs-updated', handleUpdate);
  }, []);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
        setToastVisible(false);
    }, 3000);
  };

  useEffect(() => {
    const handleCustomToast = (e: any) => {
        if (e.detail) showToast(e.detail);
    };
    window.addEventListener('sonicpulse-toast', handleCustomToast);
    return () => window.removeEventListener('sonicpulse-toast', handleCustomToast);
  }, []);

  // UI State
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [isMusicPlayerOpen, setIsMusicPlayerOpen] = useState(false);
  const [isGlobalMute, setIsGlobalMute] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MUTE) === 'true';
    } catch (e) { return false; }
  });

  // Overlay State
  const [hasOverlay, setHasOverlay] = useState(false);
  const [isOverlayLocked, setIsOverlayLocked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OVERLAY_LOCKED) === 'true';
    } catch (e) { return false; }
  });
  const overlayWindowRef = useRef<any>(null);

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
    } catch (e) { }
    return 'en';
  });

  const t = translations[language];



  // Persist language changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, language);
  }, [language]);

  // Persist Mute status
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MUTE, isGlobalMute.toString());
  }, [isGlobalMute]);

  // Persist Volume and Monitor settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOLUME, audioState.volume.toString());
    localStorage.setItem(STORAGE_KEY_MONITOR, audioState.monitorAudio.toString());
  }, [audioState.volume, audioState.monitorAudio]);

  // Persist Overlay Lock status
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OVERLAY_LOCKED, isOverlayLocked.toString());
  }, [isOverlayLocked]);

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

  // Overlay Management
  const launchOverlay = async () => {
    try {
      // @ts-ignore
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

      if (overlayWindowRef.current) {
        await overlayWindowRef.current.close();
        overlayWindowRef.current = null;
        setHasOverlay(false);
        return;
      }

      const savedX = localStorage.getItem(STORAGE_KEY_OVERLAY_X);
      const savedY = localStorage.getItem(STORAGE_KEY_OVERLAY_Y);
      const savedW = localStorage.getItem(STORAGE_KEY_OVERLAY_W);
      const savedH = localStorage.getItem(STORAGE_KEY_OVERLAY_H);

      const webview = new WebviewWindow('overlay', {
        url: '/?overlay=true',
        title: 'SonicPulse Overlay',
        transparent: true,
        decorations: false,
        alwaysOnTop: true,
        resizable: true,
        shadow: false, // Disable OS-level shadow
        width: savedW ? parseInt(savedW) : 800,
        height: savedH ? parseInt(savedH) : 600,
        x: savedX ? parseInt(savedX) : undefined,
        y: savedY ? parseInt(savedY) : undefined,
      });

      webview.once('tauri://created', function () {
        overlayWindowRef.current = webview;
        setHasOverlay(true);
        
        // Apply initial lock state
        setTimeout(() => {
          webview.setIgnoreCursorEvents(isOverlayLocked);
          new BroadcastChannel('sonicpulse_overlay_state').postMessage({ locked: isOverlayLocked });
        }, 500);
      });

      webview.onResized(({ payload: size }) => {
        localStorage.setItem(STORAGE_KEY_OVERLAY_W, size.width.toString());
        localStorage.setItem(STORAGE_KEY_OVERLAY_H, size.height.toString());
      });

      webview.onMoved(({ payload: pos }) => {
        localStorage.setItem(STORAGE_KEY_OVERLAY_X, pos.x.toString());
        localStorage.setItem(STORAGE_KEY_OVERLAY_Y, pos.y.toString());
      });

      webview.once('tauri://error', function (e) {
        console.error('Error creating overlay:', e);
        alert('Error creating overlay: ' + JSON.stringify(e));
      });

      webview.onCloseRequested(() => {
        overlayWindowRef.current = null;
        setHasOverlay(false);
      });

    } catch (e: any) {
      console.error("Failed to launch overlay", e);
      alert("Failed to launch overlay: " + e.message);
    }
  };

  // Close overlay automatically if Grid3D is selected
  useEffect(() => {
    if (config.shape === VisualizerShape.Grid3D && hasOverlay && overlayWindowRef.current) {
        overlayWindowRef.current.close().catch(console.error);
        overlayWindowRef.current = null;
        setHasOverlay(false);
    }
  }, [config.shape, hasOverlay]);

  const toggleOverlayLock = async () => {
    if (!overlayWindowRef.current) return;
    try {
      const newLockedState = !isOverlayLocked;
      await overlayWindowRef.current.setIgnoreCursorEvents(newLockedState);
      setIsOverlayLocked(newLockedState);
      new BroadcastChannel('sonicpulse_overlay_state').postMessage({ locked: newLockedState });
    } catch (e) {
      console.error("Failed to set ignore cursor events:", e);
    }
  };

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
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const activePlayerRef = useRef<'audio1' | 'audio2'>('audio1');
  const mediaElementSource1Ref = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaElementSource2Ref = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

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

      // Create MediaElementSource ONCE for both audio elements
      if (audio1Ref.current && !mediaElementSource1Ref.current) {
        mediaElementSource1Ref.current = audioContextRef.current.createMediaElementSource(audio1Ref.current);
      }
      if (audio2Ref.current && !mediaElementSource2Ref.current) {
        mediaElementSource2Ref.current = audioContextRef.current.createMediaElementSource(audio2Ref.current);
      }
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
    // Pause audio files
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMainPlaylist([]);
    setRoamPlaylist([]);
    setIsRoamingMode(false);
    setAudioState({
      isPlaying: false,
      mode: 'file',
      fileName: '',
      monitorAudio: false,
      volume: 1,
      sinkId: ''
    });
    if (audio1Ref.current) {
      audio1Ref.current.pause();
      audio1Ref.current.src = '';
    }
    if (audio2Ref.current) {
      audio2Ref.current.pause();
      audio2Ref.current.src = '';
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
        showToast("未偵測到音訊軌！請確保在分享畫面時勾選「分享音訊」。");
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
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newTracks = files.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      file: file
    }));

    setMainPlaylist(newTracks);
    setMainTrackIndex(0);
    setIsRoamingMode(false);
    playTrack(newTracks[0]);
  };

  const playTrack = (track: { name: string, url: string, file?: File | null, track?: any }) => {
    // Determine the next player for gapless swap
    const nextPlayerKey = activePlayerRef.current === 'audio1' ? 'audio2' : 'audio1';
    const nextPlayer = nextPlayerKey === 'audio1' ? audio1Ref.current : audio2Ref.current;
    const currentPlayer = activePlayerRef.current === 'audio1' ? audio1Ref.current : audio2Ref.current;

    initAudioContext();

    if (!audioContextRef.current || !analyserRef.current || !gainNodeRef.current || !destRef.current || !nextPlayer) return;

    // Load and play the new track on the inactive player
    nextPlayer.src = track.url;
    nextPlayer.load();
    nextPlayer.play().catch(console.error);

    // Fade out / Pause the previous player (Gapless transition)
    if (currentPlayer && !currentPlayer.paused) {
      currentPlayer.pause(); // For true gapless, we would fade out here or let it finish naturally if overlapping.
      currentPlayer.src = '';
    }

    activePlayerRef.current = nextPlayerKey;

    const sourceToConnect = nextPlayerKey === 'audio1' ? mediaElementSource1Ref.current : mediaElementSource2Ref.current;

    if (sourceToConnect) {
      sourceToConnect.disconnect();
      sourceToConnect.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(masterGainRef.current);
      sourceToConnect.connect(destRef.current);
    }

    setAudioState(prev => ({
      ...prev,
      isPlaying: true,
      mode: 'file',
      fileName: track.name,
      monitorAudio: true
    }));
  };

  const handleNextTrack = async () => {
    if (isRoamingMode) {
        if (roamPlaylist.length === 0) return;
        const nextIndex = roamTrackIndex + 1;
        
        // If we reach the end of the roaming playlist, fetch more!
        if (nextIndex >= roamPlaylist.length) {
            const lastTrack = roamPlaylist[roamPlaylist.length - 1].track;
            if (lastTrack && lastTrack.id) {
                try {
                    const provider = new NeteaseProvider();
                    const similar = await provider.getSimilarSongs(lastTrack.id);
                    if (similar && similar.length > 0) {
                        const newTracks = similar.map(s => ({
                            name: s.title + (s.artist ? ` by ${s.artist}` : ''),
                            url: '',
                            file: null,
                            track: s
                        }));
                        setRoamPlaylist(prev => [...prev, ...newTracks]);
                        setRoamTrackIndex(nextIndex);
                        playTrack(newTracks[0]);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to fetch more roaming songs", e);
                }
            }
        }
        
        // Normal roaming next
        if (nextIndex < roamPlaylist.length) {
            setRoamTrackIndex(nextIndex);
            
            const nextTrack = roamPlaylist[nextIndex];
            let url = nextTrack.url || nextTrack.track?.streamUrl || '';
            if (!url && nextTrack.track?.source === 'netease') {
                try {
                    const provider = new NeteaseProvider();
                    url = await provider.getStreamUrl(nextTrack.track.id);
                } catch(e){}
            }
            playTrack({ ...nextTrack, url });
        }
        return;
    }

    if (isExternalQueue) {
      window.dispatchEvent(new CustomEvent('sonicpulse-play-next'));
      return;
    }
    if (mainPlaylist.length === 0) return;
    const nextIndex = (mainTrackIndex + 1) % mainPlaylist.length;
    setMainTrackIndex(nextIndex);
    playTrack(mainPlaylist[nextIndex]);
  };

  const handlePrevTrack = async () => {
    if (isRoamingMode) {
        if (roamPlaylist.length === 0) return;
        if (currentTime > 3) {
            handleSeek(0);
        } else if (roamTrackIndex > 0) {
            const prevIndex = roamTrackIndex - 1;
            setRoamTrackIndex(prevIndex);
            
            const prevTrack = roamPlaylist[prevIndex];
            let url = prevTrack.url || prevTrack.track?.streamUrl || '';
            if (!url && prevTrack.track?.source === 'netease') {
                try {
                    const provider = new NeteaseProvider();
                    url = await provider.getStreamUrl(prevTrack.track.id);
                } catch(e){}
            }
            playTrack({ ...prevTrack, url });
        }
        return;
    }

    if (isExternalQueue) {
      window.dispatchEvent(new CustomEvent('sonicpulse-play-prev'));
      return;
    }
    if (mainPlaylist.length === 0) return;
    const prevIndex = (mainTrackIndex - 1 + mainPlaylist.length) % mainPlaylist.length;
    setMainTrackIndex(prevIndex);
    playTrack(mainPlaylist[prevIndex]);
  };

  const handleSelectTrack = async (index: number) => {
    if (isRoamingMode) {
        if (index < 0 || index >= roamPlaylist.length) return;
        setRoamTrackIndex(index);
        
        const selected = roamPlaylist[index];
        let url = selected.url || selected.track?.streamUrl || '';
        if (!url && selected.track?.source === 'netease') {
            try {
                const provider = new NeteaseProvider();
                url = await provider.getStreamUrl(selected.track.id);
            } catch(e){}
        }
        playTrack({ ...selected, url });
        return;
    }

    if (isExternalQueue) {
      window.dispatchEvent(new CustomEvent('sonicpulse-play-index', { detail: index }));
      return;
    }
    if (index < 0 || index >= mainPlaylist.length) return;
    setMainTrackIndex(index);
    playTrack(mainPlaylist[index]);
  };

  const handleOutputDeviceChange = async (deviceId: string) => {
    if (!audioContextRef.current) return;

    // For Audio Element (Files)
    if (audio1Ref.current && 'setSinkId' in audio1Ref.current) {
      try {
        // @ts-ignore
        await audio1Ref.current.setSinkId(deviceId);
      } catch (e) { }
    }
    if (audio2Ref.current && 'setSinkId' in audio2Ref.current) {
      try {
        // @ts-ignore
        await audio2Ref.current.setSinkId(deviceId);
      } catch (e) { }
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

  const getActivePlayer = () => activePlayerRef.current === 'audio1' ? audio1Ref.current : audio2Ref.current;

  // Auto Render Logic (Real-time playback + Record)
  const handleAutoRender = () => {
    if (audioState.mode !== 'file' || !getActivePlayer()) return;

    // 1. Reset Audio to Start
    getActivePlayer()!.currentTime = 0;
    setCurrentTime(0);

    // 2. Start Recording
    handleStartRecording();
    setIsAutoRender(true);

    // 3. Play Audio
    getActivePlayer()!.play()
      .then(() => setAudioState(prev => ({ ...prev, isPlaying: true })))
      .catch(e => console.error("Auto render play error:", e));
  };

  // Player Controls
  const togglePlay = () => {
    const player = getActivePlayer();
    if (player) {
      if (player.paused) {
        player.play();
        setAudioState(prev => ({ ...prev, isPlaying: true }));
      } else {
        player.pause();
        setAudioState(prev => ({ ...prev, isPlaying: false }));
      }
    }
  };

  const handleSeek = (time: number) => {
    const player = getActivePlayer();
    if (player) {
      player.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setAudioState(prev => ({ ...prev, volume: vol }));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = vol;
    }
  };

  useEffect(() => {
    // Only run this in the main window
    if (!window.location.search.includes('overlay=true')) {
      const init = async () => {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        
        const unlisten = await appWindow.onCloseRequested(async () => {
          // When main window is closing, force close the overlay
          if (overlayWindowRef.current) {
            try {
              await overlayWindowRef.current.close();
            } catch (e) {
              console.error("Failed to close overlay on main window close", e);
            }
          }
        });
        
        return unlisten;
      };
      
      const unlistenPromise = init();
      return () => {
        unlistenPromise.then(unlisten => unlisten && unlisten());
      };
    }
  }, []);

  // Bind Audio Element Events
  useEffect(() => {
    const handleClear = () => {
      cleanupAudio();
      setAudioState(prev => ({ ...prev, isPlaying: false, fileName: '' }));
      setMainPlaylist([]);
      setMainTrackIndex(-1);
    };
    window.addEventListener('sonicpulse_clear_audio', handleClear);
    return () => window.removeEventListener('sonicpulse_clear_audio', handleClear);
  }, []);

  useEffect(() => {
    const players = [audio1Ref.current, audio2Ref.current];
    
    const onTimeUpdate = (e: any) => {
        if (e.target === getActivePlayer()) setCurrentTime(e.target.currentTime);
    };
    const onDurationChange = (e: any) => {
        if (e.target === getActivePlayer()) setDuration(e.target.duration);
    };

    const onEnded = (e: any) => {
      if (e.target !== getActivePlayer()) return;
      
      // If we are playing from MusicPlayerLayout's queue, we should notify it.
      if (isExternalQueue) {
        window.dispatchEvent(new CustomEvent('sonicpulse-track-ended'));
      } else if (mainPlaylist.length > 1 || (isRoamingMode && roamPlaylist.length > 0)) {
        handleNextTrack();
      } else {
        setAudioState(prev => ({ ...prev, isPlaying: false }));
      }
      
      // Auto stop recording if in auto-render mode
      if (isAutoRender && mediaRecorderRef.current?.state === 'recording') {
        handleStopRecording();
      }
    };

    const onPlay = (e: any) => {
        if (e.target === getActivePlayer()) setAudioState(prev => ({ ...prev, isPlaying: true }));
    };
    const onPause = (e: any) => {
        if (e.target === getActivePlayer()) setAudioState(prev => ({ ...prev, isPlaying: false }));
    };

    players.forEach(el => {
        if (!el) return;
        el.addEventListener('timeupdate', onTimeUpdate);
        el.addEventListener('durationchange', onDurationChange);
        el.addEventListener('ended', onEnded);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);
    });

    return () => {
      players.forEach(el => {
          if (!el) return;
          el.removeEventListener('timeupdate', onTimeUpdate);
          el.removeEventListener('durationchange', onDurationChange);
          el.removeEventListener('ended', onEnded);
          el.removeEventListener('play', onPlay);
          el.removeEventListener('pause', onPause);
      });
    };
  }, [isAutoRender, mainPlaylist, isRoamingMode, roamPlaylist]);

  // Overlay Window internal state
  const [isThisOverlayLocked, setIsThisOverlayLocked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OVERLAY_LOCKED) === 'true';
    } catch (e) { return false; }
  });
  useEffect(() => {
    const bc = new BroadcastChannel('sonicpulse_overlay_state');
    bc.onmessage = async (e) => {
      if (window.location.search.includes('overlay=true')) {
        // Overlay mode handling
        if (e.data.locked !== undefined) {
          setIsThisOverlayLocked(e.data.locked);
        }
      } else {
        // Main mode handling
        if (e.data.action === 'close' && overlayWindowRef.current) {
          try {
            await overlayWindowRef.current.close();
          } catch (err) {
            console.error("Failed to close overlay via broadcast", err);
          }
          overlayWindowRef.current = null;
          setHasOverlay(false);
        }
      }
    };
    return () => bc.close();
  }, [hasOverlay]);

  // Check if we are in overlay mode
  const isOverlayMode = window.location.search.includes('overlay=true');

  if (isOverlayMode) {
    return (
      <div
        className={`w-screen h-screen overflow-hidden font-sans relative transition-all duration-300 ${isThisOverlayLocked ? 'bg-transparent border-none shadow-none' : 'bg-black/40 border border-white/20 shadow-2xl'}`}
      >
        <Visualizer analyser={null} config={config} isOverlay={true} />

        {/* Edit Mode UI (Hidden when locked) */}
        {!isThisOverlayLocked && (
          <>
            {/* Draggable Titlebar */}
            <div data-tauri-drag-region className="absolute top-0 left-0 w-full h-8 flex items-center justify-between px-3 z-50 cursor-move bg-black/60 border-b border-white/10 group">
              <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none text-white/50 group-hover:text-white transition-colors w-full h-full">
                <Move size={14} />
                <span className="text-xs font-bold tracking-widest uppercase">Drag to Move</span>
              </div>
              <button
                className="text-white/50 hover:text-red-400 p-1 rounded transition-colors z-50"
                onClick={() => {
                  // Request main window to close this overlay
                  new BroadcastChannel('sonicpulse_overlay_state').postMessage({ action: 'close' });
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
              <div className="bg-black/60 text-white px-6 py-3 rounded-xl backdrop-blur-md shadow-2xl border border-white/10 flex flex-col items-center gap-2">
                <div className="font-bold text-lg">EDIT MODE</div>
                <div className="text-sm opacity-70 text-center">
                  Drag top bar to move.<br />Drag window edges to resize.<br />Click "LOCKED" in Main App when done.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">
      {/* Toast Notification */}
      <div 
        className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full bg-[#1e1e2e]/90 backdrop-blur-md border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-white text-sm font-medium transition-all duration-500 pointer-events-none flex items-center gap-3 ${toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}
      >
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        {toastMessage}
      </div>

      {/* Hidden Video for Stream Keep-Alive */}
      <video ref={hiddenVideoRef} className="hidden" playsInline muted />

      {/* Audio Elements for File Playback */}
      <audio ref={audio1Ref} className="hidden" crossOrigin="anonymous" />
      <audio ref={audio2Ref} className="hidden" crossOrigin="anonymous" />

      {/* Atmospheric Particles Overlay (2D Canvas) */}
      {config.particleEffect !== VisualizerParticleEffect.None && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
          <ParticleOverlay 
            effect={config.particleEffect} 
            count={config.particleCount} 
            speed={config.particleSpeed} 
            size={config.particleSize} 
          />
        </div>
      )}

      <div className="absolute top-4 left-4 z-40 flex items-center gap-3">
        <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsMusicPlayerOpen(true)}
            className="group flex items-center justify-center w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-purple-500/50 shadow-lg transition-all"
            title="Open Music Player"
        >
            <Music size={20} className="text-white group-hover:text-purple-400 transition-colors" />
        </button>
      </div>

      <MusicPlayerLayout 
          isOpen={isMusicPlayerOpen} 
          onClose={() => setIsMusicPlayerOpen(false)} 
          playbackState={{
              isPlaying: audioState.isPlaying,
              progress: currentTime,
              duration: duration,
              volume: audioState.volume ?? 1
          }}
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onPlay={(trackUrl, title, coverUrl, track) => {
              // Convert to the format App.tsx expects
              const mapped = {
                  name: title,
                  url: trackUrl,
                  file: null,
                  track: track
              };
              // Only override playlist if we aren't using an external queue
              if (!isExternalQueue) {
                  setMainPlaylist([mapped]);
                  setMainTrackIndex(0);
                  setIsRoamingMode(false);
              }
              playTrack(mapped);
          }}
          onQueueUpdate={(queue, currentIndex) => {
              setIsExternalQueue(true);
              setMainPlaylist(queue.map(q => ({ name: q.title + (q.artist ? ` by ${q.artist}` : ''), url: '', file: null, track: q })));
              setMainTrackIndex(currentIndex);
          }}
          isLyricsEnabled={config.lyricsEnabled}
          onToggleLyrics={() => setConfig(prev => ({ ...prev, lyricsEnabled: !prev.lyricsEnabled }))}
      />

      {/* Visualizer (Now handles background internally) */}
      <Visualizer 
          ref={canvasRef} 
          analyser={analyserRef.current} 
          config={config} 
          albumCoverUrl={(isRoamingMode ? roamPlaylist[roamTrackIndex]?.track?.coverUrl : mainPlaylist[mainTrackIndex]?.track?.coverUrl) || null} 
      />

      {/* Lyrics Overlay */}
      {audioState.mode === 'file' && (isRoamingMode ? roamPlaylist[roamTrackIndex]?.track : mainPlaylist[mainTrackIndex]?.track) && (
         <LyricsOverlay 
             track={(isRoamingMode ? roamPlaylist[roamTrackIndex]!.track! : mainPlaylist[mainTrackIndex]!.track!)}
             currentTime={currentTime}
             config={config}
         />
      )}

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
          onLaunchOverlay={launchOverlay}
          onToggleOverlayLock={toggleOverlayLock}
          isOverlayLocked={isOverlayLocked}
          hasOverlay={hasOverlay}
        />
      </div>

      {/* Recording Status / Timer (Top Right) */}
      {isRecording && (
        <div className="absolute top-4 left-16 z-50 flex items-center gap-3 bg-red-900/40 backdrop-blur-md border border-red-500/30 text-white px-4 py-2 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <Circle size={10} fill="currentColor" className="text-red-500" />
          <span className="text-sm font-mono font-bold tracking-widest">{formatTimer(recordingTime)}</span>
        </div>
      )}

      {/* Show UI Trigger (Visible when UI is hidden) */}
      {isUIHidden && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onMouseDown={(e) => e.stopPropagation()}
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
            volume={audioState.volume ?? 0.7}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            playlist={isRoamingMode ? roamPlaylist : mainPlaylist}
            onNext={handleNextTrack}
            onPrev={handlePrevTrack}
            currentIndex={isRoamingMode ? roamTrackIndex : mainTrackIndex}
            onSelectTrack={handleSelectTrack}
            isRoamingMode={isRoamingMode}
            onToggleRoaming={async (mode) => {
                setIsRoamingMode(mode);
                if (mode) {
                    if (roamPlaylist.length > 0 && roamTrackIndex >= 0) {
                        const target = roamPlaylist[roamTrackIndex];
                        let url = target.url || target.track?.streamUrl || '';
                        if (!url && target.track?.source === 'netease') {
                            try {
                                const provider = new NeteaseProvider();
                                url = await provider.getStreamUrl(target.track.id);
                            } catch(e){}
                        }
                        playTrack({ ...target, url });
                    } else if (mainPlaylist.length > 0 && mainTrackIndex >= 0) {
                        const track = mainPlaylist[mainTrackIndex].track;
                        if (track) {
                            if (track.source !== 'netease') {
                                showToast("漫遊功能目前僅支援網易雲音樂的歌曲哦！");
                                setIsRoamingMode(false);
                                return;
                            }
                            showToast("正在加載漫遊列表...");
                            try {
                                const provider = new NeteaseProvider();
                                const similar = await provider.getSimilarSongs(track.id);
                                const newRoam = [
                                    { name: track.title, url: '', file: null, track },
                                    ...similar.map(s => ({ name: s.title, url: '', file: null, track: s }))
                                ];
                                setRoamPlaylist(newRoam);
                                setRoamTrackIndex(0);
                                
                                let url = track.streamUrl || '';
                                if (!url && track.source === 'netease') {
                                    url = await provider.getStreamUrl(track.id);
                                }
                                playTrack({ name: track.title, url, file: null, track });
                                showToast("已為您開啟相似歌曲漫遊");
                            } catch(e) {
                                console.error("Failed to start roaming", e);
                                showToast("開啟漫遊失敗，請稍後再試");
                                setIsRoamingMode(false);
                            }
                        }
                    }
                } else {
                    if (mainPlaylist.length > 0 && mainTrackIndex >= 0) {
                        const target = mainPlaylist[mainTrackIndex];
                        let url = target.url || target.track?.streamUrl || '';
                        if (!url && target.track?.source === 'netease') {
                            try {
                                const provider = new NeteaseProvider();
                                url = await provider.getStreamUrl(target.track.id);
                            } catch(e){}
                        }
                        playTrack({ ...target, url });
                    }
                }
            }}
            onStartRoaming={async (track) => {
                if (track.source !== 'netease') {
                    showToast("漫遊功能目前僅支援網易雲音樂的歌曲哦！");
                    return;
                }
                try {
                    const provider = new NeteaseProvider();
                    const similar = await provider.getSimilarSongs(track.id);
                    const newRoam = [
                        { name: track.title, url: '', file: null, track },
                        ...similar.map(s => ({ name: s.title, url: '', file: null, track: s }))
                    ];
                    setRoamPlaylist(newRoam);
                    setRoamTrackIndex(0);
                    setIsRoamingMode(true);
                    
                    // We must play it! Wait, we need the streamUrl.
                    // We can emit sonicpulse-play-index to let Netease/MusicPlayerLayout handle URL resolving!
                    // Wait, MusicPlayerLayout's queue isn't updated. 
                    // To get the URL, we need to call provider.getStreamUrl
                    let url = track.streamUrl || '';
                    if (!url && track.source === 'netease') {
                        url = await provider.getStreamUrl(track.id);
                    }
                    playTrack({ name: track.title, url, file: null, track });
                    showToast("已為您開啟相似歌曲漫遊");
                } catch(e) {
                    console.error("Failed to start roaming", e);
                    showToast("開啟漫遊失敗，請稍後再試");
                }
            }}
            onLikeTrack={async (track) => {
                if (track.source !== 'netease') {
                    showToast("只有網易雲音樂的歌曲可以加入紅心");
                    return;
                }
                try {
                    const provider = new NeteaseProvider();
                    // Toggle like state: if already liked, unlike it.
                    const currentlyLiked = track ? likedIds.has(track.id) : false;
                    const ok = await provider.likeSong(track.id, !currentlyLiked);
                    if (ok) {
                        showToast(!currentlyLiked ? "已加入紅心歌曲！" : "已取消紅心！");
                        window.dispatchEvent(new CustomEvent('sonicpulse-liked-songs-updated'));
                    } else {
                        showToast("操作失敗，請確認網易雲登入狀態。");
                    }
                } catch(e: any) { 
                    showToast("加入失敗: " + e.message);
                }
            }}
            isLiked={(() => {
                const tr = isRoamingMode ? roamPlaylist[roamTrackIndex]?.track : mainPlaylist[mainTrackIndex]?.track;
                return tr ? likedIds.has(tr.id) : false;
            })()}
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
