
import React, { useState, useEffect, useRef } from 'react';
import { VisualizerConfig, VisualizerShape, VisualizerDirection, VisualizerStyle, VisualizerMaterial, SymmetryMode, AudioSourceState, VisualizerParticleEffect } from '../types';
import { Settings, Image as ImageIcon, Music, Mic, Monitor, Play, Volume2, Upload, Link as LinkIcon, Trash2, Globe, Target, ChevronDown, Plus, Minus, Check, Video, Eye, EyeOff, VolumeX, Circle, Sparkles } from 'lucide-react';
import { translations, Language } from '../translations';

interface ControlsProps {
  config: VisualizerConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualizerConfig>>;
  audioState: AudioSourceState;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartMic: () => void;
  onStartSystem: () => void;
  onOutputDeviceChange: (deviceId: string) => void;
  onToggleMonitor: (enabled: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  
  // New props for recording and global mute
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRenderVideo: () => void; // For Direct File Render
  
  isUIHidden: boolean;
  onToggleUI: () => void;
  
  isGlobalMute: boolean;
  onToggleGlobalMute: () => void;
  
  onLaunchOverlay: () => void;
  onToggleOverlayLock: () => void;
  isOverlayLocked: boolean;
  hasOverlay: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  config, 
  setConfig, 
  audioState, 
  onFileSelect, 
  onStartMic, 
  onStartSystem,
  onOutputDeviceChange,
  onToggleMonitor,
  language,
  setLanguage,
  isRecording,
  onStartRecording,
  onStopRecording,
  onRenderVideo,
  isUIHidden,
  onToggleUI,
  isGlobalMute,
  onToggleGlobalMute,
  onLaunchOverlay,
  onToggleOverlayLock,
  isOverlayLocked,
  hasOverlay
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'audio' | 'style' | 'layout' | 'image' | 'effects'>('audio');
  const [prevTab, setPrevTab] = useState<'audio' | 'style' | 'layout' | 'image' | 'effects'>('audio');
  const [bgUrl, setBgUrl] = useState('');
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);

  const t = translations[language];

  const tabs: ('audio' | 'style' | 'layout' | 'image' | 'effects')[] = ['audio', 'style', 'layout', 'image', 'effects'];
  
  // Track previous tab for slide direction
  useEffect(() => {
    setPrevTab(activeTab);
  }, [activeTab]);

  const getSlideClass = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const prevIndex = tabs.indexOf(prevTab);
    if (currentIndex === prevIndex) return 'animate-[fadeIn_0.3s_ease-out]'; // Initial load
    return currentIndex > prevIndex ? 'animate-slide-right' : 'animate-slide-left';
  };

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); 
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setOutputDevices(outputs);
      } catch (e) {
        console.warn("Could not enumerate devices", e);
      }
    };
    getDevices();
  }, []);

  const handleChange = <K extends keyof VisualizerConfig>(key: K, value: VisualizerConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleCenterPosition = () => {
      setConfig(prev => ({ ...prev, centerX: 50, centerY: 50 }));
  };
  
  const handleBgCenterPosition = () => {
      setConfig(prev => ({ ...prev, bgPositionX: 50, bgPositionY: 50 }));
  };

  const handleUrlSubmit = () => {
    if (bgUrl) handleChange('backgroundImage', bgUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        // Use FileReader to create a persistent Data URL instead of a Blob URL
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Basic size check to warn user if image might fail local storage (approx 3MB limit usually)
            if (result.length > 3000000) {
                alert("Image is very large and might not save to settings permanently.");
            }
            handleChange('backgroundImage', result);
        };
        reader.readAsDataURL(file);
    }
  };

  // If UI is completely hidden, only show the "Show" trigger
  if (isUIHidden) {
      return (
          <div className="absolute top-4 left-4 z-50 group">
              <button 
                  onClick={onToggleUI}
                  className="p-3 bg-black/40 text-white/50 hover:text-white rounded-full backdrop-blur-md transition-all border border-white/5 hover:border-white/20 hover:scale-110 active:scale-95 shadow-xl"
                  title={t.controls.showUI}
              >
                  <Eye size={24} />
              </button>
          </div>
      );
  }

  return (
    <>
      {/* Settings Toggle (Visible when closed) */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`absolute top-4 left-4 z-40 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 group shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isOpen ? 'opacity-0 pointer-events-none -translate-x-10' : 'opacity-100 translate-x-0'}`}
      >
        <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* Sidebar Container */}
      <div className={`absolute top-0 left-0 h-full w-80 bg-black/80 backdrop-blur-2xl text-white border-r border-white/10 z-50 flex flex-col shadow-[5px_0_30px_rgba(0,0,0,0.5)] font-sans transform transition-transform duration-500 cubic-bezier(0.2, 0, 0, 1) ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header Action Bar */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5">
             {/* Global Mute */}
             <button 
                onClick={onToggleGlobalMute}
                className={`p-2 rounded-full transition-all ${isGlobalMute ? 'text-red-400 bg-red-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title={isGlobalMute ? t.controls.unmuteApp : t.controls.muteApp}
             >
                {isGlobalMute ? <VolumeX size={18} /> : <Volume2 size={18} />}
             </button>

             <div className="flex items-center gap-2">
                 {/* Recording Indicator/Toggle */}
                 <button
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isRecording ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    title={isRecording ? t.controls.stopRecord : t.controls.record}
                 >
                    <Circle size={8} fill="currentColor" className={isRecording ? "" : "text-red-500"} />
                    {isRecording ? "REC" : "REC"}
                 </button>

                 {/* Overlay Toggle */}
                 {(window as any).__TAURI_INTERNALS__ && (
                    <div className="flex bg-white/5 rounded-full p-0.5">
                        <button 
                            onClick={onLaunchOverlay}
                            className={`p-1.5 rounded-full text-xs transition-all ${hasOverlay ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            title="Launch Overlay Window"
                        >
                            <Sparkles size={16} />
                        </button>
                        {hasOverlay && (
                            <button 
                                onClick={onToggleOverlayLock}
                                className={`p-1.5 rounded-full text-xs font-bold transition-all px-3 ${isOverlayLocked ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}
                                title={isOverlayLocked ? "Unlock to move" : "Lock to click-through"}
                            >
                                {isOverlayLocked ? "LOCKED" : "EDIT"}
                            </button>
                        )}
                    </div>
                 )}

                 {/* Hide UI */}
                 <button 
                    onClick={onToggleUI}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    title={t.controls.hideUI}
                 >
                    <EyeOff size={18} />
                 </button>
             </div>
        </div>

        {/* Title Header */}
        <div className="p-4 border-b border-white/10 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
              <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent animate-pulse">{t.appTitle}</h1>
              <button 
                onClick={() => setIsOpen(false)} 
                className="opacity-50 hover:opacity-100 p-1 hover:bg-white/10 rounded-full transition-all duration-300 hover:rotate-90 active:scale-90"
              >
                ✕
              </button>
          </div>
          
          {/* Language Switcher */}
          <div className="flex justify-end gap-2 text-xs">
              {['en', 'zh', 'ja'].map((lang) => (
                  <button 
                      key={lang}
                      onClick={() => setLanguage(lang as Language)} 
                      className={`px-3 py-1 rounded-full transition-all duration-200 ${language === lang ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  >
                      {lang === 'en' ? 'EN' : lang === 'zh' ? '中文' : '日文'}
                  </button>
              ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-white/20">
          {tabs.map((tab) => (
             <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`flex-1 min-w-[60px] py-3 text-xs font-medium transition-all duration-200 capitalize whitespace-nowrap px-1 ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
             >
                {t.tabs[tab]}
             </button>
          ))}
        </div>

        {/* Content Area with key-based animation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent overflow-x-hidden">
          <div key={activeTab} className={getSlideClass()}>
          
            {/* AUDIO TAB */}
            {activeTab === 'audio' && (
              <div className="space-y-6">
                
                {/* Input Sources */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                     <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                     {t.audio.inputSource}
                  </label>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                       onClick={onStartMic}
                       className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 transform hover:scale-[1.02] active:scale-95 ${audioState.mode === 'mic' && audioState.isPlaying ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}
                    >
                      <div className={`p-2 rounded-full transition-colors ${audioState.mode === 'mic' && audioState.isPlaying ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'}`}>
                        <Mic size={20} />
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-bold ${audioState.mode === 'mic' && audioState.isPlaying ? 'text-white' : 'text-gray-300'}`}>{t.audio.mic}</div>
                        <div className="text-xs text-gray-500">{t.audio.micDesc}</div>
                      </div>
                    </button>

                    <button 
                       onClick={onStartSystem}
                       className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 transform hover:scale-[1.02] active:scale-95 ${audioState.mode === 'system' && audioState.isPlaying ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}
                    >
                      <div className={`p-2 rounded-full transition-colors ${audioState.mode === 'system' && audioState.isPlaying ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'}`}>
                        <Monitor size={20} />
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-bold ${audioState.mode === 'system' && audioState.isPlaying ? 'text-white' : 'text-gray-300'}`}>{t.audio.system}</div>
                        <div className="text-xs text-gray-500">{t.audio.systemDesc}</div>
                      </div>
                    </button>

                    {audioState.isPlaying && (audioState.mode === 'system' || audioState.mode === 'mic') && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                             <div className="relative flex items-center">
                                 <input 
                                    type="checkbox" 
                                    id="monitor-checkbox"
                                    checked={!!audioState.monitorAudio}
                                    onChange={(e) => onToggleMonitor(e.target.checked)}
                                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-800 transition-all checked:border-blue-500 checked:bg-blue-500"
                                 />
                                 <Check size={10} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                             </div>
                             <label htmlFor="monitor-checkbox" className="text-xs font-medium text-gray-300 cursor-pointer select-none">
                                {t.audio.monitor}
                             </label>
                        </div>
                    )}

                    <div className={`group flex flex-col p-4 rounded-xl border transition-all duration-200 ${audioState.mode === 'file' ? 'border-pink-500/50 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.15)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}>
                        <label className="flex items-center gap-4 cursor-pointer mb-2">
                            <div className={`p-2 rounded-full transition-colors ${audioState.mode === 'file' ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'}`}>
                                <Music size={20} />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <div className={`text-sm font-bold ${audioState.mode === 'file' ? 'text-white' : 'text-gray-300'}`}>{t.audio.file}</div>
                                <div className="text-xs text-gray-500 truncate">{audioState.fileName || t.audio.fileDesc}</div>
                            </div>
                            <input type="file" accept="audio/*,.flac" multiple className="hidden" onChange={onFileSelect} />
                        </label>
                        
                        {/* Direct Render Button for Files */}
                        {audioState.mode === 'file' && audioState.fileName && (
                             <button 
                                onClick={onRenderVideo}
                                disabled={isRecording}
                                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-600/20 active:scale-95"
                             >
                                <Video size={14} />
                                {isRecording ? t.audio.recording : t.audio.render}
                             </button>
                        )}
                    </div>
                  </div>
                </div>

                {/* Output Device Selector */}
                {outputDevices.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Volume2 size={12} /> {t.audio.output}
                        </label>
                        <div className="relative">
                            <CustomSelect 
                                value={audioState.sinkId || ""}
                                options={[
                                    { value: "", label: t.audio.defaultSpeaker },
                                    ...outputDevices.map(d => ({ value: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 4)}...` }))
                                ]}
                                onChange={onOutputDeviceChange}
                            />
                        </div>
                    </div>
                )}
              </div>
            )}

            {/* STYLE TAB */}
            {activeTab === 'style' && (
              <div className="space-y-8">
                <ControlGroup label={t.shape.form}>
                    <CustomSelect 
                        label={t.shape.shape} 
                        value={config.shape} 
                        options={Object.values(VisualizerShape).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                        onChange={(v) => handleChange('shape', v as VisualizerShape)} 
                    />
                    <CustomSelect 
                        label={t.shape.style} 
                        value={config.style} 
                        options={Object.values(VisualizerStyle).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                        onChange={(v) => handleChange('style', v as VisualizerStyle)} 
                    />
                     <CustomSelect 
                        label={t.shape.material} 
                        value={config.material || VisualizerMaterial.Standard} 
                        options={Object.values(VisualizerMaterial).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                        onChange={(v) => handleChange('material', v as VisualizerMaterial)} 
                    />
                    <CustomSelect 
                        label={t.shape.direction} 
                        value={config.direction} 
                        options={Object.values(VisualizerDirection).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                        onChange={(v) => handleChange('direction', v as VisualizerDirection)} 
                    />
                </ControlGroup>

                <ControlGroup label={t.shape.arrangement}>
                    <CustomSelect 
                        label={t.shape.symmetry} 
                        value={config.symmetry} 
                        options={Object.values(SymmetryMode).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                        onChange={(v) => handleChange('symmetry', v as SymmetryMode)} 
                    />
                    {config.shape === VisualizerShape.Circle && (
                         <Range label={t.shape.startAngle} value={config.startAngle} min={0} max={360} onChange={(v) => handleChange('startAngle', v)} />
                    )}
                </ControlGroup>

                 <ControlGroup label={t.shape.colors}>
                    <CustomSelect 
                        label={t.shape.colorMode}
                        value={config.colorMode}
                        options={[{ value: 'single', label: t.shape.modeSingle }, { value: 'dual', label: t.shape.modeDual }]}
                        onChange={(v) => handleChange('colorMode', v as 'single' | 'dual')}
                    />
                    
                    <div className="flex gap-3 pt-2">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t.shape.start}</label>
                            <div className="relative h-10 w-full rounded-lg overflow-hidden border border-white/10 ring-1 ring-white/5">
                                <input type="color" value={config.colorStart} onChange={(e) => handleChange('colorStart', e.target.value)} className="absolute -top-2 -left-2 w-[150%] h-[150%] cursor-pointer p-0 m-0 border-0" />
                            </div>
                        </div>
                        {config.colorMode === 'dual' && (
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t.shape.end}</label>
                                <div className="relative h-10 w-full rounded-lg overflow-hidden border border-white/10 ring-1 ring-white/5">
                                    <input type="color" value={config.colorEnd} onChange={(e) => handleChange('colorEnd', e.target.value)} className="absolute -top-2 -left-2 w-[150%] h-[150%] cursor-pointer p-0 m-0 border-0" />
                                </div>
                            </div>
                        )}
                    </div>
                </ControlGroup>
              </div>
            )}

            {/* LAYOUT TAB */}
            {activeTab === 'layout' && (
              <div className="space-y-8">
                <ControlGroup label={t.layout.dimensions}>
                    <Range label={t.layout.size} value={config.radius} min={10} max={500} onChange={(v) => handleChange('radius', v)} />
                    <Range label={t.layout.count} value={config.barCount} min={16} max={512} step={1} onChange={(v) => handleChange('barCount', v)} />
                    <Range label={t.layout.width} value={config.barWidth} min={1} max={50} onChange={(v) => handleChange('barWidth', v)} />
                    {config.shape === VisualizerShape.Line && (
                        <Range label={t.layout.gap} value={config.linearGap} min={0} max={50} onChange={(v) => handleChange('linearGap', v)} />
                    )}
                    <Range label={t.layout.sensitivity} value={config.barLengthScale} min={0.1} max={5} step={0.1} onChange={(v) => handleChange('barLengthScale', v)} />
                </ControlGroup>

                <ControlGroup label={t.layout.position}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                             <span className="w-1 h-3 bg-green-500 rounded-full"></span>
                             XY Coordinates
                        </span>
                        <button 
                            onClick={handleCenterPosition} 
                            className="flex items-center gap-1 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-blue-400 px-2 py-1 rounded-md transition-all active:scale-95"
                        >
                            <Target size={12} />
                            CENTER
                        </button>
                    </div>
                    <Range label={t.layout.centerX} value={config.centerX} min={0} max={100} onChange={(v) => handleChange('centerX', v)} />
                    <Range label={t.layout.centerY} value={config.centerY} min={0} max={100} onChange={(v) => handleChange('centerY', v)} />
                </ControlGroup>

                <ControlGroup label={t.layout.effects}>
                    <Range label={t.layout.shake} value={config.shakeFactor} min={0} max={50} onChange={(v) => handleChange('shakeFactor', v)} />
                    <Range label={t.layout.smoothing} value={config.smoothing} min={0} max={0.99} step={0.01} onChange={(v) => handleChange('smoothing', v)} />
                </ControlGroup>
              </div>
            )}

            {/* IMAGE TAB */}
            {activeTab === 'image' && (
              <div className="space-y-8">
                 <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                     <ImageIcon size={12} />
                     {t.audio.bgImage}
                  </label>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={bgUrl}
                      onChange={(e) => setBgUrl(e.target.value)}
                      placeholder={t.audio.pasteUrl}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-mono placeholder-gray-600"
                    />
                    <button 
                      onClick={handleUrlSubmit}
                      className="bg-blue-600 hover:bg-blue-500 active:scale-95 p-2 rounded-lg text-white transition-all shadow-lg shadow-blue-600/20"
                    >
                      <LinkIcon size={14} />
                    </button>
                  </div>

                  <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 cursor-pointer text-xs font-medium transition-all active:scale-95">
                          <Upload size={14} className="text-gray-400" />
                          <span>{t.audio.upload}</span>
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                      {config.backgroundImage && (
                        <button 
                            onClick={() => handleChange('backgroundImage', null)}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all active:scale-95"
                        >
                            <Trash2 size={14} />
                        </button>
                      )}
                  </div>
                </div>

                {config.backgroundImage && (
                    <>
                        <ControlGroup label={t.image.effects}>
                             <Range label={t.image.shake} value={config.bgShakeIntensity} min={0} max={100} onChange={(v) => handleChange('bgShakeIntensity', v)} />
                             <Range label={t.image.smoothing} value={config.bgShakeSmoothing} min={0} max={0.99} step={0.01} onChange={(v) => handleChange('bgShakeSmoothing', v)} />
                             <Range label={t.image.vignette} value={config.bgVignette} min={0} max={100} onChange={(v) => handleChange('bgVignette', v)} />
                             <Range label={t.image.float} value={config.bgFloatSpeed} min={0} max={5} step={0.1} onChange={(v) => handleChange('bgFloatSpeed', v)} />
                        </ControlGroup>

                        <ControlGroup label={t.image.transform}>
                             <Range label={t.image.scale} value={config.bgScale} min={0.1} max={3} step={0.1} onChange={(v) => handleChange('bgScale', v)} />
                             <Range label={t.image.rotation} value={config.bgRotation} min={0} max={360} onChange={(v) => handleChange('bgRotation', v)} />
                             
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                     <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                                     {t.image.position}
                                </span>
                                <button 
                                    onClick={handleBgCenterPosition} 
                                    className="flex items-center gap-1 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-blue-400 px-2 py-1 rounded-md transition-all active:scale-95"
                                >
                                    <Target size={12} />
                                    CENTER
                                </button>
                            </div>
                            <Range label={t.layout.centerX} value={config.bgPositionX} min={0} max={100} onChange={(v) => handleChange('bgPositionX', v)} />
                            <Range label={t.layout.centerY} value={config.bgPositionY} min={0} max={100} onChange={(v) => handleChange('bgPositionY', v)} />
                        </ControlGroup>
                    </>
                )}
              </div>
            )}

            {/* EFFECTS TAB (PARTICLES) */}
            {activeTab === 'effects' && (
                <div className="space-y-8">
                     <ControlGroup label={t.particles.atmosphere}>
                        <CustomSelect 
                            label={t.particles.type}
                            value={config.particleEffect}
                            options={Object.values(VisualizerParticleEffect).map(v => ({ value: v, label: t.values[v as keyof typeof t.values] || v }))}
                            onChange={(v) => handleChange('particleEffect', v as VisualizerParticleEffect)}
                        />
                        {config.particleEffect !== VisualizerParticleEffect.None && (
                            <>
                                <Range label={t.particles.count} value={config.particleCount} min={10} max={500} step={10} onChange={(v) => handleChange('particleCount', v)} />
                                <Range label={t.particles.speed} value={config.particleSpeed} min={0.1} max={5} step={0.1} onChange={(v) => handleChange('particleSpeed', v)} />
                                <Range label={t.particles.size} value={config.particleSize} min={0.1} max={5} step={0.1} onChange={(v) => handleChange('particleSize', v)} />
                            </>
                        )}
                     </ControlGroup>
                </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
};

// Helper Components
const ControlGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-4">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
            {label}
        </label>
        <div className="space-y-5">
            {children}
        </div>
    </div>
);

// Custom Number Stepper Component
const NumberControl: React.FC<{ value: number; step: number; onChange: (val: number) => void }> = ({ value, step, onChange }) => {
    return (
        <div className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden h-7">
            <button 
                onClick={() => onChange(Number((value - step).toFixed(2)))}
                className="w-7 h-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 text-gray-400 hover:text-white transition-colors border-r border-white/5"
            >
                <Minus size={12} />
            </button>
            <input 
                type="number"
                value={value}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-14 bg-transparent text-center text-xs font-mono text-blue-400 focus:outline-none"
            />
            <button 
                onClick={() => onChange(Number((value + step).toFixed(2)))}
                className="w-7 h-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 text-gray-400 hover:text-white transition-colors border-l border-white/5"
            >
                <Plus size={12} />
            </button>
        </div>
    );
};

const Range: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (val: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-xs text-gray-300 font-medium">{label}</span>
                <NumberControl value={value} step={step} onChange={onChange} />
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                step={step} 
                value={value} 
                onChange={(e) => onChange(parseFloat(e.target.value))} 
                className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer"
            />
        </div>
    );
};

// Custom Select Component
interface Option { value: string; label: string; }
interface CustomSelectProps {
    label?: string;
    value: string;
    options: Option[];
    onChange: (val: string) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedLabel = options.find(o => o.value === value)?.label || value;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-xs text-gray-300 font-medium mb-1.5">{label}</label>}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border ${isOpen ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'border-white/10'} rounded-lg px-3 py-2 text-sm text-left transition-all active:scale-98`}
            >
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#0f1115] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                    <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${opt.value === value ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-white/5'}`}
                            >
                                {opt.label}
                                {opt.value === value && <Check size={12} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Controls;
