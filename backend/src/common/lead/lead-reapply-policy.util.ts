import { LEAD_STATUS } from '../constants/lead.constants';

export type LeadReapplyPolicy = {
  reapplyAfterRejectedDays: number;
  blacklistDurationDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getLeadReapplyCooldownDays(
  statusName: string,
  policy: LeadReapplyPolicy,
): number | null {
  if (statusName === LEAD_STATUS.BLACKLISTED) {
    return policy.blacklistDurationDays;
  }
  if (statusName === LEAD_STATUS.REJECTED) {
    return policy.reapplyAfterRejectedDays;
  }
  return null;
}

/** `true` when the rejection/blacklist cooldown has elapsed and a fresh lead may be created. */
export function canReapplyAfterRejection(
  lead: { leadStatus: { name: string }; updatedAt: Date },
  policy: LeadReapplyPolicy,
): boolean {
  const cooldownDays = getLeadReapplyCooldownDays(lead.leadStatus.name, policy);
  if (cooldownDays == null) {
    return false;
  }
  const canReapplyAt = lead.updatedAt.getTime() + cooldownDays * MS_PER_DAY;
  return canReapplyAt <= Date.now();
}

/** ISO date-time until reapply is allowed, or `null` when cooldown has elapsed / not applicable. */
export function getRejectedUntilIso(
  lead: { leadStatus: { name: string }; updatedAt: Date },
  policy: LeadReapplyPolicy,
): string | null {
  const cooldownDays = getLeadReapplyCooldownDays(lead.leadStatus.name, policy);
  if (cooldownDays == null) {
    return null;
  }
  const canReapplyAt = new Date(lead.updatedAt.getTime() + cooldownDays * MS_PER_DAY);
  return canReapplyAt.getTime() > Date.now() ? canReapplyAt.toISOString() : null;
}
