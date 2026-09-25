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
          <p className="m-0 text-[1.8rem] font-[800] tracking-tight text-[#0F2748]">
            Cred<span className="text-[#22C55E]">Solve</span>
          </p>
        </div>

        <InviteRegistrationForm token={token} />
      </section>
    </main>
  );
}
