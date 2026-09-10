import { useEffect, useRef, useState } from 'react';

interface IntroSequenceProps {
  onComplete: () => void;
}

// Subtle star background canvas
function useStarCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.15 + 0.05,
      phase: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        const alpha = s.a * (0.65 + 0.35 * Math.sin(frame * 0.015 * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,215,255,${alpha})`;
        ctx.fill();
      });
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // phase: 0=black, 1=title & tagline, 2=loading progress, 3=ready
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(15);
  const [loadingStep, setLoadingStep] = useState('Initializing Ocean Intelligence Engine...');
  const [exiting, setExiting] = useState(false);

  useStarCanvas(canvasRef);

  // Progressive intro timeline
  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 300);

    const t1 = setTimeout(() => {
      setProgress(45);
      setLoadingStep('Loading NASA Earth Planetary Textures...');
    }, 1100);

    const t2 = setTimeout(() => {
      setProgress(78);
      setLoadingStep('Synchronizing Indian Ocean Buoys & ARGO Floats...');
    }, 2000);

    const t3 = setTimeout(() => {
      setProgress(100);
      setLoadingStep('Ocean Intelligence System Operational.');
      setPhase(2);
    }, 2800);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onComplete, 850);
  };

  // Auto-advance after 4.5s
  useEffect(() => {
    const t = setTimeout(handleEnter, 4600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #020617 0%, #000208 100%)',
        transition: 'opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* Star Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.8 }}
      />

      {/* Instant Skip Button in Top-Right */}
      <button
        onClick={() => {
          setExiting(true);
          onComplete();
        }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          zIndex: 60,
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(34, 211, 238, 0.4)',
          borderRadius: '4px',
          color: '#38bdf8',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '8px 16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 0 16px rgba(34, 211, 238, 0.15)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(34, 211, 238, 0.15)';
          e.currentTarget.style.borderColor = '#38bdf8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
          e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)';
        }}
      >
        SKIP INTRO →
      </button>

      {/* Main Scientific Intro Container */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6 max-w-xl">
        {/* Ocean Wave Vector Monogram */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(12px)',
            transition: 'opacity 1s ease, transform 1s ease',
          }}
        >
          <svg width="44" height="24" viewBox="0 0 48 28" fill="none">
            <path
              d="M2 18 C8 10, 14 6, 20 12 C26 18, 32 22, 38 16 C42 12, 44 10, 46 8"
              stroke="url(#introG)"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M2 24 C8 16, 16 12, 22 18 C28 24, 34 26, 40 20 C43 17, 45 15, 46 14"
              stroke="url(#introG2)"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <defs>
              <linearGradient id="introG" x1="2" y1="14" x2="46" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#22d3ee" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="introG2" x1="2" y1="20" x2="46" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0ea5e9" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 1.1s ease 0.1s, transform 1.1s ease 0.1s',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
              fontWeight: 300,
              letterSpacing: '0.28em',
              color: '#ffffff',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textShadow: '0 0 30px rgba(34,211,238,0.2)',
            }}
          >
            OCEAN SENTRY
          </h1>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.5), transparent)',
              marginTop: '10px',
            }}
          />
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 1s ease 0.25s, transform 1s ease 0.25s',
          }}
        >
          <p
            style={{
              fontSize: 'clamp(0.75rem, 1.6vw, 0.95rem)',
              letterSpacing: '0.2em',
              color: 'rgba(34,211,238,0.85)',
              fontWeight: 400,
              lineHeight: 1.8,
            }}
          >
            OCEAN INTELLIGENCE. REAL OBSERVATIONS.
            <br />
            BETTER DECISIONS.
          </p>
        </div>

        {/* Scientific Loading / Progress Indicator */}
        <div
          style={{
            width: '280px',
            marginTop: '8px',
            opacity: phase >= 1 ? 1 : 0,
            transition: 'opacity 0.8s ease 0.3s',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', letterSpacing: '0.12em', color: '#64748b' }}>
            <span>{loadingStep}</span>
            <span style={{ fontFamily: 'monospace', color: '#22d3ee' }}>{progress}%</span>
          </div>

          <div
            style={{
              width: '100%',
              height: '2px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #22d3ee)',
                boxShadow: '0 0 8px rgba(34,211,238,0.6)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>

        {/* Enter / Explore Button */}
        <div
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            marginTop: '10px',
          }}
        >
          <button
            onClick={handleEnter}
            style={{
              border: '1px solid rgba(34,211,238,0.45)',
              background: 'rgba(34,211,238,0.08)',
              color: 'rgba(34,211,238,0.95)',
              padding: '10px 28px',
              fontSize: '0.72rem',
              letterSpacing: '0.24em',
              cursor: 'pointer',
              borderRadius: '3px',
              transition: 'all 0.25s ease',
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 0 16px rgba(34,211,238,0.15)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(34,211,238,0.16)';
              (e.target as HTMLElement).style.borderColor = 'rgba(34,211,238,0.85)';
              (e.target as HTMLElement).style.boxShadow = '0 0 24px rgba(34,211,238,0.35)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(34,211,238,0.08)';
              (e.target as HTMLElement).style.borderColor = 'rgba(34,211,238,0.45)';
              (e.target as HTMLElement).style.boxShadow = '0 0 16px rgba(34,211,238,0.15)';
            }}
          >
            ENTER 3D GLOBE →
          </button>
        </div>

        <div
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.18em',
            color: 'rgba(148,163,184,0.4)',
            marginTop: '2px',
          }}
        >
          SIH 2026 · REAL-TIME OCEAN OBSERVATION & FORECAST PLATFORM
        </div>
      </div>
    </div>
  );
}
