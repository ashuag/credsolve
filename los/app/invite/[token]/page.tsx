import Image from 'next/image';
import { InviteRegistrationForm } from '@/components/ui/invite-registration-form';
import styles from '@/app/login/login.module.css';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logoPlate}>
          <Image
            src="/images/moneycash-logo.jpeg"
            alt="MoneyCash"
            width={540}
            height={168}
            sizes="(max-width: 640px) 60vw, 230px"
            className={styles.logoImage}
            priority
          />
        </div>

        <InviteRegistrationForm token={token} />
      </section>
    </main>
  );
}
