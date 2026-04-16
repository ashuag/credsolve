import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="mc-card mc-card-glow max-w-md w-full text-center">
        <div className="mc-chip mx-auto">404</div>
        <h1 className="mt-4 mb-3 text-brand-navy text-[clamp(2rem,6vw,2.8rem)] leading-[0.96] tracking-[-0.05em]">
          Page not found.
        </h1>
        <p className="text-brand-muted leading-[1.6] mb-6">
          The page you are looking for does not exist or has been moved. Head back to continue your MoneyCash journey.
        </p>
        <Link href="/" className="mc-btn-primary inline-flex w-full justify-center">
          Back to home
        </Link>
      </div>
    </div>
  );
}
