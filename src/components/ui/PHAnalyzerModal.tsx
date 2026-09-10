import { useState, useMemo, useEffect } from 'react';
import type { Station } from '../../types/ocean';
import { STATIONS } from '../../data/oceanData';

interface PHAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStation?: Station | null;
}

// ── Physical Carbonate & pH Calculation Engine ────────────────────────────────
function calculateOceanPH({
  temperatureC,
  salinityPsu,
  sensorVoltageMv,
  pCO2Ppm,
  depthM,
}: {
  temperatureC: number;
  salinityPsu: number;
  sensorVoltageMv: number;
  pCO2Ppm: number;
  depthM: number;
}) {
  // Absolute Temperature
  const T = temperatureC + 273.15;
  const R = 8.31451; // J/(mol*K)
  const F = 96485.34; // C/mol

  // 1. Nernst Slope in Volts/pH
  const nernstSlopeV = (R * T * Math.LN10) / F;
  const nernstSlopeMv = nernstSlopeV * 1000; // ~59.16 mV/pH at 25°C

  // 2. Base ISFET Standard Potential E0 (calibrated for standard seawater S=35, T=25C)
  const E0_Mv = 412.5 - 0.85 * (temperatureC - 25) + 0.12 * (salinityPsu - 35) + 0.0035 * depthM;

  // 3. In-Situ pH on Total Scale from ISFET Sensor Voltage
  let pH_total = (E0_Mv - sensorVoltageMv) / nernstSlopeMv;

  // Modulate with pCO2 offset (pre-industrial 280ppm ~ 8.25; 420ppm ~ 8.10; 800ppm ~ 7.82)
  const pCO2Effect = -0.00038 * (pCO2Ppm - 420);
  pH_total += pCO2Effect;

  // Pressure/Depth Effect (respiration CO2 accumulation & pressure ionization)
  const depthEffect = -0.00045 * depthM;
  pH_total += depthEffect;

  // Bound to physical ocean range [6.8, 8.8]
  pH_total = Math.max(6.8, Math.min(8.8, pH_total));

  // 4. Hydronium Ion Concentration [H+] in nmol/kg
  const hPlusNmol = Math.pow(10, -pH_total) * 1e9;

  // 5. Aragonite Saturation State (Omega_arag)
  // Normal surface ~ 3.8; critical dissolution threshold = 1.0
  const baseOmega = Math.pow(10, (pH_total - 7.55) * 1.65);
  const omegaArag = Math.max(0.2, baseOmega * (salinityPsu / 35) * (1 - depthM / 4000));
  const omegaCalc = omegaArag * 1.52; // Calcite is ~1.5x more soluble/stable than aragonite

  // 6. Marine Ecological Health Status
  let status: 'optimal' | 'moderate' | 'critical';
  let statusLabel: string;
  let impactDescription: string;

  if (pH_total >= 8.05 && omegaArag >= 3.0) {
    status = 'optimal';
    statusLabel = 'Optimal';
    impactDescription = 'Optimal carbonate ion saturation (Ω > 3.0). Coral calcification, pteropods, and larval shellfish shells develop normally.';
  } else if (pH_total >= 7.90 && omegaArag >= 1.5) {
    status = 'moderate';
    statusLabel = 'Moderate Stress';
    impactDescription = 'Mild ocean acidification stress. Slower coral growth rate and slight thinning of juvenile calcifying organism shells.';
  } else {
    status = 'critical';
    statusLabel = 'Severe Risk';
    impactDescription = 'Critical carbonate undersaturation (Ω < 1.5). Aragonite shell dissolution detected. High risk of coral bleaching and larval mortality.';
  }

  return {
    pH_total: parseFloat(pH_total.toFixed(3)),
    nernstSlopeMv: parseFloat(nernstSlopeMv.toFixed(2)),
    hPlusNmol: parseFloat(hPlusNmol.toFixed(2)),
    omegaArag: parseFloat(omegaArag.toFixed(2)),
    omegaCalc: parseFloat(omegaCalc.toFixed(2)),
    status,
    statusLabel,
    impactDescription,
  };
}

export function PHAnalyzerModal({ isOpen, onClose, initialStation }: PHAnalyzerModalProps) {
  const [selectedStationId, setSelectedStationId] = useState<string>(
    initialStation?.id || 'BOB-014'
  );

  const currentStation = useMemo(() => {
    return STATIONS.find((s) => s.id === selectedStationId) || initialStation || STATIONS[0];
  }, [selectedStationId, initialStation]);

  const [temperatureC, setTemperatureC] = useState<number>(currentStation.temperature || 28.4);
  const [salinityPsu, setSalinityPsu] = useState<number>(currentStation.salinity || 32.8);
  const [sensorVoltageMv, setSensorVoltageMv] = useState<number>(-72.5);
  const [pCO2Ppm, setPCO2Ppm] = useState<number>(425);
  const [depthM, setDepthM] = useState<number>(currentStation.depth || 0);

  useEffect(() => {
    setTimeout(() => {
      if (currentStation) {
        setTemperatureC(currentStation.temperature || 28.4);
        setSalinityPsu(currentStation.salinity || 32.8);
        setDepthM(currentStation.depth || 0);
        const targetPH = currentStation.ph || 8.14;
        const approxMv = 412.5 - targetPH * 59.16;
        setSensorVoltageMv(parseFloat(approxMv.toFixed(1)));
      }
    }, 0);
  }, [currentStation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const calc = useMemo(() => {
    return calculateOceanPH({
      temperatureC,
      salinityPsu,
      sensorVoltageMv,
      pCO2Ppm,
      depthM,
    });
  }, [temperatureC, salinityPsu, sensorVoltageMv, pCO2Ppm, depthM]);

  if (!isOpen) return null;

  const statusBadgeColor =
    calc.status === 'optimal' ? '#10b981' : calc.status === 'moderate' ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2, 8, 22, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.2s ease-out',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '720px',
          maxWidth: '94vw',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg, rgba(6, 18, 42, 0.55) 0%, rgba(2, 9, 24, 0.65) 100%)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 25px rgba(56, 189, 248, 0.08)',
          padding: '32px',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#38bdf8',
                marginBottom: '12px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
              BGC-ARGO Sensor Module
            </div>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                color: '#f8fafc',
                letterSpacing: '-0.02em',
              }}
            >
              Ocean Water pH Analysis
            </h2>

            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Real-time in-situ total scale pH & ocean acidification analysis for{' '}
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{currentStation.id}</span> ({currentStation.region})
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            ✕
          </button>
        </div>

        {/* Station Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Select Float/Station:</span>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '13px',
              padding: '6px 12px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — Obs pH: {(s.ph || 8.14).toFixed(2)} | Model: {(s.modelPh || 8.16).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {/* Key Metrics */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr',
            gap: '24px',
          }}
        >
          {/* Main pH readout */}
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Seawater pH (Total Scale)
            </div>
            <div
              style={{
                fontSize: '42px',
                fontWeight: 700,
                color: '#f8fafc',
                lineHeight: 1.1,
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <span>{calc.pH_total.toFixed(3)}</span>
              <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}>pH</span>
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: statusBadgeColor,
                background: `${statusBadgeColor}15`,
                padding: '4px 10px',
                borderRadius: '6px',
                display: 'inline-block',
              }}
            >
              {calc.statusLabel}
            </div>
          </div>

          {/* Hydronium Ion & Nernst Slope */}
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Hydronium Ion [H⁺]
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
                {calc.hPlusNmol.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b' }}>nmol/kg</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Nernst Electrode Slope
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
                {calc.nernstSlopeMv.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b' }}>mV/pH</span>
              </div>
            </div>
          </div>

          {/* Aragonite & Calcite Saturation */}
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Aragonite Saturation
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: calc.omegaArag >= 3.0 ? '#10b981' : calc.omegaArag >= 1.0 ? '#f59e0b' : '#ef4444',
                }}
              >
                {calc.omegaArag.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b' }}>Ω</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Calcite Saturation
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
                {calc.omegaCalc.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b' }}>Ω</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Controls */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600, marginBottom: '16px' }}>
            Sensor Calibration & Controls
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 32px',
            }}
          >
            {/* Temperature Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>Water Temperature (T)</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{temperatureC.toFixed(1)} °C</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                step="0.1"
                value={temperatureC}
                onChange={(e) => setTemperatureC(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
              />
            </div>

            {/* Salinity Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>Salinity (S)</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{salinityPsu.toFixed(1)} PSU</span>
              </div>
              <input
                type="range"
                min="25"
                max="40"
                step="0.1"
                value={salinityPsu}
                onChange={(e) => setSalinityPsu(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
              />
            </div>

            {/* ISFET Electrode Voltage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>ISFET Voltage (E_cell)</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{sensorVoltageMv.toFixed(1)} mV</span>
              </div>
              <input
                type="range"
                min="-200"
                max="100"
                step="0.5"
                value={sensorVoltageMv}
                onChange={(e) => setSensorVoltageMv(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Atmospheric pCO2 Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>Atmospheric pCO₂</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{pCO2Ppm} ppm</span>
              </div>
              <input
                type="range"
                min="280"
                max="900"
                step="5"
                value={pCO2Ppm}
                onChange={(e) => setPCO2Ppm(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Scientific Context & Advisory */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600, marginBottom: '8px' }}>
              Physical Sensor Determination (ISFET)
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '12px' }}>
              Determined by field-effect potentiometry. The H⁺ ion activity across the gate dielectric follows the Nernst relationship with temperature compensation.
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#34d399', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              pH_Total = (E⁰(T,S,P) - E_cell) / [(R·T·ln 10)/F]
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600, marginBottom: '8px' }}>
              INCOIS BGC Model Assimilation (CMEMS)
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '12px' }}>
              INCOIS BGC Assimilation (PISCES-v2) solves the non-linear marine carbonate equilibrium using Total Alkalinity (A_T) and Dissolved Inorganic Carbon (DIC).
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#38bdf8', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              [CO₂*] + [HCO₃⁻] + [CO₃²⁻] = DIC · K₁(T,S,P)
            </div>
          </div>
        </div>

        {/* Ecological Advisory */}
        <div
          style={{
            background: `${statusBadgeColor}10`,
            border: `1px solid ${statusBadgeColor}30`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '12px', color: statusBadgeColor, fontWeight: 600, marginBottom: '4px' }}>
            Ecosystem & Fishery Advisory
          </div>
          <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: 1.5 }}>
            {calc.impactDescription}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 500,
              padding: '10px 24px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1e293b')}
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
