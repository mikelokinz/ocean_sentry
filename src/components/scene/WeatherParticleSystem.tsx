import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WindGridPoint } from '../../types/weather';

interface WeatherParticleSystemProps {
  visible: boolean;
  gridPoints?: WindGridPoint[];
  speedMultiplier?: number;
}

const NUM_PARTICLES = 3600;
const TRAIL_LENGTH = 12; // 12 line segments per particle streak for iconic Windy comet tail

interface Particle {
  lat: number;
  lon: number;
  speed: number;
  age: number;
  maxAge: number;
  trail: [number, number][]; // Array of past [lat, lon]
}

export function WeatherParticleSystem({
  visible,
  gridPoints = [],
  speedMultiplier = 1.0,
}: WeatherParticleSystemProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const opacityRef = useRef(0);

  // Smooth Inverse-Distance-Weighted (IDW) 4-point spatial interpolator
  const sampleWind = useMemo(() => {
    return (lat: number, lon: number): [number, number, number, number] => {
      if (gridPoints && gridPoints.length >= 4) {
        // Collect closest 4 points for smooth bilinear/IDW interpolation
        let d1 = Infinity, d2 = Infinity, d3 = Infinity, d4 = Infinity;
        let p1 = gridPoints[0], p2 = gridPoints[0], p3 = gridPoints[0], p4 = gridPoints[0];

        for (let i = 0; i < gridPoints.length; i++) {
          const p = gridPoints[i];
          const dLat = p.latitude - lat;
          const dLon = p.longitude - lon;
          const distSq = dLat * dLat + dLon * dLon;

          if (distSq < d1) {
            d4 = d3; p4 = p3;
            d3 = d2; p3 = p2;
            d2 = d1; p2 = p1;
            d1 = distSq; p1 = p;
          } else if (distSq < d2) {
            d4 = d3; p4 = p3;
            d3 = d2; p3 = p2;
            d2 = distSq; p2 = p;
          } else if (distSq < d3) {
            d4 = d3; p4 = p3;
            d3 = distSq; p3 = p;
          } else if (distSq < d4) {
            d4 = distSq; p4 = p;
          }
        }

        // Compute normalized inverse distance weights
        const eps = 0.001;
        const w1 = 1.0 / (d1 + eps);
        const w2 = 1.0 / (d2 + eps);
        const w3 = 1.0 / (d3 + eps);
        const w4 = 1.0 / (d4 + eps);
        const totalW = w1 + w2 + w3 + w4;

        const u = (p1.u_wind * w1 + p2.u_wind * w2 + p3.u_wind * w3 + p4.u_wind * w4) / totalW;
        const v = (p1.v_wind * w1 + p2.v_wind * w2 + p3.v_wind * w3 + p4.v_wind * w4) / totalW;
        const speed = (p1.wind_speed_kts * w1 + p2.wind_speed_kts * w2 + p3.wind_speed_kts * w3 + p4.wind_speed_kts * w4) / totalW;
        const temp = (p1.temperature_c * w1 + p2.temperature_c * w2 + p3.temperature_c * w3 + p4.temperature_c * w4) / totalW;

        return [u, v, speed, temp];
      }

      // Mathematical synoptic fallback matching user's Windy reference picture
      // Somali jet curving into Arabian Sea, funneling south of Sri Lanka, Bay of Bengal cyclonic curl
      let angleDeg = 245.0;
      let speedKts = 18.0;

      if (lat >= 5.0 && lat <= 18.0 && lon <= 58.0) {
        // Somali Jet off Socotra/Yemen
        angleDeg = 222.0 + (lat - 10.0) * 1.5;
        speedKts = 28.0;
      } else if (lat >= 3.0 && lat <= 9.0 && lon >= 75.0 && lon <= 86.0) {
        // Sri Lanka accelerator
        angleDeg = 258.0;
        speedKts = 25.0;
      } else if (lat >= 8.0 && lon >= 80.0) {
        // Bay of Bengal curvature
        angleDeg = lon < 88.0 ? 225.0 + (lat - 10.0) * 2.0 : 185.0 + (lon - 88.0) * 2.2;
        speedKts = 18.0;
      } else if (lat < -2.0) {
        // SE Trade winds
        angleDeg = 125.0;
        speedKts = 19.0;
      }

      const angleRad = (angleDeg * Math.PI) / 180.0;
      const u = -Math.sin(angleRad) * (speedKts * 0.514444);
      const v = -Math.cos(angleRad) * (speedKts * 0.514444);
      return [u, v, speedKts, 28.5];
    };
  }, [gridPoints]);

  // Initialize particles across the full Indian Ocean / Arabian Sea / Bay of Bengal basin
  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const lat = -14.0 + Math.random() * 42.0; // -14°S to 28°N
      const lon = 40.0 + Math.random() * 64.0;  // 40°E to 104°E
      const [, , speed] = sampleWind(lat, lon);

      const trail: [number, number][] = [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        trail.push([lat, lon]);
      }

      list.push({
        lat,
        lon,
        speed,
        age: Math.floor(Math.random() * 80),
        maxAge: 65 + Math.floor(Math.random() * 45),
        trail,
      });
    }
    return list;
  }, [sampleWind]);

  // Line segment vertex buffers: NUM_PARTICLES * (TRAIL_LENGTH - 1) * 2 vertices
  const totalSegments = NUM_PARTICLES * (TRAIL_LENGTH - 1);
  const totalVertices = totalSegments * 2;
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

    // Smooth opacity cross-fade
    const targetOpacity = visible ? 0.98 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 6.0);
    const mat = lineSegmentsRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;

    if (!mat.visible) return;

    const dt = Math.min(delta, 0.033) * speedMultiplier;
    const radius = 2.035; // Just skimming above Earth surface
    let vIndex = 0;

    // Base luminous white/ice-blue color matching Windy streamline streaks
    const whiteR = 0.96, whiteG = 0.99, whiteB = 1.0;
    const cyanR = 0.45, cyanG = 0.90, cyanB = 0.98;
    const goldR = 0.98, goldG = 0.85, goldB = 0.40;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const p = particles[i];
      p.age += 1;

      // Respawn particle if age exceeded or drifted past bounds
      if (
        p.age > p.maxAge ||
        p.lat < -14.5 || p.lat > 29.0 ||
        p.lon < 39.0 || p.lon > 105.0
      ) {
        p.lat = -14.0 + Math.random() * 42.0;
        p.lon = 40.0 + Math.random() * 64.0;
        p.age = 0;
        p.maxAge = 65 + Math.floor(Math.random() * 45);
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          p.trail[t] = [p.lat, p.lon];
        }
      }

      // Sample continuous vector field at current coordinate
      const [u, v, speed] = sampleWind(p.lat, p.lon);
      p.speed = speed;

      // Advect particle along spherical flow field
      // Scaled so a 20-kt wind streams smoothly across the globe (~2.2 deg/s)
      const latCos = Math.max(0.18, Math.cos((p.lat * Math.PI) / 180.0));
      const speedScale = 0.0038;
      const dLat = (v * speedScale) * dt * 60.0;
      const dLon = ((u * speedScale) / latCos) * dt * 60.0;

      p.lat += dLat;
      p.lon += dLon;

      // Update trail buffer
      p.trail.pop();
      p.trail.unshift([p.lat, p.lon]);

      // Lifecycle fade envelope (smooth bell curve)
      const lifeRatio = p.age / p.maxAge;
      const lifeFade = Math.sin(lifeRatio * Math.PI);

      // Tint: higher speeds (>24 kts, like Somali Jet / Sri Lanka) get subtle golden sheen
      const isHighSpeed = p.speed > 24.0;
      const rHead = isHighSpeed ? goldR : (p.speed > 16.0 ? whiteR : cyanR);
      const gHead = isHighSpeed ? goldG : (p.speed > 16.0 ? whiteG : cyanG);
      const bHead = isHighSpeed ? goldB : (p.speed > 16.0 ? whiteB : cyanB);

      // Write vertices and alpha for each trail segment
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

        // Tapering alpha along trail (head is brightest, tail fades to zero)
        const alpha1 = lifeFade * Math.pow(1.0 - s / (TRAIL_LENGTH - 1), 1.4);
        const alpha2 = lifeFade * Math.pow(1.0 - (s + 1) / (TRAIL_LENGTH - 1), 1.4);

        colors[vIndex * 3] = rHead * alpha1;
        colors[vIndex * 3 + 1] = gHead * alpha1;
        colors[vIndex * 3 + 2] = bHead * alpha1;

        colors[(vIndex + 1) * 3] = rHead * alpha2;
        colors[(vIndex + 1) * 3 + 1] = gHead * alpha2;
        colors[(vIndex + 1) * 3 + 2] = bHead * alpha2;

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
        linewidth={1.8}
      />
    </lineSegments>
  );
}
