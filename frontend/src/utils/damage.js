/**
 * Severity styling shared by the damage log and the vehicle history timeline.
 * Kept as plain functions so both screens stay visually consistent.
 */
export const SEVERITY_TONES = {
  MINOR: 'border-signal-warning/35 bg-signal-warning/10 text-signal-warning',
  MODERATE: 'border-signal-warning/45 bg-signal-warning/[0.14] text-signal-warning',
  MAJOR: 'border-signal-danger/35 bg-signal-danger/10 text-signal-danger',
  CRITICAL: 'border-signal-danger/50 bg-signal-danger/[0.16] text-signal-danger',
};

export function severityTone(severity) {
  return SEVERITY_TONES[severity] || 'border-white/12 bg-white/[0.05] text-mist-300';
}
