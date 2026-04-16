export const CUSTOMER_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function normalizeCustomerMobile(value?: string) {
  return (value ?? '').replace(/\D/g, '').slice(0, 10);
}

export function isValidCustomerMobile(value?: string) {
  return CUSTOMER_MOBILE_REGEX.test(normalizeCustomerMobile(value));
}

export function formatCustomerMobile(value?: string) {
  const mobileNumber = normalizeCustomerMobile(value);

  if (!isValidCustomerMobile(mobileNumber)) {
    return 'your mobile number';
  }

  return `+91 ${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}`;
}
