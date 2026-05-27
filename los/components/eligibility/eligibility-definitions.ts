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
    description:
      'Manage profile-level eligibility rules and thresholds (credit, age, bureau windows, negative state/pincode/city lists, and more), plus whether each rule is enforced.',
    href: '/eligibility-criteria/profile-eligibility-check',
  },
  {
    slug: 'serviceability-lists',
    label: 'Serviceability Negative Lists',
    description:
      'Add or soft-remove negative pincodes, cities, and states with added/removed timestamps and operator audit.',
    href: '/eligibility-criteria/serviceability-lists',
  },
] as const;
