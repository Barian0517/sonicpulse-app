import React from 'react';
import { Canvas } from '@react-three/fiber';
import { MapScene } from './MapScene';
import { VisualizerConfig } from '@/types';

interface ThreeVisualizerProps {
  analyser: AnalyserNode | null;
  config: VisualizerConfig;
}

export const ThreeVisualizer: React.FC<ThreeVisualizerProps> = ({ analyser, config }) => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas camera={{ position: [0, 40, 60], fov: 45 }}>
        <MapScene analyser={analyser} config={config} />
      </Canvas>
    </div>
  );
};
