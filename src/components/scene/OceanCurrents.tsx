import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { OceanParameter, DepthLevel } from '../../types/ocean';

interface OceanCurrentsProps {
  visible: boolean;
  parameter?: OceanParameter;
  depth?: DepthLevel;
  meanCurrentSpeed?: number;
}

interface FlowStream {
  points: [number, number][];
  speed: number;
  width: number;
}

const CURRENT_SYSTEMS: FlowStream[] = [
  // Bay of Bengal Cyclonic Gyre (counter-clockwise loop)
  {
    points: [
      [7.5, 84.0], [9.0, 81.0], [12.0, 80.5], [15.5, 81.5],
      [18.5, 84.8], [20.5, 88.5], [19.0, 91.5], [15.0, 92.5],
      [11.0, 89.5], [7.5, 84.0],
    ],
    speed: 0.38,
    width: 0.012,
  },
  // East India Coastal Current (EICC - northward coastal jet)
  {
    points: [
      [8.5, 80.0], [11.5, 80.3], [14.5, 81.0], [17.5, 83.5],
      [20.0, 87.0], [21.5, 89.5],
    ],
    speed: 0.45,
    width: 0.014,
  },
  // Southwest Monsoon Current (SMC - strong trans-basin eastward flow south of India)
  {
    points: [
      [3.5, 70.0], [4.5, 75.0], [5.5, 80.0], [6.5, 85.0],
      [8.0, 90.0], [9.5, 94.5],
    ],
    speed: 0.52,
    width: 0.015,
  },
  // West India Coastal Current (WICC - southward flow along Western Ghats)
  {
    points: [
      [22.0, 69.0], [19.0, 71.0], [15.0, 72.8], [11.0, 74.8],
      [8.0, 76.5], [5.0, 78.0],
    ],
    speed: 0.40,
    width: 0.012,
  },
  // Somali Coastal Jet / Western Arabian Sea Gyre
  {
    points: [
      [2.0, 48.0], [6.0, 50.5], [10.5, 53.0], [14.0, 56.5],
      [16.5, 61.0], [17.0, 66.0], [15.0, 70.0],
    ],
    speed: 0.55,
    width: 0.016,
  },
  // Andaman Sea Circulation
  {
    points: [
      [5.5, 96.0], [8.5, 94.5], [12.0, 94.0], [14.5, 95.5],
      [13.5, 97.5], [9.5, 98.2], [5.5, 98.0],
    ],
    speed: 0.34,
    width: 0.011,
  },
  // Equatorial Undercurrent / Jet (Wyrtki Jet)
  {
    points: [
      [-0.5, 55.0], [0.0, 65.0], [0.5, 75.0], [0.0, 85.0],
      [-0.5, 95.0], [0.0, 100.0],
    ],
    speed: 0.48,
    width: 0.016,
  },
  // South Equatorial Current (SEC - westward flow)
  {
    points: [
      [-10.0, 100.0], [-9.5, 88.0], [-10.0, 75.0], [-11.0, 62.0],
      [-11.5, 50.0],
    ],
    speed: 0.42,
    width: 0.014,
  },
];

const TOTAL_PARTICLES = 1600;
const STREAK_LENGTH = 0.028; // Length of streamline dash

interface ParticleRecord {
  splineIndex: number;
  progress: number;
  speedMod: number;
  lateralOffset: number;
  depthOffset: number;
}

export function OceanCurrents({ visible, parameter = 'waveHeight', depth = 0, meanCurrentSpeed }: OceanCurrentsProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const baseRadius = 2.028;
  const particleRecordsRef = useRef<ParticleRecord[]>([]);

  // Pre-cached CatmullRom splines for each hydrodynamic current system
  const splines = useMemo(() => {
    return CURRENT_SYSTEMS.map((sys) => {
      const v3Points = sys.points.map(([lat, lon]) => new THREE.Vector3(lat, lon, 0));
      return {
        curve: new THREE.CatmullRomCurve3(v3Points, false, 'catmullrom', 0.5),
        speed: sys.speed,
        width: sys.width,
      };
    });
  }, []);

  // Build line-segment geometry for flowing streamline streaks
  const geometry = useMemo(() => {
    const totalVertices = TOTAL_PARTICLES * 2;
    const positions = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);
    const records: ParticleRecord[] = [];

    const c1 = new THREE.Color('#38bdf8'); // Bright sky blue
    const c2 = new THREE.Color('#22d3ee'); // Glowing cyan
    const c3 = new THREE.Color('#10b981'); // Emerald

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const splineIdx = i % splines.length;
      const progress = Math.random();
      const speedMod = 0.75 + Math.random() * 0.5;
      const lateralOffset = (Math.random() - 0.5) * 1.8;
      const depthOffset = Math.random() * 0.006;

      records.push({
        splineIndex: splineIdx,
        progress,
        speedMod,
        lateralOffset,
        depthOffset,
      });

      const col = Math.random() < 0.45 ? c2 : Math.random() < 0.8 ? c1 : c3;

      // Head vertex color (bright)
      colors[i * 2 * 3] = col.r;
      colors[i * 2 * 3 + 1] = col.g;
      colors[i * 2 * 3 + 2] = col.b;

      // Tail vertex color (faded for directional arrowhead effect)
      colors[(i * 2 + 1) * 3] = col.r * 0.25;
      colors[(i * 2 + 1) * 3 + 1] = col.g * 0.25;
      colors[(i * 2 + 1) * 3 + 2] = col.b * 0.25;
    }

    particleRecordsRef.current = records;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [splines]);

  useFrame((_, delta) => {
    if (!lineSegmentsRef.current || !visible) return;

    const posAttr = lineSegmentsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const records = particleRecordsRef.current;

    const depthDiminish = (depth / 1000) * 0.035;
    const currentRadius = baseRadius - depthDiminish;

    // Velocity scaling reflecting real live API current velocity
    const realSpeedScale = meanCurrentSpeed != null ? THREE.MathUtils.clamp(meanCurrentSpeed / 0.25, 0.4, 2.5) : 1.0;
    const paramBoost = parameter === 'currentSpeed' ? 1.6 : 1.0;
    const flowTempo = 0.35 * paramBoost * realSpeedScale;

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const p = records[i];
      if (!p) continue;

      const spline = splines[p.splineIndex];
      if (!spline || !spline.curve) continue;

      // Advance particle along hydrodynamic curve
      p.progress += delta * spline.speed * p.speedMod * flowTempo;
      if (p.progress >= 1.0) p.progress = p.progress % 1.0;

      const headU = THREE.MathUtils.clamp(p.progress, 0.0001, 0.9999);
      const tailU = THREE.MathUtils.clamp(p.progress - STREAK_LENGTH, 0.0001, 0.9999);

      const ptHead = spline.curve.getPoint(headU);
      const ptTail = spline.curve.getPoint(tailU);
      if (!ptHead || !ptTail) continue;

      const latHead = ptHead.x + p.lateralOffset * spline.width * 20.0;
      const lonHead = ptHead.y + p.lateralOffset * spline.width * 20.0;

      const latTail = ptTail.x + p.lateralOffset * spline.width * 20.0;
      const lonTail = ptTail.y + p.lateralOffset * spline.width * 20.0;

      const [xHead, yHead, zHead] = latLonToXYZ(latHead, lonHead, currentRadius - p.depthOffset);
      const [xTail, yTail, zTail] = latLonToXYZ(latTail, lonTail, currentRadius - p.depthOffset);

      // Head vertex
      array[i * 2 * 3] = xHead;
      array[i * 2 * 3 + 1] = yHead;
      array[i * 2 * 3 + 2] = zHead;

      // Tail vertex
      array[(i * 2 + 1) * 3] = xTail;
      array[(i * 2 + 1) * 3 + 1] = yTail;
      array[(i * 2 + 1) * 3 + 2] = zTail;
    }

    posAttr.needsUpdate = true;

    const mat = lineSegmentsRef.current.material as THREE.LineBasicMaterial;
    if (mat) {
      const targetOpacity = visible ? (depth > 0 ? 0.85 : 0.70) : 0;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.08);
      mat.visible = mat.opacity > 0.01;
    }
  });

  return (
    <lineSegments ref={lineSegmentsRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        linewidth={2.0}
      />
    </lineSegments>
  );
}
