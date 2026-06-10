import Link from 'next/link';
import type { LegalDocumentContent } from '@/lib/legal-content';

function linkifyParagraph(text: string) {
  const parts: Array<{ type: 'text' | 'link'; value: string; href?: string }> = [];
  const pattern =
    /(\/privacy-policy|\/terms-and-conditions|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s]+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('/')) {
      parts.push({ type: 'link', value: token, href: token });
    } else if (token.includes('@')) {
      parts.push({ type: 'link', value: token, href: `mailto:${token}` });
    } else {
      parts.push({ type: 'link', value: token, href: token });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (parts.length === 0) return text;

  return parts.map((part, index) => {
    if (part.type === 'text') return <span key={index}>{part.value}</span>;
    const external = part.href?.startsWith('http');
    if (external) {
      return (
        <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
          {part.value}
        </a>
      );
    }
    if (part.href?.startsWith('/')) {
      return (
        <Link key={index} href={part.href}>
          {part.value}
        </Link>
      );
    }
    return (
      <a key={index} href={part.href}>
        {part.value}
      </a>
    );
  });
}

function paragraphClassName(text: string): string {
  if (/^[a-z]\.\s/i.test(text)) return 'legal-subclause';
  if (/^\d+\.\d+/.test(text)) return 'legal-subclause';
  if (/^[A-Z][a-z].{0,80};$/.test(text) || /^To /.test(text)) return 'legal-list-item';
  return '';
}

type LegalDocumentViewProps = {
  document: LegalDocumentContent;
};

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  const sister =
    document.kind === 'terms'
      ? { href: '/privacy-policy', label: 'Privacy Policy' }
      : { href: '/terms-and-conditions', label: 'Terms & Conditions' };

  return (
    <div className="legal-layout">
      <aside className="legal-toc hidden lg:block" aria-label="Table of contents">
        <p className="legal-toc-label">On this page</p>
        <nav className="legal-toc-nav">
          {document.sections.map((section) => (
            <a key={section.id} href={`#section-${section.id}`} className="legal-toc-link">
              <span className="legal-toc-num">{section.id}.</span>
              <span>{section.title}</span>
            </a>
          ))}
        </nav>
      </aside>

      <article className="legal-doc">
        <header className="legal-hero">
          <div className="legal-hero-top">
            <div className="mc-chip">{document.kind === 'terms' ? 'Legal' : 'Privacy'}</div>
            <p className="legal-updated">Last updated {document.generatedAt}</p>
          </div>
          <h1 className="legal-title">{document.title}</h1>
          <p className="legal-lead">{document.description}</p>

          <div className="legal-meta-grid">
            <div className="legal-meta-card">
              <p className="legal-meta-label">Platform</p>
              <p className="legal-meta-value">MoneyCash</p>
            </div>
            <div className="legal-meta-card">
              <p className="legal-meta-label">Registered office</p>
              <p className="legal-meta-value">{document.registeredOffice}</p>
            </div>
            <div className="legal-meta-card">
              <p className="legal-meta-label">Contact</p>
              <p className="legal-meta-value">
                <a href={`mailto:${document.contactEmail}`}>{document.contactEmail}</a>
              </p>
            </div>
            {document.grievanceOfficer ? (
              <div className="legal-meta-card">
                <p className="legal-meta-label">Grievance officer</p>
                <p className="legal-meta-value">
                  {document.grievanceOfficer.name}
                  <br />
                  <a href={`mailto:${document.grievanceOfficer.email}`}>{document.grievanceOfficer.email}</a>
                  <br />
                  <a href={`tel:${document.grievanceOfficer.phone.replace(/\s/g, '')}`}>
                    {document.grievanceOfficer.phone}
                  </a>
                </p>
              </div>
            ) : null}
          </div>

          <div className="legal-related">
            <span>Related:</span>
            <Link href={sister.href}>{sister.label}</Link>
          </div>
        </header>

        <div className="legal-toc-mobile lg:hidden">
          <details className="legal-toc-details">
            <summary>Jump to section</summary>
            <nav className="legal-toc-nav">
              {document.sections.map((section) => (
                <a key={section.id} href={`#section-${section.id}`} className="legal-toc-link">
                  <span className="legal-toc-num">{section.id}.</span>
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </details>
        </div>

        {document.sections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-num">{section.id}</span>
              {section.title}
            </h2>
            <div className="legal-section-body">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className={paragraphClassName(paragraph)}>
                  {linkifyParagraph(paragraph)}
                </p>
              ))}
            </div>
          </section>
        ))}

        <footer className="legal-footer">
          <p>
            Questions about this document? Write to{' '}
            <a href={`mailto:${document.contactEmail}`}>{document.contactEmail}</a>.
          </p>
        </footer>
      </article>
    </div>
  );
}
