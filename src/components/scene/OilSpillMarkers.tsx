import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { OilSpillRecord } from '../../types/ocean';

interface OilSpillMarkersProps {
  spills: OilSpillRecord[];
  selectedId: string | null;
  onSelect: (spill: OilSpillRecord) => void;
  visible?: boolean;
}

function SingleOilSpillMarker({
  spill,
  isSelected,
  onSelect,
}: {
  spill: OilSpillRecord;
  isSelected: boolean;
  onSelect: (spill: OilSpillRecord) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef1 = useRef<THREE.Mesh>(null!);
  const ringRef2 = useRef<THREE.Mesh>(null!);
  const beaconRef = useRef<THREE.Mesh>(null!);
  const { gl } = useThree();

  const radius = 2.034;
  const position = useMemo(
    () => new THREE.Vector3(...(latLonToXYZ(spill.latitude, spill.longitude, radius) as [number, number, number])),
    [spill.latitude, spill.longitude, radius]
  );

  // Normal vector pointing away from Earth center
  const normal = useMemo(() => position.clone().normalize(), [position]);
  const orientation = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return q;
  }, [normal]);

  const isCritical = spill.severity === 'critical' || spill.status === 'oil_detected';
  const alertColor = isCritical ? '#ef4444' : '#f59e0b';
  const ballSize = isSelected ? 0.045 : 0.035;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Pulsing core sphere emission
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(time * 3.5) * 0.4 + 1.2;
      mat.emissiveIntensity = isSelected ? pulse * 1.5 : pulse;
    }

    // Outer shockwave ring 1
    if (ringRef1.current) {
      const cycle1 = (time * 0.8) % 1.0; // 0 to 1
      const scale1 = 1.0 + cycle1 * 2.2;
      ringRef1.current.scale.setScalar(scale1);
      const ringMat1 = ringRef1.current.material as THREE.MeshBasicMaterial;
      ringMat1.opacity = Math.max(0, (1.0 - cycle1) * 0.8);
    }

    // Outer shockwave ring 2 (phase-shifted)
    if (ringRef2.current) {
      const cycle2 = (time * 0.8 + 0.5) % 1.0;
      const scale2 = 1.0 + cycle2 * 2.2;
      ringRef2.current.scale.setScalar(scale2);
      const ringMat2 = ringRef2.current.material as THREE.MeshBasicMaterial;
      ringMat2.opacity = Math.max(0, (1.0 - cycle2) * 0.6);
    }

    // Light beacon pulse
    if (beaconRef.current) {
      const beaconMat = beaconRef.current.material as THREE.MeshBasicMaterial;
      beaconMat.opacity = 0.25 + Math.sin(time * 4) * 0.15;
    }
  });

  return (
    <group position={position} quaternion={orientation}>
      {/* Dynamic Expanding Tangent Shockwave Ring 1 */}
      <mesh ref={ringRef1} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ballSize * 1.4, ballSize * 1.8, 32]} />
        <meshBasicMaterial
          color={alertColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Dynamic Expanding Tangent Shockwave Ring 2 */}
      <mesh ref={ringRef2} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ballSize * 1.4, ballSize * 1.8, 32]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Vertical Warning Light Pillar / Beacon */}
      <mesh ref={beaconRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.003, 0.015, 0.2, 16]} />
        <meshBasicMaterial
          color={alertColor}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* The 3D Hazard Ball on the Globe (Petroleum/Hydrocarbon glossy core) */}
      <mesh
        ref={meshRef}
        position={[0, 0.01, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(spill);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[ballSize, 32, 32]} />
        <meshStandardMaterial
          color="#18181b"
          emissive={alertColor}
          emissiveIntensity={1.2}
          roughness={0.12}
          metalness={0.88}
        />
      </mesh>

      {/* Outer Selected Glow Shell */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ballSize * 2.2, ballSize * 2.6, 36]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Floating Tactical Label & Alert Badge */}
      <Html
        position={[0, ballSize * 2.5, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(spill);
          }}
          className="cursor-pointer transition-all duration-300 hover:scale-105"
          style={{
            background: 'rgba(9, 9, 11, 0.85)',
            border: `1px solid ${alertColor}80`,
            backdropFilter: 'blur(12px)',
            borderRadius: '6px',
            padding: '4px 8px',
            boxShadow: `0 0 15px ${alertColor}40`,
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            color: '#f8fafc',
            fontSize: '10px',
            transform: 'translateY(-10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: alertColor,
                boxShadow: `0 0 8px ${alertColor}`,
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ fontWeight: 700, color: alertColor, letterSpacing: '0.05em' }}>
              OIL SPILL HAZARD
            </span>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>
              ({(spill.confidence * 100).toFixed(1)}%)
            </span>
          </div>
          <div style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '2px' }}>
            {spill.name} · {spill.area_km2} km²
          </div>
        </div>
      </Html>
    </group>
  );
}

export function OilSpillMarkers({
  spills,
  selectedId,
  onSelect,
  visible = true,
}: OilSpillMarkersProps) {
  if (!visible || !spills || spills.length === 0) return null;

  return (
    <group name="oil-spill-hazard-layer">
      {spills.map((spill) => (
        <SingleOilSpillMarker
          key={spill.id}
          spill={spill}
          isSelected={selectedId === spill.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
