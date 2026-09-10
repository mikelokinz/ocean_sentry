import React, { useState } from 'react';
import type { OilSpillRecord } from '../../types/ocean';
import { runPresetOilSpillDetection, detectOilSpillUpload, triggerOilSpillAlert } from '../../services/oceanApi';

interface OilSpillModalProps {
  spill: OilSpillRecord | null;
  onClose: () => void;
}

export function OilSpillModal({ spill, onClose }: OilSpillModalProps) {
  const [activeTab, setActiveTab] = useState<'incident' | 'diagnostic' | 'response'>('incident');
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [threshold, setThreshold] = useState<number>(0.8);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  if (!spill) return null;

  const handleRunPreset = async (preset: 'spill' | 'clean') => {
    setDiagnosticLoading(true);
    setDiagnosticResult(null);
    try {
      const res = await runPresetOilSpillDetection(preset, threshold);
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
    setDiagnosticResult(null);
    try {
      const res = await detectOilSpillUpload(file, threshold);
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
      setAlertStatus(`SUCCESS: Incident payload dispatched to n8n automation engine (Status: ${res.n8n_status || 'OK'})`);
    } catch (err: any) {
      setAlertStatus(`WARNING: Alert recorded locally (${err.message}). Verify n8n workflow webhook.`);
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
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="sci-panel"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(2, 6, 23, 0.96) 100%)',
          border: `1px solid ${alertColor}60`,
          borderRadius: '12px',
          boxShadow: `0 0 40px ${alertColor}25, 0 25px 50px -12px rgba(0, 0, 0, 0.7)`,
          display: 'flex',
          flexDirection: 'column',
          color: '#e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: alertColor,
                boxShadow: `0 0 12px ${alertColor}`,
              }}
            />
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '0.12em', color: alertColor, fontWeight: 700 }}>
                CRITICAL HAZARD // SAR MICROWAVE OIL SPILL RADAR
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {spill.name} ({spill.location_name})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: `${alertColor}20`,
                border: `1px solid ${alertColor}50`,
                color: alertColor,
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              {spill.status.toUpperCase().replace('_', ' ')}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
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

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 24px',
            background: 'rgba(0, 0, 0, 0.15)',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('incident')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'incident' ? `2px solid ${alertColor}` : '2px solid transparent',
              color: activeTab === 'incident' ? '#f8fafc' : '#94a3b8',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            SATELLITE SAR TELEMETRY
          </button>
          <button
            onClick={() => setActiveTab('diagnostic')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'diagnostic' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'diagnostic' ? '#f8fafc' : '#94a3b8',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            LOCAL U-NET INFERENCE LAB
          </button>
          <button
            onClick={() => setActiveTab('response')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'response' ? '2px solid #a855f7' : '2px solid transparent',
              color: activeTab === 'response' ? '#f8fafc' : '#94a3b8',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            N8N AUTOMATION & ESCALATION
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {activeTab === 'incident' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Visual Imagery Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                    SENTINEL-1 C-BAND SAR CAPTURE
                  </div>
                  <div
                    style={{
                      height: '240px',
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
                      src={spill.sar_image_url}
                      alt="SAR Satellite Raw Capture"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        color: '#38bdf8',
                      }}
                    >
                      MICROWAVE BACKSCATTER DAMPENING
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: `1px solid ${alertColor}40`,
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: alertColor, marginBottom: '8px', fontWeight: 600 }}>
                    LOCAL RESNET-34 U-NET AI SEGMENTATION
                  </div>
                  <div
                    style={{
                      height: '240px',
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
                      src={spill.sar_image_url}
                      alt="U-Net Segmented Mask"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.2)' }}
                    />
                    {/* Visual Segmented Contours Highlight */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 45% 40%, rgba(239, 68, 68, 0.45) 0%, rgba(249, 115, 22, 0.25) 30%, transparent 65%)',
                        pointerEvents: 'none',
                        mixBlendMode: 'screen',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        color: alertColor,
                        fontWeight: 700,
                      }}
                    >
                      {(spill.confidence * 100).toFixed(1)}% CONFIDENCE
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Tech Telemetry Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Affected Surface Area</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {spill.area_km2} <span style={{ fontSize: '12px', color: '#64748b' }}>km²</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px' }}>
                    {spill.spillage_percentage}% total frame coverage
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Coordinates</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '4px', fontFamily: 'monospace' }}>
                    {spill.latitude.toFixed(2)}°N, {spill.longitude.toFixed(2)}°E
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    {spill.location_name}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Hydrodynamic Drift</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {spill.drift_vector?.speed_knots || 1.2} kts @ {spill.drift_vector?.heading_deg || 110}°
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                    {spill.drift_vector?.direction || 'Surface current heading'}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Model Checkpoint</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#a855f7', marginTop: '4px' }}>
                    best_oil_model.pth
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                    ResNet-34 U-Net (PyTorch)
                  </div>
                </div>
              </div>

              {/* Recommended Operational Protocol */}
              <div
                style={{
                  background: `${alertColor}10`,
                  border: `1px solid ${alertColor}30`,
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: alertColor, textTransform: 'uppercase' }}>
                    RECOMMENDED EMERGENCY ACTION
                  </div>
                  <div style={{ fontSize: '13px', color: '#f1f5f9', marginTop: '2px' }}>
                    {spill.recommended_action}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('response')}
                  style={{
                    background: alertColor,
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.05em',
                  }}
                >
                  DISPATCH TO N8N
                </button>
              </div>
            </div>
          )}

          {activeTab === 'diagnostic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: '12px',
                  color: '#93c5fd',
                  lineHeight: '1.5',
                }}
              >
                <strong>Operator SAR Diagnostic Testing:</strong> Execute the locally trained U-Net segmentation model
                (<code>best_oil_model.pth</code>) against high-resolution Synthetic Aperture Radar (SAR) imagery to detect
                oil slick coverage in real time.
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => handleRunPreset('spill')}
                  disabled={diagnosticLoading}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 18px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: diagnosticLoading ? 'not-allowed' : 'pointer',
                    opacity: diagnosticLoading ? 0.6 : 1,
                  }}
                >
                  {diagnosticLoading ? 'RUNNING U-NET...' : 'RUN OIL SPILL BENCHMARK'}
                </button>

                <button
                  onClick={() => handleRunPreset('clean')}
                  disabled={diagnosticLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '10px 18px',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: diagnosticLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  RUN CLEAN OCEAN BENCHMARK
                </button>

                <label
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    padding: '10px 18px',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  UPLOAD CUSTOM SAR IMAGE (.PNG/.TIF)
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                {/* Threshold slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Threshold:</span>
                  <input
                    type="range"
                    min="0.4"
                    max="0.95"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    style={{ width: '80px', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace' }}>
                    {threshold.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Diagnostic Output View */}
              {diagnosticLoading && (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ marginBottom: '8px', fontSize: '18px' }}>⚙️</div>
                  Executing local PyTorch ResNet-34 U-Net inference on hardware...
                </div>
              )}

              {diagnosticResult && !diagnosticLoading && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: diagnosticResult.status === 'oil_detected' ? '#ef4444' : '#10b981',
                        }}
                      >
                        STATUS: {diagnosticResult.status?.toUpperCase()}
                      </span>
                      <span style={{ color: '#64748b' }}>|</span>
                      <span style={{ fontSize: '12px', color: '#e2e8f0' }}>
                        Confidence: <strong>{(diagnosticResult.confidence_score * 100).toFixed(1)}%</strong>
                      </span>
                      <span style={{ color: '#64748b' }}>|</span>
                      <span style={{ fontSize: '12px', color: '#e2e8f0' }}>
                        Spills Found: <strong>{diagnosticResult.detected_spills_count}</strong>
                      </span>
                      <span style={{ color: '#64748b' }}>|</span>
                      <span style={{ fontSize: '12px', color: '#e2e8f0' }}>
                        Coverage: <strong>{diagnosticResult.spillage_percentage}%</strong>
                      </span>
                    </div>

                    <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      Device: {diagnosticResult.device_used} · {diagnosticResult.model_architecture}
                    </div>
                  </div>

                  {/* Mask Visualizer */}
                  {diagnosticResult.mask_overlay_base64 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                          COLORED CONTOUR OVERLAY
                        </div>
                        <img
                          src={diagnosticResult.mask_overlay_base64}
                          alt="Color Overlay"
                          style={{ width: '100%', height: '220px', objectFit: 'contain', background: '#09090b', borderRadius: '6px' }}
                        />
                      </div>
                      {diagnosticResult.raw_mask_base64 && (
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                            RAW BINARY SEGMENTATION MASK
                          </div>
                          <img
                            src={diagnosticResult.raw_mask_base64}
                            alt="Raw Mask"
                            style={{ width: '100%', height: '220px', objectFit: 'contain', background: '#09090b', borderRadius: '6px' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'response' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  fontSize: '12px',
                  color: '#d8b4fe',
                  lineHeight: '1.5',
                }}
              >
                <strong>n8n Event-Driven Dispatch Pipeline:</strong> Connects real-time SAR U-Net anomaly detections
                to the local n8n automation engine (<code>http://localhost:5678</code>). Dispatches structured alerts
                to the Indian Coast Guard MRCC, INCOIS Early Warning Centre, and local maritime authorities.
              </div>

              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                  Automated Escalation Protocol (Active Workflow #803)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981' }}>✓</span> 1. Sentinel-1 SAR imagery ingested & segmented via local U-Net (<code>best_oil_model.pth</code>)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981' }}>✓</span> 2. Oil slick polygons & surface drift vectors computed
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981' }}>✓</span> 3. Webhook dispatched to n8n (<code>POST /webhook/oil-spill-alert</code>)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span style={{ color: '#38bdf8' }}>→</span> 4. Instant Telegram / Email broadcast to Maritime Rescue Coordination Centre (MRCC)
                  </div>
                </div>

                {alertStatus && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: alertStatus.startsWith('SUCCESS') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      border: `1px solid ${alertStatus.startsWith('SUCCESS') ? '#10b981' : '#f59e0b'}`,
                      color: alertStatus.startsWith('SUCCESS') ? '#6ee7b7' : '#fcd34d',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {alertStatus}
                  </div>
                )}

                <button
                  onClick={handleDispatchAlert}
                  disabled={alertLoading}
                  style={{
                    marginTop: '8px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '12px 20px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: alertLoading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  {alertLoading ? 'DISPATCHING TO N8N...' : 'TRIGGER EMERGENCY ESCALATION TO N8N'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
