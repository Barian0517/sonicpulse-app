import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { VisualizerConfig, VisualizerParticleEffect } from '../../types';
import { BeatDetector } from '../../utils/beatDetector';

interface ThreeParticleVisualizerProps {
    config: VisualizerConfig;
    analyser: AnalyserNode | null;
}

export const ThreeParticleVisualizer: React.FC<ThreeParticleVisualizerProps> = ({ config, analyser }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const particlesRef = useRef<THREE.Points | null>(null);
    const beatDetectorRef = useRef<BeatDetector | null>(null);
    const reqRef = useRef<number>(0);

    // Animation state
    const beatPulseRef = useRef<number>(0);
    const targetCameraZRef = useRef<number>(400);
    const baseCameraZ = 400;

    useEffect(() => {
        if (!containerRef.current) return;
        
        // If performance mode is ON or Particle Effect is None, we don't render anything
        if (config.performanceMode || config.particleEffect === VisualizerParticleEffect.None) {
            return;
        }

        // Initialize Three.js
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = baseCameraZ;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0); // Transparent background
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create Particles
        const geometry = new THREE.BufferGeometry();
        const particleCount = config.particleCount * 10; // e.g. 500 * 10 = 5000 particles
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            // Random positions in a wide area
            positions[i * 3] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;

            // Base velocities
            velocities[i * 3] = (Math.random() - 0.5) * config.particleSpeed;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * config.particleSpeed;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * config.particleSpeed;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        // Create circular texture for particles
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext('2d');
        if (context) {
            const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 16, 16);
        }
        const texture = new THREE.CanvasTexture(canvas);

        const material = new THREE.PointsMaterial({
            size: config.particleSize * 2,
            map: texture,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: new THREE.Color(config.colorStart) // Use dominant color
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        particlesRef.current = particles;

        // Initialize Beat Detector
        if (analyser) {
            const detector = new BeatDetector(analyser);
            detector.onBeat = (impact) => {
                // Flash / Pulse particles
                beatPulseRef.current = impact * 2.0; 
                
                // Camera shake/bounce
                targetCameraZRef.current = baseCameraZ - (impact * 50); // Jump forward
            };
            beatDetectorRef.current = detector;
        }

        // Animation Loop
        const animate = () => {
            reqRef.current = requestAnimationFrame(animate);

            if (beatDetectorRef.current) {
                beatDetectorRef.current.update();
            }

            // Update beat pulse decay
            if (beatPulseRef.current > 0) {
                beatPulseRef.current = Math.max(0, beatPulseRef.current - 0.05);
            }

            // Update camera bounce with easing
            if (cameraRef.current) {
                cameraRef.current.position.z += (targetCameraZRef.current - cameraRef.current.position.z) * 0.1;
                // Return to base Z
                targetCameraZRef.current += (baseCameraZ - targetCameraZRef.current) * 0.05;
            }

            // Update particles
            if (particlesRef.current) {
                const geom = particlesRef.current.geometry;
                const posAttribute = geom.getAttribute('position');
                const velAttribute = geom.getAttribute('velocity');
                const posArray = posAttribute.array as Float32Array;
                const velArray = velAttribute.array as Float32Array;

                // Make material react to beat
                const mat = particlesRef.current.material as THREE.PointsMaterial;
                mat.size = (config.particleSize * 2) + (beatPulseRef.current * 10);
                mat.opacity = 0.5 + Math.min(0.5, beatPulseRef.current);
                
                // Keep color updated
                mat.color.set(config.colorStart);

                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    
                    // Add some beat-based expansion
                    if (beatPulseRef.current > 0.5) {
                        const dist = Math.sqrt(posArray[i3]*posArray[i3] + posArray[i3+1]*posArray[i3+1] + posArray[i3+2]*posArray[i3+2]);
                        if (dist > 0) {
                            posArray[i3] += (posArray[i3] / dist) * beatPulseRef.current * 2;
                            posArray[i3+1] += (posArray[i3+1] / dist) * beatPulseRef.current * 2;
                            posArray[i3+2] += (posArray[i3+2] / dist) * beatPulseRef.current * 2;
                        }
                    }

                    posArray[i3] += velArray[i3];
                    posArray[i3 + 1] += velArray[i3 + 1];
                    posArray[i3 + 2] += velArray[i3 + 2];

                    // Gentle rotation based on speed and beat
                    const rotationSpeed = 0.001 * config.particleSpeed + (beatPulseRef.current * 0.005);
                    particlesRef.current.rotation.y += rotationSpeed / particleCount;
                    particlesRef.current.rotation.x += (rotationSpeed / 2) / particleCount;

                    // Wrap around
                    if (posArray[i3 + 1] < -500) posArray[i3 + 1] = 500;
                    if (posArray[i3 + 1] > 500) posArray[i3 + 1] = -500;
                    if (posArray[i3] < -1000) posArray[i3] = 1000;
                    if (posArray[i3] > 1000) posArray[i3] = -1000;
                }
                posAttribute.needsUpdate = true;
            }

            renderer.render(scene, camera);
        };

        animate();

        // Handle resize
        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
            if (containerRef.current && rendererRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            geometry.dispose();
            material.dispose();
            texture.dispose();
            renderer.dispose();
        };
    }, [config.particleEffect, config.particleCount, config.performanceMode, analyser]); // Re-init if major settings change

    // Update dynamic properties without re-init
    useEffect(() => {
        if (particlesRef.current) {
            const mat = particlesRef.current.material as THREE.PointsMaterial;
            mat.color.set(config.colorStart);
        }
    }, [config.colorStart]);

    if (config.performanceMode || config.particleEffect === VisualizerParticleEffect.None) {
        return null;
    }

    return (
        <div 
            ref={containerRef} 
            className="absolute inset-0 z-0 pointer-events-none mix-blend-screen"
        />
    );
};
