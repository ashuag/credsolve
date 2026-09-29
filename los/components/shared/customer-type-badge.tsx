/** Fixed two-value badge for the "New" vs "Recurring" customer-type column, reused across Lead
 * Report, Bureau Report, Applications, and Loans — a customer is "Recurring" only once they have a
 * fully repaid loan under a *different* journey (see `customer-recurring-status.util.ts` on the
 * backend), so unlike other status columns this one only ever takes these two values. */
export function CustomerTypeBadge({ customerType, label }: { customerType: 'NEW' | 'RECURRING'; label: string }) {
  const style =
    customerType === 'RECURRING'
      ? { background: 'rgba(139,92,246,0.12)', color: '#6d28d9' }
      : { background: 'rgba(20,150,243,0.12)', color: '#0b4f86' };
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.72rem] font-extrabold uppercase tracking-[0.04em]"
      style={style}
    >
      {label}
    </span>
  );
}
