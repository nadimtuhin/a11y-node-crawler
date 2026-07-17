/**
 * Lighthouse wrapper — runs Lighthouse programmatically if available,
 * falls back to a mock when the `lighthouse` package is not installed
 * (keeps the dependency optional so the package stays lightweight).
 */
import { execSync } from 'child_process';

export interface LighthouseA11yResult {
  url: string;
  score: number | null;         // 0–1, null when unavailable
  audits: LighthouseAudit[];
  runnerName: 'lighthouse' | 'mock';
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
}

/** Check whether the `lighthouse` npm package is resolvable at runtime. */
function isLighthouseAvailable(): boolean {
  try {
    require.resolve('lighthouse');
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Lighthouse a11y category against a URL.
 * If `lighthouse` is not installed, returns a clearly-marked mock result
 * so CI never hard-fails just because the optional dep is absent.
 *
 * ponytail: mock path; replace with real lighthouse() call once the dep is
 * added (npm i lighthouse) — the interface is already stable.
 */
export async function runLighthouse(url: string): Promise<LighthouseA11yResult> {
  if (isLighthouseAvailable()) {
    // Real path — dynamic require so tsc doesn't complain about missing types
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lighthouse = require('lighthouse') as (
      url: string,
      opts: Record<string, unknown>,
      cfg?: Record<string, unknown>
    ) => Promise<{ lhr: { categories: Record<string, { score: number }>; audits: Record<string, unknown> } }>;

    const chromePath = process.env['CHROME_PATH'] ?? detectChrome();
    const { default: puppeteer } = await import('puppeteer-core');
    const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const port = new URL((browser as unknown as { wsEndpoint(): string }).wsEndpoint()).port;

    try {
      const { lhr } = await lighthouse(url, {
        port: Number(port),
        output: 'json',
        onlyCategories: ['accessibility'],
      });

      const score = lhr.categories['accessibility']?.score ?? null;
      const audits: LighthouseAudit[] = Object.values(lhr.audits as Record<string, Record<string, unknown>>).map((a) => ({
        id: a['id'] as string,
        title: a['title'] as string,
        description: a['description'] as string,
        score: (a['score'] as number | null) ?? null,
        scoreDisplayMode: a['scoreDisplayMode'] as string,
      }));

      return { url, score, audits, runnerName: 'lighthouse' };
    } finally {
      await browser.close();
    }
  }

  // Mock path — stable shape, zero external deps
  return mockLighthouseResult(url);
}

export function mockLighthouseResult(url: string): LighthouseA11yResult {
  return {
    url,
    score: null,
    runnerName: 'mock',
    audits: [
      {
        id: 'color-contrast',
        title: 'Background and foreground colors have sufficient contrast ratio',
        description: 'Low-contrast text is difficult or impossible for many users to read.',
        score: null,
        scoreDisplayMode: 'notApplicable',
      },
      {
        id: 'image-alt',
        title: 'Image elements have `[alt]` attributes',
        description: 'Informative elements should aim for short, descriptive alternate text.',
        score: null,
        scoreDisplayMode: 'notApplicable',
      },
    ],
  };
}

function detectChrome(): string {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    return execSync('which google-chrome').toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}
