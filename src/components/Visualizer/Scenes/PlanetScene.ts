import * as THREE from 'three';
import { VisualizerConfig } from '@/types';

export class PlanetScene {
    private group: THREE.Group;
    private planet: THREE.Mesh;
    private rings: THREE.Points;
    private time: number = 0;
    
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig) {
        camera.position.set(0, 150, 400);
        camera.lookAt(0, 0, 0);

        this.group = new THREE.Group();

        // Planet
        const planetGeo = new THREE.SphereGeometry(60, 32, 32);
        const planetMat = new THREE.MeshStandardMaterial({
            color: config.colorStart,
            roughness: 0.4,
            metalness: 0.3,
            wireframe: config.material === 'Neon'
        });
        this.planet = new THREE.Mesh(planetGeo, planetMat);
        this.group.add(this.planet);

        // Orbit Rings
        const ringGeo = new THREE.BufferGeometry();
        const count = 3000;
        const positions = new Float32Array(count * 3);
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 100 + Math.random() * 150;
            positions[i*3] = Math.cos(angle) * r;
            positions[i*3+1] = (Math.random() - 0.5) * 10;
            positions[i*3+2] = Math.sin(angle) * r;
        }
        ringGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const ringMat = new THREE.PointsMaterial({
            color: config.colorEnd,
            size: 2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        this.rings = new THREE.Points(ringGeo, ringMat);
        this.rings.rotation.x = 0.2;
        this.group.add(this.rings);

        scene.add(this.group);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        this.time += 0.01;
        this.planet.rotation.y = this.time * 0.5;
        this.rings.rotation.y = -this.time * 0.2;
        
        // Planet beats
        const scale = 1 + beatPulse * 0.2;
        this.planet.scale.set(scale, scale, scale);
    }

    onResize() {}
    onConfigUpdate() {}

    dispose(scene: THREE.Scene) {
        scene.remove(this.group);
    }
}
