import * as THREE from 'three';
import { VisualizerConfig } from '@/types';

export class RecordScene {
    private group: THREE.Group;
    private recordMesh: THREE.Mesh;
    private coverMesh: THREE.Mesh | null = null;
    
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig, coverUrl: string | null) {
        camera.position.set(0, 300, 300);
        camera.lookAt(0, 0, 0);

        this.group = new THREE.Group();
        
        // Vinyl Record body
        const recordGeo = new THREE.CylinderGeometry(150, 150, 2, 64);
        const recordMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.2,
            metalness: 0.8
        });
        this.recordMesh = new THREE.Mesh(recordGeo, recordMat);
        this.group.add(this.recordMesh);

        // Center cover
        if (coverUrl) {
            const coverGeo = new THREE.CylinderGeometry(50, 50, 2.2, 64);
            new THREE.TextureLoader().load(coverUrl, (tex) => {
                const coverMat = new THREE.MeshBasicMaterial({ map: tex });
                this.coverMesh = new THREE.Mesh(coverGeo, coverMat);
                this.group.add(this.coverMesh);
            });
        }

        scene.add(this.group);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        // Spin the record
        this.group.rotation.y -= 0.01 + (beatPulse * 0.05);
        
        // Bounce on beat
        this.group.position.y = beatPulse * 20;
    }

    onResize() {}

    onConfigUpdate() {}

    dispose(scene: THREE.Scene) {
        scene.remove(this.group);
        this.recordMesh.geometry.dispose();
        (this.recordMesh.material as THREE.Material).dispose();
        if (this.coverMesh) {
            this.coverMesh.geometry.dispose();
            (this.coverMesh.material as THREE.Material).dispose();
        }
    }
}
