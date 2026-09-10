import { useState, useEffect, useMemo } from 'react';
import type { Station } from '../../types/ocean';
import { STATIONS } from '../../data/oceanData';

interface GroundTruthModalProps {
  isOpen: boolean;
  onClose: () => void;
  station?: Station | null;
  onSelectStation?: (station: Station) => void;
}

export function GroundTruthModal({
  isOpen,
  onClose,
  station,
  onSelectStation,
}: GroundTruthModalProps) {
  // Find or fallback to IND-ESP32-01
  const defaultStation = useMemo(() => {
    return STATIONS.find((s) => s.id === 'IND-ESP32-01') || {
      id: 'IND-ESP32-01',
      name: 'IND-ESP32-01 (IoT Coastal Buoy)',
      type: 'buoy' as const,
      region: 'Hyper-Local Coastal Zone',
      latitude: 12.98,
      longitude: 80.25,
      depth: 0,
      isOnline: true,
      lastSyncMinutes: 1,
      temperature: 27.0,
      salinity: 33.4,
      waveHeight: 1.8,
      currentSpeed: 0.42,
      seaLevel: 0.11,
      modelTemperature: 35.0,
      modelSalinity: 33.6,
      modelWaveHeight: 2.0,
      modelCurrentSpeed: 0.45,
      modelSeaLevel: 0.10,
      status: 'critical' as const,
    };
  }, []);

  const [activeStationId, setActiveStationId] = useState<string>(
    station?.id || 'IND-ESP32-01'
  );
  const [advisorySent, setAdvisorySent] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      if (station?.id) {
        setActiveStationId(station.id);
      } else {
        setActiveStationId('IND-ESP32-01');
      }
    }, 0);
  }, [station?.id, isOpen]);

  // Keydown ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStation =
    STATIONS.find((s) => s.id === activeStationId) || (station?.id === activeStationId ? station : defaultStation);

  const modelTemp = currentStation.modelTemperature ?? 35.0;
  const observedTemp = currentStation.temperature ?? 27.0;
  const absDiff = Math.abs(modelTemp - observedTemp);
  const isAnomaly = absDiff >= 2.0 || currentStation.status === 'critical' || currentStation.id === 'IND-ESP32-01';

  const modelAccuracy = isAnomaly ? 'FAILED (High Variance)' : 'VERIFIED (Nominal)';
  
  const systemInsight = isAnomaly
    ? `The satellite numerical model is currently inaccurate in this hyper-local coastal zone. Fishermen and Coast Guard units are advised to rely on the live IoT sensor readings (${observedTemp.toFixed(1)} °C) for localized operations.`
    : `The INCOIS satellite numerical model (CMEMS assimilated) closely matches in-situ physical telemetry within ±${absDiff.toFixed(1)} °C tolerance. Standard navigation and operational models remain authorized for maritime routing.`;

  const handleBroadcast = () => {
    setAdvisorySent(true);
    setTimeout(() => {
      setAdvisorySent(false);
    }, 4000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2, 8, 22, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sci-panel animate-fade-in"
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        {/* Header Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: isAnomaly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                border: isAnomaly ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(56, 189, 248, 0.2)',
                fontSize: '10px',
                fontWeight: 600,
                color: isAnomaly ? '#fca5a5' : '#7dd3fc',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isAnomaly ? '#ef4444' : '#38bdf8',
                }}
              />
              Ground-Truth Protocol · Real-Time Cross-Validation
            </div>
            
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 600,
                margin: 0,
                color: '#f8fafc',
                letterSpacing: '0.02em',
              }}
            >
              Data Validation Report
            </h2>

            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginTop: '6px',
              }}
            >
              Live accuracy check for Station:{' '}
              <span
                style={{
                  color: '#e2e8f0',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                {currentStation.id}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '4px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '8px 12px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Station Switcher */}
        <div
          className="sci-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            marginBottom: '20px',
            fontSize: '12px',
          }}
        >
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>Select Station:</span>
          <select
            value={activeStationId}
            onChange={(e) => {
              setActiveStationId(e.target.value);
              const found = STATIONS.find((s) => s.id === e.target.value);
              if (found && onSelectStation) onSelectStation(found);
            }}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '12px',
              padding: '6px 12px',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '200px',
            }}
          >
            <option value="IND-ESP32-01">IND-ESP32-01 (IoT Coastal Buoy - Benchmark)</option>
            {STATIONS.filter((s) => s.id !== 'IND-ESP32-01').map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} ({s.name || s.type.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Dual Telemetry Cards (Model vs In-Situ Sensor) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          {/* Card 1: INCOIS Numerical Model */}
          <div
            className="sci-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#94a3b8',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>INCOIS Model Prediction</span>
              <span
                style={{
                  fontSize: '9px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                GRID 0.083°
              </span>
            </div>
            
            <div
              style={{
                color: '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: '24px',
                fontWeight: 600,
              }}
            >
              {modelTemp.toFixed(1)} °C
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              Predicted Temperature
            </div>
          </div>

          {/* Card 2: Live In-Situ Sensor */}
          <div
            className="sci-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#94a3b8',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Live In-Situ Sensor</span>
              <span
                style={{
                  fontSize: '9px',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                DIRECT TELEMETRY
              </span>
            </div>
            
            <div
              style={{
                color: '#34d399',
                fontFamily: 'monospace',
                fontSize: '24px',
                fontWeight: 600,
              }}
            >
              {observedTemp.toFixed(1)} °C
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              Physical Water Observation
            </div>
          </div>
        </div>

        {/* Anomaly Detection Section */}
        <div
          style={{
            background: isAnomaly ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: isAnomaly ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isAnomaly ? '#fca5a5' : '#86efac',
              }}
            >
              {isAnomaly ? 'Anomaly Detected' : 'Nominal Correlation'}
            </div>
            
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: isAnomaly ? '#ef4444' : '#10b981',
                background: isAnomaly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
            >
              {isAnomaly ? 'VARIANCE THRESHOLD EXCEEDED' : 'WITHIN TOLERANCE'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, marginBottom: '4px' }}>
                ABSOLUTE DIFFERENCE
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: isAnomaly ? '#f87171' : '#34d399',
                }}
              >
                {absDiff.toFixed(1)} °C
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, marginBottom: '4px' }}>
                MODEL ACCURACY
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isAnomaly ? '#ef4444' : '#10b981',
                }}
              >
                {modelAccuracy}
              </div>
            </div>
          </div>

          {/* Graphical Variance Gap Indicator */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>
              <span>Tolerance: ±1.5°C</span>
              <span>Observed: {absDiff.toFixed(1)}°C</span>
              <span>Max: 10.0°C</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (absDiff / 10) * 100)}%`,
                  background: isAnomaly ? '#ef4444' : '#10b981',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* System Insight Box */}
        <div
          className="sci-card"
          style={{
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#38bdf8',
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}
          >
            System Insight
          </div>

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: '#cbd5e1',
              margin: 0,
            }}
          >
            {systemInsight}
          </p>
        </div>

        {/* Advisory Sent Toast Message */}
        {advisorySent && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px',
              color: '#34d399',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>Maritime coastal advisory dispatched to Indian Coast Guard and regional IoT mesh receivers.</span>
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '20px',
          }}
        >
          <button
            onClick={onClose}
            className="sci-btn"
            style={{
              padding: '8px 20px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Close
          </button>

          <button
            onClick={handleBroadcast}
            className="sci-btn"
            style={{
              background: isAnomaly ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              borderColor: isAnomaly ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)',
              color: isAnomaly ? '#fca5a5' : '#7dd3fc',
              padding: '8px 20px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Broadcast Maritime Advisory
          </button>
        </div>
      </div>
    </div>
  );
}
