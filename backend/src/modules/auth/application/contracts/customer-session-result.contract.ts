export type CustomerPortalLeadSnapshot = {
  uuid: string;
  status: string;
  email: string | null;
  emailVerified: boolean;
};

export type CustomerPortalProfileSnapshot = {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
  gender: 'male' | 'female' | 'others' | null;
  occupation:
    | 'salaried'
    | 'self_employed_professional'
    | 'self_employed_business'
    | 'student'
    | 'homemaker'
    | 'retired'
    | null;
  addressLine1: string | null;
  addressLine2: string | null;
  currentCity: string | null;
  pincode: string | null;
  monthlyIncome: string | null;
  annualTurnover: string | null;
  annualProfit: string | null;
  creditConsentAccepted: boolean;
};

export type CustomerSessionResult =
  | {
      authenticated: true;
      customerId: string;
      mobileNumber: string;
      lead: CustomerPortalLeadSnapshot | null;
      profile: CustomerPortalProfileSnapshot | null;
    }
  | { authenticated: false };
