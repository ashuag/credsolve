import { mergePortalProfileWithPriorPrefill, type FormattedPortalProfile } from './customer-portal-profile.mapper';

function profile(overrides: Partial<FormattedPortalProfile> = {}): FormattedPortalProfile {
  return {
    fullName: null,
    dob: null,
    panNumber: null,
    gender: null,
    occupation: null,
    addressLine1: null,
    addressLine2: null,
    currentCity: null,
    pincode: null,
    monthlyIncome: null,
    annualTurnover: null,
    annualProfit: null,
    creditConsentAccepted: false,
    panVerified: false,
    panVerifiedAt: null,
    ...overrides,
  };
}

describe('mergePortalProfileWithPriorPrefill', () => {
  const prior = profile({
    fullName: 'Ramesh Verma',
    dob: '1990-05-12',
    panNumber: 'ABCDE1234F',
    gender: 'MALE',
    occupation: 'SALARIED',
    addressLine1: '12 MG ROAD',
    currentCity: 'Pune, MH',
    pincode: '411001',
    monthlyIncome: '45000',
    creditConsentAccepted: true,
    panVerified: true,
    panVerifiedAt: '2026-01-01T00:00:00.000Z',
  });

  it('returns current when there is no prior profile', () => {
    const current = profile({ fullName: 'New Name' });
    expect(mergePortalProfileWithPriorPrefill(current, null)).toEqual(current);
    expect(mergePortalProfileWithPriorPrefill(null, null)).toBeNull();
  });

  it('copies prior details onto an empty new lead without consent or PAN verification', () => {
    expect(mergePortalProfileWithPriorPrefill(null, prior)).toEqual({
      ...prior,
      creditConsentAccepted: false,
      panVerified: false,
      panVerifiedAt: null,
    });
  });

  it('fills blank current fields from prior and keeps values already entered', () => {
    const current = profile({
      fullName: 'Ramesh Verma',
      monthlyIncome: '50000',
      creditConsentAccepted: true,
    });

    expect(mergePortalProfileWithPriorPrefill(current, prior)).toMatchObject({
      fullName: 'Ramesh Verma',
      dob: '1990-05-12',
      panNumber: 'ABCDE1234F',
      monthlyIncome: '50000',
      creditConsentAccepted: true,
      panVerified: false,
      panVerifiedAt: null,
    });
  });
});
