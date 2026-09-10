import type { DepthLevel } from '../../types/ocean';

interface SubsurfaceHUDProps {
  depth: DepthLevel;
  observationCount: number;
  anomalyCount: number;
  isLoading: boolean;
  error: string | null;
  onReturnToSurface: () => void;
  onDepthChange: (depth: DepthLevel) => void;
}

const DEPTHS: DepthLevel[] = [0, 10, 50, 100, 500, 1000];

export function SubsurfaceHUD({
  depth,
  observationCount,
  anomalyCount,
  isLoading,
  error,
  onReturnToSurface,
  onDepthChange,
}: SubsurfaceHUDProps) {
  if (depth === 0) return null;

  const trackHeight = 120;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '16px',
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        background: 'linear-gradient(135deg, rgba(6, 18, 42, 0.45) 0%, rgba(2, 8, 20, 0.55) 100%)',
        border: '1px solid rgba(34, 211, 238, 0.25)',
        borderRadius: '10px',
        padding: '14px 12px',
        backdropFilter: 'blur(24px) saturate(190%)',
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
        minWidth: '110px',
      }}
    >
      {/* Title */}
      <div style={{ fontSize: '7px', letterSpacing: '0.2em', color: '#0891b2', fontWeight: 600 }}>
        SUBSURFACE
      </div>

      {/* Depth display */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#475569', marginBottom: '2px' }}>
          DEPTH
        </div>
        <div style={{ fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, color: '#22d3ee' }}>
          {depth}<span style={{ fontSize: '9px', marginLeft: '2px', color: '#64748b' }}>m</span>
        </div>
      </div>

      {/* Vertical depth track */}
      <div style={{ position: 'relative', width: '24px', height: `${trackHeight}px` }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: '1px',
            background: 'linear-gradient(180deg, rgba(34,211,238,0.6), rgba(34,211,238,0.1))',
            transform: 'translateX(-50%)',
          }}
        />
        {DEPTHS.slice(1).map((d, i) => {
          const y = (i / (DEPTHS.length - 2)) * trackHeight;
          const isActive = d === depth;
          return (
            <button
              key={d}
              onClick={() => onDepthChange(d)}
              style={{
                position: 'absolute',
                left: '50%',
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                width: isActive ? '8px' : '4px',
                height: isActive ? '8px' : '4px',
                borderRadius: '50%',
                background: isActive ? '#22d3ee' : 'rgba(34,211,238,0.3)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                boxShadow: isActive ? '0 0 8px #22d3ee' : 'none',
                transition: 'all 0.3s ease',
              }}
              title={`${d}m`}
            />
          );
        })}
        {[10, 100, 500, 1000].map((d) => {
          const idx = DEPTHS.indexOf(d as DepthLevel) - 1;
          const y = (idx / (DEPTHS.length - 2)) * trackHeight;
          return (
            <div
              key={d}
              style={{
                position: 'absolute',
                right: '-2px',
                top: `${y}px`,
                transform: 'translateY(-50%) translateX(100%)',
                fontSize: '6px',
                color: d === depth ? '#22d3ee' : '#475569',
                fontFamily: 'monospace',
                paddingLeft: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {d}
            </div>
          );
        })}
      </div>

      {/* Data counts */}
      {isLoading ? (
        <div style={{ fontSize: '7px', color: '#f59e0b', letterSpacing: '0.1em' }}>
          LOADING {depth}m...
        </div>
      ) : error ? (
        <div style={{ fontSize: '7px', color: '#ef4444', letterSpacing: '0.1em', textAlign: 'center' }}>
          DEPTH DATA UNAVAILABLE
        </div>
      ) : observationCount === 0 && anomalyCount === 0 ? (
        <div style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.4 }}>
          NO DATA WITHIN ±20M
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#22d3ee' }} />
            <span style={{ fontSize: '7px', color: '#94a3b8', letterSpacing: '0.1em' }}>
              {observationCount} OBS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: anomalyCount > 0 ? '#ef4444' : '#64748b', boxShadow: anomalyCount > 0 ? '0 0 4px #ef4444' : 'none' }} />
            <span style={{ fontSize: '7px', color: '#94a3b8', letterSpacing: '0.1em' }}>
              {anomalyCount} ANOMALIES
            </span>
          </div>
        </>
      )}

      {/* Data window */}
      {!isLoading && !error && observationCount > 0 && (
        <div style={{ fontSize: '6px', color: '#334155', letterSpacing: '0.08em', textAlign: 'center' }}>
          {Math.max(0, depth - 20)}–{depth + 20}m window
        </div>
      )}

      {/* Return to surface */}
      <button
        onClick={onReturnToSurface}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid rgba(34, 211, 238, 0.25)',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          marginTop: '4px',
        }}
      >
        <span style={{ fontSize: '10px', color: '#22d3ee' }}>↑</span>
        <span style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#22d3ee', fontWeight: 500 }}>
          SURFACE
        </span>
      </button>
    </div>
  );
}
