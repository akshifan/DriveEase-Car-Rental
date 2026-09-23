/**
 * Elegant static fallback shown when WebGL is unavailable (very old browsers,
 * hardened privacy modes, GPU blocklists) or when the visitor prefers reduced
 * motion and the device reports a weak GPU.
 *
 * It is a hand-authored SVG of the same car silhouette used by the 3D model, so
 * the page keeps its identity rather than showing an empty box or an error.
 */
export default function WebGLFallback({ reason = 'unavailable' }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      role="img"
      aria-label="Illustration of a DriveEase car"
    >
      <div className="pointer-events-none absolute inset-0 bg-radial-spot" aria-hidden="true" />
      <div className="absolute inset-0 hairline-grid opacity-[0.35]" aria-hidden="true" />

      <svg
        viewBox="0 0 720 300"
        className="relative w-[min(92%,720px)] drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="de-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A323C" />
            <stop offset="55%" stopColor="#161A20" />
            <stop offset="100%" stopColor="#0B0D10" />
          </linearGradient>
          <linearGradient id="de-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7FE3FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#161A20" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="de-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D7F24B" stopOpacity="0" />
            <stop offset="50%" stopColor="#D7F24B" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D7F24B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ground shadow */}
        <ellipse cx="360" cy="248" rx="300" ry="22" fill="#000" opacity="0.55" />
        {/* underglow */}
        <rect x="120" y="238" width="480" height="4" rx="2" fill="url(#de-glow)" />

        {/* lower body */}
        <path
          d="M104 196c0-26 12-42 40-50l52-14c26-30 52-46 96-50l56-4c44-2 78 12 104 42l30 34c26 8 38 22 38 46v18c0 10-6 16-16 16h-24c-6 0-10-4-10-10v-8H150v8c0 6-4 10-10 10h-20c-10 0-16-6-16-16v-24Z"
          fill="url(#de-body)"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2"
        />
        {/* cabin glass */}
        <path
          d="M238 132c22-24 44-36 78-39l44-3c34-2 60 8 82 32l14 16H228l10-6Z"
          fill="url(#de-glass)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.4"
        />
        {/* character line */}
        <path
          d="M150 186h444"
          stroke="#D7F24B"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* lights */}
        <rect x="596" y="168" width="42" height="16" rx="8" fill="#D7F24B" opacity="0.9" />
        <rect x="112" y="170" width="34" height="12" rx="6" fill="#F87171" opacity="0.75" />
        {/* wheels */}
        {[196, 524].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="222" r="44" fill="#0B0D10" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle cx={cx} cy="222" r="24" fill="#1E242C" stroke="#D7F24B" strokeOpacity="0.4" strokeWidth="2" />
            <circle cx={cx} cy="222" r="6" fill="#D7F24B" opacity="0.8" />
          </g>
        ))}
      </svg>

      <p className="absolute bottom-6 left-0 right-0 text-center text-[12px] text-mist-500">
        {reason === 'reduced-motion'
          ? 'Static view - motion is reduced on this device.'
          : '3D preview unavailable on this device - showing a still frame.'}
      </p>
    </div>
  );
}
