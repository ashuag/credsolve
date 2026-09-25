'use client';

const COMMITMENTS = [
  {
    title: 'Full cost disclosed upfront',
    description:
      'The sanctioned amount, repayment date, interest, every applicable fee and the total repayable are set out in the Key Fact Statement before you accept.',
  },
  {
    title: 'No charge before disbursal',
    description:
      'Applicable fees are deducted at the time of disbursal and disclosed in advance. No payment is ever sought to secure an approval.',
  },
  {
    title: 'Cooling-off period on every loan',
    description:
      'You may exit within the cooling-off window on payment of only the proportionate interest, without penalty.',
  },
  {
    title: 'Purpose-limited use of data',
    description:
      'Information is collected only for the application you submit, with your explicit consent, stored in India, and never sold to third parties.',
  },
  {
    title: 'Reporting to credit bureaus',
    description:
      'Your lending partner reports repayment conduct to the bureaus, so timely repayment strengthens your credit profile.',
  },
  {
    title: 'A defined escalation path',
    description:
      "A named grievance officer, your lending partner's officer, and the RBI Integrated Ombudsman where a matter is unresolved after 30 days.",
  },
] as const;

export function CustomerCommitments() {
  return (
    <section id="commitments" className="relative overflow-hidden bg-white py-16 sm:py-24 border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center">
          <span className="text-xs font-[800] uppercase tracking-[0.2em] text-[#22C55E]">
            CUSTOMER COMMITMENTS
          </span>
          <h2 className="mt-2 text-[clamp(2.2rem,4.5vw,3.4rem)] font-[700] tracking-tight text-[#081735]">
            Transparency, by design
          </h2>
          {/* Green accent line */}
          <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-[#22C55E]" />

          <p className="mx-auto mt-4 max-w-2xl text-sm font-[400] leading-relaxed text-[#081735]/75 sm:text-base">
            Six commitments we hold ourselves to on every application, in line with the RBI Digital Lending Directions.
          </p>
        </div>

        {/* 6 Commitments Cards in 2 Columns */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {COMMITMENTS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-[#FAFBFD] p-6 shadow-xs transition-all hover:bg-white hover:shadow-md sm:p-7"
            >
              {/* Green Circular Checkmark */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#16A34A]">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                </svg>
              </div>

              {/* Text */}
              <div>
                <h3 className="text-base font-[800] text-[#081735] sm:text-lg">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs font-[400] leading-relaxed text-[#081735]/70 sm:text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
