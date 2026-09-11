import React, { useRef, useMemo } from 'react';
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

  // Generate high-resolution 2048x1024 canvas texture with continuous fluid color fields
  const canvasTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const renderHeatmap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Base deep ocean tint (Windy dark theme)
      const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      baseGrad.addColorStop(0, 'rgba(4, 12, 32, 0.45)');
      baseGrad.addColorStop(0.35, 'rgba(6, 18, 48, 0.55)');
      baseGrad.addColorStop(0.7, 'rgba(8, 24, 60, 0.50)');
      baseGrad.addColorStop(1, 'rgba(3, 10, 26, 0.40)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Points to render: use real backend grid or high-density fallback
      const points = gridPoints && gridPoints.length > 0 ? gridPoints : [];

      if (points.length === 0) return;

      // Large blending radius for smooth continuous interpolation (no patchy circles)
      const splatRadius = 175;

      // 2. Render dense overlapping radial thermal/velocity splats
      points.forEach((p) => {
        // Equirectangular mapping: lat (-90 to 90), lon (-180 to 180)
        const x = ((p.longitude + 180.0) / 360.0) * canvas.width;
        const y = ((90.0 - p.latitude) / 180.0) * canvas.height;

        const grad = ctx.createRadialGradient(x, y, 6, x, y, splatRadius);

        if (metric === 'temperature') {
          // Temperature color scale (-20°C deep blue -> 25°C cyan -> 29°C green -> 33°C amber/orange)
          const temp = p.temperature_c;
          if (temp >= 31.0) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.72)');   // Crimson
            grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.55)'); // Amber
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (temp >= 28.5) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.68)'); // Golden amber
            grad.addColorStop(0.45, 'rgba(34, 197, 94, 0.48)'); // Emerald
            grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
          } else if (temp >= 26.0) {
            grad.addColorStop(0, 'rgba(34, 197, 94, 0.65)');  // Green
            grad.addColorStop(0.45, 'rgba(6, 182, 212, 0.45)'); // Cyan
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(6, 182, 212, 0.60)');  // Cyan
            grad.addColorStop(0.45, 'rgba(37, 99, 235, 0.40)'); // Deep blue
            grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
          }
        } else if (metric === 'waves') {
          // Wave height scale (0m blue -> 1.5m green -> 2.5m amber -> 4m+ crimson)
          const waves = p.wave_height_m;
          if (waves >= 2.4) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.75)');
            grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.50)');
            grad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
          } else if (waves >= 1.6) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.65)');
            grad.addColorStop(0.5, 'rgba(34, 197, 94, 0.45)');
            grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(6, 182, 212, 0.58)');
            grad.addColorStop(0.5, 'rgba(37, 99, 235, 0.38)');
            grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
          }
        } else if (metric === 'pressure') {
          // Atmospheric pressure (Low pressure red/amber -> High pressure blue/cyan)
          const pres = p.pressure_hpa;
          if (pres <= 1005.0) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.70)');
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (pres <= 1009.0) {
            grad.addColorStop(0, 'rgba(168, 85, 247, 0.65)');
            grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.40)');
            grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(59, 130, 246, 0.60)');
            grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.35)');
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          }
        } else {
          // Wind speed — Exactly matching the user's reference image from Windy!
          // Somali jet & Sri Lanka accelerator: Golden-amber (24-32 kts)
          // Arabian Sea & Central Bay of Bengal: Lush vibrant green (16-24 kts)
          // Coastal & Equatorial: Soft cyan/teal (10-16 kts)
          // Calm continental margins: Deep navy/blue (< 10 kts)
          const speed = p.wind_speed_kts;
          if (speed >= 25.0) {
            // High wind jet: Amber / Golden yellow core
            grad.addColorStop(0, 'rgba(234, 179, 8, 0.78)');   // Golden yellow
            grad.addColorStop(0.4, 'rgba(34, 197, 94, 0.55)'); // Lime green
            grad.addColorStop(0.8, 'rgba(14, 165, 233, 0.25)'); // Cyan
            grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
          } else if (speed >= 17.0) {
            // Main monsoon circulation: Vibrant Emerald Green
            grad.addColorStop(0, 'rgba(34, 197, 94, 0.74)');   // Vibrant green
            grad.addColorStop(0.45, 'rgba(22, 163, 74, 0.55)'); // Emerald
            grad.addColorStop(0.8, 'rgba(6, 182, 212, 0.28)'); // Cyan
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          } else if (speed >= 12.0) {
            // Moderate flow: Teal / Cyan
            grad.addColorStop(0, 'rgba(6, 182, 212, 0.68)');   // Cyan
            grad.addColorStop(0.45, 'rgba(14, 116, 144, 0.48)'); // Deep teal
            grad.addColorStop(0.8, 'rgba(37, 99, 235, 0.22)'); // Blue
            grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
          } else {
            // Calm waters / Northern head: Deep indigo
            grad.addColorStop(0, 'rgba(37, 99, 235, 0.58)');   // Blue
            grad.addColorStop(0.5, 'rgba(30, 27, 75, 0.40)');  // Deep indigo
            grad.addColorStop(1, 'rgba(30, 27, 75, 0.0)');
          }
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, splatRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    renderHeatmap();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [metric, gridPoints]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetOpacity = visible ? 0.78 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 5.0);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;
  });

  return (
    <mesh ref={meshRef}>
      {/* Overlay sphere just above Earth base radius (2.008) */}
      <sphereGeometry args={[2.008, 64, 64]} />
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
