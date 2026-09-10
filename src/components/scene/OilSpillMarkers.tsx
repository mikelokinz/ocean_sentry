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
  onHover,
}: {
  spill: OilSpillRecord;
  isSelected: boolean;
  onSelect: (spill: OilSpillRecord) => void;
  onHover: (spill: OilSpillRecord | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const { gl } = useThree();

  const radius = 2.032;
  const position = useMemo(
    () => new THREE.Vector3(...(latLonToXYZ(spill.latitude, spill.longitude, radius) as [number, number, number])),
    [spill.latitude, spill.longitude, radius]
  );

  const normal = useMemo(() => position.clone().normalize(), [position]);
  const orientation = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return q;
  }, [normal]);

  const color = spill.status === 'oil_detected' ? '#ef4444' : '#f59e0b';
  const size = isSelected ? 0.032 : 0.024;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (ringRef.current) {
      const scale = 1 + Math.abs(Math.sin(time * 2.2)) * 1.5;
      ringRef.current.scale.setScalar(scale);
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, 0.75 - (scale - 1) * 0.45);
    }

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.7 + Math.sin(time * 3.5) * 0.3;
      mat.emissiveIntensity = isSelected ? pulse * 1.5 : pulse;
    }
  });

  return (
    <group position={position} quaternion={orientation}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 2.1, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 2.2, size * 2.6, 36]} />
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
          onHover(spill);
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          onHover(null);
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
    </group>
  );
}

export function OilSpillMarkers({
  spills,
  selectedId,
  onSelect,
  visible = true,
}: OilSpillMarkersProps) {
  const [hoveredSpill, setHoveredSpill] = useState<OilSpillRecord | null>(null);

  if (!visible || !spills || spills.length === 0) return null;

  // Strictly filter incidents to only cover the Bay of Bengal
  const bayOfBengalSpills = spills.filter(
    (s) => s.longitude >= 79.5 && s.longitude <= 95.0 && s.latitude >= 8.0 && s.latitude <= 23.0
  );

  return (
    <group name="oil-spill-hazard-layer">
      {bayOfBengalSpills.map((spill) => (
        <SingleOilSpillMarker
          key={spill.id}
          spill={spill}
          isSelected={selectedId === spill.id}
          onSelect={onSelect}
          onHover={setHoveredSpill}
        />
      ))}

      {/* Sleek, tiny screen-space hover tooltip (NO distanceFactor, rendered at 11px font) */}
      {hoveredSpill && (
        <group
          position={
            new THREE.Vector3(
              ...(latLonToXYZ(hoveredSpill.latitude, hoveredSpill.longitude, 2.07) as [number, number, number])
            )
          }
        >
          <Html style={{ pointerEvents: 'none' }} occlude={false} center>
            <div
              style={{
                background: 'rgba(2, 6, 23, 0.94)',
                border: '1px solid rgba(239, 68, 68, 0.7)',
                borderRadius: '4px',
                padding: '3px 8px',
                color: '#f8fafc',
                fontSize: '11px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                transform: 'translateY(-18px)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                pointerEvents: 'none',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{hoveredSpill.name}</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>
                ({(hoveredSpill.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
