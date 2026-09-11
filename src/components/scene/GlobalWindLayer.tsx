import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WindSystemType } from '../ui/WindControlPanel';

interface GlobalWindLayerProps {
  depth?: number;
  radius?: number;
  activeSystems: Set<WindSystemType>;
}

// ─────────────────────────────────────────────────────────────────
// Wind Channel Definitions
// ─────────────────────────────────────────────────────────────────
interface WindChannel {
  type: WindSystemType;
  points: [number, number][]; // [lat, lon]
  speed: number;
  width: number;
}

const WIND_CHANNELS: WindChannel[] = [
  // 1. TRADE WINDS (Northeast / Southeast)
  { type: 'trade', speed: 0.25, width: 2.0, points: [[20, -40], [10, -60], [0, -80]] }, // Atlantic NE
  { type: 'trade', speed: 0.28, width: 2.5, points: [[-20, -10], [-10, -30], [0, -50]] }, // Atlantic SE
  { type: 'trade', speed: 0.26, width: 3.5, points: [[25, -130], [15, -150], [5, -170]] }, // Pacific NE
  { type: 'trade', speed: 0.27, width: 3.0, points: [[-25, -90], [-15, -110], [-5, -140]] }, // Pacific SE
  { type: 'trade', speed: 0.22, width: 2.5, points: [[-20, 80], [-10, 60], [0, 45]] }, // Indian Ocean SE

  // 2. WESTERLIES (Mid-latitudes)
  { type: 'westerlies', speed: 0.35, width: 2.5, points: [[40, -70], [45, -40], [50, -10]] }, // North Atlantic
  { type: 'westerlies', speed: 0.38, width: 3.0, points: [[40, 140], [45, -170], [50, -130]] }, // North Pacific
  { type: 'westerlies', speed: 0.45, width: 4.0, points: [[-45, 20], [-50, 80], [-55, 140]] }, // Roaring Forties (Indian Ocean)
  { type: 'westerlies', speed: 0.42, width: 4.0, points: [[-45, -170], [-50, -110], [-55, -60]] }, // Roaring Forties (Pacific)

  // 3. POLAR EASTERLIES
  { type: 'polar', speed: 0.20, width: 3.0, points: [[75, -20], [70, -50], [65, -80]] }, // Arctic to NA
  { type: 'polar', speed: 0.22, width: 3.0, points: [[-75, 100], [-70, 70], [-65, 40]] }, // Antarctic

  // 4. MONSOONS (Seasonal reversal - simplified for visualization)
  { type: 'monsoons', speed: 0.32, width: 1.5, points: [[0, 50], [10, 65], [18, 72]] }, // Somali Jet / SW Monsoon
  { type: 'monsoons', speed: 0.30, width: 2.0, points: [[-10, 100], [5, 90], [15, 85]] }, // Bay of Bengal inflow
  
  // 5. REGIONAL SEA BREEZES (Coastal specific)
  { type: 'breeze', speed: 0.15, width: 0.8, points: [[-25, 14], [-28, 12], [-32, 16]] }, // Benguela coastal breeze
  { type: 'breeze', speed: 0.18, width: 0.6, points: [[-20, -75], [-10, -80], [-5, -82]] }, // Humboldt coastal breeze
];

const PARTICLES_PER_CHANNEL = 400; // Dense enough for flow, light enough for CPU
const TRAIL_LENGTH = 0.04;

interface ParticleRecord {
  channelIndex: number;
  progress: number;
  speedMod: number;
  latOffset: number;
  lonOffset: number;
  phase: number;
}

export function GlobalWindLayer({ depth = 0, radius = 2.02, activeSystems }: GlobalWindLayerProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const particlesRef = useRef<ParticleRecord[]>([]);

  // 1. Build Splines
  const splines = useMemo(() => {
    return WIND_CHANNELS.map(ch => {
      // Create CatmullRom splines in 3D space
      const v3Points = ch.points.map(([lat, lon]) => new THREE.Vector3(lat, lon, 0)); // Store lat/lon in x,y
      return {
        ...ch,
        curve: new THREE.CatmullRomCurve3(v3Points, false, 'catmullrom', 0.5),
      };
    });
  }, []);

  // 2. Initialize Geometry
  const geometry = useMemo(() => {
    const totalParticles = WIND_CHANNELS.length * PARTICLES_PER_CHANNEL;
    const positions = new Float32Array(totalParticles * 2 * 3);
    const alphas = new Float32Array(totalParticles * 2);
    const colors = new Float32Array(totalParticles * 2 * 3);
    
    const records: ParticleRecord[] = [];

    // Map system to color
    const colorMap: Record<WindSystemType, THREE.Color> = {
      trade: new THREE.Color('#22d3ee'),
      westerlies: new THREE.Color('#38bdf8'),
      polar: new THREE.Color('#93c5fd'),
      monsoons: new THREE.Color('#818cf8'),
      breeze: new THREE.Color('#c084fc'),
    };

    let idx = 0;
    for (let c = 0; c < WIND_CHANNELS.length; c++) {
      const channel = WIND_CHANNELS[c];
      const baseColor = colorMap[channel.type];
      
      for (let p = 0; p < PARTICLES_PER_CHANNEL; p++) {
        // Distribute offsets
        const latOffset = (Math.random() - 0.5) * channel.width;
        const lonOffset = (Math.random() - 0.5) * channel.width;
        const speedMod = 0.7 + Math.random() * 0.6;
        const progress = Math.random();
        
        records.push({
          channelIndex: c,
          progress,
          speedMod,
          latOffset,
          lonOffset,
          phase: Math.random() * Math.PI * 2,
        });

        // Pre-fill with origin (will be updated in useFrame immediately)
        for(let v=0; v<2; v++) {
          positions[(idx * 2 + v) * 3 + 0] = 0;
          positions[(idx * 2 + v) * 3 + 1] = 0;
          positions[(idx * 2 + v) * 3 + 2] = 0;
          
          colors[(idx * 2 + v) * 3 + 0] = baseColor.r;
          colors[(idx * 2 + v) * 3 + 1] = baseColor.g;
          colors[(idx * 2 + v) * 3 + 2] = baseColor.b;
          
          alphas[idx * 2 + v] = 0;
        }
        idx++;
      }
    }

    particlesRef.current = records;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    return geo;
  }, []);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uGlobalOpacity: { value: 1.0 }
      },
      vertexShader: `
        attribute float alpha;
        attribute vec3 color;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = alpha;
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uGlobalOpacity;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, vAlpha * uGlobalOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // 3. CPU Animation Loop
  useFrame((state, delta) => {
    if (!lineSegmentsRef.current) return;
    
    // Depth fade
    const targetOpacity = depth > 0 ? Math.max(0, 1.0 - depth / 50) : 1.0;
    shaderMaterial.uniforms.uGlobalOpacity.value = THREE.MathUtils.lerp(
      shaderMaterial.uniforms.uGlobalOpacity.value, 
      targetOpacity, 
      0.1
    );

    const geo = lineSegmentsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const alphaAttr = geo.attributes.alpha as THREE.BufferAttribute;
    
    const records = particlesRef.current;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const channel = splines[rec.channelIndex];
      
      // Check toggle state
      const isActive = activeSystems.has(channel.type);
      
      if (isActive) {
        // Advect
        rec.progress += delta * channel.speed * rec.speedMod * 0.1;
        if (rec.progress > 1.0) {
          rec.progress = rec.progress % 1.0;
          // Re-roll lateral offsets when looping to feel organic
          rec.latOffset = (Math.random() - 0.5) * channel.width;
          rec.lonOffset = (Math.random() - 0.5) * channel.width;
        }

        // Dissipation at ends (fade out near 0.0 and 1.0)
        const envelope = Math.sin(rec.progress * Math.PI); 
        // Pulsing lifecycle
        const pulse = (Math.sin(time * 2.0 + rec.phase) + 1.0) * 0.5;
        
        const headAlpha = envelope * pulse * 0.8;
        const tailAlpha = envelope * pulse * 0.1;

        // Head position
        const ptHead = channel.curve.getPoint(rec.progress);
        const [hx, hy, hz] = latLonToXYZ(ptHead.x + rec.latOffset, ptHead.y + rec.lonOffset, radius);
        
        // Tail position (slightly behind)
        const tailProgress = Math.max(0, rec.progress - TRAIL_LENGTH);
        const ptTail = channel.curve.getPoint(tailProgress);
        const [tx, ty, tz] = latLonToXYZ(ptTail.x + rec.latOffset, ptTail.y + rec.lonOffset, radius);

        posAttr.setXYZ(i * 2, hx, hy, hz);
        posAttr.setXYZ(i * 2 + 1, tx, ty, tz);
        
        alphaAttr.setX(i * 2, headAlpha);
        alphaAttr.setX(i * 2 + 1, tailAlpha);
      } else {
        // Hide
        alphaAttr.setX(i * 2, 0);
        alphaAttr.setX(i * 2 + 1, 0);
      }
    }

    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineSegmentsRef} geometry={geometry} material={shaderMaterial} />
  );
}
