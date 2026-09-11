import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { latLonToXYZ } from '../../utils/oceanCalc';
import type { WeatherCityPoint } from '../../types/weather';

interface WeatherCityMarkersProps {
  visible: boolean;
  cities?: WeatherCityPoint[];
  onCityClick?: (city: WeatherCityPoint) => void;
}

export function WeatherCityMarkers({ visible, cities = [], onCityClick }: WeatherCityMarkersProps) {
  const radius = 2.035;

  if (!visible || !cities || cities.length === 0) return null;

  return (
    <group>
      {cities.map((city) => {
        const pos = latLonToXYZ(city.latitude, city.longitude, radius);
        const position = new THREE.Vector3(pos[0], pos[1], pos[2]);

        return (
          <group key={city.name} position={position}>
            {/* Tiny anchor dot */}
            <mesh>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
            </mesh>

            {/* Crisp 1:1 CSS Pixel City & Temperature Label matching Windy reference image */}
            <Html
              position={[0, 0.015, 0]}
              center
              distanceFactor={undefined}
              style={{ pointerEvents: 'auto', userSelect: 'none' }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCityClick?.(city);
                }}
                title={`${city.name}, ${city.country} · ${city.temperature_c}°C`}
                style={{
                  background: 'rgba(2, 6, 23, 0.45)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '1px 5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(4px)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(6, 18, 48, 0.85)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(2, 6, 23, 0.45)';
                  e.currentTarget.style.transform = 'scale(1.0)';
                }}
              >
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: '#f8fafc',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.8)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {city.name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.95)',
                  }}
                >
                  {Math.round(city.temperature_c)}°
                </span>
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
