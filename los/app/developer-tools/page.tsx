import { redirect } from 'next/navigation';

/** Hub route — sidebar parent links here; default to post-BRE inspector. */
export default function DeveloperToolsIndexPage() {
  redirect('/developer-tools/post-bureau-check');
}
