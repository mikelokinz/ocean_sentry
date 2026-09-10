import type { AnomalyRecord } from '../../services/oceanApi';

interface AnomalyDetailPanelProps {
  anomaly: AnomalyRecord;
  onClose: () => void;
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    HIGH: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' },
    WARNING: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b' },
    NORMAL: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' },
  };
  const c = colors[status.toUpperCase()] ?? colors.NORMAL;
  return (
    <span
      style={{
        fontSize: '8px',
        letterSpacing: '0.15em',
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '3px',
        padding: '2px 6px',
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

export function AnomalyDetailPanel({ anomaly, onClose }: AnomalyDetailPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '64px',
        right: '16px',
        width: '260px',
        zIndex: 40,
        background: 'linear-gradient(135deg, rgba(8, 20, 44, 0.45) 0%, rgba(3, 10, 24, 0.55) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '10px',
        padding: '16px',
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 20px rgba(34, 211, 238, 0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <span style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#64748b', fontWeight: 600 }}>
            ANOMALY DETAIL
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Status + Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {statusBadge(anomaly.status)}
        <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
          ML Score: {anomaly.anomaly_score?.toFixed(3) ?? '—'}
        </span>
      </div>

      {/* Location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#475569' }}>LOCATION</div>
        <div style={{ fontSize: '10px', color: '#cbd5e1', fontFamily: 'monospace' }}>
          {anomaly.latitude?.toFixed(4)}°N, {anomaly.longitude?.toFixed(4)}°E
        </div>
        <div style={{ fontSize: '9px', color: '#64748b' }}>
          Depth: {anomaly.depth}m
        </div>
      </div>

      {/* Parameter + Values */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#475569' }}>
          PARAMETER: {anomaly.parameter?.toUpperCase() ?? '—'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <Field label="Observed" value={anomaly.observed_value != null ? anomaly.observed_value.toFixed(3) : '—'} />
          <Field label="Expected/Normal (Model)" value={anomaly.model_value != null ? anomaly.model_value.toFixed(3) : '—'} />
        </div>
      </div>

      {/* Difference */}
      {anomaly.difference != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#64748b' }}>RESIDUAL</div>
          <span style={{
            fontSize: '14px',
            fontFamily: 'monospace',
            fontWeight: 500,
            color: Math.abs(anomaly.difference) > 1 ? '#f59e0b' : '#94a3b8',
          }}>
            {anomaly.difference > 0 ? '+' : ''}{anomaly.difference.toFixed(4)}
          </span>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        marginTop: '4px',
        padding: '6px 8px',
        background: 'rgba(245, 158, 11, 0.05)',
        border: '1px solid rgba(245, 158, 11, 0.15)',
        borderRadius: '4px',
      }}>
        <div style={{ fontSize: '8px', color: '#fcd34d', lineHeight: 1.4 }}>
          <strong>Note:</strong> Anomaly indicates an unusual pattern compared with the learned normal/baseline. It does not automatically mean a disaster.
        </div>
      </div>

      {/* Metadata */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
        <div style={{ fontSize: '7px', color: '#334155', letterSpacing: '0.12em' }}>
          {anomaly.timestamp ?? 'No timestamp'} · {anomaly.station_id}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '7px', color: '#475569' }}>{label}</div>
      <div style={{ fontSize: '9px', color: '#cbd5e1', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}
