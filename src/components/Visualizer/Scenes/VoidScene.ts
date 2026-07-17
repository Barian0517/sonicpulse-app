import * as THREE from 'three';
import { VisualizerConfig } from '@/types';

export class VoidScene {
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig) {
        // Leave it empty
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        // Do nothing
    }

    onResize() {}
    onConfigUpdate() {}

    dispose(scene: THREE.Scene) {}
}
