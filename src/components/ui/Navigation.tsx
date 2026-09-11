import { useState, useEffect } from 'react';

interface NavigationProps {
  onNavClick?: (section: string) => void;
  onOpenCompare?: () => void;
  onOpenPHAnalyzer?: () => void;
  onOpenIngest?: () => void;
  anomalyCount?: number;
  stationCount?: number;
  globeMode?: 'ocean-sentry' | 'weather-radar';
  onGlobeModeChange?: (mode: 'ocean-sentry' | 'weather-radar') => void;
}

const NAV_ITEMS = ['EXPLORE', 'WEATHER RADAR', 'OBSERVATIONS', 'MODELS', 'ANALYTICS', 'ABOUT'];

export function Navigation({
  onNavClick,
  onOpenCompare,
  onOpenPHAnalyzer,
  onOpenIngest,
  anomalyCount = 0,
  stationCount = 0,
  globeMode = 'ocean-sentry',
  onGlobeModeChange,
}: NavigationProps) {
  const [activeItem, setActiveItem] = useState(globeMode === 'weather-radar' ? 'WEATHER RADAR' : 'EXPLORE');
  const [menuOpen, setMenuOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  // Sync active item if external globeMode changes
  useEffect(() => {
    if (globeMode === 'weather-radar') {
      setActiveItem('WEATHER RADAR');
    } else if (activeItem === 'WEATHER RADAR') {
      setActiveItem('EXPLORE');
    }
  }, [globeMode]);

  // Live UTC Mission Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.toISOString().substring(11, 19);
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`UTC ${utc} · LOC ${hours}:${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleItemClick = (item: string) => {
    setActiveItem(item);
    if (item === 'WEATHER RADAR') {
      onGlobeModeChange?.('weather-radar');
    } else if (item === 'EXPLORE') {
      onGlobeModeChange?.('ocean-sentry');
    }
    onNavClick?.(item);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Top mission-control command bar */}
      <nav
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '52px',
          display: 'flex', alignItems: 'center',
          padding: '0 24px',
          zIndex: 40,
          background: 'linear-gradient(180deg, rgba(6, 16, 36, 0.48) 0%, rgba(2, 8, 20, 0.38) 100%)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.16)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Brand Logo & Telemetry Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          marginRight: '32px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}>
            <svg width="16" height="12" viewBox="0 0 20 12" fill="none">
              <path
                d="M1 8C3.5 4, 6 2, 8.5 5.5C11 9, 13 10, 16 7C17.5 5.5, 18.5 4.5, 19 4"
                stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: '13px', letterSpacing: '0.05em', color: '#f8fafc',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>OCEAN SENTRY</span>
              <span style={{ fontSize: '9px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>v2.4</span>
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.05em', fontWeight: 500 }}>
              Scientific Observation Platform
            </div>
          </div>
        </div>

        {/* Live Mission Clock */}
        <div
          className="hidden lg:flex"
          style={{
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '4px 12px',
            borderRadius: '6px',
            marginRight: '24px',
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
          <span style={{ fontSize: '11px', color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 500 }}>
            {timeStr || 'UTC 00:00:00'}
          </span>
        </div>

        {/* Nav links - desktop */}
        <div
          style={{ display: 'flex', gap: '8px', flex: 1 }}
          className="hidden sm:flex"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeItem === item;
            return (
              <button
                key={item}
                onClick={() => handleItemClick(item)}
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  padding: '6px 14px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#e2e8f0';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {isActive && item !== 'WEATHER RADAR' && (
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#38bdf8' }} />
                )}
                {item === 'WEATHER RADAR' && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#38bdf8',
                      boxShadow: '0 0 8px #38bdf8',
                    }}
                  />
                )}
                <span>{item}</span>
                {item === 'WEATHER RADAR' && (
                  <span
                    style={{
                      fontSize: '8.5px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} className="sm:hidden" />

        {/* Telemetry & System Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto',
        }}>
          {/* Mission stats chips */}
          <div style={{ display: 'flex', gap: '8px' }} className="hidden md:flex">
            <div
              onClick={() => onNavClick?.('OBSERVATIONS')}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '4px 10px',
                display: 'flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Active Floats:</span>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>{stationCount || 38}</span>
            </div>
            {anomalyCount > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '4px 10px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>Anomalies:</span>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>{anomalyCount}</span>
              </div>
            )}
          </div>

          {/* Quick Action: Ground-Truth Validation / Compare Data */}
          {onOpenCompare && (
            <button
              onClick={onOpenCompare}
              className="sci-btn"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Ground-Truth Validation (INCOIS vs Live In-Situ Sensor)"
            >
              Compare Data
            </button>
          )}

          {/* Quick Action: Live Ocean Water pH Determination */}
          {onOpenPHAnalyzer && (
            <button
              onClick={onOpenPHAnalyzer}
              className="sci-btn"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Determine Live Ocean Water pH (BGC-Argo ISFET Electrochemistry & Acidification)"
            >
              Live pH
            </button>
          )}

          {/* Quick Action: ASCII Observation Ingestion */}
          {onOpenIngest && (
            <button
              onClick={onOpenIngest}
              className="sci-btn"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Phase 4: Ingest ASCII / Text Ocean Observations"
            >
              Ingest ASCII
            </button>
          )}

          {/* ML Status Badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '4px 10px',
            borderRadius: '16px',
          }}>
            <div
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
              ML ENGINE ONLINE
            </span>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', padding: '4px',
            }}
            aria-label="Menu"
          >
            <svg width="18" height="14" viewBox="0 0 16 12" fill="none">
              <rect y="0" width="16" height="1.5" rx="1" fill="currentColor" />
              <rect y="5.25" width="16" height="1.5" rx="1" fill="currentColor" />
              <rect y="10.5" width="16" height="1.5" rx="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div
          className="sci-panel"
          style={{
            position: 'absolute', top: '52px', right: 0,
            borderRadius: '0 0 8px 8px',
            padding: '8px 0',
            zIndex: 50,
            minWidth: '180px',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'block', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: activeItem === item ? '#38bdf8' : '#94a3b8',
                padding: '10px 20px', textAlign: 'left',
                fontWeight: activeItem === item ? 600 : 500,
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
