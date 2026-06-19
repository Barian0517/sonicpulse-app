
export enum VisualizerShape {
  Circle = 'Circle',
  Line = 'Line',
  Sphere = 'Sphere',
  Grid3D = 'Grid3D',
}

export enum VisualizerDirection {
  OutUp = 'Out/Up',
  InDown = 'In/Down',
  Both = 'Both',
}

export enum VisualizerStyle {
  Line = 'Line',
  Dot = 'Dot',
  Both = 'Line + Dot',
}

export enum VisualizerMaterial {
  Standard = 'Standard',
  Neon = 'Neon',
  LED = 'LED',
}

export enum VisualizerParticleEffect {
  None = 'None',
  Snow = 'Snow',
  Rain = 'Rain',
  Sakura = 'Sakura',
}

export enum SymmetryMode {
  LeftToRight = 'L -> R',
  RightToLeft = 'R -> L',
  CenterOut = 'Center Out',
}

export type ColorMode = 'single' | 'dual';

export interface VisualizerConfig {
  shape: VisualizerShape;
  direction: VisualizerDirection;
  style: VisualizerStyle;
  material: VisualizerMaterial;
  
  // Dimensions & Quantity
  barCount: number; // 16 - 32565 (Slider soft cap at 512)
  barWidth: number; // 1 - 50
  barLengthScale: number; // Sensitivity/Height 0.1 - 5
  
  // Arrangement
  symmetry: SymmetryMode;
  startAngle: number; // 0 - 360 (for circle)
  
  // Positioning
  radius: number; // For circle
  linearGap: number; // For line spacing
  centerX: number; // % of screen
  centerY: number; // % of screen
  
  // Effects
  shakeFactor: number; // 0 - 100 (Screen shake on bass)
  colorMode: ColorMode;
  colorStart: string;
  colorEnd: string;
  smoothing: number; // 0 - 0.99
  
  // Background
  backgroundImage: string | null;
  bgShakeIntensity: number; // 0 - 100
  bgShakeSmoothing: number; // 0 - 0.99
  bgVignette: number; // 0 - 100
  bgFloatSpeed: number; // 0 - 10
  bgScale: number; // 0.1 - 3
  bgPositionX: number; // 0 - 100
  bgPositionY: number; // 0 - 100
  bgRotation: number; // 0 - 360

  // Atmospheric Particles
  particleEffect: VisualizerParticleEffect;
  particleCount: number; // 0 - 500
  particleSpeed: number; // 0.1 - 5
  particleSize: number; // 0.1 - 5
  
  // Grid3D Triggers
  grid3D_pulseEnable: boolean;
  grid3D_pulseSensitivity: number;
  grid3D_pulseCooldown: number;
  grid3D_pulseStrength: number;
  
  grid3D_meteorEnable: boolean;
  grid3D_meteorSensitivity: number;
  grid3D_meteorCooldown: number;
  grid3D_meteorStrength: number;
}

export interface AudioSourceState {
  isPlaying: boolean;
  mode: 'mic' | 'system' | 'file';
  fileName?: string;
  sinkId?: string; // Output device ID
  monitorAudio?: boolean; // For system capture: pass through to speakers?
  volume?: number; // 0 - 1
}
