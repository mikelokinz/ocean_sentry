import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherVectorPoint } from '../../types/weather';

export type ScalarLayerType = 'temperature' | 'precipitation' | 'clouds' | 'none';

interface TemperatureHeatmapTextureProps {
  visible: boolean;
  layer?: ScalarLayerType;
  gridPoints?: WeatherVectorPoint[];
}

export function TemperatureHeatmapTexture({
  visible,
  layer = 'temperature',
  gridPoints = [],
}: TemperatureHeatmapTextureProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const opacityRef = useRef(0);

  // Generate dynamic 2D canvas texture with equirectangular gradient mapping
  const canvasTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const renderHeatmap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (layer === 'none') {
        return;
      }

      if (layer === 'clouds') {
        // Subtle ambient atmospheric tint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Base subtle oceanic tint
        const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        baseGrad.addColorStop(0, 'rgba(4, 14, 38, 0.35)');
        baseGrad.addColorStop(0.5, 'rgba(8, 28, 65, 0.40)');
        baseGrad.addColorStop(1, 'rgba(3, 10, 28, 0.35)');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const points = gridPoints && gridPoints.length > 0 ? gridPoints : [];

      points.forEach((p) => {
        const x = ((p.longitude + 180.0) / 360.0) * canvas.width;
        const y = ((90.0 - p.latitude) / 180.0) * canvas.height;
        const radius = 105; // Large blending radius for smooth Windy-style interpolation

        const grad = ctx.createRadialGradient(x, y, 4, x, y, radius);

        if (layer === 'temperature') {
          // Scientific Sea Surface & Air Temperature (-10°C to 45°C)
          const temp = p.temperature_c;
          if (temp > 30.0) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.72)'); // Deep coral red
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)'); // Amber
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (temp > 27.0) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.65)'); // Warm amber
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.38)'); // Emerald
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          } else if (temp > 24.0) {
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.58)'); // Temperate emerald
            grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)'); // Cyan
            grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          } else {
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.58)'); // Cool cyan
            grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.35)'); // Indigo
            grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
          }
        } else if (layer === 'precipitation') {
          // Radar Reflectivity & Rain Intensity (mm/h)
          const precip = p.precipitation_mm || 0.0;
          if (precip > 5.0) {
            grad.addColorStop(0, 'rgba(168, 85, 247, 0.85)'); // Severe Purple
            grad.addColorStop(0.4, 'rgba(239, 68, 68, 0.65)'); // Heavy Red
            grad.addColorStop(0.8, 'rgba(245, 158, 11, 0.40)'); // Moderate
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          } else if (precip > 1.5) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.75)'); // Moderate Yellow/Orange
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.45)'); // Light Green
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          } else if (precip > 0.1) {
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.65)'); // Light Green
            grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)'); // Drizzle Cyan
            grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          } else {
            // Dry: No rain radar return (transparent)
            return;
          }
        } else if (layer === 'clouds') {
          // Cloud Cover Density (0% to 100%)
          const cloud = (p.cloud_cover_pct || 50.0) / 100.0;
          const alpha = Math.min(0.78, cloud * 0.75);
          grad.addColorStop(0, `rgba(248, 250, 252, ${alpha})`);
          grad.addColorStop(0.6, `rgba(226, 232, 240, ${alpha * 0.45})`);
          grad.addColorStop(1, 'rgba(203, 213, 225, 0.0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    renderHeatmap();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Attach update function to texture for re-rendering on data/layer changes
    (texture as any)._updateHeatmap = () => {
      renderHeatmap();
      texture.needsUpdate = true;
    };

    return texture;
  }, [layer, gridPoints]);

  // Trigger texture redraw when gridPoints or active layer changes
  useEffect(() => {
    if (canvasTexture && (canvasTexture as any)._updateHeatmap) {
      (canvasTexture as any)._updateHeatmap();
    }
  }, [canvasTexture, layer, gridPoints]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const isLayerActive = visible && layer !== 'none';
    const targetOpacity = isLayerActive ? 0.88 : 0.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 5.0);

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacityRef.current;
    mat.visible = opacityRef.current > 0.01;
  });

  return (
    <mesh ref={meshRef}>
      {/* Overlay sphere just 0.006 units above Earth surface */}
      <sphereGeometry args={[2.006, 64, 64]} />
      <meshBasicMaterial
        map={canvasTexture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={layer === 'clouds' ? THREE.NormalBlending : THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
