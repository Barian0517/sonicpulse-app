import { useFrame, extend, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useMemo, useState, useLayoutEffect, useEffect } from 'react';
import { MapShaderMaterial } from './CustomShaderMaterial';
import { AudioMetricsAnalyzer } from '@/utils/audioMetrics';
import { VisualizerConfig } from '@/types';

extend({ MapShaderMaterial });

const hexToColor = (hex: string) => {
    return new THREE.Color(hex);
};

export function MapScene({ analyser, config }: { analyser: AnalyserNode | null, config: VisualizerConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<any>(null);
  const { clock } = useThree();
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const analyzerEngine = useRef(new AudioMetricsAnalyzer());
  
  const gridSize = 160;
  const spacing = 1.05;
  const count = gridSize * gridSize;

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const tempMatrix = new THREE.Matrix4();
    const offset = (gridSize * spacing) / 2;

    let i = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const px = x * spacing - offset;
        const pz = z * spacing - offset;
        tempMatrix.makeTranslation(px, 0.5, pz);
        meshRef.current.setMatrixAt(i, tempMatrix);
        i++;
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [gridSize, spacing]);

  const ripplesRef = useRef(new Array(10).fill(null).map(() => ({
    pos: new THREE.Vector2(),
    time: -100,
    strength: 0,
    isActive: 0
  })));
  const rippleIndex = useRef(0);

  const addRipple = (x: number, y: number, strength: number, isWhite: boolean = false) => {
    const idx = rippleIndex.current;
    ripplesRef.current[idx] = {
      pos: new THREE.Vector2(x, y),
      time: clock.getElapsedTime(),
      strength,
      isActive: 1,
      rippleType: isWhite ? 1 : 0
    } as any;
    rippleIndex.current = (idx + 1) % 10;
  };

  const fogRef = useRef<THREE.Fog>(null);
  
  const MAX_METEORS = 20;
  const meteorMeshRef = useRef<THREE.InstancedMesh>(null);
  const meteorMatRef = useRef<THREE.MeshBasicMaterial>(null);
  
  const MAX_PARTICLES = 200;
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef(new Array(MAX_PARTICLES).fill(null).map(() => ({
    active: false,
    x: 0, y: -1000, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0, maxLife: 1, scale: 1
  })));
  const particleIndex = useRef(0);
  const spawnParticle = (x: number, y: number, z: number, speedMultiplier: number) => {
     const idx = particleIndex.current;
     const p = particlesRef.current[idx];
     p.active = true;
     p.x = x + (Math.random() - 0.5) * 1.5;
     p.y = y + (Math.random() - 0.5) * 1.5;
     p.z = z + (Math.random() - 0.5) * 1.5;
     p.vx = (Math.random() - 0.5) * 2.0;
     p.vy = Math.random() * 2.0 + speedMultiplier * 10.0;
     p.vz = (Math.random() - 0.5) * 2.0;
     p.life = 0;
     p.maxLife = 0.5 + Math.random() * 0.5;
     p.scale = Math.random() * 0.6 + 0.2;
     particleIndex.current = (idx + 1) % MAX_PARTICLES;
  };
  
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyPosition = useMemo(() => new THREE.Vector3(), []);
  const dummyRotation = useMemo(() => new THREE.Quaternion(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);
  
  const meteorsRef = useRef(new Array(MAX_METEORS).fill(null).map(() => ({
    active: false,
    x: 0,
    y: -1000,
    z: 0,
    speed: 0,
    strength: 0,
  })));
  const meteorIndex = useRef(0);
  const lastMeteorSpawnTime = useRef(-Infinity);

  const addMeteor = (strength: number) => {
     const now = clock.getElapsedTime();
     const cooldownSeconds = analyzerEngine.current.meteorTrigger.cooldown / 60;
     if (now - lastMeteorSpawnTime.current < cooldownSeconds) return;
     lastMeteorSpawnTime.current = now;

     const idx = meteorIndex.current;
     const angle = Math.random() * Math.PI * 2;
     const dist = Math.random() * 25;
     
     const m = meteorsRef.current[idx];
     m.active = true;
     m.x = Math.cos(angle) * dist;
     m.z = Math.sin(angle) * dist;
     m.y = 30 + Math.random() * 10;
     m.speed = 1.0 + Math.random() * 0.5 + (strength * 1.5);
     m.strength = strength;
     
     meteorIndex.current = (idx + 1) % MAX_METEORS;
  };
  
  useEffect(() => {
    analyzerEngine.current.onFreqTrigger = (strength, mode, action) => {
       if (action === 'Meteor') {
          addMeteor(strength);
       } else {
          const angle = Math.random() * Math.PI * 2;
          if (mode === 'Kick') {
             const dist = Math.random() * 25;
             const rx = Math.cos(angle) * dist;
             const rz = Math.sin(angle) * dist;
             addRipple(rx, rz, Math.min(strength * 3.0, 4.0));
          } 
          else {
             const dist = 10 + Math.random() * 25; 
             const rx = Math.cos(angle) * dist;
             const rz = Math.sin(angle) * dist;
             addRipple(rx, rz, Math.min(strength * 3.0, 3.0));
          }
       }
    };
  }, []);

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const mat = materialRef.current;
    
    let isPlaying = false;
    if (analyser) {
        if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
          dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataArrayRef.current);
        isPlaying = dataArrayRef.current.some(v => v > 0);
    }
    
    // Sync trigger config
    const engine = analyzerEngine.current;
    engine.pulseTrigger.enabled = config.grid3D_pulseEnable ?? true;
    engine.pulseTrigger.sensitivity = config.grid3D_pulseSensitivity ?? 0.15;
    engine.pulseTrigger.cooldown = config.grid3D_pulseCooldown ?? 60;
    engine.pulseTrigger.pulseStrength = config.grid3D_pulseStrength ?? 0.2;
    
    engine.meteorTrigger.enabled = config.grid3D_meteorEnable ?? true;
    engine.meteorTrigger.sensitivity = config.grid3D_meteorSensitivity ?? 0.45;
    engine.meteorTrigger.cooldown = config.grid3D_meteorCooldown ?? 241;
    engine.meteorTrigger.pulseStrength = config.grid3D_meteorStrength ?? 0.5;

    const data = engine.update(dataArrayRef.current || new Uint8Array(512), isPlaying);

    const baseCol1 = new THREE.Color('#02040a');
    const baseCol2 = new THREE.Color('#080d18');
    
    const userCool = hexToColor(config.colorStart);
    const userWarm = config.colorMode === 'dual' ? hexToColor(config.colorEnd) : userCool;

    const lerpSpeed = 3.0 * delta;
    mat.uBaseColor1.lerp(baseCol1, lerpSpeed);
    mat.uBaseColor2.lerp(baseCol2, lerpSpeed);
    mat.uCoolCore.lerp(userCool, lerpSpeed);
    mat.uCoolEdge.lerp(userCool.clone().multiplyScalar(0.6), lerpSpeed); 
    mat.uWarmCore.lerp(userWarm, lerpSpeed);
    mat.uWarmEdge.lerp(userWarm.clone().multiplyScalar(0.6), lerpSpeed);
    mat.uRippleColor.lerp(new THREE.Color(0xffffff), lerpSpeed);
    
    const targetGlow = config.material === 'Neon' ? 2.5 : (config.material === 'LED' ? 1.5 : 0.8);
    mat.uGlowIntensity = THREE.MathUtils.lerp(mat.uGlowIntensity, targetGlow, lerpSpeed);

    if (fogRef.current) {
        fogRef.current.color.lerp(baseCol1, lerpSpeed);
    }

    mat.uTime = state.clock.getElapsedTime();
    mat.uBass = data.bass;
    mat.uMid = data.mid;
    mat.uTreble = data.treble;
    mat.uEnergy = data.energy;
    
    mat.uSubBass = data.subBass;
    mat.uLowMid = data.lowMid;
    mat.uHighMid = data.highMid;
    mat.uPresence = data.presence;
    mat.uBrilliance = data.brilliance;
    mat.uAir = data.air;

    mat.uWarmth = data.warmth;
    mat.uBrightness = data.brightness;
    mat.uSharpness = data.sharpness;
    mat.uSmoothness = data.smoothness;
    mat.uDensity = data.density;
    mat.uSpectralCentroid = data.spectralCentroid;
    
    mat.uRipples = ripplesRef.current;

    if (meteorMeshRef.current) {
        if (meteorMatRef.current) {
            const mColor = new THREE.Color().copy(userWarm).lerp(new THREE.Color(0xffffff), 0.7);
            meteorMatRef.current.color.lerp(mColor, lerpSpeed);
        }

        for (let i = 0; i < MAX_METEORS; i++) {
            const m = meteorsRef.current[i];
            if (!m.active) {
                dummyPosition.set(0, -1000, 0);
                dummyScale.set(0, 0, 0);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
            } else {
                m.y -= m.speed * 60 * delta;
                if (m.y <= 0) {
                    m.active = false;
                    addRipple(m.x, m.z, Math.min(m.strength * 1.0, 1.2), true); 
                    for (let pIndex = 0; pIndex < 10; pIndex++) spawnParticle(m.x, 0.5, m.z, m.speed * 1.5);
                }
                dummyPosition.set(m.x, Math.max(0, m.y), m.z);
                dummyScale.set(1.5, 1.5, 1.5);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
                
                if (m.y > 0 && Math.random() > 0.3) {
                   spawnParticle(m.x, m.y, m.z, m.speed * 0.2);
                }
            }
        }
        meteorMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    
    if (particleMeshRef.current) {
        if (particleMatRef.current) particleMatRef.current.color.copy(meteorMatRef.current ? meteorMatRef.current.color : new THREE.Color(0xffffff));
        
        for (let i = 0; i < MAX_PARTICLES; i++) {
           const p = particlesRef.current[i];
           if (!p.active) {
                dummyPosition.set(0, -1000, 0);
                dummyScale.set(0, 0, 0);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                particleMeshRef.current.setMatrixAt(i, dummyMatrix);
           } else {
                p.life += delta;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    dummyScale.set(0, 0, 0);
                } else {
                    p.x += p.vx * delta * 10;
                    p.y += p.vy * delta * 10;
                    p.z += p.vz * delta * 10;
                    const s = p.scale * (1.0 - (p.life / p.maxLife));
                    dummyPosition.set(p.x, p.y, p.z);
                    dummyScale.set(s, s, s);
                }
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                particleMeshRef.current.setMatrixAt(i, dummyMatrix);
           }
        }
        particleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const [pressTime, setPressTime] = useState(0);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    setPressTime(performance.now());
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const duration = performance.now() - pressTime;
    const strength = Math.min(0.2 + (duration / 1000) * 2.8, 3.0);
    addRipple(e.point.x, e.point.z, strength);
  };

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[`#02040a`, 30, 95]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
      
      <OrbitControls 
        makeDefault 
        autoRotate={config.bgRotation > 0} 
        autoRotateSpeed={config.bgRotation > 0 ? 0.5 : 0}
        enablePan={false}
        minDistance={5}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[0.9, 1, 0.9]} />
        {/* @ts-ignore */}
        <mapShaderMaterial ref={materialRef} transparent={true} />
      </instancedMesh>

      <instancedMesh ref={meteorMeshRef} args={[undefined as any, undefined as any, MAX_METEORS]} frustumCulled={false}>
         <boxGeometry args={[0.4, 1.2, 0.4]} />
         <meshBasicMaterial ref={meteorMatRef} color="#ffffff" toneMapped={false} /> 
      </instancedMesh>

      <instancedMesh ref={particleMeshRef} args={[undefined as any, undefined as any, MAX_PARTICLES]} frustumCulled={false}>
         <boxGeometry args={[0.8, 0.8, 0.8]} />
         <meshBasicMaterial ref={particleMatRef} color="#ffffff" toneMapped={false} transparent={true} opacity={0.6} /> 
      </instancedMesh>
    </>
  );
}
