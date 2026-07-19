import Image from 'next/image';
import { LoginForm } from '@/components/ui/login-form';
import styles from '@/app/login/login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logoPlate}>
          <Image
            src="/images/moneycash-logo.png"
            alt="MoneyCash"
            width={957}
            height={379}
            sizes="(max-width: 640px) 60vw, 230px"
            className={styles.logoImage}
            priority
          />
        </div>

        <div className={styles.formBlock}>
          <h1 className={styles.title}>Sign in</h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
