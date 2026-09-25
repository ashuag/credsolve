'use client';

/**
 * Compact visual row for small screens (left infographic is hidden below lg).
 */
export function AccountLoginMobileStrip() {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2" aria-hidden>
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[rgba(20,150,243,0.18)] bg-gradient-to-br from-[#f0f9ff] to-white shadow-[0_12px_28px_rgba(23,44,113,0.08)]">
        <MiniPhone />
      </span>
      <span className="px-0.5 text-[#1496f3]/40">→</span>
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-2 border-[#22c55e]/50 bg-gradient-to-br from-amber-50/90 to-white shadow-[0_14px_32px_rgba(34,197,94,0.25)] ring-2 ring-[#22c55e]/30">
        <MiniShield />
      </span>
      <span className="px-0.5 text-[#1496f3]/40">→</span>
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[rgba(20,150,243,0.18)] bg-gradient-to-br from-[#f0f9ff] to-white shadow-[0_12px_28px_rgba(23,44,113,0.08)]">
        <MiniDashboard />
      </span>
    </div>
  );
}

function MiniPhone() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="5" width="14" height="22" rx="3" stroke="#1496f3" strokeWidth="1.8" fill="rgba(20,150,243,0.06)" />
      <rect x="11" y="8" width="10" height="14" rx="1.5" fill="rgba(20,150,243,0.1)" />
      <circle cx="23" cy="7" r="3.5" fill="#22c55e" />
    </svg>
  );
}

function MiniShield() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 4l10 4v9c0 6-4 11-10 13-6-2-10-7-10-13V8l10-4z"
        fill="url(#msh)"
        stroke="#22c55e"
        strokeWidth="1.2"
      />
      <path d="M11 16l4 4 7-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="msh" x1="8" y1="6" x2="26" y2="28">
          <stop stopColor="#1496f3" />
          <stop offset="1" stopColor="#12244f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MiniDashboard() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="7" width="22" height="18" rx="3" stroke="#1496f3" strokeWidth="1.6" fill="rgba(255,255,255,0.8)" />
      <path d="M8 22l6-7 4 5 7-10" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="11" r="2" fill="#1496f3" opacity="0.85" />
    </svg>
  );
}
