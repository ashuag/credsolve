'use client';

const PARTNERS = [
  { name: 'HDFC BANK', color: '#1c347d' },
  { name: 'ICICI Bank', color: '#f37021' },
  { name: 'AXIS BANK', color: '#971237' },
  { name: 'KOTAK', color: '#ed1c24' },
  { name: 'IndusInd Bank', color: '#911116' },
  { name: 'BAJAJ FINSERV', color: '#0072bc' }
];

export function PartnersGrid() {
  return (
    <section className="bg-white py-16 border-y border-[rgba(18,36,79,0.06)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#12244f]/40">Trusted by Leading Partners & Thousands of Customers</p>
          <p className="mt-2 text-xs font-bold text-[#12244f]/30 italic">We partner with top banks and NBFCs to bring you the best rates</p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {PARTNERS.map((partner, idx) => (
            <div key={idx} className="flex items-center gap-2 grayscale transition-all hover:grayscale-0">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: partner.color }} />
              <span className="text-lg font-black tracking-tighter text-[#12244f]/60">{partner.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 border-l border-[rgba(18,36,79,0.1)] pl-8">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 text-[#ffc519]" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs font-black text-[#12244f]">4.8/5 Rating</span>
            <span className="text-[0.6rem] font-bold text-[#12244f]/40 uppercase tracking-widest">50,000+ Happy Customers</span>
          </div>
        </div>
      </div>
    </section>
  );
}
