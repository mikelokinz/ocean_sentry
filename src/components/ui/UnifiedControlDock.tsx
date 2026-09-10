import React, { useState } from 'react';
import type { OceanLayer, OceanParameter, DepthLevel } from '../../types/ocean';
import { PARAMETER_CONFIG, DEPTH_LABELS } from '../../utils/oceanCalc';
import { WIND_SYSTEMS_CONFIG, type WindSystemType } from './WindControlPanel';

interface UnifiedControlDockProps {
  layer: OceanLayer;
  onLayerChange: (layer: OceanLayer) => void;
  parameter: OceanParameter;
  onParameterChange: (parameter: OceanParameter) => void;
  depth: DepthLevel;
  onDepthChange: (depth: DepthLevel) => void;
  activeWindSystems: Set<WindSystemType>;
  onWindChange: (systems: Set<WindSystemType>) => void;
  onOpenCompare?: () => void;
  onOpenPHAnalyzer?: () => void;
  showEEZ?: boolean;
  onEEZChange?: (show: boolean) => void;
  showArgo?: boolean;
  onArgoChange?: (show: boolean) => void;
  showGlider?: boolean;
  onGliderChange?: (show: boolean) => void;
  showOilSpill?: boolean;
  onOilSpillChange?: (show: boolean) => void;
  oilSpillCount?: number;
  onOpenOilSpillLab?: () => void;
}

type TabSection = 'all' | 'layers' | 'params' | 'depth' | 'winds';

const LAYERS: { key: OceanLayer; label: string; desc: string; color: string }[] = [
  { key: 'observation', label: 'IN-SITU OBS', desc: 'Argo & IoT Buoys', color: '#38bdf8' },
  { key: 'model',       label: 'INCOIS O.A.S.',  desc: 'Supercomputer Model', color: '#818cf8' },
  { key: 'difference',  label: 'VARIANCE',    desc: 'Delta Ground Truth', color: '#f59e0b' },
  { key: 'anomaly',     label: 'ML ANOMALY',  desc: 'Isolation Forest AI', color: '#ef4444' },
];

const PARAMS: { id: OceanParameter; label: string; unit: string; color: string }[] = [
  { id: 'temperature', label: 'SST',  unit: '°C',  color: '#38bdf8' },
  { id: 'salinity',    label: 'SAL',  unit: 'PSU', color: '#818cf8' },
  { id: 'waveHeight',  label: 'WAVE', unit: 'm',   color: '#38bdf8' },
  { id: 'currentSpeed',label: 'CURR', unit: 'm/s', color: '#34d399' },
  { id: 'seaLevel',    label: 'SSH',  unit: 'm',   color: '#a78bfa' },
  { id: 'ph',          label: 'pH',   unit: 'pH',  color: '#10b981' },
  { id: 'chlorophyll', label: 'CHL-A',unit: 'mg/m³', color: '#10b981' },
];

const DEPTHS: { level: DepthLevel; zone: string }[] = [
  { level: 0,    zone: 'Surface Layer' },
  { level: 10,   zone: 'Photic Epipelagic' },
  { level: 50,   zone: 'Upper Mesopelagic' },
  { level: 100,  zone: 'Twilight Disphotic' },
  { level: 500,  zone: 'Bathyal Aphotic' },
  { level: 1000, zone: 'Abyssal Benthic' },
];

export function UnifiedControlDock({
  layer,
  onLayerChange,
  parameter,
  onParameterChange,
  depth,
  onDepthChange,
  activeWindSystems,
  onWindChange,
  onOpenCompare,
  onOpenPHAnalyzer,
  showEEZ = false,
  onEEZChange,
  showArgo = true,
  onArgoChange,
  showGlider = true,
  onGliderChange,
  showOilSpill = false,
  onOilSpillChange,
  oilSpillCount = 0,
  onOpenOilSpillLab,
}: UnifiedControlDockProps) {
  const [activeTab, setActiveTab] = useState<TabSection>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleWind = (id: WindSystemType) => {
    const next = new Set(activeWindSystems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onWindChange(next);
  };

  const isolateWind = (id: WindSystemType, e: React.MouseEvent) => {
    e.stopPropagation();
    onWindChange(new Set([id]));
  };

  const toggleAllWinds = () => {
    if (activeWindSystems.size === WIND_SYSTEMS_CONFIG.length) {
      onWindChange(new Set());
    } else {
      onWindChange(new Set(WIND_SYSTEMS_CONFIG.map(s => s.id)));
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="sci-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          color: '#e2e8f0',
          fontSize: '11px',
          fontWeight: 600,
          border: 'none',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
        <span>CONTROL DOCK</span>
        <span style={{ color: '#64748b', marginLeft: '4px' }}>+</span>
      </button>
    );
  }

  return (
    <div
      className="sci-panel animate-fade-in"
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 30,
      }}
    >
      {/* ── Top Header & Tab Switcher ── */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#38bdf8',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#f8fafc',
                letterSpacing: '0.05em',
              }}
            >
              CONTROL DOCK
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              ONLINE
            </span>
            <button
              onClick={() => setIsCollapsed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              −
            </button>
          </div>
        </div>

        {/* Section Filter Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'layers', label: 'Layer' },
            { id: 'params', label: 'Param' },
            { id: 'depth', label: 'Depth' },
            { id: 'winds', label: 'Wind' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabSection)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* ── 1. DATA LAYERS ── */}
        {(activeTab === 'all' || activeTab === 'layers') && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Data Layer
              </span>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500 }}>
                {layer.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {LAYERS.map((l) => {
                const isActive = layer === l.key;
                return (
                  <button
                    key={l.key}
                    onClick={() => onLayerChange(l.key)}
                    className={isActive ? 'sci-btn sci-btn-active' : 'sci-btn'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? l.color : 'transparent', border: `1px solid ${isActive ? l.color : '#475569'}` }} />
                      <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{l.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* India EEZ Toggle */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                India EEZ Overlay
              </span>
              <button
                onClick={() => onEEZChange?.(!showEEZ)}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px',
                  background: showEEZ ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none', position: 'relative', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{ position: 'absolute', top: '2px', left: showEEZ ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
              </button>
            </div>

            {/* ARGO Toggle */}
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                ARGO Floats
              </span>
              <button
                onClick={() => onArgoChange?.(!showArgo)}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px',
                  background: showArgo ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none', position: 'relative', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{ position: 'absolute', top: '2px', left: showArgo ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
              </button>
            </div>

            {/* GLIDER Toggle */}
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                Glider Missions
              </span>
              <button
                onClick={() => onGliderChange?.(!showGlider)}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px',
                  background: showGlider ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none', position: 'relative', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{ position: 'absolute', top: '2px', left: showGlider ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
              </button>
            </div>

            {/* OIL SPILL HAZARD RADAR (ML) Toggle */}
            <div
              style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: showOilSpill ? '#ef4444' : '#64748b',
                    boxShadow: showOilSpill ? '0 0 8px #ef4444' : 'none',
                  }}
                />
                <div>
                  <div style={{ fontSize: '11px', color: showOilSpill ? '#f87171' : '#cbd5e1', fontWeight: 600 }}>
                    Oil Spill Radar (ML)
                  </div>
                  {oilSpillCount > 0 && (
                    <div style={{ fontSize: '9px', color: '#ef4444', fontFamily: 'monospace' }}>
                      {oilSpillCount} ACTIVE SPILL HAZARDS
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onOpenOilSpillLab && (
                  <button
                    onClick={onOpenOilSpillLab}
                    title="Open SAR ML Diagnostic Lab"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '9px',
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    LAB
                  </button>
                )}
                <button
                  onClick={() => onOilSpillChange?.(!showOilSpill)}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px',
                    background: showOilSpill ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none', position: 'relative', cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: showOilSpill ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. OCEAN PARAMETERS ── */}
        {(activeTab === 'all' || activeTab === 'params') && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Ocean Parameter
              </span>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500 }}>
                {PARAMETER_CONFIG[parameter].shortLabel}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {PARAMS.map((p) => {
                const isActive = parameter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onParameterChange(p.id)}
                    className={isActive ? 'sci-btn sci-btn-active' : 'sci-btn'}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{p.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{p.unit}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 3. WATER DEPTH COLUMN ── */}
        {(activeTab === 'all' || activeTab === 'depth') && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Water Depth
              </span>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500 }}>
                {depth}m
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
              {DEPTHS.map((d) => {
                const isActive = depth === d.level;
                return (
                  <button
                    key={d.level}
                    onClick={() => onDepthChange(d.level)}
                    className={isActive ? 'sci-btn sci-btn-active' : 'sci-btn'}
                    style={{
                      padding: '6px 4px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: isActive ? 600 : 500 }}>
                      {DEPTH_LABELS[d.level]}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Depth stratum visual bar */}
            <div
              className="sci-card"
              style={{
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '4px',
                  height: '24px',
                  borderRadius: '2px',
                  background: 'linear-gradient(180deg, #38bdf8 0%, #1e3a8a 100%)',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                  Stratified Zone
                </div>
                <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 500 }}>
                  {DEPTHS.find(d => d.level === depth)?.zone || 'Epipelagic Zone'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. ATMOSPHERIC WIND CHANNELS ── */}
        {(activeTab === 'all' || activeTab === 'winds') && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Wind Vectors
              </span>
              <button
                onClick={toggleAllWinds}
                style={{
                  fontSize: '10px',
                  color: '#38bdf8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                {activeWindSystems.size === WIND_SYSTEMS_CONFIG.length ? 'Hide All' : 'Show All'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {WIND_SYSTEMS_CONFIG.map((sys) => {
                const isActive = activeWindSystems.has(sys.id);
                return (
                  <div
                    key={sys.id}
                    className="sci-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      border: isActive ? `1px solid ${sys.color}40` : undefined,
                    }}
                  >
                    <button
                      onClick={() => toggleWind(sys.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        flexGrow: 1,
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isActive ? sys.color : 'transparent',
                          border: `1px solid ${isActive ? sys.color : '#475569'}`,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          color: isActive ? '#f8fafc' : '#94a3b8',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {sys.label}
                      </span>
                    </button>

                    <button
                      onClick={(e) => isolateWind(sys.id, e)}
                      title="Isolate this streamline channel"
                      style={{
                        fontSize: '9px',
                        color: isActive && activeWindSystems.size === 1 ? '#38bdf8' : '#64748b',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        padding: '2px 6px',
                      }}
                    >
                      SOLO
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 5. QUICK ACTIONS IN DOCK ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {onOpenCompare && (
            <button
              onClick={onOpenCompare}
              className="sci-btn"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#f8fafc',
                background: 'rgba(245, 158, 11, 0.1)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              Compare Data (Variance)
            </button>
          )}

          {onOpenPHAnalyzer && (
            <button
              onClick={onOpenPHAnalyzer}
              className="sci-btn"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#f8fafc',
                background: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
              }}
            >
              Determine Live pH
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
