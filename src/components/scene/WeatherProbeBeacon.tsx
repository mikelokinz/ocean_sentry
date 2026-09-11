import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WeatherProbeData } from '../../types/weather';

interface WeatherProbeBeaconProps {
  probe: WeatherProbeData | null;
  onClose: () => void;
}

export function WeatherProbeBeacon({ probe, onClose }: WeatherProbeBeaconProps) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const beaconRef = useRef<THREE.Mesh>(null!);

  const radius = 2.034;
  const position = useMemo(() => {
    if (!probe) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(...(latLonToXYZ(probe.latitude, probe.longitude, radius) as [number, number, number]));
  }, [probe, radius]);

  const normal = useMemo(() => position.clone().normalize(), [position]);
  const orientation = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return q;
  }, [normal]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (ringRef.current) {
      const cycle = (time * 1.5) % 1.0;
      const scale = 1.0 + cycle * 2.5;
      ringRef.current.scale.setScalar(scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (1.0 - cycle) * 0.85);
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(time * 5) * 0.15;
    }
  });

  if (!probe) return null;

  return (
    <group position={position} quaternion={orientation}>
      {/* Expanding target radar ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.035, 0.045, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Vertical neon beacon beam */}
      <mesh ref={beaconRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.003, 0.015, 0.2, 16]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Center target dot */}
      <mesh position={[0, 0.01, 0]}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
          roughness={0.2}
        />
      </mesh>

      {/* Screen-Space Windy Probe Card (NO distanceFactor, crisp 1:1 CSS pixels) */}
      <Html position={[0, 0.08, 0]} style={{ pointerEvents: 'auto' }} center>
        <div
          className="sci-panel"
          style={{
            background: 'rgba(2, 8, 24, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.7)',
            borderRadius: '8px',
            padding: '12px 14px',
            width: '230px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75), 0 0 15px rgba(56, 189, 248, 0.3)',
            backdropFilter: 'blur(16px)',
            color: '#e2e8f0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            transform: 'translateY(-60px)',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.05em' }}>
                LIVE WEATHER PROBE
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Coordinates */}
          <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '8px' }}>
            {probe.latitude > 0 ? `${probe.latitude.toFixed(2)}°N` : `${Math.abs(probe.latitude).toFixed(2)}°S`}, {' '}
            {probe.longitude > 0 ? `${probe.longitude.toFixed(2)}°E` : `${Math.abs(probe.longitude).toFixed(2)}°W`}
          </div>

          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Surface Wind</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {probe.wind_speed_kts} <span style={{ fontSize: '9px', color: '#38bdf8' }}>kts</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                {probe.wind_direction_deg}° (Gust: {probe.wind_gusts_kts} kts)
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Wave Height</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {probe.wave_height_m} <span style={{ fontSize: '9px', color: '#38bdf8' }}>m</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                Period: {probe.wave_period_s}s ({probe.sea_state.split(' ')[0]})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Temperature</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                {probe.temperature_c} <span style={{ fontSize: '9px', color: '#94a3b8' }}>°C</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                Rain: {probe.precipitation_mm ?? 0.0} mm
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Ocean Current</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#06b6d4', marginTop: '2px' }}>
                {probe.current_velocity_kts ?? 1.2} <span style={{ fontSize: '9px', color: '#94a3b8' }}>kts</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                Flow: {probe.current_direction_deg ?? 220}° ({probe.pressure_hpa} hPa)
              </div>
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '8px', color: '#64748b', textAlign: 'right' }}>
            Open-Meteo GFS/ECMWF Open Data
          </div>
        </div>
      </Html>
    </group>
  );
}
