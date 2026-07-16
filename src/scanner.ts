import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import type { AxeResults } from 'axe-core';
import type { AuthConfig } from './config';

export function getChromePath(): string {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    return execSync('which google-chrome').toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}

export interface ScanOptions {
  /** Path to JSON file with custom axe-core rules array */
  customRulesPath?: string;
  /** Auth config for protected pages */
  auth?: AuthConfig;
  /** Follow internal links up to this depth (0 = single page) */
  depth?: number;
  /** Max pages to crawl total (default: 50) */
  maxPages?: number;
}

/** Extract same-origin href links from a page */
async function extractLinks(page: import('puppeteer-core').Page, origin: string): Promise<string[]> {
  const hrefs: string[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => (a as HTMLAnchorElement).href)
  );
  return hrefs
    .filter((h) => {
      try { return new URL(h).origin === origin; } catch { return false; }
    })
    .map((h) => new URL(h).href.split('#')[0]); // strip fragments
}

async function applyAuth(
  page: import('puppeteer-core').Page,
  auth: AuthConfig
): Promise<void> {
  // Cookie injection
  if (auth.cookies) {
    const pairs = auth.cookies.split(';').map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      await page.setCookie({ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() });
    }
  }

  // Form-fill login
  if (auth.loginUrl && auth.usernameField && auth.passwordField) {
    await page.goto(auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.type(`[name="${auth.usernameField}"]`, auth.username ?? '');
    await page.type(`[name="${auth.passwordField}"]`, auth.password ?? '');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.keyboard.press('Enter'),
    ]);
  }
}

async function runAxe(
  page: import('puppeteer-core').Page,
  customRules: unknown[]
): Promise<AxeResults> {
  const axePath = require.resolve('axe-core');
  const axeSource = readFileSync(axePath, 'utf8');
  await page.evaluate(axeSource);
  const results = await page.evaluate((rules: unknown[]) => {
    if (rules.length > 0) {
      // @ts-ignore
      window.axe.configure({ rules });
    }
    // @ts-ignore
    return window.axe.run();
  }, customRules);
  return results as AxeResults;
}

export async function scanUrl(url: string, options: ScanOptions = {}): Promise<AxeResults> {
  const executablePath = process.env['CHROME_PATH'] ?? getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  try {
    if (options.auth) {
      await applyAuth(page, options.auth);
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let customRules: unknown[] = [];
    if (options.customRulesPath) {
      if (!existsSync(options.customRulesPath)) {
        throw new Error(`customRulesPath not found: ${options.customRulesPath}`);
      }
      customRules = JSON.parse(readFileSync(options.customRulesPath, 'utf8'));
    }

    return await runAxe(page, customRules);
  } finally {
    await browser.close();
  }
}

export interface CrawlResult {
  url: string;
  results: AxeResults;
}

/**
 * Deep-crawl starting from `startUrl`, following internal links up to `depth` levels.
 * Uses a BFS queue; deduplicates visited URLs.
 */
export async function crawlUrls(
  startUrl: string,
  options: ScanOptions = {}
): Promise<CrawlResult[]> {
  const maxDepth = options.depth ?? 0;
  const maxPages = options.maxPages ?? 50;
  const executablePath = process.env['CHROME_PATH'] ?? getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });

  let customRules: unknown[] = [];
  if (options.customRulesPath) {
    if (!existsSync(options.customRulesPath)) {
      throw new Error(`customRulesPath not found: ${options.customRulesPath}`);
    }
    customRules = JSON.parse(readFileSync(options.customRulesPath, 'utf8'));
  }

  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  // queue entries: [url, currentDepth]
  const queue: Array<[string, number]> = [[startUrl, 0]];
  const crawlResults: CrawlResult[] = [];

  try {
    if (options.auth) {
      const authPage = await browser.newPage();
      await applyAuth(authPage, options.auth);
      await authPage.close();
    }

    while (queue.length > 0 && crawlResults.length < maxPages) {
      const [currentUrl, currentDepth] = queue.shift()!;
      const normalised = currentUrl.split('#')[0];
      if (visited.has(normalised)) continue;
      visited.add(normalised);

      const page = await browser.newPage();
      try {
        await page.goto(normalised, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const axeResults = await runAxe(page, customRules);
        crawlResults.push({ url: normalised, results: axeResults });

        if (currentDepth < maxDepth) {
          const links = await extractLinks(page, origin);
          for (const link of links) {
            if (!visited.has(link)) {
              queue.push([link, currentDepth + 1]);
            }
          }
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return crawlResults;
}
