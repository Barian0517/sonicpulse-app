import * as THREE from 'three';
import { VisualizerConfig } from '@/types';

export class TunnelScene {
    private particles: THREE.Points;
    private material: THREE.PointsMaterial;
    private time: number = 0;
    
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig) {
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -100);

        const count = 3000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        
        const c1 = new THREE.Color(config.colorStart);
        const c2 = new THREE.Color(config.colorEnd);

        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 50 + Math.random() * 20;
            const z = -Math.random() * 1000;
            
            positions[i*3] = Math.cos(angle) * r;
            positions[i*3+1] = Math.sin(angle) * r;
            positions[i*3+2] = z;

            const mixed = c1.clone().lerp(c2, Math.random());
            colors[i*3] = mixed.r;
            colors[i*3+1] = mixed.g;
            colors[i*3+2] = mixed.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.material = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, this.material);
        scene.add(this.particles);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        this.time += 0.01;
        
        const positions = this.particles.geometry.getAttribute('position').array as Float32Array;
        const speed = 2 + beatPulse * 10;

        for(let i=0; i<3000; i++) {
            positions[i*3+2] += speed;
            // loop back
            if (positions[i*3+2] > 50) {
                positions[i*3+2] = -1000;
            }
        }
        this.particles.geometry.getAttribute('position').needsUpdate = true;
        this.particles.rotation.z = this.time * 0.2;
    }

    onResize() {}
    onConfigUpdate() {}

    dispose(scene: THREE.Scene) {
        scene.remove(this.particles);
        this.particles.geometry.dispose();
        this.material.dispose();
    }
}
