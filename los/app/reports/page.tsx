import { redirect } from 'next/navigation';

/** Hub route — sidebar parent links here; default to Lead Report. */
export default function ReportsIndexPage() {
  redirect('/reports/lead-report');
}
