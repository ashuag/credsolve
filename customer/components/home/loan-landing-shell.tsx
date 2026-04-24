import type { ReactNode } from 'react';

function FinanceInfographic() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      <g transform="translate(140, 70)">
        <rect x="0" y="0" width="120" height="240" rx="24" fill="url(#phoneGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
        <rect x="10" y="20" width="100" height="200" rx="16" fill="#0f172a" />
        <path d="M40 10 L80 10" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
        
        <rect x="25" y="40" width="40" height="40" rx="8" fill="url(#accentGrad)" />
        <rect x="75" y="45" width="20" height="8" rx="4" fill="#334155" />
        <rect x="75" y="65" width="20" height="8" rx="4" fill="#334155" />

        <path d="M25 120 Q 40 100 55 110 T 85 90 L 85 140 L 25 140 Z" fill="rgba(96,165,250,0.3)" />
        <path d="M25 120 Q 40 100 55 110 T 85 90" stroke="#60a5fa" strokeWidth="3" fill="none" strokeLinecap="round" />
        
        <rect x="25" y="160" width="70" height="24" rx="12" fill="#16a34a" />
        <text x="60" y="176" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">APPROVED</text>
      </g>

      <g transform="translate(80, 100)" filter="url(#glow)">
        <circle cx="20" cy="20" r="20" fill="url(#accentGrad)" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#ca8a04" strokeWidth="2" opacity="0.6" />
        <text x="20" y="26" fill="#854d0e" fontSize="18" fontWeight="900" textAnchor="middle">₹</text>
      </g>

      <g transform="translate(280, 240)" filter="url(#glow)">
        <circle cx="24" cy="24" r="24" fill="url(#accentGrad)" />
        <circle cx="24" cy="24" r="18" fill="none" stroke="#ca8a04" strokeWidth="2" opacity="0.6" />
        <text x="24" y="32" fill="#854d0e" fontSize="22" fontWeight="900" textAnchor="middle">₹</text>
      </g>

      <g transform="translate(270, 80)" filter="url(#glow)">
        <path d="M25 0 L50 10 L50 30 C50 45 38 58 25 65 C12 58 0 45 0 30 L0 10 Z" fill="#60a5fa" />
        <path d="M25 0 L50 10 L50 30 C50 45 38 58 25 65 L25 0" fill="#2563eb" />
        <path d="M15 30 L22 37 L35 20" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 6" fill="none">
        <path d="M120 120 Q 140 100 160 140" />
        <path d="M260 220 Q 280 240 280 260" />
        <path d="M260 120 Q 275 110 270 120" />
      </g>
    </svg>
  );
}

export type LoanLandingShellProps = {
  journeyPanel: ReactNode;
  leftTitle?: ReactNode;
  leftDescription?: string;
  leftInfographic?: ReactNode;
  leftStats?: Array<{ label: string; value: string }>;
};

export function LoanLandingShell({ 
  journeyPanel,
  leftTitle,
  leftDescription,
  leftInfographic,
  leftStats
}: LoanLandingShellProps) {
  
  const defaultTitle = (
    <>Fast. Secure. <span className="text-[#60a5fa]">Instant.</span></>
  );
  
  const defaultStats = [
    { label: 'Paperless', value: '100%' },
    { label: 'Approval', value: 'Instant' },
    { label: 'Hidden Fees', value: 'Zero' },
  ];

  return (
    <div className="w-full max-w-[1200px] flex flex-col nav:flex-row bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(23,44,113,0.12)] overflow-hidden border border-white relative z-10">
        
        {/* Left side: Infographic Panel */}
        <div className="w-full nav:w-1/2 hidden nav:flex flex-col items-center justify-center relative bg-gradient-to-br from-[#1496f3] via-[#1c347d] to-[#12244f] p-10 overflow-hidden">
          {/* Subtle background glowing blobs */}
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#0ea5e9] rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-[#818cf8] rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
          
          <div className="relative z-10 w-full text-center mb-8">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
              {leftTitle || defaultTitle}
            </h1>
            <p className="text-[1.1rem] text-blue-100 max-w-sm mx-auto leading-relaxed">
              {leftDescription || "Experience a seamless digital journey. Get your loan approved in minutes without the hassle of paperwork."}
            </p>
          </div>

          <div className="relative z-10 w-full max-w-[360px] aspect-square transition-transform hover:scale-[1.03] duration-500 mb-4">
             {leftInfographic || <FinanceInfographic />}
          </div>

          <div className="relative z-10 mt-8 flex gap-4 w-full justify-around px-4">
            {(leftStats || defaultStats).map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-[0.7rem] text-blue-200 uppercase tracking-wider font-bold mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Customer Journey Form */}
        <div className="w-full nav:w-1/2 flex flex-col justify-center p-8 nav:p-14 bg-white relative">
          <div className="w-full max-w-[500px] mx-auto h-full">
            <div className="mb-8 nav:hidden text-center">
              <h1 className="text-3xl font-extrabold text-brand-navy mb-2">
                Instant Loan
              </h1>
              <p className="text-brand-muted">
                Start your seamless digital journey.
              </p>
            </div>
            {journeyPanel}
          </div>
        </div>
        
    </div>
  );
}
