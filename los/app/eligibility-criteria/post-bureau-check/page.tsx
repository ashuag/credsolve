import { redirect } from 'next/navigation';

/** Post BRE dry-run moved under Developer Tools. */
export default function LegacyPostBureauCheckPage() {
  redirect('/developer-tools/post-bureau-check');
}
