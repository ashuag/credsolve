'use client';

import { CountUp } from '@/components/ui/count-up';

export function StatsSection() {
  return (
    <section className="relative overflow-hidden bg-[#FAFBFD] py-16 sm:py-24 border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Stats Banner — Dark Navy Pill Container from Page 4 */}
        <div className="overflow-hidden rounded-3xl bg-[#0B1E3D] px-6 py-10 text-white shadow-xl sm:px-12 sm:py-14">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {/* Stat 1: 1 Lakh+ */}
            <div className="flex flex-col items-center pt-4 sm:pt-0 sm:px-4">
              <div className="text-[clamp(2.4rem,4.5vw,3.6rem)] font-[900] tracking-tight text-white">
                <CountUp to={1} suffix=" Lakh+" />
              </div>
              <p className="mt-2 text-xs font-[800] uppercase tracking-widest text-white/70">
                CUSTOMERS SERVED
              </p>
            </div>

            {/* Stat 2: ₹20 Cr+ */}
            <div className="flex flex-col items-center pt-4 sm:pt-0 sm:px-4">
              <div className="text-[clamp(2.4rem,4.5vw,3.6rem)] font-[900] tracking-tight text-white">
                <CountUp to={20} prefix="₹" suffix=" Cr+" />
              </div>
              <p className="mt-2 text-xs font-[800] uppercase tracking-widest text-white/70">
                MONEY DISBURSED
              </p>
            </div>

            {/* Stat 3: 2 */}
            <div className="flex flex-col items-center pt-4 sm:pt-0 sm:px-4">
              <div className="text-[clamp(2.4rem,4.5vw,3.6rem)] font-[900] tracking-tight text-white">
                <CountUp to={2} />
              </div>
              <p className="mt-2 text-xs font-[800] uppercase tracking-widest text-white/70">
                NBFC LENDING PARTNERS
              </p>
            </div>
          </div>
        </div>

        {/* Timestamp caption below pill */}
        <p className="mt-3 text-center text-xs font-[500] text-slate-400">
          Figures as on March 2026
        </p>

        {/* Lending Partners Section */}
        <div className="mt-20">
          <div className="text-center">
            {/* Badge */}
            <span className="text-xs font-[800] uppercase tracking-[0.2em] text-[#22C55E]">
              LENDING PARTNERS
            </span>
            {/* Heading */}
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-[700] tracking-tight text-[#081735]">
              Backed by RBI-registered NBFCs
            </h2>
            {/* Green accent line */}
            <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-[#22C55E]" />

            {/* Subtitle */}
            <p className="mx-auto mt-4 max-w-2xl text-sm font-[400] leading-relaxed text-[#081735]/75 sm:text-base">
              We build and run the journey; our NBFC partners sanction and fund the loan.
              You always know who your lender is, and you can reach them directly.
            </p>
          </div>

          {/* 2 NBFC Partner Disclosure Cards */}
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Partner 1: Aasra Fincorp Private Limited */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xs sm:p-8">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-xl font-[900] text-[#0B1E3D]">
                  Aasra Fincorp Private Limited
                </h3>
                <p className="mt-1 text-xs font-[700] text-[#10B981]">
                  RBI-registered NBFC &bull; Registration no. B-14.02078
                </p>
              </div>

              <dl className="mt-5 space-y-3.5 text-xs sm:text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Registered office</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    16, Community Centre, 1st Floor, East of Kailash, New Delhi - 110065
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Website</dt>
                  <dd className="col-span-2 font-[600] text-[#0284C7]">
                    <a href="https://aasrafincorp.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
                      https://aasrafincorp.com
                    </a>
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Nodal Officer</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    Mr. Vikas Sharma &bull; +91 11 4100 8900 &bull; nodal@aasrafincorp.com
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Grievance Officer</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    Mr. Sandeep Kumar &bull; +91 11 4100 8901 &bull; grievance@aasrafincorp.com
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Products</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    Personal loan &bull; Short-term loan
                  </dd>
                </div>
              </dl>
            </div>

            {/* Partner 2: Regulated NBFC Partner Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xs sm:p-8">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-xl font-[900] text-[#0B1E3D]">
                  Regulated NBFC Partner
                </h3>
                <p className="mt-1 text-xs font-[700] text-[#10B981]">
                  RBI-registered NBFC &bull; Registration no. [N-XX.XXXXX]
                </p>
              </div>

              <dl className="mt-5 space-y-3.5 text-xs sm:text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Registered office</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    [Corporate Office Address, Registered in India]
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Website</dt>
                  <dd className="col-span-2 font-[600] text-[#0284C7]">
                    https://partner-nbfc.in
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Nodal Officer</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    [Nodal Officer Name] &bull; +91 [phone] &bull; nodal@partner-nbfc.in
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Grievance Officer</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    [Grievance Officer Name] &bull; +91 [phone] &bull; grievance@partner-nbfc.in
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-[700] text-slate-400">Products</dt>
                  <dd className="col-span-2 font-[600] text-[#0B1E3D]">
                    Instant Personal Loan &bull; Emergency Credit
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
