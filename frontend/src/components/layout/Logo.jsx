import { Link } from 'react-router-dom';

/** Wordmark + gauge glyph. Rendered inline so no image request is needed. */
export default function Logo({ to = '/', compact = false, className = '' }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="DriveEase home"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-lime/30 bg-lime/10">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
          <path
            d="M4.5 15.5 7 8.5A2 2 0 0 1 8.9 7h6.2a2 2 0 0 1 1.9 1.5l2.5 7"
            stroke="#D7F24B"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path d="M4 16h16" stroke="#D7F24B" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="8.5" cy="18.5" r="1.6" fill="#D7F24B" />
          <circle cx="15.5" cy="18.5" r="1.6" fill="#D7F24B" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[19px] font-semibold tracking-tightest text-white">
          Drive<span className="text-lime">Ease</span>
        </span>
      )}
    </Link>
  );
}
