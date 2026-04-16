export const MASTER_DEFINITIONS = [
  {
    slug: 'lead-statuses',
    label: 'Lead Status',
    eyebrow: 'Statuses',
    description: 'Manage active and inactive lead workflow statuses while keeping internal system codes fixed.',
    pageTitle: 'Lead Status',
    pageSubtitle: 'Edit LOS-facing labels and control whether each lead status stays available in the workflow.',
    searchPlaceholder: 'Search lead statuses...',
    canCreate: false,
  },
  {
    slug: 'application-statuses',
    label: 'Application Status',
    eyebrow: 'Statuses',
    description: 'Manage application stage labels and availability without changing the underlying workflow codes.',
    pageTitle: 'Application Status',
    pageSubtitle: 'Maintain application status labels and active state on a dedicated page.',
    searchPlaceholder: 'Search application statuses...',
    canCreate: false,
  },
  {
    slug: 'lead-sources',
    label: 'Lead Sources',
    eyebrow: 'Acquisition',
    description: 'Add, edit, activate, and deactivate the lead sources used across LOS intake and attribution.',
    pageTitle: 'Lead Sources',
    pageSubtitle: 'Manage source names, types, and active state from a dedicated lead source page.',
    searchPlaceholder: 'Search lead sources...',
    canCreate: true,
  },
  {
    slug: 'states',
    label: 'States',
    eyebrow: 'Locations',
    description: 'Maintain the active and inactive state directory used by city mapping and LOS location masters.',
    pageTitle: 'States',
    pageSubtitle: 'Add, edit, activate, and deactivate states used across LOS location flows.',
    searchPlaceholder: 'Search states...',
    canCreate: true,
  },
  {
    slug: 'cities',
    label: 'Cities',
    eyebrow: 'Locations',
    description: 'Manage city records with state mapping, active and inactive state, and city name updates.',
    pageTitle: 'Cities',
    pageSubtitle: 'Manage city mappings, names, and active state on a dedicated city master page.',
    searchPlaceholder: 'Search cities or states...',
    canCreate: true,
  },
  {
    slug: 'occupations',
    label: 'Occupations',
    eyebrow: 'Lookup Values',
    description: 'Add, edit, activate, and deactivate occupation values shown in LOS and onboarding forms.',
    pageTitle: 'Occupations',
    pageSubtitle: 'Maintain occupation master values with active and inactive control.',
    searchPlaceholder: 'Search occupations...',
    canCreate: true,
  },
  {
    slug: 'reasons-for-loan',
    label: 'Reason for Loan',
    eyebrow: 'Lookup Values',
    description: 'Add, edit, activate, and deactivate reason for loan values used across LOS application flows.',
    pageTitle: 'Reason for Loan',
    pageSubtitle: 'Maintain reason for loan values with active and inactive control.',
    searchPlaceholder: 'Search reasons for loan...',
    canCreate: true,
  },
  {
    slug: 'genders',
    label: 'Genders',
    eyebrow: 'Lookup Values',
    description: 'Add, edit, activate, and deactivate gender values used across onboarding and application flows.',
    pageTitle: 'Genders',
    pageSubtitle: 'Maintain gender master values and their active state from one dedicated page.',
    searchPlaceholder: 'Search genders...',
    canCreate: true,
  },
] as const;

export type MasterSlug = (typeof MASTER_DEFINITIONS)[number]['slug'];

export function isMasterSlug(value: string): value is MasterSlug {
  return MASTER_DEFINITIONS.some((item) => item.slug === value);
}

export function getMasterDefinition(slug: string) {
  return MASTER_DEFINITIONS.find((item) => item.slug === slug);
}
