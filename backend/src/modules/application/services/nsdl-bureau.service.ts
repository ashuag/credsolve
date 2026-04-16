import { Injectable } from '@nestjs/common';

/**
 * Bureau report returned by NSDL / CIBIL.
 * All fields are populated by the real API; this stub returns undefined
 * to signal that no live data is available yet.
 */
export type BureauReport = {
  /** CIBIL Vision Score (300–900). undefined = NTC (No credit history). */
  cibilScore: number | undefined;
  /** Declared total unsecured credit limit across all active trades (₹). */
  totalUnsecuredLimit: number;
  /** True if the bureau has no credit history for this customer. */
  isNtc: boolean;
  /** Open DPD trade exists within last N months. */
  hasOpenDpd6Months: boolean;
  /** Any 30+ DPD trade in last 3 months. */
  hasDpd30In3Months: boolean;
  /** Any 60+ DPD trade in last 9 months. */
  hasDpd60In9Months: boolean;
  /** Any 90+ DPD trade in last 12 months. */
  hasDpd90In12Months: boolean;
  /** Doubtful / Loss / Written-off / Settled trade in last 18 months. */
  hasAdverseIn18Months: boolean;
  /** Customer has any restructured loan. */
  hasRestructuredLoan: boolean;
  /** SMA or PWOS trade lines present. */
  hasSmaOrPwos: boolean;
  /** Active MFI loan. */
  hasActiveMfi: boolean;
  /** Number of loan enquiries in last 30 days. */
  enquiriesLast30Days: number;
};

/**
 * NSDL / CIBIL bureau service.
 * NOT YET IMPLEMENTED — returns undefined until the API integration is ready.
 * The eligibility service falls back to a mock when this returns undefined.
 */
@Injectable()
export class NsdlBureauService {
  async fetchReport(_panNumber: string, _fullName?: string): Promise<BureauReport | undefined> {
    // TODO: integrate NSDL / CIBIL bureau API here.
    return undefined;
  }
}
