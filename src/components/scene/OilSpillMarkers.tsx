import React, { useRef, useMemo, useState } from 'react';
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
  const ringRef = useRef<THREE.Mesh>(null!);
  const [isHovered, setIsHovered] = useState(false);
  const { gl } = useThree();

  // Position precisely on Earth surface
  const radius = 2.032;
  const position = useMemo(
    () => new THREE.Vector3(...(latLonToXYZ(spill.latitude, spill.longitude, radius) as [number, number, number])),
    [spill.latitude, spill.longitude, radius]
  );

  // Normal orientation outward from Earth surface
  const normal = useMemo(() => position.clone().normalize(), [position]);
  const orientation = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return q;
  }, [normal]);

  const color = spill.status === 'oil_detected' ? '#ef4444' : '#f59e0b';
  const size = isSelected ? 0.034 : isHovered ? 0.028 : 0.024;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Pulsing shockwave ring
    if (ringRef.current) {
      const scale = 1 + Math.abs(Math.sin(time * 2.2)) * 1.6;
      ringRef.current.scale.setScalar(scale);
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, 0.75 - (scale - 1) * 0.45);
    }

    // Glowing pulsation on the anomaly sphere
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.7 + Math.sin(time * 3.5) * 0.3;
      mat.emissiveIntensity = isSelected ? pulse * 1.5 : isHovered ? 1.1 : pulse;
    }
  });

  return (
    <group position={position} quaternion={orientation}>
      {/* Outer pulsing ring tangent to globe surface */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 2.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Selected cyan focus halo */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 2.4, size * 2.8, 36]} />
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

      {/* The Anomaly Ball on the Globe (as it usually is) */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(spill);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setIsHovered(true);
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          setIsHovered(false);
          gl.domElement.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.15}
          metalness={0.25}
        />
      </mesh>

      {/* Ultra-compact tooltip visible ONLY on hover */}
      {isHovered && !isSelected && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', transform: 'translateY(-28px)' }}>
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.94)',
              border: `1px solid ${color}90`,
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#f8fafc',
              fontSize: '10px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 14px rgba(0,0,0,0.6), 0 0 10px ${color}40`,
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontWeight: 600 }}>{spill.name}</span>
            <span style={{ color: '#94a3b8' }}>· Click to inspect</span>
          </div>
        </Html>
      )}
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

  // Strictly filter incidents to only cover the Bay of Bengal (lat ~10 to 22, lon ~80 to 94)
  const bayOfBengalSpills = useMemo(() => {
    return spills.filter(
      (s) => s.longitude >= 79.5 && s.longitude <= 95.0 && s.latitude >= 8.0 && s.latitude <= 23.0
    );
  }, [spills]);

  return (
    <group name="oil-spill-hazard-layer">
      {bayOfBengalSpills.map((spill) => (
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
