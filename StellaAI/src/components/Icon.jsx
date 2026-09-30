/* =========================================================
   REUSABLE ICON
========================================================= */

export default function Icon({ name, className = "" }) {
  if (name === "signal") {
    return (
      <svg
        className={`icon-signal-svg ${className}`.trim()}
        viewBox="0 0 11 9"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="0" y="6.5" width="1.8" height="2.5" rx="0.5" className="sig-bar sig-bar-1" />
        <rect x="3" y="4.5" width="1.8" height="4.5" rx="0.5" className="sig-bar sig-bar-2" />
        <rect x="6" y="2.2" width="1.8" height="6.8" rx="0.5" className="sig-bar sig-bar-3" />
        <rect x="9" y="0" width="1.8" height="9" rx="0.5" className="sig-bar sig-bar-4" />
      </svg>
    );
  }

  return (
    <span
      className={`icon icon-${name} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
