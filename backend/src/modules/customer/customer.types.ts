export type CustomerProfile = {
  id: string;
  uuid: string;
  mobileNumber: string;
  createdAt: string;
};

export type VerifiedCustomerProfile = CustomerProfile & {
  leadUuid?: string;
  leadEmail?: string | null;
  leadStatus?: string;
};
