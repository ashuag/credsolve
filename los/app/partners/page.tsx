import { CrmShell } from '@/components/layout/crm-shell';
import { PartnerCreateForm } from '@/components/ui/partner-create-form';
import { getPartners } from '@/lib/api';
import styles from '@/app/partners/partners.module.css';

export default async function PartnersPage() {
  const partners = await getPartners();

  return (
    <CrmShell title="Partner Network">
      <div className={styles.page}>
        <section className={styles.statGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Total partners</span>
            <strong className={styles.statValue}>{partners.length}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Active</span>
            <strong className={styles.statValue}>{partners.filter((partner: any) => partner.status === 'ACTIVE').length}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Pending</span>
            <strong className={styles.statValue}>{partners.filter((partner: any) => partner.status === 'PENDING_REGISTRATION').length}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Team members</span>
            <strong className={styles.statValue}>{partners.reduce((count: number, partner: any) => count + partner.teamMembers.length, 0)}</strong>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.eyebrow}>Partner directory</span>
              <h2 className={styles.panelTitle}>Current partners</h2>
              <p className={styles.panelCopy}>Track which companies are active, who owns the relationship, and how much team coverage each partner currently has.</p>
            </div>

            <div className={styles.partnerList}>
              {partners.map((partner: any) => (
                <article key={partner.id} className={styles.partnerItem}>
                  <div className={styles.row}>
                    <div>
                      <strong>{partner.companyName}</strong>
                      <p className={styles.muted}>{partner.owner?.email}</p>
                    </div>
                    <span className={styles.badge}>{partner.status.replaceAll('_', ' ')}</span>
                  </div>
                  <p className={styles.muted}>{partner.businessAddress}</p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaChip}>{partner.partnerType}</span>
                    <span className={styles.metaChip}>{partner.phoneNumber}</span>
                    <span className={styles.metaChip}>{partner.teamMembers.length} team members</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.eyebrow}>Add partner</span>
              <h2 className={styles.panelTitle}>Create invitation record</h2>
              <p className={styles.panelCopy}>Onboard a new company using the same clean form surface as the rest of the LOS.</p>
            </div>

            <PartnerCreateForm />
          </article>
        </section>
      </div>
    </CrmShell>
  );
}
