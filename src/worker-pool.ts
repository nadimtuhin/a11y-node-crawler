/**
 * Worker pool concurrency controls for parallel URL scanning.
 * Closes #15
 */
import type { AxeResults } from 'axe-core';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import type { ScanOptions, CrawlResult } from './scanner';

function getChromePath(): string {
  if (process.env['CHROME_PATH']) return process.env['CHROME_PATH'];
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    return execSync('which google-chrome').toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}

async function runAxeOnPage(
  page: import('puppeteer-core').Page,
  customRules: unknown[]
): Promise<AxeResults> {
  const axePath = require.resolve('axe-core');
  const axeSource = readFileSync(axePath, 'utf8');
  await page.evaluate(axeSource);
  return page.evaluate((rules: unknown[]) => {
    if (rules.length > 0) {
      (window as any).axe.configure({ rules });
    }
    return (window as any).axe.run();
  }, customRules) as Promise<AxeResults>;
}

export interface WorkerPoolOptions extends ScanOptions {
  /** Max parallel browser pages (default: 3) */
  concurrency?: number;
  /** Delay between launching each worker in ms (default: 0) */
  rateDelayMs?: number;
}

/**
 * Scan multiple URLs in parallel, bounded by `concurrency`.
 * ponytail: single shared browser instance; use separate browser per worker
 * for full isolation when memory allows.
 */
export async function scanUrlsParallel(
  urls: string[],
  options: WorkerPoolOptions = {}
): Promise<CrawlResult[]> {
  const concurrency = options.concurrency ?? 3;
  const rateDelayMs = options.rateDelayMs ?? 0;

  let customRules: unknown[] = [];
  if (options.customRulesPath) {
    if (!existsSync(options.customRulesPath)) {
      throw new Error(`customRulesPath not found: ${options.customRulesPath}`);
    }
    customRules = JSON.parse(readFileSync(options.customRulesPath, 'utf8'));
  }

  const executablePath = getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const results: CrawlResult[] = new Array(urls.length);

  try {
    // Semaphore via active-slot counter
    let active = 0;
    let nextIndex = 0;

    await new Promise<void>((resolve, reject) => {
      function tryNext() {
        while (active < concurrency && nextIndex < urls.length) {
          const idx = nextIndex++;
          active++;

          if (rateDelayMs > 0) {
            setTimeout(() => launchWorker(idx), rateDelayMs * idx);
          } else {
            launchWorker(idx);
          }
        }
        if (active === 0 && nextIndex >= urls.length) resolve();
      }

      async function launchWorker(idx: number) {
        const url = urls[idx];
        try {
          const page = await browser.newPage();
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            const axeResults = await runAxeOnPage(page, customRules);
            results[idx] = { url, results: axeResults };
          } finally {
            await page.close();
          }
        } catch (err) {
          reject(err);
          return;
        }
        active--;
        tryNext();
      }

      tryNext();
    });
  } finally {
    await browser.close();
  }

  return results;
}
