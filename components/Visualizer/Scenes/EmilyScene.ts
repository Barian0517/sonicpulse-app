import * as THREE from 'three';
import { VisualizerConfig } from '../../../types';

export class EmilyScene {
    private particleSystem: THREE.Points;
    private material: THREE.ShaderMaterial;
    private uniforms: any;
    private time: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: VisualizerConfig, coverUrl: string | null) {
        camera.position.set(0, 0, 400);
        camera.lookAt(0, 0, 0);

        const size = 128;
        const count = size * size;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const uvs = new Float32Array(count * 2);

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const idx = i * size + j;
                positions[idx * 3] = (i - size / 2) * 4;
                positions[idx * 3 + 1] = (j - size / 2) * 4;
                positions[idx * 3 + 2] = 0;

                uvs[idx * 2] = i / size;
                uvs[idx * 2 + 1] = j / size;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        this.uniforms = {
            uTime: { value: 0 },
            uBeat: { value: 0 },
            uTexture: { value: null },
            uColorStart: { value: new THREE.Color(config.colorStart) }
        };

        if (coverUrl) {
            new THREE.TextureLoader().load(coverUrl, (tex) => {
                this.uniforms.uTexture.value = tex;
            });
        }

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
                uniform float uTime;
                uniform float uBeat;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    // Add wave effect based on distance from center
                    float dist = length(pos.xy);
                    pos.z += sin(dist * 0.05 - uTime * 2.0) * 10.0 * (1.0 + uBeat * 2.0);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 3.0 + uBeat * 5.0;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                uniform vec3 uColorStart;
                uniform float uBeat;
                varying vec2 vUv;
                void main() {
                    vec4 texColor = texture2D(uTexture, vUv);
                    // Fallback to theme color if no texture
                    vec3 finalColor = texColor.a > 0.1 ? texColor.rgb : uColorStart;
                    
                    // Circular particle
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    
                    gl_FragColor = vec4(finalColor + (uBeat * 0.5), 0.8 + uBeat * 0.2);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, this.material);
        scene.add(this.particleSystem);
    }

    update(dataArray: Uint8Array, beatPulse: number) {
        this.time += 0.016;
        this.uniforms.uTime.value = this.time;
        this.uniforms.uBeat.value = beatPulse;
        
        // Gentle rotation
        this.particleSystem.rotation.y = Math.sin(this.time * 0.5) * 0.2;
        this.particleSystem.rotation.x = Math.sin(this.time * 0.3) * 0.1;
    }

    onResize(width: number, height: number) {}

    onConfigUpdate(config: VisualizerConfig) {
        this.uniforms.uColorStart.value.set(config.colorStart);
    }

    dispose(scene: THREE.Scene) {
        scene.remove(this.particleSystem);
        this.particleSystem.geometry.dispose();
        this.material.dispose();
    }
}
