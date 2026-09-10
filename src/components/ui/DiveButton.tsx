interface DiveButtonProps {
  isSubsurface: boolean;
  onDive: () => void;
  onSurface: () => void;
  disabled?: boolean;
}

export function DiveButton({ isSubsurface, onDive, onSurface, disabled }: DiveButtonProps) {
  const handleClick = () => {
    if (isSubsurface) {
      onSurface();
    } else {
      onDive();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="tactical-glass tactical-bracket-box font-hud animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: isSubsurface
          ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(6, 78, 120, 0.35) 100%)'
          : 'linear-gradient(135deg, rgba(6, 18, 42, 0.45) 0%, rgba(2, 8, 20, 0.55) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isSubsurface ? 'rgba(34, 211, 238, 0.6)' : 'rgba(34, 211, 238, 0.35)'}`,
        borderRadius: '24px',
        padding: '8px 18px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: isSubsurface
          ? '0 0 24px rgba(34, 211, 238, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
          : '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(34, 211, 238, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        style={{
          transform: isSubsurface ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.3s ease',
        }}
      >
        <path
          d="M7 2V12M7 12L3 8M7 12L11 8"
          stroke="#22d3ee"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Label */}
      <span
        style={{
          fontSize: '8.5px',
          letterSpacing: '0.18em',
          color: '#38bdf8',
          fontWeight: 700,
          fontFamily: 'monospace',
        }}
      >
        {isSubsurface ? 'RETURN TO SURFACE' : 'DIVE SUBSURFACE'}
      </span>
    </button>
  );
}
