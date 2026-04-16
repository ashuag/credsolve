import { getDashboard, type OutstandingPayment } from '@/lib/api/dashboard';
import { SectionPanel } from '@/components/ui/section-panel';

export default async function PaymentsPage() {
  const dashboard = await getDashboard();

  return (
    <SectionPanel
      eyebrow="Payments"
      title="Outstanding balances and payment history."
      description="Track the amount due and the current status of every recorded payment."
    >
      <div className="grid gap-3">
        {dashboard.outstandingPayments.map((payment: OutstandingPayment) => (
          <div key={payment.id} className="p-[16px_18px] rounded-[20px] border border-[rgba(18,36,79,0.12)] bg-[rgba(244,249,255,0.86)]">
            <strong>${Number(payment.amount).toLocaleString()}</strong>
            <p className="mt-1.5 text-brand-muted leading-relaxed">{payment.method}</p>
            <p className="mt-1.5 text-brand-muted leading-relaxed">{payment.status}</p>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
