declare module 'puppeteer' {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    setContent(html: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
    pdf(options?: Record<string, unknown>): Promise<Uint8Array>;
  }

  export function launch(options?: Record<string, unknown>): Promise<Browser>;

  const puppeteer: { launch: typeof launch };
  export default puppeteer;
}
