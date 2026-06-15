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
  export function executablePath(): string;

  const puppeteer: { launch: typeof launch; executablePath: typeof executablePath };
  export default puppeteer;
}
