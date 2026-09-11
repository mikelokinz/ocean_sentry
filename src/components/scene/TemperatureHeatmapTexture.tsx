import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherMetric, WindGridPoint } from '../../types/weather';

interface TemperatureHeatmapTextureProps {
  visible: boolean;
  metric?: WeatherMetric;
  gridPoints?: WindGridPoint[];
}

export function TemperatureHeatmapTexture({
  visible,
  metric = 'wind',
  gridPoints = [],
}: TemperatureHeatmapTextureProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const opacityRef = useRef(0);

  // Generate canvas texture with equirectangular gradient mapping
  const canvasTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const renderHeatmap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Base ocean tint
      const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      baseGrad.addColorStop(0, 'rgba(6, 20, 50, 0.4)');
      baseGrad.addColorStop(0.5, 'rgba(10, 35, 75, 0.45)');
      baseGrad.addColorStop(1, 'rgba(4, 15, 38, 0.4)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // If we have grid points, render smooth radial thermal splats
      const points = gridPoints && gridPoints.length > 0 ? gridPoints : [
        // Default Bay of Bengal & Indian Ocean sample points
        { latitude: 16.5, longitude: 85.0, temperature_c: 29.5, wind_speed_kts: 18.0, wave_height_m: 1.8, pressure_hpa: 1006.0 },
        { latitude: 12.0, longitude: 82.0, temperature_c: 29.0, wind_speed_kts: 15.0, wave_height_m: 1.5, pressure_hpa: 1007.5 },
        { latitude: 19.5, longitude: 88.0, temperature_c: 28.5, wind_speed_kts: 22.0, wave_height_m: 2.1, pressure_hpa: 1005.0 },
        { latitude: 5.0, longitude: 78.0, temperature_c: 29.8, wind_speed_kts: 12.0, wave_height_m: 1.2, pressure_hpa: 1009.0 },
        { latitude: 15.0, longitude: 68.0, temperature_c: 28.2, wind_speed_kts: 19.0, wave_height_m: 2.0, pressure_hpa: 1008.0 },
        { latitude: -8.0, longitude: 85.0, temperature_c: 26.5, wind_speed_kts: 21.0, wave_height_m: 2.4, pressure_hpa: 1013.0 },
        { latitude: 0.0, longitude: 80.0, temperature_c: 29.2, wind_speed_kts: 11.0, wave_height_m: 1.1, pressure_hpa: 1010.0 },
      ];

      points.forEach((p) => {
        // Convert lat (-90 to 90) and lon (-180 to 180) to canvas pixel coordinates
        const x = ((p.longitude + 180.0) / 360.0) * canvas.width;
        const y = ((90.0 - p.latitude) / 180.0) * canvas.height;
        const radius = 90; // Large blending radius for smooth Windy-style interpolation

        const grad = ctx.createRadialGradient(x, y, 5, x, y, radius);

        if (metric === 'temperature') {
          // Temperature color palette (20°C deep blue -> 26°C cyan -> 29°C golden -> 32°C coral)
          const temp = p.temperature_c;
          if (temp > 29.0) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.65)'); // Crimson warm
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)'); // Amber
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (temp > 27.0) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.60)'); // Amber
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.35)'); // Emerald
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)'); // Cyan
            grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.35)'); // Indigo
            grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
          }
        } else if (metric === 'waves') {
          // Wave height palette (Calm teal -> rough orange -> very rough violet)
          const waves = p.wave_height_m;
          if (waves > 2.2) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
            grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.40)');
            grad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
          } else if (waves > 1.5) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.55)');
            grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
            grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.50)');
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.30)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          }
        } else {
          // Wind intensity palette (Windy signature style)
          const speed = p.wind_speed_kts;
          if (speed > 25) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.60)');
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.35)');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (speed > 16) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.55)');
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.35)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.50)');
            grad.addColorStop(0.5, 'rgba(14, 116, 144, 0.30)');
            grad.addColorStop(1, 'rgba(14, 116, 144, 0.0)');
          }
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    renderHeatmap();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [metric, gridPoints]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetOpacity = visible ? 0.65 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 5.0);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;
  });

  return (
    <mesh ref={meshRef}>
      {/* Overlay sphere just above Earth base radius (2.006) */}
      <sphereGeometry args={[2.006, 64, 64]} />
      <meshBasicMaterial
        map={canvasTexture}
        transparent
        opacity={0}
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
