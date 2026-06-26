import * as THREE from 'three';
import { VisualizerConfig } from '../../../types';

export class GalaxyScene {
    private particles: THREE.Points;
    private material: THREE.PointsMaterial;
    private config: VisualizerConfig;
    private time: number = 0;
    
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig) {
        this.config = config;
        
        camera.position.set(0, 300, 500);
        camera.lookAt(0, 0, 0);

        const count = 10000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        const colorStart = new THREE.Color(config.colorStart);
        const colorEnd = new THREE.Color(config.colorEnd);

        for (let i = 0; i < count; i++) {
            // Spiral distribution
            const r = Math.random() * 400 + 20;
            const theta = r * 0.05 + Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * 50 * (400 / r); // Thicker at center

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);

            // Interpolate color based on radius
            const mixedColor = colorStart.clone().lerp(colorEnd, r / 420);
            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Create circular texture
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 16, 16);
        }
        const tex = new THREE.CanvasTexture(canvas);

        this.material = new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, this.material);
        scene.add(this.particles);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        this.time += 0.002;
        this.particles.rotation.y = this.time;
        
        // Pulse size with beat
        this.material.size = 4 + beatPulse * 5;
    }

    onResize() {}

    onConfigUpdate(config: VisualizerConfig) {
        this.config = config;
        // Updating colors requires rebuilding attributes in a real scenario, skipped for simplicity
    }

    dispose(scene: THREE.Scene) {
        scene.remove(this.particles);
        this.particles.geometry.dispose();
        this.material.dispose();
    }
}
