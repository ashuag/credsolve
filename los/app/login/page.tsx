import { LoginForm } from '@/components/ui/login-form';
import styles from '@/app/login/login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logoPlate}>
          <p className="m-0 text-[1.8rem] font-[800] tracking-tight text-[#0F2748]">
            Cred<span className="text-[#22C55E]">Solve</span>
          </p>
        </div>

        <div className={styles.formBlock}>
          <h1 className={styles.title}>Sign in</h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
