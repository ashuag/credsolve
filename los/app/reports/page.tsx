import { redirect } from 'next/navigation';

/** Hub route — sidebar parent links here; default to Bureau Report. */
export default function ReportsIndexPage() {
  redirect('/reports/bureau-report');
}
