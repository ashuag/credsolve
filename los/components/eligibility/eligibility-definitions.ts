export const ELIGIBILITY_SECTION_DEFINITIONS = [
  {
    slug: 'credit-limit-eligibility-check',
    label: 'Credit Limit Eligibility Check',
    description: 'Edit unsecured-loan eligibility tiers and control whether each range stays available during decisioning.',
    href: '/eligibility-criteria/credit-limit-eligibility-check',
  },
  {
    slug: 'profile-eligibility-check',
    label: 'Profile Eligibility Check',
    description: 'Manage profile-level eligibility rules, threshold values, and whether each criterion remains active.',
    href: '/eligibility-criteria/profile-eligibility-check',
  },
] as const;

export type EligibilitySectionSlug = (typeof ELIGIBILITY_SECTION_DEFINITIONS)[number]['slug'];

export function getEligibilitySectionDefinition(slug: string) {
  return ELIGIBILITY_SECTION_DEFINITIONS.find((item) => item.slug === slug);
}
