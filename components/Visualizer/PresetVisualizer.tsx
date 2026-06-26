import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { VisualizerConfig, VisualizerShape } from '../../types';
import { BeatDetector } from '../../utils/beatDetector';
import { EmilyScene } from './Scenes/EmilyScene';

interface PresetVisualizerProps {
    config: VisualizerConfig;
    analyser: AnalyserNode | null;
    albumCoverUrl: string | null;
}

export const PresetVisualizer: React.FC<PresetVisualizerProps> = ({ config, analyser, albumCoverUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const reqRef = useRef<number>(0);
    
    // Core Three.js references
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const beatDetectorRef = useRef<BeatDetector | null>(null);

    // Active Scene Class Instance
    const activeSceneInstance = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Three.js Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0); // Transparent background
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
        camera.position.z = 400;
        cameraRef.current = camera;

        if (analyser) {
            beatDetectorRef.current = new BeatDetector(analyser);
        }

        // Setup the specific scene
        const setupScene = () => {
            // Clean up previous scene
            if (activeSceneInstance.current && activeSceneInstance.current.dispose) {
                activeSceneInstance.current.dispose(scene);
            }
            scene.clear(); // remove all objects
            
            // Add basic ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(0, 100, 100);
            scene.add(dirLight);

            // Instantiate correct scene class
            switch (config.shape) {
                case VisualizerShape.PresetEmily:
                    activeSceneInstance.current = new EmilyScene(scene, camera, config, albumCoverUrl);
                    break;
            }
        };

        setupScene();

        // Arrays for frequency data
        const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0);

        const animate = () => {
            reqRef.current = requestAnimationFrame(animate);

            let beatPulse = 0;
            if (beatDetectorRef.current && analyser) {
                beatDetectorRef.current.update();
                // Pass a short decay pulse
                beatPulse = beatDetectorRef.current.currentImpact;
                analyser.getByteFrequencyData(dataArray as any);
            }

            // Update Active Scene
            if (activeSceneInstance.current && activeSceneInstance.current.update) {
                activeSceneInstance.current.update(dataArray, beatPulse);
            }

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
                
                if (activeSceneInstance.current && activeSceneInstance.current.onResize) {
                    activeSceneInstance.current.onResize(window.innerWidth, window.innerHeight);
                }
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
            if (containerRef.current && rendererRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            if (activeSceneInstance.current && activeSceneInstance.current.dispose) {
                activeSceneInstance.current.dispose(scene);
            }
            renderer.dispose();
        };
    }, [config.shape, analyser, albumCoverUrl]); // Re-init when shape or cover changes

    // Hot update for config values without recreating the scene
    useEffect(() => {
        if (activeSceneInstance.current && activeSceneInstance.current.onConfigUpdate) {
            activeSceneInstance.current.onConfigUpdate(config);
        }
    }, [config]);

    return (
        <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />
    );
};
