import React, { useState, useRef } from 'react';
import {
  previewAsciiData,
  ingestAsciiData,
  type AsciiPreviewResponse,
} from '../../services/oceanApi';

interface AsciiIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStationIngested?: (stationId: string) => void;
  onRefreshData?: () => void;
}

const PRESETS: Record<string, { label: string; text: string; stationId: string }> = {
  prompt: {
    label: 'Problem Statement (Whitespace)',
    stationId: 'ASCII-BAY-001',
    text: `LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20`,
  },
  mooring_csv: {
    label: 'Mooring Array (CSV)',
    stationId: 'MOORING-BOB-07',
    text: `latitude,longitude,depth,temperature,salinity,wave_height,current_u,current_v,ph,timestamp
14.20,86.50,5.0,29.1,33.6,1.4,0.18,-0.06,8.15,2026-09-08T06:00:00Z
14.20,86.50,20.0,28.7,34.1,1.4,0.14,-0.04,8.12,2026-09-08T06:00:00Z
14.20,86.50,50.0,27.2,34.9,1.4,0.08,-0.02,8.01,2026-09-08T06:00:00Z
14.20,86.50,150.0,21.5,35.3,1.4,0.02,0.01,7.85,2026-09-08T06:00:00Z`,
  },
  ctd_comments: {
    label: 'CTD Cast (# Comments)',
    stationId: 'INCOIS-CTD-42',
    text: `# Cruise: SAMUDRA-EXPEDITION-2026
# Station: INCOIS-CTD-42
# Latitude: 12.85
# Longitude: 84.40
# Date: 2026-09-07
DEPTH  TEMP  SAL  TIME
5.0    29.3  33.2 08:00
25.0   28.4  33.9 08:15
75.0   25.9  34.8 08:30
125.0  22.1  35.2 08:45
250.0  16.8  35.1 09:00`,
  },
  fault_isolation: {
    label: 'Fault Isolation Test (Mixed Errors)',
    stationId: 'FAULT-TEST-01',
    text: `LAT LON DEPTH TEMP SAL TIME
16.10 87.40 10 28.5 34.2 2026-09-08T10:00
195.0 87.40 20 28.0 34.2 2026-09-08T10:00
16.10 87.40 30 27.6 34.5 2026-09-08T10:00
16.10 87.40 NON_NUM_DEPTH 27.0 34.6 2026-09-08T10:00
16.10 87.40 100 24.2 35.1 2026-09-08T10:00`,
  },
};

export function AsciiIngestModal({
  isOpen,
  onClose,
  onStationIngested,
  onRefreshData,
}: AsciiIngestModalProps) {
  const [textContent, setTextContent] = useState(PRESETS.prompt.text);
  const [stationId, setStationId] = useState(PRESETS.prompt.stationId);
  const [selectedDelimiter, setSelectedDelimiter] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<AsciiPreviewResponse | null>(null);
  const [ingestSuccessMessage, setIngestSuccessMessage] = useState<string | null>(null);
  const [ingestedStationIds, setIngestedStationIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (key: string) => {
    const preset = PRESETS[key];
    if (preset) {
      setTextContent(preset.text);
      setStationId(preset.stationId);
      setPreviewResult(null);
      setIngestSuccessMessage(null);
      setErrorMessage(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTextContent(content);
      const inferredId = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
      setStationId(inferredId);
      setPreviewResult(null);
      setIngestSuccessMessage(null);
      setErrorMessage(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!textContent.trim()) {
      setErrorMessage('Please provide observation text or select a preset.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setIngestSuccessMessage(null);
    try {
      const resp = await previewAsciiData(textContent, {
        stationId: stationId.trim() || undefined,
        delimiter: selectedDelimiter !== 'auto' ? selectedDelimiter : undefined,
      });
      setPreviewResult(resp);
    } catch (err: any) {
      setErrorMessage(err.message || 'Preview failed. Check observation format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!textContent.trim()) {
      setErrorMessage('Please provide observation text.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setIngestSuccessMessage(null);
    try {
      const resp = await ingestAsciiData(textContent, {
        stationId: stationId.trim() || undefined,
        delimiter: selectedDelimiter !== 'auto' ? selectedDelimiter : undefined,
      });
      setIngestSuccessMessage(resp.message);
      setIngestedStationIds(resp.created_stations);
      setPreviewResult({
        success: true,
        report: resp.report,
        preview_records: [],
        detected_delimiter: resp.report.detected_delimiter || 'auto',
        column_mapping: resp.report.column_mapping || {},
        header_metadata: {},
      });
      onRefreshData?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ingestion failed. Review report for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlyToStation = (stId: string) => {
    onStationIngested?.(stId);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 8, 22, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="sci-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.02em' }}>
                  ASCII / Text Observation Ingestion
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  PHASE 4
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Ingest whitespace, CSV, TSV, or CTD profiles into standard schema & 3D visualization
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '4px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Preset Buttons */}
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>
              Load Template Presets
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleSelectPreset(key)}
                  className="sci-btn"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                  }}
                >
                  {item.label}
                </button>
              ))}

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv,.dat,.ascii"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="sci-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                }}
              >
                Browse Local File...
              </button>
            </div>
          </div>

          {/* Config Bar (Station ID & Delimiter override) */}
          <div
            className="sci-card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              padding: '16px',
            }}
          >
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Station / Platform Identifier
              </label>
              <input
                type="text"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                placeholder="e.g. ASCII-BAY-001"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Delimiter Override
              </label>
              <select
                value={selectedDelimiter}
                onChange={(e) => setSelectedDelimiter(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  outline: 'none',
                  cursor: 'pointer',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              >
                <option value="auto">Auto-Detect Delimiter</option>
                <option value="\s+">Whitespace / Spaces (\s+)</option>
                <option value=",">Comma (,)</option>
                <option value="&#9;">Tab (\t)</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
          </div>

          {/* Text Editor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Raw Observation Data (Editable)
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {textContent.split('\n').length} lines · {textContent.length} characters
              </span>
            </div>
            <textarea
              rows={8}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste ASCII data here..."
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '16px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#e2e8f0',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {ingestSuccessMessage && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                padding: '16px',
                color: '#6ee7b7',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ fontWeight: 600 }}>
                ASCII DATA INGESTED<br />
                {previewResult?.report.records_received ?? 0} observations processed<br />
                {previewResult?.report.records_valid ?? 0} valid<br />
                {previewResult?.report.records_removed ?? 0} errors<br />
                Source: DEMO / USER INGESTED
              </div>
              {ingestedStationIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>Created station:</span>
                  {ingestedStationIds.map((stId) => (
                    <button
                      key={stId}
                      onClick={() => handleFlyToStation(stId)}
                      className="sci-btn"
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        borderColor: 'rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '11px',
                      }}
                    >
                      Fly to {stId} on Globe
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview / Validation Results */}
          {previewResult && (
            <div
              className="sci-card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  Parser Diagnostics & Validation Summary
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                  }}
                >
                  Delimiter: {previewResult.detected_delimiter}
                </span>
              </div>

              {/* Stats KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>TOTAL ROWS</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', marginTop: '4px' }}>
                    {previewResult.report.records_received}
                  </div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 500 }}>VALID RECORDS</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#34d399', marginTop: '4px' }}>
                    {previewResult.report.records_valid}
                  </div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 500 }}>REJECTED ROWS</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#f87171', marginTop: '4px' }}>
                    {previewResult.report.records_removed}
                  </div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>DEPTH RANGE</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0', marginTop: '4px', fontFamily: 'monospace' }}>
                    {previewResult.report.depth_range ? `${previewResult.report.depth_range[0]} - ${previewResult.report.depth_range[1]}m` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Column Mapping Badges */}
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '8px' }}>
                  Column Mappings Identified
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(previewResult.column_mapping).map(([raw, mapped]) => (
                    <span
                      key={raw}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#94a3b8',
                      }}
                    >
                      {raw} → <strong style={{ color: '#e2e8f0' }}>{mapped}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Rejected Rows Warnings if any */}
              {previewResult.report.rejected_rows && previewResult.report.rejected_rows.length > 0 && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.1)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 600, marginBottom: '8px' }}>
                    Malformed Rows Skipped (Fault Isolation):
                  </div>
                  {previewResult.report.rejected_rows.map((rej, i) => (
                    <div key={i} style={{ fontSize: '11px', color: '#fecdd3', fontFamily: 'monospace', marginBottom: '2px' }}>
                      Line {rej.line}: {rej.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Table */}
              {previewResult.preview_records && previewResult.preview_records.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '8px' }}>
                    Parsed Observation Sample (First {previewResult.preview_records.length} Records)
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>LAT</th>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>LON</th>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>DEPTH (m)</th>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>TEMP (°C)</th>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>SAL (PSU)</th>
                          <th style={{ padding: '8px 12px', fontWeight: 500 }}>TIME (UTC)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.preview_records.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '8px 12px', color: '#e2e8f0', fontFamily: 'monospace' }}>{r.latitude}</td>
                            <td style={{ padding: '8px 12px', color: '#e2e8f0', fontFamily: 'monospace' }}>{r.longitude}</td>
                            <td style={{ padding: '8px 12px', color: '#38bdf8', fontFamily: 'monospace' }}>{r.depth}</td>
                            <td style={{ padding: '8px 12px', color: '#f59e0b', fontFamily: 'monospace' }}>{r.temperature ?? '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#10b981', fontFamily: 'monospace' }}>{r.salinity ?? '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                              {r.timestamp ? String(r.timestamp).substring(0, 16) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Supports ASCII whitespace, CSV, TSV, SeaBird CTD, & NOAA NDBC observation standards.
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="sci-btn"
              style={{
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 600,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Analyzing...' : 'Preview & Validate'}
            </button>

            <button
              onClick={handleIngest}
              disabled={isLoading}
              className="sci-btn"
              style={{
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(56, 189, 248, 0.15)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Ingesting...' : 'Ingest to Ocean Sentry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
