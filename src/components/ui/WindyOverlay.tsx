import React from 'react';
import type { WeatherMetric } from '../../types/weather';

interface WindyOverlayProps {
  activeMetric: WeatherMetric;
  onMetricChange: (metric: WeatherMetric) => void;
  onExitWeatherMode: () => void;
  probeActive: boolean;
}

const METRICS: { id: WeatherMetric; label: string; icon: string; color: string }[] = [
  { id: 'wind', label: 'WIND SPEED', icon: '💨', color: '#38bdf8' },
  { id: 'temperature', label: 'TEMPERATURE', icon: '🌡️', color: '#f59e0b' },
  { id: 'waves', label: 'WAVE HEIGHT', icon: '🌊', color: '#10b981' },
  { id: 'pressure', label: 'AIR PRESSURE', icon: '⏱️', color: '#a855f7' },
];

export function WindyOverlay({
  activeMetric,
  onMetricChange,
  onExitWeatherMode,
  probeActive,
}: WindyOverlayProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {/* Top Floating Metric Bar */}
      <div
        style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(6, 16, 36, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '30px',
          padding: '4px 8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 15px rgba(56, 189, 248, 0.15)',
          pointerEvents: 'auto',
        }}
      >
        {METRICS.map((m) => {
          const isActive = activeMetric === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onMetricChange(m.id)}
              style={{
                background: isActive ? `${m.color}25` : 'transparent',
                border: isActive ? `1px solid ${m.color}80` : '1px solid transparent',
                borderRadius: '20px',
                padding: '6px 14px',
                color: isActive ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

        {/* Exit back to Ocean Sentry Mode */}
        <button
          onClick={onExitWeatherMode}
          title="Return to Ocean Sentry in-situ twin"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '6px 12px',
            color: '#e2e8f0',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>✕</span>
          <span>EXIT RADAR</span>
        </button>
      </div>

      {/* Top Left Status Badge */}
      <div
        style={{
          position: 'absolute',
          top: '72px',
          left: '24px',
          background: 'rgba(6, 16, 36, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '8px',
          padding: '8px 14px',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.05em' }}>
            WINDY-STYLE WEATHER RADAR
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
          Real-time Open-Meteo GFS/ECMWF vectors · 3,000+ GPU particles
        </div>
      </div>

      {/* Bottom Center Click Hint */}
      {!probeActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '78px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(2, 6, 23, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '6px 16px',
            color: '#94a3b8',
            fontSize: '11px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          💡 Click anywhere on the globe to drop a live weather probe
        </div>
      )}

      {/* Bottom Windy-Style Color Legend Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '560px',
          background: 'rgba(6, 16, 36, 0.82)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          padding: '8px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.05em' }}>
            {activeMetric === 'wind' && 'SURFACE WIND SPEED (10m)'}
            {activeMetric === 'temperature' && 'SEA SURFACE TEMPERATURE'}
            {activeMetric === 'waves' && 'SIGNIFICANT WAVE HEIGHT'}
            {activeMetric === 'pressure' && 'SURFACE BAROMETRIC PRESSURE'}
          </span>
          <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
            {activeMetric === 'wind' && 'knots (kts)'}
            {activeMetric === 'temperature' && 'Celsius (°C)'}
            {activeMetric === 'waves' && 'meters (m)'}
            {activeMetric === 'pressure' && 'hectopascals (hPa)'}
          </span>
        </div>

        {/* Gradient Bar calibrated to Windy.com color map from reference image */}
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            background:
              activeMetric === 'wind'
                ? 'linear-gradient(90deg, #1e1b4b 0%, #0284c7 15%, #06b6d4 30%, #22c55e 50%, #eab308 70%, #f97316 85%, #ef4444 100%)'
                : activeMetric === 'temperature'
                ? 'linear-gradient(90deg, #1e1b4b 0%, #0e7490 25%, #38bdf8 50%, #22c55e 65%, #f59e0b 80%, #ef4444 100%)'
                : activeMetric === 'waves'
                ? 'linear-gradient(90deg, #0284c7 0%, #06b6d4 25%, #22c55e 50%, #f59e0b 75%, #ef4444 100%)'
                : 'linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #38bdf8 70%, #6366f1 100%)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
          }}
        />

        {/* Legend numeric markers */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#94a3b8',
            marginTop: '3px',
          }}
        >
          {activeMetric === 'wind' && (
            <>
              <span>0</span>
              <span>8</span>
              <span>12</span>
              <span>16</span>
              <span>20</span>
              <span>25</span>
              <span>30</span>
              <span>40+ kts</span>
            </>
          )}
          {activeMetric === 'temperature' && (
            <>
              <span>16°</span>
              <span>20°</span>
              <span>24°</span>
              <span>28°</span>
              <span>30°</span>
              <span>32°</span>
              <span>34°+</span>
            </>
          )}
          {activeMetric === 'waves' && (
            <>
              <span>0.5m</span>
              <span>1.0m</span>
              <span>1.5m</span>
              <span>2.0m</span>
              <span>2.5m</span>
              <span>3.0m</span>
              <span>4.0m+</span>
            </>
          )}
          {activeMetric === 'pressure' && (
            <>
              <span>995</span>
              <span>1000</span>
              <span>1005</span>
              <span>1010</span>
              <span>1015</span>
              <span>1020+</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
