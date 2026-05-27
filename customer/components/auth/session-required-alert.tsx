import Link from 'next/link';
import { AlertBanner } from '@/components/ui/alert-banner';
import {
  CUSTOMER_MOBILE_OTP_LOGIN_PATH,
  isCustomerSessionRequiredMessage,
} from '@/lib/customer-session-required';

type SessionRequiredAlertProps = {
  message: string;
};

/** Error banner with a mobile OTP login CTA when the session is missing or expired. */
export function SessionRequiredAlert({ message }: SessionRequiredAlertProps) {
  const showLogin = isCustomerSessionRequiredMessage(message);

  return (
    <div className="grid gap-3">
      <AlertBanner variant="error">{message}</AlertBanner>
      {showLogin ? (
        <Link
          href={CUSTOMER_MOBILE_OTP_LOGIN_PATH}
          className="mc-btn-primary inline-flex justify-center w-full sm:w-auto"
        >
          Sign in with mobile OTP
        </Link>
      ) : null}
    </div>
  );
}
