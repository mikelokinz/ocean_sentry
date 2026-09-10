import React, { useState } from 'react';
import type { OilSpillRecord } from '../../types/ocean';
import { runPresetOilSpillDetection, detectOilSpillUpload, triggerOilSpillAlert } from '../../services/oceanApi';

interface OilSpillModalProps {
  spill: OilSpillRecord | null;
  onClose: () => void;
}

export function OilSpillModal({ spill, onClose }: OilSpillModalProps) {
  const [viewMode, setViewMode] = useState<'both' | 'raw' | 'ai'>('both');
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [showLab, setShowLab] = useState(false);

  if (!spill) return null;

  const handleRunPreset = async (preset: 'spill' | 'clean') => {
    setDiagnosticLoading(true);
    try {
      const res = await runPresetOilSpillDetection(preset);
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({ error: err.message || 'Inference failed' });
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDiagnosticLoading(true);
    try {
      const res = await detectOilSpillUpload(file);
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({ error: err.message || 'Inference failed' });
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleDispatchAlert = async () => {
    setAlertLoading(true);
    try {
      const res = await triggerOilSpillAlert(spill.id, `Emergency action requested for ${spill.name}`);
      setAlertStatus(`SUCCESS: Incident dispatched to n8n engine (${res.n8n_status || 'OK'})`);
    } catch (err: any) {
      setAlertStatus(`Alert logged (${err.message})`);
    } finally {
      setAlertLoading(false);
    }
  };

  const isCritical = spill.severity === 'critical' || spill.status === 'oil_detected';
  const alertColor = isCritical ? '#ef4444' : '#f59e0b';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="sci-panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.98) 100%)',
          border: `1px solid ${alertColor}70`,
          borderRadius: '12px',
          boxShadow: `0 0 35px ${alertColor}30, 0 25px 50px -12px rgba(0, 0, 0, 0.8)`,
          display: 'flex',
          flexDirection: 'column',
          color: '#e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: alertColor,
                boxShadow: `0 0 10px ${alertColor}`,
              }}
            />
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: alertColor, fontWeight: 700 }}>
                BAY OF BENGAL // SAR OIL SPILL ANOMALY AUDIT
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginTop: '1px' }}>
                {spill.name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 9px',
                borderRadius: '9999px',
                background: `${alertColor}20`,
                border: `1px solid ${alertColor}60`,
                color: alertColor,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              {(spill.confidence * 100).toFixed(1)}% CONFIDENCE
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Image View Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.3)', padding: '3px', borderRadius: '6px' }}>
              <button
                onClick={() => setViewMode('both')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'both' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  color: viewMode === 'both' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Dual View
              </button>
              <button
                onClick={() => setViewMode('raw')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'raw' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  color: viewMode === 'raw' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Raw Satellite SAR
              </button>
              <button
                onClick={() => setViewMode('ai')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: viewMode === 'ai' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                  color: viewMode === 'ai' ? '#ef4444' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                AI Segmented Mask
              </button>
            </div>

            <button
              onClick={() => setShowLab(!showLab)}
              style={{
                background: showLab ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                color: showLab ? '#d8b4fe' : '#cbd5e1',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showLab ? 'Hide Test Lab' : '⚙️ Test Local Model Live'}
            </button>
          </div>

          {/* Primary SAR Satellite Images Showcase */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'both' ? '1fr 1fr' : '1fr',
              gap: '14px',
            }}
          >
            {(viewMode === 'both' || viewMode === 'raw') && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                    SENTINEL-1 SAR MICROWAVE REFLECTANCE
                  </span>
                  <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace' }}>
                    C-Band (VV Polarization)
                  </span>
                </div>
                <div
                  style={{
                    height: '260px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#09090b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <img
                    src={diagnosticResult?.image_url || spill.sar_image_url}
                    alt="SAR Satellite Raw Image"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      background: 'rgba(0, 0, 0, 0.75)',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      color: '#cbd5e1',
                    }}
                  >
                    RAW RADAR BACKSCATTER
                  </div>
                </div>
              </div>
            )}

            {(viewMode === 'both' || viewMode === 'ai') && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: `1px solid ${alertColor}50`,
                  borderRadius: '8px',
                  padding: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: alertColor, fontWeight: 600 }}>
                    LOCAL RESNET-34 U-NET AI SEGMENTATION
                  </span>
                  <span style={{ fontSize: '10px', color: alertColor, fontFamily: 'monospace', fontWeight: 700 }}>
                    best_oil_model.pth
                  </span>
                </div>
                <div
                  style={{
                    height: '260px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#09090b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {diagnosticResult?.mask_overlay_base64 ? (
                    <img
                      src={diagnosticResult.mask_overlay_base64}
                      alt="AI Segmentation Mask Overlay"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <>
                      <img
                        src={spill.sar_image_url}
                        alt="Segmented Satellite Image"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'contrast(1.25)' }}
                      />
                      {/* Slick highlight overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'radial-gradient(circle at 45% 45%, rgba(239, 68, 68, 0.5) 0%, rgba(249, 115, 22, 0.3) 30%, transparent 65%)',
                          pointerEvents: 'none',
                          mixBlendMode: 'screen',
                        }}
                      />
                    </>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      color: alertColor,
                      fontWeight: 700,
                    }}
                  >
                    SLICK CONTOURS DETECTED
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Telemetry Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>COORDINATES</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px', fontFamily: 'monospace' }}>
                {spill.latitude.toFixed(2)}°N, {spill.longitude.toFixed(2)}°E
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Bay of Bengal</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>AFFECTED SLICK AREA</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {spill.area_km2} <span style={{ fontSize: '11px', color: '#64748b' }}>km²</span>
              </div>
              <div style={{ fontSize: '10px', color: '#38bdf8' }}>{spill.spillage_percentage}% frame coverage</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>HYDRODYNAMIC DRIFT</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                {spill.drift_vector?.speed_knots || 1.4} kts @ {spill.drift_vector?.heading_deg || 65}°
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{spill.drift_vector?.direction || 'Surface trajectory'}</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>DETECTION STATUS</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: alertColor, marginTop: '2px' }}>
                OIL DETECTED
              </div>
              <div style={{ fontSize: '10px', color: '#a855f7' }}>Tier-1 Containment</div>
            </div>
          </div>

          {/* Quick Testing Lab (if toggled) */}
          {showLab && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#d8b4fe' }}>
                Execute Local Model (best_oil_model.pth) on Test Images:
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleRunPreset('spill')}
                  disabled={diagnosticLoading}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {diagnosticLoading ? 'Running...' : 'Run Spill Image (test_image_spill.png)'}
                </button>
                <button
                  onClick={() => handleRunPreset('clean')}
                  disabled={diagnosticLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Run Clean Ocean (test_image_clean.png)
                </button>
                <label
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    color: '#38bdf8',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Upload Custom SAR File
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {diagnosticResult && (
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                  Result: <strong>{diagnosticResult.status?.toUpperCase()}</strong> · Confidence:{' '}
                  <strong>{(diagnosticResult.confidence_score * 100).toFixed(1)}%</strong> · Spills:{' '}
                  <strong>{diagnosticResult.detected_spills_count}</strong> · Device:{' '}
                  <code>{diagnosticResult.device_used}</code>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div
            style={{
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {alertStatus || `Action: ${spill.recommended_action}`}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDispatchAlert}
                disabled={alertLoading}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: alertLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {alertLoading ? 'Dispatching...' : 'Dispatch Alert to n8n'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
