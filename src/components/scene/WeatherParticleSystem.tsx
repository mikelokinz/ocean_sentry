import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WindGridPoint } from '../../types/weather';

interface WeatherParticleSystemProps {
  visible: boolean;
  gridPoints?: WindGridPoint[];
  speedMultiplier?: number;
}

const NUM_PARTICLES = 3000;
const TRAIL_LENGTH = 8; // Number of segments per particle streak

interface Particle {
  lat: number;
  lon: number;
  speed: number;
  age: number;
  maxAge: number;
  trail: [number, number][]; // Array of past [lat, lon]
  color: THREE.Color;
}

export function WeatherParticleSystem({
  visible,
  gridPoints = [],
  speedMultiplier = 1.0,
}: WeatherParticleSystemProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const opacityRef = useRef(0);

  // Helper to sample wind vector (u, v) at any (lat, lon)
  const sampleWind = useMemo(() => {
    return (lat: number, lon: number): [number, number, number, number] => {
      // If we have real grid points from backend
      if (gridPoints && gridPoints.length > 0) {
        let closestDist = Infinity;
        let bestU = 3.0;
        let bestV = 2.0;
        let bestSpeed = 15.0;
        let bestTemp = 28.0;

        for (let i = 0; i < gridPoints.length; i++) {
          const p = gridPoints[i];
          const dLat = p.latitude - lat;
          const dLon = p.longitude - lon;
          const distSq = dLat * dLat + dLon * dLon;
          if (distSq < closestDist) {
            closestDist = distSq;
            bestU = p.u_wind;
            bestV = p.v_wind;
            bestSpeed = p.wind_speed_kts;
            bestTemp = p.temperature_c;
          }
        }
        return [bestU, bestV, bestSpeed, bestTemp];
      }

      // Mathematical fallback for Indian Ocean & Bay of Bengal trade winds / monsoon curl
      const angleRad = (245.0 + Math.sin(lat * 0.15) * 20.0 + Math.cos(lon * 0.1) * 15.0) * (Math.PI / 180.0);
      const speedKts = 14.0 + Math.sin(lat * 0.2 + lon * 0.1) * 6.0;
      const u = -Math.sin(angleRad) * (speedKts * 0.514444);
      const v = -Math.cos(angleRad) * (speedKts * 0.514444);
      return [u, v, speedKts, 28.5];
    };
  }, [gridPoints]);

  // Color gradient function based on wind speed (Windy palette)
  const getWindColor = (speedKts: number): THREE.Color => {
    if (speedKts < 12) return new THREE.Color('#38bdf8'); // Calm cyan
    if (speedKts < 20) return new THREE.Color('#10b981'); // Breezy emerald
    if (speedKts < 28) return new THREE.Color('#f59e0b'); // Moderate amber
    if (speedKts < 36) return new THREE.Color('#f97316'); // Strong orange
    return new THREE.Color('#ef4444'); // Gale crimson
  };

  // Initialize particles across the tropical & subtropical oceanic expanse
  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const lat = -25.0 + Math.random() * 55.0; // Covers Indian Ocean, Bay of Bengal, Arabian Sea, South Seas
      const lon = 45.0 + Math.random() * 75.0;
      const [, , speed] = sampleWind(lat, lon);
      const trail: [number, number][] = [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        trail.push([lat, lon]);
      }
      list.push({
        lat,
        lon,
        speed,
        age: Math.random() * 100,
        maxAge: 70 + Math.random() * 60,
        trail,
        color: getWindColor(speed),
      });
    }
    return list;
  }, [sampleWind]);

  // Total vertices for line segments: NUM_PARTICLES * (TRAIL_LENGTH - 1) * 2 vertices per segment
  const totalVertices = NUM_PARTICLES * (TRAIL_LENGTH - 1) * 2;
  const positions = useMemo(() => new Float32Array(totalVertices * 3), [totalVertices]);
  const colors = useMemo(() => new Float32Array(totalVertices * 3), [totalVertices]);

  // Setup geometry attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  useFrame((_, delta) => {
    if (!lineSegmentsRef.current) return;

    // Smooth opacity cross-fade
    const targetOpacity = visible ? 0.95 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 6.0);
    const mat = lineSegmentsRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;

    if (!mat.visible) return;

    const dt = Math.min(delta, 0.05) * speedMultiplier;
    const radius = 2.032; // Just skimming Earth ocean surface
    let vIndex = 0;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const p = particles[i];
      p.age += 1;

      // Respawn particle if lifetime exceeded
      if (p.age > p.maxAge) {
        p.lat = -20.0 + Math.random() * 50.0;
        p.lon = 50.0 + Math.random() * 65.0;
        p.age = 0;
        p.maxAge = 70 + Math.random() * 60;
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          p.trail[t] = [p.lat, p.lon];
        }
      }

      // Sample wind vector at current coordinate
      const [u, v, speed] = sampleWind(p.lat, p.lon);
      p.speed = speed;
      p.color = getWindColor(speed);

      // Advect particle along spherical wind field
      // Latitude velocity: v in m/s -> deg/s
      // Longitude velocity: u in m/s adjusted for latitude convergence
      const latCos = Math.max(0.15, Math.cos(p.lat * (Math.PI / 180.0)));
      const dLat = (v * 0.0008) * dt * 60.0;
      const dLon = ((u * 0.0008) / latCos) * dt * 60.0;

      p.lat += dLat;
      p.lon += dLon;

      // Push new position to trail buffer
      p.trail.pop();
      p.trail.unshift([p.lat, p.lon]);

      // Alpha lifecycle modulation (fade in at birth, fade out at death)
      const lifeRatio = p.age / p.maxAge;
      const lifeFade = Math.sin(lifeRatio * Math.PI);

      // Populate line segments for this particle's trail
      for (let s = 0; s < TRAIL_LENGTH - 1; s++) {
        const [lat1, lon1] = p.trail[s];
        const [lat2, lon2] = p.trail[s + 1];

        const [x1, y1, z1] = latLonToXYZ(lat1, lon1, radius);
        const [x2, y2, z2] = latLonToXYZ(lat2, lon2, radius);

        // Vertex 1
        positions[vIndex * 3] = x1;
        positions[vIndex * 3 + 1] = y1;
        positions[vIndex * 3 + 2] = z1;

        // Vertex 2
        positions[(vIndex + 1) * 3] = x2;
        positions[(vIndex + 1) * 3 + 1] = y2;
        positions[(vIndex + 1) * 3 + 2] = z2;

        // Trail intensity fades towards the tail
        const trailFade = 1.0 - (s / (TRAIL_LENGTH - 1)) * 0.7;
        const finalAlpha = lifeFade * trailFade;

        colors[vIndex * 3] = p.color.r * finalAlpha;
        colors[vIndex * 3 + 1] = p.color.g * finalAlpha;
        colors[vIndex * 3 + 2] = p.color.b * finalAlpha;

        colors[(vIndex + 1) * 3] = p.color.r * finalAlpha * 0.7;
        colors[(vIndex + 1) * 3 + 1] = p.color.g * finalAlpha * 0.7;
        colors[(vIndex + 1) * 3 + 2] = p.color.b * finalAlpha * 0.7;

        vIndex += 2;
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineSegmentsRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        linewidth={1.5}
      />
    </lineSegments>
  );
}
