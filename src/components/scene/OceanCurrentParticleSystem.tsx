import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WeatherVectorPoint, ValidationDirectionMode } from '../../types/weather';

interface OceanCurrentParticleSystemProps {
  visible: boolean;
  gridPoints?: WeatherVectorPoint[];
  nextGridPoints?: WeatherVectorPoint[];
  temporalAlpha?: number;
  speedMultiplier?: number;
  particleCount?: number;
  trailLength?: number;
  validationMode?: ValidationDirectionMode;
}

const MAX_CURRENT_PARTICLES = 3000;
const MAX_TRAIL_LENGTH = 12;

interface MarineParticle {
  lat: number;
  lon: number;
  speed: number;
  age: number;
  maxAge: number;
  trail: [number, number][];
}

// Known open ocean spawn regions for Indian Ocean & Bay of Bengal
const OCEAN_SPAWN_ZONES = [
  { minLat: 6.0, maxLat: 19.0, minLon: 81.0, maxLon: 92.0 }, // Bay of Bengal
  { minLat: 4.0, maxLat: 18.0, minLon: 58.0, maxLon: 72.0 }, // Arabian Sea
  { minLat: -4.0, maxLat: 4.0, minLon: 60.0, maxLon: 95.0 },  // Equatorial Jet
  { minLat: -12.0, maxLat: -5.0, minLon: 60.0, maxLon: 95.0 }, // South Equatorial
];

function getRandomOceanCoordinate(): [number, number] {
  const zone = OCEAN_SPAWN_ZONES[Math.floor(Math.random() * OCEAN_SPAWN_ZONES.length)];
  const lat = zone.minLat + Math.random() * (zone.maxLat - zone.minLat);
  const lon = zone.minLon + Math.random() * (zone.maxLon - zone.minLon);
  return [lat, lon];
}

export function OceanCurrentParticleSystem({
  visible,
  gridPoints = [],
  nextGridPoints,
  temporalAlpha = 0.0,
  speedMultiplier = 1.0,
  particleCount = 2000,
  trailLength = 8,
  validationMode = 'live',
}: OceanCurrentParticleSystemProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const opacityRef = useRef(0);

  const activeCount = Math.min(MAX_CURRENT_PARTICLES, Math.max(400, particleCount));
  const activeTrail = Math.min(MAX_TRAIL_LENGTH, Math.max(3, trailLength));

  // ── IDW Ocean Vector Field Interpolation with Land-Masking ─────────────────
  const sampleCurrentField = useMemo(() => {
    return (lat: number, lon: number): [number, number, number, boolean] => {
      // 1. Validation mode
      if (validationMode && validationMode !== 'live') {
        const testSpeed = 1.8;
        let testDir = 0.0;
        if (validationMode === '0-north') testDir = 0.0;
        else if (validationMode === '90-east') testDir = 90.0;
        else if (validationMode === '180-south') testDir = 180.0;
        else if (validationMode === '270-west') testDir = 270.0;
        else if (validationMode === '45-ne') testDir = 45.0;
        else if (validationMode === '225-sw') testDir = 225.0;

        const rad = (testDir * Math.PI) / 180.0;
        return [testSpeed * Math.sin(rad), testSpeed * Math.cos(rad), testSpeed, true];
      }

      // 2. Sample live grid data using 4-nearest Inverse Distance Weighting
      if (gridPoints && gridPoints.length > 0) {
        let totalWeight = 0.0;
        let uSum = 0.0;
        let vSum = 0.0;
        let oceanConfidence = 0.0;

        for (let i = 0; i < gridPoints.length; i++) {
          const p = gridPoints[i];
          const dLat = p.latitude - lat;
          let dLon = p.longitude - lon;
          if (dLon > 180) dLon -= 360;
          if (dLon < -180) dLon += 360;

          const distSq = dLat * dLat + dLon * dLon;

          if (distSq < 0.04) {
            let u0 = p.u_current;
            let v0 = p.v_current;
            let vel0 = p.current_velocity_kts;

            if (nextGridPoints && nextGridPoints[i] && temporalAlpha > 0) {
              const np = nextGridPoints[i];
              u0 = THREE.MathUtils.lerp(u0, np.u_current, temporalAlpha);
              v0 = THREE.MathUtils.lerp(v0, np.v_current, temporalAlpha);
              vel0 = THREE.MathUtils.lerp(vel0, np.current_velocity_kts, temporalAlpha);
            }
            return [u0, v0, vel0, p.is_ocean];
          }

          const w = 1.0 / (distSq + 0.8);
          let curU = p.u_current;
          let curV = p.v_current;

          if (nextGridPoints && nextGridPoints[i] && temporalAlpha > 0) {
            const np = nextGridPoints[i];
            curU = THREE.MathUtils.lerp(curU, np.u_current, temporalAlpha);
            curV = THREE.MathUtils.lerp(curV, np.v_current, temporalAlpha);
          }

          uSum += w * curU;
          vSum += w * curV;
          if (p.is_ocean) oceanConfidence += w;
          totalWeight += w;
        }

        if (totalWeight > 0) {
          const u = uSum / totalWeight;
          const v = vSum / totalWeight;
          const vel = Math.sqrt(u * u + v * v);
          const isOcean = (oceanConfidence / totalWeight) > 0.35;
          return [u, v, vel, isOcean];
        }
      }

      // 3. Fallback East India Coastal / Southwest Monsoon Current
      const defaultDir = (lat > 5.0 && lon > 75.0) ? 55.0 : 210.0;
      const defaultVel = 1.2;
      const rad = (defaultDir * Math.PI) / 180.0;
      return [defaultVel * Math.sin(rad), defaultVel * Math.cos(rad), defaultVel, true];
    };
  }, [gridPoints, nextGridPoints, temporalAlpha, validationMode]);

  // Distinct Hydrodynamic Marine Palette (deep navy/teal to luminous electric cyan)
  const getCurrentColor = (velKts: number): [number, number, number] => {
    if (velKts < 0.6) return [0.02, 0.45, 0.65]; // Deep Oceanic Teal (#0284c7)
    if (velKts < 1.2) return [0.04, 0.72, 0.83]; // Hydrodynamic Aqua (#06b6d4)
    if (velKts < 2.0) return [0.22, 0.85, 0.98]; // Electric Marine Cyan (#38bdf8)
    return [0.38, 0.55, 0.98]; // High-Velocity Jet Sapphire (#6366f1)
  };

  // Pre-allocate persistent marine particle records
  const particles = useMemo<MarineParticle[]>(() => {
    const list: MarineParticle[] = [];
    for (let i = 0; i < MAX_CURRENT_PARTICLES; i++) {
      const [lat, lon] = getRandomOceanCoordinate();
      const [, , speed] = sampleCurrentField(lat, lon);
      const trail: [number, number][] = [];
      for (let t = 0; t < MAX_TRAIL_LENGTH; t++) {
        trail.push([lat, lon]);
      }
      list.push({
        lat,
        lon,
        speed,
        age: Math.floor(Math.random() * 120),
        maxAge: 90 + Math.floor(Math.random() * 60),
        trail,
      });
    }
    return list;
  }, [sampleCurrentField]);

  const totalVertices = MAX_CURRENT_PARTICLES * (MAX_TRAIL_LENGTH - 1) * 2;
  const positions = useMemo(() => new Float32Array(totalVertices * 3), [totalVertices]);
  const colors = useMemo(() => new Float32Array(totalVertices * 3), [totalVertices]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  useFrame((_, delta) => {
    if (!lineSegmentsRef.current) return;

    // Opacity cross-fade
    const targetOpacity = visible ? 0.92 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 6.0);
    const mat = lineSegmentsRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;

    if (!mat.visible) return;

    const dt = Math.min(delta, 0.05) * speedMultiplier;
    const radius = 2.014; // Strictly skimming sea surface (below atmospheric wind)
    let vIndex = 0;

    for (let i = 0; i < activeCount; i++) {
      const p = particles[i];
      p.age += 1;

      // Sample current vector and ocean mask
      const [u, v, vel, isOcean] = sampleCurrentField(p.lat, p.lon);

      // Respawn particle if it ages out, crosses land, or leaves valid waters
      if (p.age > p.maxAge || !isOcean || p.lat > 24.0 || p.lat < -15.0 || p.lon < 50.0 || p.lon > 105.0) {
        const [newLat, newLon] = getRandomOceanCoordinate();
        p.lat = newLat;
        p.lon = newLon;
        p.age = 0;
        p.maxAge = 80 + Math.floor(Math.random() * 60);
        for (let t = 0; t < activeTrail; t++) {
          p.trail[t] = [p.lat, p.lon];
        }
      }

      p.speed = vel;

      // Hydrodynamic advection along spherical surface
      const latRad = (p.lat * Math.PI) / 180.0;
      const cosLat = Math.max(0.15, Math.cos(latRad));

      // Oceanic currents are slower than wind, scaled appropriately
      const k = 0.0018 * dt * 60.0;
      const dLat = v * k;
      const dLon = (u * k) / cosLat;

      p.lat += dLat;
      p.lon += dLon;

      if (p.lon > 180.0) p.lon -= 360.0;
      if (p.lon < -180.0) p.lon += 360.0;

      // Update trail coordinates
      for (let t = activeTrail - 1; t > 0; t--) {
        p.trail[t] = p.trail[t - 1];
      }
      p.trail[0] = [p.lat, p.lon];

      const [cr, cg, cb] = getCurrentColor(vel);

      // Write line segments into buffer
      for (let s = 0; s < activeTrail - 1; s++) {
        const [latA, lonA] = p.trail[s];
        const [latB, lonB] = p.trail[s + 1];

        if (Math.abs(lonA - lonB) > 90.0) continue;

        const [x1, y1, z1] = latLonToXYZ(latA, lonA, radius);
        const [x2, y2, z2] = latLonToXYZ(latB, lonB, radius);

        const alphaHead = 1.0 - s / activeTrail;
        const alphaTail = 1.0 - (s + 1) / activeTrail;

        positions[vIndex * 3] = x1;
        positions[vIndex * 3 + 1] = y1;
        positions[vIndex * 3 + 2] = z1;
        colors[vIndex * 3] = cr * alphaHead;
        colors[vIndex * 3 + 1] = cg * alphaHead;
        colors[vIndex * 3 + 2] = cb * alphaHead;
        vIndex++;

        positions[vIndex * 3] = x2;
        positions[vIndex * 3 + 1] = y2;
        positions[vIndex * 3 + 2] = z2;
        colors[vIndex * 3] = cr * alphaTail;
        colors[vIndex * 3 + 1] = cg * alphaTail;
        colors[vIndex * 3 + 2] = cb * alphaTail;
        vIndex++;
      }
    }

    for (let j = vIndex; j < totalVertices; j++) {
      positions[j * 3] = 0;
      positions[j * 3 + 1] = 0;
      positions[j * 3 + 2] = 0;
      colors[j * 3] = 0;
      colors[j * 3 + 1] = 0;
      colors[j * 3 + 2] = 0;
    }

    const posAttr = lineSegmentsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = lineSegmentsRef.current.geometry.attributes.color as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineSegmentsRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        linewidth={2}
      />
    </lineSegments>
  );
}
