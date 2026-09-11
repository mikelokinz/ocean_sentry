import { useRef, useMemo } from 'react';
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
  // Bay of Bengal Gyre (Cyclonic loop)
  {
    points: [
      [8.0, 81.5], [11.0, 81.0], [14.5, 82.0], [18.0, 85.0],
      [20.5, 88.5], [19.0, 91.5], [15.0, 92.0], [11.0, 89.0],
      [7.5, 85.0], [8.0, 81.5],
    ],
    speed: 0.14,
    width: 0.008,
  },
  // East India Coastal Current (nearshore northward flow)
  {
    points: [
      [9.0, 80.2], [12.0, 80.5], [15.5, 81.5], [18.5, 84.8],
      [21.0, 88.0], [22.0, 90.5],
    ],
    speed: 0.18,
    width: 0.009,
  },
  // Andaman Sea Flow
  {
    points: [
      [5.5, 96.0], [8.5, 94.5], [12.0, 94.0], [15.0, 95.0],
      [14.0, 97.0], [10.0, 98.0], [6.0, 98.5],
    ],
    speed: 0.12,
    width: 0.007,
  },
  // Southwest Monsoon Current
  {
    points: [
      [3.0, 72.0], [4.5, 77.0], [5.5, 81.0], [7.0, 86.0],
      [9.0, 90.0], [9.5, 94.0],
    ],
    speed: 0.22,
    width: 0.010,
  },
  // West India Coastal Current
  {
    points: [
      [22.0, 69.5], [19.0, 71.5], [15.0, 73.0], [11.0, 75.0],
      [8.0, 77.0], [5.0, 78.5],
    ],
    speed: 0.16,
    width: 0.008,
  },
  // Arabian Sea Central Flow
  {
    points: [
      [10.0, 58.0], [13.0, 62.0], [16.0, 66.0], [17.5, 70.0],
      [14.0, 71.0], [10.0, 67.0], [8.0, 62.0],
    ],
    speed: 0.13,
    width: 0.008,
  },
  // Equatorial Indian Ocean Jet
  {
    points: [
      [0.0, 60.0], [0.5, 70.0], [0.0, 80.0], [-0.5, 90.0],
      [0.0, 98.0],
    ],
    speed: 0.20,
    width: 0.011,
  },
  // South Equatorial Current
  {
    points: [
      [-10.0, 100.0], [-9.5, 88.0], [-10.0, 75.0], [-11.0, 62.0],
      [-12.0, 52.0],
    ],
    speed: 0.15,
    width: 0.009,
  },
];

const TOTAL_PARTICLES = 1400;

interface ParticleRecord {
  splineIndex: number;
  progress: number;
  speed: number;
  lateralOffset: number;
  depthOffset: number;
}

export function OceanCurrents({ visible, parameter = 'waveHeight', depth = 0, meanCurrentSpeed }: OceanCurrentsProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const baseRadius = 2.025;
  const particleRecordsRef = useRef<ParticleRecord[]>([]);

  // Pre-cached splines
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

  // Build geometry once
  const geometry = useMemo(() => {
    const positions = new Float32Array(TOTAL_PARTICLES * 3);
    const colors = new Float32Array(TOTAL_PARTICLES * 3);
    const records: ParticleRecord[] = [];

    const c1 = new THREE.Color('#22d3ee');
    const c2 = new THREE.Color('#38bdf8');
    const c3 = new THREE.Color('#0284c7');

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const splineIdx = i % splines.length;
      // Deterministic pseudorandom distribution
      const hash1 = ((i * 9301 + 49297) % 233280) / 233280;
      const hash2 = ((i * 12345 + 6789) % 100000) / 100000;
      const progress = hash1;
      const speed = splines[splineIdx].speed * (0.8 + hash2 * 0.4);
      const lateralOffset = (hash1 - 0.5) * 1.6;
      const depthOffset = hash2 * 0.005;

      records.push({
        splineIndex: splineIdx,
        progress,
        speed,
        lateralOffset,
        depthOffset,
      });

      const pt = splines[splineIdx].curve.getPointAt(progress);
      const lat = pt.x + lateralOffset * 0.3;
      const lon = pt.y + lateralOffset * 0.3;
      const [x, y, z] = latLonToXYZ(lat, lon, baseRadius - depthOffset);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const col = hash1 < 0.5 ? c1 : hash1 < 0.8 ? c2 : c3;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    particleRecordsRef.current = records;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [splines]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !visible) return;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const records = particleRecordsRef.current;

    const depthDiminish = (depth / 1000) * 0.035;
    const currentRadius = baseRadius - depthDiminish;
    const realSpeedScale = meanCurrentSpeed != null ? THREE.MathUtils.clamp(meanCurrentSpeed / 0.3, 0.3, 3.0) : 1.0;
    const paramBoost = parameter === 'currentSpeed' ? 1.5 : 1.0;
    const speedMult = paramBoost * realSpeedScale;

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const p = records[i];
      if (!p) continue;
      p.progress += delta * p.speed * 0.1 * speedMult;
      if (p.progress >= 1.0) p.progress = p.progress % 1.0;
      if (p.progress < 0) p.progress = 0;

      const spline = splines[p.splineIndex];
      if (!spline || !spline.curve) continue;

      const u = THREE.MathUtils.clamp(p.progress, 0.0001, 0.9999);
      const pt = spline.curve.getPoint(u);
      if (!pt) continue;

      const lat = pt.x + p.lateralOffset * 0.35;
      const lon = pt.y + p.lateralOffset * 0.35;
      const [x, y, z] = latLonToXYZ(lat, lon, currentRadius - p.depthOffset);

      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }

    posAttr.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    if (mat) {
      const targetOpacity = visible ? (depth > 0 ? 0.75 : 0.55) : 0;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.08);
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.016}
        vertexColors
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
