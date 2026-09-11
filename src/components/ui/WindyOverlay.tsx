import React, { useState } from 'react';
import type { WeatherLayerType, ValidationDirectionMode, WeatherFlowControls, HourlyWeatherTimestep } from '../../types/weather';

interface WindyOverlayProps {
  activeLayers: Set<WeatherLayerType>;
  onToggleLayer: (layer: WeatherLayerType) => void;
  flowControls: WeatherFlowControls;
  onUpdateFlowControls: (updates: Partial<WeatherFlowControls>) => void;
  timesteps: HourlyWeatherTimestep[];
  activeTimestepIndex: number;
  onSelectTimestep: (index: number) => void;
  isTimelinePlaying: boolean;
  onToggleTimelinePlay: () => void;
  onExitWeatherMode: () => void;
  probeActive: boolean;
  dataSourceInfo?: {
    source: string;
    model: string;
    validTime: string;
    lastSync: string;
  };
}

export function WindyOverlay({
  activeLayers,
  onToggleLayer,
  flowControls,
  onUpdateFlowControls,
  timesteps,
  activeTimestepIndex,
  onSelectTimestep,
  isTimelinePlaying,
  onToggleTimelinePlay,
  onExitWeatherMode,
  probeActive,
  dataSourceInfo = {
    source: 'Open-Meteo GFS & ECMWF Marine',
    model: 'ECMWF IFS / NOAA GFS Seamless',
    validTime: '2026-09-11 13:00 UTC',
    lastSync: 'Live',
  },
}: WindyOverlayProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const currentStep = timesteps && timesteps[activeTimestepIndex] ? timesteps[activeTimestepIndex] : null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {/* ═══ TOP FLOATING HEADER ═══ */}
      <div
        style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(6, 16, 36, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '30px',
          padding: '6px 14px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55), 0 0 15px rgba(56, 189, 248, 0.2)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 10px #38bdf8',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.08em' }}>
            WEATHER RADAR & FLOW FIELD
          </span>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.2)' }} />

        {/* Quick layer pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(['wind', 'current', 'temperature', 'precipitation', 'clouds'] as WeatherLayerType[]).map((layerKey) => {
            const isActive = activeLayers.has(layerKey);
            const labelMap: Record<WeatherLayerType, { name: string; icon: string; color: string }> = {
              wind: { name: 'WIND', icon: '💨', color: '#38bdf8' },
              current: { name: 'CURRENT', icon: '🌊', color: '#06b6d4' },
              temperature: { name: 'TEMP', icon: '🌡️', color: '#f59e0b' },
              precipitation: { name: 'RAIN', icon: '🌧️', color: '#a855f7' },
              clouds: { name: 'CLOUDS', icon: '☁️', color: '#cbd5e1' },
            };
            const meta = labelMap[layerKey];
            return (
              <button
                key={layerKey}
                onClick={() => onToggleLayer(layerKey)}
                style={{
                  background: isActive ? `${meta.color}25` : 'transparent',
                  border: isActive ? `1px solid ${meta.color}85` : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.2)' }} />

        {/* Exit back to Ocean Sentry in-situ twin */}
        <button
          onClick={onExitWeatherMode}
          title="Return to Ocean Sentry platform"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '5px 12px',
            color: '#fca5a5',
            fontSize: '10.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span>✕</span>
          <span>EXIT RADAR</span>
        </button>
      </div>

      {/* ═══ SCIENTIFIC WEATHER RADAR CONTROL DOCK (LEFT) ═══ */}
      <div
        className="sci-panel"
        style={{
          position: 'absolute',
          left: '18px',
          top: '72px',
          width: panelCollapsed ? '48px' : '260px',
          maxHeight: 'calc(100% - 160px)',
          overflowY: 'auto',
          background: 'rgba(4, 12, 28, 0.88)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: panelCollapsed ? '12px 8px' : '14px 16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.15)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Dock Header & Collapse Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!panelCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px' }}>🛰️</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em' }}>
                RADAR CONTROL
              </span>
            </div>
          )}
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '11px',
              padding: '2px 6px',
              cursor: 'pointer',
              marginLeft: panelCollapsed ? 'auto' : '0',
            }}
          >
            {panelCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {!panelCollapsed && (
          <>
            {/* ── 1. LAYERS MULTI-SELECT ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Layers (Active Field)
              </div>
              {[
                { id: 'wind', label: 'Wind (Atmospheric)', icon: '💨', color: '#38bdf8' },
                { id: 'current', label: 'Ocean Current (Marine)', icon: '🌊', color: '#06b6d4' },
                { id: 'temperature', label: 'Temperature (SST/Air)', icon: '🌡️', color: '#f59e0b' },
                { id: 'precipitation', label: 'Precipitation (Radar)', icon: '🌧️', color: '#a855f7' },
                { id: 'clouds', label: 'Cloud Cover (Satellite)', icon: '☁️', color: '#cbd5e1' },
              ].map((item) => {
                const checked = activeLayers.has(item.id as WeatherLayerType);
                return (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                      color: checked ? '#f1f5f9' : '#94a3b8',
                      cursor: 'pointer',
                      background: checked ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      border: checked ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleLayer(item.id as WeatherLayerType)}
                      style={{ accentColor: item.color, cursor: 'pointer' }}
                    />
                    <span>{item.icon}</span>
                    <span style={{ fontWeight: checked ? 600 : 400 }}>{item.label}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

            {/* ── 2. FLOW CONTROLS ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Flow Physics Controls
                </span>
                <button
                  onClick={() => onUpdateFlowControls({ animationActive: !flowControls.animationActive })}
                  style={{
                    background: flowControls.animationActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    border: flowControls.animationActive ? '1px solid #10b981' : '1px solid #ef4444',
                    borderRadius: '4px',
                    color: flowControls.animationActive ? '#34d399' : '#f87171',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {flowControls.animationActive ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>

              {/* Particle Density */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                  <span>Density</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{flowControls.particleDensity}</span>
                </div>
                <input
                  type="range"
                  min="800"
                  max="4000"
                  step="200"
                  value={flowControls.particleDensity}
                  onChange={(e) => onUpdateFlowControls({ particleDensity: parseInt(e.target.value) })}
                  style={{ width: '100%', height: '4px', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              {/* Flow Speed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                  <span>Flow Speed</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{flowControls.flowSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={flowControls.flowSpeed}
                  onChange={(e) => onUpdateFlowControls({ flowSpeed: parseFloat(e.target.value) })}
                  style={{ width: '100%', height: '4px', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              {/* Trail Length */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                  <span>Streak Trails</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{flowControls.trailLength} pts</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="14"
                  step="1"
                  value={flowControls.trailLength}
                  onChange={(e) => onUpdateFlowControls({ trailLength: parseInt(e.target.value) })}
                  style={{ width: '100%', height: '4px', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

            {/* ── 3. COORDINATE VALIDATION TEST MODE ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Coordinate Validation
              </div>
              <select
                value={flowControls.validationMode}
                onChange={(e) => onUpdateFlowControls({ validationMode: e.target.value as ValidationDirectionMode })}
                style={{
                  background: 'rgba(6, 18, 42, 0.95)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '10px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="live">● LIVE Open-Meteo Vectors</option>
                <option value="0-north">↑ TEST: 0° NORTH (Verify Northward)</option>
                <option value="90-east">→ TEST: 90° EAST (Verify Eastward)</option>
                <option value="180-south">↓ TEST: 180° SOUTH (Verify Southward)</option>
                <option value="270-west">← TEST: 270° WEST (Verify Westward)</option>
                <option value="45-ne">↗ TEST: 45° NORTHEAST</option>
                <option value="225-sw">↙ TEST: 225° SOUTHWEST</option>
              </select>
              {flowControls.validationMode !== 'live' && (
                <div style={{ fontSize: '8.5px', color: '#f59e0b', fontStyle: 'italic' }}>
                  Field locked to {flowControls.validationMode.replace('-', ' ').toUpperCase()}. Verify particles move in this exact heading.
                </div>
              )}
            </div>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

            {/* ── 4. DATA TELEMETRY ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', color: '#64748b' }}>
              <div><strong style={{ color: '#94a3b8' }}>Source:</strong> {dataSourceInfo.source}</div>
              <div><strong style={{ color: '#94a3b8' }}>Model:</strong> {dataSourceInfo.model}</div>
              <div><strong style={{ color: '#94a3b8' }}>Valid:</strong> {currentStep?.time || dataSourceInfo.validTime}</div>
              <div><strong style={{ color: '#94a3b8' }}>Status:</strong> {dataSourceInfo.lastSync} (CC-BY 4.0 Open Data)</div>
            </div>
          </>
        )}
      </div>

      {/* ═══ HOURLY FORECAST TIMELINE (BOTTOM CENTER) ═══ */}
      {timesteps && timesteps.length > 0 && (
        <div
          className="sci-panel"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(6, 16, 36, 0.88)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '30px',
            padding: '6px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'auto',
          }}
        >
          {/* Play/Pause Temporal Scrubbing */}
          <button
            onClick={onToggleTimelinePlay}
            style={{
              background: isTimelinePlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: isTimelinePlaying ? '1px solid #ef4444' : '1px solid #10b981',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              color: isTimelinePlaying ? '#f87171' : '#34d399',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isTimelinePlaying ? '❚❚' : '▶'}
          </button>

          {/* Timestep Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {timesteps.map((step, idx) => {
              const isSelected = idx === activeTimestepIndex;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectTimestep(idx)}
                  style={{
                    background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    fontSize: '10px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {step.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.2)' }} />

          {/* Current Timestamp */}
          <div style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
            {currentStep?.time ? new Date(currentStep.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NOW'} UTC
          </div>
        </div>
      )}

      {/* ═══ CLICK PROBE HINT ═══ */}
      {!probeActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '20px',
            padding: '5px 14px',
            color: '#cbd5e1',
            fontSize: '10px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          💡 Click anywhere on the globe to drop a live vector probe
        </div>
      )}

      {/* ═══ SCIENTIFIC COLOR GRADIENT LEGEND (BOTTOM RIGHT) ═══ */}
      <div
        className="sci-panel"
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '18px',
          background: 'rgba(4, 12, 28, 0.88)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          padding: '8px 12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          width: '210px',
        }}
      >
        {activeLayers.has('wind') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>WIND SPEED (kts)</span>
              <span>5 — 40+ kts</span>
            </div>
            <div
              style={{
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #38bdf8, #10b981, #f59e0b, #f97316, #ef4444)',
                marginTop: '2px',
              }}
            />
          </div>
        )}

        {activeLayers.has('current') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#06b6d4' }}>OCEAN CURRENT (kts)</span>
              <span>0.2 — 3.0+ kts</span>
            </div>
            <div
              style={{
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #0284c7, #06b6d4, #38bdf8, #6366f1)',
                marginTop: '2px',
              }}
            />
          </div>
        )}

        {activeLayers.has('temperature') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>TEMPERATURE (°C)</span>
              <span>20° — 33°C</span>
            </div>
            <div
              style={{
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #38bdf8, #10b981, #f59e0b, #ef4444)',
                marginTop: '2px',
              }}
            />
          </div>
        )}

        {activeLayers.has('precipitation') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#a855f7' }}>PRECIPITATION (mm/h)</span>
              <span>0 — 15+ mm</span>
            </div>
            <div
              style={{
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #38bdf8, #10b981, #f59e0b, #ef4444, #a855f7)',
                marginTop: '2px',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
