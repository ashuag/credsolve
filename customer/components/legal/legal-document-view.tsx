import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LegalDocumentContent } from '@/lib/legal-content';

function linkifyParagraph(text: string): ReactNode {
  const parts: Array<{ type: 'text' | 'link'; value: string; href?: string }> = [];
  const pattern =
    /(\/[a-z-]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s]+|www\.[^\s]+)/gi;
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
    } else if (token.startsWith('www.')) {
      parts.push({ type: 'link', value: token, href: `https://${token}` });
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

type Block =
  | { type: 'subhead'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'para'; text: string };

/** Group flat paragraph strings into renderable blocks (sub-headings, bullet lists, paragraphs). */
function toBlocks(paragraphs: string[]): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;

  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', items: list });
      list = null;
    }
  };

  for (const raw of paragraphs) {
    if (raw.startsWith('- ')) {
      (list ??= []).push(raw.slice(2));
      continue;
    }
    flushList();
    if (raw.startsWith('## ')) {
      blocks.push({ type: 'subhead', text: raw.slice(3) });
    } else {
      blocks.push({ type: 'para', text: raw });
    }
  }
  flushList();
  return blocks;
}

function paragraphClassName(text: string): string {
  if (text.endsWith(':')) return 'legal-leadin';
  if (/^[a-z]\.\s/i.test(text)) return 'legal-subclause';
  if (/^\d+\.\d+/.test(text)) return 'legal-subclause';
  return '';
}

const isNumbered = (id: string) => /^\d+$/.test(id);

type LegalDocumentViewProps = {
  document: LegalDocumentContent;
};

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  return (
    <div className="legal-layout">
      <aside className="legal-toc hidden lg:block" aria-label="Table of contents">
        <p className="legal-toc-label">On this page</p>
        <nav className="legal-toc-nav">
          {document.sections.map((section) => (
            <a key={section.id} href={`#section-${section.id}`} className="legal-toc-link">
              {isNumbered(section.id) ? <span className="legal-toc-num">{section.id}.</span> : null}
              <span>{section.title}</span>
            </a>
          ))}
        </nav>
      </aside>

      <article className="legal-doc">
        <header className="legal-hero">
          <div className="legal-hero-top">
            <div className="mc-chip">{document.eyebrow}</div>
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
            <Link href="/policies">View all policies</Link>
          </div>
        </header>

        <div className="legal-toc-mobile lg:hidden">
          <details className="legal-toc-details">
            <summary>Jump to section</summary>
            <nav className="legal-toc-nav">
              {document.sections.map((section) => (
                <a key={section.id} href={`#section-${section.id}`} className="legal-toc-link">
                  {isNumbered(section.id) ? <span className="legal-toc-num">{section.id}.</span> : null}
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </details>
        </div>

        {document.sections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="legal-section">
            <h2 className="legal-section-title">
              {isNumbered(section.id) ? <span className="legal-section-num">{section.id}</span> : null}
              {section.title}
            </h2>
            <div className="legal-section-body">
              {toBlocks(section.paragraphs).map((block, index) => {
                if (block.type === 'subhead') {
                  return (
                    <h3 key={index} className="legal-subhead">
                      {linkifyParagraph(block.text)}
                    </h3>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul key={index} className="legal-list">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex}>{linkifyParagraph(item)}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={index} className={paragraphClassName(block.text)}>
                    {linkifyParagraph(block.text)}
                  </p>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="legal-footer">
          <p>
            Questions about this document? Write to{' '}
            <a href={`mailto:${document.contactEmail}`}>{document.contactEmail}</a>. Browse all our{' '}
            <Link href="/policies">policies &amp; disclosures</Link>.
          </p>
        </footer>
      </article>
    </div>
  );
}
