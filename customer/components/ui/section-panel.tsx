import { ReactNode } from 'react';

type SectionPanelProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headingLevel?: 'h1' | 'h2';
};

export function SectionPanel({
  eyebrow,
  title,
  description,
  children,
  className,
  headingLevel = 'h1'
}: SectionPanelProps) {
  const HeadingTag = headingLevel;

  return (
    <section className={`mc-card mc-card-glow${className ? ` ${className}` : ''}`}>
      <div className="mc-chip">{eyebrow}</div>
      <HeadingTag className="mt-[14px] mb-3 text-brand-navy text-[clamp(2rem,5vw,3rem)] leading-[0.96] tracking-[-0.05em] max-sm:text-[clamp(1.9rem,9vw,2.6rem)]">
        {title}
      </HeadingTag>
      {description ? (
        <p className="mb-4 text-brand-muted leading-relaxed">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
